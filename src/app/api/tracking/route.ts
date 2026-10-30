import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
const envelope = z.object({
  trip_id: z.uuid(),
  session_id: z.uuid(),
  action: z.enum(["start", "position", "stop"]),
  source: z.enum(["gps", "simulation"]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy_m: z.number().min(0).max(100000).optional(),
});
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== request.headers.get("host"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const identity = await getIdentity();
  if (!identity?.profile)
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  try {
    const input = envelope.parse(await request.json());
    if (input.action === "start" && !input.source)
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    if (
      input.action === "position" &&
      (input.latitude === undefined ||
        input.longitude === undefined ||
        input.accuracy_m === undefined)
    )
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const { data, error } = await identity.db.rpc("track_trip_location", {
      p_trip: input.trip_id,
      p_session: input.session_id,
      p_action: input.action,
      p_input: {
        source: input.source,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy_m: input.accuracy_m,
      },
    });
    if (error) {
      const code =
        [
          "forbidden",
          "invalid_input",
          "invalid_transition",
          "tracking_inactive",
          "simulation_only",
        ].find((c) => error.message.includes(c)) ?? "actionError";
      return NextResponse.json(
        { error: code },
        { status: code === "forbidden" ? 403 : 400 },
      );
    }
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
}
