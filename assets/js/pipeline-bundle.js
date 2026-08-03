/* Generated from pipeline YAML sources. Do not edit by hand. */
window.LabFlowPipelines = {
  "chose": {
    "id": "chose",
    "name": "CHOSE Perovskite Workflow",
    "version": 1.0,
    "status": "primary",
    "description": "Structured preparation, device stack definition, scientific data analysis, reporting and export for perovskite research.",
    "project_type": "perovskite-research",
    "accent": "blue",
    "steps": [
      {
        "id": "solutions",
        "title": "Solutions, Solvents & Solutes",
        "short_title": "Solutions",
        "view": "solutions",
        "description": "Reuse or define chemicals and prepare traceable solution batches.",
        "output": "Structured solution batches and recipes"
      },
      {
        "id": "stack",
        "title": "Stack Preparation",
        "short_title": "Stack",
        "view": "stack",
        "description": "Define ordered perovskite device layers, samples and fabrication context.",
        "output": "Device stacks and sample identifiers"
      },
      {
        "id": "ingest",
        "title": "Data Ingest",
        "short_title": "Data",
        "view": "ingest",
        "description": "Import or manually map measurements while preserving provenance.",
        "output": "Validated measurement datasets"
      },
      {
        "id": "analysis-report",
        "title": "Analysis & Report",
        "short_title": "Analysis",
        "view": "analysis",
        "description": "Visualise data, inspect quality, compare experiments and assemble evidence-linked reports.",
        "output": "Validated findings, comparisons, charts and report packages"
      },
      {
        "id": "export",
        "title": "Export",
        "short_title": "Export",
        "view": "export",
        "description": "Produce the project ZIP and a transparent NOMAD-ready package.",
        "output": "Project and NOMAD export bundles"
      }
    ]
  },
  "quick": {
    "id": "quick",
    "name": "Quick Measurement Review",
    "version": 1.0,
    "status": "example",
    "description": "A small example pipeline proving that LabFlow can host focused workflows without changing the application shell.",
    "project_type": "generic-measurement",
    "accent": "violet",
    "steps": [
      {
        "id": "plan",
        "title": "Plan",
        "short_title": "Plan",
        "view": "quick-plan",
        "description": "Define the question, sample and expected evidence.",
        "output": "Review plan"
      },
      {
        "id": "data",
        "title": "Add Data",
        "short_title": "Data",
        "view": "quick-data",
        "description": "Add a compact table or local measurement file.",
        "output": "Review dataset"
      },
      {
        "id": "report",
        "title": "Report",
        "short_title": "Report",
        "view": "quick-report",
        "description": "Summarise findings with one chart and a researcher conclusion.",
        "output": "Review report"
      },
      {
        "id": "export",
        "title": "Export",
        "short_title": "Export",
        "view": "export",
        "description": "Download a portable project bundle or NOMAD-ready preview.",
        "output": "Portable export bundle"
      }
    ]
  }
};
