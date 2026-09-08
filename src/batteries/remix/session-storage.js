import crypto from "node:crypto";

/**
 * Creates an immutable cookie session storage manager for persisting draft intake facts.
 * Built with standard Web Fetch Request/Response interfaces.
 *
 * @param {Object} [options]
 * @param {string} [options.cookieName] - Cookie name (defaults to "theta_intake_draft")
 * @param {string} [options.secret] - Optional secret for HMAC-SHA256 signature validation
 * @param {number} [options.maxAge] - Cookie lifetime in seconds (defaults to 7 days: 604800)
 * @param {string} [options.path] - Cookie path (defaults to "/")
 * @param {boolean} [options.sameSite] - SameSite attribute ("Lax" | "Strict" | "None")
 * @param {boolean} [options.httpOnly] - HttpOnly attribute (defaults to true)
 * @param {boolean} [options.secure] - Secure attribute (defaults to process.env.NODE_ENV === "production")
 */
export function createThetaCookieSessionStorage(options = {}) {
  const cookieName = options.cookieName || "theta_intake_draft";
  const secret = options.secret || "theta-default-dev-secret-key-do-not-use-in-prod";
  const maxAge = options.maxAge ?? 604800; // 7 days
  const path = options.path || "/";
  const sameSite = options.sameSite || "Lax";
  const httpOnly = options.httpOnly ?? true;
  const secure = options.secure ?? (process.env.NODE_ENV === "production");

  function sign(value) {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(value);
    const signature = hmac.digest("base64url");
    return `${value}.${signature}`;
  }

  function unsign(signedValue) {
    const lastDot = signedValue.lastIndexOf(".");
    if (lastDot === -1) return null;
    const value = signedValue.slice(0, lastDot);
    const signature = signedValue.slice(lastDot + 1);

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(value);
    const expectedSignature = hmac.digest("base64url");

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return value;
    }
    return null;
  }

  /**
   * Parses the draft facts from a Web Request or cookie header string.
   *
   * @param {Request | string | null} requestOrCookieHeader
   * @returns {Record<string, any>} Facts map or empty object
   */
  function getFacts(requestOrCookieHeader) {
    let cookieHeader = null;
    if (typeof requestOrCookieHeader === "string") {
      cookieHeader = requestOrCookieHeader;
    } else if (requestOrCookieHeader && typeof requestOrCookieHeader.headers?.get === "function") {
      cookieHeader = requestOrCookieHeader.headers.get("cookie");
    }

    if (!cookieHeader) return {};

    const cookies = parseCookies(cookieHeader);
    const rawVal = cookies[cookieName];
    if (!rawVal) return {};

    try {
      const unsigned = unsign(rawVal);
      if (!unsigned) return {};
      const jsonStr = Buffer.from(unsigned, "base64url").toString("utf8");
      const parsed = JSON.parse(jsonStr);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Generates a Set-Cookie header value containing the signed draft facts.
   *
   * @param {Record<string, any>} facts
   * @returns {string} Set-Cookie header string
   */
  function commitFacts(facts) {
    const jsonStr = JSON.stringify(facts || {});
    const base64Str = Buffer.from(jsonStr, "utf8").toString("base64url");
    const signedVal = sign(base64Str);

    const parts = [
      `${cookieName}=${signedVal}`,
      `Path=${path}`,
      `Max-Age=${maxAge}`,
      `SameSite=${sameSite}`,
    ];

    if (httpOnly) parts.push("HttpOnly");
    if (secure) parts.push("Secure");

    return parts.join("; ");
  }

  /**
   * Generates a Set-Cookie header value to clear the draft session.
   *
   * @returns {string} Set-Cookie header string
   */
  function destroySession() {
    const parts = [
      `${cookieName}=`,
      `Path=${path}`,
      `Max-Age=0`,
      `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      `SameSite=${sameSite}`,
    ];
    if (httpOnly) parts.push("HttpOnly");
    if (secure) parts.push("Secure");

    return parts.join("; ");
  }

  return {
    cookieName,
    getFacts,
    commitFacts,
    destroySession,
  };
}

function parseCookies(header) {
  const list = {};
  if (!header) return list;
  for (const part of header.split(";")) {
    const [key, ...v] = part.trim().split("=");
    if (key) {
      list[key] = decodeURIComponent(v.join("="));
    }
  }
  return list;
}
