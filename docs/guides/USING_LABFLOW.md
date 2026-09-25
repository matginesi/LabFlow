---
title: Using LabFlow
section: Researcher guide
summary: Surface-by-surface reference for every route and Settings section.
order: 2
---

# Using LabFlow

LabFlow has four workflow steps and three workspace routes. Everything else lives inside **Settings**. This page maps the surface to the task.

## Workflow routes

| Route | What you do there |
|---|---|
| **Upload & Review** | Choose or drag the experiment ZIP, read the source receipt, and resolve the findings LabFlow raises before trusting the analysis. |
| **Results** | Inspect deterministic metrics: Overview, Data explorer, JV analyzer and Compare. Ranking eligibility and quality flags come from the calculated analysis. |
| **Design** | Fill the three domains (**Solution chemistry**, **Device stack**, **Fabrication process**) from experiment evidence, Cabinet/KB references or a reviewable AI proposal. |
| **Export** | Build the portable LabFlow package and the NOMAD-oriented projection, review readiness/metadata and keep export-only overrides. |

Workflow Previous/Next stays at the top of every workflow page. Utilities (Cabinet, Documentation, Settings) never receive workflow arrows.

## Workspace routes

- **Lab Cabinet** — reusable laboratory resources (formulations, stacks, process recipes, substrates, materials, instruments, software, setups, file formats). Save once, reuse intentionally; applying a resource copies a detached snapshot into the experiment.
- **Documentation** — the bundled Markdown library with search, topic catalog, article view and outline.
- **Settings** — configuration, reference management and support tools (sections below).

## Settings sections

| Section | Contents |
|---|---|
| **Service & model** (AI connection) | Provider, endpoint, model, API key and Browser Local setup: model cards, cache/runtime, compatibility check and startup behaviour. |
| **Actions** | Power-user Action definitions: step thinking policy, prompt overrides and reset. |
| **Assistant** | Reasoning preference, answer limit, research context target and conversation clearing. |
| **Knowledge Base** | Built-in library plus your JSONL references: search, edit, validate, import/export and reset. |
| **NOMAD** | NOMAD API/web addresses, credentials/token handling and the explicit non-networking upload stub. |
| **Workspace** | Institution, responsibilities/contacts, locations, storage profiles, profile export and Advanced (Diagnostics, UI Kit) access. |
| **Diagnostics** | Bounded runtime logs, storage status, export of diagnostics/logs and data-management summaries. |
| **UI Kit** | The executable catalogue of shared interface patterns (design reference for maintainers). |

## Everyday behaviour

- **Feedback** uses the Message Totem for transient messages and confirmations; progress, setup and long Actions use the Action Totem. Inline notices stay in the page.
- **AI is optional.** Imports, calculations, Design source projection, Cabinet/KB lookup and export preparation run without a provider. Only unresolved semantics reach a model, and only as a proposal until you accept it.
- **Nothing is overwritten silently.** Accepted corrections and Design values are the only writes into scientific state, and they carry provenance.
- **Upload accepts drag & drop** on the start card as well as the **Choose ZIP file** button. The original archive is never modified.
- **Reset session** (topbar) clears the in-browser session; export or save first if you need the working copy.

## When something looks wrong

Open **Settings → Diagnostics** for the runtime log and support exports, then see [Troubleshooting](TROUBLESHOOTING.md) for the boundary-by-boundary checklist.
