import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(root, "MyPersonas.Online_v0");
const skippedDirs = new Set(["node_modules", "vendor", "Downloads"]);

async function appSources() {
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (skippedDirs.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (/\.(?:js|mjs|html)$/i.test(entry.name)) files.push(fullPath);
    }
  }
  await walk(appRoot);
  return files.sort();
}

function codeWithoutComments(line) {
  let result = "";
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      result += char;
      if (char === "\\") {
        result += line[index + 1] || "";
        index += 1;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      result += char;
      continue;
    }
    if (char === "/" && line[index + 1] === "/" && line[index - 1] !== ":") break;
    result += char;
  }
  return result;
}

function nativeDialogCalls(source) {
  const calls = [];
  const pattern = /(^|[^.\w$])(prompt|confirm)\s*\(/g;
  source.split(/\r?\n/).forEach((line, index) => {
    const code = codeWithoutComments(line);
    pattern.lastIndex = 0;
    if (pattern.test(code)) calls.push(`${index + 1}: ${line.trim()}`);
  });
  return calls;
}

test("app source has no new prompt() or confirm() calls", async () => {
  const findings = [];
  for (const file of await appSources()) {
    const calls = nativeDialogCalls(await readFile(file, "utf8"));
    for (const call of calls) findings.push(`${path.relative(root, file)}:${call}`);
  }
  assert.deepEqual(findings, [], `browser dialogs still called from app code:\n${findings.join("\n")}`);
});

test("the install prompt still uses the browser beforeinstallprompt event", async () => {
  const source = await readFile(path.join(appRoot, "pwa.js"), "utf8");
  assert.match(source, /await promptEvent\.prompt\(\)/);
  assert.deepEqual(nativeDialogCalls(source), []);
});

test("settings and destructive confirms go through the in-app dialog", async () => {
  const html = await readFile(path.join(appRoot, "index.html"), "utf8");
  assert.match(html, /function appConfirm\(message\)/);
  assert.match(html, /function appPrompt\(message,defaultValue\)/);
  assert.match(html, /className="overlay"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /if\(!await appConfirm\("Delete this post\?"\)\)return/);
  assert.match(await readFile(path.join(appRoot, "platform-governance.js"), "utf8"), /await appConfirm\(/);
  assert.match(await readFile(path.join(appRoot, "owner-app.js"), "utf8"), /await appPrompt\(/);
});
