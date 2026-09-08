# Theta Engine Batteries Guide: React & Remix

This guide documents the official **React** (`theta-engine/react`) and **Remix** (`theta-engine/remix`) batteries for **Theta Engine**.

---

## Architecture Overview

Theta Engine is a deterministic state-machine and question dependency runtime. The batteries provide the presentation and server transport layers:

```
                           ┌───────────────────────┐
                           │     theta-engine      │  (Deterministic core, 0 dependencies)
                           └───────────┬───────────┘
                                       │
                           ┌───────────▼───────────┐
                           │  theta-engine/adapter │  (Universal reactive store adapter)
                           └───────────┬───────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
     ┌────────────────────────┐                ┌────────────────────────┐
     │   theta-engine/react   │                │   theta-engine/remix   │
     │                        │                │                        │
     │ • <ThetaProvider>      │                │ • Request Isolation    │
     │ • useSyncExternalStore │                │ • Cookie Sessions      │
     │ • useActiveQuestion()  │                │ • thetaLoader() (SSR)  │
     │ • useQuestionState(id) │                │ • thetaAction() (Form) │
     │ • Selective Rerenders  │                │ • Zero-JS Progressive  │
     └────────────────────────┘                └────────────────────────┘
```

---

## 1. React Batteries (`theta-engine/react`)

Designed for React 18+ and React 19 using native `useSyncExternalStore`.

### Installation
```bash
npm install theta-engine
```

### Quickstart

```tsx
import React from "react";
import { createThetaEngine } from "theta-engine";
import {
  ThetaProvider,
  useActiveQuestion,
  useQuestionValue,
  useIntakeProgress,
  useThetaDispatch,
} from "theta-engine/react";

const engine = createThetaEngine({ schema: mySchema });

export function App() {
  return (
    <ThetaProvider engine={engine}>
      <IntakeHeader />
      <ActiveQuestionCard />
    </ThetaProvider>
  );
}

function IntakeHeader() {
  const stats = useIntakeProgress();
  return (
    <div>
      <h3>Progress: {stats.completed} / {stats.totalEligible} completed</h3>
      <progress value={stats.completed} max={stats.totalEligible} />
    </div>
  );
}

function ActiveQuestionCard() {
  const question = useActiveQuestion();
  const { commitAnswer } = useThetaDispatch();

  if (!question) {
    return <div>🎉 Intake Completed! All questions answered.</div>;
  }

  return (
    <div>
      <h2>{question.label}</h2>
      <input
        type={question.kind === "number" ? "number" : "text"}
        defaultValue={question.value || ""}
        onBlur={(e) => commitAnswer(question.id, e.target.value)}
      />
    </div>
  );
}
```

### Granular Subscriptions (Selective Re-rendering)

In large intake forms (e.g. 100+ questions), whole-form re-renders cause severe input lag. Theta solves this via DAG-indexed selective subscriptions:

```tsx
import { useQuestionState, useQuestionValue, useFactPath } from "theta-engine/react";

function QuestionSummary({ questionId }: { questionId: string }) {
  // Re-renders ONLY when this specific question's value or eligibility changes!
  const value = useQuestionValue(questionId);
  return <span>{questionId}: {String(value)}</span>;
}
```

---

## 2. Remix Batteries (`theta-engine/remix`)

Designed for Remix 2.x and React Router 7. Built entirely upon standard Web `Request`, `Response`, `Headers`, and `FormData` standards.

### Key Guarantees:
1. **Zero Server State Contamination**: Every request gets an isolated, ephemeral engine instance via `createThetaRequestContext`.
2. **True Progressive Enhancement**: Submitting `<Form method="post">` works with **zero client JavaScript** enabled.
3. **Signed Draft Storage**: Facts are safely encrypted/signed into HTTP-only cookie sessions using HMAC-SHA256 via `createThetaCookieSessionStorage`.

---

## 3. Complete Remix Route Example (`app/routes/intake.tsx`)

```tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  thetaLoader,
  thetaLoaderResponse,
  thetaAction,
  createThetaCookieSessionStorage,
  useRemixTheta,
} from "theta-engine/remix";
import { schema } from "~/schemas/conveyance";

// 1. Initialize Cookie Session Manager
const sessionStorage = createThetaCookieSessionStorage({
  cookieName: "theta_intake_draft",
  secret: process.env.SESSION_SECRET || "dev-secret-key-change-in-prod",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});

// 2. Server Loader (Dehydrates State for SSR)
export async function loader({ request }: LoaderFunctionArgs) {
  return thetaLoader({
    request,
    schema,
    sessionStorage,
  });
}

// 3. Server Action (Progressive Enhancement & Branch Pruning)
export async function action({ request }: ActionFunctionArgs) {
  return thetaAction({
    request,
    schema,
    sessionStorage,
    onComplete: async (facts) => {
      // Called when all eligible questions in schema are answered
      console.log("Intake Complete! Persisting facts to database:", facts);
    },
  });
}

// 4. Interactive Route Component
export default function IntakeRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const { activeQuestion, stats, actionError } = useRemixTheta({
    loaderData,
    actionData,
  });

  const isSubmitting = navigation.state === "submitting";

  if (!activeQuestion) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>🎉 Intake Complete!</h1>
        <p>All required information has been recorded.</p>
        <Form method="post">
          <input type="hidden" name="_action" value="reset" />
          <button type="submit">Start Over</button>
        </Form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h2>Theta Progressive Intake</h2>
        <div style={{ background: "#e2e8f0", borderRadius: 8, overflow: "hidden", height: 8 }}>
          <div
            style={{
              background: "#4f46e5",
              height: "100%",
              width: `${(stats.completed / Math.max(1, stats.totalEligible)) * 100}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
          Question {stats.completed + 1} of {stats.totalEligible}
        </p>
      </header>

      {actionError && (
        <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* Standard HTML Form: Works with or without JavaScript! */}
      <Form method="post">
        <input type="hidden" name="questionId" value={activeQuestion.id} />

        <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
          {activeQuestion.label}
        </label>

        {activeQuestion.kind === "select" || activeQuestion.kind === "card" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activeQuestion.options?.map((opt: any) => (
              <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="value"
                  value={opt.value}
                  defaultChecked={activeQuestion.value === opt.value}
                  required
                />
                {opt.label}
              </label>
            ))}
          </div>
        ) : (
          <input
            type={activeQuestion.kind === "number" ? "number" : "text"}
            name="value"
            defaultValue={activeQuestion.value || ""}
            required
            style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        )}

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              background: "#4f46e5",
              color: "#fff",
              padding: "0.6rem 1.2rem",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
            }}
          >
            {isSubmitting ? "Saving..." : "Continue →"}
          </button>
        </div>
      </Form>
    </div>
  );
}
```

---

## 4. Summary of API Exports

### `theta-engine/react`
| Export | Type | Description |
| :--- | :--- | :--- |
| `ThetaProvider` | Component | Context provider managing engine and store adapter teardown |
| `useThetaContext` | Hook | Returns `{ engine, adapter }` from context |
| `useThetaStore` | Hook | React 18 `useSyncExternalStore` selector subscriber |
| `useActiveQuestion`| Hook | Subscribes reactively to the current dynamic question |
| `useIsIntakeComplete`| Hook | Returns true when all eligible questions are answered |
| `useQuestionState` | Hook | Subscribes strictly to changes affecting a single question ID |
| `useQuestionValue` | Hook | Reads fact value for a question with isolated re-render gating |
| `useFactPath` | Hook | Subscribes to changes on a canonical fact path |
| `useReviewTree` | Hook | Subscribes to the master review tree |
| `useIntakeProgress` | Hook | Returns `{ totalEligible, completed, remaining }` |
| `useThetaDispatch` | Hook | Returns helper action dispatchers (`commitAnswer`, etc.) |

### `theta-engine/remix`
| Export | Type | Description |
| :--- | :--- | :--- |
| `createThetaCookieSessionStorage` | Factory | Encrypted HMAC-SHA256 cookie session storage |
| `createThetaRequestContext` | Factory | Request-isolated engine instance for zero server leakage |
| `thetaLoader` | Helper | Dehydrates engine state & stats into SSR loaderData |
| `thetaLoaderResponse` | Helper | Returns standard Web `Response` with JSON loaderData |
| `thetaAction` | Helper | Handles HTML Form POST, validation, and branch invalidations |
| `serializeThetaState` | Utility | Serializes engine state into transfer-safe JSON |
| `hydrateThetaState` | Utility | Hydrates new engine instance from serialized state |
| `useRemixTheta` | Hook | Client-side hydration hook bridging loader/action data |
