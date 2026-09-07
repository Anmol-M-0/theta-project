import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateTypeScript } from "../src/codegen.js";

describe("Theta Schema-to-TypeScript Code Generator Subsystem", () => {
  const schema = {
    id: "codegen_test_schema",
    version: 1,
    sections: [
      {
        id: "sec_property",
        title: "Property",
        questions: [
          { id: "q_prop_type", sectionId: "sec_property", path: "property.type", kind: "select", label: "Type", options: [{ label: "Flat", value: "flat" }] },
          { id: "q_area", sectionId: "sec_property", path: "property.flat.area", kind: "number", label: "Area" },
          { id: "q_is_resale", sectionId: "sec_property", path: "property.isResale", kind: "boolean", label: "Resale" },
          { id: "q_party_name", sectionId: "sec_property", path: "parties[$party].name", kind: "text", label: "Party Name" },
          { id: "q_party_age", sectionId: "sec_property", path: "parties[$party].age", kind: "number", label: "Party Age" },
          { id: "q_director_pan", sectionId: "sec_property", path: "parties[$party].directors[$director].pan", kind: "pan", label: "Director PAN" },
        ],
      },
    ],
    branches: [
      { id: "b_flat", activation: { equals: { path: "property.type", value: "flat" } }, ownedPaths: ["property.flat.area"] },
    ],
    repeaters: [
      { id: "rep_parties", collectionPath: "parties", scopeName: "party", label: "Parties" },
      { id: "rep_directors", collectionPath: "parties[$party].directors", scopeName: "director", label: "Directors" },
    ],
  };

  test("generateTypeScript emits deterministic type definitions matching schema and repeaters", () => {
    const ts1 = generateTypeScript(schema);
    const ts2 = generateTypeScript(schema);

    // Invariant I7: Deterministic Codegen
    assert.equal(ts1, ts2, "Generated TypeScript must be byte-identical on repeated calls");

    // Invariant I8: Generated Type Completeness
    assert.equal(ts1.includes(`"q_prop_type"`), true);
    assert.equal(ts1.includes(`"q_area"`), true);
    assert.equal(ts1.includes(`"q_is_resale"`), true);
    assert.equal(ts1.includes(`"q_party_name"`), true);
    assert.equal(ts1.includes(`"q_party_age"`), true);
    assert.equal(ts1.includes(`"q_director_pan"`), true);
    assert.equal(ts1.includes(`"b_flat"`), true);
    assert.equal(ts1.includes(`"rep_parties"`), true);
    assert.equal(ts1.includes(`"rep_directors"`), true);

    // Invariant I9: No phantom IDs
    assert.equal(ts1.includes(`"q_nonexistent"`), false);

    // Fact property structure & Repeater topologies
    assert.equal(ts1.includes("property?: {"), true);
    assert.equal(ts1.includes("area?: number;"), true);
    assert.equal(ts1.includes("isResale?: boolean;"), true);

    // Repeater types
    assert.equal(ts1.includes("parties?: Array<{"), true);
    assert.equal(ts1.includes("age?: number;"), true);
    assert.equal(ts1.includes("name?: string;"), true);
    assert.equal(ts1.includes("directors?: Array<{"), true);
    assert.equal(ts1.includes("pan?: string;"), true);
  });

  test("Adversarial safety: handles quotes, backslashes, hyphens, spaces, and comment breakout safely", () => {
    const adversarialSchema = {
      id: "adversarial_schema*/inject",
      version: 1,
      sections: [
        {
          id: "sec_adv",
          title: "Adversarial",
          questions: [
            { id: "q_quote\"test", sectionId: "sec_adv", path: "applicant-info.first name", kind: "text", label: "First Name" },
            { id: "q_slash\\test", sectionId: "sec_adv", path: "applicant-info.contact-numbers", kind: "multiselect", label: "Contacts" },
          ],
        },
      ],
      branches: [
        { id: "b_quote\"branch", activation: { exists: { path: "applicant-info.first name" } } },
      ],
      repeaters: [
        { id: "rep_space repeater", collectionPath: "special items", scopeName: "item" },
      ],
    };

    const ts = generateTypeScript(adversarialSchema);

    // Escaped comment header
    assert.equal(ts.includes(`Schema ID: adversarial_schema*\\/inject`), true);

    // Escaped string literals in unions
    assert.equal(ts.includes(`"q_quote\\\"test"`), true);
    assert.equal(ts.includes(`"q_slash\\\\test"`), true);
    assert.equal(ts.includes(`"b_quote\\\"branch"`), true);
    assert.equal(ts.includes(`"rep_space repeater"`), true);

    // Quoted property keys in interfaces
    assert.equal(ts.includes(`"applicant-info"?: {`), true);
    assert.equal(ts.includes(`"first name"?: string;`), true);
    assert.equal(ts.includes(`"contact-numbers"?: string[];`), true);
  });

  test("Collision detection: throws descriptive error on leaf vs object collision", () => {
    const collidingSchema = {
      id: "colliding_schema",
      version: 1,
      sections: [
        {
          id: "sec_col",
          title: "Collision",
          questions: [
            { id: "q_leaf", sectionId: "sec_col", path: "applicant", kind: "text", label: "Applicant" },
            { id: "q_child", sectionId: "sec_col", path: "applicant.name", kind: "text", label: "Applicant Name" },
          ],
        },
      ],
    };

    assert.throws(
      () => generateTypeScript(collidingSchema),
      /Schema path collision.*conflicts with existing leaf/
    );
  });

  test("Collision detection: throws descriptive error on array vs object collision", () => {
    const collidingSchema = {
      id: "colliding_array_schema",
      version: 1,
      sections: [
        {
          id: "sec_col",
          title: "Collision",
          questions: [
            { id: "q_arr", sectionId: "sec_col", path: "items[$item].name", kind: "text", label: "Name" },
            { id: "q_obj", sectionId: "sec_col", path: "items.name", kind: "text", label: "Item Name" },
          ],
        },
      ],
    };

    assert.throws(
      () => generateTypeScript(collidingSchema),
      /Schema path collision.*expected (array|object) container/
    );
  });
});
