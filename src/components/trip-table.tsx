"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Truck } from "lucide-react";
import { dateTime, t, type Locale } from "@/lib/i18n";
import type { Tables } from "@/types/database";
import { scenarioForCargo, scenarioText } from "@/lib/scenarios";

export function TripTable({
  locale,
  trips,
  reports = false,
}: {
  locale: Locale;
  trips: Tables<"trips">[];
  reports?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [operation, setOperation] = useState("");
  const [page, setPage] = useState(1);
  const search = query.trim().toLocaleLowerCase();
  const filtered = trips.filter(
    (trip) =>
      (!status || trip.status === status) &&
      (!operation || trip.operation_type === operation) &&
      (!search ||
        [
          trip.request_number,
          trip.cargo_type,
          trip.container_number,
          scenarioForCargo(trip.cargo_type)
            ? scenarioText(scenarioForCargo(trip.cargo_type)!.title, locale)
            : "",
        ].some((value) => value?.toLocaleLowerCase().includes(search))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const href = (trip: Tables<"trips">) =>
    `/${locale}/trips/${trip.id}${reports ? "/report" : ""}`;
  return (
    <>
      <div className="trip-filters">
        <label>
          {t(locale, "searchTrips")}
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t(locale, "searchHint")}
          />
        </label>
        {!reports ? (
          <label>
            {t(locale, "filterStatus")}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t(locale, "allStatuses")}</option>
              {[
                "planned",
                "in_transit",
                "at_gate",
                "verification_failed",
                "verified",
                "barrier_failed",
                "barrier_open",
                "completed",
              ].map((s) => (
                <option key={s} value={s}>
                  {t(locale, s)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          {t(locale, "operation")}
          <select
            value={operation}
            onChange={(e) => {
              setOperation(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t(locale, "allOperations")}</option>
            {["container", "general_cargo"].map((s) => (
              <option key={s} value={s}>
                {t(locale, s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="results-count" role="status">
        {t(locale, "results")}: {filtered.length.toLocaleString(locale)} /{" "}
        {trips.length.toLocaleString(locale)}
      </p>
      {!filtered.length ? (
        <div className="empty">
          <Truck size={30} aria-hidden />
          <h3>{t(locale, trips.length ? "noResults" : "noTrips")}</h3>
          <p>{t(locale, trips.length ? "changeFilters" : "noTripsHint")}</p>
        </div>
      ) : (
        <div
          className="table-scroll"
          role="region"
          aria-label={t(locale, "allTrips")}
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {[
                  "request",
                  "operation",
                  "appointment",
                  "status",
                  reports ? "report" : "view",
                ].map((key) => (
                  <th scope="col" key={key}>
                    {t(locale, key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 10, current * 10).map((trip) => {
                const scenario = scenarioForCargo(trip.cargo_type);
                return (
                  <tr key={trip.id}>
                    <td>
                      <Link className="request-link" href={href(trip)}>
                        <bdi>{trip.request_number}</bdi>
                      </Link>
                      {scenario ? (
                        <small className="table-scenario">
                          {scenarioText(scenario.title, locale)}
                        </small>
                      ) : null}
                    </td>
                    <td>{t(locale, trip.operation_type)}</td>
                    <td className="date-cell">
                      {dateTime(locale, trip.appointment_start_at)}
                    </td>
                    <td>
                      <span className={`badge badge-${trip.status}`}>
                        {t(locale, trip.status)}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="table-link"
                        href={href(trip)}
                        aria-label={`${t(locale, reports ? "report" : "view")} ${trip.request_number}`}
                      >
                        <ArrowUpRight size={19} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav className="pagination" aria-label={t(locale, "pagination")}>
          <button
            className="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            {t(locale, "previous")}
          </button>
          <span>
            {current.toLocaleString(locale)} / {pages.toLocaleString(locale)}
          </span>
          <button
            className="button"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            {t(locale, "next")}
          </button>
        </nav>
      ) : null}
    </>
  );
}
