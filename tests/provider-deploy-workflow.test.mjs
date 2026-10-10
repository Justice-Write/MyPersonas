import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const workflow = await readFile(path.join(root, ".github/workflows/supabase-deploy.yml"), "utf8");
const pagesWorkflow = await readFile(path.join(root, ".github/workflows/pages.yml"), "utf8");

test("provider deployment remains owner-triggered and migration-readback gated", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.match(workflow, /provider-publish/);
  assert.match(workflow, /PROVIDER-MIGRATIONS-VERIFIED/);
  assert.match(workflow, /provider migrations 065 through 076/i);
  assert.match(workflow, /Deployment blocked: SUPABASE_ACCESS_TOKEN is not configured/);
});

test("provider deployment uses an exact reviewed function allowlist", () => {
  const start = workflow.indexOf("- name: Deploy reviewed provider functions");
  const nextStep = workflow.indexOf("\n      - name:", start + 1);
  const end = nextStep < 0 ? workflow.length : nextStep;
  assert.notEqual(start, -1);
  const step = workflow.slice(start, end);
  for (const functionName of [
    "approve-post-draft",
    "meta-oauth", "meta-post", "run-post-queue",
    "twitter-oauth", "twitter-post",
    "discord-oauth", "discord-post",
    "youtube-oauth", "youtube-post",
    "tiktok-oauth", "tiktok-post",
    "twitch-oauth", "twitch-action",
    "patreon-oauth", "patreon-handoff",
    "wix-oauth", "wix-draft",
    "wordpress-oauth", "wordpress-draft",
    "reddit-oauth", "reddit-post",
    "delete-account",
  ]) assert.match(step, new RegExp(`\\b${functionName.replaceAll("-", "\\-")}\\b`));
  assert.doesNotMatch(step, /supabase functions deploy\s+--project-ref/);
});

test("image caption deployment is main-only, protected, tested, and exactly two functions", () => {
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /Validate the exact source revision before deployment[\s\S]*?npm test/);
  const start = workflow.indexOf("- name: Deploy image caption drafting functions");
  const nextStep = workflow.indexOf("\n      - name:", start + 1);
  const end = nextStep < 0 ? workflow.length : nextStep;
  assert.notEqual(start, -1);
  const step = workflow.slice(start, end);
  assert.match(step, /for function_name in ai-proxy compose-post/);
  assert.doesNotMatch(step, /media-ingest|gemini-image|functions deploy\s+--project-ref/);
  assert.doesNotMatch(workflow, /all-reviewed/);
  assert.match(workflow, /MIGRATIONS-AND-IMAGE-CAPTION-VERIFIED/);
  assert.match(workflow, /name: image-caption-backend-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /sha=%s\\nscope=image-caption-drafting\\nfunctions=ai-proxy compose-post/);
});

test("backend and Pages production releases share one non-cancelling lock", () => {
  for (const releaseWorkflow of [workflow, pagesWorkflow]) {
    assert.match(releaseWorkflow, /concurrency:\s*\n(?:\s*#[^\n]*\n)*\s*group: production-release\s*\n\s*cancel-in-progress: false/);
  }
});

test("provider-capable site deployment requires both migration ledgers", () => {
  assert.match(pagesWorkflow, /MIGRATIONS-VERIFIED/);
  assert.match(pagesWorkflow, /PROVIDER-MIGRATIONS-VERIFIED/);
  assert.match(pagesWorkflow, /provider migrations 065 through 076/i);
  assert.match(pagesWorkflow, /--include '\/cms-connector-ui\.js'/);
  assert.match(pagesWorkflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(pagesWorkflow, /Validate the exact source revision before packaging[\s\S]*npm test[\s\S]*check-frontend-syntax\.mjs/);
  assert.match(pagesWorkflow, /IMAGE-CAPTION-CANARY-VERIFIED/);
  assert.match(pagesWorkflow, /image_caption_backend_run_id/);
  assert.match(pagesWorkflow, /actions\/download-artifact@[0-9a-f]{40}/);
  assert.match(pagesWorkflow, /run-id: \$\{\{ inputs\.image_caption_backend_run_id \}\}/);
  assert.match(pagesWorkflow, /grep -Fx "sha=\$\{GITHUB_SHA\}"/);
});
