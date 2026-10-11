import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const owner = await readFile(new URL("../MyPersonas.Online_v0/owner-app.js", import.meta.url), "utf8");
const imageFunction = owner.slice(owner.indexOf("async function ownerAppAddImage("), owner.indexOf("async function ownerAppDeleteAnnotation("));

test("image reference awaits and trims the URL, including cancellation", async () => {
  for (const input of ["  https://example.com/image.png  ", null, "", "http://example.com/image.png"]) {
    const calls = [];
    const prompts = [input, "reviewed reference"];
    const run = new Function("appPrompt", "safeHttpUrl", "ownerAppState", "sb", "toast", "ownerAppRefreshAndReopen", `${imageFunction}; return ownerAppAddImage('brief');`);
    await run(async () => prompts.shift(), value => /^https?:\/\//.test(value), { briefs: [] },
      { rpc: async (name, args) => { calls.push({ name, args }); return {}; } }, () => {}, async () => {});
    assert.equal(calls.length, input?.trim().startsWith("https://") ? 1 : 0);
    if (calls.length) assert.equal(calls[0].args.p_image_url, "https://example.com/image.png");
  }
});

const html = await readFile(new URL("../MyPersonas.Online_v0/index.html", import.meta.url), "utf8");
const dialogSource = html.slice(html.indexOf("let appDialogChain="), html.indexOf("function pickMine("));

test("queued dialogs settle once, cancel on Escape, and restore caller focus", async () => {
  const listeners = new Map();
  const caller = { isConnected: true, focus() { document.activeElement = this; } };
  let current;
  const document = {
    activeElement: caller,
    createElement() {
      const buttons = { appDialogOk: { focus() { document.activeElement = this; } } };
      return {
        isConnected: false, handlers: {},
        addEventListener(name, fn) { this.handlers[name] = fn; },
        remove() { this.isConnected = false; current = null; },
        buttons,
      };
    },
    getElementById(id) { return current?.buttons[id]; },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
    body: { appendChild(node) { node.isConnected = true; current = node; } },
  };
  const { appConfirm, appPrompt } = new Function("document", "esc", `${dialogSource}; return {appConfirm,appPrompt};`)(document, String);
  const first = appConfirm("Delete?");
  const second = appPrompt("Value?");
  await Promise.resolve();
  const overlay = current;
  overlay.handlers.click({ target: { id: "appDialogOk" } });
  overlay.handlers.click({ target: overlay });
  assert.equal(await first, true);
  await Promise.resolve();
  assert.notEqual(current, overlay);
  listeners.get("keydown")({ key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(await second, null);
  assert.equal(document.activeElement, caller);
  assert.equal(listeners.size, 0);
});

test("confirmation overlay stays above existing application panels", () => {
  const dialogZ = Number(html.match(/#appDialogOv\{z-index:(\d+)/)[1]);
  const others = [...html.matchAll(/z-index:(\d+)/g)].map(match => Number(match[1])).filter(value => value !== dialogZ);
  assert.ok(others.every(value => value < dialogZ));
});
