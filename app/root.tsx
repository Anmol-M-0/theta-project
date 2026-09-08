import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction, MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Theta Engine • Schema-Driven Intake" },
  { name: "description", content: "Deterministic progressive disclosure intake runtime for Remix & React" },
  { name: "viewport", content: "width=device-width, initial-scale=1" },
];

export const links: LinksFunction = () => [
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
  },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: inlineStyles }} />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const inlineStyles = `
  :root {
    --bg-primary: #090d16;
    --bg-surface: #111827;
    --bg-surface-elevated: #1e293b;
    --border-subtle: #334155;
    --border-active: #6366f1;
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --brand-primary: #6366f1;
    --brand-primary-hover: #4f46e5;
    --brand-glow: rgba(99, 102, 241, 0.25);
    --success: #10b981;
    --error: #ef4444;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4 {
    font-family: 'Outfit', sans-serif;
    letter-spacing: -0.02em;
  }

  a {
    color: var(--brand-primary);
    text-decoration: none;
    transition: color 0.2s;
  }

  a:hover {
    color: var(--brand-primary-hover);
  }

  button {
    font-family: inherit;
  }
`;
