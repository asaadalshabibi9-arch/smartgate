import { describe, it, expect } from "vitest";
import {
  copy,
  locales,
  dictionaries,
  localeOf,
  direction,
  dateTime,
  t,
} from "../../src/lib/i18n";
import { translatedRows } from "../../src/lib/translations";
import { journeyReference } from "../../src/lib/domain/qr";
import { scenarios, scenarioText } from "../../src/lib/scenarios";
import QRCode from "qrcode";
import decode from "jsqr";

describe("A17 eight complete UI dictionaries", () => {
  it("has an authored translation for every base key in all six added locales", () => {
    const rows = translatedRows.split("\n").map((row) => row.split("|"));
    expect(new Set(rows.map(([key]) => key)).size).toBe(rows.length);
    for (const key of Object.keys(copy)) {
      const row = rows.find(([name]) => name === key);
      expect(row, key).toBeDefined();
      expect(row?.length, key).toBe(7);
      for (const locale of locales)
        expect(
          dictionaries[locale][key]?.trim(),
          `${locale}:${key}`,
        ).toBeTruthy();
    }
  });
  it("keeps Urdu and Arabic RTL, validates routes, and formats Muscat dates", () => {
    for (const locale of locales) {
      expect(localeOf(locale)).toBe(locale);
      expect(direction(locale)).toBe(
        ["ar", "ur"].includes(locale) ? "rtl" : "ltr",
      );
      expect(dateTime(locale, "2026-10-18T10:00:00Z")).not.toBe("");
      for (const scenario of scenarios) {
        expect(scenarioText(scenario.title, locale)).toBeTruthy();
        expect(scenarioText(scenario.description, locale)).toBeTruthy();
      }
    }
    expect(localeOf("constructor")).toBe("ar");
    expect(t("hi", "constructor")).toBe(t("hi", "simulated"));
  });
});
describe("A16 untrusted camera QR", () => {
  it("decodes a genuine generated journey QR in each of the eight mask patterns", () => {
    const reference = "bc01c00f-e753-419e-8c27-676b5931c0ff";
    for (const maskPattern of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
      const { modules } = QRCode.create(reference, { maskPattern });
      const width = (modules.size + 8) * 8;
      const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
      for (let y = 0; y < modules.size; y++)
        for (let x = 0; x < modules.size; x++) {
          if (!modules.data[y * modules.size + x]) continue;
          for (let dy = 0; dy < 8; dy++)
            for (let dx = 0; dx < 8; dx++) {
              const offset =
                (((y + 4) * 8 + dy) * width + (x + 4) * 8 + dx) * 4;
              pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
            }
        }
      expect(decode(pixels, width, width)?.data, `mask ${maskPattern}`).toBe(
        reference,
      );
    }
  });
  it("only accepts a bare journey UUID and never follows embedded URLs", () => {
    const reference = "e7d13168-f894-46c5-bb03-a076f60337cf";
    expect(journeyReference(` ${reference.toUpperCase()} `)).toBe(reference);
    for (const value of [
      "",
      "<script>alert(1)</script>",
      `https://example.com/${reference}`,
      `javascript:${reference}`,
      "not-a-journey",
    ])
      expect(journeyReference(value)).toBeNull();
  });
});
