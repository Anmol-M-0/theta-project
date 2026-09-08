import React from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import {
  thetaLoader,
  thetaAction,
  useRemixTheta,
} from "../../src/batteries/remix/index.js";
import { ThetaProvider } from "../../src/batteries/react/index.js";
import { propertyIntakeSchema } from "../schemas/property-intake";
import { Layout } from "../components/Layout";
import { ProgressBar } from "../components/ProgressBar";
import { QuestionCard } from "../components/QuestionCard";
import { ReviewDrawer } from "../components/ReviewDrawer";
import { sessionStorage } from "../services/session.server";

// 2. Server-side Loader
export async function loader({ request }: LoaderFunctionArgs) {
  return thetaLoader({
    request,
    schema: propertyIntakeSchema,
    sessionStorage,
  });
}

// 3. Server-side Action
export async function action({ request }: ActionFunctionArgs) {
  return thetaAction({
    request,
    schema: propertyIntakeSchema,
    sessionStorage,
  });
}

// 4. Client Component
export default function IntakeRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const { engine, adapter, activeQuestion, stats, reviewTree, actionError } = useRemixTheta({
    loaderData,
    actionData,
  });

  const isSubmitting = navigation.state === "submitting";
  const isComplete = activeQuestion === null;

  // Find the active section title for progress indicator
  const activeSection = activeQuestion
    ? propertyIntakeSchema.sections.find((s) => s.id === activeQuestion.sectionId)
    : undefined;

  return (
    <ThetaProvider engine={engine} adapter={adapter}>
      <Layout>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          {/* Progress Bar */}
          <ProgressBar
            completed={stats.completed}
            totalEligible={stats.totalEligible}
            activeSectionTitle={activeSection?.title}
          />

          {/* Two-Column Grid: Form & Review Tree */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr minmax(300px, 340px)",
              gap: "2rem",
              alignItems: "start",
            }}
          >
            {/* Primary Content Column */}
            <div>
              {!isComplete ? (
                <QuestionCard
                  question={activeQuestion}
                  revision={engine.getRevision()}
                  actionError={actionError}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <div
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "16px",
                    padding: "2.5rem",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
                  <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                    Intake Completed Successfully!
                  </h2>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: 1.5 }}>
                    All statutory questions have been resolved and validated through the Theta DAG.
                  </p>

                  <div
                    style={{
                      textAlign: "left",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "10px",
                      padding: "1.25rem",
                      marginBottom: "2rem",
                      overflow: "auto",
                      maxHeight: "260px",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 600 }}>
                      CANONICAL DRAFT FACTS JSON
                    </div>
                    <pre style={{ fontSize: "0.85rem", color: "#a5b4fc", margin: 0 }}>
                      {JSON.stringify(engine.getState().facts, null, 2)}
                    </pre>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
                    <Form method="post">
                      <input type="hidden" name="_action" value="reset" />
                      <button
                        type="submit"
                        style={{
                          padding: "0.75rem 1.5rem",
                          borderRadius: "10px",
                          backgroundColor: "var(--brand-primary)",
                          color: "#fff",
                          border: "none",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Start New Intake
                      </button>
                    </Form>
                  </div>
                </div>
              )}
            </div>

            {/* Master Review Tree Drawer */}
            <ReviewDrawer reviewTree={reviewTree} activeQuestionId={activeQuestion?.id} />
          </div>
        </div>
      </Layout>
    </ThetaProvider>
  );
}
