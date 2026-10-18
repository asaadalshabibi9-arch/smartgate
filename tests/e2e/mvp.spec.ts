import {
  test,
  expect,
  type Page,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import QRCode from "qrcode";
import { locales, t, direction } from "../../src/lib/i18n";

type Account = {
  account_key: string;
  email: string;
  password: string;
  profile_id: string;
  company_id: string | null;
};
const accounts: Account[] = JSON.parse(
  process.env.E2E_ACCOUNTS_JSON ??
    readFileSync(".local/demo-accounts.json", "utf8"),
);
const account = (key: string) => accounts.find((a) => a.account_key === key)!;
test("eight languages preserve routes and render native scripts without page overflow", async ({
  page,
}) => {
  await login(page, "company");
  for (const locale of locales) {
    await page.goto(`/${locale}/gates?review=1`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      direction(locale),
    );
    await expect(
      page.getByRole("heading", {
        name: t(locale, "gates"),
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    const picker = page.getByRole("combobox", {
      name: t(locale, "language"),
      exact: true,
    });
    await expect(picker).toHaveValue(locale);
    expect(await picker.locator("option").count()).toBe(8);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("combobox", { name: t("ne", "language"), exact: true })
    .selectOption("ur");
  await expect(page).toHaveURL(/\/ur\/gates\?review=1$/);
  await expect(
    page.getByRole("heading", {
      name: t("ur", "gates"),
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
});

test("automatic fallback refreshes another actor's change and administration remains closed", async ({
  page,
}) => {
  await login(page, "company");
  await page.goto("/en/administration");
  await expect(
    page.getByRole("heading", { name: "Page unavailable", exact: true }),
  ).toBeVisible();
  await page.goto("/en/gates");
  const sim = await client("simulation");
  const original = await sim
    .from("gates")
    .select("*")
    .eq("code", "GATE-C")
    .single();
  expect(original.error).toBeNull();
  const gate = original.data!;
  const card = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "GATE-C", exact: true }),
    });
  try {
    expect(
      (
        await sim.rpc("update_demo_gate", {
          p_gate: gate.id,
          p_input: {
            status: gate.status,
            queue_length: 71,
            service_rate_per_hour: 15,
          },
        })
      ).error,
    ).toBeNull();
    await expect(card.getByText("71", { exact: true })).toBeVisible({
      timeout: 35_000,
    });
    await page.context().setOffline(true);
    await expect(
      page.getByText("Offline; displayed data may be stale", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.context().setOffline(false);
    expect(
      (
        await sim.rpc("update_demo_gate", {
          p_gate: gate.id,
          p_input: {
            status: gate.status,
            queue_length: gate.queue_length ?? "",
            service_rate_per_hour: gate.service_rate_per_hour ?? "",
          },
        })
      ).error,
    ).toBeNull();
    await sim.auth.signOut({ scope: "local" });
  }
});

test("location requires a user action and never invents configured gate positions", async ({
  page,
  context,
}) => {
  await login(page, "company");
  await page.goto("/en/gates");
  await expect(
    page.getByText("Gate coordinates are not configured.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTitle("Map", { exact: true })).toHaveCount(0);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 23.6,
    longitude: 58.4,
    accuracy: 50,
  });
  await page
    .getByRole("button", { name: "Show my location", exact: true })
    .click();
  await expect(
    page.getByText(/Approximate location accuracy \(m\): 50/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open external map" }),
  ).toHaveAttribute("href", /mlat=23.6&mlon=58.4/);
  await expect(page.getByTitle("Map", { exact: true })).toHaveCount(0);
  await page.route("https://www.openstreetmap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<p>Map provider fixture</p>",
    }),
  );
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByTitle("Map", { exact: true })).toHaveAttribute(
    "src",
    /marker=23.6,58.4/,
  );
});

test("camera QR decoding fills a reference, stops capture and never submits verification", async ({
  page,
}) => {
  await login(page, "simulation");
  const db = await client("simulation");
  const trip = await db
    .from("trips")
    .select("id,status")
    .like("cargo_type", "[SC03] %")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  expect(trip.error).toBeNull();
  const reference = randomUUID();
  const image = await QRCode.toDataURL(reference, { width: 480, margin: 4 });
  await page.addInitScript(
    ({ image }) => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const picture = new Image();
          picture.src = image;
          await picture.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 640;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 640, 640);
          ctx.drawImage(picture, 80, 80);
          const media = canvas.captureStream(10);
          const draw = window.setInterval(
            () => ctx.drawImage(picture, 80, 80),
            100,
          );
          media
            .getTracks()[0]
            .addEventListener("ended", () => clearInterval(draw));
          Object.assign(window, { smartgateTestStream: media });
          return media;
        },
      });
    },
    { image },
  );
  try {
    await page.goto(`/en/trips/${trip.data!.id}`);
    await page
      .getByRole("button", { name: "Scan QR with camera", exact: true })
      .click();
    await expect(
      page.getByLabel("Read QR reference", { exact: true }),
    ).toHaveValue(reference);
    await expect(
      page.getByText("Reference scanned. Review it before verification.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as { smartgateTestStream: MediaStream }
          ).smartgateTestStream
            .getTracks()
            .every((track) => track.readyState === "ended"),
        ),
      )
      .toBe(true);
    expect(
      (await db.from("trips").select("status").eq("id", trip.data!.id).single())
        .data?.status,
    ).toBe(trip.data!.status);
    await page.evaluate(() =>
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      }),
    );
    await page
      .getByRole("button", { name: "Scan QR with camera", exact: true })
      .click();
    await expect(
      page.getByText(
        "Camera unavailable. Check permission or enter the reference manually.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByLabel("Read QR reference", { exact: true }),
    ).toBeEditable();
  } finally {
    await db.auth.signOut({ scope: "local" });
  }
});
// Short-lived Vercel authentication is sent only to the exact preview origin.
async function protectPreview(context: BrowserContext) {
  if (process.env.E2E_PUBLIC === "1") return;
  const target = process.env.E2E_BASE_URL;
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!target || !token || !target.startsWith("https://")) return;
  const origin = new URL(target).origin;
  await context.route(`${origin}/**`, (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-trusted-oidc-idp-token": token,
      },
    }),
  );
}
test.beforeEach(async ({ context }) => {
  await protectPreview(context);
});
async function client(key: string) {
  const db = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const a = account(key);
  const { error } = await db.auth.signInWithPassword({
    email: a.email,
    password: a.password,
  });
  expect(error).toBeNull();
  return db;
}
async function login(page: Page, key: string, locale = "en") {
  const a = account(key);
  await page.goto(`/${locale}/login`);
  await page
    .getByLabel(locale === "ar" ? "البريد الإلكتروني" : "Email", {
      exact: true,
    })
    .fill(a.email);
  await page
    .getByLabel(locale === "ar" ? "كلمة المرور" : "Password", { exact: true })
    .fill(a.password);
  await page
    .getByRole("button", {
      name: locale === "ar" ? "تسجيل الدخول" : "Sign in",
      exact: true,
    })
    .click();
  await expect(page).not.toHaveURL(/login/);
  await expect(
    page.getByRole("button", {
      name: locale === "ar" ? "تسجيل الخروج" : "Sign out",
      exact: true,
    }),
  ).toBeVisible();
}
async function user(browser: Browser, key: string) {
  const ctx = await browser.newContext({
    viewport: test.info().project.use.viewport,
    isMobile: test.info().project.use.isMobile,
    hasTouch: test.info().project.use.hasTouch,
  });
  const page = await ctx.newPage();
  await protectPreview(ctx);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, key);
  return { ctx, page, errors };
}
async function click(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

test("scenario library exposes instructions and fresh templates while preserving company isolation", async ({
  page,
}) => {
  await login(page, "company");
  await page
    .getByRole("link", { name: "Demo scenarios", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Demo scenarios" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(13);
  const plate = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Plate mismatch", exact: true }),
  });
  await plate.getByText("Scenario steps", { exact: true }).click();
  await expect(plate.getByText(/change the read plate/)).toBeVisible();
  await expect(
    plate.getByText("Verification exception", { exact: true }),
  ).toBeVisible();
  const isolation = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Another company’s workspace",
      exact: true,
    }),
  });
  await expect(isolation.getByText(/No saved run is available/)).toBeVisible();
  await expect(isolation.getByRole("link")).toHaveCount(0);
  const expired = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Expired appointment",
      exact: true,
    }),
  });
  await expired
    .getByRole("link", { name: "Create a new run", exact: true })
    .click();
  await expect(page).toHaveURL(/scenario=SC08/);
  await expect(
    page.getByLabel("Cargo description", { exact: true }),
  ).toHaveValue(/\[SC08\]/);
  const end = await page
    .getByLabel("Window ends", { exact: true })
    .inputValue();
  expect(new Date(`${end}+04:00`).getTime()).toBeLessThan(Date.now());
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("journey search, filters and pagination find saved scenarios without changing data", async ({
  page,
}) => {
  await login(page, "company");
  await expect(
    page.getByRole("navigation", { name: "Journey pages" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("searchbox", { name: "Search journeys", exact: true })
    .fill("SC03");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(
    page.getByRole("table").getByText("Plate mismatch", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search journeys", exact: true })
    .fill("SC07");
  await page
    .getByRole("combobox", { name: "Filter status", exact: true })
    .selectOption("barrier_open");
  await expect(
    page.getByRole("table").getByText("Awaiting crossing", { exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Search journeys", exact: true })
    .fill("NONEXISTENT-SCENARIO");
  await expect(
    page.getByRole("heading", { name: "No matching results" }),
  ).toBeVisible();
});

test("report listing opens reports directly and print layout retains the simulation disclosure", async ({
  page,
}) => {
  await login(page, "company");
  await page.getByRole("link", { name: "Entry reports", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/reports$/);
  await page
    .getByRole("searchbox", { name: "Search journeys", exact: true })
    .fill("SC11");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(
    page
      .getByRole("table")
      .getByText("Notification failure after entry", { exact: true }),
  ).toBeVisible();
  await page.getByRole("table").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Entry report" }),
  ).toBeVisible();
  await expect(
    page.getByText("Simulated delivery failure", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print report", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("complementary")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Print report", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByText("Demo simulation — no port or field hardware connection", {
      exact: true,
    }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("AT01–AT12: four real accounts complete entry, recover exceptions and retain delivery evidence", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const company = await user(browser, "company");
  const driver = await user(browser, "driver");
  const operator = await user(browser, "operator");
  const sim = await user(browser, "simulation");
  const companyDb = await client("company");
  const simDb = await client("simulation");
  let id: string | undefined;
  try {
    const gates = await companyDb.from("gates").select("*").order("code");
    expect(gates.error).toBeNull();
    const gateA = gates.data!.find((g) => g.code === "GATE-A")!;
    const gateB = gates.data!.find((g) => g.code === "GATE-B")!;
    for (const [gate, queue, status] of [
      [gateA, 8, "busy"],
      [gateB, 3, "open"],
    ] as const) {
      expect(
        (
          await simDb.rpc("update_demo_gate", {
            p_gate: gate.id,
            p_input: { queue_length: queue, service_rate_per_hour: 15, status },
          })
        ).error,
      ).toBeNull();
    }
    const trucks = await companyDb
      .from("trucks")
      .select("*")
      .order("plate_number");
    const truck = trucks.data![0];
    await company.page
      .getByRole("link", { name: "New journey", exact: true })
      .click();
    await company.page
      .getByRole("combobox", { name: "Driver", exact: true })
      .selectOption(account("driver").profile_id);
    await company.page
      .getByRole("combobox", { name: "Truck", exact: true })
      .selectOption(truck.id);
    await company.page
      .getByRole("combobox", { name: "Gate", exact: true })
      .selectOption(gateA.id);
    await company.page
      .getByLabel("Cargo description", { exact: true })
      .fill("E2E synthetic shipment");
    await company.page
      .getByLabel("Cargo weight (kg)", { exact: true })
      .fill("12000");
    // Required container validation is server-backed and does not create a partial journey.
    await click(company.page, "Save journey");
    await expect(
      company.page
        .getByRole("alert")
        .filter({ hasText: "Review the entered values" }),
    ).toBeVisible();
    await company.page
      .getByLabel("Container number", { exact: true })
      .fill("DEMO-E2E-001");
    await click(company.page, "Save journey");
    await expect(company.page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    id = company.page.url().split("/").pop()!;
    const path = `/en/trips/${id}`;
    await expect(
      company.page.getByRole("img", { name: "Journey QR" }),
    ).toBeVisible();
    await expect(company.page.getByRole("heading", { level: 1 })).toContainText(
      "SG-",
    );
    const state = async () => {
      const r = await companyDb
        .from("trips")
        .select("*")
        .eq("id", id!)
        .single();
      expect(r.error).toBeNull();
      return r.data!;
    };
    expect((await state()).status).toBe("planned");
    // RLS is tested using the actual API, including a different driver in the same company.
    for (const key of ["driver2", "driver3", "company2", "operator2"]) {
      const db = await client(key);
      expect((await db.from("trips").select("id").eq("id", id)).data).toEqual(
        [],
      );
      expect((await db.rpc("entry_report", { p_trip: id })).error).toBeTruthy();
      await db.auth.signOut({ scope: "local" });
    }
    await driver.page.goto(path);
    await click(driver.page, "Start journey");
    await expect(
      driver.page.getByRole("button", { name: "Report arrival", exact: true }),
    ).toBeVisible();
    await click(driver.page, "Accept recommendation");
    await expect.poll(async () => (await state()).gate_id).toBe(gateB.id);
    await click(driver.page, "Report arrival");
    await expect.poll(async () => (await state()).status).toBe("at_gate");
    await sim.page.goto(path);
    await sim.page.getByLabel("Read plate", { exact: true }).fill("MISMATCH");
    await click(sim.page, "Simulate identity reading and verify");
    await expect(
      sim.page.getByRole("heading", {
        name: "Verification exception",
        exact: true,
      }),
    ).toBeVisible();
    await operator.page.goto(path);
    await expect(
      operator.page.getByRole("button", {
        name: "Request barrier opening",
        exact: true,
      }),
    ).toHaveCount(0);
    expect((await state()).completed_at).toBeNull();
    await sim.page
      .getByLabel("Read plate", { exact: true })
      .fill(truck.plate_number);
    await click(sim.page, "Simulate identity reading and verify");
    await expect.poll(async () => (await state()).status).toBe("verified");
    await operator.page.reload();
    await click(operator.page, "Request barrier opening");
    await expect(
      operator.page.getByText(
        "Opening requested; awaiting the simulated device result.",
      ),
    ).toBeVisible();
    await sim.page.reload();
    await click(sim.page, "Simulate opening failure");
    await expect(
      sim.page.getByRole("heading", { name: "Barrier failure", exact: true }),
    ).toBeVisible();
    expect((await state()).completed_at).toBeNull();
    await operator.page.reload();
    await click(operator.page, "Request barrier opening");
    await expect.poll(async () => (await state()).barrier_requested).toBe(true);
    await sim.page.reload();
    await click(sim.page, "Simulate opening success");
    await expect(
      sim.page.getByRole("heading", { name: "Awaiting crossing", exact: true }),
    ).toBeVisible();
    expect((await state()).completed_at).toBeNull();
    await click(sim.page, "Confirm simulated crossing");
    await expect(
      sim.page.getByRole("heading", { name: "Entry completed", exact: true }),
    ).toBeVisible();
    const completed = await state();
    expect(completed.completed_at).toBe(completed.crossed_at);
    expect(completed.crossed_at).toBeTruthy();
    // Concurrent repeated crossing signals must not duplicate completion events or notifications.
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        simDb.rpc("apply_trip_command", {
          p_trip: id!,
          p_command: "crossing_confirmed",
          p_payload: {},
          p_key: randomUUID(),
        }),
      ),
    );
    for (const result of results) expect(result.error).toBeNull();
    expect(
      (
        await simDb
          .from("trip_events")
          .select("id")
          .eq("trip_id", id)
          .eq("event_type", "crossing_confirmed")
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await simDb
          .from("notifications")
          .select("id")
          .eq("trip_id", id)
          .eq("purpose", "entry_completed")
      ).data,
    ).toHaveLength(2);
    await company.page.goto(`${path}/report`);
    await expect(company.page.getByRole("heading", { level: 1 })).toContainText(
      "Entry report",
    );
    await expect(
      company.page.getByText("Available in app", { exact: true }),
    ).toHaveCount(2);
    await driver.page.goto("/en/notifications");
    await expect(
      driver.page.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeVisible();
    await expect(
      driver.page
        .getByRole("link", { name: /Truck entry completed/ })
        .and(driver.page.locator(`a[href="${path}"]`)),
    ).toBeVisible();
    expect(
      (
        await simDb.rpc("apply_trip_command", {
          p_trip: id,
          p_command: "notification_failed",
          p_payload: { recipient: account("driver").profile_id },
          p_key: randomUUID(),
        })
      ).error,
    ).toBeNull();
    await company.page.reload();
    await expect(
      company.page.getByText("Simulated delivery failure", { exact: true }),
    ).toBeVisible();
    expect((await state()).status).toBe("completed");
    for (const session of [company, driver, operator, sim])
      expect(session.errors).toEqual([]);
    await company.page.screenshot({
      path: `.local/report-en-${test.info().project.name}.png`,
      fullPage: true,
      caret: "initial",
    });
  } finally {
    if (id)
      expect(
        (await simDb.rpc("reset_demo_trip", { p_trip: id })).error,
      ).toBeNull();
    await Promise.all([
      company.ctx.close(),
      driver.ctx.close(),
      operator.ctx.close(),
      sim.ctx.close(),
      companyDb.auth.signOut({ scope: "local" }),
      simDb.auth.signOut({ scope: "local" }),
    ]);
  }
});

test("Arabic/English preserve route, responsive layouts and logout protection", async ({
  page,
}) => {
  await login(page, "company", "ar");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: "البوابات", exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/gates$/);
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/gates$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByRole("link", { name: "العربية", exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/gates$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { level: 1, name: "البوابات" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/gates-ar-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/login$/);
  await page.goto("/ar/company");
  await expect(page).toHaveURL(/\/ar\/login$/);
});

test("invalid credentials stay signed out; unknown journeys leak no data", async ({
  page,
}) => {
  await page.goto("/en/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("unknown@smartgate.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("incorrect-test-password");
  await click(page, "Sign in");
  await expect(
    page.getByRole("alert").filter({ hasText: "Sign-in failed" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/login/);
  const driverAccount = account("driver2");
  await page.getByLabel("Email", { exact: true }).fill(driverAccount.email);
  await page.getByLabel("Email", { exact: true }).press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page
    .getByLabel("Password", { exact: true })
    .fill(driverAccount.password);
  await page.getByLabel("Password", { exact: true }).press("Tab");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/driver$/);
  await page.goto(`/en/trips/${randomUUID()}`);
  await expect(
    page.getByRole("heading", { name: "Page unavailable" }),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/en/driver");
  await expect(page).toHaveURL(/\/en\/login$/);
});

test("simulation settings save, and a lost connection never claims success", async ({
  page,
}) => {
  await login(page, "simulation");
  const db = await client("simulation");
  const original = await db
    .from("gates")
    .select("*")
    .eq("code", "GATE-C")
    .single();
  expect(original.error).toBeNull();
  const gate = original.data!;
  let intercepted = false;
  try {
    await page.goto("/en/gates");
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "GATE-C", exact: true }),
    });
    await card.getByText("Update scenario", { exact: true }).first().click();
    await card.getByLabel("Trucks queued", { exact: true }).fill("2");
    await card
      .getByLabel("Service rate (trucks/hour)", { exact: true })
      .fill("15");
    await card
      .getByRole("button", { name: "Update scenario", exact: true })
      .click();
    await expect(
      card.getByText("Action saved.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await db
              .from("gates")
              .select("queue_length")
              .eq("id", gate.id)
              .single()
          ).data?.queue_length,
      )
      .toBe(2);
    // Reload clears the previous success message before the deliberately failed action.
    await page.reload();
    await card.getByText("Update scenario", { exact: true }).first().click();
    await card.getByLabel("Trucks queued", { exact: true }).fill("99");
    await page.route("**/*", (route) => {
      if (route.request().headers()["next-action"]) {
        intercepted = true;
        return route.abort("failed");
      }
      return route.continue();
    });
    await card
      .getByRole("button", { name: "Update scenario", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Unable to load workspace",
        exact: true,
      }),
    ).toBeVisible();
    expect(intercepted).toBe(true);
    await expect(page.getByText("Action saved.", { exact: true })).toHaveCount(
      0,
    );
    expect(
      (await db.from("gates").select("queue_length").eq("id", gate.id).single())
        .data?.queue_length,
    ).toBe(2);
    await page.unrouteAll();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Gates", exact: true, level: 1 }),
    ).toBeVisible();
  } finally {
    await page.unrouteAll();
    expect(
      (
        await db.rpc("update_demo_gate", {
          p_gate: gate.id,
          p_input: {
            status: gate.status,
            queue_length: gate.queue_length ?? "",
            service_rate_per_hour: gate.service_rate_per_hour ?? "",
          },
        })
      ).error,
    ).toBeNull();
    await db.auth.signOut({ scope: "local" });
  }
});
