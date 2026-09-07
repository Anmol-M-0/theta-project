import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePathPattern,
  pathsOverlap,
  topologicalSort,
  buildDependencyDAG,
  getAffectedBranches,
  getTransitiveAffectedBranches,
  getAffectedQuestions,
  getQuestionsForBranches,
} from "../src/dag.js";

describe("Theta Compiled Dependency DAG Subsystem", () => {
  test("normalizePathPattern creates canonical wildcard paths for scopes while preserving concrete indices", () => {
    assert.equal(normalizePathPattern("parties[0].type"), "parties[0].type");
    assert.equal(normalizePathPattern("parties[$party].directors[$director].din"), "parties[*].directors[*].din");
    assert.equal(normalizePathPattern("property.flat.carpetArea"), "property.flat.carpetArea");
    assert.equal(normalizePathPattern(""), "");
  });

  test("pathsOverlap enforces repeater instance isolation while supporting wildcards & containers", () => {
    // Exact
    assert.equal(pathsOverlap("entity.type", "entity.type"), true);
    assert.equal(pathsOverlap("entity.type", "entity.cin"), false);

    // Concrete Instance Isolation (P0 Requirement: parties[0] != parties[1])
    assert.equal(pathsOverlap("parties[0].name", "parties[1].name"), false);
    assert.equal(pathsOverlap("parties[0].name", "parties[0].name"), true);
    assert.equal(pathsOverlap("parties[0]", "parties[1].name"), false);
    assert.equal(pathsOverlap("parties[0]", "parties[0].name"), true);

    // Wildcard Overlap (parties[i] matches wildcard pattern parties[*].name)
    assert.equal(pathsOverlap("parties[0].name", "parties[*].name"), true);
    assert.equal(pathsOverlap("parties[1].name", "parties[*].name"), true);
    assert.equal(pathsOverlap("parties[0].name", "directors[*].name"), false);

    // Ancestor mutation (container mutation affects child dependency)
    assert.equal(pathsOverlap("parties[0]", "parties[*].name"), true);
    assert.equal(pathsOverlap("parties", "parties[*].name"), true);
    assert.equal(pathsOverlap("parties", "parties[0].name"), true);
    assert.equal(pathsOverlap("entity", "entity.cin"), true);

    // Descendant mutation (child field mutation affects container dependency)
    assert.equal(pathsOverlap("parties[0].name", "parties[*]"), true);
    assert.equal(pathsOverlap("parties[0].name", "parties"), true);
  });

  test("topologicalSort sorts acyclic graphs and detects cycles accurately", () => {
    // Acyclic graph: A -> B -> C
    const acyclic = new Map([
      ["A", new Set(["B"])],
      ["B", new Set(["C"])],
      ["C", new Set()],
    ]);
    const { order, hasCycle } = topologicalSort(acyclic);
    assert.equal(hasCycle, false);
    assert.deepEqual(order, ["A", "B", "C"]);

    // Cyclic graph: A -> B -> A
    const cyclic = new Map([
      ["A", new Set(["B"])],
      ["B", new Set(["A"])],
    ]);
    const res = topologicalSort(cyclic);
    assert.equal(res.hasCycle, true);
  });

  test("buildDependencyDAG indexes branch and question dependencies", () => {
    const schema = {
      id: "test_dag_schema",
      version: 1,
      sections: [
        {
          id: "sec1",
          title: "Section 1",
          questions: [
            {
              id: "q_entity_type",
              sectionId: "sec1",
              path: "entity.type",
              kind: "select",
              label: "Entity Type",
            },
            {
              id: "q_cin",
              sectionId: "sec1",
              branch: "branch_company",
              path: "entity.cin",
              kind: "cin",
              label: "Corporate CIN",
              visibleWhen: { equals: { path: "entity.type", value: "company" } },
            },
            {
              id: "q_partner_din",
              sectionId: "sec1",
              path: "partners[$partner].din",
              kind: "text",
              label: "Director DIN",
              visibleWhen: { equals: { path: "partners[$partner].isDirector", value: true } },
            },
          ],
        },
      ],
      branches: [
        {
          id: "branch_company",
          activation: { equals: { path: "entity.type", value: "company" } },
          ownedPaths: ["entity.cin", "entity.isSez"],
        },
        {
          id: "branch_sez",
          activation: { equals: { path: "entity.isSez", value: true } },
          ownedPaths: ["entity.sezCode"],
        },
      ],
    };

    const dag = buildDependencyDAG(schema);

    // Verify pathToBranches
    assert.equal(dag.pathToBranches.get("entity.type").has("branch_company"), true);
    assert.equal(dag.pathToBranches.get("entity.isSez").has("branch_sez"), true);

    // Verify branch-to-branch dependency graph (branch_company owns entity.isSez which branch_sez reads)
    assert.equal(dag.branchGraph.get("branch_company").has("branch_sez"), true);
    assert.deepEqual(dag.topologicalOrder, ["branch_company", "branch_sez"]);
    assert.equal(dag.hasCycle, false);

    // Verify branchToQuestions
    assert.equal(dag.branchToQuestions.get("branch_company").has("q_cin"), true);
    assert.deepEqual(Array.from(getQuestionsForBranches(dag, ["branch_company"])), ["q_cin"]);

    // Verify pathToQuestions
    assert.equal(dag.pathToQuestions.get("entity.type").has("q_cin"), true);
    assert.equal(dag.pathToQuestions.get("partners[*].isDirector").has("q_partner_din"), true);

    // Query affected branches (exact & ancestor)
    const affectedBranches = getAffectedBranches(dag, ["entity.type"]);
    assert.equal(affectedBranches.has("branch_company"), true);

    // Query transitive affected branches
    const transitive = getTransitiveAffectedBranches(dag, ["branch_company"]);
    assert.deepEqual(transitive, ["branch_company", "branch_sez"]);

    // Query affected questions (exact & wildcard)
    const affectedQ = getAffectedQuestions(dag, ["partners[0].isDirector"]);
    assert.equal(affectedQ.has("q_partner_din"), true);

    // Query parent container mutation affects child question
    const affectedContainer = getAffectedQuestions(dag, ["partners"]);
    assert.equal(affectedContainer.has("q_partner_din"), true);
  });

  test("buildDependencyDAG throws immediately when schema contains cyclic branch dependencies", () => {
    const cyclicSchema = {
      id: "cyclic_schema",
      version: 1,
      sections: [
        {
          id: "sec1",
          title: "Section 1",
          questions: [
            { id: "q1", sectionId: "sec1", path: "a", kind: "text", label: "A" },
            { id: "q2", sectionId: "sec1", path: "b", kind: "text", label: "B" },
          ],
        },
      ],
      branches: [
        { id: "b1", activation: { equals: { path: "b", value: true } }, ownedPaths: ["a"] },
        { id: "b2", activation: { equals: { path: "a", value: true } }, ownedPaths: ["b"] },
      ],
    };

    assert.throws(() => buildDependencyDAG(cyclicSchema), /Cyclic branch dependency/);
  });
});
