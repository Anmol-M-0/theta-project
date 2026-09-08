import { createThetaRequestContext } from "./request-context.js";
import { isQuestionEligible, isQuestionAnswered } from "../../projections.js";

/**
 * Server-side action handler for Remix intake forms.
 * Enables zero-JS Progressive Enhancement by handling standard HTML Form POST requests,
 * evaluating branch invalidations, updating session cookies, and returning redirects or JSON.
 *
 * @param {Object} options
 * @param {Request} options.request - Incoming Remix action request
 * @param {import("../../schema.js").Schema} options.schema - Intake schema definition
 * @param {ReturnType<typeof import("./session-storage.js").createThetaCookieSessionStorage>} options.sessionStorage
 * @param {string} [options.redirectTo] - Optional route URL to redirect to on successful commit
 * @param {(facts: Record<string, any>, engine: import("../../engine.js").IntakeEngine) => any} [options.onComplete]
 * @returns {Promise<Response>}
 */
export async function thetaAction(options) {
  const { request, schema, sessionStorage, redirectTo, onComplete } = options;

  if (!sessionStorage) {
    throw new Error("[thetaAction] 'sessionStorage' is required to persist committed facts.");
  }

  const ctx = createThetaRequestContext({
    request,
    schema,
    sessionStorage,
  });

  const formData = await request.formData();
  const actionType = (formData.get("_action") || "commit").toString();

  // Optimistic Concurrency Control: verify submitted revision if provided
  const submittedRevRaw = formData.get("_theta_revision") ?? formData.get("revision");
  if (submittedRevRaw !== null && submittedRevRaw !== undefined && submittedRevRaw !== "") {
    const submittedRevision = parseInt(submittedRevRaw.toString(), 10);
    const currentRevision = ctx.getRevision();
    if (!isNaN(submittedRevision) && submittedRevision !== currentRevision) {
      return jsonError({
        ok: false,
        error: `Concurrency conflict: Submitted revision (${submittedRevision}) does not match current state revision (${currentRevision}).`,
        expectedRevision: currentRevision,
        submittedRevision,
      }, 409);
    }
  }

  const headers = new Headers();

  // 1. Reset Action
  if (actionType === "reset") {
    headers.set("Set-Cookie", sessionStorage.destroySession());
    const redirectUrl = redirectTo || new URL(request.url).pathname;
    return new Response(null, {
      status: 303,
      headers: {
        ...Object.fromEntries(headers.entries()),
        Location: redirectUrl,
      },
    });
  }

  // 2. Jump to Question Action
  if (actionType === "jump") {
    const questionId = formData.get("questionId")?.toString();
    const scopeIndexRaw = formData.get("scopeIndex");
    const scopeIndex = scopeIndexRaw ? parseInt(scopeIndexRaw.toString(), 10) : undefined;

    if (!questionId) {
      return jsonError({ error: "Missing 'questionId' for jump action." }, 400);
    }

    ctx.engine.dispatch({ type: "JUMP_TO_QUESTION", questionId, scopeIndex });
    headers.set("Set-Cookie", ctx.saveToSession());

    if (redirectTo) {
      return redirectWithHeaders(redirectTo, headers);
    }

    return jsonSuccess({
      ok: true,
      revision: ctx.getRevision(),
      activeQuestion: ctx.engine.getActiveQuestion(),
      stats: ctx.engine.getReviewTree().stats,
    }, headers);
  }

  // 3. Delete Answer Action
  if (actionType === "delete") {
    const questionId = formData.get("questionId")?.toString();
    const path = formData.get("path")?.toString();
    if (!questionId) {
      return jsonError({ error: "Missing 'questionId' for delete action." }, 400);
    }

    ctx.engine.dispatch({ type: "DELETE_ANSWER", questionId, path });
    headers.set("Set-Cookie", ctx.saveToSession());

    if (redirectTo) {
      return redirectWithHeaders(redirectTo, headers);
    }

    return jsonSuccess({
      ok: true,
      revision: ctx.getRevision(),
      activeQuestion: ctx.engine.getActiveQuestion(),
      stats: ctx.engine.getReviewTree().stats,
    }, headers);
  }

  // 4. Commit Answer Action (Default)
  const questionId = formData.get("questionId")?.toString();
  if (!questionId) {
    return jsonError({ error: "Missing 'questionId' in submission." }, 400);
  }

  const targetQuestion = findQuestionInSchema(schema, questionId);
  if (!targetQuestion) {
    return jsonError({ ok: false, error: `Question '${questionId}' not found in schema.` }, 400);
  }

  // Server-Authoritative Question Verification:
  // 1. Question must be eligible under current DAG conditions (not on an inactive/dormant branch)
  const currentFacts = ctx.engine.getState().facts;
  const isEligible = isQuestionEligible(targetQuestion, currentFacts);
  if (!isEligible) {
    return jsonError({
      ok: false,
      error: `Invalid transition: Question '${questionId}' is currently ineligible under active DAG conditions.`,
      questionId,
      activeQuestion: ctx.engine.getActiveQuestion(),
    }, 400);
  }

  // 2. If the question is not yet answered, it must be the currently active question (prevents skipping ahead)
  const currentActive = ctx.engine.getActiveQuestion();
  const isAnswered = isQuestionAnswered(targetQuestion, currentFacts);
  if (!isAnswered && currentActive && currentActive.id !== questionId) {
    return jsonError({
      ok: false,
      error: `Invalid transition: Question '${questionId}' is not the currently active question. Expected '${currentActive.id}'.`,
      expectedQuestionId: currentActive.id,
      submittedQuestionId: questionId,
      activeQuestion: currentActive,
    }, 400);
  }

  const rawValue = formData.get("value");
  const path = formData.get("path")?.toString() || undefined;

  // Auto-coerce input value based on question kind in schema
  const value = coerceValue(rawValue, questionId, schema);

  const result = ctx.engine.dispatch({
    type: "COMMIT_ANSWER",
    questionId,
    value,
    path,
  });

  if (!result.ok) {
    return jsonError({
      ok: false,
      error: result.error || "Validation failed for answer.",
      questionId,
      submittedValue: value,
      activeQuestion: ctx.engine.getActiveQuestion(),
    }, 400);
  }

  // Update session cookie with committed canonical facts and revision
  headers.set("Set-Cookie", ctx.saveToSession());

  const updatedFacts = ctx.engine.getState().facts;
  const activeQuestion = ctx.engine.getActiveQuestion();
  const isComplete = activeQuestion === null;

  if (isComplete && typeof onComplete === "function") {
    const completeResult = await onComplete(updatedFacts, ctx.engine);
    if (completeResult instanceof Response) {
      // Append Set-Cookie to onComplete response if returned
      completeResult.headers.set("Set-Cookie", headers.get("Set-Cookie"));
      return completeResult;
    }
  }

  // If progressive enhancement form submission or explicit redirect requested
  if (redirectTo) {
    return redirectWithHeaders(redirectTo, headers);
  }

  return jsonSuccess({
    ok: true,
    isComplete,
    revision: ctx.getRevision(),
    activeQuestion,
    stats: ctx.engine.getReviewTree().stats,
    facts: updatedFacts,
  }, headers);

}

function coerceValue(rawVal, questionId, schema) {
  if (rawVal === null || rawVal === undefined) return null;

  const strVal = rawVal.toString().trim();

  // Check if string is serialized JSON (e.g. array of choices or object)
  if ((strVal.startsWith("{") && strVal.endsWith("}")) || (strVal.startsWith("[") && strVal.endsWith("]"))) {
    try {
      return JSON.parse(strVal);
    } catch {
      // Fall through to string
    }
  }

  // Lookup question definition
  const question = findQuestionInSchema(schema, questionId);
  if (!question) return strVal;

  if (question.kind === "number") {
    const num = Number(strVal);
    return isNaN(num) ? strVal : num;
  }

  if (question.kind === "boolean") {
    if (strVal.toLowerCase() === "true") return true;
    if (strVal.toLowerCase() === "false") return false;
  }

  return strVal;
}

function findQuestionInSchema(schema, questionId) {
  if (!schema || !schema.sections) return null;
  for (const section of schema.sections) {
    if (section.questions) {
      const q = section.questions.find((x) => x.id === questionId);
      if (q) return q;
    }
  }
  return null;
}

function jsonSuccess(payload, headers) {
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers,
  });
}

function jsonError(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function redirectWithHeaders(url, headers) {
  headers.set("Location", url);
  return new Response(null, {
    status: 303,
    headers,
  });
}
