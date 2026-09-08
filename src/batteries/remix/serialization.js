import { createIntakeEngine } from "../../engine.js";

/**
 * Computes a deterministic fingerprint for an intake schema.
 * Enables runtime detection of schema version drift during rolling deployments.
 * Zero external dependencies: operates seamlessly across Node, browsers, and Edge workers.
 *
 * @param {import("../../schema.js").Schema} schema
 * @returns {string} Hex-encoded 16-character deterministic fingerprint
 */
export function computeSchemaHash(schema) {
  if (!schema) return "";
  const canonical = JSON.stringify({
    id: schema.id || "",
    version: schema.version || 1,
    sections: (schema.sections || []).map((s) => ({
      id: s.id,
      questions: (s.questions || []).map((q) => ({ id: q.id, path: q.path, kind: q.kind })),
    })),
    branches: (schema.branches || []).map((b) => ({
      id: b.id,
      ownedPaths: b.ownedPaths,
    })),
  });

  let h1 = 0x811c9dc5;
  let h2 = 0x9dc5811c;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch >> 8), 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

/**
 * Serializes the runtime state of a Theta Engine instance into a pure,
 * transfer-safe JSON structure for SSR dehydration or transport.
 *
 * @param {import("../../engine.js").IntakeEngine} engine
 * @param {import("../../schema.js").Schema} [schema] - Optional schema for ID, version, and hash metadata
 * @returns {{
 *   schemaId?: string,
 *   version?: number,
 *   schemaHash?: string,
 *   revision: number,
 *   facts: Record<string, any>,
 *   history?: any[]
 * }}
 */
export function serializeThetaState(engine, schema = null) {
  if (!engine) {
    throw new Error("[serializeThetaState] Engine instance is required.");
  }

  const state = engine.getState();
  const serialized = {
    revision: typeof engine.getRevision === "function" ? engine.getRevision() : (state.revision || 1),
    facts: state.facts || {},
  };

  if (schema) {
    serialized.schemaId = schema.id;
    serialized.version = schema.version;
    serialized.schemaHash = computeSchemaHash(schema);
  }

  if (typeof engine.getCommandHistory === "function") {
    serialized.history = engine.getCommandHistory();
  }

  return serialized;
}

/**
 * Hydrates a new Theta Engine instance on the client or server from a serialized snapshot.
 *
 * @param {Object} options
 * @param {import("../../schema.js").Schema} options.schema
 * @param {Object} options.serializedState
 * @param {import("../../storage.js").StorageAdapter} [options.storage]
 * @param {boolean} [options.strictSchema] - Whether to throw on schemaHash mismatch
 * @returns {import("../../engine.js").IntakeEngine}
 */
export function hydrateThetaState({ schema, serializedState, storage, strictSchema = false }) {
  if (!schema) {
    throw new Error("[hydrateThetaState] Schema is required for hydration.");
  }

  if (strictSchema && serializedState?.schemaHash) {
    const currentHash = computeSchemaHash(schema);
    if (serializedState.schemaHash !== currentHash) {
      throw new Error(
        `[hydrateThetaState] Schema hash mismatch: serialized state has '${serializedState.schemaHash}' but current schema has '${currentHash}'.`
      );
    }
  }

  const initialFacts = (serializedState && serializedState.facts) ? serializedState.facts : {};
  const initialRevision = (serializedState && typeof serializedState.revision === "number")
    ? serializedState.revision
    : 1;

  return createIntakeEngine({
    schema,
    initialState: {
      facts: initialFacts,
      revision: initialRevision,
    },
    storage,
  });
}

