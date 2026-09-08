import { createIntakeEngine } from "../../engine.js";

/**
 * Serializes the runtime state of a Theta Engine instance into a pure,
 * transfer-safe JSON structure for SSR dehydration or transport.
 *
 * @param {import("../../engine.js").IntakeEngine} engine
 * @param {import("../../schema.js").Schema} [schema] - Optional schema for ID and version metadata
 * @returns {{
 *   schemaId?: string,
 *   version?: number,
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
 * @returns {import("../../engine.js").IntakeEngine}
 */
export function hydrateThetaState({ schema, serializedState, storage }) {
  if (!schema) {
    throw new Error("[hydrateThetaState] Schema is required for hydration.");
  }

  const initialFacts = (serializedState && serializedState.facts) ? serializedState.facts : {};

  return createIntakeEngine({
    schema,
    initialFacts,
    storage,
  });
}
