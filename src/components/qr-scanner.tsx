"use client";
import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { journeyReference } from "@/lib/domain/qr";

export function QrScanner({
  locale,
  initialValue,
}: {
  locale: Locale;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);

  const release = () => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) {
        release();
        setActive(false);
      }
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      release();
    };
  }, []);

  async function start() {
    release();
    const token = generation.current;
    setActive(true);
    setMessage("");
    try {
      const { default: decode } = await import("jsqr");
      if (token !== generation.current) return;
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (token !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (!video.current) {
        release();
        return;
      }
      video.current.srcObject = media;
      await video.current.play();
      if (token !== generation.current) return;
      video.current?.scrollIntoView({ block: "nearest" });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      const scan = () => {
        if (token !== generation.current || !video.current) return;
        try {
          const preview = video.current;
          if (
            preview.readyState >= 2 &&
            preview.videoWidth &&
            preview.videoHeight
          ) {
            const scale = Math.min(
              1,
              960 / Math.max(preview.videoWidth, preview.videoHeight),
            );
            canvas.width = Math.round(preview.videoWidth * scale);
            canvas.height = Math.round(preview.videoHeight * scale);
            context.drawImage(preview, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            const result = decode(pixels.data, canvas.width, canvas.height, {
              inversionAttempts: "attemptBoth",
            });
            if (result) {
              const reference = journeyReference(result.data);
              if (reference) {
                setValue(reference);
                setMessage("scanReady");
                release();
                setActive(false);
                return;
              }
              setMessage("invalidQr");
            }
          }
          timer.current = setTimeout(scan, 250);
        } catch {
          release();
          setActive(false);
          setMessage("cameraError");
        }
      };
      scan();
    } catch {
      if (token !== generation.current) return;
      release();
      setActive(false);
      setMessage("cameraError");
    }
  }
  return (
    <div className="qr-scanner">
      <label>
        {t(locale, "qr")}
        <input
          name="qr"
          required
          dir="ltr"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="button secondary"
        onClick={
          active
            ? () => {
                release();
                setActive(false);
              }
            : start
        }
      >
        {t(locale, active ? "stopCamera" : "scanQr")}
      </button>
      <video
        ref={video}
        hidden={!active}
        muted
        playsInline
        aria-label={t(locale, "scanQr")}
      />
      <p className="calculation-note">{t(locale, "scanHint")}</p>
      <p role="status" aria-live="polite">
        {message ? t(locale, message) : ""}
      </p>
    </div>
  );
}
