"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Compass,
  Expand,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { chapters, features, gateCatalog } from "./content";
const PortScene = dynamic(() => import("./port-scene"), { ssr: false });
const lengths = chapters.map((c) => c.seconds);
const starts = lengths.map((_, i) =>
  lengths.slice(0, i).reduce((a, b) => a + b, 0),
);
function clock(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function RouteDemo({
  alternate,
  setAlternate,
  paused,
}: {
  alternate: boolean;
  setAlternate: (v: boolean) => void;
  paused: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      svg.current?.pauseAnimations();
    else svg.current?.unpauseAnimations();
  }, [paused]);
  return (
    <div className={`show-route ${paused ? "is-paused" : ""}`}>
      <div className="route-top">
        <span>
          <i /> رحلة السائق
        </span>
        <b>محاكاة توضيحية</b>
      </div>
      <svg
        ref={svg}
        viewBox="0 0 500 275"
        role="img"
        aria-label={`مسار تجريبي إلى بوابة الحاويات ${alternate ? "٢" : "١"}`}
      >
        <defs>
          <pattern
            id="route-grid"
            width="35"
            height="35"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M35 0H0V35"
              fill="none"
              stroke="#c8d9dc"
              strokeWidth=".7"
            />
          </pattern>
        </defs>
        <rect width="500" height="275" fill="#eaf1f1" />
        <rect width="500" height="275" fill="url(#route-grid)" />
        <path
          d="M0 235H500M60 0V275M330 0V275M0 85H500"
          stroke="#fff"
          strokeWidth="16"
          fill="none"
        />
        <path
          d="M0 235H500M60 0V275M330 0V275M0 85H500"
          stroke="#b5c7cd"
          strokeWidth="1"
          fill="none"
        />
        <path
          className="demo-route-line"
          d={alternate ? "M60 235H330V85H420V45" : "M60 235H330V85H240V45"}
          fill="none"
          stroke="#087f8c"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[240, 420].map((x, i) => (
          <g key={x}>
            <rect
              x={x - 22}
              y="18"
              width="44"
              height="35"
              rx="6"
              fill={alternate === !!i ? "#087f8c" : "#142d4e"}
            />
            <text x={x} y="41" textAnchor="middle" fill="white" fontSize="18">
              {i + 1}
            </text>
          </g>
        ))}
        <circle cx="60" cy="235" r="12" fill="#fff" />
        <circle cx="60" cy="235" r="7" fill="#2687f5" />
        <circle r="8" fill="#2687f5" stroke="white" strokeWidth="4">
          <animateMotion
            dur="12s"
            repeatCount="indefinite"
            path={alternate ? "M60 235H330V85H420V45" : "M60 235H330V85H240V45"}
          />
        </circle>
      </svg>
      <div className="route-caption">
        <MapPin size={18} />
        <div>
          <small>الوجهة التجريبية الحالية</small>
          <strong>بوابة الحاويات {alternate ? "٢" : "١"}</strong>
        </div>
        <span>مسار تقريبي</span>
      </div>
      <button type="button" onClick={() => setAlternate(!alternate)}>
        {alternate ? "العودة للبوابة ١" : "قبول توصية البوابة ٢ وتحديث المسار"}
        <ArrowLeft size={17} />
      </button>
      <p>هذه التجربة محلية في صفحة العرض؛ لا تغيّر رحلة محفوظة.</p>
    </div>
  );
}

export function Showcase() {
  const [active, setActive] = useState(0);
  const [presentation, setPresentation] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [scenario, setScenario] = useState<
    "barrier" | "identity" | "crossing" | "notification"
  >("barrier");
  const [zoom, setZoom] = useState<{ screen: string; title: string } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("الكل");
  const [inDetails, setInDetails] = useState(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const root = useRef<HTMLElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const chapter = chapters[active];
  const scenePaused = motionPaused || (presentation && !playing) || inDetails;
  const go = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(chapters.length - 1, index));
      setActive(next);
      setElapsed(starts[next]);
      if (!presentation)
        sectionRefs.current[next]?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "center",
        });
    },
    [presentation],
  );
  useEffect(() => {
    const element = document.getElementById("showcase-details");
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInDetails(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (presentation) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible)
          setActive(Number((visible.target as HTMLElement).dataset.chapter));
      },
      { rootMargin: "-25% 0px -30% 0px", threshold: [0, 0.2, 0.5] },
    );
    sectionRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [presentation]);
  useEffect(() => {
    if (!presentation || !playing) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setElapsed((s) => {
        const next = Math.min(300, s + 1);
        const index = starts.findLastIndex((start) => next >= start);
        setActive(index);
        if (next === 300) setPlaying(false);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [presentation, playing]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        zoom ||
        !presentation ||
        (event.target as HTMLElement).closest(
          "button,a,input,select,summary,textarea",
        )
      )
        return;
      if (["ArrowLeft", "ArrowDown", "PageDown"].includes(event.key)) {
        event.preventDefault();
        go(active + 1);
      }
      if (["ArrowRight", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        go(active - 1);
      }
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((p) => !p);
      }
      if (event.key === "Escape") {
        setPresentation(false);
        setPlaying(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active, go, presentation, zoom]);
  useEffect(() => {
    if (zoom) {
      previousFocus.current = document.activeElement as HTMLElement;
      modal.current?.showModal();
    } else {
      modal.current?.close();
      previousFocus.current?.focus();
    }
  }, [zoom]);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      setMessage(
        "استخدم زر ملء الشاشة في المتصفح إذا لم يدعم جهازك هذا الخيار.",
      );
    }
  }
  function startPresentation() {
    setPresentation(true);
    setPlaying(true);
    setElapsed(0);
    setActive(0);
    window.scrollTo({ top: 0 });
  }
  const scenarioCopy = {
    barrier: {
      title: "تعذر فتح الحاجز",
      result:
        "سُجل العطل وصُعّد للمشغّل. تبقى الرحلة غير مكتملة، وتُتاح إعادة المعالجة المخولة.",
      badge: "عطل وتصعيد",
    },
    identity: {
      title: "اختلاف قراءة اللوحة",
      result:
        "فشل فحص اللوحة مستقل عن نجاح QR والحاوية. يتوقف طلب الفتح حتى معالجة الاستثناء.",
      badge: "الفتح ممنوع",
    },
    crossing: {
      title: "الحاجز مفتوح، والعبور متأخر",
      result:
        "نجاح الفتح محفوظ، لكن اكتمال الدخول ينتظر تأكيد عبور مستقل. لا يُنشأ دخول ناجح مبكرًا.",
      badge: "انتظار العبور",
    },
    notification: {
      title: "عبور مؤكد، وإشعار متعذر",
      result:
        "تبقى الرحلة مكتملة. يسجل فشل تسليم الإشعار للطرف المعني، ويظهر في التقرير دون إلغاء الدخول.",
      badge: "دخول محفوظ",
    },
  }[scenario];
  return (
    <main
      className={`showcase ${presentation ? "is-presenting" : ""} ${active > 1 ? "scene-focus" : ""} ${inDetails ? "showing-details" : ""}`}
      dir="rtl"
      lang="ar"
      ref={root}
    >
      <a href="#showcase-story" className="showcase-skip">
        انتقل إلى قصة المشروع
      </a>
      <header className="showcase-header">
        <Link href="/ar/showcase" aria-label="بداية عرض SmartGate">
          <Image
            src="/brand/smartgate-wordmark-navy.svg"
            alt="SmartGate"
            width={145}
            height={38}
            priority
          />
        </Link>
        <span className="showcase-header-label">رحلة دخول أكثر وضوحًا</span>
        <div>
          <button
            type="button"
            className="showcase-quiet"
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused((p) => !p)}
          >
            {motionPaused ? <Play size={17} /> : <Pause size={17} />}
            <span>{motionPaused ? "تشغيل الحركة" : "إيقاف الحركة"}</span>
          </button>
          <Link className="showcase-login" href="/ar/login">
            دخول المنصة <ChevronLeft size={16} />
          </Link>
        </div>
      </header>
      <div className="showcase-world" aria-hidden="true">
        <div className="world-halo" />
        <PortScene
          chapter={active}
          paused={scenePaused}
          alternate={alternate}
          failure={
            active === 6 &&
            scenario !== "notification" &&
            scenario !== "crossing"
          }
        />
      </div>
      <aside
        className={`showcase-visual visual-${active}`}
        aria-label="التجربة البصرية"
      >
        {active === 0 || active === 1 ? (
          <div className="world-caption">
            <span>SMARTGATE / دخول الميناء</span>
            <p>
              {active === 0
                ? "شركة نقل. سائق. بوابة. رحلة متصلة."
                : "معلومات أوضح قبل الوصول."}
            </p>
          </div>
        ) : null}
        {active === 3 || active === 4 ? (
          <RouteDemo
            alternate={alternate}
            setAlternate={setAlternate}
            paused={scenePaused}
          />
        ) : "image" in chapter ? (
          <button
            type="button"
            className={`screen-model ${chapter.image === "driver" ? "phone-model" : ""}`}
            onClick={() =>
              setZoom({ screen: chapter.image, title: chapter.label })
            }
            aria-label={`تكبير شاشة ${chapter.label}`}
          >
            <div className="browser-bar">
              <i />
              <i />
              <i />
              <span>SmartGate</span>
              <Expand size={14} />
            </div>
            <Image
              src={`/showcase/screens/${chapter.image}.webp`}
              alt={`تصميم Figma: ${chapter.label}`}
              width={1440}
              height={1024}
              sizes="(max-width: 760px) 90vw, 48vw"
            />
            <span className="screen-source">تصميم Figma · اضغط للتكبير</span>
          </button>
        ) : null}
      </aside>
      <div className="showcase-story" id="showcase-story">
        {chapters.map((c, i) => (
          <section
            id={c.id}
            key={c.id}
            data-chapter={i}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            className={`showcase-chapter ${active === i ? "is-active" : ""}`}
            aria-hidden={presentation && active !== i ? true : undefined}
          >
            <div className="chapter-label">
              <span>{String(i + 1).padStart(2, "0")}</span>
              {c.label}
              <i />
            </div>
            {i === 0 ? <h1>{c.title}</h1> : <h2>{c.title}</h2>}
            <p className="chapter-body">{c.body}</p>
            {i === 0 ? (
              <div className="showcase-start">
                <button
                  type="button"
                  className="showcase-primary"
                  onClick={startPresentation}
                >
                  <Play size={18} fill="currentColor" />
                  ابدأ عرض الخمس دقائق
                </button>
                <button
                  type="button"
                  className="showcase-explore"
                  onClick={() => {
                    setPresentation(false);
                    setPlaying(false);
                    sectionRefs.current[1]?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }}
                >
                  استكشف المشروع <ArrowDown size={17} />
                </button>
              </div>
            ) : null}
            {i === 1 ? (
              <div className="problem-words">
                <span>رؤية حالة البوابات</span>
                <span>اختيار البديل المؤهل</span>
                <span>توثيق العبور</span>
              </div>
            ) : null}
            {i === 2 ? (
              <ol className="chapter-steps">
                <li>تحديد الرحلة والأهلية</li>
                <li>حفظ الطلب وإصدار QR</li>
                <li>متابعة السائق والاستثناءات</li>
              </ol>
            ) : null}
            {i === 3 ? (
              <div className="driver-milestones">
                <span>
                  <Play size={16} /> بدء الرحلة
                </span>
                <span>
                  <MapPin size={16} /> موقع متحرك
                </span>
                <span>
                  <Compass size={16} /> مسار يتحدث
                </span>
                <span>
                  <ScanLine size={16} /> وصول وقراءات
                </span>
              </div>
            ) : null}
            {i === 3 ? (
              <button
                type="button"
                className="chapter-screen-link"
                onClick={() =>
                  setZoom({ screen: "driver", title: "واجهة السائق" })
                }
              >
                شاهد واجهة السائق <Expand size={14} />
              </button>
            ) : null}
            {i === 4 ? (
              <div className="mini-gate-grid">
                {gateCatalog.map((g) => (
                  <div
                    key={g.code}
                    className={
                      g.status === "مغلقة" || g.status === "متعطلة"
                        ? "unavailable"
                        : ""
                    }
                  >
                    <strong>{g.n.toLocaleString("ar-OM")}</strong>
                    <span>{g.kind}</span>
                    <small>{g.status}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {i === 4 ? (
              <button
                type="button"
                className="chapter-screen-link"
                onClick={() =>
                  setZoom({
                    screen: "gates-live",
                    title: "البوابات الثماني في التطبيق",
                  })
                }
              >
                شاهد شاشة البوابات <Expand size={14} />
              </button>
            ) : null}
            {i === 5 ? (
              <div className="crossing-chain">
                <span>
                  <ScanLine /> تحقق
                </span>
                <ChevronLeft />
                <span>فتح</span>
                <ChevronLeft />
                <span>
                  <ShieldCheck /> عبور مستقل
                </span>
              </div>
            ) : null}
            {i === 6 ? (
              <div className="exception-demo">
                <div role="group" aria-label="سيناريوهات الاستثناء">
                  {(
                    ["barrier", "identity", "crossing", "notification"] as const
                  ).map((s, n) => (
                    <button
                      type="button"
                      aria-pressed={scenario === s}
                      key={s}
                      onClick={() => setScenario(s)}
                    >
                      {
                        [
                          "عطل الحاجز",
                          "اختلاف الهوية",
                          "تأخر العبور",
                          "فشل الإشعار",
                        ][n]
                      }
                    </button>
                  ))}
                </div>
                <div aria-live="polite">
                  <b>{scenarioCopy.badge}</b>
                  <h3>{scenarioCopy.title}</h3>
                  <p>{scenarioCopy.result}</p>
                </div>
              </div>
            ) : null}
            {i === 7 ? (
              <div className="showcase-start">
                <button
                  type="button"
                  className="showcase-primary"
                  onClick={() => {
                    setPresentation(false);
                    setPlaying(false);
                    setTimeout(
                      () =>
                        document
                          .getElementById("showcase-details")
                          ?.scrollIntoView({ behavior: "smooth" }),
                      30,
                    );
                  }}
                >
                  استكشف كل المميزات <ArrowDown size={17} />
                </button>
                <Link href="/ar/login" className="showcase-explore">
                  افتح المنصة <ChevronLeft size={17} />
                </Link>
              </div>
            ) : null}
            <p className="chapter-note">{c.note}</p>
          </section>
        ))}
      </div>
      <nav className="showcase-chapter-nav" aria-label="مشاهد العرض">
        {chapters.map((c, i) => (
          <button
            type="button"
            key={c.id}
            aria-label={c.label}
            aria-current={active === i ? "step" : undefined}
            onClick={() => go(i)}
          >
            <i />
            <span>{c.label}</span>
          </button>
        ))}
      </nav>
      {presentation ? (
        <div className="presentation-controls">
          <button
            type="button"
            onClick={() => go(active - 1)}
            disabled={active === 0}
            aria-label="المشهد السابق"
          >
            <ArrowRight size={19} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (elapsed === 300) {
                setElapsed(0);
                setActive(0);
              }
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "إيقاف العرض مؤقتًا" : "متابعة العرض"}
          >
            {playing ? <Pause size={19} /> : <Play size={19} />}
          </button>
          <span dir="ltr">{clock(elapsed)} / 05:00</span>
          <button
            type="button"
            onClick={() => go(active + 1)}
            disabled={active === 7}
            aria-label="المشهد التالي"
          >
            <ArrowLeft size={19} />
          </button>
          <button type="button" onClick={fullscreen} aria-label="ملء الشاشة">
            <Expand size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setPresentation(false);
              setPlaying(false);
            }}
            aria-label="إنهاء العرض والعودة للاستكشاف"
          >
            <X size={19} />
          </button>
          <div className="presentation-progress">
            <i style={{ width: `${elapsed / 3}%` }} />
          </div>
        </div>
      ) : (
        <div className="scroll-cue">
          <ArrowDown size={15} /> مرّر لتتبع الرحلة
        </div>
      )}
      <section className="showcase-details" id="showcase-details">
        <div className="details-intro">
          <span>داخل SmartGate</span>
          <h2>
            كل ميزة،
            <br />
            بتفاصيلها وحدودها.
          </h2>
          <p>
            افتح أي بند للتعرف على طريقة عمله. حالات التنفيذ هنا تفصل بين
            الوظيفة الفعلية والبيانات التجريبية والتكاملات المستقبلية.
          </p>
        </div>
        <div className="feature-index">
          {features.map((feature, i) => (
            <details key={feature.title}>
              <summary>
                <span className="feature-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{feature.title}</h3>
                <span className="feature-status">{feature.status}</span>
                <span className="feature-plus">+</span>
              </summary>
              <div className="feature-description">
                <p>{feature.detail}</p>
                <button
                  type="button"
                  onClick={() =>
                    setZoom({ screen: feature.screen, title: feature.title })
                  }
                >
                  شاهد الشاشة <Expand size={16} />
                </button>
              </div>
            </details>
          ))}
        </div>
        <div className="gate-explorer">
          <div>
            <h2>
              اختر نوع الشحنة.
              <br />
              وتعرّف على بواباته.
            </h2>
            <p>حالات تجريبية مرجعية للعرض، وليست قراءة لحظية من ميناء.</p>
          </div>
          <div className="gate-explorer-content">
            <div
              role="group"
              aria-label="تصفية البوابات حسب التخصص"
              className="gate-filters"
            >
              {["الكل", "حاويات", "بضائع عامة", "شحنات مبردة"].map((k) => (
                <button
                  type="button"
                  key={k}
                  aria-pressed={category === k}
                  onClick={() => setCategory(k)}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="catalog-grid">
              {gateCatalog
                .filter((g) => category === "الكل" || category === g.kind)
                .map((g) => (
                  <article key={g.code}>
                    <div>
                      <strong>{g.n.toLocaleString("ar-OM")}</strong>
                      <span>{g.status}</span>
                    </div>
                    <h3>{g.kind}</h3>
                    <small dir="ltr">{g.code}</small>
                    <p>
                      {g.wait === null
                        ? "بيانات الانتظار غير متاحة"
                        : `${g.wait.toLocaleString("ar-OM")} دقيقة انتظار تقديري`}
                    </p>
                  </article>
                ))}
            </div>
          </div>
        </div>
        <div className="showcase-build">
          <div>
            <span>كيف بُني المشروع؟</span>
            <h2>
              واجهة واضحة.
              <br />
              وقواعد تحفظ معنى كل حدث.
            </h2>
          </div>
          <div>
            <p>
              Next.js وReact لواجهات الأدوار، وSupabase للحسابات والبيانات
              والصلاحيات والتحديث اللحظي. QR يُقرأ محليًا، وخريطة السائق تستخدم
              Leaflet. الميناء المصغّر هنا مجسم Three.js مرسوم برمجيًا.
            </p>
            <p>
              تتحقق قواعد الخادم من صلاحية كل إجراء. تأكيد العبور مستقل عن
              الحاجز، وسجل الأحداث يحتفظ بالتوصية والفحوص والأعطال. اختبارات
              المنطق وقاعدة البيانات والمتصفح توثّق السلوك ضمن نطاق النموذج.
            </p>
            <div className="build-boundaries">
              <Check size={20} />
              <span>
                الدخول والتوثيق والتقارير ضمن النطاق. تكاملات أجهزة الميناء
                والجمارك والتوجيه الميداني تحتاج ربطًا وتحققًا مستقلين.
              </span>
            </div>
          </div>
        </div>
        <footer className="showcase-footer">
          <Image
            src="/brand/smartgate-logo-color.svg"
            alt="SmartGate"
            width={95}
            height={87}
          />
          <div>
            <h2>
              من أول قرار،
              <br />
              إلى عبور موثّق.
            </h2>
            <p>نموذج قابل للتجربة، بحدود واضحة.</p>
          </div>
          <div>
            <button
              type="button"
              className="showcase-primary"
              onClick={startPresentation}
            >
              <RotateCcw size={17} />
              أعد العرض
            </button>
            <Link href="/ar/login">
              الدخول إلى SmartGate <ArrowLeft size={17} />
            </Link>
          </div>
        </footer>
      </section>
      {message ? (
        <p className="showcase-message" role="status">
          {message}
        </p>
      ) : null}
      <dialog
        ref={modal}
        className="screen-dialog"
        onCancel={() => setZoom(null)}
        onClick={(e) => {
          if (e.target === modal.current) setZoom(null);
        }}
        aria-label={zoom?.title ?? "معاينة الشاشة"}
      >
        {zoom ? (
          <>
            <div className="screen-dialog-top">
              <div>
                <h2>{zoom.title}</h2>
                <p>
                  {zoom.screen.endsWith("-live")
                    ? "لقطة من التطبيق ببيانات عرض تجريبية"
                    : "تصميم ثابت من Figma؛ لا يثبت وحده تشغيل الميزة."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoom(null)}
                aria-label="إغلاق معاينة الشاشة"
              >
                <X />
              </button>
            </div>
            <div className="screen-dialog-image">
              <Image
                src={`/showcase/screens/${zoom.screen}.webp`}
                alt={zoom.title}
                width={1440}
                height={1200}
                sizes="90vw"
              />
            </div>
          </>
        ) : null}
      </dialog>
    </main>
  );
}
