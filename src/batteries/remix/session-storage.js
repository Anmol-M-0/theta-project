import crypto from "node:crypto";

/**
 * Creates an authenticated cookie session storage manager for persisting draft intake state
 * with HMAC-SHA256 cryptographic integrity verification.
 * Built with standard Web Fetch Request/Response interfaces.
 *
 * NOTE ON SECURITY:
 * HMAC-SHA256 provides authenticity and tamper-detection (the browser or a third party cannot alter
 * facts or revision numbers without invalidating the MAC signature). It does NOT provide confidentiality
 * (payload is base64url-encoded JSON). If storing sensitive PII or credentials, use server-side sessions
 * or application-level encryption (e.g. AES-GCM).
 *
 * @param {Object} [options]
 * @param {string} [options.cookieName] - Cookie name (defaults to "theta_intake_draft")
 * @param {string} [options.secret] - Secret for HMAC-SHA256 signature validation
 * @param {number} [options.maxAge] - Cookie lifetime in seconds (defaults to 7 days: 604800)
 * @param {string} [options.path] - Cookie path (defaults to "/")
 * @param {boolean} [options.sameSite] - SameSite attribute ("Lax" | "Strict" | "None")
 * @param {boolean} [options.httpOnly] - HttpOnly attribute (defaults to true)
 * @param {boolean} [options.secure] - Secure attribute (defaults to process.env.NODE_ENV === "production")
 * @param {number} [options.maxPayloadBytes] - Max byte size of encoded payload (defaults to 3800 bytes)
 */
export function createThetaCookieSessionStorage(options = {}) {
  const cookieName = options.cookieName || "theta_intake_draft";
  const secret = options.secret || "theta-default-dev-secret-key-do-not-use-in-prod";
  const maxAge = options.maxAge ?? 604800; // 7 days
  const path = options.path || "/";
  const sameSite = options.sameSite || "Lax";
  const httpOnly = options.httpOnly ?? true;
  const secure = options.secure ?? (process.env.NODE_ENV === "production");
  const maxPayloadBytes = options.maxPayloadBytes ?? 3800;

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
   * Parses the draft session data (facts, revision, schemaHash) from a Web Request or cookie header string.
   *
   * @param {Request | string | null} requestOrCookieHeader
   * @returns {{ facts: Record<string, any>, revision: number, schemaHash: string | null }}
   */
  function getSessionData(requestOrCookieHeader) {
    let cookieHeader = null;
    if (typeof requestOrCookieHeader === "string") {
      cookieHeader = requestOrCookieHeader;
    } else if (requestOrCookieHeader && typeof requestOrCookieHeader.headers?.get === "function") {
      cookieHeader = requestOrCookieHeader.headers.get("cookie");
    }

    const emptySession = { facts: {}, revision: 1, schemaHash: null };
    if (!cookieHeader) return emptySession;

    const cookies = parseCookies(cookieHeader);
    const rawVal = cookies[cookieName];
    if (!rawVal) return emptySession;

    try {
      const unsigned = unsign(rawVal);
      if (!unsigned) return emptySession;
      const jsonStr = Buffer.from(unsigned, "base64url").toString("utf8");
      const parsed = JSON.parse(jsonStr);

      if (parsed && typeof parsed === "object") {
        if ("facts" in parsed && typeof parsed.facts === "object" && parsed.facts !== null) {
          return {
            facts: parsed.facts,
            revision: typeof parsed.revision === "number" ? parsed.revision : 1,
            schemaHash: typeof parsed.schemaHash === "string" ? parsed.schemaHash : null,
          };
        }
        // Backward-compatibility: if legacy cookie stored bare facts dictionary
        return {
          facts: parsed,
          revision: 1,
          schemaHash: null,
        };
      }
      return emptySession;
    } catch {
      return emptySession;
    }
  }

  /**
   * Parses the draft facts from a Web Request or cookie header string.
   *
   * @param {Request | string | null} requestOrCookieHeader
   * @returns {Record<string, any>} Facts map or empty object
   */
  function getFacts(requestOrCookieHeader) {
    return getSessionData(requestOrCookieHeader).facts;
  }

  /**
   * Generates a Set-Cookie header value containing the authenticated draft session payload.
   *
   * @param {Object} session
   * @param {Record<string, any>} session.facts - Intake facts map
   * @param {number} [session.revision] - Monotonic revision number for optimistic concurrency control
   * @param {string | null} [session.schemaHash] - SHA-256 fingerprint of the active schema
   * @returns {string} Set-Cookie header string
   */
  function commitSession({ facts = {}, revision = 1, schemaHash = null }) {
    const payload = {
      facts: facts || {},
      revision: typeof revision === "number" ? revision : 1,
      schemaHash: schemaHash || null,
    };
    const jsonStr = JSON.stringify(payload);
    const base64Str = Buffer.from(jsonStr, "utf8").toString("base64url");

    if (Buffer.byteLength(base64Str, "utf8") > maxPayloadBytes) {
      throw new Error(
        `[createThetaCookieSessionStorage] Payload size (${Buffer.byteLength(base64Str, "utf8")} bytes) exceeds maxPayloadBytes limit (${maxPayloadBytes}). Large intake flows should use server-side storage.`
      );
    }

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
   * Generates a Set-Cookie header value containing the signed draft facts.
   * (Convenience wrapper around commitSession for backward compatibility).
   *
   * @param {Record<string, any>} facts
   * @param {number} [revision]
   * @param {string | null} [schemaHash]
   * @returns {string} Set-Cookie header string
   */
  function commitFacts(facts, revision = 1, schemaHash = null) {
    return commitSession({ facts, revision, schemaHash });
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
    getSessionData,
    getFacts,
    commitSession,
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

