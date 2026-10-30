import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
    /كل رحلة دخول/,
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
      name: "قبول توصية البوابة ٢ وتحديث المسار",
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
  await scenes.getByRole("button", { name: "شركة النقل", exact: true }).click();
  await page
    .getByRole("button", { name: "تكبير شاشة شركة النقل", exact: true })
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
    .getByRole("button", { name: "الاستثناءات", exact: true })
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

test("A18 eight specialized gates and browser-local GPS reroute after an accepted assignment", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const events: unknown[] = [];
    Object.assign(window, { __navigationEvents: events });
    const watch = navigator.geolocation.watchPosition.bind(
      navigator.geolocation,
    );
    const clear = navigator.geolocation.clearWatch.bind(navigator.geolocation);
    navigator.geolocation.watchPosition = (success, error, options) => {
      events.push(["watch", document.visibilityState]);
      return watch(
        (p) => {
          events.push(["position", p.coords.accuracy]);
          success(p);
        },
        (e) => {
          events.push(["error", e.code]);
          error?.(e);
        },
        options,
      );
    };
    navigator.geolocation.clearWatch = (id) => {
      events.push(["clear", id]);
      clear(id);
    };
    document.addEventListener("visibilitychange", () =>
      events.push(["visibility", document.visibilityState]),
    );
  });
  const company = await client("company"),
    driver = await client("driver");
  try {
    const gates = (
      await company.from("gates").select("*").order("display_order")
    ).data!;
    expect(gates).toHaveLength(8);
    expect(
      gates.filter((g) => g.eligible_operations.includes("container")),
    ).toHaveLength(3);
    expect(
      gates.filter((g) => g.eligible_operations.includes("general_cargo")),
    ).toHaveLength(3);
    expect(
      gates.filter((g) => g.eligible_operations.includes("refrigerated")),
    ).toHaveLength(2);
    await login(page, "company");
    await page.goto("/ar/gates");
    await expect(page.locator(".gate-card")).toHaveCount(8);
    await page.screenshot({
      path: `.local/gates-eight-${info.project.name}.png`,
      fullPage: true,
    });
    if (info.project.name === "chromium")
      await page.screenshot({
        path: "public/showcase/screens/gates-live.png",
        fullPage: true,
      });
    const truck = (await company.from("trucks").select("*").limit(1)).data![0];
    const gateA = gates.find((g) => g.code === "GATE-A")!,
      gateB = gates.find((g) => g.code === "GATE-B")!;
    const created = await company.rpc("create_entry_trip", {
      p_key: randomUUID(),
      p_input: {
        driver_profile_id: account("driver").profile_id,
        truck_id: truck.id,
        gate_id: gateA.id,
        operation_type: "container",
        cargo_type: "A18 navigation verification — simulated",
        cargo_weight_kg: 12000,
        container_number: "DEMO-NAV",
        planned_departure_at: new Date().toISOString(),
        appointment_start_at: new Date(Date.now() - 3600000).toISOString(),
        appointment_end_at: new Date(Date.now() + 3600000).toISOString(),
        travel_minutes: 5,
      },
    });
    expect(created.error).toBeNull();
    const id = created.data!;
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
    await login(page, "driver");
    await page.goto(`/ar/trips/${id}`);
    const nav = page.locator(".driver-navigation");
    await nav.scrollIntoViewIfNeeded();
    await expect(nav.locator(".navigation-destination strong")).toHaveText(
      "GATE-A",
    );
    await page
      .getByRole("button", { name: "تشغيل رحلة محاكاة", exact: true })
      .click();
    await expect(nav.getByRole("status")).toContainText("وضع المحاكاة");
    await page
      .getByRole("button", { name: "إيقاف التتبع", exact: true })
      .click();
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: 19.66,
      longitude: 57.67,
      accuracy: 12,
    });
    await page.getByRole("button", { name: "تفعيل GPS", exact: true }).click();
    await expect(nav.getByRole("status")).toContainText("GPS فعلي نشط");
    await context.setGeolocation({
      latitude: 19.662,
      longitude: 57.675,
      accuracy: 8,
    });
    await expect(nav.getByRole("status")).toContainText(/(?:8|٨)/);
    expect(
      (
        await driver.rpc("apply_trip_command", {
          p_trip: id,
          p_command: "accept_recommendation",
          p_payload: { gate_id: gateB.id },
          p_key: randomUUID(),
        })
      ).error,
    ).toBeNull();
    await page
      .getByRole("button", { name: "تحديث الحالة", exact: true })
      .click();
    await expect(nav.locator(".navigation-destination strong")).toHaveText(
      "GATE-B",
    );
    await page
      .getByRole("button", { name: "إيقاف التتبع", exact: true })
      .click();
    await expect(nav.getByRole("status")).toContainText("التتبع متوقف");
    await context.setGeolocation({
      latitude: 19.663,
      longitude: 57.676,
      accuracy: 5,
    });
    await expect(nav.getByRole("status")).toContainText("التتبع متوقف");
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { __navigationEvents: unknown[][] }
        ).__navigationEvents.some((e) => e[0] === "clear"),
      ),
    ).toBe(true);
    await nav.screenshot({
      path: `.local/navigation-${info.project.name}.png`,
    });
    if (info.project.name === "chromium")
      await nav.screenshot({
        path: "public/showcase/screens/navigation-live.png",
      });
    expect(
      (
        await driver
          .from("trips")
          .select("status,gate_id,completed_at")
          .eq("id", id)
          .single()
      ).data,
    ).toMatchObject({
      status: "in_transit",
      gate_id: gateB.id,
      completed_at: null,
    });
    await page.goto("/ar/gates");
  } finally {
    await company.auth.signOut({ scope: "local" });
    await driver.auth.signOut({ scope: "local" });
  }
});
