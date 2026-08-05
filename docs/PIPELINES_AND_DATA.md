# Pipelines, records and provenance

## Why pipelines are declarative

A pipeline describes workflow: ordered steps, labels, expected outputs and the shared project view used by each step. It does not duplicate HTML, component styling or export layouts. Pipeline steps organise work around domain records; they never replace the identities of a Process, Experiment, Result Set or Report.

```mermaid
flowchart LR
  A[Pipeline definition] --> B[Shared project renderer]
  B --> C[Process and experiment records]
  C --> D[Result sets and reviewed evidence]
  D --> E[Reports and export packages]
```

Pipeline identifiers and versions travel with the project and its export manifest. Steps remain revisitable. The current step indicates workflow focus rather than locking earlier records or evidence.

## CHOSE workflow contract

The primary perovskite workflow contains four user-facing steps:

```text
Process → Experiment → Results → Review & Export
```

The dedicated [CHOSE workflow guide](PIPELINE_CHOSE.md) documents the full screen, data and completion contract. The [pipeline catalog](PIPELINE_CATALOG.md) also describes the included Quick Measurement Review example.

The four steps are deliberately record-centred rather than screen-centred. Each step owns one scientific responsibility:

| Step | Creates or edits | Must not own | Primary completion question |
| --- | --- | --- | --- |
| Process | Versioned solution, substrate, operation and stack definitions | Prepared batches, operators, actual execution or result files | Is the reusable protocol explicit and versionable? |
| Experiment | Process snapshot, batches, samples/devices, actual parameters, timings and deviations | Rewriting the reusable Process or storing measurement files as notes | Is the real execution traceable? |
| Results | Source files, mapping, normalized records and deterministic quality state | Research conclusions or hidden automatic repairs | Are measurements linked, mapped and reviewable? |
| Review & Export | Comparisons, findings, human decisions, report and local packages | Model management, silent submission or evidence-free claims | Is the evidence ready for an approved output? |

### Process

Process defines a reusable, versioned laboratory protocol. It contains three contained sections rather than three additional pipeline steps:

- **Chemistry** — solution definitions, solvents, solutes, stock-solution references, scale formulas and handling instructions;
- **Fabrication** — substrate definition and an ordered sequence of planned preparation, deposition, annealing and contact operations;
- **Stack Review** — the expected device architecture derived from the fabrication sequence and reviewed by the researcher.

A Process stores planned values and expected evidence. It does not contain a prepared batch identifier, operator, actual execution time, sample instance or result file.

### Experiment

Experiment is a concrete execution of an immutable Process snapshot. It records:

- actual solution batches and material lots;
- substrate, sample and device instances;
- operator, date, equipment and environment;
- planned versus actual values;
- execution times, deviations and researcher decisions.

Editing a reusable Process never changes an existing Experiment. A new experiment references a specific Process version or snapshot.

### Results

Results creates named Result Sets linked to an Experiment. It separates:

- source files and their provenance;
- field and unit mapping;
- normalized derived records;
- deterministic quality review.

The product term is **Results** because file ingestion is an implementation operation rather than the researcher's objective.

### Review & Export

Review & Export contains four contained views:

- **Overview** — scientific KPIs, charts and the validated dataset;
- **Compare** — grouped experiment and process comparisons;
- **Findings** — deterministic issues, advisory findings and researcher review state;
- **Report & Export** — the canonical Report Composer, structured files, complete project package and local NOMAD preview.

Tools and AI model management remain in their dedicated product workspaces. The Project view may show evidence-linked findings but does not duplicate the global Ask LabFlow control.

## CHOSE interaction and layout contract

The Project page follows the shared workflow composition rather than exposing every domain object at once. The page-level navigator contains exactly four steps. Each step uses one contained tab bar for local sections and keeps its working data in the same wide page wrapper.

```text
Project context and status
→ four-step navigator
→ concise current-step heading
→ contained tabs
→ scientific work surface
→ explicit workflow actions
```

The Process step pairs editing with deterministic review. At wide desktop sizes Solution Builder and Solution Review remain side by side; they stack only when the available viewport would compress their fields. Fabrication tables, sample tables and execution tables keep their own horizontal scroll region.

A step can be revisited even after later work exists. Completion is a visible state, not a hard navigation lock. Blocking errors prevent the affected export or approval action; warnings remain attached to the record and may allow the researcher to proceed with an explicit caveat.

### Step gates

- **Process ready** — identifiers, units, required operations and stack representation are complete.
- **Experiment ready for Results** — process snapshot, batch/sample/device links and actual execution records exist; deviations are visible.
- **Results ready for Review** — files or manual records have stable provenance, mappings are confirmed and deterministic errors are resolved or explicitly blocking.
- **Review ready for package generation** — selected report sections, researcher text, findings and export limitations are visible. NOMAD remains a local readiness preview.

## Executable pipeline architecture

A pipeline has one entry contract and may reference smaller domain resources. The browser never fetches those files at runtime: the build helper resolves them into the checked-in pipeline bundle.

```text
pipeline.yaml
  ├─ identity and compatibility
  ├─ data boundaries
  ├─ steps, sections and registered components
  ├─ completion gates and expected evidence
  ├─ review/export policy
  └─ resource_refs
       ├─ record schemas
       ├─ controlled defaults and units
       ├─ import/export mappings
       └─ transparent demonstration records
```

The responsibilities remain separate:

| Layer | Owns | Must not own |
| --- | --- | --- |
| Pipeline contract | workflow, record expectations, completion and evidence policy | HTML, CSS or mutable project state |
| Record schemas | required fields, relationships and invariant checks | renderer layout |
| Defaults | controlled choices, operation families and units | actual experiment values |
| Mapping profiles | explicit source/target fields, units and conversion decisions | silent source mutation |
| Demo records | inspectable POC content | hidden production assumptions |
| Component registry | shared rendering and interaction functions | duplicated scientific definitions |
| Project state | the researcher’s current records and decisions | changes to the canonical pipeline definition |

A section references a stable component identifier. CHOSE uses a strict registry, so an unknown component fails visibly instead of silently falling back to unrelated markup.

## Pipeline registry and Pipeline Studio

Settings → Pipelines is the browser-facing registry for checked-in workflows. It manages session availability and the Create Project default, and provides a compact preview of identity, resources, steps and contract state. For the selected workflow it also exposes a **session step editor**: reorder, relabel and add steps, then watch the contract preview update immediately. Edited steps exist only in page memory and are never written back to the checked-in pipeline. The dedicated **Pipeline Studio** page is the POC editing surface: it displays the bundled `pipeline.yaml` entry contract and referenced YAML/JSON resources, allows temporary in-memory edits, applies syntax highlighting and lightweight structural checks, and can download the active draft for external review.

It provides:

- enable/disable controls for the current volatile session;
- one enabled default pipeline for the Create Project dialog;
- pipeline identity, version, domain, schema and resource-group inspection;
- a session step editor that reorders, relabels and extends steps with an immediate contract preview;
- strict completion-gate state for executable contracts such as CHOSE;
- links to the workflow and its documentation.

The registry obeys fail-safe UI rules: at least one workflow remains enabled; a disabled workflow cannot be selected as default; if the default is disabled, the first enabled workflow becomes default. The session step editor keeps the same boundary: its draft is volatile, standard step rows keep their stable ids so completion-gate evaluation still matches the source, and reordering, relabel or reset never touches the checked-in bundle. Existing projects remain readable even when their pipeline is not available for new project creation. Downloading `settings.yaml` creates a reviewable configuration copy only. Pipeline Studio follows the same boundary: source edits remain in memory, reload restores the checked-in bundle, and Download draft produces a review copy. Neither surface mutates `pipelines/<id>/pipeline.yaml` or another checked-in source.

## Canonical data layers

- `settings.yaml` defines checked-in product defaults and feature boundaries.
- `pipelines/<id>/pipeline.yaml` defines the workflow entry contract.
- Files referenced under `resource_refs` define schemas, defaults, mappings and transparent demonstration records.
- Project and experiment state remains a separate in-memory record layer.
- Browser snapshots mirror settings, resolved pipelines and documentation for request-free direct-file operation.
- Portable project packages include the resolved pipeline contract and its resource manifest so the scientific context travels with exported records.

After editing a canonical source, refresh its checked-in snapshot before validation. Generated snapshots are implementation artifacts, not competing documentation.

## Completion gates are data, not decoration

Each executable step states:

- `reads` and `creates` record classes;
- contained `sections` and their registered component IDs;
- `completion.requires` paths;
- deterministic `completion.rules` with severity;
- `completion.expected_evidence`;
- the action label and approval mode shown by the workflow footer.

The current POC exposes these values in the step heading and footer. `LabFlowPipelineRuntime.evaluateStep` also evaluates required paths, schema contracts, completion validators and upstream dependencies against the resolved records. A future backend can apply the same contract to persisted records without redesigning the page or inventing a separate workflow description.

## Contract build and validation

`tools/build_pipeline_bundle.py` resolves referenced YAML/JSON, prevents path escape, embeds each resource under `pipeline.resources`, and creates a separate local source snapshot for Pipeline Studio without runtime file requests. `tools/validate_poc.py` independently reconstructs the resolved registry and compares it with the checked-in bundle. For CHOSE it also verifies strict/fail-closed policy, component registration, dependency order, data boundaries, schema-required paths, collection identities, operation/layer references, source identities, mapping policy, review/provenance content and disabled remote NOMAD submission. `node tools/test_exports.mjs` executes the browser-side gates and verifies that all report formats consume the resolved resource model.


## Runtime source-of-truth flow

```mermaid
flowchart LR
  A[pipeline.yaml] --> B[Build-time resolver]
  C[schemas / defaults / mappings / demo] --> B
  B --> D[pipeline-bundle.js]
  D --> E[Pipeline runtime]
  E --> F[Registered scientific views]
  E --> G[Schema + completion + dependency gates]
  D --> H[Canonical report model]
  H --> I[Preview / PDF / DOCX / XLSX / LaTeX]
  D --> J[Portable project and NOMAD preview packages]
```

`assets/js/data.js` may expose compatibility arrays hydrated from the active pipeline for shared legacy render helpers, but those arrays are derived views. They are not the canonical CHOSE store and must not be edited independently.

## Record identity and lineage

Stable identifiers connect the domain flow:

```text
User → Workspace → Project → Process Version → Experiment → Sample / Device → Result Set → Measurement
```

A derived value retains its input record, method and unit. A report statement retains source, sample, metric and value. Renaming a display label must not break these links.

```mermaid
flowchart TD
  P[Process version] --> E[Experiment snapshot]
  E --> S[Sample and device]
  F[Source file] --> R[Result set]
  S --> R
  R --> M[Mapped raw record]
  M --> D[Derived normalized value]
  D --> A[Analysis result]
  A --> C[Reviewed statement]
  C --> X[Report and export package]
```

## Critical entity distinctions

The implementation and UI must preserve these non-equivalences:

```text
Solution Definition ≠ Prepared Solution Batch
Process Definition ≠ Process Version / Snapshot
Stack Definition ≠ Device Instance
Planned Parameter ≠ Actual Parameter
Experiment ≠ Result Set
Raw Value ≠ Derived Value
AI Finding ≠ Researcher Conclusion
```

A definition may be reused from the Lab Cabinet. Reuse creates a traceable snapshot or reference; later edits do not mutate historical experiments.

## Smart Import contract

Smart Import profiles a selected local file and proposes field mappings. The mapping table shows source column, target field, source unit, target unit, conversion and status. Normalized preview values are displayed before confirmation. Missing identifiers, invalid units and ambiguous columns are never silently repaired.

Import presets exist only during the page session. The source file remains conceptually immutable; normalized values are derived records with explicit lineage.

## Solution, process and stack structure

A **Solution Definition** includes type, composition, concentration, solvent ratio, quantities, units, scale formula, preparation handling, before-use handling and review state. A **Solution Batch** adds preparation date, operator, actual quantities, environmental context, QC and use links.

A **Process Definition** includes substrate constraints and ordered operations with planned parameters, expected duration, material or solution references and required/optional state. A **Process Version** freezes these fields for experiment reuse.

A **Stack Definition** includes ordered layers, material, thickness, function and producing process operation. Builder, Review, scientific visual and report preview consume the same ordered representation rather than maintaining parallel copies.

## AI-ready dataset records

Pipeline outputs may later become dataset inputs, but a pipeline step is never itself a training dataset. LabFlow creates an explicit **Dataset Snapshot** containing source projects and experiments, included and excluded samples, feature and target schemas, units, transformations, quality filters, split policy, creator, timestamp and version.

The canonical progression is:

```text
raw file → mapped measurement → validated record → derived feature → dataset snapshot → model run → prediction → human review
```

Raw, validated, processed, derived, predicted and researcher-approved values remain distinct. Labels and targets record whether they were observed, calculated, researcher-assigned, suggested or confirmed. No model output may overwrite a measurement or silently become a scientific conclusion.

## Data-quality severity

- **Error** blocks the affected export or scientific action.
- **Warning** requires review and may limit comparison.
- **Information** records a relevant deterministic fact.
- **Suggestion** proposes a next step without changing data.

Ambiguous free text may be interpreted only as a labelled suggestion. Missing scientific values are not invented.

## Change discipline

When a pipeline contract changes, update the pipeline source, data defaults, corresponding browser snapshot, UI Kit, canonical product documentation and validation expectations together. Remove obsolete guidance instead of leaving two workflow versions. When data or exporter contracts change, regenerate example artifacts and inspect their structure and visual presentation.
