// Synthetic showcase data only. Uses provisioned accounts and the same authorized RPCs as the app.
// Run: node --env-file=.env.local scripts/seed-showcase.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const accounts = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"));
const clients = new Map();
async function db(key) {
  if (clients.has(key)) return clients.get(key);
  const account = accounts.find((a) => a.account_key === key);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw new Error(`Could not authenticate ${key}`);
  clients.set(key, client);
  return client;
}
async function rpc(key, name, args) {
  const result = await (await db(key)).rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}
const company = await db("company");
if (existsSync(".local/showcase.json")) {
  const existing = JSON.parse(readFileSync(".local/showcase.json", "utf8"));
  const result = await company
    .from("trips")
    .select("id")
    .in(
      "id",
      existing.map((x) => x.id),
    );
  if (result.error) throw new Error(result.error.message);
  if (result.data.length) {
    console.log("Showcase already exists; preserving it.");
    process.exit(0);
  }
}
const gates = await company.from("gates").select("*").order("code");
const trucks = await company.from("trucks").select("*").order("plate_number");
if (gates.error || trucks.error)
  throw new Error("Unable to load demo resources");
const gate = gates.data.find((g) => g.code === "GATE-A");
const truck = trucks.data[0];
const created = [];
try {
  for (const [index, stage] of [
    "planned",
    "in_transit",
    "barrier_failed",
    "completed",
  ].entries()) {
    const driverKey = index === 0 ? "driver2" : "driver";
    const driver = accounts.find((a) => a.account_key === driverKey);
    const now = Date.now();
    const container = `DEMO-SHOW-${index + 1}`;
    const id = await rpc("company", "create_entry_trip", {
      p_key: randomUUID(),
      p_input: {
        driver_profile_id: driver.profile_id,
        truck_id: truck.id,
        gate_id: gate.id,
        operation_type: "container",
        container_number: container,
        cargo_type: "حمولة تجريبية للعرض",
        cargo_weight_kg: 12000 + index * 500,
        travel_minutes: 30,
        planned_departure_at: new Date(now).toISOString(),
        appointment_start_at: new Date(now - 1800000).toISOString(),
        appointment_end_at: new Date(now + 86400000).toISOString(),
      },
    });
    created.push({ id, stage });
    const command = (key, name, payload = {}) =>
      rpc(key, "apply_trip_command", {
        p_trip: id,
        p_command: name,
        p_payload: payload,
        p_key: randomUUID(),
      });
    if (stage === "planned") continue;
    await command(driverKey, "start");
    if (stage === "in_transit") continue;
    await command(driverKey, "arrive");
    await command("simulation", "verify", {
      qr: id,
      plate: truck.plate_number,
      container,
    });
    await command("operator", "request_open");
    if (stage === "barrier_failed") {
      await command("simulation", "barrier_failed");
      continue;
    }
    await command("simulation", "barrier_opened");
    await command("simulation", "crossing_confirmed");
  }
  writeFileSync(".local/showcase.json", JSON.stringify(created, null, 2));
  console.log(`Created ${created.length} synthetic showcase journeys.`);
} catch (error) {
  for (const item of created)
    await rpc("simulation", "reset_demo_trip", { p_trip: item.id });
  throw error;
} finally {
  for (const client of clients.values())
    await client.auth.signOut({ scope: "local" });
}
