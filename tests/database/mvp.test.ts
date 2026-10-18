import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, test } from "vitest";

const db = new PGlite();
const ids = Object.fromEntries(
  [
    "company",
    "other",
    "admin",
    "driver",
    "driver2",
    "operator",
    "operator2",
    "sim",
    "truck",
    "truck2",
    "a",
    "b",
    "c",
  ].map((k) => [k, randomUUID()]),
);
const users = Object.fromEntries(
  ["admin", "driver", "driver2", "operator", "operator2", "sim"].map((k) => [
    k,
    randomUUID(),
  ]),
);
let trip: string;
const rows = async (sql: string, args: unknown[] = []) =>
  (await db.query<Record<string, unknown>>(sql, args)).rows;
async function as(role: string, sql: string, args: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    users[role] ?? "",
  ]);
  try {
    return await rows(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
function input(extra: Record<string, unknown> = {}) {
  return {
    driver_profile_id: ids.driver,
    truck_id: ids.truck,
    gate_id: ids.a,
    operation_type: "container",
    cargo_type: "Demo",
    cargo_weight_kg: 1500,
    container_number: "TEST-1",
    planned_departure_at: new Date().toISOString(),
    appointment_start_at: new Date(Date.now() - 3600000).toISOString(),
    appointment_end_at: new Date(Date.now() + 3600000).toISOString(),
    travel_minutes: 5,
    ...extra,
  };
}
async function create(extra: Record<string, unknown> = {}, key = randomUUID()) {
  return (
    await as("admin", "select public.create_entry_trip($1,$2) id", [
      input(extra),
      key,
    ])
  )[0].id as string;
}
async function command(
  role: string,
  cmd: string,
  payload: Record<string, unknown> = {},
  key = randomUUID(),
  id = trip,
) {
  return as(role, "select public.apply_trip_command($1,$2,$3,$4)", [
    id,
    cmd,
    payload,
    key,
  ]);
}
beforeAll(async () => {
  // PGlite runs PostgreSQL with the same roles/RLS/functions; Auth JWT context is injected only in this harness.
  await db.exec(
    `create role anon; create role authenticated; create role supabase_auth_admin; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create function public.rls_auto_enable() returns void language sql as $$select$$;`,
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    await db.exec(
      readFileSync(`supabase/migrations/${f}`, "utf8").replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  }
  await db.query(
    "insert into public.companies(id,name,is_simulated) values($1,$2,true),($3,$4,true)",
    [ids.company, "Demo A", ids.other, "Demo B"],
  );
  for (const [k, uid] of Object.entries(users)) {
    const role =
      k === "admin"
        ? "company_admin"
        : k.startsWith("driver")
          ? "driver"
          : k.startsWith("operator")
            ? "gate_operator"
            : "demo_admin";
    const company =
      k === "driver2"
        ? ids.other
        : role === "company_admin" || role === "driver"
          ? ids.company
          : null;
    await db.query("insert into auth.users(id) values($1)", [uid]);
    await db.query(
      "insert into public.profiles(id,user_id,company_id,full_name,role,is_simulated) values($1,$2,$3,$4,$5,true)",
      [ids[k], uid, company, k, role],
    );
  }
  await db.query(
    "insert into public.trucks(id,company_id,plate_number,is_simulated) values($1,$2,'4821',true),($3,$4,'7194',true)",
    [ids.truck, ids.company, ids.truck2, ids.other],
  );
  for (const [key, queue] of [
    ["a", 8],
    ["b", 2],
    ["c", 1],
  ] as const)
    await db.query(
      "insert into public.gates(id,code,name,eligible_operations,queue_length,service_rate_per_hour,is_simulated) values($1,$2,$2,array['container','general_cargo'],$3,15,true)",
      [ids[key], key, queue],
    );
  await db.query(
    "insert into public.operator_gates(profile_id,gate_id) values($1,$2),($1,$3),($4,$5)",
    [ids.operator, ids.a, ids.b, ids.operator2, ids.c],
  );
}, 60000);
afterAll(async () => {
  await db.close();
});

test("FR01 saves a valid trip and rejects invalid input and foreign membership", async () => {
  trip = await create();
  expect(
    (
      await rows("select status,request_number from public.trips where id=$1", [
        trip,
      ])
    )[0],
  ).toMatchObject({ status: "planned" });
  for (const bad of [
    { cargo_weight_kg: -1 },
    { appointment_end_at: new Date(0).toISOString() },
    { container_number: "" },
    { driver_profile_id: ids.driver2 },
    { truck_id: ids.truck2 },
  ])
    await expect(create(bad)).rejects.toThrow();
});
test("AT10 RLS denies another driver, company and unassigned gate operator", async () => {
  expect(
    await as("driver2", "select * from public.trips where id=$1", [trip]),
  ).toHaveLength(0);
  expect(
    await as("operator2", "select * from public.trips where id=$1", [trip]),
  ).toHaveLength(0);
  await expect(command("driver", "crossing_confirmed")).rejects.toThrow(
    "forbidden",
  );
  await expect(
    as("driver2", "select public.entry_report($1)", [trip]),
  ).rejects.toThrow("forbidden");
});

test("FR05 preserves the proposal and reason before driver acceptance", async () => {
  const events = await rows(
    "select payload,occurred_at from public.trip_events where trip_id=$1 and event_type='recommendation_generated'",
    [trip],
  );
  expect(events).toHaveLength(1);
  expect(events[0].payload).toMatchObject({
    details: { reason: "lower_estimated_wait", wait_before: 32, wait_after: 4 },
  });
  expect(events[0].occurred_at).toBeTruthy();
});

test("database constraints reject nonfinite weights and excessive telemetry", async () => {
  await expect(create({ cargo_weight_kg: "NaN" })).rejects.toThrow();
  await expect(
    as("sim", "select public.update_demo_gate($1,$2)", [
      ids.a,
      { status: "open", queue_length: 10001, service_rate_per_hour: 15 },
    ]),
  ).rejects.toThrow();
});
test("protected status and crossing fields cannot be written directly", async () => {
  await expect(
    as(
      "admin",
      "update public.trips set status='completed',crossed_at=now(),completed_at=now() where id=$1",
      [trip],
    ),
  ).rejects.toThrow("permission denied");
  await expect(
    as(
      "sim",
      "insert into public.trip_events(trip_id,event_type) values($1,'crossing_confirmed')",
      [trip],
    ),
  ).rejects.toThrow("permission denied");
});
test("AT08 creation is idempotent", async () => {
  const key = randomUUID();
  expect(await create({}, key)).toBe(await create({}, key));
});
test("A02 refuses crossing before verification and barrier opening", async () => {
  await expect(command("sim", "crossing_confirmed")).rejects.toThrow(
    "invalid_transition",
  );
});
test("AT05-AT07 recommendation rejects wrong gate, closed gate and outside-window arrival", async () => {
  await command("driver", "start");
  await db.query("update public.gates set status='closed' where id=$1", [
    ids.c,
  ]);
  await expect(
    command("driver", "accept_recommendation", { gate_id: ids.c }),
  ).rejects.toThrow("recommendation_changed");
  await command("driver", "accept_recommendation", { gate_id: ids.b });
  expect(
    (await rows("select gate_id from public.trips where id=$1", [trip]))[0]
      .gate_id,
  ).toBe(ids.b);
  const outside = await create({
    appointment_start_at: new Date(Date.now() + 7200000).toISOString(),
    appointment_end_at: new Date(Date.now() + 10800000).toISOString(),
  });
  await command("driver", "start", {}, randomUUID(), outside);
  await expect(
    command(
      "driver",
      "accept_recommendation",
      { gate_id: ids.b },
      randomUUID(),
      outside,
    ),
  ).rejects.toThrow("outside_appointment");
});
test("AT04 wrong QR/plate is audited independently and cannot open", async () => {
  await command("driver", "arrive");
  await command("sim", "verify", {
    qr: trip,
    plate: "wrong",
    container: "TEST-1",
  });
  await expect(command("operator", "request_open")).rejects.toThrow(
    "invalid_transition",
  );
  const event = (
    await rows(
      "select payload from public.trip_events where trip_id=$1 and event_type='verification_failed'",
      [trip],
    )
  )[0].payload as { checks: { qr: boolean; plate: boolean } };
  expect(event.checks).toMatchObject({ qr: true, plate: false });
});
test("AT03 repeated barrier failures remain incomplete and each escalation is recorded", async () => {
  await command("sim", "verify", {
    qr: trip,
    plate: "4821",
    container: "TEST-1",
  });
  for (let i = 0; i < 2; i++) {
    await command("operator", "request_open");
    await command("sim", "barrier_failed");
  }
  expect(
    (
      await rows("select status,crossed_at from public.trips where id=$1", [
        trip,
      ])
    )[0],
  ).toEqual({ status: "barrier_failed", crossed_at: null });
  expect(
    await rows(
      "select * from public.trip_events where trip_id=$1 and reason='barrier_failure_escalated'",
      [trip],
    ),
  ).toHaveLength(2);
  await expect(command("sim", "crossing_confirmed")).rejects.toThrow(
    "invalid_transition",
  );
});
test("AT02 opening alone does not complete entry", async () => {
  await command("operator", "request_open");
  await command("sim", "barrier_opened");
  expect(
    (
      await rows(
        "select status,crossed_at,completed_at from public.trips where id=$1",
        [trip],
      )
    )[0],
  ).toEqual({ status: "barrier_open", crossed_at: null, completed_at: null });
});
test("AT01, AT08, AT11 crossing creates one entry and two notices, including retries", async () => {
  const key = randomUUID();
  await command("sim", "crossing_confirmed", {}, key);
  await command("sim", "crossing_confirmed", {}, key);
  await command("sim", "crossing_confirmed");
  expect(
    await rows(
      "select * from public.trip_events where trip_id=$1 and event_type='crossing_confirmed'",
      [trip],
    ),
  ).toHaveLength(1);
  const report = (
    await as("admin", "select public.entry_report($1) report", [trip])
  )[0].report as {
    trip: { status: string; crossed_at: string; completed_at: string };
    notifications: unknown[];
  };
  expect(report.trip.status).toBe("completed");
  expect(report.trip.crossed_at).toBe(report.trip.completed_at);
  expect(report.notifications).toHaveLength(2);
});
test("AT09 failed notification never reverses confirmed entry", async () => {
  await command("sim", "notification_failed", { recipient: ids.driver });
  expect(
    (await rows("select status from public.trips where id=$1", [trip]))[0]
      .status,
  ).toBe("completed");
  expect(
    (
      await as(
        "driver",
        "select status from public.notifications where trip_id=$1 and purpose='entry_completed'",
        [trip],
      )
    )[0].status,
  ).toBe("failed");
});
test("AT12 missing telemetry remains null and cannot drive a recommendation; changes audited", async () => {
  await as("sim", "select public.update_demo_gate($1,$2)", [
    ids.a,
    { status: "open", queue_length: "", service_rate_per_hour: "" },
  ]);
  expect(
    (
      await rows(
        "select queue_length,estimated_wait_minutes from public.gates where id=$1",
        [ids.a],
      )
    )[0],
  ).toEqual({ queue_length: null, estimated_wait_minutes: null });
  expect(
    await as("sim", "select * from public.gate_events where gate_id=$1", [
      ids.a,
    ]),
  ).toHaveLength(1);
  const id = await create();
  await command("driver", "start", {}, randomUUID(), id);
  await expect(
    command(
      "driver",
      "accept_recommendation",
      { gate_id: ids.b },
      randomUUID(),
      id,
    ),
  ).rejects.toThrow("missing_telemetry");
});
test("FR14 reset is privileged and preserves its audit snapshot", async () => {
  await expect(
    as("driver", "select public.reset_demo_trip($1)", [trip]),
  ).rejects.toThrow("forbidden");
  await as("sim", "select public.reset_demo_trip($1)", [trip]);
  expect(
    await rows("select * from public.trips where id=$1", [trip]),
  ).toHaveLength(0);
  expect(await rows("select * from private.demo_reset_audit")).toHaveLength(1);
});

test("A10 provisioning guard blocks Auth-service account creation and profile escalation", async () => {
  await db.exec(
    "grant usage on schema auth to supabase_auth_admin; grant insert,update on auth.users to supabase_auth_admin; set role supabase_auth_admin;",
  );
  try {
    await expect(
      db.query("insert into auth.users(id) values($1)", [randomUUID()]),
    ).rejects.toThrow("public_signup_disabled");
  } finally {
    await db.exec("reset role");
  }
  await expect(
    as("driver", "update public.profiles set role='demo_admin' where id=$1", [
      ids.driver,
    ]),
  ).rejects.toThrow("permission denied");
});

test("A14 administration capability is explicit, audited and idempotent", async () => {
  for (const role of ["sim", "admin", "driver", "operator"]) {
    expect(
      (await as(role, "select public.is_platform_administrator() allowed"))[0]
        .allowed,
    ).toBe(false);
    await expect(
      as(role, "select public.administration_overview()"),
    ).rejects.toThrow("forbidden");
    await expect(
      as(role, "select public.administration_command('company',$1,$2)", [
        { name: "Unauthorized" },
        randomUUID(),
      ]),
    ).rejects.toThrow("forbidden");
    await expect(
      as(
        role,
        "insert into private.platform_administrators(user_id) values($1)",
        [users[role]],
      ),
    ).rejects.toThrow("permission denied");
  }
  await db.query(
    "insert into private.platform_administrators(user_id) values($1)",
    [users.sim],
  );
  expect(
    (await as("sim", "select public.is_platform_administrator() allowed"))[0]
      .allowed,
  ).toBe(true);
  const key = randomUUID();
  const result = await as(
    "sim",
    "select public.administration_command('company',$1,$2) result",
    [{ name: "Managed company" }, key],
  );
  expect(
    await as(
      "sim",
      "select public.administration_command('company',$1,$2) result",
      [{ name: "Managed company" }, key],
    ),
  ).toEqual(result);
  await expect(
    as("sim", "select public.administration_command('company',$1,$2)", [
      { name: "Changed input" },
      key,
    ]),
  ).rejects.toThrow("idempotency_conflict");
  expect(
    await rows(
      "select * from private.administration_audit where operation_key=$1",
      [key],
    ),
  ).toHaveLength(1);
  await expect(
    as("sim", "select public.administration_command('assign_gate',$1,$2)", [
      { profile_id: ids.driver, gate_id: ids.a },
      randomUUID(),
    ]),
  ).rejects.toThrow("invalid_input");
  const view = (
    await as("sim", "select public.administration_overview() data")
  )[0].data as { companies: unknown[] };
  expect(view.companies).toHaveLength(3);
  const reservationInput = {
    email: "retry@example.test",
    full_name: "Retry driver",
    role: "driver",
    company_id: ids.company,
    locale: "hi",
  };
  const reservation = await as(
    "sim",
    "select public.administration_command('reserve_account',$1,$2) result",
    [reservationInput, randomUUID()],
  );
  expect(
    await as(
      "sim",
      "select public.administration_command('reserve_account',$1,$2) result",
      [reservationInput, randomUUID()],
    ),
  ).toEqual(reservation);
  await expect(
    as("sim", "select public.administration_command('reserve_account',$1,$2)", [
      { ...reservationInput, role: "demo_admin" },
      randomUUID(),
    ]),
  ).rejects.toThrow("invalid_input");
  await expect(
    as("sim", "select public.administration_command('reserve_account',$1,$2)", [
      { ...reservationInput, password: "never-record-this" },
      randomUUID(),
    ]),
  ).rejects.toThrow("invalid_input");
});

test("A14 trusted managed provisioning is allowed without reopening public signup", async () => {
  const email = "managed-driver@example.test";
  const reserved = await as("sim", "select public.administration_command('reserve_account',$1,$2) result", [{email,full_name:"Managed driver",role:"driver",company_id:ids.company,locale:"hi"},randomUUID()]);
  const uid = (reserved[0].result as {id:string}).id,
    key = uid;
  await expect(as("driver","select private.is_reserved_auth_identity($1,$2)",[uid,email])).rejects.toThrow("permission denied");
  await db.exec("set role supabase_auth_admin");
  try {
    await expect(
      db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [
        uid,
        { smartgate_managed: true, provisioning_key: key },
      ]),
    ).rejects.toThrow("public_signup_disabled");
    await expect(
      db.query("insert into auth.users(id,raw_app_meta_data) values($1,$2)", [
        uid,
        { smartgate_managed: true, provisioning_key: randomUUID() },
      ]),
    ).rejects.toThrow("public_signup_disabled");
    await expect(db.query("insert into auth.users(id,email) values($1,$2)",[uid,"wrong@example.test"])).rejects.toThrow("public_signup_disabled");
    await expect(db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)",[randomUUID(),email,{smartgate_managed:true,provisioning_key:key}])).rejects.toThrow("public_signup_disabled");
    // Actual GoTrue order: insert first, then update app_metadata in the transaction.
    await db.query("insert into auth.users(id,email) values($1,$2)",[uid,email]);
  } finally {
    await db.exec("reset role");
  }
  const payload = {
    user_id: uid,
    full_name: "Managed driver",
    role: "driver",
    company_id: ids.company,
    locale: "hi",
  };
  await expect(as("sim", "select public.administration_command('profile',$1,$2)", [payload,key])).rejects.toThrow("invalid_input");
  await db.query("update auth.users set raw_app_meta_data=$1 where id=$2",[{smartgate_managed:true,provisioning_key:key},uid]);
  await as("sim", "select public.administration_command('profile',$1,$2)", [
    payload,
    key,
  ]);
  expect(
    await rows(
      "select role,locale,company_id from public.profiles where user_id=$1",
      [uid],
    ),
  ).toEqual([{ role: "driver", locale: "hi", company_id: ids.company }]);
  await expect(
    as("driver", "select public.administration_command('profile',$1,$2)", [
      payload,
      randomUUID(),
    ]),
  ).rejects.toThrow("forbidden");
});

test("A16 configured map coordinates are paired, bounded, privileged and audited", async () => {
  const run = (role: string, latitude: unknown, longitude: unknown) =>
    as(role, "select public.administration_command('gate_coordinates',$1,$2)", [
      { gate_id: ids.c, latitude, longitude },
      randomUUID(),
    ]);
  await expect(run("driver", 23.6, 58.4)).rejects.toThrow("forbidden");
  await expect(run("sim", 91, 58.4)).rejects.toThrow("gate_coordinate_pair");
  await expect(run("sim", 23.6, null)).rejects.toThrow("gate_coordinate_pair");
  await run("sim", 0, 0);
  expect(
    await as(
      "driver",
      "select latitude,longitude from public.gates where id=$1",
      [ids.c],
    ),
  ).toEqual([{ latitude: 0, longitude: 0 }]);
  await run("sim", null, null);
  expect(
    await rows("select latitude,longitude from public.gates where id=$1", [
      ids.c,
    ]),
  ).toEqual([{ latitude: null, longitude: null }]);
  expect(
    (
      await rows(
        "select count(*)::int n from private.administration_audit where command='gate_coordinates'",
      )
    )[0].n,
  ).toBe(2);
});
