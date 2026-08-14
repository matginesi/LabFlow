# LabFlow development and UI skill

This skill applies to LabFlow UI, workflow and scientific interaction changes.

Before changing LabFlow, read:

1. `docs/WORKFLOW.md`
2. `LABFLOW_POC_SPEC.md`
3. `ui-kit.html`
4. the relevant technical spec (`docs/specs/ACTIONS.md`, `DATA_MODEL.md`, `IMPORT_EXPORT.md`, `docs/AI.md`, `docs/NOMAD.md`).

`ui-kit.html` is the visual ground truth. `docs/WORKFLOW.md` is the workflow/architecture ground truth.

---

## Product workflow

Keep the main researcher flow:

```text
Upload & Review → Results → Design → Report → Changes → NOMAD
```

Upload is always the experiment entry point. **Upload & Review is one first page**: every app load starts with no experiment and the mandatory ZIP gate; after a new import it shows the immutable source receipt and Review workbench together. Provider/API-key/UI preferences may persist, but the experiment snapshot must not auto-restore. `experiment-understand` may exist only as a compatibility alias.

Do not add project/workflow layers ahead of ZIP import unless explicitly required.

---

## Source and Working Copy

The uploaded ZIP is immutable source evidence.

Import clones source bytes immediately. The only editable scientific state is:

```text
LF.State.state.experiment
```

Every edit and every mutating operation works on this one Working Copy.

Never:

- mutate source bytes;
- share caller-owned upload buffer with editable state;
- create a second editable experiment projection;
- introduce hidden autosave state.

**Save working copy** is the only operation that marks the current revision saved and it creates a new ZIP. Report/NOMAD/other derived exports do not rewrite source and do not clear unsaved state.

The top bar must clearly show Working Copy dirty/saved state.

---

## Canonical Store and naming

`LF.CanonicalStore` is the internal canonical-v2 representation/semantic index over the Working Copy, not a second editable model. UI, Actions and shared Tools should consume this representation instead of inventing parallel page models.

Use stable IDs, aliases, relations and evidence.

Original filenames are provenance. Do not use a filename as scientific sample identity when a better parsed/canonical identity exists.

If identity cannot be established deterministically, surface an ambiguity instead of guessing.

---

## Action philosophy

A visible Action is a researcher goal, not a code function.

The public researcher set is limited to:

- Analyze dataset;
- Apply safe corrections;
- Resolve ambiguities;
- Infer missing design;
- Interpret results;
- Generate report;
- Improve report;
- Prepare NOMAD export.

`assistant.chat` is an internal/read-only Action that is inspectable in Settings → Actions but is not a scientific mutation goal.

Internal services such as Results calculation, proposal application, evidence rebuilding and validation stay hidden.

### Tools versus Actions

A **Tool** is a small typed capability over the Canonical Data Model. An **Action** is a researcher-understandable finite workflow that composes deterministic Tools and optional AI steps. Deterministic Action checkpoints use `tool` IDs from `LF.ToolRegistry`; do not add special runner branches for individual Actions.

`requires[]` must be enforced for the current revision. Missing/stale prerequisites fail closed before execution.

### Action types

- `DETERMINISTIC` — logic + sequential checkpoints, no prompt/provider.
- `AI` — deterministic preparation + bounded model step + deterministic validation/storage as needed.

### Execution UX

Successful checkpoints advance automatically.

While running show **Stop**.

AI failure may retry after 5 s and 10 s. After bounded retries show **Retry checkpoint**.

Never add:

- Continue gate;
- provider queue;
- parallel model fan-out;
- unbounded retry loop;
- fake progress.

Heavy work may expose bounded sequential work units only when they represent real finite progress.

### Totem

Show:

- Action title/kind;
- checkpoint progress;
- meaningful unit progress when present;
- Stop/Retry controls;
- provider output disclosure for AI.

Provider output is closed by default. It streams meaningful content/reasoning live and renders final Markdown/JSON using the active theme. Do not show a separate Action/provider-note block.

---

## Deterministic-first Review

Review is useful immediately after import and lives on the same mandatory Upload & Review page.

Show a compact Analysis Dossier with:

- Samples;
- Measurements;
- ambiguity count;
- safe-fix count;
- evidence/relations/alias summary;
- deterministic findings.

Use responsive tables for repeated corrections/findings, not vertical stacks of repetitive cards.

### Safe corrections

Allow individual and bulk deterministic application when target/action is provably safe.

### AI ambiguity proposals

AI is used only for semantic ambiguity. Proposals are visibly separate from deterministic facts and can be applied only after local validation.

### Researcher decisions

Unresolved items must remain visible and manually correctable. Do not hide them behind only a count.

---

## Research Context Pack

AI assists use bounded Context Packs built from Canonical Store references and declare their profile in `action.json`. Assistant chat starts from a small bootstrap pack and retrieves additional experiment data only through explicit read-only Tools.

Context follows:

- current page;
- user question;
- selected entities;
- relevant Results;
- findings;
- evidence;
- bounded history/document excerpt.

Never imply or implement that the whole experiment or RAW curves are sent by default.

When more context is needed, narrow/select relevant records before increasing budgets.

Never assume an 8k output ceiling. Resolve the active model/provider capability when possible. Optional Action, Assistant and provider settings are lower caps only; `0` means automatic. If no safe limit is known, omit the token-limit parameter and let the provider default apply.

---

## Results

Results are deterministic and independent from Design.

Preserve:

- Overview;
- rankings;
- REF/non-REF separation;
- measurement table;
- warnings;
- JV Analyzer for one measurement (RAW integrity + FW/RV diagnostics);
- Overlay for an independent multi-measurement comparison set;
- Compare/group statistics;
- backing tables.

Charts should use reliable responsive rendering (current implementation favors inline SVG) and must not depend on lucky resize timing to appear.

Tables live in explicit responsive containers. Warning/status columns keep usable width. Badges remain single-line atomic labels.

Compare uses the **Compare workbench** pattern: a compact control panel (metric, scan, eligible-only, All/REF/Clear, group list) next to a per-scan FW/RV box chart and a comparison-statistics table whose `Group | n | FW median±IQR | FW min–max | RV median±IQR | RV min–max` columns reuse the single deterministic analysis bundle shared with Report and NOMAD. Prioritize readability and stable statistics over fragile interaction tricks. For many groups, use readable horizontal overflow instead of compressing labels to illegibility.

AI interpretation is optional prose and must be visually distinguished from deterministic data.

---

## Tabs

Tabs are visible navigation controls, not text links.

Use a bordered `surface-2` track. Active tab uses filled surface, stronger border/accent. Inactive tabs remain readable and hoverable.

On narrow screens horizontal-scroll the tab track rather than squeezing/wrapping labels.

Use `role="tablist"`, `role="tab"` and `aria-selected` for real tabs.

---

## Single-experiment Design

Use the UI Kit **Single-experiment Design** pattern as the ground truth.

The page must be useful with no provider and must be **source-first**:

- compact experiment/variant selector with completion and missing-field count;
- a visible Design status overview showing samples, recovered required areas, missing fields and ZIP evidence count;
- explicit `Source design found` versus `No recipe in source` state;
- expandable RAW fabrication evidence when present;
- AI suggestions panel (`design-ai-table-panel`) that fills only missing fields and never overwrites researcher-entered or RAW-backed values;
- three editable scientific tables: solutions & solvents, fabrication, device stack;
- provenance badges that distinguish Researcher / AI / ZIP / Unknown;
- researcher edits must survive normal re-rendering.

`Infer missing design` is optional and works only on the currently selected experiment/device and its exact unresolved fields. If the source-backed Design is complete, disable the AI completion action. If the archive is measurement-only, keep the sample/group structure visible and explain that recipe/fabrication metadata are absent rather than showing an empty workbench.

Known, RAW-backed and user-confirmed values are authoritative. AI proposals appear in progressive disclosure and must not silently overwrite them.

---

## Report Studio

The Markdown editor is the textual source of truth. Use the compact command-palette pattern rather than a long formatting-button strip. Standard inline `$...$` and display `$$...$$` LaTeX must render in preview and survive MD/LaTeX/DOCX/PDF export.

`Generate report` and `Improve report` update this editor. Researcher edits remain authoritative.

PDF/DOCX must export the current editor text, not regenerated parallel prose.

The editor uses a Write / Preview segmented control (`report-document-choice`, `role="tablist"`), not a three-way Split. "Improve selection" (`report.improve`) rewrites only the selected editor region and is exposed as an explicit action in the toolbar.

Figure selection is explicit and shared by preview/exports **within each document**, but Report and Paper keep independent selections. Current available figure choices include PCE distribution, hysteresis distribution, best JV curve, PCE vs hysteresis, top efficiency and group comparison.

Report layout should be compact, professional and scientific: restrained headings, balanced margins, readable tables/figures and no oversized decorative blocks.

Derived Report export does not mark Working Copy saved.

---

## NOMAD

NOMAD uses one deterministic Canonical → NOMAD mapping.

The same mapping powers:

- page table;
- validation;
- generated entry;
- exported mapping metadata.

Show mappings in an inspectable table:

```text
LabFlow source | NOMAD field | value | required | status
```

Required missing mappings block readiness. Optional missing mappings remain visible.

Do not use AI as a NOMAD readiness gate and do not build a second export-only mapping.

---

## Sidebar and typography

Sidebar typography must be compact but compatible with page typography. Do not shrink primary nav to unreadable 9px text on ordinary mobile layouts.

Keep badge/pill labels atomic and single-line. Let the surrounding layout reflow or truncate rather than wrapping tiny status pills into two lines.

---

## Theme-aware Markdown and JSON

Chat, totems, Provider output and raw/structured views must use the active theme. Do not use native browser confirm/alert UI for normal LabFlow interaction; use the shared message/activity totems. Every modal/totem must expose an explicit Cancel or Close control appropriate to its lifecycle and support Esc; running Actions cancel, terminal surfaces close. The empty Assistant composer remains one line and grows only from user-entered content.

In light mode JSON/code surfaces remain light and readable. In dark mode text/surface contrast must remain accessible.

Markdown fenced JSON uses the same semantic JSON palette as dedicated structured output.

---

## Settings → Actions

Settings → Actions is the single catalog/editor for deterministic, AI-assisted and hybrid Actions. It is not split into Operations versus AI Helpers.

For each Action show its purpose, role/category, mutation scope, finite checkpoint flow, prompt/schema when applicable, optional cap when explicitly declared, and last run. Browser-local overrides may be edited and reset to versioned source. Internal implementation services remain hidden.

The runtime Action Runner is sequential, cancellable and bounded. Do not add provider queues, background workflows or a second AI execution system.

## Changes

Changes is an audit against the immutable post-import baseline, not a patch-list viewer. It must compare current Data, analysis settings, Design and both scientific documents directly. Manual Report/Paper edits are recorded from editor input with `source: user`; model writing uses `source: ai`. Keep category tables and document diffs compact with bounded internal scroll areas. Large Markdown diffs must be bounded so a long paper cannot freeze the page.

## Assistant

The Assistant is a bounded read-only tool-aware agent. It may select only allowlisted Tools marked `agent_visible` + `read`; it must never receive write Tools, invoke mutating Actions autonomously or edit the Working Copy as a chat side effect. Keep planner/tool-routing output internal; show only useful status such as the current read Tool and final telemetry.

Use compact instrument-style rows rather than oversized rounded bubbles. Do not expose raw stream chunk/event/byte counters in chat; those belong in logs. Show model reasoning/thinking separately from final answer text. Completed answers should retain and display useful telemetry when available: model/provider, elapsed time, TTFT, input/output/total tokens, cached tokens and generation rate.

## Documentation discipline

When workflow/architecture changes, update `docs/WORKFLOW.md` in the same patch and keep supporting docs/skill consistent.

A UI change that creates a new reusable interaction pattern should also update `ui-kit.html` and this skill.


## Long Action progress contract

Use one monotonic parent progress bar for long or sequential Actions. Compose progress from checkpoint, work-unit position and semantic phase; use SSE event/token telemetry only to refine the streaming band. Never show 99% while a provider is still generating. Design proposal cards must preserve incomplete status after applying partial AI inferences. Report/Paper figure selection should use the dedicated compact totem picker and remain document-scoped.
