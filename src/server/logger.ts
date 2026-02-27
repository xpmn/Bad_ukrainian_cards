/**
 * Production-safe logger.
 *
 * In production mode, room codes and tokens are masked in all log output
 * to prevent leaking sensitive identifiers into log aggregators.
 */

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

// Matches 6-char room codes (uppercase letters + digits, excluding ambiguous chars)
const ROOM_CODE_RE = /\b[A-HJ-NP-Z2-9]{6}\b/g;

// Matches UUID v4 tokens
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

function sanitize(msg: string): string {
  if (!IS_PRODUCTION) return msg;
  return msg
    .replace(UUID_RE, "[TOKEN]")
    .replace(ROOM_CODE_RE, "[ROOM]");
}

function formatArgs(args: unknown[]): string {
  return args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
}

export const logger = {
  info(...args: unknown[]): void {
    console.log(sanitize(formatArgs(args)));
  },
  warn(...args: unknown[]): void {
    console.warn(sanitize(formatArgs(args)));
  },
  error(...args: unknown[]): void {
    console.error(sanitize(formatArgs(args)));
  },
  debug(...args: unknown[]): void {
    if (!IS_PRODUCTION) {
      console.debug(sanitize(formatArgs(args)));
    }
  },
};
