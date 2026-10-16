export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6 text-[#142D4E]">
      <div className="w-full max-w-xl rounded-3xl bg-white p-10 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-[#087F8C]">نسخة قيد التطوير</p>
        <h1 className="text-4xl font-bold" dir="ltr">SmartGate</h1>
        <p className="mt-6 text-xl leading-9">البوابة الذكية لتنظيم دخول الشاحنات إلى الميناء.</p>
        <p className="mt-4 leading-8 text-slate-600">
          هذه صفحة البداية للمشروع. وظائف الرحلات والتحقق وتأكيد العبور لم تُنفّذ بعد.
          النموذج المستهدف يستخدم بيانات محاكاة معلنة.
        </p>
      </div>
    </main>
  );
}
