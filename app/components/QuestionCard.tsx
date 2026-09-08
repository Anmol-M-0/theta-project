import React, { useState, useEffect } from "react";
import { Form } from "@remix-run/react";

interface QuestionCardProps {
  question: any;
  actionError?: string | null;
  isSubmitting?: boolean;
}

export function QuestionCard({ question, actionError, isSubmitting = false }: QuestionCardProps) {
  const [selectedVal, setSelectedVal] = useState<any>(question?.value ?? "");

  // Update local selection when question changes
  useEffect(() => {
    setSelectedVal(question?.value ?? "");
  }, [question?.id, question?.value]);

  if (!question) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        padding: "2rem",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
      }}
    >
      {actionError && (
        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid var(--error)",
            color: "#fca5a5",
            padding: "0.875rem 1rem",
            borderRadius: "8px",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>⚠️</span>
          <span>{actionError}</span>
        </div>
      )}

      <Form method="post" id="theta-intake-form">
        <input type="hidden" name="_action" value="commit" />
        <input type="hidden" name="questionId" value={question.id} />
        {question.path && <input type="hidden" name="path" value={question.path} />}

        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            {question.label}
          </h2>
          {question.description && (
            <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {question.description}
            </p>
          )}
        </div>

        {/* Card Select Options */}
        {question.kind === "card" && question.options && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {question.options.map((opt: any) => {
              const isChecked = String(selectedVal) === String(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "1.25rem",
                    borderRadius: "12px",
                    border: isChecked ? "2px solid var(--brand-primary)" : "1px solid var(--border-subtle)",
                    backgroundColor: isChecked ? "rgba(99, 102, 241, 0.12)" : "var(--bg-surface-elevated)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isChecked ? "0 0 15px var(--brand-glow)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "1rem", color: isChecked ? "var(--brand-primary)" : "var(--text-primary)" }}>
                      {opt.label}
                    </span>
                    <input
                      type="radio"
                      name="value"
                      value={opt.value}
                      checked={isChecked}
                      onChange={(e) => setSelectedVal(e.target.value)}
                      required
                      style={{ accentColor: "var(--brand-primary)", width: "18px", height: "18px" }}
                    />
                  </div>
                  {opt.description && (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {opt.description}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {/* Regular Select Options */}
        {question.kind === "select" && question.options && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
            {question.options.map((opt: any) => {
              const isChecked = String(selectedVal) === String(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.875rem 1.25rem",
                    borderRadius: "8px",
                    backgroundColor: isChecked ? "rgba(99, 102, 241, 0.15)" : "var(--bg-surface-elevated)",
                    border: isChecked ? "1px solid var(--brand-primary)" : "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="value"
                    value={opt.value}
                    checked={isChecked}
                    onChange={(e) => setSelectedVal(e.target.value)}
                    required
                    style={{ accentColor: "var(--brand-primary)" }}
                  />
                  <span style={{ fontSize: "0.95rem", color: isChecked ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {/* Text & Number Inputs */}
        {(question.kind === "text" || question.kind === "number") && (
          <div style={{ marginBottom: "2rem" }}>
            <input
              type={question.kind === "number" ? "number" : "text"}
              name="value"
              value={selectedVal}
              onChange={(e) => setSelectedVal(e.target.value)}
              placeholder={question.description || `Enter ${question.label}...`}
              required
              style={{
                width: "100%",
                padding: "0.875rem 1.25rem",
                borderRadius: "10px",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--brand-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
            />
          </div>
        )}

        {/* Submit Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            ⚡ Progressive Enhancement: Works with or without JavaScript
          </span>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "var(--brand-primary)",
              color: "#ffffff",
              padding: "0.75rem 1.75rem",
              borderRadius: "10px",
              border: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              boxShadow: "0 4px 14px 0 var(--brand-glow)",
              transition: "transform 0.1s ease, background-color 0.2s",
            }}
          >
            {isSubmitting ? "Persisting Fact..." : "Continue →"}
          </button>
        </div>
      </Form>
    </div>
  );
}
