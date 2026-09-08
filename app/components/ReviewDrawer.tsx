import React from "react";
import { Form } from "@remix-run/react";

interface ReviewDrawerProps {
  reviewTree: any;
  activeQuestionId?: string;
}

export function ReviewDrawer({ reviewTree, activeQuestionId }: ReviewDrawerProps) {
  if (!reviewTree || !reviewTree.sections) return null;

  return (
    <aside
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        padding: "1.5rem",
        height: "fit-content",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>
          Master Review Tree
        </h3>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "0.25rem 0.6rem",
            borderRadius: "9999px",
            backgroundColor: "rgba(99, 102, 241, 0.15)",
            color: "var(--brand-primary)",
          }}
        >
          Live DAG
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {reviewTree.sections.map((sec: any) => (
          <div key={sec.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                {sec.title}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {sec.completedCount}/{sec.eligibleCount}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {sec.questions?.map((node: any) => {
                const isActive = node.questionId === activeQuestionId;
                const isComplete = node.status === "complete";
                const isNA = node.status === "not-applicable";

                return (
                  <div
                    key={node.id || node.questionId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "6px",
                      backgroundColor: isActive ? "rgba(99, 102, 241, 0.12)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--brand-primary)" : "3px solid transparent",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                      <span>
                        {isComplete ? "✅" : isNA ? "⚪" : "⏳"}
                      </span>
                      <span
                        style={{
                          color: isNA ? "var(--text-muted)" : isActive ? "var(--text-primary)" : "var(--text-secondary)",
                          textDecoration: isNA ? "line-through" : "none",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "180px",
                        }}
                        title={node.label}
                      >
                        {node.label}
                      </span>
                    </div>

                    {isComplete && !isActive && (
                      <Form method="post" style={{ margin: 0 }}>
                        <input type="hidden" name="_action" value="jump" />
                        <input type="hidden" name="questionId" value={node.questionId} />
                        <button
                          type="submit"
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--brand-primary)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          Edit
                        </button>
                      </Form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
        <Form method="post" style={{ margin: 0 }}>
          <input type="hidden" name="_action" value="reset" />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "8px",
              backgroundColor: "transparent",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              cursor: "pointer",
              transition: "color 0.2s, border-color 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "var(--error)";
              e.currentTarget.style.borderColor = "var(--error)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          >
            Reset Intake Draft
          </button>
        </Form>
      </div>
    </aside>
  );
}
