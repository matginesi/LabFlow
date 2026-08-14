# LabFlow development and UI skill

This skill applies to LabFlow UI, workflow and scientific interaction changes.

Before changing LabFlow, read:

1. `docs/WORKFLOW.md`
2. `LABFLOW_POC_SPEC.md`
3. `ui-kit.html`
4. the relevant technical spec (`docs/specs/OPERATIONS.md`, `DATA_MODEL.md`, `IMPORT_EXPORT.md`, `docs/AI.md`, `docs/NOMAD.md`).

`ui-kit.html` is the visual ground truth. `docs/WORKFLOW.md` is the workflow/architecture ground truth.

---

## Product workflow

Keep the main researcher flow:

```text
Upload ZIP → Review → Results → Design → Report → NOMAD
```

Upload is always the experiment entry point. The app always opens on the Upload
ZIP screen, even when a workspace was previously saved: the first page is the
same empty Upload ZIP page reached after Reset all, and the researcher resumes
the saved flow manually via the stepper or Open Review. Do not resume a previous
experiment route on reload.

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

`LF.CanonicalStore` is a semantic index/view over the Working Copy, not a second model.

Use stable IDs, aliases, relations and evidence.

Original filenames are provenance. Do not use a filename as scientific sample identity when a better parsed/canonical identity exists.

If identity cannot be established deterministically, surface an ambiguity instead of guessing.

---

## OPERATION philosophy

A visible OPERATION is a researcher goal, not a code function.

The Workshop public set is limited to:

- Analyze dataset;
- Apply safe corrections;
- Resolve ambiguities;
- Infer missing design;
- Interpret results;
- Generate report;
- Improve report;
- Prepare NOMAD export.

Assistant Chat is an internal capability, not a Workshop OPERATION.

Internal services such as Results calculation, proposal application, evidence rebuilding and validation stay hidden.

### OPERATION types

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

- OPERATION title/kind;
- checkpoint progress;
- meaningful unit progress when present;
- Stop/Retry controls;
- provider output disclosure for AI.

Provider output is closed by default. It streams meaningful content/reasoning live and renders final Markdown/JSON using the active theme. Do not show a separate OPERATION/provider-note block.

---

## Deterministic-first Review

Review Data is useful immediately after import.

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

Chat and AI assists use bounded Context Packs built from Canonical Store references.

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

Output budgets belong to individual Operation contracts. Assistant has separate chat settings.

---

## Results

Results are deterministic and independent from Design.

Preserve:

- Overview;
- rankings;
- REF/non-REF separation;
- measurement table;
- warnings;
- JV curves;
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

The page must be useful with no provider:

- experiment bar with `design-chip` selector chips and a completion readout;
- AI suggestions panel (`design-ai-table-panel`) that fills only missing fields and never overwrites researcher-entered values;
- three editable scientific tables: solutions & solvents, fabrication, device stack;
- known/missing status;
- evidence/provenance;
- researcher edits.

`Infer missing design` is optional and works only on the currently selected experiment/device and missing fields.

Known and user-confirmed values are authoritative. AI proposals appear in progressive disclosure and must not silently overwrite them.

---

## Report Studio

The Markdown editor is the textual source of truth.

`Generate report` and `Improve report` update this editor. Researcher edits remain authoritative.

PDF/DOCX must export the current editor text, not regenerated parallel prose.

The editor uses a Write / Preview segmented control (`report-document-choice`, `role="tablist"`), not a three-way Split. "Improve selection" (`report.improve`) rewrites only the selected editor region and is exposed as an explicit action in the toolbar.

Figure selection is explicit and shared by preview/exports. Current available figure choices include PCE distribution, hysteresis distribution, best JV curve, PCE vs hysteresis, top efficiency and group comparison.

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

Chat, totems, Provider output and raw/structured views must use the active theme.

In light mode JSON/code surfaces remain light and readable. In dark mode text/surface contrast must remain accessible.

Markdown fenced JSON uses the same semantic JSON palette as dedicated structured output.

---

## Operations Workshop

Settings → Operations Workshop is a read-only inspector.

Group by researcher role/category and show:

- why the OPERATION exists;
- kind/role;
- dependencies;
- mutation scope;
- finite checkpoint flow;
- prompt/schema for AI;
- output budget for AI;
- last run.

Never turn Workshop into a runtime contract editor or expose internal implementation services as researcher goals.

---

## Documentation discipline

When workflow/architecture changes, update `docs/WORKFLOW.md` in the same patch and keep supporting docs/skill consistent.

A UI change that creates a new reusable interaction pattern should also update `ui-kit.html` and this skill.
