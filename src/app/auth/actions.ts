"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function readRequiredField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const email = readRequiredField(formData, "email");
  const password = readRequiredField(formData, "password");

  if (!email || !password) {
    loginError("أدخل البريد الإلكتروني وكلمة المرور.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginError("تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.");
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const fullName = readRequiredField(formData, "fullName");
  const companyName = readRequiredField(formData, "companyName");
  const email = readRequiredField(formData, "email");
  const password = readRequiredField(formData, "password");

  if (!fullName || !companyName || !email || !password) {
    loginError("أكمل جميع الحقول قبل إنشاء الحساب.");
  }

  if (password.length < 8) {
    loginError("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        company_name: companyName,
      },
    },
  });

  if (error) {
    loginError("تعذر إنشاء الحساب. قد يكون البريد مستخدمًا أو غير صالح.");
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    `/login?message=${encodeURIComponent("تم إنشاء الحساب. افتح رسالة التأكيد في بريدك، ثم سجّل الدخول.")}`,
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
