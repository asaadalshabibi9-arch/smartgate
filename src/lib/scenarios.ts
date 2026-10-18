import { t, type Locale } from "./i18n.ts";
// FR14: synthetic scenarios are examples, never a source of authorization.
export const scenarios = [
  {
    code: "SC01",
    key: "normal",
    group: "success",
    title: ["دخول سليم", "Successful entry"],
    description: [
      "رحلة مكتملة بعد التحقق وفتح الحاجز ثم عبور مستقل.",
      "A completed journey after verification, barrier opening and separate crossing confirmation.",
    ],
    steps: ["flow"],
  },
  {
    code: "SC02",
    key: "rerouted",
    group: "success",
    title: ["تغيير البوابة", "Gate reassignment"],
    description: [
      "قبول بوابة أقل انتظارًا مع حفظ الاقتراح والسبب وسجل التغيير.",
      "Accept a lower-wait gate with the proposal, reason and assignment change preserved.",
    ],
    steps: ["recommend", "flow"],
  },
  {
    code: "SC03",
    key: "plate",
    group: "exceptions",
    title: ["اختلاف اللوحة", "Plate mismatch"],
    description: [
      "QR والحاوية مطابقان، لكن اللوحة مختلفة؛ يظل الفتح محظورًا.",
      "QR and container match, but the plate differs; barrier opening remains blocked.",
    ],
    steps: ["mismatchPlate", "recoverIdentity"],
  },
  {
    code: "SC04",
    key: "qr",
    group: "exceptions",
    title: ["اختلاف QR", "QR mismatch"],
    description: [
      "قراءة QR لطلب آخر توقف التحقق حتى مع تطابق اللوحة.",
      "A QR reference from another journey blocks verification even when the plate matches.",
    ],
    steps: ["mismatchQr", "recoverIdentity"],
  },
  {
    code: "SC05",
    key: "container",
    group: "exceptions",
    title: ["اختلاف الحاوية", "Container mismatch"],
    description: [
      "رقم الحاوية غير مطابق؛ تسجل نتيجة مستقلة عن اللوحة وQR.",
      "A container mismatch is recorded independently from plate and QR checks.",
    ],
    steps: ["mismatchContainer", "recoverIdentity"],
  },
  {
    code: "SC06",
    key: "barrier",
    group: "exceptions",
    title: ["تعطل الحاجز", "Barrier failure"],
    description: [
      "التحقق ناجح، لكن نتيجة الفتح فاشلة؛ يسجل العطل ويصعّد للمشغل.",
      "Verification passes but opening fails; the failure is recorded and escalated to the operator.",
    ],
    steps: ["barrierFailure", "barrierRecover"],
  },
  {
    code: "SC07",
    key: "crossing",
    group: "exceptions",
    title: ["انتظار العبور", "Awaiting crossing"],
    description: [
      "الحاجز مفتوح، لكن الدخول غير مكتمل حتى تأكيد العبور.",
      "The barrier is open; entry remains incomplete until crossing is confirmed.",
    ],
    steps: ["awaitCrossing"],
  },
  {
    code: "SC08",
    key: "expired",
    group: "constraints",
    title: ["موعد منتهٍ", "Expired appointment"],
    description: [
      "نافذة الموعد انتهت؛ تمنع قواعد الموعد نجاح التحقق.",
      "The appointment window has expired, so verification cannot pass.",
    ],
    steps: ["expired"],
  },
  {
    code: "SC09",
    key: "early",
    group: "constraints",
    title: ["وصول مبكر", "Early arrival"],
    description: [
      "الوصول المتوقع يسبق الموعد؛ لا تعرض توصية مخالفة للنافذة.",
      "Estimated arrival precedes the appointment; no out-of-window recommendation is offered.",
    ],
    steps: ["early"],
  },
  {
    code: "SC10",
    key: "missing",
    group: "constraints",
    title: ["غياب بيانات الازدحام", "Unavailable queue data"],
    description: [
      "بيانات طابور البوابة ومعدل خدمتها مفقودة؛ لا تظهر كتقدير صفري.",
      "Queue and service-rate data are missing; they are never presented as a zero-wait estimate.",
    ],
    steps: ["missing"],
  },
  {
    code: "SC11",
    key: "notification",
    group: "exceptions",
    title: ["فشل إشعار بعد الدخول", "Notification failure after entry"],
    description: [
      "دخول بضائع عامة مكتمل مع فشل إشعار السائق، وبقاء تقرير الدخول صحيحًا.",
      "General-cargo entry is complete with a failed driver notification; the entry report remains valid.",
    ],
    steps: ["notification"],
  },
  {
    code: "SC12",
    key: "recovered",
    group: "success",
    title: ["تعافٍ من عطل متكرر", "Recovery from repeated failure"],
    description: [
      "فشلان للحاجز، ثم طلب جديد وفتح وعبور ناجح؛ كل المحاولات محفوظة.",
      "Two barrier failures followed by a new request, opening and confirmed crossing; every attempt is retained.",
    ],
    steps: ["barrierFailure", "barrierRecover"],
  },
  {
    code: "SC13",
    key: "isolation",
    group: "permissions",
    title: ["عزل شركة أخرى", "Another company’s workspace"],
    description: [
      "رحلة الشركة الثانية تظهر فقط لحساباتها والأدوار المخولة، وفق صلاحيات البوابة.",
      "A second-company journey is visible only to its accounts and authorized gate roles.",
    ],
    steps: ["isolation"],
  },
] as const;
export type Scenario = (typeof scenarios)[number];
export function scenarioByCode(code: string | undefined) {
  return scenarios.find((s) => s.code === code);
}
export function scenarioForCargo(cargo: string | null) {
  return scenarios.find((s) => cargo?.startsWith(`[${s.code}] `));
}
export function scenarioText(value: readonly [string, string], locale: Locale) {
  if (locale !== "ar" && locale !== "en") {
    const scenario = scenarios.find(
      (item) => item.title === value || item.description === value,
    );
    if (scenario)
      return t(
        locale,
        scenario.title === value
          ? `scenarioTitle_${scenario.code}`
          : `scenarioStep_${scenario.steps[0]}`,
      );
  }
  return value[locale === "ar" ? 0 : 1];
}
