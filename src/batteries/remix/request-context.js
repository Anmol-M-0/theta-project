import { createIntakeEngine } from "../../engine.js";
import { serializeThetaState, computeSchemaHash } from "./serialization.js";

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
 *   schema: import("../../schema.js").Schema,
 *   schemaHash: string,
 *   schemaMismatch: boolean,
 *   request: Request,
 *   getFacts: () => Record<string, any>,
 *   getRevision: () => number,
 *   serialize: () => any,
 *   saveToSession: () => string
 * }}
 */
export function createThetaRequestContext(options) {
  const { request, schema, sessionStorage, initialFacts, storage } = options;

  if (!schema) {
    throw new Error("[createThetaRequestContext] 'schema' is required.");
  }

  const currentSchemaHash = computeSchemaHash(schema);
  let sessionFacts = {};
  let sessionRevision = 1;
  let schemaMismatch = false;

  if (initialFacts) {
    sessionFacts = initialFacts;
  } else if (sessionStorage && request) {
    if (typeof sessionStorage.getSessionData === "function") {
      const sessionData = sessionStorage.getSessionData(request);
      if (sessionData.schemaHash && sessionData.schemaHash !== currentSchemaHash) {
        // Schema mismatch detected (e.g. rolling deployment schema change).
        // Reset facts to prevent out-of-date state invalidations.
        schemaMismatch = true;
        sessionFacts = {};
        sessionRevision = 1;
      } else {
        sessionFacts = sessionData.facts || {};
        sessionRevision = sessionData.revision || 1;
      }
    } else {
      sessionFacts = sessionStorage.getFacts(request) || {};
    }
  }

  // Create isolated synchronous engine instance for this request
  const engine = createIntakeEngine({
    schema,
    initialState: {
      facts: sessionFacts,
      revision: sessionRevision,
    },
    storage,
  });

  return {
    engine,
    schema,
    schemaHash: currentSchemaHash,
    schemaMismatch,
    request,
    getFacts: () => engine.getState().facts,
    getRevision: () => (typeof engine.getRevision === "function" ? engine.getRevision() : engine.getState().revision),
    serialize: () => serializeThetaState(engine, schema),
    saveToSession: () => {
      if (!sessionStorage) {
        throw new Error("[saveToSession] No sessionStorage configured for request context.");
      }
      const state = engine.getState();
      const currentRev = typeof engine.getRevision === "function" ? engine.getRevision() : (state.revision || 1);
      if (typeof sessionStorage.commitSession === "function") {
        return sessionStorage.commitSession({
          facts: state.facts,
          revision: currentRev,
          schemaHash: currentSchemaHash,
        });
      }
      return sessionStorage.commitFacts(state.facts, currentRev, currentSchemaHash);
    },
  };
}

