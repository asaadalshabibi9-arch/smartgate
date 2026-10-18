import { afterEach, describe, expect, it, vi } from "vitest";
import { emailSmoke } from "../../src/lib/email-smoke";

const now = 1_800_000_000_000;
const config = {
  token: "a".repeat(64), recipient: "owner@example.com",
  operation: "aab35cf3-2617-47c2-bb92-53c36313cbbd",
  createdAt: now - 1000, expiresAt: now + 60_000,
};
const env = { config: JSON.stringify(config), apiKey: "private-test-key" };
const request = (token = config.token) => new Request("https://example.com/api/operations/email-smoke", {
  method: "POST", headers: { authorization: `Bearer ${token}` },
  body: JSON.stringify({ to: "attacker@example.com", subject: "changed" }),
});
afterEach(() => vi.restoreAllMocks());

describe("restricted email diagnostic", () => {
  it("fails closed for missing secrets, malformed, expired, future or long-lived configuration", async () => {
    const send = vi.fn();
    for (const configuration of [undefined, "bad-json", "{}", JSON.stringify({ ...config, expiresAt: now }),
      JSON.stringify({ ...config, createdAt: now + 1 }),
      JSON.stringify({ ...config, expiresAt: now + 3_600_000 }),
      JSON.stringify({ ...config, recipient: "driver@smartgate.test" })]) {
      expect((await emailSmoke(request(), { config: configuration, apiKey: "key" }, send, now)).status).toBe(404);
    }
    expect((await emailSmoke(request(), { config: env.config }, send, now)).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });
  it("requires its private capability before contacting the provider", async () => {
    const send = vi.fn();
    expect((await emailSmoke(request("wrong"), env, send, now)).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
  it("ignores caller data and preserves the same provider deduplication key across retries", async () => {
    const id = "a10eed5c-72cf-4c03-9301-e974ee9995b5";
    const send = vi.fn().mockImplementation(async () => Response.json({ id }));
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await emailSmoke(request(), env, send, now);
      expect(await response.json()).toEqual({ status: "accepted", id });
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      const [url, options] = send.mock.calls[attempt];
      expect(url).toBe("https://api.resend.com/emails");
      expect(options.headers["Idempotency-Key"]).toBe(`smartgate-smoke/${config.operation}`);
      expect(JSON.parse(options.body).to).toEqual([config.recipient]);
      expect(options.body).not.toContain("attacker");
    }
  });
  it("does not leak upstream errors, credentials or recipient data", async () => {
    const send = vi.fn().mockResolvedValue(new Response("secret-private-provider-message", { status: 403 }));
    expect(await (await emailSmoke(request(), env, send, now)).json()).toEqual({ error: "provider_rejected", providerStatus: 403 });
    send.mockRejectedValue(new Error("private-test-key"));
    expect(await (await emailSmoke(request(), env, send, now)).json()).toEqual({ error: "provider_unavailable" });
    send.mockResolvedValue(Response.json({ id: "bad" }));
    expect(await (await emailSmoke(request(), env, send, now)).json()).toEqual({ error: "invalid_provider_receipt" });
  });
});
