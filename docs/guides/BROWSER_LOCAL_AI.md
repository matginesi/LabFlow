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

If the selected GGUF is already cached, load and warm-up can continue without interrupting the normal workflow. If the model is missing, LabFlow opens a blocking setup Totem for the one-time download. The Totem shows overall progress, bytes downloaded, transfer speed, ETA, cache state, load state and warm-up state. It does not show LLM token telemetry because model setup is not an Assistant/Action inference turn.

When the model is cached, the same setup Totem covers the runtime/cache/adapter check when it is not instantaneous: after a short grace period it appears as a loading Totem with a blurred backdrop, so a fast start stays uninterrupted while a slow load is explicit instead of leaving the interface apparently idle.

Automatic download and automatic warm-up can be disabled independently. When automatic download is disabled, the blocking setup Totem stays at the required-download checkpoint and exposes an explicit **Download model** retry action instead of degrading to a passive warning. Browser Data Saver also prevents an implicit large transfer; an explicit user retry may override that preference for this one download.

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

Settings accepts an additional HTTP(S) URL ending in `.gguf`. LabFlow stores only the small model definition until that model is explicitly downloaded or selected for initialization. Custom models use the same cache, runtime and WebGPU → WASM fallback.

The model registry intentionally stays small. It is not an online model marketplace and LabFlow does not scrape arbitrary model catalogues.

## Runtime dependency

LabFlow pins `@wllama/wllama` 3.6.1 and loads its ESM runtime and WASM binary from jsDelivr. The Content Security Policy allows scripts/workers only from LabFlow itself plus the pinned jsDelivr origin, and permits WebAssembly compilation through `wasm-unsafe-eval` without enabling general JavaScript `unsafe-eval`. Model files are separate and remain in the browser model cache. If the runtime module cannot be loaded, LabFlow reports Browser Local as unavailable without affecting import, analysis, Design review or export.

## Privacy boundary

Browser Local inference does not send prompts to an AI provider endpoint. A model download necessarily contacts the configured model URL and loading the runtime contacts the pinned runtime CDN when it is not already browser-cached.

Switching to a hosted provider is explicit. LabFlow does not silently fall back from Browser Local to a remote provider because that would change the data boundary.

## External llama.cpp remains supported

`labflow_engine.sh` is retained for researchers who prefer a native `llama-server`. Its default model path is:

```text
/data/models/LFM2.5-350M-Q4_K_M.gguf
```

That external provider and Browser Local are independent; both use the same Assistant/Action contracts.
