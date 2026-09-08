import { createThetaRequestContext } from "./request-context.js";

/**
 * Server-side loader helper for Remix intake routes.
 * Initializes an isolated request engine, derives the active question & review tree,
 * and produces a dehydrated state payload for client hydration.
 *
 * @param {Object} options
 * @param {Request} options.request - Incoming Remix request
 * @param {import("../../schema.js").Schema} options.schema - Schema definition
 * @param {ReturnType<typeof import("./session-storage.js").createThetaCookieSessionStorage>} [options.sessionStorage]
 * @param {Record<string, any>} [options.initialFacts] - Optional initial facts override
 * @returns {Promise<{
 *   schema: import("../../schema.js").Schema,
 *   state: any,
 *   activeQuestion: any,
 *   stats: { totalEligible: number, completed: number, remaining: number, percentComplete: number },
 *   reviewTree: any
 * }>}
 */
export async function thetaLoader(options) {
  const { request, schema, sessionStorage, initialFacts } = options;

  const ctx = createThetaRequestContext({
    request,
    schema,
    sessionStorage,
    initialFacts,
  });

  const activeQuestion = ctx.engine.getActiveQuestion();
  const reviewTree = ctx.engine.getReviewTree();

  return {
    schema,
    state: ctx.serialize(),
    activeQuestion,
    stats: reviewTree.stats,
    reviewTree,
  };
}

/**
 * Creates a standard Web Response with json content-type containing the dehydrated loader payload.
 *
 * @param {Object} options
 * @param {ResponseInit} [responseInit]
 * @returns {Promise<Response>}
 */
export async function thetaLoaderResponse(options, responseInit = {}) {
  const data = await thetaLoader(options);
  const headers = new Headers(responseInit.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    status: responseInit.status || 200,
    headers,
  });
}
