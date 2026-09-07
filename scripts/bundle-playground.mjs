import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const playgroundDir = path.join(root, "playground");

const files = [
  "contracts.js",
  "path.js",
  "predicates.js",
  "scope.js",
  "branches.js",
  "transaction.js",
  "projections.js",
  "storage.js",
  "engine.js"
];

let bundle = `/**
 * Theta Engine - Standalone Browser Bundle
 * Zero Runtime Dependencies • Pure ES Modules
 * (c) 2026 Anmol Maniyar • MIT License
 */\n\n`;

for (const file of files) {
  let content = fs.readFileSync(path.join(srcDir, file), "utf8");
  // Strip import statements referencing relative local modules
  content = content.replace(/^import\s+[\s\S]*?from\s+["']\.\/.*?["'];?\s*$/gm, "");
  bundle += `// ==========================================\n// Module: ${file}\n// ==========================================\n` + content + "\n\n";
}

fs.writeFileSync(path.join(playgroundDir, "theta.js"), bundle, "utf8");
console.log("Successfully created self-contained playground/theta.js (" + bundle.length + " bytes)");
