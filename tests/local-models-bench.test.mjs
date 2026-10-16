// Browser-direct local model bench: loopback-only, never a hosted backend.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const root = new URL("../MyPersonas.Online_v0/", import.meta.url);
const source = await readFile(new URL("local-models.js", root), "utf8");
const html = await readFile(new URL("index.html", root), "utf8");

function internals() {
  const window = {};
  vm.runInNewContext(source, { window, URL, localStorage: { getItem: () => null, setItem() {} } });
  return window.__localModelsInternals;
}

test("bench accepts only loopback hosts", () => {
  const { loopbackBase } = internals();
  assert.equal(loopbackBase("http://localhost:1234/v1"), "http://localhost:1234/v1");
  assert.equal(loopbackBase("http://127.0.0.1:11434/v1/"), "http://127.0.0.1:11434/v1");
  assert.equal(loopbackBase("http://[::1]:1234/v1"), "http://[::1]:1234/v1");
  for (const bad of [
    "http://192.168.1.20:1234/v1",
    "http://0.0.0.0:11434/v1",
    "https://api.openai.com/v1",
    "http://localhost.evil.example:1234/v1",
    "http://user:pw@localhost:1234/v1",
    "http://localhost:1234/v1?x=1",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(loopbackBase(bad), null, bad);
  }
});

test("bench never touches Supabase or stores keys", () => {
  const code = source.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /functions\/v1|supabase|sb\.rpc|create_ai_backend|Authorization/i);
  assert.doesNotMatch(code, /api_key|apiKey/);
});

test("local providers stay unsaveable as hosted backends and open the bench instead", () => {
  for (const key of ["ollama", "lmstudio"]) {
    const line = html.split("\n").find((l) => l.trimStart().startsWith(key + ":{name:"));
    assert.ok(line, key);
    assert.match(line, /unsupported:true/);
    assert.match(line, /local:true/);
  }
  assert.match(html, /if\(pdef\.unsupported\)\{toast\(/, "addBackend still refuses unsupported providers");
  assert.match(html, /<script src="\.\/local-models\.js\?v=\d{8}-\d"><\/script>/);
  assert.match(html, /id="localBenchHost"/);
});
