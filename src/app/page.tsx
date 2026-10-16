import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-[#eef4f6] px-5 py-12 text-[#112a46]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
        <section>
          <p className="text-sm font-black text-[#087f8c]">تشغيل أكثر انسيابية</p>
          <h1 className="mt-4 text-5xl font-black leading-tight sm:text-6xl">
            SmartGate
            <span className="mt-2 block text-3xl text-slate-700 sm:text-4xl">
              البوابة الذكية لدخول الشاحنات
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-9 text-slate-600">
            منصة لتنظيم الرحلات، عرض حالة البوابات، والتحقق من دخول الشاحنات
            إلى الميناء ضمن مسار واضح وآمن.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-[#087f8c] px-6 py-3 font-bold text-white hover:bg-[#066c77]"
              href="/login"
            >
              تسجيل الدخول
            </Link>
            <Link
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold hover:bg-slate-50"
              href="/api/health/supabase"
            >
              فحص الاتصال
            </Link>
          </div>
        </section>

        <section className="grid gap-4 rounded-[2rem] bg-[#12324b] p-6 text-white shadow-[0_24px_80px_rgba(17,42,70,0.2)] sm:p-8">
          {[
            ["01", "تسجيل الرحلة", "إدخال بيانات الشاحنة والموعد."],
            ["02", "اختيار البوابة", "توجيه الرحلة حسب الحالة والازدحام."],
            ["03", "تأكيد العبور", "إكمال الرحلة بعد تسجيل العبور الفعلي."],
          ].map(([number, title, description]) => (
            <article
              className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
              key={number}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#7fe3df] font-black text-[#12324b]">
                {number}
              </span>
              <div>
                <h2 className="font-black">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-200">
                  {description}
                </p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
