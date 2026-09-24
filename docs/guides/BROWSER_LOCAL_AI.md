---
title: Browser Local AI
section: Researcher guide
summary: Default GGUF model lifecycle, browser cache, WebGPU preference and WASM CPU fallback.
order: 72
---

# Browser Local AI

Browser Local is LabFlow's default provider for a fresh browser profile. It runs a GGUF model inside the page and does not require a local HTTP server or an API key. The scientific core remains deterministic and works when Browser Local is unavailable.

## Default model

The bundled model definition is:

- model: `LFM2.5-350M-Q4_K_M.gguf`
- catalogue id: `lfm2.5-350m-q4_k_m`
- source: official `LiquidAI/LFM2.5-350M-GGUF` repository on Hugging Face
- expected download: about 229 MB
- runtime context: 4096 tokens by default

The model file is not stored in the LabFlow repository. It is downloaded by the browser when needed and kept in the wllama model cache.

## Model sources

The Browser Local catalogue accepts two kinds of GGUF entries:

- **URL model** — an `http(s)` link ending in `.gguf`. LabFlow downloads it once through wllama, keeps it in the browser model cache and can re-download or remove it later. The bundled default is a URL model.
- **Uploaded file** — a `.gguf` file chosen from this device. LabFlow reads its header, then passes the file directly to `wllama.loadModel(Blob[])`, so the bytes never leave the device and are never uploaded anywhere. Only the name, size and compatibility metadata are stored in the catalogue; the file itself stays attached for the current session and is re-attached by choosing it again after a reload.

## Cache management

Settings → AI connection shows **one card per catalogue model**. Each card carries the source (Bundled, URL model, Uploaded file), the file name, size, architecture and quantization, and a state badge (Loaded, Cached, Not cached, Not attached, Not checked).

Card actions:

- **Use** makes a non-selected model the active Browser Local model.
- **Download** caches the active URL model (and repairs an interrupted download).
- **Load & warm** loads the active model (cached URL entry or attached file) and runs the warm-up probe.
- **Remove** / **Detach** releases that model from this browser without deleting its catalogue definition.
- **Forget** deletes a custom catalogue definition; the bundled default cannot be removed.

**Refresh cache** updates every card from the wllama cache. Adding a model (URL or local file) lives under **Add a model**; runtime switches and **Clear all Browser Local models** live under **Cache & runtime**.

Selecting a model in the **Model** select is the same as the card **Use** action: it makes that model active and runs the compatibility check automatically. Adding a URL model or an uploaded file checks it immediately and lists it in the **Model** select right away, so a freshly added model never waits for a manual **Check compatibility**. The select always shows catalogue names; the cache key stays internal.

Removing a cached URL model never deletes its catalogue definition, so it can be downloaded again.

## Compatibility check

LabFlow inspects the GGUF header before use and reports the result in the model panel. The check runs automatically whenever the active model changes (Model select, card **Use**, add, download) and can be re-run at any time with **Check compatibility**:

- GGUF signature and version (1, 2 or 3);
- `general.architecture` and `general.file_type` (shown as a quantization label such as `Q4_K_M`);
- declared context length;
- file size against the remaining browser storage quota;
- warnings when the architecture is outside the known list for the pinned runtime, when the context is very small, or when the model context is below the configured LabFlow context.

The check runs entirely on local bytes: for an uploaded file it reads the file header, and for a cached URL model it reads the shards through `Model.open()`. No extra network request is made. After a successful load, LabFlow also records the metadata reported by the runtime (`getModelMetadata`) so the report reflects what the runtime actually accepted.

An uploaded file that is not a GGUF, or whose header is unreadable, is rejected before it joins the catalogue. A URL model is only fully checked after it is cached, because LabFlow intentionally avoids extra network requests for metadata.

## Startup lifecycle

When Browser Local is the selected provider, application startup checks the model cache first:

```text
check browser cache
  -> missing? download selected GGUF
  -> load runtime
  -> prefer WebGPU
  -> warm-up probe
  -> ready
```

Startup follows the **selected** model when it can be obtained:

- a selected URL model that is missing is the model that gets downloaded, and the setup Totem names it;
- a selected uploaded file cannot be downloaded. If its bytes are not attached in this session (for example after clearing the browser cache), LabFlow says so and prepares the bundled model through the normal setup Totem instead of stopping on a warning; re-attach the file in Settings → AI connection and select it again to use it;
- if the stored model id is no longer in the catalogue, startup says so and prepares the bundled model through the same setup Totem.

Loading, warming and the WebGPU → WASM CPU fallback apply to whichever model is selected, and the other catalogue entries stay untouched.

If the selected GGUF is already cached, load and warm-up can continue without interrupting the normal workflow. If the model is missing, LabFlow opens a blocking setup Totem for the one-time download. Download speed and transferred/total bytes stay visible without opening **Technical data**; the transfer, ETA, cache, load and warm-up detail lives there. The Totem does not show LLM token telemetry because model setup is not an Assistant/Action inference turn.

When the model is cached, the same setup Totem covers the runtime/cache/adapter check when it is not instantaneous: after a short grace period it appears as a loading Totem with a blurred backdrop, so a fast start stays uninterrupted while a slow load is explicit instead of leaving the interface apparently idle.

Automatic download and automatic warm-up can be disabled independently. When automatic download is disabled, the blocking setup Totem stays at the required-download checkpoint and exposes an explicit **Download model** retry action instead of degrading to a passive warning. Browser Data Saver also prevents an implicit large transfer; an explicit user retry may override that preference for this one download. Startup never degrades to a passive warning: a missing, detached or unavailable model always surfaces the blurred setup Totem with an explicit next action.

## WebGPU and WASM fallback

Browser Local uses the same GGUF for both execution paths:

```text
GGUF -> wllama -> WebGPU
               -> WASM CPU fallback
```

LabFlow first asks wllama to offload the model to WebGPU. If WebGPU is unavailable, model loading fails, warm-up fails, or the first inference fails before any visible output is produced, LabFlow reloads the same cached GGUF with zero GPU layers and continues on WASM CPU.

Fallback never changes the scientific request or downloads a second model format. ONNX is not part of this path.

## Cache and storage

The Browser Local manager shows:

- selected model and lifecycle state;
- overall download/load/warm-up progress;
- cached/not-cached state;
- active WebGPU or WASM CPU backend;
- WebGPU availability;
- model size;
- browser storage usage and quota when exposed by the browser;
- whether persistent storage was granted or the cache remains best-effort.

After a successful model download LabFlow asks the browser for persistent storage when the API is available. Browser policy still decides whether persistence is granted.

A cached model can be removed without deleting its catalogue definition. Clearing the Browser Local cache removes every model managed by wllama. Custom catalogue definitions can be removed separately.

## Additional GGUF models

Settings accepts an additional HTTP(S) URL ending in `.gguf` or a local `.gguf` file from this device. URL definitions stay small until the model is explicitly downloaded or selected for initialization; uploaded files are validated from their own bytes and used directly, so they add no network traffic. All catalogue entries share the same runtime, WebGPU → WASM CPU fallback and compatibility report.

The model registry intentionally stays small. It is not an online model marketplace and LabFlow does not scrape arbitrary model catalogues.

## Runtime dependency

LabFlow pins `@wllama/wllama` 3.6.1 and loads its ESM runtime and WASM binary from jsDelivr. The Content Security Policy allows scripts/workers only from LabFlow itself plus the pinned jsDelivr origin, and permits WebAssembly compilation through `wasm-unsafe-eval` without enabling general JavaScript `unsafe-eval`. Model files are separate and remain in the browser model cache. If the runtime module cannot be loaded, LabFlow reports Browser Local as unavailable without affecting import, analysis, Design review or export.

## Privacy boundary

Browser Local inference does not send prompts to an AI provider endpoint. A model download necessarily contacts the configured model URL and loading the runtime contacts the pinned runtime CDN when it is not already browser-cached. An uploaded GGUF file is read locally and is never transmitted by LabFlow.

Switching to a hosted provider is explicit. LabFlow does not silently fall back from Browser Local to a remote provider because that would change the data boundary.

## External llama.cpp remains supported

`labflow_engine.sh` is retained for researchers who prefer a native `llama-server`. Its default model path is:

```text
/data/models/LFM2.5-350M-Q4_K_M.gguf
```

That external provider and Browser Local are independent; both use the same Assistant/Action contracts.
