/**
 * Redaction utility for security: ensures credentials, API keys, and authorization headers
 * never leak into logs, error messages, or exported structures.
 */

export function redactSecrets(text: string): string {
  if (!text || typeof text !== "string") return text;
  let redacted = text;

  // Bearer tokens
  redacted = redacted.replace(/(Bearer\s+)[a-zA-Z0-9_\-\.]{8,}/gi, "$1[REDACTED]");

  // key="..." or key: "..."
  redacted = redacted.replace(/(\bkey\s*[:=]\s*["']?)[a-zA-Z0-9_\-\.]{8,}(["']?)/gi, "$1[REDACTED]$2");

  // api_key="..." or api-key="..."
  redacted = redacted.replace(/(\bapi[-_]?key\s*[:=]\s*["']?)[a-zA-Z0-9_\-\.]{8,}(["']?)/gi, "$1[REDACTED]$2");

  // Standalone sk- openai key pattern
  redacted = redacted.replace(/\bsk-[a-zA-Z0-9_\-]{16,}\b/gi, "[REDACTED]");

  return redacted;
}

export function redactHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!v) continue;
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes("auth") ||
      lowerKey.includes("key") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token")
    ) {
      clean[k] = "[REDACTED]";
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

