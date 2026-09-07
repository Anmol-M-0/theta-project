import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateSchema, compileSchema, SUPPORTED_QUESTION_KINDS } from "../src/schema.js";

describe("Theta Schema Validation & Compilation Subsystem", () => {
  const validSchema = {
    id: "conveyance_schema",
    version: 1,
    sections: [
      {
        id: "section_parties",
        title: "Parties",
        questions: [
          {
            id: "party_count",
            sectionId: "section_parties",
            path: "parties.count",
            kind: "number",
            label: "How many parties?",
          },
          {
            id: "party_type",
            sectionId: "section_parties",
            path: "parties[$party].type",
            kind: "card",
            label: "Party Legal Type",
            options: [
              { value: "individual", label: "Individual" },
              { value: "company", label: "Company" },
            ],
          },
        ],
      },
    ],
    branches: [
      {
        id: "company_branch",
        activation: { equals: { path: "parties[$party].type", value: "company" } },
        ownedPaths: ["parties[$party].cin"],
      },
    ],
    repeaters: [
      {
        id: "parties_rep",
        collectionPath: "parties.list",
        scopeName: "party",
        itemLabel: "Party",
      },
    ],
  };

  test("validates well-formed schema cleanly", () => {
    const res = validateSchema(validSchema);
    assert.equal(res.ok, true);
    assert.equal(res.errors.length, 0);

    const compiled = compileSchema(validSchema);
    assert.equal(compiled.id, "conveyance_schema");
    assert.equal(compiled.questionsById.has("party_count"), true);
    assert.equal(compiled.questionsById.has("party_type"), true);
    assert.equal(compiled.sectionsById.has("section_parties"), true);
    assert.equal(compiled.branchesById.has("company_branch"), true);
    assert.equal(compiled.repeatersById.has("parties_rep"), true);
    assert.equal(compiled.branchDependencies.get("company_branch")[0], "parties[$party].type");
  });

  test("compileSchema generates reverse lookup pathToQuestionId and dependencies", () => {
    const compiled = compileSchema(validSchema);
    assert.equal(compiled.pathToQuestionId.get("parties.count"), "party_count");
    assert.equal(compiled.pathToQuestionId.get("parties[$party].type"), "party_type");
  });

  test("detects duplicate question IDs", () => {
    const invalid = {
      id: "dup_q",
      version: 1,
      sections: [
        {
          id: "s1",
          title: "S1",
          questions: [
            { id: "same_id", sectionId: "s1", path: "a", kind: "text", label: "Q1" },
            { id: "same_id", sectionId: "s1", path: "b", kind: "text", label: "Q2" },
          ],
        },
      ],
    };

    const res = validateSchema(invalid);
    assert.equal(res.ok, false);
    assert.equal(res.errors.some((e) => e.includes("Duplicate question id 'same_id'")), true);
    assert.throws(() => compileSchema(invalid), /Duplicate question id 'same_id'/);
  });

  test("detects duplicate section, branch, and repeater IDs", () => {
    const invalid = {
      id: "dup_all",
      version: 1,
      sections: [
        { id: "s_dup", title: "S1", questions: [] },
        { id: "s_dup", title: "S2", questions: [] },
      ],
      branches: [
        { id: "b_dup", activation: { exists: { path: "x" } }, ownedPaths: ["y"] },
        { id: "b_dup", activation: { exists: { path: "z" } }, ownedPaths: ["w"] },
      ],
      repeaters: [
        { id: "r_dup", collectionPath: "c1", scopeName: "s1", itemLabel: "L1" },
        { id: "r_dup", collectionPath: "c2", scopeName: "s2", itemLabel: "L2" },
      ],
    };

    const res = validateSchema(invalid);
    assert.equal(res.ok, false);
    assert.equal(res.errors.some((e) => e.includes("Duplicate section id 's_dup'")), true);
    assert.equal(res.errors.some((e) => e.includes("Duplicate branch id 'b_dup'")), true);
    assert.equal(res.errors.some((e) => e.includes("Duplicate repeater id 'r_dup'")), true);
  });

  test("detects unsupported question kinds", () => {
    const invalid = {
      id: "bad_kind",
      version: 1,
      sections: [
        {
          id: "s1",
          title: "S1",
          questions: [
            { id: "q1", sectionId: "s1", path: "a", kind: "unsupported_kind_xyz", label: "Q1" },
          ],
        },
      ],
    };

    const res = validateSchema(invalid);
    assert.equal(res.ok, false);
    assert.equal(res.errors.some((e) => e.includes("Invalid question kind 'unsupported_kind_xyz'")), true);
  });

  test("detects malformed predicates without operators", () => {
    const invalid = {
      id: "bad_pred",
      version: 1,
      sections: [
        {
          id: "s1",
          title: "S1",
          questions: [
            {
              id: "q1",
              sectionId: "s1",
              path: "a",
              kind: "text",
              label: "Q1",
              visibleWhen: { invalidProp: 123 },
            },
          ],
        },
      ],
    };

    const res = validateSchema(invalid);
    assert.equal(res.ok, false);
    assert.equal(res.errors.some((e) => e.includes("Predicate must contain at least one valid operator")), true);
  });

  test("validateSchema detects missing title in section", () => {
    const invalid = {
      id: "no_title",
      version: 1,
      sections: [{ id: "s1", questions: [] }],
    };
    const res = validateSchema(invalid);
    assert.equal(res.ok, false);
    assert.equal(res.errors.some((e) => e.includes("must have a non-empty title")), true);
  });
});
