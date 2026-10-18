import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const configSchema = z.object({
  token: z.string().min(43).max(128),
  recipient: z.email(),
  operation: z.uuid(),
  createdAt: z.number().int(),
  expiresAt: z.number().int(),
}).strict();

const headers = { "Cache-Control": "private, no-store" };
const reply = (body: object, status: number) => Response.json(body, { status, headers });

// A15: an operator-authorized diagnostic, independent of trip completion.
// No caller-controlled recipient/content; the short-lived capability is configured
// only in hosting secrets. Resend deduplicates this immutable request for 24h.
export async function emailSmoke(
  request: Request,
  environment: { config?: string; apiKey?: string },
  send: typeof fetch = fetch,
  now = Date.now(),
) {
  let value: unknown;
  try { value = JSON.parse(environment.config ?? "null"); } catch { return reply({ error: "disabled" }, 404); }
  const parsed = configSchema.safeParse(value);
  if (!parsed.success || !environment.apiKey) return reply({ error: "disabled" }, 404);
  const config = parsed.data;
  // Expiry is anchored to creation, so redeploys cannot extend the 24h dedupe window.
  if (config.createdAt > now || config.expiresAt <= now ||
      config.expiresAt <= config.createdAt || config.expiresAt - config.createdAt > 3_600_000 ||
      config.recipient.toLowerCase().endsWith(".test")) return reply({ error: "disabled" }, 404);
  const supplied = request.headers.get("authorization") ?? "";
  if (supplied.length > 256 || !timingSafeEqual(
    createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(`Bearer ${config.token}`).digest(),
  )) return reply({ error: "unauthorized" }, 401);

  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${environment.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `smartgate-smoke/${config.operation}`,
      },
      body: JSON.stringify({
        from: "SmartGate <onboarding@resend.dev>",
        to: [config.recipient],
        subject: "SmartGate — اختبار البريد الإلكتروني",
        text: "هذه رسالة اختبار واحدة من SmartGate بطلبك للتحقق من إعداد البريد الإلكتروني. هذه ليست إشعار دخول أو تصريحًا أو تأكيد عبور. لم يُفعّل إرسال إشعارات الشركات والسائقين؛ يحتاج ذلك نطاق إرسال موثقًا.\n\nThis is your requested SmartGate email setup test. It is not an entry permit or a crossing confirmation.",
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return reply({ error: "provider_rejected", providerStatus: response.status }, 502);
    const receipt = z.object({ id: z.uuid() }).safeParse(await response.json());
    if (!receipt.success) return reply({ error: "invalid_provider_receipt" }, 502);
    // Acceptance is not a delivery receipt; never claim inbox delivery here.
    return reply({ status: "accepted", id: receipt.data.id }, 200);
  } catch {
    return reply({ error: "provider_unavailable" }, 502);
  }
}
