# POC architecture

## Product architecture

```text
Researcher
  ↓
Workspace
  ├── Lab Cabinet ── reusable definitions / physical resources
  ├── Processes ───── versioned scientific workflows
  │      └── Experiments ── concrete execution and evidence
  └── Projects ────── optional experiment grouping
               ↓
          Reports / Export / NOMAD
```

## Frontend modules

- `assets/theme.css`: tokens and light/dark themes.
- `assets/app.css`: shared shell and existing component library.
- `assets/workflow.css`: Process directory/detail, experiment directory, solvent builder and stack builder.
- `assets/exporters.js`: browser-generated files.
- `assets/workflow-domain.js`: Process/Experiment demo records and graphical domain interactions.
- `assets/app.js`: shell and remaining POC interactions.

The workflow module is a first low-risk separation from the original monolithic files. No framework or build step is introduced.

## Canonical destinations

| Area | Page |
| --- | --- |
| Workspace | `index.html` |
| Processes | `processes.html`, `pipeline.html` |
| Experiments | `experiments.html`, `experiment.html` |
| Solutions | `solution.html` |
| Stacks | `stack.html` |
| Lab Cabinet | `catalogs.html` |
| Results | `workspace.html` |
| Imports | `imports.html` |
| Reports / Export / NOMAD | `report.html` |
| Optional Projects | `projects.html`, `project.html` |
| Tools | `editors.html` |
| AI / Knowledge | `ai-assistant.html`, `knowledge.html` |
| Documentation | `documentation.html`, `docs/` |

## State

The static POC stores selected user, Process and optional Project in `localStorage`. This is an interface simulation, not a security boundary.

A production backend must enforce:

- workspace ownership and permissions;
- immutable published versions;
- experiment snapshots;
- file integrity and object storage;
- provenance and audit logs;
- secure secrets and external API calls;
- concurrent editing and validation.
