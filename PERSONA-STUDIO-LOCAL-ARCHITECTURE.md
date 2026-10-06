# Persona Studio — Local Architecture & Build Plan

> Scope locked: **image + video generation + audio/voice/song attachment to video.**
> Out of scope for this pass: song/voice/3D *generation* engines (those are separate
> modules you already have elsewhere). 3D *conversion* (meshy-style) is an export
> target, not a generation engine here.
>
> Grounded in what you already have:
> - `MyPersonas` monorepo (Deno + pnpm + Supabase, `mypersonas.online`) — the
>   existing **identity / data / billing** layer. Persona = already a portable concept.
> - `stable-diffusion-webui` already checked out — local diffusion substrate exists.
> - `tools/personas-android`, `tools/personas-ios` — personas already ship as packages.

---

## 0. The one big architectural decision

Your existing `MyPersonas` is a **cloud owner-control plane**. What you're describing is a
**local desktop app** that owns:

- a local GPU inference + LoRA-training runtime,
- a local "persona package" store (images + memories + a small LLM),
- a local hypervisor for sandboxed agent VMs,
- a local LLM router (standard models) for persona brains.

So the clean split is:

```
┌───────────────────────────────────────────────────────────────────────┐
│  PERSONA STUDIO (new local desktop app)                               │
│  Owns: GPU runtime, LoRA training, persona packages, VMs, LLM router  │
│  Talks to MyPersonas cloud ONLY for: identity, billing, sync, social  │
└───────────────────────────────────────────────────────────────────────┘
        │  (identity + billing + sync)        │  (persona data model)
        ▼                                     ▼
  MyPersonas cloud (existing)        Persona Package (local, portable)
```

Rule: **the local app is the source of truth for the persona's creative assets
and memories; the cloud stays the source of truth for identity, entitlement,
and public/social state.** A persona package is a self-contained folder you can
move between machines (this matches your existing `tools/personas-*` pattern).

This keeps `PROJECT-BOUNDARY.md` intact — we are not moving ownership, we are
adding a new local product surface that *consumes* the existing identity/billing.

---

## 1. Persona = a portable package (data model)

A persona is a directory with a manifest. This is the core artifact and it
replaces "3 reference images" with an **unbounded, structured asset + memory
store.**

```
personas/<persona-id>/
  manifest.json            # schema version, identity link, entitlement, brain
  identity/
    core.json              # name, age, personality, hobbies, education, bio
    anchors/               # the "who they are" reference set — UNBOUNDED
      face/                # many angles, expressions, lighting
      fullbody/
      variations/          # different hairstyles, fitness, ages, outfits
      styles/              # art-style LoRA variants (anime, photoreal, ...)
    memory/                # the "small LLM database" — see §5
      vector.db            # sqlite-vec / chroma local embeddings
      timeline.json        # episodic memories, events, relationships
      facts.json           # structured facts (education, hobbies, contacts)
  brain/
    model.json             # which standard LLM drives this persona (§6)
    system_prompt.md
    tools.json             # agentic tool grants (VM, mail, calendar...)
  media/
    images/                # every generated image ever, tagged
    video/                 # clips, with audio tracks
    audio/                 # voice + song attachments
    meshes/                # 3D exports (meshy-style), optional
  social/
    contacts.json          # social circle: other persona-ids + relationships
  runtime/
    vm/                    # snapshot of the sandboxed VM state (§7)
```

Why this kills the "3-image cap": the anchor set is now a **categorized,
tagged, versioned** collection. Training a LoRA on 40–80 curated anchors beats
training on 3. You can also keep **separate style LoRAs** (art filter) and
**identity LoRAs** (the face/person) and compose them at generation time.

`manifest.identity` references your existing MyPersonas persona id so the cloud
and local stay in sync without duplicating ownership.

---

## 2. Composer workflow (the "modular set everything" UI)

A single generation request is built from **composable slots**. Each slot is a
first-class object you can add/remove, reorder, and persist as a "recipe."

```
ComposerRequest
 ├─ persona        → loads manifest: identity LoRA(s) + brain + memory
 ├─ style          → art-style LoRA / filter (photoreal, anime, 3d, ink…)
 ├─ environment    → scene / location LoRA or prompt module
 ├─ pose           → pose reference (pose-LoRA / ControlNet / OpenPose map)
 ├─ extras         → small add-on LoRAs (accessories, props, moods)
 ├─ products       → product/object LoRAs (the "products" slot)
 ├─ prompt         → free-text + persona memory context injected
 ├─ audio          → voice / song to attach to video (§8)
 └─ output         → image | video | (3d export later)
```

Each slot resolves to one or more **adapter weights + prompt fragments +
ControlNet guidance**. The engine (ComfyUI) is the natural runtime because it is
already node-graph and adapter-native, and you already have `stable-diffusion-webui`
for the simpler path. The Composer is just a **structured API over ComfyUI
workflows** — each slot maps to a set of ComfyUI nodes.

Deliverable: a `composer/` module that emits a ComfyUI API JSON payload from a
typed `ComposerRequest`. This is testable and UI-agnostic.

---

## 3. Local per-user LoRA / checkpoint / VAE engine

You asked for "the most comprehensive checkpoint and LoRA/VAE setup possible"
with an installer that preloads relevant weights. Design:

**A. Model registry (local)**
```
models/
  checkpoints/   # FLUX.1-dev/schnell, SDXL, FLUX.2-klein, base video models
  loras/
    identity/    # per-persona, per-subject
    style/       # art-style filters
    pose/        # pose/ControlNet adapters
    product/
    extra/
  vae/           # VAEs per base (FLUX VAE, SDXL VAE, sdxl-vae-fp16-fix…)
  text_encoders/ # T5 (FLUX), CLIP, umT5 for video
  video/         # Wan 2.1/2.2, HunyuanVideo, LTX-Video, Mochi
```
A `models.json` index records: name, sha256, size, base, tags, source,
license, last-used. Every generation references by id, never by path.

**B. Installer weight packs (your "click to include" requirement)**
Ship **optional feature packs** the user opts into at install. Each pack = a
list of (url, sha256, dest) entries. Example packs:

| Pack | Preloads |
|---|---|
| `image-photoreal` | FLUX.1-dev + FLUX VAE + 2–3 photoreal style LoRAs |
| `image-anime` | SDXL base + anime style LoRAs + VAE |
| `image-3d` | 3D/texture style LoRAs + meshy-style export presets |
| `video-cinematic` | Wan 2.2 / LTX-Video + umT5 + motion LoRAs |
| `pose-control` | ControlNet / OpenPose adapters |
| `low-vram` | QLoRA-ready configs + 8-bit Adam presets for 12–16GB cards |

Installer behavior: user ticks packs → app downloads + verifies (sha256) →
registers into `models.json`. This is exactly the "multiple options you can
click to include the visual aspects you're looking for" you described.

**C. Training runtime**
Use **kohya-ss `sd-scripts`** (the de-facto standard, already referenced across
your search results) as the engine, wrapped by a thin local service. It supports
SD 1.5/2.x, SDXL, SD3/3.5, FLUX.1, and LoRA+/LyCORIS. For FLUX.2-klein (4B) use
`ostris/ai-toolkit` — fastest on a consumer card.

Training service API:
```
POST /train  { persona_id, slot(identity|style|pose|product), anchors[],
               base, steps, rank, lr, trigger }
GET  /train/{id}   # status, loss, sample previews
```
- QLoRA + 8-bit Adam + gradient checkpointing → FLUX fits in ~12–16GB.
- Auto-caption anchors with a local VLM so the user doesn't hand-write captions.
- Mid-run sample generation every N steps → user picks the best checkpoint.
- Output: a **versioned LoRA** written into `personas/<id>/anchors/…` and
  registered in `models.json`. Old versions kept for rollback.

This is the "per-user LoRA on the user's local hardware" you wanted — fully
local, no cloud fee, versioned, and slot-scoped.

---

## 4. Image + video generation (the in-scope engines)

**Image** — ComfyUI as the execution backend (adapter-native, node-graph,
scriptable via its HTTP API). The Composer (§2) emits a workflow; ComfyUI runs
it on the local GPU. FLUX.1-dev/schnell for photoreal, SDXL for anime/3D.
SD-webui is your fallback for the "one-click" path.

**Video** — pick a local text/image-to-video model, all of these run locally:
- **Wan 2.1/2.2** — best local quality, kohya's `musubi-tuner` trains its LoRAs.
- **LTX-Video** — fast, good for short clips.
- **HunyuanVideo / Mochi** — alternatives.
- Character-consistent video: drive with the persona's identity LoRA + a
  first-frame (image) conditioning so the face stays consistent across frames.

**Audio attachment to video** (your explicit scope): generate/attach a voice
or song *track* to a finished clip. This is a **compositor** job (ffmpeg), not
a generation engine in this pass:
```
video + audio_track  →  muxed clip
```
- Voice: pull a generated WAV/MP3 from your existing voice module (out of scope
  here) or a TTS file, align to clip duration, add ducking.
- Song: same — drop a song file, trim/loop to length, mux.
- The Composer `audio` slot (§2) just carries `{ type: voice|song, file, gain,
  offset }`. ffmpeg does the mux. Keep it dead simple and reliable.

---

## 5. "Small LLM database" / large memory for each persona

You said "each persona becomes a package that retains all of its data, maybe
likes its own small llm database." Concretely, give every persona a **local
hybrid memory**:

- **Vector store** — `sqlite-vec` or a local `chroma` instance, one DB per
  persona. Embed generated images + episodic memories + facts. This is how a
  persona "remembers" its own images beyond 3 anchors.
- **Structured facts** — `facts.json` (education, hobbies, contacts, schedule).
- **Episodic timeline** — `timeline.json` (what happened, when, with whom).
- **Retrieval** — a tiny local embedding model (e.g. a 0.5–1B text embedder)
  runs on CPU or the GPU tail. At generation/chat time, the brain pulls the top-k
  relevant memories into context.

This is what makes "much larger memories of a persona's images" real: the
anchor set is the *training* set, but the vector DB is the *recall* set — the
persona can reference any image it has ever made.

---

## 6. Standard LLMs assigned to personas (the agentic brain)

"all of the standard llm models in here in order to assign them to personas."

- **Local router** — a lightweight local inference host (Ollama / vLLM /
  llama.cpp server) that loads a menu of standard models (Llama, Qwen, Mistral,
  Gemma, plus small ones for cheap personas).
- **`brain/model.json`** picks which model + context window + tool grants drive
  this persona.
- **Persona → agentic bot**: the brain gets the persona's memory (§5) + a
  system prompt + a tool set (VM exec, mail, calendar, Composer). It can then
  *act* — post, generate, schedule, talk to other personas.
- **Social circle + automated communication**: `social/contacts.json` defines
  the graph; an orchestration loop (your existing MyPersonas automation plane,
  or a local scheduler) runs turns between personas, each using its own brain.
  This reuses your existing automation/connector infrastructure rather than
  reinventing it.

---

## 7. The "mini hypervisor" — sandboxed agent VMs

"segment off small parts of your hardware for isolated VMs for your agentic bots."

You're on Windows (path + PowerShell). Two realistic options:

**Option A — Hyper-V nested / lightweight (recommended start)**
- Each persona's agent gets its own **small VM** (2 vCPU / 2–4GB RAM, a
  dedicated slice) running a minimal Linux or Windows image.
- Use **Hyper-V** (native on Windows Pro/Enterprise) or **WSL2** for the light
  case, or **QEMU/KVM** on a Linux box for the heavy case.
- The agent's "hands" run inside the VM; the host stays isolated.
- Snapshot the VM state into `personas/<id>/runtime/vm/` so a persona's
  environment is part of its package.

**Option B — container-per-agent (lighter, faster)**
- Docker/Podman container with cgroup limits = the "small part of hardware"
  you want, without full VM overhead. Good enough for most agent tooling.
- Use real VMs only when the agent needs OS-level isolation.

Deliverable: an `agent-runtime/` service that can `spawn(persona_id, {cpu, ram,
image})` → returns a handle; the persona brain's `tools.json` points tool calls
at that handle.

---

## 8. Screen-recording "watch me work" capture

"open up sandboxed windows so the agent can watch you working in it and record
a screenshot on every mouse or key click."

This is a **demo-capture / learning-from-observation** feature:

- Open the target app inside the **sandboxed window** (the agent VM/container
  from §7, or a virtual desktop on the host).
- Run a **low-overhead input hook** that, on each mouse click / keypress,
  captures the current window to a PNG and logs the event + coordinates +
  timestamp.
- Store as an **episode**: `[ {t, event, x, y, key, shot} ]` → written into the
  persona's memory (§5) so the agent can *learn the task* by reviewing episodes.
- Throttle/cap to avoid disk blowout (e.g. max N frames/sec, downscale to 720p).

Implementation note: this needs the window to be in a capturable context.
In a VM, capture the VM's framebuffer (easy). On the host, use a virtual
display / `dxgi` desktop duplication. Keep the capture process separate so a
hang can't take the app down.

---

## 9. Art-style filter + 3D export (in-scope as *outputs*)

- **Art style as a filter** — this is just the `style` Composer slot (§2). A
  style LoRA = the "filter." Toggle it on/off or swap it; the persona identity
  LoRA stays fixed underneath. Trivial to implement once the Composer exists.
- **3D object export (meshy-style)** — out of scope as a *generation engine*
  (you said finish that separately), but the **export hook** is in scope:
  - `personas/<id>/media/meshes/` storage + manifest entry.
  - A `3d-export` adapter interface: `export(image|video) → glb/obj`.
  - Plug in your existing meshy/3D module as the backend. The Persona Studio
    just calls it and stores the result in the package.

---

## 10. Modular build order (the "break it into many sections" ask)

Sequenced so each stage is shippable and testable, and image+video land early:

1. **Persona package format + store** (§1, §5) — the portable folder + manifest
   + vector DB. Foundation everything else uses.
2. **Model registry + installer packs** (§3A, §3B) — `models.json`, sha256-
   verified downloads, the "click a pack to preload weights" installer.
3. **Composer core** (§2) — typed request → ComfyUI workflow emitter.
4. **Image generation** (§4) — ComfyUI backend, identity + style + pose slots.
5. **Local LoRA training service** (§3C) — kohya/ai-toolkit wrapper, versioned
   outputs, anchor auto-captioning.
6. **Video generation** (§4) — Wan/LTX, first-frame conditioning for
   consistency, character-LoRA driven.
7. **Audio mux** (§4) — ffmpeg voice/song attach to clips.
8. **LLM router + persona brains** (§6) — local model menu, brain assignment,
   agentic tool loop.
9. **Agent VM runtime** (§7) — spawn/snapshot small VMs/containers per agent.
10. **Screen-capture learning** (§8) — sandboxed window + per-event capture.
11. **Social circle + automated comms** (§6) — persona graph + orchestration,
    reusing your existing MyPersonas automation plane.
12. **3D export hook** (§9) — `media/meshes/` + adapter interface.
13. **Cloud sync** — push persona package deltas to MyPersonas for identity /
    billing / social, per `PROJECT-BOUNDARY.md` rules.

---

## 11. Concrete tech picks (summary)

| Concern | Pick | Why |
|---|---|---|
| Inference runtime | **ComfyUI** (primary) + SD-webui (simple path) | adapter-native, API-driven, you already have both |
| LoRA training | **kohya-ss sd-scripts** (engine) + `ostris/ai-toolkit` (FLUX.2-klein) | standard, multi-base, low-VRAM |
| Image base | FLUX.1-dev/schnell (photoreal), SDXL (anime/3D) | best local quality |
| Video base | **Wan 2.1/2.2** or LTX-Video | runs locally, LoRA-trainable |
| Persona memory | **sqlite-vec / local chroma** + JSON facts | per-persona "small LLM DB" |
| Embeddings | local 0.5–1B text embedder | cheap recall over images + memories |
| Persona brains | **Ollama / vLLM** local menu (Llama/Qwen/Mistral/Gemma) | "standard LLMs" you assign per persona |
| Agent isolation | **Hyper-V/WSL2** (VM) or **Docker** (container) | the "mini hypervisor" |
| Screen capture | input-hook + per-event PNG into VM framebuffer or dxgi dup | the "watch me work" feature |
| Audio mux | **ffmpeg** | voice/song attach to video |
| Cloud sync | existing **MyPersonas** (identity/billing/social) | don't duplicate ownership |

---

## 12. Open questions to lock before building

1. **OS target for the desktop app** — Windows (matches your env) or cross-platform?
   (Hyper-V is Windows-only; if you need Linux VMs, plan a QEMU/KVM path too.)
2. **Minimum GPU** you're designing for? 12GB (QLoRA FLUX, 8-bit) vs 24GB
   (comfortable FLUX + video). Drives which packs ship by default.
3. **Persona memory size ceiling** — "much larger" — are we talking hundreds
   or tens of thousands of images per persona? (Affects DB choice + disk.)
4. **Agent VM OS** — minimal Linux (fast, light) or Windows (matches your apps)?
5. **Does the local app need to work fully offline?** (Affects cloud-sync
   design — sync as optional vs required.)
6. **Which of your existing voice/song modules** are the ffmpeg mux should pull
   from — give me the file/API shape and I'll wire the `audio` slot to it.

---

*This is a plan, not code. Say which stage to start on (I'd start at
#1 Persona Package + #3 Composer since everything hangs off them) and I'll
begin building it against your `MyPersonas` + `stable-diffusion-webui` tree.*
