import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Showcase } from "@/components/showcase/showcase";
import "@/components/showcase/showcase.css";
export const metadata: Metadata = {
  title: "SmartGate | من التخطيط إلى العبور",
  description:
    "اكتشف SmartGate في رحلة تفاعلية ثلاثية الأبعاد؛ من شركة النقل ورحلة السائق إلى التحقق والعبور والتوثيق. نموذج ببيانات تجريبية معلنة.",
};
export default async function ShowcasePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if ((await params).locale !== "ar") redirect("/ar/showcase");
  return <Showcase />;
}
