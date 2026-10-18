import { emailSmoke } from "@/lib/email-smoke";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return emailSmoke(request, {
    config: process.env.EMAIL_SMOKE_CONFIG,
    apiKey: process.env.RESEND_API_KEY,
  });
}
