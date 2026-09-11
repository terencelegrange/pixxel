/**
 * lib/secretSettings.ts  —  SERVER ONLY
 *
 * `app_settings` is a generic key-value store (Confluence tokens, the
 * observability collector's API key, etc.). Secret-classified keys are never
 * returned to the client as plaintext — GET masks them to a sentinel, and PUT
 * treats an unchanged sentinel as "leave this value alone" so the UI can
 * round-trip a settings form without ever holding the real secret.
 */
export const SECRET_SETTING_KEYS = new Set([
  "confluence.api_token",
  "observability.api_key",
]);

export const MASKED_VALUE = "__unchanged_secret__";

export function maskSecretSettings(settings: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    masked[key] = SECRET_SETTING_KEYS.has(key) && value ? MASKED_VALUE : value;
  }
  return masked;
}
