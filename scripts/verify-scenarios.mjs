// Verify the seeded examples against saved events and delivery outcomes, never UI labels alone.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const accounts = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"));
const a = accounts.find((a) => a.account_key === "simulation");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const signed = await db.auth.signInWithPassword({
  email: a.email,
  password: a.password,
});
assert.equal(signed.error, null);
const manifest = JSON.parse(readFileSync(".local/scenarios.json", "utf8"));
const expected = {
  SC01: "completed",
  SC02: "completed",
  SC03: "verification_failed",
  SC04: "verification_failed",
  SC05: "verification_failed",
  SC06: "barrier_failed",
  SC07: "barrier_open",
  SC08: "verification_failed",
  SC09: "in_transit",
  SC10: "planned",
  SC11: "completed",
  SC12: "completed",
  SC13: "planned",
};
const results = [];
try {
  for (const item of manifest) {
    const trip = await db.from("trips").select("*").eq("id", item.id).single();
    assert.equal(trip.error, null);
    assert.equal(trip.data.status, expected[item.code], item.code);
    const events = await db
      .from("trip_events")
      .select("*")
      .eq("trip_id", item.id)
      .order("id");
    assert.equal(events.error, null);
    const crossed = events.data.filter(
      (e) => e.event_type === "crossing_confirmed",
    );
    if (trip.data.status === "completed") {
      assert.equal(crossed.length, 1);
      assert.equal(trip.data.crossed_at, trip.data.completed_at);
      assert.ok(trip.data.crossed_at);
    } else {
      assert.equal(crossed.length, 0);
      assert.equal(trip.data.completed_at, null);
      assert.equal(trip.data.crossed_at, null);
    }
    const failed = events.data.find(
      (e) => e.event_type === "verification_failed",
    );
    if (["SC03", "SC04", "SC05", "SC08"].includes(item.code)) {
      const checks = failed.payload.checks;
      assert.equal(
        checks[
          { SC03: "plate", SC04: "qr", SC05: "container", SC08: "appointment" }[
            item.code
          ]
        ],
        false,
      );
      if (item.code !== "SC04") assert.equal(checks.qr, true);
      if (item.code !== "SC03") assert.equal(checks.plate, true);
    }
    if (item.code === "SC02")
      assert.ok(
        events.data.some((e) => e.event_type === "recommendation_accepted"),
      );
    if (item.code === "SC06" || item.code === "SC12")
      assert.equal(
        events.data.filter((e) => e.event_type === "barrier_failed").length,
        item.code === "SC12" ? 2 : 1,
      );
    if (item.code === "SC10") {
      const gate = await db
        .from("gates")
        .select("*")
        .eq("id", trip.data.gate_id)
        .single();
      assert.equal(gate.data.queue_length, null);
      assert.equal(gate.data.service_rate_per_hour, null);
    }
    if (item.code === "SC11") {
      const notifications = await db
        .from("notifications")
        .select("*")
        .eq("trip_id", item.id)
        .eq("purpose", "entry_completed");
      assert.equal(notifications.error, null);
      assert.equal(notifications.data.length, 2);
      assert.equal(
        notifications.data.filter((n) => n.status === "failed").length,
        1,
      );
    }
    results.push({
      code: item.code,
      status: trip.data.status,
      events: events.data.length,
      passed: true,
    });
  }
  assert.equal(results.length, 13);
  writeFileSync(
    ".local/scenario-verification.json",
    JSON.stringify({ verifiedAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(
    `Verified ${results.length}/13 saved scenarios against database events and invariants.`,
  );
} finally {
  await db.auth.signOut({ scope: "local" });
}
