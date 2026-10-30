import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireIdentity } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";
import type { Tables } from "@/types/database";
export type Delivery = {
  id: number;
  recipient_profile_id: string;
  recipient_role: string;
  purpose: string;
  status: string;
  delivered_at: string | null;
  created_at: string;
};
export type EntryReport = {
  trip: Tables<"trips">;
  driver_name: string;
  plate_number: string;
  company_name: string;
  notifications: Delivery[];
};
export async function loadTrip(locale: Locale, id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, profile } = await requireIdentity(locale);
  const { data: trip, error } = await db
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Trip lookup failed");
  if (!trip) notFound();
  const [events, gates, report, location] = await Promise.all([
    db
      .from("trip_events")
      .select("*")
      .eq("trip_id", id)
      .order("occurred_at")
      .order("id"),
    db.from("gates").select("*").order("display_order").order("code"),
    db.rpc("entry_report", { p_trip: id }),
    db.from("trip_locations").select("*").eq("trip_id", id).maybeSingle(),
  ]);
  if (
    events.error ||
    gates.error ||
    report.error ||
    location.error ||
    !report.data
  )
    throw new Error("Journey detail unavailable");
  return {
    profile,
    trip,
    events: events.data,
    gates: gates.data,
    location: location.data,
    report: report.data as unknown as EntryReport,
  };
}
