// Local model test bench (browser-direct).
//
// Talks from the owner's browser straight to an OpenAI-compatible server on the
// same device (LM Studio :1234, Ollama :11434). Nothing goes through Supabase:
// no backend row, no key, no hosted automation. Endpoints are remembered only in
// this browser (localStorage, best-effort). Only loopback hosts are accepted, so
// this page can never be pointed at a LAN or internet host.
(function () {
  "use strict";
  const STORE_KEY = "mp.localModels.v1";
  const PRESETS = {
    lmstudio: { name: "LM Studio", base: "http://localhost:1234/v1" },
    ollama: { name: "Ollama", base: "http://localhost:11434/v1" },
  };
  const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const MAX_PROMPT_CHARS = 8000;
  const MAX_REPLY_CHARS = 64000;
  const TIMEOUT_MS = 120000;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }

  /** Accept only http(s)://loopback[:port]/path with no credentials, query or fragment. */
  function loopbackBase(raw) {
    let url;
    try { url = new URL(String(raw || "").trim()); } catch { return null; }
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!LOOPBACK.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, "") || "/v1";
    return url.toString().replace(/\/+$/, "");
  }

  function corsHelp(kind, origin) {
    if (kind === "ollama") {
      return `Ollama blocks browser calls from other sites by default. Allow only this site, keep it on loopback, then restart Ollama:<br>
<code>setx OLLAMA_ORIGINS "${esc(origin)}"</code><br>Do <b>not</b> set OLLAMA_HOST to 0.0.0.0 or enable network exposure.`;
    }
    return `In LM Studio → Developer → Server settings, turn on <b>Enable CORS</b> and keep <b>Serve on Local Network</b> off. Then start the server.`;
  }

  function render(host) {
    const state = load();
    const kind = PRESETS[state.kind] ? state.kind : "lmstudio";
    const base = loopbackBase(state.base) || PRESETS[kind].base;
    host.innerHTML = `<div class="autocallout" style="margin-top:14px" id="localBench">
  <b>Local models on this device</b> <span class="muted">— browser-direct test bench. Prompts go only to your own machine; hosted agents never use this.</span>
  <div class="row" style="margin-top:8px">
    <div><label>Server</label><select id="lmKind">${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}" ${k === kind ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></div>
    <div><label>Base URL (loopback only)</label><input id="lmBase" value="${esc(base)}" autocomplete="off"></div>
  </div>
  <div style="margin-top:6px"><button type="button" class="btn sec sm" id="lmDetect">Detect models</button> <span id="lmStatus" class="muted"></span></div>
  <div class="row" style="margin-top:6px">
    <div><label>Model</label><select id="lmModel"><option value="">— detect first —</option></select></div>
    <div><label>Temperature</label><input id="lmTemp" type="number" min="0" max="2" step="0.1" value="${esc(state.temp ?? 0.7)}"></div>
  </div>
  <label style="margin-top:6px">System prompt (optional)</label><textarea id="lmSystem" rows="2" maxlength="${MAX_PROMPT_CHARS}">${esc(state.system || "")}</textarea>
  <label style="margin-top:6px">Prompt</label><textarea id="lmPrompt" rows="3" maxlength="${MAX_PROMPT_CHARS}" placeholder="Try a persona caption, a classification, or a strict-JSON task"></textarea>
  <div style="margin-top:6px"><button type="button" class="btn sm" id="lmRun">Run locally</button> <button type="button" class="btn sec sm" id="lmStop" disabled>Stop</button> <span id="lmMetrics" class="muted"></span></div>
  <pre id="lmOut" style="white-space:pre-wrap;max-height:320px;overflow:auto;margin-top:8px" aria-live="polite"></pre>
  <details style="margin-top:6px"><summary class="muted">Browser can't reach the server?</summary><div id="lmHelp" class="muted" style="margin-top:4px">${corsHelp(kind, location.origin)}</div><div class="muted" style="margin-top:4px">If the browser asks to let this site access devices on your local network, allow it — that is the call to your own model server. Firefox and Safari may block https→http://localhost entirely; use Chrome or Edge.</div></details>
</div>`;

    const $ = (id) => host.querySelector("#" + id);
    let controller = null;
    const persist = () => save({ kind: $("lmKind").value, base: $("lmBase").value.trim(), model: $("lmModel").value, temp: Number($("lmTemp").value), system: $("lmSystem").value });

    $("lmKind").addEventListener("change", () => {
      const k = $("lmKind").value;
      $("lmBase").value = PRESETS[k].base;
      $("lmHelp").innerHTML = corsHelp(k, location.origin);
      persist();
    });

    $("lmDetect").addEventListener("click", async () => {
      const b = loopbackBase($("lmBase").value);
      if (!b) { $("lmStatus").textContent = "Use http://localhost, 127.0.0.1 or [::1] only."; return; }
      $("lmStatus").textContent = "Contacting " + b + " …";
      try {
        const r = await fetch(b + "/models", { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        const ids = (Array.isArray(j?.data) ? j.data : []).map((m) => String(m?.id || "")).filter((id) => id && id.length < 200);
        if (!ids.length) { $("lmStatus").textContent = "Server answered but has no models loaded."; return; }
        const saved = load().model;
        $("lmModel").innerHTML = ids.map((id) => `<option value="${esc(id)}" ${id === saved ? "selected" : ""}>${esc(id)}</option>`).join("");
        $("lmStatus").textContent = ids.length + " model(s) found.";
        persist();
      } catch (e) {
        $("lmStatus").textContent = "Not reachable — is the server running with CORS allowed? (" + (e?.message || "error") + ")";
        host.querySelector("details").open = true;
      }
    });

    $("lmStop").addEventListener("click", () => controller?.abort());

    $("lmRun").addEventListener("click", async () => {
      const b = loopbackBase($("lmBase").value), model = $("lmModel").value, prompt = $("lmPrompt").value.trim();
      if (!b || !model) { $("lmMetrics").textContent = "Detect and choose a model first."; return; }
      if (!prompt) { $("lmMetrics").textContent = "Enter a prompt."; return; }
      persist();
      const temperature = Math.min(2, Math.max(0, Number($("lmTemp").value) || 0));
      const messages = [];
      const system = $("lmSystem").value.trim();
      if (system) messages.push({ role: "system", content: system.slice(0, MAX_PROMPT_CHARS) });
      messages.push({ role: "user", content: prompt.slice(0, MAX_PROMPT_CHARS) });
      const out = $("lmOut");
      out.textContent = "";
      controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      $("lmRun").disabled = true; $("lmStop").disabled = false;
      const started = performance.now();
      let first = 0, chars = 0, usage = null;
      try {
        const r = await fetch(b + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, temperature, stream: true, stream_options: { include_usage: true } }),
          signal: controller.signal,
        });
        if (!r.ok || !r.body) throw new Error("HTTP " + r.status);
        const reader = r.body.getReader(), dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            let evt; try { evt = JSON.parse(data); } catch { continue; }
            if (evt.usage) usage = evt.usage;
            const delta = evt.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              if (!first) first = performance.now();
              if (chars + delta.length > MAX_REPLY_CHARS) { controller.abort(); break; }
              chars += delta.length;
              out.textContent += delta;
            }
          }
        }
        const total = (performance.now() - started) / 1000;
        const ttft = first ? ((first - started) / 1000).toFixed(2) + " s" : "—";
        const tokens = usage?.completion_tokens;
        const genSecs = first ? (performance.now() - first) / 1000 : total;
        $("lmMetrics").textContent = `TTFT ${ttft} · total ${total.toFixed(1)} s` + (tokens ? ` · ${tokens} tok · ${(tokens / Math.max(genSecs, 0.001)).toFixed(1)} tok/s` : ` · ${chars} chars`);
      } catch (e) {
        $("lmMetrics").textContent = controller.signal.aborted ? "Stopped." : "Request failed (" + (e?.message || "error") + ").";
      } finally {
        clearTimeout(timer);
        $("lmRun").disabled = false; $("lmStop").disabled = true;
        controller = null;
      }
    });
  }

  window.mountLocalModelBench = function (hostId) {
    const host = document.getElementById(hostId);
    if (host) render(host);
  };
  // Exposed for tests.
  window.__localModelsInternals = { loopbackBase };
})();
