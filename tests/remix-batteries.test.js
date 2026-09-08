import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createThetaEngine } from "../src/index.js";
import {
  serializeThetaState,
  hydrateThetaState,
  createThetaCookieSessionStorage,
  createThetaRequestContext,
  thetaLoader,
  thetaLoaderResponse,
  thetaAction,
} from "../src/batteries/remix/index.js";

describe("Theta Remix Batteries Subsystem", () => {
  const schema = {
    id: "remix_intake_schema",
    version: 1,
    sections: [
      {
        id: "property_sec",
        title: "Property Details",
        questions: [
          {
            id: "prop_type",
            sectionId: "property_sec",
            path: "property.type",
            kind: "select",
            label: "Property Type",
            options: [
              { label: "Apartment", value: "apartment" },
              { label: "Plot", value: "plot" },
            ],
          },
          {
            id: "floor_num",
            sectionId: "property_sec",
            path: "property.apartment.floor",
            kind: "number",
            label: "Floor Number",
            visibleWhen: { equals: { path: "property.type", value: "apartment" } },
            validate: (val) => (val >= 0 && val <= 200) || "Floor number must be between 0 and 200",
          },
          {
            id: "plot_area",
            sectionId: "property_sec",
            path: "property.plot.area_sqft",
            kind: "number",
            label: "Plot Area (sqft)",
            visibleWhen: { equals: { path: "property.type", value: "plot" } },
          },
        ],
      },
    ],
    branches: [
      {
        id: "apartment_branch",
        activation: { equals: { path: "property.type", value: "apartment" } },
        ownedPaths: ["property.apartment"],
      },
      {
        id: "plot_branch",
        activation: { equals: { path: "property.type", value: "plot" } },
        ownedPaths: ["property.plot"],
      },
    ],
  };

  test("Serialization and hydration preserves canonical facts and engine invariants", () => {
    const engine1 = createThetaEngine({ schema });
    engine1.dispatch({ type: "COMMIT_ANSWER", questionId: "prop_type", value: "apartment" });
    engine1.dispatch({ type: "COMMIT_ANSWER", questionId: "floor_num", value: 12 });

    const serialized = serializeThetaState(engine1, schema);
    assert.equal(serialized.schemaId, "remix_intake_schema");
    assert.equal(serialized.version, 1);
    assert.deepEqual(serialized.facts, {
      property: {
        type: "apartment",
        apartment: { floor: 12 },
      },
    });

    // Hydrate into new instance
    const engine2 = hydrateThetaState({ schema, serializedState: serialized });
    assert.deepEqual(engine2.getState().facts, engine1.getState().facts);
    assert.equal(engine2.getActiveQuestion(), null); // All eligible questions answered
    assert.equal(engine2.getReviewTree().stats.completed, 2);
    assert.equal(engine2.getReviewTree().stats.totalEligible, 2);
  });

  test("Cookie session storage creates and verifies HMAC-SHA256 signed facts", () => {
    const storage = createThetaCookieSessionStorage({
      cookieName: "test_draft",
      secret: "super-secret-key-12345",
    });

    const initialFacts = { applicant: { name: "Alice", age: 30 } };
    const setCookie = storage.commitFacts(initialFacts);

    assert.ok(setCookie.startsWith("test_draft="));
    assert.ok(setCookie.includes("Path=/"));
    assert.ok(setCookie.includes("HttpOnly"));

    // Extract cookie value
    const cookieHeader = setCookie.split(";")[0];

    // Read back via fake Request
    const req = new Request("http://localhost:3000/intake", {
      headers: { cookie: cookieHeader },
    });

    const parsedFacts = storage.getFacts(req);
    assert.deepEqual(parsedFacts, initialFacts);

    // Tampered cookie fails signature check safely and returns {}
    const tamperedHeader = "test_draft=eyJhIjoxfQ.invalid_signature";
    const tamperedReq = new Request("http://localhost:3000/intake", {
      headers: { cookie: tamperedHeader },
    });
    assert.deepEqual(storage.getFacts(tamperedReq), {});
  });

  test("Gate: Server Request Concurrency & State Isolation (Zero Mutable Cross-Talk)", async () => {
    const storage = createThetaCookieSessionStorage({ secret: "test-secret" });

    // Request A: User selecting apartment
    const cookieA = storage.commitFacts({ property: { type: "apartment", apartment: { floor: 5 } } });
    const reqA = new Request("http://localhost:3000/intake", {
      headers: { cookie: cookieA.split(";")[0] },
    });

    // Request B: User selecting plot
    const cookieB = storage.commitFacts({ property: { type: "plot", plot: { area_sqft: 2400 } } });
    const reqB = new Request("http://localhost:3000/intake", {
      headers: { cookie: cookieB.split(";")[0] },
    });

    const ctxA = createThetaRequestContext({ request: reqA, schema, sessionStorage: storage });
    const ctxB = createThetaRequestContext({ request: reqB, schema, sessionStorage: storage });

    // Verify initial isolation
    assert.equal(ctxA.getFacts().property?.type, "apartment");
    assert.equal(ctxB.getFacts().property?.type, "plot");
    assert.equal(ctxA.getFacts().property?.plot, undefined);
    assert.equal(ctxB.getFacts().property?.apartment, undefined);

    // Mutate A concurrently
    ctxA.engine.dispatch({ type: "COMMIT_ANSWER", questionId: "floor_num", value: 14 });

    // Mutate B concurrently
    ctxB.engine.dispatch({ type: "COMMIT_ANSWER", questionId: "plot_area", value: 3600 });

    // Verify complete mutual isolation
    assert.equal(ctxA.getFacts().property?.apartment?.floor, 14);
    assert.equal(ctxB.getFacts().property?.plot?.area_sqft, 3600);
    assert.equal(ctxA.getFacts().property?.plot, undefined);
    assert.equal(ctxB.getFacts().property?.apartment, undefined);
  });

  test("thetaLoader dehydrates initial state and review tree stats", async () => {
    const storage = createThetaCookieSessionStorage({ secret: "test-secret" });
    const req = new Request("http://localhost:3000/intake");

    const data = await thetaLoader({ request: req, schema, sessionStorage: storage });
    assert.equal(data.schema.id, "remix_intake_schema");
    assert.equal(data.activeQuestion.id, "prop_type");
    assert.equal(data.stats.totalEligible, 1);
    assert.equal(data.stats.completed, 0);

    const response = await thetaLoaderResponse({ request: req, schema, sessionStorage: storage });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
    const jsonBody = await response.json();
    assert.equal(jsonBody.activeQuestion.id, "prop_type");
  });

  test("thetaAction handles Progressive Enhancement HTML Form POST and branch invalidation", async () => {
    const storage = createThetaCookieSessionStorage({ secret: "test-secret" });

    // 1. Submit answer for prop_type = apartment
    const form1 = new FormData();
    form1.set("questionId", "prop_type");
    form1.set("value", "apartment");

    const req1 = new Request("http://localhost:3000/intake", {
      method: "POST",
      body: form1,
    });

    const res1 = await thetaAction({ request: req1, schema, sessionStorage: storage });
    assert.equal(res1.status, 200);

    const cookieHeader1 = res1.headers.get("Set-Cookie");
    assert.ok(cookieHeader1);
    const body1 = await res1.json();
    assert.equal(body1.ok, true);
    assert.equal(body1.activeQuestion.id, "floor_num");

    // 2. Submit floor_num with validation failure (e.g. floor = 500 when max = 200)
    const form2 = new FormData();
    form2.set("questionId", "floor_num");
    form2.set("value", "500");

    const req2 = new Request("http://localhost:3000/intake", {
      method: "POST",
      headers: { cookie: cookieHeader1.split(";")[0] },
      body: form2,
    });

    const res2 = await thetaAction({ request: req2, schema, sessionStorage: storage });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.equal(body2.ok, false);
    assert.ok(body2.error);

    // 3. Submit valid floor_num = 7
    const form3 = new FormData();
    form3.set("questionId", "floor_num");
    form3.set("value", "7");

    const req3 = new Request("http://localhost:3000/intake", {
      method: "POST",
      headers: { cookie: cookieHeader1.split(";")[0] },
      body: form3,
    });

    const res3 = await thetaAction({ request: req3, schema, sessionStorage: storage });
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.ok, true);
    assert.equal(body3.isComplete, true);
    assert.equal(body3.activeQuestion, null);

    // 4. Atomic Branch Invalidation via Form: switch to plot
    const cookieHeader3 = res3.headers.get("Set-Cookie");
    const form4 = new FormData();
    form4.set("questionId", "prop_type");
    form4.set("value", "plot");

    const req4 = new Request("http://localhost:3000/intake", {
      method: "POST",
      headers: { cookie: cookieHeader3.split(";")[0] },
      body: form4,
    });

    const res4 = await thetaAction({ request: req4, schema, sessionStorage: storage });
    assert.equal(res4.status, 200);
    const body4 = await res4.json();
    assert.equal(body4.ok, true);
    // Floor is cleanly purged, plot_area is active!
    assert.equal(body4.facts.property.apartment, undefined);
    assert.equal(body4.activeQuestion.id, "plot_area");
  });

  test("thetaAction handles session reset cleanly with redirect", async () => {
    const storage = createThetaCookieSessionStorage({ secret: "test-secret" });
    const form = new FormData();
    form.set("_action", "reset");

    const req = new Request("http://localhost:3000/intake", {
      method: "POST",
      body: form,
    });

    const res = await thetaAction({
      request: req,
      schema,
      sessionStorage: storage,
      redirectTo: "/intake",
    });

    assert.equal(res.status, 303);
    assert.equal(res.headers.get("Location"), "/intake");
    assert.ok(res.headers.get("Set-Cookie").includes("Max-Age=0"));
  });
});
