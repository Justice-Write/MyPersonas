// Drift guard: the owner UI's provider catalog and the hosted endpoint policy
// must agree. Every hosted catalog entry has to resolve through the server
// policy, every policy host has to be reachable from the catalog, and retired
// model hints must not creep back in.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  resolveAiProviderEndpoint,
  resolveAiProviderModelsEndpoint,
} from "../supabase/functions/_shared/ai-provider-endpoint.ts";

const html = await readFile(new URL("../MyPersonas.Online_v0/index.html", import.meta.url), "utf8");

function catalog() {
  const start = html.indexOf("const AI_PROVIDERS=");
  assert.notEqual(start, -1, "AI_PROVIDERS catalog missing");
  const end = html.indexOf("\n};", start);
  const body = html.slice(start, end + 3);
  const entries = {};
  for (const match of body.matchAll(/^\s{2}(\w+):\{name:"([^"]*)",base:"([^"]*)"([^\n]*)$/gm)) {
    const [, key, name, base, rest] = match;
    entries[key] = {
      name,
      base,
      unsupported: /unsupported:true/.test(rest),
      modelHint: (rest.match(/modelHint:"([^"]*)"/) || [])[1] || "",
    };
  }
  assert.ok(Object.keys(entries).length >= 12, "catalog parse found too few entries");
  return entries;
}

function builtInHosts() {
  const match = html.match(/const BUILTIN_AUTOMATION_AI_HOSTS=new Set\(\[([^\]]*)\]\)/);
  assert.ok(match, "BUILTIN_AUTOMATION_AI_HOSTS missing");
  return new Set(match[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean));
}

test("every hosted catalog entry resolves through the server endpoint policy", () => {
  const entries = catalog();
  const hosts = builtInHosts();
  for (const [key, entry] of Object.entries(entries)) {
    if (entry.unsupported || key === "custom") continue;
    const base = key === "azure"
      ? entry.base.replace("YOUR-RESOURCE", "example").replace("YOUR-DEPLOYMENT", "gpt-6-luna")
      : entry.base;
    const extra = key === "azure" ? { api_version: "2024-06-01" } : null;
    const chat = resolveAiProviderEndpoint({ provider: key, baseUrl: base, extra });
    assert.ok(!("error" in chat), `${key}: ${"error" in chat ? chat.code : ""}`);
    assert.ok(key === "azure" || hosts.has(chat.host), `${key}: host ${chat.host} missing from BUILTIN_AUTOMATION_AI_HOSTS`);
    const models = resolveAiProviderModelsEndpoint({ provider: key, baseUrl: base, extra });
    assert.ok(!("error" in models), `${key}: models endpoint ${"error" in models ? models.code : ""}`);
    if (models.listable) {
      assert.equal(models.url.hostname, chat.host, `${key}: models endpoint must stay on the policy host`);
      assert.match(models.url.pathname, /models$/, `${key}: models path`);
    } else {
      assert.equal(key, "perplexity", `${key}: only Perplexity lacks a model list`);
    }
  }
});

test("local and voice providers stay out of hosted automation", () => {
  const entries = catalog();
  for (const key of ["ollama", "lmstudio", "elevenlabs"]) {
    assert.ok(entries[key]?.unsupported, `${key} must stay flagged unsupported for hosted text`);
    const result = resolveAiProviderEndpoint({ provider: key, baseUrl: "https://example.com/v1" });
    assert.ok("error" in result && result.code === "backend_provider_unsupported", key);
  }
  const hosts = builtInHosts();
  assert.equal(hosts.has("localhost"), false);
  assert.equal(hosts.has("127.0.0.1"), false);
});

test("model hints do not name retired model ids", () => {
  const entries = catalog();
  const retired = [
    "grok-2", "gpt-4o", "gpt-4-", "claude-3", "-latest", "gemini-1.5", "gemini-2.0",
    "llama-3.3-70b-versatile", "command-r-plus",
  ];
  for (const [key, entry] of Object.entries(entries)) {
    if (key === "anthropic") {
      // The Anthropic hint intentionally warns that -latest aliases no longer exist.
      assert.match(entry.modelHint, /no -latest aliases/);
      assert.doesNotMatch(entry.modelHint, /claude-3/);
      continue;
    }
    for (const token of retired) {
      assert.equal(entry.modelHint.includes(token), false, `${key} hint still names ${token}`);
    }
  }
});

test("provider defaults use current hostnames and roots", () => {
  const entries = catalog();
  assert.equal(entries.together.base, "https://api.together.ai/v1");
  assert.equal(entries.deepseek.base, "https://api.deepseek.com");
  // Legacy saved records keep resolving.
  assert.ok(!("error" in resolveAiProviderEndpoint({ provider: "together", baseUrl: "https://api.together.xyz/v1" })));
  assert.ok(!("error" in resolveAiProviderEndpoint({ provider: "deepseek", baseUrl: "https://api.deepseek.com/v1" })));
});

test("model list endpoint never widens the host policy", () => {
  for (const [provider, baseUrl] of [
    ["openai", "https://evil.example/v1"],
    ["xai", "https://api.x.ai:8443/v1"],
    ["google", "https://generativelanguage.googleapis.com/v1beta/openai/../admin"],
  ]) {
    const result = resolveAiProviderModelsEndpoint({ provider, baseUrl });
    assert.ok("error" in result, `${provider} ${baseUrl} should be refused`);
  }
  const azure = resolveAiProviderModelsEndpoint({
    provider: "azure",
    baseUrl: "https://example.openai.azure.com/openai/deployments/gpt-6-luna",
    extra: { api_version: "2024-06-01" },
  });
  assert.ok(!("error" in azure) && azure.listable);
  assert.equal(azure.url.pathname, "/openai/models");
  assert.equal(azure.url.searchParams.get("api-version"), "2024-06-01");
});
