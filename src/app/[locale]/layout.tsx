import { notFound } from "next/navigation";
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!["ar", "en"].includes(locale)) notFound();
  return children;
}
