import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { t } from "../../src/lib/i18n";
import type { Database } from "../../src/types/database";
const accounts = JSON.parse(
  readFileSync(".local/demo-accounts.json", "utf8"),
) as {
  account_key: string;
  email: string;
  password: string;
  profile_id: string;
}[];
const account = (key: string) => accounts.find((a) => a.account_key === key)!;
async function client(key: string) {
  const db = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect(
    (
      await db.auth.signInWithPassword({
        email: account(key).email,
        password: account(key).password,
      })
    ).error,
  ).toBeNull();
  return db;
}
async function login(page: Page, key: string) {
  await page.goto("/ar/login");
  await page
    .getByLabel("البريد الإلكتروني", { exact: true })
    .fill(account(key).email);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill(account(key).password);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
}

test("A18 public 3D story, presentation, route change, exceptions and detailed exploration", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/ar/login");
  await page
    .getByRole("link", { name: "استكشف SmartGate", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ar\/showcase$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /دخول أذكى للشاحنات/,
  );
  await expect(page.locator(".port-scene")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 40_000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `.local/showcase-hero-${info.project.name}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "ابدأ عرض الخمس دقائق", exact: true })
    .click();
  await page
    .getByRole("button", { name: "إيقاف العرض مؤقتًا", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "متابعة العرض", exact: true }),
  ).toBeVisible();
  const scenes = page.getByRole("navigation", { name: "مشاهد العرض" });
  await scenes
    .getByRole("button", { name: "رحلة السائق", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "مسار تجريبي إلى بوابة الحاويات ١",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "محاكاة الاقتراب إلى 5 كم وإعادة التقييم",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "قبول البوابة ٢ وتحديث وجهة Google Maps",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("img", {
      name: "مسار تجريبي إلى بوابة الحاويات ٢",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `.local/showcase-driver-${info.project.name}.png`,
  });
  await scenes
    .getByRole("button", { name: "تخطيط الرحلة", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تكبير شاشة تخطيط الرحلة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("dialog")
        .getByRole("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "إغلاق معاينة الشاشة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await scenes
    .getByRole("button", { name: "التعامل مع الاستثناءات", exact: true })
    .click();
  await page
    .getByRole("button", { name: "اختلاف الهوية", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "اختلاف قراءة اللوحة", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تأخر العبور", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "الحاجز مفتوح، والعبور متأخر",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "إنهاء العرض والعودة للاستكشاف", exact: true })
    .click();
  const filters = page.getByRole("group", {
    name: "تصفية البوابات حسب التخصص",
  });
  await filters.scrollIntoViewIfNeeded();
  await filters
    .getByRole("button", { name: "شحنات مبردة", exact: true })
    .click();
  await expect(page.locator(".catalog-grid article")).toHaveCount(2);
  await page.locator(".feature-index summary").first().click();
  await expect(page.locator(".feature-description").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("A19 initial assignment, shared GPS permissions, 5km reassessment and Google destination", async ({
  page,
  context,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180000);
  const company = await client("company"),
    driver = await client("driver"),
    sim = await client("simulation"),
    other = await client("company2");
  const gates = (await company.from("gates").select("*").order("display_order"))
    .data!;
  const a = gates.find((g) => g.code === "GATE-A")!,
    b = gates.find((g) => g.code === "GATE-B")!,
    c = gates.find((g) => g.code === "GATE-C")!;
  const driverContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? { width: 1280, height: 720 },
    geolocation: { latitude: 19.6, longitude: 57.6, accuracy: 8 },
    permissions: ["geolocation"],
  });
  const operatorContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? { width: 1280, height: 720 },
  });
  const driverPage = await driverContext.newPage(),
    operatorPage = await operatorContext.newPage();
  const change = async (gate: typeof a, queue: number, status = "open") =>
    expect(
      (
        await sim.rpc("update_demo_gate", {
          p_gate: gate.id,
          p_input: { status, queue_length: queue, service_rate_per_hour: 15 },
        })
      ).error,
    ).toBeNull();
  try {
    expect(gates).toHaveLength(8);
    await change(a, 1);
    await change(b, 6);
    await login(page, "company");
    await page.goto("/ar/company/new");
    await expect(
      page.getByRole("combobox", { name: t("ar", "gate"), exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(t("ar", "automaticGate"), { exact: true }),
    ).toBeVisible();
    if (
      info.project.name === "chromium" &&
      process.env.CAPTURE_SHOWCASE_ASSETS === "1"
    )
      await page.screenshot({
        path: "public/showcase/screens/create-trip-live.png",
        fullPage: true,
      });
    const truck = (await company.from("trucks").select("*").limit(1)).data![0];
    const created = await company.rpc("create_entry_trip", {
      p_key: randomUUID(),
      p_input: {
        driver_profile_id: account("driver").profile_id,
        truck_id: truck.id,
        gate_id: c.id,
        operation_type: "container",
        cargo_type: "A19 GPS sharing verification — synthetic",
        cargo_weight_kg: 12000,
        container_number: "DEMO-A19",
        planned_departure_at: new Date().toISOString(),
        appointment_start_at: new Date(Date.now() - 3600000).toISOString(),
        appointment_end_at: new Date(Date.now() + 3600000).toISOString(),
        travel_minutes: 5,
      },
    });
    expect(created.error).toBeNull();
    const id = created.data!;
    const trip = (await company.from("trips").select("*").eq("id", id).single())
      .data!;
    expect(trip.gate_id).toBe(a.id);
    expect(
      (
        await driver.rpc("apply_trip_command", {
          p_trip: id,
          p_command: "start",
          p_payload: {},
          p_key: randomUUID(),
        })
      ).error,
    ).toBeNull();
    await login(driverPage, "driver");
    await driverPage.goto("/ar/trips/" + id);
    const nav = driverPage.locator(".driver-navigation");
    await nav.scrollIntoViewIfNeeded();
    const google = nav.getByRole("link", {
      name: t("ar", "openGoogleMaps"),
      exact: true,
    });
    const url = new URL((await google.getAttribute("href"))!);
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("destination")).toBe(
      a.latitude + "," + a.longitude,
    );
    await expect(nav.locator(".driver-map")).toHaveCount(0);
    const share = nav.getByRole("button", {
      name: t("ar", "startSharing"),
      exact: true,
    });
    await expect(share).toBeDisabled();
    await nav.getByRole("checkbox").check();
    await share.click();
    await expect
      .poll(
        async () =>
          (
            await company
              .from("trip_locations")
              .select("latitude")
              .eq("trip_id", id)
              .single()
          ).data?.latitude,
      )
      .toBe(19.6);
    expect(
      (await other.from("trip_locations").select("*").eq("trip_id", id)).data,
    ).toEqual([]);
    expect(
      (await sim.from("trip_locations").select("*").eq("trip_id", id)).data,
    ).toEqual([]);
    await page.goto("/ar/company");
    await expect(
      page
        .locator(".fleet-tracking")
        .getByRole("link", { name: trip.request_number, exact: true }),
    ).toBeVisible();
    await login(operatorPage, "operator");
    await operatorPage.goto("/ar/operator");
    await expect(
      operatorPage
        .locator(".fleet-tracking")
        .getByRole("link", { name: trip.request_number, exact: true }),
    ).toBeVisible();
    if (
      info.project.name === "chromium" &&
      process.env.CAPTURE_SHOWCASE_ASSETS === "1"
    )
      await page
        .locator(".fleet-tracking")
        .screenshot({ path: "public/showcase/screens/fleet-live.png" });
    await change(a, 8);
    await change(b, 1);
    expect(
      (
        await driver.rpc("apply_trip_command", {
          p_trip: id,
          p_command: "accept_recommendation",
          p_payload: { gate_id: b.id },
          p_key: randomUUID(),
        })
      ).error?.message,
    ).toContain("not_approaching");
    await driverPage.bringToFront();
    if (await share.isEnabled()) await share.click();
    await driverContext.setGeolocation({
      latitude: 19.665,
      longitude: 57.704,
      accuracy: 8,
    });
    await expect
      .poll(
        async () =>
          (
            await company
              .from("trip_locations")
              .select("latitude")
              .eq("trip_id", id)
              .single()
          ).data?.latitude,
        { timeout: 20000 },
      )
      .toBe(19.665);
    await expect(
      page
        .locator(".tracking-item")
        .filter({ has: page.getByRole("link", { name: trip.request_number }) })
        .getByRole("link", { name: t("ar", "viewInGoogleMaps") }),
    ).toHaveAttribute("href", /query=19\.665%2C57\.704/, { timeout: 25000 });
    await driverPage
      .getByRole("button", { name: t("ar", "refresh"), exact: true })
      .click();
    if (
      info.project.name === "chromium" &&
      process.env.CAPTURE_SHOWCASE_ASSETS === "1"
    )
      await driverPage
        .getByRole("heading", { name: t("ar", "recommendation"), exact: true })
        .locator("..")
        .screenshot({
          path: "public/showcase/screens/recommendation-live.png",
        });
    await driverPage
      .getByRole("button", { name: t("ar", "accept"), exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await company.from("trips").select("gate_id").eq("id", id).single())
            .data?.gate_id,
      )
      .toBe(b.id);
    await expect(nav.locator(".navigation-destination strong")).toHaveText(
      "GATE-B",
    );
    await expect(google).toHaveAttribute(
      "href",
      new RegExp(
        "destination=" + encodeURIComponent(b.latitude + "," + b.longitude),
      ),
    );
    await nav
      .getByRole("button", { name: t("ar", "stopTracking"), exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await company
              .from("trip_locations")
              .select("sharing_active")
              .eq("trip_id", id)
              .single()
          ).data?.sharing_active,
      )
      .toBe(false);
    await expect(nav.locator("time")).not.toContainText(t("ar", "unavailable"));
    if (
      info.project.name === "chromium" &&
      process.env.CAPTURE_SHOWCASE_ASSETS === "1"
    )
      await nav.screenshot({
        path: "public/showcase/screens/navigation-live.png",
      });
    await nav.screenshot({
      path: ".local/google-sharing-" + info.project.name + ".png",
    });
    const cross = await driverContext.request.post("/api/tracking", {
      headers: { origin: "https://example.invalid" },
      data: { trip_id: id, session_id: randomUUID(), action: "stop" },
    });
    expect(cross.status()).toBe(403);
  } finally {
    for (const gate of [a, b])
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
    await driverContext.close();
    await operatorContext.close();
    for (const db of [company, driver, sim, other])
      await db.auth.signOut({ scope: "local" });
  }
});
