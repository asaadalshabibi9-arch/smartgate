// FR14: additive, synthetic examples created through the normal role-authorized RPCs.
// Never resets existing runs or embeds account credentials in source.
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { scenarios } from "../src/lib/scenarios.ts";
const accounts = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"));
const clients = new Map();
const manifest = [];
async function db(key) {
  if (clients.has(key)) return clients.get(key);
  const account = accounts.find((a) => a.account_key === key);
  if (!account) throw new Error(`Missing provisioned account: ${key}`);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (result.error) throw new Error(`Authentication failed for ${key}`);
  clients.set(key, client);
  return client;
}
async function rpc(key, name, args) {
  const result = await (await db(key)).rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}
const sim = await db("simulation");
const gates = await sim.from("gates").select("*").order("code");
if (gates.error) throw new Error("Unable to load gates");
const gateA = gates.data.find((g) => g.code === "GATE-A");
const gateB = gates.data.find((g) => g.code === "GATE-B");
const gateC = gates.data.find((g) => g.code === "GATE-C");
if (!gateA || !gateB || !gateC)
  throw new Error("Three demo gates are required");
try {
  for (const scenario of scenarios) {
    const companyKey = scenario.code === "SC13" ? "company2" : "company";
    const driverKey = scenario.code === "SC13" ? "driver3" : "driver";
    const company = await db(companyKey);
    const driver = accounts.find((a) => a.account_key === driverKey);
    const existing = await company
      .from("trips")
      .select("id,request_number,status")
      .like("cargo_type", `[${scenario.code}] %`)
      .order("created_at", { ascending: false })
      .limit(1);
    if (existing.error)
      throw new Error("Unable to inspect existing scenario runs");
    if (existing.data.length) {
      manifest.push({
        code: scenario.code,
        ...existing.data[0],
        preserved: true,
      });
      continue;
    }
    const trucks = await company
      .from("trucks")
      .select("*")
      .order("plate_number");
    if (trucks.error || !trucks.data.length)
      throw new Error("Provisioned company truck missing");
    const truck = trucks.data[0];
    const now = Date.now();
    let id;
    let changedC = false;
    const restoreTelemetry = [];
    try {
      if (scenario.code === "SC10") {
        await rpc("simulation", "update_demo_gate", {
          p_gate: gateC.id,
          p_input: {
            status: "open",
            queue_length: "",
            service_rate_per_hour: "",
          },
        });
        changedC = true;
      }
      const general = ["SC10", "SC11"].includes(scenario.code);
      const container = general ? "" : `DEMO-${scenario.code}`;
      id = await rpc(companyKey, "create_entry_trip", {
        p_key: randomUUID(),
        p_input: {
          driver_profile_id: driver.profile_id,
          truck_id: truck.id,
          gate_id: scenario.code === "SC10" ? gateC.id : gateA.id,
          operation_type: general ? "general_cargo" : "container",
          cargo_type: `[${scenario.code}] ${scenario.title[0]}`,
          cargo_weight_kg: 12500,
          container_number: container,
          travel_minutes: 30,
          planned_departure_at: new Date(now).toISOString(),
          appointment_start_at: new Date(
            now +
              (scenario.code === "SC08"
                ? -14400000
                : scenario.code === "SC09"
                  ? 7200000
                  : -1800000),
          ).toISOString(),
          appointment_end_at: new Date(
            now +
              (scenario.code === "SC08"
                ? -3600000
                : scenario.code === "SC09"
                  ? 14400000
                  : 86400000),
          ).toISOString(),
        },
      });
      const allocated = await company
        .from("trips")
        .select("gate_id")
        .eq("id", id)
        .single();
      if (allocated.error) throw new Error("Assigned gate missing");
      const assignedGate = gates.data.find(
        (g) => g.id === allocated.data.gate_id,
      );
      if (scenario.code === "SC10")
        await rpc("simulation", "update_demo_gate", {
          p_gate: assignedGate.id,
          p_input: {
            status: "open",
            queue_length: "",
            service_rate_per_hour: "",
          },
        });
      const command = (actor, name, payload = {}) =>
        rpc(actor, "apply_trip_command", {
          p_trip: id,
          p_command: name,
          p_payload: payload,
          p_key: randomUUID(),
        });
      if (!["SC10", "SC13"].includes(scenario.code)) {
        await command(driverKey, "start");
        if (scenario.code === "SC02") {
          const alternative = gates.data.find(
            (g) =>
              g.id !== assignedGate.id &&
              g.eligible_operations.includes("container") &&
              ["open", "busy"].includes(g.status),
          );
          if (
            !alternative ||
            assignedGate.latitude === null ||
            assignedGate.longitude === null
          )
            throw new Error(
              "Configure an eligible alternative and demo coordinates first",
            );
          for (const [gate, queue] of [
            [assignedGate, 1000],
            [alternative, 0],
          ]) {
            restoreTelemetry.push(gate);
            await rpc("simulation", "update_demo_gate", {
              p_gate: gate.id,
              p_input: {
                status: "open",
                queue_length: queue,
                service_rate_per_hour: 15,
              },
            });
          }
          const session = randomUUID();
          await rpc(driverKey, "track_trip_location", {
            p_trip: id,
            p_session: session,
            p_action: "start",
            p_input: { source: "simulation" },
          });
          await rpc(driverKey, "track_trip_location", {
            p_trip: id,
            p_session: session,
            p_action: "position",
            p_input: {
              latitude: assignedGate.latitude - 0.01,
              longitude: assignedGate.longitude - 0.01,
              accuracy_m: 5,
            },
          });
          await command(driverKey, "accept_recommendation", {
            gate_id: alternative.id,
          });
        }
        if (scenario.code !== "SC09") {
          await command(driverKey, "arrive");
          await command("simulation", "verify", {
            qr: scenario.code === "SC04" ? randomUUID() : id,
            plate: scenario.code === "SC03" ? "MISMATCH" : truck.plate_number,
            container: scenario.code === "SC05" ? "WRONG-CONTAINER" : container,
          });
          if (!["SC03", "SC04", "SC05", "SC08"].includes(scenario.code)) {
            await command(general ? "operator2" : "operator", "request_open");
            if (scenario.code === "SC06")
              await command("simulation", "barrier_failed");
            else {
              if (scenario.code === "SC12")
                for (let failure = 0; failure < 2; failure++) {
                  await command("simulation", "barrier_failed");
                  await command(
                    general ? "operator2" : "operator",
                    "request_open",
                  );
                }
              await command("simulation", "barrier_opened");
              if (scenario.code !== "SC07") {
                await command("simulation", "crossing_confirmed");
                if (scenario.code === "SC11")
                  await command("simulation", "notification_failed", {
                    recipient: driver.profile_id,
                  });
              }
            }
          }
        }
      }
      const saved = await company
        .from("trips")
        .select("id,request_number,status")
        .eq("id", id)
        .single();
      if (saved.error) throw new Error("Scenario save could not be confirmed");
      manifest.push({ code: scenario.code, ...saved.data, preserved: false });
      writeFileSync(".local/scenarios.json", JSON.stringify(manifest, null, 2));
      console.log(
        `${scenario.code}: ${saved.data.request_number} (${saved.data.status})`,
      );
    } catch (error) {
      if (id) await rpc("simulation", "reset_demo_trip", { p_trip: id });
      throw error;
    } finally {
      for (const gate of restoreTelemetry)
        await rpc("simulation", "update_demo_gate", {
          p_gate: gate.id,
          p_input: {
            status: gate.status,
            queue_length: gate.queue_length ?? "",
            service_rate_per_hour: gate.service_rate_per_hour ?? "",
          },
        });
      if (changedC)
        await rpc("simulation", "update_demo_gate", {
          p_gate: gateC.id,
          p_input: {
            status: gateC.status,
            queue_length: gateC.queue_length ?? "",
            service_rate_per_hour: gateC.service_rate_per_hour ?? "",
          },
        });
    }
  }
  writeFileSync(".local/scenarios.json", JSON.stringify(manifest, null, 2));
  console.log(
    `Scenario pack ready: ${manifest.length} cases. Existing journeys preserved.`,
  );
} finally {
  for (const client of clients.values())
    await client.auth.signOut({ scope: "local" });
}
