import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeSchemaDiagnostics } from "../src/diagnostics.js";

describe("Theta Schema Diagnostics & Static Linter Subsystem", () => {
  test("detects clean schema without false positives", () => {
    const validSchema = {
      id: "clean_schema",
      version: 1,
      sections: [
        {
          id: "sec1",
          title: "Section 1",
          questions: [
            { id: "q_type", sectionId: "sec1", path: "entity.type", kind: "select", label: "Type" },
            {
              id: "q_cin",
              sectionId: "sec1",
              branch: "b_comp",
              path: "entity.cin",
              kind: "cin",
              label: "CIN",
              visibleWhen: { equals: { path: "entity.type", value: "company" } },
            },
          ],
        },
      ],
      branches: [
        {
          id: "b_comp",
          activation: { equals: { path: "entity.type", value: "company" } },
          ownedPaths: ["entity.cin"],
        },
      ],
    };

    const diag = analyzeSchemaDiagnostics(validSchema);
    assert.equal(diag.ok, true);
    assert.equal(diag.errors.length, 0);
    assert.equal(diag.warnings.length, 0);
  });

  test("detects dangling branch reference in question", () => {
    const invalid = {
      id: "dangling_branch_schema",
      version: 1,
      sections: [
        {
          id: "sec1",
          title: "Sec 1",
          questions: [
            { id: "q1", sectionId: "sec1", branch: "non_existent_branch", path: "entity.cin", kind: "text", label: "CIN" },
          ],
        },
      ],
    };

    const diag = analyzeSchemaDiagnostics(invalid);
    assert.equal(diag.ok, false);
    assert.equal(diag.errors.some((e) => e.code === "ERR_DANGLING_BRANCH_REF"), true);
  });

  test("detects un-owned branch question path", () => {
    const invalid = {
      id: "unowned_path_schema",
      version: 1,
      sections: [
        {
          id: "sec1",
          title: "Sec 1",
          questions: [
            { id: "q1", sectionId: "sec1", branch: "b_comp", path: "entity.taxNumber", kind: "text", label: "Tax" },
          ],
        },
      ],
      branches: [
        { id: "b_comp", activation: { equals: { path: "entity.type", value: "company" } }, ownedPaths: ["entity.cin"] },
      ],
    };

    const diag = analyzeSchemaDiagnostics(invalid);
    assert.equal(diag.ok, false);
    assert.equal(diag.errors.some((e) => e.code === "ERR_UNOWNED_BRANCH_QUESTION"), true);
  });

  test("warns on orphan owned branch path", () => {
    const schemaWithOrphan = {
      id: "orphan_path_schema",
      version: 1,
      sections: [
        {
          id: "sec1",
          title: "Sec 1",
          questions: [
            { id: "q_type", sectionId: "sec1", path: "entity.type", kind: "text", label: "Type" },
          ],
        },
      ],
      branches: [
        { id: "b_comp", activation: { equals: { path: "entity.type", value: "company" } }, ownedPaths: ["entity.unwrittenField"] },
      ],
    };

    const diag = analyzeSchemaDiagnostics(schemaWithOrphan);
    assert.equal(diag.ok, true);
    assert.equal(diag.warnings.some((w) => w.code === "WARN_ORPHAN_OWNED_PATH"), true);
  });

  test("detects contradictory static predicate equalities", () => {
    const invalid = {
      id: "contradictory_predicate_schema",
      version: 1,
      sections: [
        {
          id: "sec1",
          title: "Sec 1",
          questions: [
            { id: "q_type", sectionId: "sec1", path: "entity.type", kind: "text", label: "Type" },
            {
              id: "q_impossible",
              sectionId: "sec1",
              path: "entity.val",
              kind: "text",
              label: "Impossible",
              visibleWhen: {
                all: [
                  { equals: { path: "entity.type", value: "individual" } },
                  { equals: { path: "entity.type", value: "company" } },
                ],
              },
            },
          ],
        },
      ],
    };

    const diag = analyzeSchemaDiagnostics(invalid);
    assert.equal(diag.ok, false);
    assert.equal(diag.errors.some((e) => e.code === "ERR_CONTRADICTORY_PREDICATE"), true);
  });
});
