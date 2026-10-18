export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export function localeOf(value: string): Locale {
  return value === "en" ? "en" : "ar";
}
export const copy = {
  scenarios: ["سيناريوهات العرض", "Demo scenarios"],
  scenariosHint: [
    "حالات جاهزة للتجربة مع النتيجة المتوقعة وخطوات كل دور. كل الأحداث محاكاة معلنة.",
    "Ready-to-explore cases with expected outcomes and role instructions. All events are explicitly simulated.",
  ],
  scenarioAccounts: ["كل دور يعمل من حسابه", "Each role uses its own account"],
  scenarioAccountsHint: [
    "الشركة تنشئ، والسائق يبدأ ويسجل الوصول، والمشغل يطلب الفتح، ومسؤول المحاكاة يسجل القراءات والنتيجة والعبور. استخدم نوافذ متصفح مستقلة للحسابات المجهزة.",
    "The company creates, the driver starts and reports arrival, the operator requests opening, and the simulation administrator records readings, results and crossing. Use separate browser profiles for the provisioned accounts.",
  ],
  scenarioSteps: ["خطوات التجربة", "Scenario steps"],
  scenarioUnavailable: [
    "لا توجد تجربة محفوظة متاحة لحسابك لهذه الحالة. تنطبق صلاحيات الرحلات على بيانات السيناريو أيضًا.",
    "No saved run is available to your account for this case. Journey permissions also apply to scenario data.",
  ],
  newScenarioRun: ["إنشاء تجربة جديدة", "Create a new run"],
  scenarioTemplate: [
    "قالب سيناريو تجريبي؛ اختر السائق والشاحنة والبوابة، ثم اتبع خطوات السيناريو من حسابات الأدوار.",
    "Demo scenario template: select driver, truck and gate, then follow the scenario instructions using each role’s account.",
  ],
  scenarioExpired: [
    "انتهت نافذة هذه التجربة. تبقى للعرض؛ أنشئ تجربة جديدة لموعد صالح.",
    "This run’s appointment has expired. It remains available for review; create a new run for a valid appointment.",
  ],
  scenarioGroup_success: ["مسار سليم وتعافٍ", "Success and recovery"],
  scenarioGroup_exceptions: ["استثناءات التشغيل", "Operational exceptions"],
  scenarioGroup_constraints: [
    "قيود الموعد والبيانات",
    "Appointment and data constraints",
  ],
  scenarioGroup_permissions: ["الصلاحيات", "Permissions"],
  scenarioStep_flow: [
    "الشركة تحفظ الرحلة ← السائق يبدأ ويسجل الوصول ← المحاكاة تتحقق ← المشغل يطلب الفتح ← المحاكاة تسجل النجاح ثم تؤكد العبور مستقلًا.",
    "Company saves the journey → driver starts and reports arrival → administrator verifies → operator requests opening → administrator records success, then separately confirms crossing.",
  ],
  scenarioStep_recommend: [
    "جهز A بطابور 8 ومعدل 15، وB بطابور 3 ومعدل 15، مع نافذة موعد تشمل الوصول. ابدأ من A واقبل توصية B من حساب السائق.",
    "Set A to queue 8/rate 15 and B to queue 3/rate 15, with an appointment covering arrival. Start from A and accept B’s recommendation using the driver account.",
  ],
  scenarioStep_mismatchPlate: [
    "بعد الوصول، غيّر اللوحة المقروءة إلى قيمة مختلفة قبل التحقق، واترك QR والحاوية مطابقين. راجع نتائج القراءات في السجل.",
    "After arrival, change the read plate before verification while leaving QR and container correct. Review the independent check results in the timeline.",
  ],
  scenarioStep_mismatchQr: [
    "بعد الوصول، استخدم معرّف QR مختلفًا مع اللوحة والحاوية الصحيحتين. يفشل التحقق ولا يظهر للمشغل طلب فتح.",
    "After arrival, use a different QR reference with correct plate and container. Verification fails and the operator cannot request opening.",
  ],
  scenarioStep_mismatchContainer: [
    "استخدم رقم حاوية مختلفًا في قراءة المحاكاة. نجاح اللوحة وQR لا يعوض فشل الحاوية.",
    "Use a different container number in the simulated reading. Matching plate and QR do not override the container failure.",
  ],
  scenarioStep_recoverIdentity: [
    "صحح القراءة من حساب المحاكاة وأعد التحقق. بعد نجاحه يطلب المشغل الفتح، وتسجل المحاكاة النتيجة ثم العبور.",
    "Correct the reading and verify again using the administrator account. Once verified, the operator requests opening; the administrator records the result and crossing.",
  ],
  scenarioStep_barrierFailure: [
    "بعد نجاح التحقق وطلب المشغل للفتح، اختر محاكاة فشل الفتح. راجع العطل والتصعيد، وتأكد أن وقت العبور فارغ.",
    "After verification and the operator’s opening request, simulate opening failure. Review the failure and escalation, and confirm the crossing time remains empty.",
  ],
  scenarioStep_barrierRecover: [
    "المشغل يعيد طلب الفتح. مسؤول المحاكاة يختار نجاح الفتح ثم يؤكد العبور. لا تمسح الأعطال السابقة من السجل.",
    "The operator requests opening again. The administrator records opening success and then confirms crossing. Earlier failures remain in the timeline.",
  ],
  scenarioStep_awaitCrossing: [
    "راجع أن الفتح لا يكمل الرحلة. من حساب المحاكاة فقط، اختر تأكيد عبور محاكى لإكمال الدخول وإصدار الإشعارات.",
    "Confirm that opening alone does not complete entry. Only the administrator can confirm simulated crossing to complete entry and create notifications.",
  ],
  scenarioStep_expired: [
    "استخدم نافذة موعد انتهت قبل الآن، ثم ابدأ وسجل الوصول واختبر التحقق. يجب رفض أهلية الموعد دون فتح. لإنشاء تجربة سليمة اختر موعدًا جديدًا.",
    "Use a window that ended before now, start and report arrival, then verify. The appointment check must fail without opening. Choose a new appointment for a valid run.",
  ],
  scenarioStep_early: [
    "اختر نافذة تبدأ بعد ساعتين ومدة سفر 30 دقيقة. لا تظهر توصية صالحة قبل النافذة، والتحقق المبكر لا يمر.",
    "Choose a window starting two hours from now with a 30-minute journey. No valid recommendation appears before the window, and early verification cannot pass.",
  ],
  scenarioStep_missing: [
    "من حساب المحاكاة، امسح الطابور أو معدل الخدمة للبوابة التجريبية. يجب أن تظهر بيانات غير متاحة دون تقدير أو توصية مبنيين على صفر افتراضي.",
    "Using the administrator account, clear the demo gate’s queue or service rate. The UI must show unavailable data without an estimate or recommendation based on an assumed zero.",
  ],
  scenarioStep_notification: [
    "راجع دخولًا مكتملًا ثم اختر محاكاة فشل إشعار السائق. يظهر الفشل للطرف المعني، وتبقى أوقات العبور والإكمال محفوظة.",
    "Review a completed entry, then simulate failure of the driver notification. That recipient’s status changes while crossing and completion timestamps remain intact.",
  ],
  scenarioStep_isolation: [
    "ادخل بحساب الشركة الثانية أو سائقها لمراجعة الرحلة. الحسابات الأخرى لا تستطيع عرضها عبر تغيير الرابط. مشغل البوابة المسندة ومسؤول المحاكاة لهما الاطلاع المخول.",
    "Use the second company or its driver to view the journey. Other companies and drivers cannot access it by changing the URL. Its assigned gate operator and simulation administrator retain authorized access.",
  ],
  searchTrips: ["بحث في الرحلات", "Search journeys"],
  searchHint: [
    "رقم الطلب أو الحاوية أو وصف الحمولة",
    "Request, container or cargo description",
  ],
  filterStatus: ["تصفية الحالة", "Filter status"],
  allStatuses: ["كل الحالات", "All statuses"],
  allOperations: ["كل المعاملات", "All operations"],
  results: ["النتائج", "Results"],
  noResults: ["لا توجد نتائج مطابقة", "No matching results"],
  changeFilters: [
    "غيّر البحث أو عوامل التصفية لعرض رحلات أخرى.",
    "Change your search or filters to find other journeys.",
  ],
  pagination: ["صفحات الرحلات", "Journey pages"],
  previous: ["السابق", "Previous"],
  next: ["التالي", "Next"],
  printReport: ["طباعة التقرير", "Print report"],
  notificationFailureRecorded: [
    "تسجيل فشل تسليم إشعار",
    "Notification delivery failure recorded",
  ],
  role_driver: ["السائق", "Driver"],
  role_company_admin: ["مسؤول الشركة", "Company administrator"],
  role_gate_operator: ["مشغل البوابة", "Gate operator"],
  role_demo_admin: ["مسؤول المحاكاة", "Simulation administrator"],
  waitChange: ["الانتظار قبل / بعد (دقيقة)", "Waiting before / after (min)"],
  recommendation_generated: [
    "توليد توصية الوصول",
    "Arrival recommendation generated",
  ],
  reports: ["تقارير الدخول", "Entry reports"],
  help: ["المساعدة", "Help"],
  skip: ["انتقل إلى المحتوى", "Skip to content"],
  refresh: ["تحديث الحالة", "Refresh status"],
  entryJourneys: ["رحلات الدخول", "Entry journeys"],
  journeySubtitle: [
    "كل رحلة واضحة، من التخطيط حتى العبور المؤكد.",
    "Every journey, from planning to confirmed crossing.",
  ],
  tripDetail: [
    "تفاصيل الرحلة ومراحل الدخول في سجل واحد.",
    "Journey details and entry stages in one record.",
  ],
  noResources: [
    "يلزم تجهيز سائق وشاحنة وبوابة متاحة قبل إنشاء رحلة. تواصل مع مسؤول العرض.",
    "A driver, truck and available gate must be provisioned before creating a journey. Contact the demo administrator.",
  ],
  qrTitle: ["رمز الطلب", "Journey QR"],
  verification: ["نتائج التحقق", "Verification results"],
  passed: ["مطابق", "Matched"],
  mismatch: ["غير مطابق", "Mismatch"],
  notApplicable: ["لا ينطبق", "Not applicable"],
  eligibility: ["أهلية البوابة", "Gate eligibility"],
  recipient: ["المستلم", "Recipient"],
  delivery: ["حالة إشعار الإكمال", "Completion notification status"],
  actor: ["الدور المنفذ", "Actor role"],
  currentGate: ["البوابة الحالية", "Current gate"],
  proposedGate: ["البوابة المقترحة", "Proposed gate"],
  simulationHint: [
    "اختر رحلة لتشغيل قراءات الهوية ونتيجة الحاجز وتأكيد العبور كأحداث مستقلة. تحديث البوابات أدناه يسجل في سجل المحاكاة.",
    "Select a journey to simulate identity readings, barrier results and crossing as separate events. Gate changes below are audited.",
  ],
  operatorHint: [
    "تابع الرحلات المسندة إلى بواباتك. طلب الفتح متاح بعد نجاح التحقق، ونتائج الأجهزة يصدرها مسؤول المحاكاة.",
    "Follow journeys assigned to your gates. Request opening after verification; the simulation administrator supplies device results.",
  ],
  helpFlow: [
    "الشركة تنشئ الرحلة. السائق يبدأها ويقبل التوصية ويسجل الوصول. مسؤول المحاكاة يسجل القراءات؛ المشغل يطلب الفتح؛ مسؤول المحاكاة يسجل النتيجة ثم يؤكد العبور مستقلًا.",
    "The company creates a journey. The driver starts it, accepts a recommendation and reports arrival. The simulation administrator records readings; the operator requests opening; the administrator supplies the result and confirms crossing separately.",
  ],
  helpFailure: [
    "اختلاف الهوية يوقف الفتح حتى إعادة التحقق. فشل الحاجز يسجل ويصعّد؛ يعيد المشغل طلب الفتح. الفتح وحده لا يكمل الدخول.",
    "An identity mismatch blocks opening until re-verification. Barrier failure is recorded and escalated; the operator can request opening again. Opening alone never completes entry.",
  ],
  helpRefresh: [
    "استخدم تحديث الحالة بعد إجراء من حساب آخر. عند انقطاع الاتصال لا تعرض نجاحًا حتى حفظ الإجراء؛ أعد المحاولة بعد عودة الاتصال. لا يدعم هذا الإصدار التشغيل دون اتصال.",
    "Refresh status after another account acts. If connectivity is lost, success requires a saved action; retry after reconnecting. Offline operation is not supported.",
  ],
  helpScope: [
    "بيانات هذا العرض اصطناعية. لا تصاريح رسمية، ولا تكامل أجهزة، ولا خروج أو عمليات داخل الميناء. التقديرات حساب تشغيلي بسيط وليست ذكاءً اصطناعيًا مدربًا.",
    "This demo uses synthetic data. No official permits, hardware integration, exit or in-port operations. Estimates use a simple operational calculation, not trained AI.",
  ],
  eventDetails: ["تفاصيل الحدث", "Event details"],
  gateAudit: ["سجل تغييرات البوابات", "Gate change history"],
  optional: ["اختياري للبضائع العامة", "Optional for general cargo"],
  outside_appointment: [
    "الوصول خارج نافذة الموعد التجريبية.",
    "Arrival is outside the demo appointment window.",
  ],
  missing_telemetry: [
    "بيانات التقدير غير مكتملة.",
    "Estimation data is incomplete.",
  ],
  simulation_only: [
    "هذا الإجراء مخصص لبيانات العرض فقط.",
    "This action is restricted to demo data.",
  ],
  idempotency_conflict: [
    "استُخدم هذا الطلب لإجراء مختلف. حدّث الصفحة قبل المحاولة.",
    "This request was already used for a different action. Refresh before retrying.",
  ],
  app: ["سمارت جيت", "SmartGate"],
  tagline: [
    "رحلة دخول أوضح. بوابات أكثر انسيابية.",
    "Clearer journeys. Smoother arrivals.",
  ],
  demo: [
    "بيانات محاكاة للعرض — لا اتصال بميناء أو أجهزة ميدانية",
    "Demo simulation — no port or field hardware connection",
  ],
  demoShort: ["بيئة تجريبية", "Demo workspace"],
  login: ["تسجيل الدخول", "Sign in"],
  email: ["البريد الإلكتروني", "Email"],
  password: ["كلمة المرور", "Password"],
  loginHint: [
    "استخدم حساب العرض المجهز لك للوصول إلى مساحة عملك.",
    "Use your provisioned demo account to enter your workspace.",
  ],
  noSignup: [
    "الحسابات مجهزة مسبقًا لهذا العرض. لا يوجد تسجيل عام.",
    "Accounts are provisioned for this demo. Public registration is unavailable.",
  ],
  logout: ["تسجيل الخروج", "Sign out"],
  company: ["لوحة الشركة", "Company workspace"],
  driver: ["رحلاتي", "My journeys"],
  gate_operator: ["تشغيل البوابة", "Gate operations"],
  demo_admin: ["لوحة المحاكاة", "Simulation studio"],
  company_admin: ["شركة النقل", "Transport company"],
  overview: ["نظرة عامة", "Overview"],
  trips: ["الرحلات", "Journeys"],
  gates: ["البوابات", "Gates"],
  notifications: ["الإشعارات", "Notifications"],
  greeting: ["مرحبًا بك في مساحة عملك", "Welcome to your workspace"],
  overviewHint: [
    "تابع رحلات الدخول والتحديثات والاستثناءات من مكان واحد.",
    "Follow entry journeys, updates and exceptions in one place.",
  ],
  newTrip: ["إنشاء رحلة", "New journey"],
  active: ["رحلات جارية", "Active journeys"],
  completedCount: ["دخول مكتمل", "Completed entries"],
  exceptions: ["تحتاج متابعة", "Needs attention"],
  availableGates: ["بوابات متاحة", "Available gates"],
  allTrips: ["سجل الرحلات", "Journey register"],
  noTrips: ["لا توجد رحلات بعد", "No journeys yet"],
  noTripsHint: [
    "ستظهر الرحلات المصرح لك بها هنا عند إنشائها.",
    "Journeys you are authorized to view will appear here.",
  ],
  request: ["رقم الطلب", "Request"],
  operation: ["نوع المعاملة", "Operation"],
  status: ["الحالة", "Status"],
  gate: ["البوابة", "Gate"],
  appointment: ["نافذة الموعد", "Appointment window"],
  view: ["عرض الرحلة", "View journey"],
  back: ["العودة إلى الرحلات", "Back to journeys"],
  save: ["حفظ الرحلة", "Save journey"],
  working: ["جارٍ التنفيذ…", "Working…"],
  driverName: ["السائق", "Driver"],
  truck: ["الشاحنة", "Truck"],
  choose: ["اختر", "Select"],
  container: ["حاويات", "Container"],
  general_cargo: ["بضائع عامة", "General cargo"],
  containerNumber: ["رقم الحاوية", "Container number"],
  cargoType: ["وصف الحمولة", "Cargo description"],
  cargoWeight: ["وزن الحمولة (كجم)", "Cargo weight (kg)"],
  departure: ["الانطلاق المخطط", "Planned departure"],
  starts: ["بداية الموعد", "Window starts"],
  ends: ["نهاية الموعد", "Window ends"],
  travel: ["مدة السفر التجريبية (دقيقة)", "Simulated travel time (minutes)"],
  timezone: ["جميع الأوقات بتوقيت مسقط UTC+4", "All times in Muscat, UTC+4"],
  tripFormHint: [
    "سجل بيانات رحلة الدخول. الموعد وQR تجريبيان وليسا تصريحًا رسميًا.",
    "Plan an entry journey. The appointment and QR are demo records, not official permits.",
  ],
  planned: ["مخططة", "Planned"],
  in_transit: ["في الطريق", "In transit"],
  at_gate: ["عند البوابة", "At gate"],
  verification_failed: ["استثناء تحقق", "Verification exception"],
  verified: ["تم التحقق", "Verified"],
  barrier_failed: ["عطل حاجز", "Barrier failure"],
  barrier_open: ["انتظار تأكيد العبور", "Awaiting crossing"],
  completed: ["دخول مكتمل", "Entry completed"],
  exception: ["استثناء", "Exception"],
  open: ["متاحة", "Open"],
  busy: ["مزدحمة", "Busy"],
  closed: ["مغلقة", "Closed"],
  out_of_service: ["خارج الخدمة", "Out of service"],
  queue: ["شاحنات بالطابور", "Trucks queued"],
  wait: ["انتظار تقديري", "Estimated wait"],
  minutes: ["دقيقة", "min"],
  unavailable: ["غير متاح", "Unavailable"],
  updated: ["آخر تحديث", "Last updated"],
  simulated: ["محاكاة", "Simulated"],
  rate: ["معدل الخدمة (شاحنة/ساعة)", "Service rate (trucks/hour)"],
  missingData: [
    "بيانات الطابور أو معدل الخدمة غير متاحة.",
    "Queue or service-rate data is unavailable.",
  ],
  gateHint: [
    "الانتظار = عدد المنتظرين × 60 ÷ معدل الخدمة. حساب تجريبي، وليس تنبؤًا مدربًا أو ضمانًا.",
    "Wait = queue × 60 ÷ hourly service rate. A demo calculation, not a trained forecast or guarantee.",
  ],
  recommendation: ["اقتراح الوصول", "Arrival recommendation"],
  noAlternative: [
    "لا يوجد بديل أفضل مسموح به وفق البيانات الحالية.",
    "No better permitted alternative is available with the current data.",
  ],
  outsideWindow: [
    "وقت الوصول التجريبي خارج نافذة الموعد؛ لا توجد توصية صالحة.",
    "Simulated arrival is outside the appointment window; no valid recommendation.",
  ],
  betterGate: [
    "بوابة بديلة بانتظار تقديري أقل",
    "An alternative gate with lower estimated waiting",
  ],
  accept: ["قبول التوصية", "Accept recommendation"],
  recommendationHint: [
    "يُعاد التحقق من الأهلية والموعد عند القبول. هذا إجراء عرض تجريبي.",
    "Eligibility and appointment are checked again on acceptance. This is a demo procedure.",
  ],
  eta: [
    "وصول تقديري من مدة السيناريو",
    "Estimated arrival from scenario duration",
  ],
  timeline: ["سجل أحداث الرحلة", "Journey timeline"],
  qrHint: [
    "معرّف رحلة تجريبية يتطلب تسجيل الدخول؛ لا يمنح تصريحًا.",
    "A demo journey reference requiring sign-in; it is not a permit.",
  ],
  actions: ["إجراءات الرحلة", "Journey actions"],
  start: ["بدء الرحلة", "Start journey"],
  arrive: ["تسجيل الوصول", "Report arrival"],
  request_open: ["طلب فتح الحاجز", "Request barrier opening"],
  verify: [
    "محاكاة قراءة الهوية والتحقق",
    "Simulate identity reading and verify",
  ],
  qr: ["معرّف QR المقروء", "Read QR reference"],
  plate: ["اللوحة المقروءة", "Read plate"],
  simulateOpen: ["محاكاة نجاح الفتح", "Simulate opening success"],
  simulateFailure: ["محاكاة فشل الفتح", "Simulate opening failure"],
  crossing: ["تأكيد عبور محاكى", "Confirm simulated crossing"],
  waitingRequest: [
    "طلب الفتح مسجل؛ بانتظار نتيجة محاكاة الجهاز.",
    "Opening requested; awaiting the simulated device result.",
  ],
  crossingHint: [
    "فتح الحاجز لا يكمل الدخول. يلزم تأكيد عبور مستقل من مسؤول المحاكاة.",
    "An open barrier does not complete entry. A separate simulated crossing confirmation is required.",
  ],
  failureHint: [
    "تم تسجيل عطل الفتح وتصعيده للمشغل. لم يكتمل الدخول.",
    "Opening failure recorded and escalated to the operator. Entry is incomplete.",
  ],
  mismatchHint: [
    "تعليق الفتح الآلي: اختلاف الهوية أو أهلية الدخول. راجع القراءات وسجل تحققًا جديدًا.",
    "Automatic opening suspended: identity or eligibility mismatch. Review readings and verify again.",
  ],
  report: ["تقرير الدخول", "Entry report"],
  crossed: ["وقت العبور المؤكد", "Confirmed crossing time"],
  completedAt: ["وقت الإكمال", "Completion time"],
  source: ["مصدر الحدث", "Event source"],
  pendingReport: [
    "صفحة متابعة — لم يؤكد العبور بعد",
    "Journey tracking — crossing is not confirmed yet",
  ],
  noNotifications: [
    "لا توجد إشعارات لك حتى الآن.",
    "You have no notifications yet.",
  ],
  pending: ["قيد الانتظار", "Pending"],
  delivered: ["متاح داخل التطبيق", "Available in app"],
  failed: ["فشل التسليم التجريبي", "Simulated delivery failure"],
  entry_completed: ["اكتمل دخول الشاحنة", "Truck entry completed"],
  trip_started: ["بدأت الرحلة", "Journey started"],
  gate_changed: ["تم تحديث البوابة", "Gate assignment updated"],
  barrier_failure: ["تصعيد عطل فتح الحاجز", "Barrier failure escalated"],
  trip_created: ["إنشاء الرحلة", "Journey created"],
  arrival_reported: ["تسجيل الوصول", "Arrival reported"],
  recommendation_accepted: [
    "قبول تغيير البوابة",
    "Gate recommendation accepted",
  ],
  verification_passed: ["نجاح التحقق", "Verification passed"],
  barrier_open_requested: ["طلب فتح الحاجز", "Barrier opening requested"],
  barrier_opened: ["نجاح فتح الحاجز", "Barrier opened"],
  crossing_confirmed: [
    "تأكيد العبور والإكمال",
    "Crossing confirmed and entry completed",
  ],
  exception_recorded: ["تسجيل استثناء", "Exception recorded"],
  failNotification: ["محاكاة فشل إشعار", "Simulate notification failure"],
  reset: ["إعادة ضبط هذه الرحلة التجريبية", "Reset this demo journey"],
  resetConfirm: [
    "أؤكد إزالة رحلة العرض وحفظ نسخة في سجل إعادة الضبط.",
    "I confirm removing this demo journey and preserving its reset audit snapshot.",
  ],
  updateGate: ["تحديث السيناريو", "Update scenario"],
  success: ["تم حفظ الإجراء.", "Action saved."],
  loginError: [
    "تعذر الدخول. تحقق من بيانات حساب العرض والاتصال.",
    "Sign-in failed. Check your demo credentials and connection.",
  ],
  actionError: [
    "تعذر تأكيد حفظ الإجراء. تحقق من الاتصال وحدّث الحالة قبل إعادة المحاولة.",
    "Unable to confirm the action was saved. Check your connection and refresh the status before retrying.",
  ],
  forbidden: [
    "لا تملك صلاحية هذا الإجراء.",
    "You are not authorized for this action.",
  ],
  invalid_input: [
    "راجع القيم المدخلة ونافذة الموعد.",
    "Review the entered values and appointment window.",
  ],
  invalid_transition: [
    "تغيرت حالة الرحلة أو أن شروط الإجراء لم تتحقق. حدّث الصفحة.",
    "The journey changed or action prerequisites are unmet. Refresh the page.",
  ],
  ineligible_gate: [
    "البوابة غير متاحة أو غير مؤهلة لهذه المعاملة.",
    "The gate is unavailable or ineligible for this operation.",
  ],
  invalid_membership: [
    "يجب أن تتبع الشاحنة والسائق لشركتك.",
    "The truck and driver must belong to your company.",
  ],
  recommendation_changed: [
    "تغيرت التوصية. حدّث الصفحة لمراجعة البدائل.",
    "The recommendation changed. Refresh to review alternatives.",
  ],
  errorTitle: ["تعذر تحميل مساحة العمل", "Unable to load workspace"],
  retry: ["إعادة المحاولة", "Try again"],
  loading: ["جارٍ تحميل مساحة العمل…", "Loading workspace…"],
  notFound: ["الصفحة غير متاحة", "Page unavailable"],
  noProfile: [
    "لا يوجد ملف عرض مجهز لهذا الحساب. تواصل مع مسؤول العرض.",
    "No demo profile is provisioned for this account. Contact the demo administrator.",
  ],
  identity: ["بيانات الرحلة", "Journey details"],
  notificationsHint: [
    "إشعارات داخل التطبيق فقط. لا يمثل هذا السجل إرسال رسالة خارجية.",
    "In-app notifications only. This log does not represent external message delivery.",
  ],
  lower_estimated_wait: [
    "انتظار تقديري أقل ضمن أهلية البوابة والموعد",
    "Lower estimated waiting within gate eligibility and appointment limits",
  ],
  identity_or_eligibility_mismatch: [
    "عدم تطابق الهوية أو شروط البوابة أو الموعد",
    "Identity, gate eligibility or appointment mismatch",
  ],
  barrier_failure_escalated: [
    "عطل الحاجز مصعّد للمشغل",
    "Barrier failure escalated to operator",
  ],
} as const;
export type CopyKey = keyof typeof copy;
export function t(locale: Locale, key: string) {
  return key in copy
    ? copy[key as CopyKey][locale === "ar" ? 0 : 1]
    : locale === "ar"
      ? "حدث تجريبي"
      : "Demo event";
}
export function dateTime(locale: Locale, value: string | null) {
  return value
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Muscat",
      }).format(new Date(value))
    : t(locale, "unavailable");
}
