import { NextResponse } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET() {
  try {
    const { url, publishableKey } = getSupabaseConfig();
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { service: "supabase", connected: false },
        { status: 503 },
      );
    }

    return NextResponse.json({ service: "supabase", connected: true });
  } catch {
    return NextResponse.json(
      { service: "supabase", connected: false },
      { status: 503 },
    );
  }
}
