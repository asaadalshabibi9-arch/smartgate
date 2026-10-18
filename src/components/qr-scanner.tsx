"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
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
  const controls = useRef<IScannerControls | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);

  const release = () => {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
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
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (token !== generation.current) return;
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
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
      const scanner = await new BrowserQRCodeReader().decodeFromStream(
        media,
        video.current,
        (result) => {
          if (!result || token !== generation.current) return;
          const reference = journeyReference(result.getText());
          if (!reference) {
            setMessage("invalidQr");
            return;
          }
          setValue(reference);
          setMessage("scanReady");
          release();
          setActive(false);
        },
      );
      if (token !== generation.current) scanner.stop();
      else controls.current = scanner;
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
