import { createThetaCookieSessionStorage } from "../../src/batteries/remix/index.js";

export const sessionStorage = createThetaCookieSessionStorage({
  cookieName: "theta_intake_draft",
  secret: process.env.SESSION_SECRET || "theta-remix-batteries-demo-secret-key-32chars",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});
