import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../MyPersonas.Online_v0/index.html", import.meta.url), "utf8");

test("problem reporting uses a non-blocking accessible dialog", () => {
  assert.doesNotMatch(html, /prompt\("What were you doing when it broke\?/);
  assert.match(html, /id="reportErrorOv"/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="reportErrorTitle" aria-describedby="reportErrorDescription"/);
  assert.match(html, /id="reportErrorNote" maxlength="1000"/);
  assert.match(html, /onclick="closeReportErrorDialog\(\)"[^>]*>Cancel<\/button>/);
  assert.match(html, /id="reportErrorSend"[^>]*onclick="submitErrorReport\(\)"[^>]*>Send private report<\/button>/);
});

test("persona chat icon controls have descriptive accessible names", () => {
  assert.match(html, /onclick="closeChat\(\)" aria-label="Close persona chat" title="Close persona chat">✕<\/button>/);
  assert.match(html, /onclick="chatSend\(\)" aria-label="Send message" title="Send message">➤<\/button>/);
});
