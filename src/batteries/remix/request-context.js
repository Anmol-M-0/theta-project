import { createIntakeEngine } from "../../engine.js";
import { serializeThetaState } from "./serialization.js";

/**
 * Creates an isolated, request-scoped Theta IntakeEngine.
 * Guarantees zero cross-request mutable state leakage in server environments.
 *
 * @param {Object} options
 * @param {Request} options.request - Incoming Web fetch Request
 * @param {import("../../schema.js").Schema} options.schema - Intake schema definition
 * @param {ReturnType<typeof import("./session-storage.js").createThetaCookieSessionStorage>} [options.sessionStorage]
 * @param {Record<string, any>} [options.initialFacts] - Explicit initial facts overriding session
 * @param {import("../../storage.js").StorageAdapter} [options.storage] - Storage adapter
 * @returns {{
 *   engine: import("../../engine.js").IntakeEngine,
 *   request: Request,
 *   getFacts: () => Record<string, any>,
 *   serialize: () => any,
 *   saveToSession: () => string
 * }}
 */
export function createThetaRequestContext(options) {
  const { request, schema, sessionStorage, initialFacts, storage } = options;

  if (!schema) {
    throw new Error("[createThetaRequestContext] 'schema' is required.");
  }

  // Retrieve draft facts from session cookie if sessionStorage is provided
  let loadedFacts = initialFacts || {};
  if (!initialFacts && sessionStorage && request) {
    loadedFacts = sessionStorage.getFacts(request);
  }

  // Create isolated synchronous engine instance for this request
  const engine = createIntakeEngine({
    schema,
    initialFacts: loadedFacts,
    storage,
  });

  return {
    engine,
    schema,
    request,
    getFacts: () => engine.getState().facts,
    serialize: () => serializeThetaState(engine, schema),
    saveToSession: () => {
      if (!sessionStorage) {
        throw new Error("[saveToSession] No sessionStorage configured for request context.");
      }
      return sessionStorage.commitFacts(engine.getState().facts);
    },
  };
}
