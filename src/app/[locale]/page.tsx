import { redirect } from "next/navigation";
import { requireIdentity, rolePath } from "@/lib/auth";
import { localeOf } from "@/lib/i18n";
export default async function Landing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = localeOf(raw);
  const { profile } = await requireIdentity(locale);
  redirect(`/${locale}/${rolePath[profile.role]}`);
}
