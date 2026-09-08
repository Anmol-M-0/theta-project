import React from "react";

interface ProgressBarProps {
  completed: number;
  totalEligible: number;
  activeSectionTitle?: string;
}

export function ProgressBar({ completed, totalEligible, activeSectionTitle }: ProgressBarProps) {
  const percentage = totalEligible > 0 ? Math.round((completed / totalEligible) * 100) : 0;

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div>
          {activeSectionTitle && (
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brand-primary)", fontWeight: 600 }}>
              {activeSectionTitle}
            </span>
          )}
          <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "2px" }}>
            Question {Math.min(completed + 1, totalEligible)} of {totalEligible}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {percentage}%
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "4px" }}>
            Complete
          </span>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          height: "8px",
          backgroundColor: "var(--border-subtle)",
          borderRadius: "9999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: "linear-gradient(90deg, #6366f1, #a855f7)",
            borderRadius: "9999px",
            transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}
