import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { login, signup } from "../auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export const instant = false;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  const { error, message } = await searchParams;

  return (
    <main className="min-h-screen bg-[#eef4f6] px-5 py-10 text-[#112a46] sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_80px_rgba(17,42,70,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between bg-[#12324b] p-8 text-white sm:p-12">
          <div>
            <Link className="text-2xl font-black tracking-tight" href="/">
              SmartGate
            </Link>
            <p className="mt-4 max-w-sm leading-8 text-slate-200">
              منصة موحدة لتنظيم وصول الشاحنات، متابعة الرحلات، والتحقق عند
              البوابات.
            </p>
          </div>
          <div className="mt-16 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm leading-7 text-slate-100">
            الحساب الجديد ينشئ شركة مستقلة تلقائيًا ويحمي بياناتها بسياسات
            قاعدة البيانات.
          </div>
        </section>

        <section className="p-8 sm:p-12">
          <p className="text-sm font-bold text-[#087f8c]">الدخول إلى المنصة</p>
          <h1 className="mt-2 text-3xl font-black">مرحبًا بك في SmartGate</h1>
          <p className="mt-3 text-slate-600">
            سجّل الدخول، أو املأ الاسم واسم الشركة ثم أنشئ حسابًا جديدًا.
          </p>

          {error ? (
            <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {message}
            </p>
          ) : null}

          <form className="mt-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold">
                الاسم الكامل
                <input
                  className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-4 focus:ring-[#087f8c]/10"
                  name="fullName"
                  placeholder="مثال: أسعد الشبيبي"
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                اسم الشركة
                <input
                  className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-4 focus:ring-[#087f8c]/10"
                  name="companyName"
                  placeholder="مثال: شركة النقل"
                  type="text"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-bold">
              البريد الإلكتروني
              <input
                autoComplete="email"
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-4 focus:ring-[#087f8c]/10"
                dir="ltr"
                name="email"
                required
                type="email"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              كلمة المرور
              <input
                autoComplete="current-password"
                className="rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-4 focus:ring-[#087f8c]/10"
                dir="ltr"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <button
                className="rounded-xl bg-[#087f8c] px-5 py-3 font-bold text-white transition hover:bg-[#066c77]"
                formAction={login}
              >
                تسجيل الدخول
              </button>
              <button
                className="rounded-xl border border-[#087f8c] px-5 py-3 font-bold text-[#087f8c] transition hover:bg-[#eefafa]"
                formAction={signup}
              >
                إنشاء حساب جديد
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
