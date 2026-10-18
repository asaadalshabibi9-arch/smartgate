import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/lib/auth";
import {
  administratorAllowed,
  type AdministrationData,
} from "@/lib/administration";
import { localeOf, locales, languageNames, t, dateTime } from "@/lib/i18n";
import { administrationAction } from "@/app/administration-actions";
import { ActionForm } from "@/components/action-form";
import { Shell, PageHeading } from "@/components/workspace";

export default async function Administration({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  const { db, profile } = await requireIdentity(locale);
  if (!(await administratorAllowed(locale))) notFound();
  const response = await db.rpc("administration_overview");
  if (response.error || !response.data)
    throw new Error("Administration query failed");
  const data = response.data as unknown as AdministrationData;
  const companySelect = (
    <label>
      {t(locale, "company_admin")}
      <select name="company_id" defaultValue="">
        <option value="">{t(locale, "choose")}</option>
        {data.companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
  const form = (command: string, label: string, children: React.ReactNode) => (
    <ActionForm
      action={administrationAction}
      locale={locale}
      operationKey={randomUUID()}
      label={t(locale, label)}
    >
      <input type="hidden" name="admin_command" value={command} />
      {children}
    </ActionForm>
  );
  const companyName = (id: string | null) =>
    data.companies.find((c) => c.id === id)?.name ?? t(locale, "notApplicable");
  const configured = Boolean(process.env.SUPABASE_SECRET_KEY);
  return (
    <Shell locale={locale} profile={profile} section="administration">
      <PageHeading
        locale={locale}
        title={t(locale, "administration")}
        hint={t(locale, "administrationHint")}
      />
      <div className="split-panel">
        <section className="panel">
          <h2>{t(locale, "companies")}</h2>
          <ul className="audit-list">
            {data.companies.map((company) => (
              <li key={company.id}>{company.name}</li>
            ))}
          </ul>
          {form(
            "company",
            "createCompany",
            <label>
              {t(locale, "companyName")}
              <input name="companyName" required maxLength={160} />
            </label>,
          )}
        </section>
        <section className="panel">
          <h2>{t(locale, "trucks")}</h2>
          <ul className="audit-list">
            {data.trucks.map((truck) => (
              <li key={truck.id}>
                <bdi>{truck.plate_number}</bdi> ·{" "}
                {companyName(truck.company_id)}
              </li>
            ))}
          </ul>
          {form(
            "truck",
            "createTruck",
            <>
              {companySelect}
              <label>
                {t(locale, "plateNumber")}
                <input name="plate_number" required maxLength={40} />
              </label>
              <label>
                {t(locale, "vehicleType")}
                <input name="vehicle_type" maxLength={80} />
              </label>
            </>,
          )}
        </section>
      </div>
      <section className="panel">
        <h2>{t(locale, "accounts")}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {["fullName", "email", "accountRole", "company_admin"].map(
                  (key) => (
                    <th key={key}>{t(locale, key)}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.profiles.map((person) => (
                <tr key={person.id}>
                  <td>{person.full_name}</td>
                  <td>
                    <bdi>{person.email}</bdi>
                  </td>
                  <td>{t(locale, `role_${person.role}`)}</td>
                  <td>{companyName(person.company_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {configured ? (
          <details>
            <summary>{t(locale, "createAccount")}</summary>
            {form(
              "account",
              "createAccount",
              <>
                <label>
                  {t(locale, "fullName")}
                  <input
                    name="full_name"
                    required
                    maxLength={160}
                    autoComplete="off"
                  />
                </label>
                <label>
                  {t(locale, "email")}
                  <input
                    name="account_email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="off"
                    dir="ltr"
                  />
                </label>
                <label>
                  {t(locale, "password")}
                  <input
                    name="account_password"
                    type="password"
                    required
                    minLength={16}
                    maxLength={128}
                    autoComplete="new-password"
                    dir="ltr"
                  />
                </label>
                <p>{t(locale, "passwordHint")}</p>
                <label>
                  {t(locale, "accountRole")}
                  <select name="role" defaultValue="driver">
                    {[
                      "driver",
                      "company_admin",
                      "gate_operator",
                      "demo_admin",
                    ].map((role) => (
                      <option value={role} key={role}>
                        {t(locale, `role_${role}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {companySelect}
                <label>
                  {t(locale, "language")}
                  <select name="account_locale" defaultValue={locale}>
                    {locales.map((lang) => (
                      <option key={lang} value={lang}>
                        {languageNames[lang]}
                      </option>
                    ))}
                  </select>
                </label>
              </>,
            )}
          </details>
        ) : (
          <p className="notice">{t(locale, "adminNotConfigured")}</p>
        )}
      </section>
      <section className="panel">
        <h2>{t(locale, "assignments")}</h2>
        <ul className="audit-list">
          {data.assignments.map((assignment) => (
            <li key={`${assignment.profile_id}-${assignment.gate_id}`}>
              {
                data.profiles.find((p) => p.id === assignment.profile_id)
                  ?.full_name
              }{" "}
              ·{" "}
              <bdi>
                {data.gates.find((g) => g.id === assignment.gate_id)?.code}
              </bdi>
              {form(
                "unassign_gate",
                "unassignGate",
                <>
                  <input
                    type="hidden"
                    name="profile_id"
                    value={assignment.profile_id}
                  />
                  <input
                    type="hidden"
                    name="gate_id"
                    value={assignment.gate_id}
                  />
                </>,
              )}
            </li>
          ))}
        </ul>
        {form(
          "assign_gate",
          "assignGate",
          <>
            <label>
              {t(locale, "role_gate_operator")}
              <select name="profile_id" required defaultValue="">
                <option value="">{t(locale, "choose")}</option>
                {data.profiles
                  .filter((p) => p.role === "gate_operator")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t(locale, "gate")}
              <select name="gate_id" required defaultValue="">
                <option value="">{t(locale, "choose")}</option>
                {data.gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code}
                  </option>
                ))}
              </select>
            </label>
          </>,
        )}
      </section>
      <section className="panel">
        <h2>{t(locale, "gateCoordinates")}</h2>
        <p>{t(locale, "mapConfiguredHint")}</p>
        {data.gates.map((gate) => (
          <details key={gate.id}>
            <summary>{gate.code}</summary>
            {form(
              "gate_coordinates",
              "saveCoordinates",
              <>
                <input type="hidden" name="gate_id" value={gate.id} />
                <label>
                  {t(locale, "latitude")}
                  <input
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    name="latitude"
                    defaultValue={gate.latitude ?? ""}
                  />
                </label>
                <label>
                  {t(locale, "longitude")}
                  <input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    name="longitude"
                    defaultValue={gate.longitude ?? ""}
                  />
                </label>
                <p>{t(locale, "clearCoordinates")}</p>
              </>,
            )}
          </details>
        ))}
      </section>
      <section className="panel">
        <h2>{t(locale, "administrationAudit")}</h2>
        <ul className="audit-list">
          {data.audit.map((event, index) => (
            <li key={index}>
              {dateTime(locale, event.occurred_at)} ·{" "}
              {t(
                locale,
                (
                  {
                    company: "createCompany",
                    truck: "createTruck",
                    profile: "createAccount",
                    reserve_account: "createAccount",
                    gate_coordinates: "saveCoordinates",
                    assign_gate: "assignGate",
                    unassign_gate: "unassignGate",
                  } as Record<string, string>
                )[event.command] ?? "actions",
              )}
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
