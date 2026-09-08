import React from "react";
import { Link } from "@remix-run/react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "rgba(17, 24, 39, 0.85)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "1rem 2rem",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>⚡</span>
            <div>
              <Link to="/" style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>
                Theta Engine
              </Link>
              <span
                style={{
                  marginLeft: "0.5rem",
                  fontSize: "0.7rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  backgroundColor: "rgba(99, 102, 241, 0.2)",
                  color: "var(--brand-primary)",
                  fontWeight: 600,
                }}
              >
                Remix Battery v0.5.0
              </span>
            </div>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Link to="/intake" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
              Live Intake
            </Link>
            <a
              href="https://github.com/Anmol-M-0/theta-project"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}
            >
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "1.5rem 2rem",
          backgroundColor: "var(--bg-surface)",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          textAlign: "center",
        }}
      >
        <p>Theta Engine • Deterministic Intake Runtime & Question DAG • Zero Runtime Dependencies</p>
      </footer>
    </div>
  );
}
