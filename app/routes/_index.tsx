import React from "react";
import { Link } from "@remix-run/react";
import { Layout } from "../components/Layout";

export default function IndexRoute() {
  return (
    <Layout>
      <div style={{ maxWidth: 860, margin: "4rem auto 2rem auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.35rem 0.85rem",
            borderRadius: "9999px",
            backgroundColor: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            color: "var(--brand-primary)",
            fontSize: "0.85rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
          }}
        >
          <span>⚡</span>
          <span>Official Remix & React Batteries</span>
        </div>

        <h1 style={{ fontSize: "3.25rem", fontWeight: 800, lineHeight: 1.15, marginBottom: "1.5rem" }}>
          Deterministic, Schema-Driven Intake with{" "}
          <span style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Zero Compromises
          </span>
        </h1>

        <p style={{ fontSize: "1.2rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "2.5rem" }}>
          Theta models progressive disclosure as a pure mathematical projection over canonical facts.
          Full-stack Remix batteries handle SSR, encrypted cookie persistence, and zero-JS Progressive Enhancement.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "4rem" }}>
          <Link
            to="/intake"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "var(--brand-primary)",
              color: "#ffffff",
              padding: "0.875rem 2rem",
              borderRadius: "12px",
              fontWeight: 600,
              fontSize: "1.05rem",
              boxShadow: "0 10px 25px -5px var(--brand-glow)",
              transition: "transform 0.15s ease",
            }}
          >
            Launch Property Intake Demo →
          </Link>
          <a
            href="https://github.com/Anmol-M-0/theta-project"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.875rem 1.75rem",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "1.05rem",
            }}
          >
            Read Invariants & Docs
          </a>
        </div>

        {/* Feature Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem", textAlign: "left" }}>
          <div style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>🛡️</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Atomic Branch Invalidation</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Changing discriminators prunes stale nested facts in the same transaction tick. Zero zombie data guaranteed.
            </p>
          </div>

          <div style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>⚡</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Progressive Enhancement</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Forms submit via native HTTP POST when JS is disabled, or update reactively without page reloads when enabled.
            </p>
          </div>

          <div style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>🔒</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Request Concurrency Isolation</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Server engine contexts are request-scoped. Multiple users never share or corrupt mutable engine memory.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
