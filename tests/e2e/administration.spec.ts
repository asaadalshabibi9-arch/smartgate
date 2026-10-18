import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import type { AdministrationData } from "../../src/lib/administration";

type Account = { email: string; password: string; account_key?: string };
const ready = existsSync(".local/platform-admin.json");
const admin: Account = ready ? JSON.parse(readFileSync(".local/platform-admin.json", "utf8")) : { email: "", password: "" };
const demos: Account[] = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"));
const demo = (key: string) => demos.find((a) => a.account_key === key)!;
async function client(a: Account) {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
  expect((await db.auth.signInWithPassword(a)).error).toBeNull();
  return db;
}
async function login(page: Page, a: Account) {
  await page.goto("/en/login");
  await page.getByLabel("Email", {exact:true}).fill(a.email);
  await page.getByLabel("Password", {exact:true}).fill(a.password);
  await page.getByRole("button", {name:"Sign in",exact:true}).click();
  await expect(page).not.toHaveURL(/login/);
}
const form = (page: Page, command: string) => page.locator("form").filter({has:page.locator(`input[name="admin_command"][value="${command}"]`)});
async function save(page: Page, command: string, label: string) {
  const target = form(page, command);
  await target.getByRole("button", {name:label,exact:true}).click();
  await expect(target.getByText("Action saved.", {exact:true})).toBeVisible({timeout:25_000});
}

test("explicit administrator provisions isolated accounts, trucks, assignments and reference coordinates", async ({page}) => {
  test.skip(!ready, "Dedicated administrator must be provisioned privately before cloud verification");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const db = await client(admin);
  expect((await db.rpc("is_platform_administrator")).data).toBe(true);
  const overview = async () => {
    const result = await db.rpc("administration_overview");
    expect(result.error).toBeNull();
    return result.data as unknown as AdministrationData;
  };
  await login(page, admin);
  await page.goto("/en/administration");
  await expect(page.getByRole("heading", {name:"Platform administration",exact:true,level:1})).toBeVisible();
  const suffix = randomUUID().slice(0,8);
  const companyName = `E2E demo company ${suffix}`;
  await form(page,"company").getByLabel("Company name", {exact:true}).fill(companyName);
  await save(page,"company","Add company");
  const company = (await overview()).companies.find(c=>c.name===companyName)!;
  expect(company.is_simulated).toBe(true);
  await form(page,"truck").locator('select[name="company_id"]').selectOption(company.id);
  const plate = `TEST-${suffix}`;
  await form(page,"truck").getByLabel("Plate number",{exact:true}).fill(plate);
  await form(page,"truck").getByLabel("Vehicle type",{exact:true}).fill("Test vehicle");
  await save(page,"truck","Add truck");
  expect((await overview()).trucks.find(t=>t.plate_number===plate)?.company_id).toBe(company.id);
  const created: (Account & {role:string})[] = [];
  for (const role of ["company_admin","driver","gate_operator"]) {
    await page.reload();
    await page.locator("details").filter({has:page.locator('input[name="account_email"]')}).locator("summary").click();
    const a = {email:`e2e-${role}-${suffix}@smartgate.test`, password:randomBytes(24).toString("base64url"),role};
    created.push(a);
    // Keep recoverable private test credentials, never traces or public fixtures.
    const file = ".local/admin-created-accounts.json";
    const previous = existsSync(file) ? JSON.parse(readFileSync(file,"utf8")) : [];
    writeFileSync(file,JSON.stringify([...previous,a],null,2));
    const target = form(page,"account");
    await target.getByLabel("Full name",{exact:true}).fill(`E2E ${role} ${suffix}`);
    await target.locator('input[name="account_email"]').fill(a.email);
    await target.locator('input[name="account_password"]').fill(a.password);
    await target.getByRole("combobox",{name:"Account role",exact:true}).selectOption(role);
    if(role!=="gate_operator") await target.locator('select[name="company_id"]').selectOption(company.id);
    await target.getByRole("combobox",{name:"Language",exact:true}).selectOption(role==="driver"?"hi":"en");
    await save(page,"account","Provision account");
    const user = await client(a);
    expect((await user.rpc("is_platform_administrator")).data).toBe(false);
    expect((await user.rpc("administration_overview")).error?.message).toContain("forbidden");
    const identity = await user.auth.getUser();
    const profile = await user.from("profiles").select("*").eq("user_id",identity.data.user!.id).single();
    expect(profile.data?.role).toBe(role);
    expect(profile.data?.company_id).toBe(role==="gate_operator"?null:company.id);
    if(role==="driver") expect(profile.data?.locale).toBe("hi");
    if(role==="company_admin") {
      expect((await user.from("trips").select("id")).data).toEqual([]);
      const trucks = await user.from("trucks").select("*");
      expect(trucks.data?.map(t=>t.plate_number)).toEqual([plate]);
    }
    await user.auth.signOut({scope:"local"});
  }
  const data = await overview();
  const operator = data.profiles.find(p=>p.email===created[2].email)!;
  const gate = data.gates.find(g=>g.code==="GATE-C")!;
  await form(page,"assign_gate").locator('select[name="profile_id"]').selectOption(operator.id);
  await form(page,"assign_gate").locator('select[name="gate_id"]').selectOption(gate.id);
  await save(page,"assign_gate","Assign gate");
  expect((await overview()).assignments).toContainEqual({profile_id:operator.id,gate_id:gate.id});
  const assigned = form(page,"unassign_gate").filter({has:page.locator(`input[value="${operator.id}"]`)});
  await assigned.getByRole("button",{name:"Unassign gate",exact:true}).click();
  await expect(assigned).toHaveCount(0);
  expect((await overview()).assignments.some(a=>a.profile_id===operator.id)).toBe(false);

  const coords = form(page,"gate_coordinates").filter({has:page.locator(`input[value="${gate.id}"]`)});
  await coords.locator("..").locator("summary").click();
  try {
    // Synthetic test coordinates, immediately restored; no real port location is inferred.
    await coords.getByLabel("Latitude",{exact:true}).fill("0");
    await coords.getByLabel("Longitude",{exact:true}).fill("0");
    await coords.getByRole("button",{name:"Save coordinates",exact:true}).click();
    await expect(coords.getByText("Action saved.",{exact:true})).toBeVisible();
    expect((await overview()).gates.find(g=>g.id===gate.id)?.latitude).toBe(0);
    await coords.getByLabel("Latitude",{exact:true}).fill("");
    await coords.getByLabel("Longitude",{exact:true}).fill("");
    await coords.getByRole("button",{name:"Save coordinates",exact:true}).click();
    await expect.poll(async()=>(await overview()).gates.find(g=>g.id===gate.id)?.latitude).toBeNull();
  } finally {
    expect((await db.rpc("administration_command", {p_command:"gate_coordinates",p_input:{gate_id:gate.id,latitude:gate.latitude,longitude:gate.longitude},p_key:randomUUID()})).error).toBeNull();
  }
  const normal = await client(demo("simulation"));
  expect((await normal.rpc("is_platform_administrator")).data).toBe(false);
  expect((await normal.rpc("administration_command",{p_command:"company",p_input:{name:"Forbidden"},p_key:randomUUID()})).error?.message).toContain("forbidden");
  await normal.auth.signOut({scope:"local"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await db.auth.signOut({scope:"local"});
});

test("real Postgres change reaches the browser and refreshes without fallback polling", async ({page}) => {
  // Disable only SmartGate's 20s fallback; WebSocket heartbeats and debounce remain real.
  await page.addInitScript(() => {
    const original = window.setInterval;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      original(timeout===20_000 ? ()=>{} : handler,timeout,...args)) as typeof window.setInterval;
  });
  await login(page,demo("company"));
  await page.goto("/en/gates");
  await expect(page.getByRole("status").filter({hasText:"Update channel connected"})).toBeVisible();
  const sim = await client(demo("simulation"));
  const result = await sim.from("gates").select("*").eq("code","GATE-C").single();
  expect(result.error).toBeNull();
  const gate=result.data!;
  const queued = gate.queue_length===83?84:83;
  const card=page.getByRole("article").filter({has:page.getByRole("heading",{name:"GATE-C",exact:true})});
  try {
    expect((await sim.rpc("update_demo_gate",{p_gate:gate.id,p_input:{status:gate.status,queue_length:queued,service_rate_per_hour:15}})).error).toBeNull();
    await expect(card.getByText(String(queued),{exact:true})).toBeVisible({timeout:15_000});
  } finally {
    expect((await sim.rpc("update_demo_gate",{p_gate:gate.id,p_input:{status:gate.status,queue_length:gate.queue_length??"",service_rate_per_hour:gate.service_rate_per_hour??""}})).error).toBeNull();
    await sim.auth.signOut({scope:"local"});
  }
});
