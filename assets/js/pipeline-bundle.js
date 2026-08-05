/* Generated from pipeline YAML sources. Do not edit by hand. */
window.LabFlowPipelines = {
  "chose": {
    "id": "chose",
    "name": "CHOSE Perovskite Workflow",
    "version": 2.0,
    "status": "primary",
    "description": "Define reusable fabrication processes, execute traceable experiments, review measurement results and produce evidence-linked reports.",
    "project_type": "perovskite-research",
    "accent": "blue",
    "steps": [
      {
        "id": "process",
        "title": "Process Definition",
        "short_title": "Process",
        "view": "chose-process",
        "description": "Define reusable chemistry, substrate preparation, fabrication operations and the expected device stack.",
        "output": "Versioned process definition"
      },
      {
        "id": "experiment",
        "title": "Experiment Execution",
        "short_title": "Experiment",
        "view": "chose-experiment",
        "description": "Create an experiment from a process snapshot and record actual batches, samples, devices, timings and deviations.",
        "output": "Traceable experiment execution"
      },
      {
        "id": "results",
        "title": "Results",
        "short_title": "Results",
        "view": "chose-results",
        "description": "Attach result files, map scientific fields, normalize units and review result-set quality.",
        "output": "Validated result sets"
      },
      {
        "id": "review",
        "title": "Review & Export",
        "short_title": "Review",
        "view": "chose-review",
        "description": "Analyse and compare results, review findings, approve conclusions and generate transparent export packages.",
        "output": "Reviewed findings, reports and export packages"
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
