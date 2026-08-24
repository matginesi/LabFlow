# Privacy and local-first boundary

LabFlow loads runtime assets locally. There are no trackers, analytics, cookies, service workers, WebSockets or remote fonts/assets.

The only external runtime request is `fetch()` in `assets/js/ai/transport.js`, triggered by explicit AI Action/chat use and sent to the provider endpoint configured in Settings. Requests use `credentials: "omit"` and `cache: "no-store"`.

API keys are stored only in browser localStorage, separately for each provider, and are redacted from logs. No `.env` file is required or shipped. Experiment data is not persisted by LabFlow unless the user explicitly exports a file.
