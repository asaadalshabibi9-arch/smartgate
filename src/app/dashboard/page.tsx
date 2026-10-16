import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { logout } from "../auth/actions";

const statusLabels = {
  open: "مفتوحة",
  busy: "مزدحمة",
  closed: "مغلقة",
  out_of_service: "خارج الخدمة",
} as const;

export const instant = false;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const [{ data: profile }, { data: gates, error: gatesError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, role, companies(name)")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("gates")
        .select("id, code, name, status, queue_length, estimated_wait_minutes")
        .order("code"),
    ]);

  return (
    <main className="min-h-screen bg-[#eef4f6] text-[#112a46]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xl font-black">SmartGate</p>
            <p className="mt-1 text-sm text-slate-500">
              {profile?.companies?.name ?? "لوحة التشغيل"}
            </p>
          </div>
          <form action={logout}>
            <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <section className="rounded-3xl bg-[#12324b] p-8 text-white">
          <p className="text-sm font-bold text-[#7fe3df]">لوحة التشغيل</p>
          <h1 className="mt-2 text-3xl font-black">
            أهلًا {profile?.full_name ?? "بك"}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-200">
            الاتصال بقاعدة البيانات والجلسة الآمنة يعملان. تعرض هذه الصفحة حالة
            البوابات التجريبية مباشرة من Supabase.
          </p>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#087f8c]">البيانات الحية</p>
              <h2 className="mt-1 text-2xl font-black">حالة البوابات</h2>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
              بيانات محاكاة معلنة
            </span>
          </div>

          {gatesError ? (
            <p className="mt-6 rounded-2xl bg-red-50 p-5 text-red-700">
              تعذر تحميل حالة البوابات الآن.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {gates?.map((gate) => (
                <article
                  className="rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(17,42,70,0.08)]"
                  key={gate.id}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-black" dir="ltr">
                      {gate.code}
                    </p>
                    <span className="rounded-full bg-[#eefafa] px-3 py-1 text-xs font-bold text-[#087f8c]">
                      {statusLabels[gate.status]}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">{gate.name}</h3>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-slate-500">الطابور</dt>
                      <dd className="mt-1 text-lg font-black">
                        {gate.queue_length ?? "—"}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-slate-500">الانتظار</dt>
                      <dd className="mt-1 text-lg font-black">
                        {gate.estimated_wait_minutes == null
                          ? "—"
                          : `${gate.estimated_wait_minutes} د`}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
