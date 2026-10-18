// A16: a QR is an untrusted reference, never an authorization or a device event.
export function journeyReference(value: string): string | null {
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    trimmed,
  )
    ? trimmed.toLowerCase()
    : null;
}
