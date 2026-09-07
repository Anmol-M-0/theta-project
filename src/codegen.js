/**
 * @file codegen.js
 * @description Zero-dependency, deterministic TypeScript code and types generator for Theta schemas.
 */

import { tokenizePath } from "./path.js";

/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 */

/**
 * Maps a question kind to its TypeScript primitive/domain type.
 * @param {string} kind
 * @returns {string}
 */
export function mapKindToTsType(kind) {
  switch (kind) {
    case "number":
    case "currency":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
    case "text":
    case "pan":
    case "cin":
    case "din":
    case "aadhaar":
    case "select":
    case "card":
      return "string";
    case "multiselect":
      return "string[]";
    default:
      return "unknown";
  }
}

/**
 * @typedef {Object} LeafNode
 * @property {'leaf'} kind
 * @property {string} tsType
 */

/**
 * @typedef {Object} ObjectNode
 * @property {'object'} kind
 * @property {Map<string, TypeNode>} properties
 */

/**
 * @typedef {Object} ArrayNode
 * @property {'array'} kind
 * @property {TypeNode} element
 */

/**
 * @typedef {LeafNode | ObjectNode | ArrayNode} TypeNode
 */

/**
 * Renders a TypeNode to clean, formatted TypeScript.
 * @param {TypeNode} node
 * @param {string} [indent]
 * @returns {string}
 */
function renderNode(node, indent = "  ") {
  if (node.kind === "leaf") {
    return node.tsType;
  }

  if (node.kind === "array") {
    if (node.element.kind === "leaf") {
      return `Array<${node.element.tsType}>`;
    }
    const renderedElem = renderNode(node.element, indent);
    return `Array<${renderedElem}>`;
  }

  if (node.kind === "object") {
    if (node.properties.size === 0) {
      return "Record<string, unknown>";
    }

    const keys = Array.from(node.properties.keys()).sort();
    const lines = ["{"];
    for (const key of keys) {
      const child = node.properties.get(key);
      const renderedChild = renderNode(child, indent + "  ");
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
      lines.push(`${indent}  ${safeKey}?: ${renderedChild};`);
    }
    lines.push(`${indent}}`);
    return lines.join("\n");
  }

  return "unknown";
}

/**
 * Inserts a tokenized path into the type AST tree.
 * Enforces strict structural collision detection.
 *
 * @param {ObjectNode} root
 * @param {import('./path.js').PathToken[]} tokens
 * @param {string} targetTsType
 * @param {string} fullPath
 */
function insertPath(root, tokens, targetTsType, fullPath) {
  if (!tokens || tokens.length === 0) return;

  /** @type {TypeNode} */
  let curr = root;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;

    if (token.type === "key") {
      const key = String(token.value);
      if (curr.kind !== "object") {
        throw new Error(
          `Schema path collision: "${fullPath}" attempted to access property "${key}" on non-object node`
        );
      }

      if (curr.properties.has(key)) {
        const child = curr.properties.get(key);
        if (isLast) {
          if (child.kind !== "leaf" || child.tsType !== targetTsType) {
            throw new Error(
              `Schema path collision: "${fullPath}" conflicts with existing node structure at "${key}"`
            );
          }
          // Same leaf type, deterministic merge
          return;
        }

        if (child.kind === "leaf") {
          throw new Error(
            `Schema path collision: "${fullPath}" conflicts with existing leaf at "${key}"`
          );
        }

        const nextToken = tokens[i + 1];
        if (nextToken.type === "scope" || nextToken.type === "index") {
          if (child.kind !== "array") {
            throw new Error(
              `Schema path collision: "${fullPath}" expected array container for "${key}" but found object`
            );
          }
        } else {
          if (child.kind !== "object") {
            throw new Error(
              `Schema path collision: "${fullPath}" expected object container for "${key}" but found array`
            );
          }
        }
        curr = child;
      } else {
        if (isLast) {
          curr.properties.set(key, { kind: "leaf", tsType: targetTsType });
          return;
        }

        const nextToken = tokens[i + 1];
        if (nextToken.type === "scope" || nextToken.type === "index") {
          /** @type {ArrayNode} */
          const arrayNode = {
            kind: "array",
            element: { kind: "object", properties: new Map() },
          };
          curr.properties.set(key, arrayNode);
          curr = arrayNode;
        } else {
          /** @type {ObjectNode} */
          const objNode = { kind: "object", properties: new Map() };
          curr.properties.set(key, objNode);
          curr = objNode;
        }
      }
    } else if (token.type === "scope" || token.type === "index") {
      if (curr.kind !== "array") {
        throw new Error(
          `Schema path collision: "${fullPath}" encountered array token at non-array node`
        );
      }

      if (isLast) {
        if (curr.element.kind === "object" && curr.element.properties.size === 0) {
          curr.element = { kind: "leaf", tsType: targetTsType };
          return;
        }
        if (curr.element.kind === "leaf" && curr.element.tsType === targetTsType) {
          return;
        }
        throw new Error(
          `Schema path collision: "${fullPath}" conflicts with array element structure`
        );
      }

      const nextToken = tokens[i + 1];
      if (curr.element.kind === "leaf") {
        throw new Error(
          `Schema path collision: "${fullPath}" conflicts with existing array leaf element`
        );
      }

      if (nextToken.type === "scope" || nextToken.type === "index") {
        if (curr.element.kind === "object" && curr.element.properties.size === 0) {
          curr.element = {
            kind: "array",
            element: { kind: "object", properties: new Map() },
          };
        }
        if (curr.element.kind !== "array") {
          throw new Error(
            `Schema path collision: "${fullPath}" expected nested array container`
          );
        }
        curr = curr.element;
      } else {
        if (curr.element.kind !== "object") {
          throw new Error(
            `Schema path collision: "${fullPath}" expected object element in array container`
          );
        }
        curr = curr.element;
      }
    }
  }
}

/**
 * Generates deterministic TypeScript type declarations from an IntakeSchema.
 * Produces byte-identical output with full repeater topologies, collision safety, and escaped identifiers.
 *
 * @param {IntakeSchema} schema
 * @returns {string} Clean TypeScript source code
 */
export function generateTypeScript(schema) {
  if (!schema || typeof schema !== "object") {
    throw new Error("generateTypeScript requires a valid IntakeSchema object");
  }

  const sections = schema.sections || [];
  const branches = schema.branches || [];
  const repeaters = schema.repeaters || [];

  // 1. Collect and sort all Question IDs and path mappings
  const questionIds = [];
  const questionsByPath = [];

  for (const s of sections) {
    for (const q of s.questions || []) {
      if (q.id) {
        questionIds.push(q.id);
      }
      if (q.path) {
        questionsByPath.push(q);
      }
    }
  }
  questionIds.sort();

  const branchIds = branches.map((b) => b.id).filter(Boolean).sort();
  const repeaterIds = repeaters.map((r) => r.id).filter(Boolean).sort();

  // 2. Generate QuestionId Union Type (JSON-escaped for safety against quotes, backslashes, hyphens)
  const questionIdType =
    questionIds.length > 0
      ? questionIds.map((id) => `  | ${JSON.stringify(id)}`).join("\n")
      : "  | string";

  // 3. Generate BranchId Union Type
  const branchIdType =
    branchIds.length > 0
      ? branchIds.map((id) => `  | ${JSON.stringify(id)}`).join("\n")
      : "  | string";

  // 4. Generate RepeaterId Union Type
  const repeaterIdType =
    repeaterIds.length > 0
      ? repeaterIds.map((id) => `  | ${JSON.stringify(id)}`).join("\n")
      : "  | string";

  // 5. Build nested facts AST structure
  /** @type {ObjectNode} */
  const rootNode = { kind: "object", properties: new Map() };

  // Sort paths deterministically before inserting
  questionsByPath.sort((a, b) => a.path.localeCompare(b.path));

  for (const q of questionsByPath) {
    const tokens = tokenizePath(q.path);
    const tsType = mapKindToTsType(q.kind);
    insertPath(rootNode, tokens, tsType, q.path);
  }

  const factsType = renderNode(rootNode, "");

  // Safe schema comment sanitization (preventing */ breakout)
  const safeSchemaId = String(schema.id ?? "").replace(/\*\//g, "*\\/");
  const safeVersion = Number(schema.version) || 1;

  // 6. Assemble complete TypeScript file
  const out = `/**
 * AUTO-GENERATED BY THETA ENGINE CODEGEN. DO NOT EDIT DIRECTLY.
 * Schema ID: ${safeSchemaId}
 * Version: ${safeVersion}
 */

export type QuestionId =
${questionIdType};

export type BranchId =
${branchIdType};

export type RepeaterId =
${repeaterIdType};

export interface CanonicalFacts ${factsType}

export interface TypedIntakeState {
  facts: CanonicalFacts;
  revision: number;
}
`;

  return out;
}
