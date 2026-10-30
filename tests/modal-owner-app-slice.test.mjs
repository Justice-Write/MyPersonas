import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../MyPersonas.Online_v0/index.html", import.meta.url), "utf8");
const owner = await readFile(new URL("../MyPersonas.Online_v0/owner-app.js", import.meta.url), "utf8");
const dialogSource = html.slice(html.indexOf("let appDialogChain="), html.indexOf("const PERSONA_FIELD_GUIDES="));

function nativeDialogCalls(source) {
  return [...source.matchAll(/(^|[^.\w$])(?:(?:window|globalThis|self)\s*\.\s*)?(prompt|confirm|alert)\s*\(/gm)]
    .map((match) => match[2]);
}

function createDialogDocument() {
  let document;
  class Element {
    constructor(id = "") {
      this.id = id;
      this.inert = false;
      this.isConnected = true;
      this.attributes = new Map();
      this.handlers = new Map();
    }
    hasAttribute(name) { return this.attributes.has(name); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === "inert") this.inert = true; }
    removeAttribute(name) { this.attributes.delete(name); if (name === "inert") this.inert = false; }
    addEventListener(name, handler) { this.handlers.set(name, handler); }
    focus() { document.activeElement = this; }
  }

  const main = new Element("main");
  main.setAttribute("aria-hidden", "false");
  const header = new Element("header");
  header.setAttribute("inert", "");
  const listeners = new Map();
  const body = {
    children: [main, header],
    appendChild(overlay) { overlay.isConnected = true; this.children.push(overlay); },
  };
  document = {
    activeElement: main,
    body,
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
    createElement() {
      const overlay = new Element("appDialogOv");
      const dialog = new Element("dialog");
      const input = new Element("appDialogInput");
      input.value = "";
      const cancel = new Element("appDialogCancel");
      const ok = new Element("appDialogOk");
      let source = "";
      Object.defineProperty(overlay, "innerHTML", {
        get() { return source; },
        set(value) {
          source = value;
          const match = value.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
          input.value = match?.[1] || "";
        },
      });
      dialog.querySelectorAll = () => source.includes("appDialogInput") ? [input, cancel, ok] : [cancel, ok];
      dialog.contains = (element) => dialog.querySelectorAll().includes(element);
      overlay.querySelector = (selector) => ({
        '[role="dialog"]': dialog,
        "#appDialogInput": input,
        "#appDialogCancel": cancel,
        "#appDialogOk": ok,
      })[selector] || null;
      overlay.remove = () => {
        overlay.isConnected = false;
        const index = body.children.indexOf(overlay);
        if (index >= 0) body.children.splice(index, 1);
      };
      overlay.controls = { dialog, input, cancel, ok };
      return overlay;
    },
  };
  return { document, main, header, listeners, current: () => body.children.find((element) => element.id === "appDialogOv") };
}

test("owner-app routes exactly its nine native dialogs through the scoped async framework", () => {
  assert.deepEqual(nativeDialogCalls(owner), []);
  const calls = [...owner.matchAll(/\bapp(?:Prompt|Confirm)\s*\(/g)];
  assert.equal(calls.length, 9);
  const confirms = owner.split(/\r?\n/).filter((line) => line.includes("appConfirm("));
  assert.equal(confirms.length, 6);
  confirms.forEach((line) => {
    assert.match(line, /await appConfirm\(/);
    assert.match(line, /destructive:\s*(?:true|false)/);
  });
  assert.match(owner, /function ownerAppDialogSnapshotCurrent\(/);
  assert.match(owner, /ownerAppDialogEntityCurrent\(/);
});

test("destructive dialogs focus cancel and restore inert, aria-hidden, listeners, and caller focus", async () => {
  const env = createDialogDocument();
  const api = new Function("document", "esc", `${dialogSource}; return { appConfirm, appPrompt, abortAppDialogs };`)(env.document, String);
  const result = api.appConfirm("Delete?", { destructive: true, confirmLabel: "Delete" });
  await Promise.resolve();
  const overlay = env.current();
  assert.ok(overlay);
  assert.equal(env.document.activeElement, overlay.controls.cancel);
  assert.equal(env.main.inert, true);
  assert.equal(env.main.getAttribute("aria-hidden"), "true");
  assert.equal(env.header.inert, true);
  assert.equal(env.header.getAttribute("aria-hidden"), "true");
  overlay.handlers.get("click")({ target: overlay.controls.ok, preventDefault() {}, stopPropagation() {} });
  assert.equal(await result, true);
  assert.equal(env.current(), undefined);
  assert.equal(env.main.inert, false);
  assert.equal(env.main.getAttribute("aria-hidden"), "false");
  assert.equal(env.header.inert, true);
  assert.equal(env.header.hasAttribute("inert"), true);
  assert.equal(env.header.hasAttribute("aria-hidden"), false);
  assert.equal(env.listeners.size, 0);
  assert.equal(env.document.activeElement, env.main);
});

test("external teardown aborts active and queued dialogs, then the queue recovers", async () => {
  const env = createDialogDocument();
  const api = new Function("document", "esc", `${dialogSource}; return { appConfirm, appPrompt, abortAppDialogs };`)(env.document, String);
  const first = api.appConfirm("First?", { destructive: true });
  const queued = api.appPrompt("Queued?", "value");
  await Promise.resolve();
  assert.ok(env.current());
  api.abortAppDialogs();
  assert.equal(await first, false);
  assert.equal(await queued, null);
  assert.equal(env.current(), undefined);
  assert.equal(env.listeners.size, 0);
  assert.equal(env.main.inert, false);

  const recovered = api.appConfirm("Recovered?", { destructive: false });
  await Promise.resolve();
  await Promise.resolve();
  let ordinaryStopped = false;
  env.current().handlers.get("keydown")({ key: "a", stopPropagation() { ordinaryStopped = true; } });
  assert.equal(ordinaryStopped, true);
  let prevented = false, stopped = false;
  env.listeners.get("keydown")({
    key: "Escape",
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
  });
  assert.equal(await recovered, false);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(env.listeners.size, 0);
});

test("both broad overlay sweeps explicitly settle the dialog queue first", () => {
  const sweeps = [...html.matchAll(/abortAppDialogs\(\);document\.querySelectorAll\("\.overlay"\)\.forEach\(o=>o\.remove\(\)\)/g)];
  assert.equal(sweeps.length, 2);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /#appDialogOv\{z-index:500\}/);
});

test("image-reference prompts await, trim, and revalidate before writing", async () => {
  const source = owner.slice(owner.indexOf("async function ownerAppAddImage("), owner.indexOf("async function ownerAppDeleteAnnotation("));
  const brief = { id: "brief" };
  const writes = [];
  const prompts = ["  https://example.com/image.png  ", "owner note"];
  const run = new Function(
    "appPrompt", "safeHttpUrl", "ownerAppState", "ownerAppDialogSnapshot", "ownerAppDialogEntityCurrent", "ownerAppDialogStale", "sb", "toast", "ownerAppRefreshAndReopen",
    `${source}; return ownerAppAddImage("brief");`,
  );
  await run(
    async () => prompts.shift(),
    (value) => /^https?:\/\//.test(value),
    { briefs: [brief] },
    () => ({ uid: "owner" }),
    () => true,
    () => assert.fail("scope should remain current"),
    { rpc: async (name, args) => { writes.push({ name, args }); return {}; } },
    () => {},
    async () => {},
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].args.p_image_url, "https://example.com/image.png");
  assert.equal(writes[0].args.p_owner_comment, "owner note");
});
