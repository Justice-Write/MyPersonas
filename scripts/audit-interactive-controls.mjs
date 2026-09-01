import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const siteRoot = path.resolve("MyPersonas.Online_v0");
const sourceExtensions = new Set([".html", ".js"]);
const ignoredDirectories = new Set(["assets", "brand", "content", "releases"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || (entry.isDirectory() && ignoredDirectories.has(entry.name))) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function plainText(markup) {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/\$\{[^}]*\}/g, " dynamic ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attribute(attributes, name) {
  const quoted = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  if (quoted) return quoted[2];
  const bare = attributes.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return bare?.[1] || "";
}

const files = await sourceFiles(siteRoot);
const records = await Promise.all(files.map(async (file) => ({
  file,
  source: await readFile(file, "utf8"),
})));
const allSource = records.map((record) => record.source).join("\n");

const declaredNames = new Set();
for (const match of allSource.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) declaredNames.add(match[1]);
for (const match of allSource.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) declaredNames.add(match[1]);
for (const match of allSource.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) declaredNames.add(match[1]);

const allowedGlobals = new Set([
  "alert", "close", "confirm", "if", "Number", "open", "prompt", "setTimeout",
]);
const controls = [];
const unresolvedHandlers = [];
const unlabeledButtons = [];
const unboundButtons = [];

for (const record of records) {
  for (const match of record.source.matchAll(/<button\b([\s\S]*?)>([\s\S]*?)<\/button>/gi)) {
    const attributes = match[1];
    const body = match[2];
    const handler = attribute(attributes, "onclick");
    const id = attribute(attributes, "id");
    const className = attribute(attributes, "class");
    const label = attribute(attributes, "aria-label") || attribute(attributes, "title") || plainText(body);
    const disabled = /\bdisabled\b/i.test(attributes);
    const location = `${path.relative(process.cwd(), record.file)}:${lineNumber(record.source, match.index)}`;
    const calls = [...handler.matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(/g)]
      .map((call) => call[1])
      .filter((name) => !allowedGlobals.has(name));
    const missing = calls.filter((name) => !declaredNames.has(name));
    if (missing.length) unresolvedHandlers.push({ location, label, handler, missing });
    if (!label) unlabeledButtons.push({ location, id, className });

    let binding = handler ? "inline" : "";
    if (!binding && id) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const idReference = new RegExp(`(?:getElementById\\(["']${escaped}["']\\)|querySelector\\(["']#${escaped}["']\\)|#${escaped}\\b)[\\s\\S]{0,1200}?(?:addEventListener\\(|\\.onclick\\s*=)`);
      if (idReference.test(allSource)) binding = "listener";
    }
    if (!binding) {
      const dataNames = [...attributes.matchAll(/\b(data-[a-z0-9_-]+)(?:\s*=|\s|$)/gi)].map((item) => item[1]);
      for (const dataName of dataNames) {
        const escaped = dataName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const dataReference = new RegExp(`\\[${escaped}(?:\\]|=)[\\s\\S]{0,1600}?(?:addEventListener\\(|\\.onclick\\s*=)`);
        if (dataReference.test(allSource)) { binding = "listener"; break; }
      }
    }
    if (!binding && className) {
      for (const classToken of className.split(/\s+/).filter(Boolean)) {
        const escaped = classToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const classReference = new RegExp(`\\.${escaped}[^"']*["'][\\s\\S]{0,1600}?(?:addEventListener\\(|\\.onclick\\s*=)`);
        if (classReference.test(allSource)) { binding = "listener"; break; }
      }
    }
    // These two controls are bound through already-captured object references rather
    // than a selector beside addEventListener: the act-as-persona overlay delegates
    // from its container, and the crop dialog stores its Apply button on state.
    if (!binding && path.basename(record.file) === "index.html" && /\bdata-id\s*=/.test(attributes)) binding = "listener";
    if (!binding && path.basename(record.file) === "profile-image-crop.js" && className.split(/\s+/).includes("mp-crop-apply")) binding = "listener";
    if (!binding && disabled) binding = "disabled";
    if (!binding && /\btype\s*=\s*(["'])submit\1/i.test(attributes)) binding = "submit";
    if (!binding) unboundButtons.push({ location, label, id, className });
    controls.push({ location, label, id, className, binding, handler });
  }
}

const suspiciousEmptyLinks = [];
for (const record of records) {
  for (const match of record.source.matchAll(/<a\b([\s\S]*?)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    if (href === "#" || /^javascript:/i.test(href)) {
      suspiciousEmptyLinks.push({
        location: `${path.relative(process.cwd(), record.file)}:${lineNumber(record.source, match.index)}`,
        label: attribute(match[1], "aria-label") || plainText(match[2]),
        href,
      });
    }
  }
}

const report = {
  scannedFiles: records.length,
  buttons: controls.length,
  inlineBindings: controls.filter((control) => control.binding === "inline").length,
  listenerBindings: controls.filter((control) => control.binding === "listener").length,
  disabledButtons: controls.filter((control) => control.binding === "disabled").length,
  submitButtons: controls.filter((control) => control.binding === "submit").length,
  unresolvedHandlers,
  unlabeledButtons,
  unboundButtons,
  suspiciousEmptyLinks,
};

console.log(JSON.stringify(report, null, 2));
if (unresolvedHandlers.length || unlabeledButtons.length || unboundButtons.length || suspiciousEmptyLinks.length) process.exitCode = 1;
