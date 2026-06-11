/**
 * Convert a survivor username into the platform's synthetic auth email.
 * Mirrors src/pages/AuthenticationFlow.tsx so mobile and web resolve to the
 * SAME account (canonical domain: @aegis.example).
 */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildAuthEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (emailPattern.test(trimmed)) {
    return trimmed.replace(/@aegis\.systems$/i, "@aegis.example");
  }
  return `${trimmed}@aegis.example`;
}
