/* Generated from pipeline YAML sources and referenced resources. Do not edit by hand. */
window.LabFlowPipelines = {
  "chose": {
    "schema_version": "labflow.pipeline.v1",
    "id": "chose",
    "name": "CHOSE Perovskite Workflow",
    "version": "2.2.0",
    "status": "primary",
    "domain": "perovskite-photovoltaics",
    "description": "Define reusable fabrication processes, execute traceable experiments, review measurement results and produce evidence-linked reports.",
    "project_type": "perovskite-research",
    "accent": "blue",
    "compatibility": {
      "labflow": ">=0.1",
      "delivery": "static-bundled",
      "remote_requests": false
    },
    "runtime": {
      "renderer": "shared-project-workspace",
      "component_registry": "strict",
      "resource_loading": "build-time-bundled",
      "modules": [
        "assets/js/pipeline-runtime.js",
        "assets/js/app.js"
      ],
      "styles": [
        "ui/components/scientific.css"
      ]
    },
    "entities": [
      "process_definition",
      "process_version",
      "solution_definition",
      "solution_batch",
      "substrate_definition",
      "stack_definition",
      "experiment",
      "process_snapshot",
      "sample",
      "device",
      "result_set",
      "measurement",
      "finding",
      "report",
      "evidence_item"
    ],
    "resource_refs": {
      "schemas": {
        "process": "schemas/process.yaml",
        "experiment": "schemas/experiment.yaml",
        "results": "schemas/results.yaml",
        "review": "schemas/review.yaml"
      },
      "defaults": {
        "solution_types": "defaults/solution-types.yaml",
        "operation_types": "defaults/operation-types.yaml",
        "units": "defaults/units.yaml"
      },
      "mappings": {
        "jv": "mappings/jv-import.yaml",
        "nomad": "mappings/nomad.yaml"
      },
      "demo": {
        "process": "demo/process.yaml",
        "experiment": "demo/experiment.yaml",
        "results": "demo/results.yaml",
        "review": "demo/review.yaml"
      }
    },
    "data_boundaries": {
      "process": {
        "owns": [
          "reusable_definitions",
          "planned_parameters",
          "expected_duration",
          "required_capabilities",
          "expected_stack"
        ],
        "forbids": [
          "operator",
          "actual_parameters",
          "actual_timestamps",
          "solution_batch_id",
          "device_instance_id"
        ]
      },
      "experiment": {
        "owns": [
          "process_snapshot",
          "operator",
          "actual_parameters",
          "actual_timestamps",
          "material_batches",
          "solution_batches",
          "samples",
          "devices",
          "deviations"
        ],
        "forbids": [
          "mutation_of_process_snapshot"
        ]
      },
      "results": {
        "owns": [
          "source_files",
          "field_mapping_decisions",
          "normalized_records",
          "quality_findings"
        ],
        "preserves": [
          "immutable_source_files",
          "source_to_derived_provenance"
        ]
      },
      "review": {
        "owns": [
          "deterministic_findings",
          "ai_suggestions",
          "researcher_conclusions",
          "approval_state"
        ],
        "separates": [
          "observation",
          "calculation",
          "correlation",
          "hypothesis",
          "ai_suggestion",
          "researcher_conclusion"
        ]
      }
    },
    "steps": [
      {
        "id": "process",
        "title": "Process Definition",
        "short_title": "Process",
        "view": "chose-process",
        "description": "Define reusable chemistry, substrate preparation, fabrication operations and the expected device stack.",
        "output": "Versioned process definition",
        "reads": [
          "cabinet.material",
          "cabinet.solution_definition",
          "cabinet.substrate_definition",
          "cabinet.stack_definition"
        ],
        "creates": [
          "process_definition",
          "process_version",
          "solution_definition",
          "substrate_definition",
          "stack_definition"
        ],
        "sections": [
          {
            "id": "chemistry",
            "title": "Chemistry",
            "component": "chose.process.chemistry",
            "description": "Define reusable solution recipes without execution data."
          },
          {
            "id": "fabrication",
            "title": "Fabrication",
            "component": "chose.process.fabrication",
            "description": "Define substrate geometry and ordered planned operations."
          },
          {
            "id": "stack",
            "title": "Stack Review",
            "component": "chose.process.stack_review",
            "description": "Review the stack derived from fabrication operations."
          }
        ],
        "completion": {
          "label": "Approve process version",
          "mode": "blocking-errors",
          "requires": [
            "process.name",
            "process.process_id",
            "solution_definitions",
            "substrate",
            "fabrication_operations",
            "stack.layers"
          ],
          "rules": [
            {
              "id": "explicit-units",
              "validator": "all_quantities_have_units",
              "severity": "error"
            },
            {
              "id": "ordered-operations",
              "validator": "fabrication_operations_are_ordered",
              "severity": "error"
            },
            {
              "id": "producer-before-consumer",
              "validator": "stack_layers_have_producing_operations",
              "severity": "error"
            },
            {
              "id": "equipment-capabilities",
              "validator": "required_equipment_capabilities_are_declared",
              "severity": "warning"
            }
          ],
          "expected_evidence": [
            "process_definition",
            "process_version",
            "solution_definition_versions",
            "stack_definition"
          ]
        },
        "contract": {
          "schema_ref": "schemas.process",
          "demo_ref": "demo.process",
          "depends_on": []
        }
      },
      {
        "id": "experiment",
        "title": "Experiment Execution",
        "short_title": "Experiment",
        "view": "chose-experiment",
        "description": "Create an experiment from a process snapshot and record actual batches, samples, devices, timings and deviations.",
        "output": "Traceable experiment execution",
        "reads": [
          "process_version",
          "cabinet.material_batch",
          "cabinet.solution_batch",
          "cabinet.equipment"
        ],
        "creates": [
          "experiment",
          "process_snapshot",
          "sample",
          "device",
          "execution_record",
          "deviation_record"
        ],
        "sections": [
          {
            "id": "setup",
            "title": "Setup",
            "component": "chose.experiment.setup",
            "description": "Select the process snapshot, batches, samples and devices."
          },
          {
            "id": "execution",
            "title": "Execution",
            "component": "chose.experiment.execution",
            "description": "Record actual parameters, timing, equipment and deviations."
          },
          {
            "id": "summary",
            "title": "Summary",
            "component": "chose.experiment.summary",
            "description": "Review experiment completeness before result attachment."
          }
        ],
        "completion": {
          "label": "Complete experiment setup",
          "mode": "visible-warnings",
          "requires": [
            "experiment.experiment_id",
            "experiment.process_snapshot",
            "experiment.operator",
            "samples",
            "devices",
            "execution_records"
          ],
          "rules": [
            {
              "id": "immutable-snapshot",
              "validator": "process_snapshot_is_immutable",
              "severity": "error"
            },
            {
              "id": "actual-values",
              "validator": "required_operations_have_actual_values",
              "severity": "error"
            },
            {
              "id": "explicit-deviations",
              "validator": "deviations_are_explicit",
              "severity": "warning"
            },
            {
              "id": "environmental-context",
              "validator": "required_environment_fields_present",
              "severity": "warning"
            }
          ],
          "expected_evidence": [
            "process_snapshot",
            "batch_links",
            "sample_device_manifest",
            "experiment_execution_record",
            "deviations"
          ]
        },
        "contract": {
          "schema_ref": "schemas.experiment",
          "demo_ref": "demo.experiment",
          "depends_on": [
            "process"
          ]
        }
      },
      {
        "id": "results",
        "title": "Results",
        "short_title": "Results",
        "view": "chose-results",
        "description": "Attach result files, map scientific fields, normalize units and review result-set quality.",
        "output": "Validated result sets",
        "reads": [
          "experiment",
          "sample",
          "device",
          "mapping_profile"
        ],
        "creates": [
          "result_set",
          "source_file_manifest",
          "field_mapping_decision",
          "measurement",
          "quality_report"
        ],
        "sections": [
          {
            "id": "files",
            "title": "Files",
            "component": "chose.results.files",
            "description": "Create a result set and attach local source files."
          },
          {
            "id": "mapping",
            "title": "Mapping",
            "component": "chose.results.mapping",
            "description": "Confirm scientific fields, units and conversions."
          },
          {
            "id": "quality",
            "title": "Quality Review",
            "component": "chose.results.quality",
            "description": "Review deterministic completeness and provenance checks."
          }
        ],
        "completion": {
          "label": "Confirm normalized results",
          "mode": "blocking-errors",
          "requires": [
            "result_set.result_set_id",
            "result_set.experiment_id",
            "source_files",
            "mapping_decisions",
            "normalized_records"
          ],
          "rules": [
            {
              "id": "stable-identifiers",
              "validator": "result_records_have_stable_identifiers",
              "severity": "error"
            },
            {
              "id": "explicit-units",
              "validator": "mapped_quantities_have_units",
              "severity": "error"
            },
            {
              "id": "source-provenance",
              "validator": "derived_values_link_to_sources",
              "severity": "error"
            },
            {
              "id": "device-count",
              "validator": "declared_and_measured_device_counts_agree",
              "severity": "warning"
            },
            {
              "id": "quality-errors",
              "validator": "no_unresolved_quality_errors",
              "severity": "error"
            }
          ],
          "expected_evidence": [
            "source_file_manifest",
            "confirmed_field_mapping",
            "normalized_measurements",
            "deterministic_quality_report"
          ]
        },
        "contract": {
          "schema_ref": "schemas.results",
          "demo_ref": "demo.results",
          "mapping_refs": [
            "mappings.jv"
          ],
          "depends_on": [
            "experiment"
          ]
        }
      },
      {
        "id": "review",
        "title": "Review & Export",
        "short_title": "Review",
        "view": "chose-review",
        "description": "Analyse and compare results, review findings, approve conclusions and generate transparent export packages.",
        "output": "Reviewed findings, reports and export packages",
        "reads": [
          "process_snapshot",
          "experiment_execution_record",
          "result_set",
          "measurements",
          "quality_report",
          "approved_knowledge"
        ],
        "creates": [
          "finding",
          "researcher_conclusion",
          "report",
          "export_manifest",
          "nomad_readiness_preview"
        ],
        "sections": [
          {
            "id": "overview",
            "title": "Overview",
            "component": "chose.review.overview",
            "description": "Review KPIs, plots and the canonical measurement table."
          },
          {
            "id": "compare",
            "title": "Compare",
            "component": "chose.review.compare",
            "description": "Compare experiments and process conditions transparently."
          },
          {
            "id": "findings",
            "title": "Findings",
            "component": "chose.review.findings",
            "description": "Separate observations, calculations, suggestions and conclusions."
          },
          {
            "id": "report",
            "title": "Report & Export",
            "component": "chose.review.report_export",
            "description": "Compose reviewed reports and portable export packages."
          }
        ],
        "completion": {
          "label": "Approve report package",
          "mode": "human-approval",
          "requires": [
            "findings",
            "review.researcher_conclusion",
            "review.approval_state",
            "provenance_manifest"
          ],
          "rules": [
            {
              "id": "finding-evidence",
              "validator": "findings_link_to_evidence",
              "severity": "error"
            },
            {
              "id": "human-review",
              "validator": "ai_suggestions_have_human_decisions",
              "severity": "error"
            },
            {
              "id": "open-issues-visible",
              "validator": "export_contains_open_issues",
              "severity": "error"
            },
            {
              "id": "nomad-readiness",
              "validator": "nomad_required_fields_are_mapped",
              "severity": "warning"
            }
          ],
          "expected_evidence": [
            "process_snapshot",
            "experiment_execution_record",
            "source_file_provenance",
            "confirmed_field_mapping",
            "deterministic_quality_report",
            "reviewed_findings",
            "researcher_conclusion",
            "provenance_manifest"
          ]
        },
        "contract": {
          "schema_ref": "schemas.review",
          "demo_ref": "demo.review",
          "mapping_refs": [
            "mappings.nomad"
          ],
          "depends_on": [
            "results"
          ]
        }
      }
    ],
    "review_policy": {
      "finding_types": [
        "observation",
        "calculation",
        "correlation",
        "hypothesis",
        "validation_issue",
        "ai_suggestion",
        "researcher_conclusion"
      ],
      "human_review_required": [
        "hypothesis",
        "ai_suggestion",
        "researcher_conclusion"
      ],
      "irreversible_ai_actions": false
    },
    "exports": {
      "formats": [
        {
          "id": "pdf",
          "label": "Scientific PDF",
          "enabled": true
        },
        {
          "id": "docx",
          "label": "Editable DOCX",
          "enabled": true
        },
        {
          "id": "xlsx",
          "label": "Analysis workbook",
          "enabled": true
        },
        {
          "id": "latex",
          "label": "LaTeX report package",
          "enabled": true
        },
        {
          "id": "yaml",
          "label": "Project YAML",
          "enabled": true
        },
        {
          "id": "jsonl",
          "label": "Measurements JSONL",
          "enabled": true
        },
        {
          "id": "csv",
          "label": "Measurements CSV",
          "enabled": true
        },
        {
          "id": "bundle",
          "label": "Complete project package",
          "enabled": true
        }
      ],
      "require": [
        "approved_or_draft_report",
        "visible_open_issues",
        "source_manifest",
        "provenance_manifest"
      ],
      "nomad": {
        "enabled": true,
        "mode": "readiness_preview",
        "mapping_profile": "chose-perovskite-v1",
        "remote_submission": false
      }
    },
    "contract": {
      "strict": true,
      "fail_closed_completion": true,
      "stable_identifiers": true,
      "explicit_units": true,
      "preserve_source_records": true
    },
    "versioning": {
      "process_versions": "immutable-after-approval",
      "experiment_snapshot": "immutable",
      "mapping_decisions": "versioned-with-result-set",
      "review_history": "append-only"
    },
    "provenance_policy": {
      "source_records": "immutable",
      "derived_records": "must-reference-source",
      "ai_outputs": "must-reference-evidence-and-human-review",
      "exports": "must-preserve-open-issues"
    },
    "resources": {
      "schemas": {
        "process": {
          "schema_version": "labflow.record-schema.v1",
          "record_type": "process_version",
          "label": "CHOSE process version document",
          "record_path": "process",
          "stable_id_field": "process_id",
          "version_field": "version",
          "immutable_when": "approved",
          "document": {
            "required": [
              "process",
              "solution_definitions",
              "substrate",
              "fabrication_operations",
              "stack"
            ]
          },
          "fields": {
            "process_id": {
              "type": "string",
              "required": true,
              "pattern": "^PROC-CHOSE-[0-9]{3}$"
            },
            "version": {
              "type": "integer",
              "required": true,
              "minimum": 1
            },
            "name": {
              "type": "string",
              "required": true
            },
            "status": {
              "type": "enum",
              "required": true,
              "values": [
                "draft",
                "review",
                "approved",
                "superseded"
              ]
            }
          },
          "collections": {
            "solution_definitions": {
              "type": "object_list",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "id",
              "version_field": "version"
            },
            "fabrication_operations": {
              "type": "ordered_list",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "id"
            },
            "stack.layers": {
              "type": "ordered_list",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "id"
            }
          },
          "relationships": {
            "solution_definition": {
              "cardinality": "many",
              "versioned": true
            },
            "substrate_definition": {
              "path": "substrate",
              "cardinality": "one",
              "versioned": true
            },
            "stack_definition": {
              "path": "stack",
              "cardinality": "one",
              "versioned": true
            }
          },
          "validation": [
            {
              "id": "no-execution-fields",
              "validator": "forbidden_fields_absent",
              "fields": [
                "operator",
                "actual_parameters",
                "actual_timestamps",
                "solution_batch_id"
              ],
              "severity": "error"
            },
            {
              "id": "operation-order",
              "validator": "ordered_unique_positions",
              "path": "fabrication_operations",
              "severity": "error"
            },
            {
              "id": "stack-traceability",
              "validator": "every_stack_layer_has_producer",
              "severity": "error"
            }
          ]
        },
        "experiment": {
          "schema_version": "labflow.record-schema.v1",
          "record_type": "experiment",
          "label": "CHOSE experiment document",
          "record_path": "experiment",
          "stable_id_field": "experiment_id",
          "document": {
            "required": [
              "experiment",
              "batches",
              "samples",
              "devices",
              "execution_records"
            ]
          },
          "fields": {
            "experiment_id": {
              "type": "string",
              "required": true,
              "pattern": "^EXP-[0-9]{3}$"
            },
            "name": {
              "type": "string",
              "required": true
            },
            "process_snapshot": {
              "type": "object",
              "required": true,
              "immutable": true
            },
            "operator": {
              "type": "string",
              "required": true
            },
            "start_date": {
              "type": "date",
              "required": true
            },
            "environment": {
              "type": "object",
              "required": true
            }
          },
          "collections": {
            "batches": {
              "type": "relation_list",
              "relation": "solution_batch",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "id"
            },
            "samples": {
              "type": "relation_list",
              "relation": "sample",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "id"
            },
            "devices": {
              "type": "relation_list",
              "relation": "device",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "id"
            },
            "execution_records": {
              "type": "ordered_list",
              "item_type": "execution_record",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "operation_id"
            },
            "deviations": {
              "type": "object_list",
              "required": false,
              "stable_id_field": "id"
            }
          },
          "execution_record": {
            "required_fields": [
              "operation_id",
              "planned",
              "actual",
              "execution_time",
              "status"
            ],
            "optional_fields": [
              "equipment",
              "note"
            ]
          },
          "validation": [
            {
              "id": "snapshot-hash",
              "validator": "immutable_snapshot_has_hash",
              "severity": "error"
            },
            {
              "id": "required-operations",
              "validator": "required_operations_have_execution_records",
              "severity": "error"
            },
            {
              "id": "deviation-visibility",
              "validator": "changed_values_have_deviation_record",
              "severity": "warning"
            }
          ]
        },
        "results": {
          "schema_version": "labflow.record-schema.v1",
          "record_type": "result_set",
          "label": "CHOSE result-set document",
          "record_path": "result_set",
          "stable_id_field": "result_set_id",
          "document": {
            "required": [
              "result_set",
              "source_files",
              "mapping_decisions",
              "normalized_records",
              "quality_issues",
              "quality_context"
            ]
          },
          "fields": {
            "result_set_id": {
              "type": "string",
              "required": true,
              "pattern": "^RST-[A-Z0-9-]+$"
            },
            "name": {
              "type": "string",
              "required": true
            },
            "experiment_id": {
              "type": "relation",
              "relation": "experiment",
              "required": true
            },
            "measurement_type": {
              "type": "string",
              "required": true
            },
            "parser_profile": {
              "type": "relation",
              "relation": "mapping_profile",
              "required": true
            }
          },
          "collections": {
            "source_files": {
              "type": "object_list",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "demo_identity"
            },
            "mapping_decisions": {
              "type": "object_list",
              "required": true,
              "minimum_items": 1
            },
            "normalized_records": {
              "type": "object_list",
              "required": true,
              "minimum_items": 1
            },
            "quality_issues": {
              "type": "object_list",
              "required": true,
              "stable_id_field": "id"
            }
          },
          "source_file_contract": {
            "required_fields": [
              "file_name",
              "experiment_id",
              "demo_identity",
              "parser_profile",
              "parsing_status"
            ],
            "optional_fields": [
              "sample_scope",
              "acquisition_time",
              "instrument_id"
            ]
          },
          "validation": [
            {
              "id": "source-immutable",
              "validator": "source_file_identity_preserved",
              "severity": "error"
            },
            {
              "id": "mapping-decisions",
              "validator": "required_columns_have_decisions",
              "severity": "error"
            },
            {
              "id": "quantity-units",
              "validator": "normalized_quantities_have_units",
              "severity": "error"
            },
            {
              "id": "identity-links",
              "validator": "records_link_to_experiment_and_sample",
              "severity": "error"
            }
          ]
        },
        "review": {
          "schema_version": "labflow.record-schema.v1",
          "record_type": "scientific_review",
          "label": "CHOSE scientific review document",
          "record_path": "review",
          "stable_id_field": "review_id",
          "document": {
            "required": [
              "review",
              "findings",
              "overview",
              "comparison",
              "report",
              "provenance_manifest",
              "export_manifest"
            ]
          },
          "fields": {
            "review_id": {
              "type": "string",
              "required": true,
              "pattern": "^REV-[A-Z0-9-]+$"
            },
            "experiment_id": {
              "type": "relation",
              "relation": "experiment",
              "required": true
            },
            "result_set_id": {
              "type": "relation",
              "relation": "result_set",
              "required": true
            },
            "status": {
              "type": "enum",
              "required": true,
              "values": [
                "draft",
                "needs_revision",
                "approved"
              ]
            },
            "approval_state": {
              "type": "string",
              "required": true
            },
            "researcher_conclusion": {
              "type": "object",
              "required": true
            }
          },
          "collections": {
            "findings": {
              "type": "object_list",
              "required": true,
              "minimum_items": 1,
              "stable_id_field": "finding_id"
            },
            "provenance_manifest": {
              "type": "object_list",
              "required": true,
              "minimum_items": 1
            },
            "report.section_catalog": {
              "type": "object_list",
              "required": true,
              "minimum_items": 1
            }
          },
          "finding_contract": {
            "allowed_types": [
              "observation",
              "calculation",
              "correlation",
              "hypothesis",
              "validation_issue",
              "ai_suggestion",
              "researcher_conclusion"
            ],
            "required_fields": [
              "finding_id",
              "type",
              "statement",
              "evidence_refs",
              "review_status"
            ],
            "review_status_values": [
              "proposed",
              "needs_revision",
              "accepted",
              "rejected"
            ]
          },
          "validation": [
            {
              "id": "evidence-required",
              "validator": "every_finding_has_evidence",
              "severity": "error"
            },
            {
              "id": "ai-human-decision",
              "validator": "ai_findings_have_human_review_status",
              "severity": "error"
            },
            {
              "id": "source-derived-separation",
              "validator": "provenance_classes_are_explicit",
              "severity": "error"
            }
          ]
        }
      },
      "defaults": {
        "solution_types": {
          "schema_version": "labflow.defaults.v1",
          "id": "chose-solution-types",
          "items": [
            {
              "id": "perovskite_precursor",
              "label": "perovskite precursor",
              "role": "absorber"
            },
            {
              "id": "etl",
              "label": "n-type (ETL)",
              "role": "electron_transport"
            },
            {
              "id": "htl",
              "label": "p-type (HTL)",
              "role": "hole_transport"
            },
            {
              "id": "solvent",
              "label": "solvent"
            },
            {
              "id": "additive",
              "label": "additive"
            },
            {
              "id": "passivation",
              "label": "passivation agent/layer"
            },
            {
              "id": "conductor",
              "label": "conductor (contact)"
            },
            {
              "id": "encapsulant",
              "label": "encapsulant"
            },
            {
              "id": "semiconductor",
              "label": "semiconductor (intrinsic)"
            },
            {
              "id": "molecule",
              "label": "molecule"
            },
            {
              "id": "polymer",
              "label": "polymer"
            },
            {
              "id": "other",
              "label": "other"
            }
          ]
        },
        "operation_types": {
          "schema_version": "labflow.defaults.v1",
          "id": "chose-operation-types",
          "items": [
            {
              "id": "rinsing",
              "label": "Rinsing / washing",
              "category": "substrate_preparation"
            },
            {
              "id": "sonication",
              "label": "Sonication",
              "category": "substrate_preparation"
            },
            {
              "id": "uv_ozone",
              "label": "UV/Ozone",
              "category": "surface_treatment"
            },
            {
              "id": "spin_coating",
              "label": "Spin coating",
              "category": "deposition"
            },
            {
              "id": "annealing",
              "label": "Annealing",
              "category": "thermal"
            },
            {
              "id": "evaporation",
              "label": "Evaporation",
              "category": "deposition"
            },
            {
              "id": "custom",
              "label": "Custom operation",
              "category": "custom"
            }
          ]
        },
        "units": {
          "schema_version": "labflow.defaults.v1",
          "id": "chose-units",
          "quantities": {
            "volume": [
              "mL",
              "uL"
            ],
            "concentration": [
              "mol/L",
              "mmol/L",
              "mg/mL"
            ],
            "mass": [
              "mg",
              "g"
            ],
            "length": [
              "nm",
              "um",
              "mm",
              "cm"
            ],
            "temperature": [
              "degC",
              "K"
            ],
            "time": [
              "s",
              "min",
              "h"
            ],
            "rotation_speed": [
              "rpm"
            ],
            "pressure": [
              "mbar",
              "Pa"
            ],
            "current_density": [
              "mA/cm2",
              "A/m2"
            ],
            "voltage": [
              "V",
              "mV"
            ],
            "efficiency": [
              "%"
            ]
          },
          "normalization": {
            "current_density": "A/m2",
            "voltage": "V",
            "efficiency": "%"
          }
        }
      },
      "mappings": {
        "jv": {
          "schema_version": "labflow.mapping.v1",
          "id": "chose-jv-measurements",
          "label": "CHOSE Keithley JV CSV",
          "measurement_type": "jv_curve",
          "accepted_sources": [
            "csv",
            "tsv",
            "xlsx",
            "txt",
            "json"
          ],
          "preserve_source_columns": true,
          "require_unit_confirmation": true,
          "allow_silent_conversion": false,
          "required_links": [
            "experiment_id",
            "sample_id"
          ],
          "optional_links": [
            "device_id",
            "measurement_run_id"
          ],
          "fields": [
            {
              "source": "Sample_ID",
              "target": "device.identifier",
              "source_unit": "text",
              "target_unit": "text",
              "conversion": "none",
              "confidence": 99,
              "preview": "S08",
              "decision": "confirmed"
            },
            {
              "source": "Voc",
              "target": "measurements.jv.open_circuit_voltage",
              "source_unit": "V",
              "target_unit": "V",
              "conversion": "none",
              "confidence": 98,
              "preview": "1.13 V",
              "decision": "confirmed"
            },
            {
              "source": "Jsc",
              "target": "measurements.jv.short_circuit_current_density",
              "source_unit": "mA/cm2",
              "target_unit": "A/m2",
              "conversion": "multiply_10",
              "confidence": 94,
              "preview": "234 A/m2",
              "decision": "review"
            },
            {
              "source": "FF",
              "target": "measurements.jv.fill_factor",
              "source_unit": "%",
              "target_unit": "%",
              "conversion": "none",
              "confidence": 97,
              "preview": "80.5%",
              "decision": "confirmed"
            },
            {
              "source": "PCE",
              "target": "measurements.jv.efficiency",
              "source_unit": "%",
              "target_unit": "%",
              "conversion": "none",
              "confidence": 99,
              "preview": "21.28%",
              "decision": "confirmed"
            },
            {
              "source": "ScanDir",
              "target": "measurements.jv.scan_direction",
              "source_unit": "enum",
              "target_unit": "enum",
              "conversion": "FWD_to_forward",
              "confidence": 91,
              "preview": "forward",
              "decision": "review"
            }
          ],
          "quality_checks": [
            "missing_identifiers",
            "invalid_units",
            "duplicate_records",
            "orphan_samples",
            "device_count_mismatch",
            "incomplete_provenance"
          ]
        },
        "nomad": {
          "schema_version": "labflow.mapping.v1",
          "id": "chose-perovskite-v1",
          "label": "CHOSE perovskite NOMAD preview",
          "mode": "readiness_preview",
          "remote_submission": false,
          "required_entities": [
            "project",
            "process_version",
            "experiment",
            "sample",
            "result_set",
            "measurement"
          ],
          "required_fields": {
            "project": [
              "id",
              "name"
            ],
            "process_version": [
              "process_id",
              "version",
              "stack_definition"
            ],
            "experiment": [
              "experiment_id",
              "process_snapshot",
              "operator"
            ],
            "sample": [
              "sample_id",
              "experiment_id"
            ],
            "measurement": [
              "sample_id",
              "quantity",
              "value",
              "unit"
            ]
          },
          "provenance": {
            "require_source_manifest": true,
            "require_process_snapshot": true,
            "preserve_open_issues": true
          }
        }
      },
      "demo": {
        "process": {
          "schema_version": "labflow.demo.v1",
          "process": {
            "process_id": "PROC-CHOSE-014",
            "version": 2,
            "name": "CHOSE Standard v2",
            "status": "review",
            "stable_label": "PROC-CHOSE-014/v2"
          },
          "solution_definitions": [
            {
              "id": "SOL-011",
              "version": 3,
              "name": "FA/MA 1.25 M reference",
              "type": "perovskite precursor",
              "status": "reviewed",
              "solvent_ratio": "DMF:DMSO 4:1",
              "reference_volume": {
                "value": 2.0,
                "unit": "mL"
              },
              "target_concentration": {
                "value": 1.25,
                "unit": "mol/L"
              },
              "preparation_handling": "Prepare in N2 glovebox; keep away from moisture; filter with 0.22 um PTFE.",
              "before_use_handling": "Stir at 60 degC for 1 h and allow to cool before coating.",
              "state": "Homogeneous precursor",
              "components": [
                {
                  "name": "DMF",
                  "role": "Primary solvent",
                  "amount": "1.60 mL",
                  "share": "80% v/v",
                  "tone": "dmf",
                  "phase": "solvent"
                },
                {
                  "name": "DMSO",
                  "role": "Co-solvent",
                  "amount": "0.40 mL",
                  "share": "20% v/v",
                  "tone": "dmso",
                  "phase": "solvent"
                },
                {
                  "name": "FAI",
                  "role": "A-site solute",
                  "amount": "365.3 mg",
                  "share": "90 mol%",
                  "tone": "fai",
                  "phase": "solute"
                },
                {
                  "name": "MAI",
                  "role": "A-site solute",
                  "amount": "39.7 mg",
                  "share": "10 mol%",
                  "tone": "mai",
                  "phase": "solute"
                },
                {
                  "name": "PbI2",
                  "role": "Lead halide",
                  "amount": "1152.5 mg",
                  "share": "1.00 eq",
                  "tone": "pbi",
                  "phase": "solute"
                }
              ],
              "checks": [
                {
                  "label": "Formula balanced",
                  "state": "valid"
                },
                {
                  "label": "Units explicit",
                  "state": "valid"
                },
                {
                  "label": "Handling metadata incomplete",
                  "state": "warning"
                }
              ]
            },
            {
              "id": "SOL-021",
              "version": 2,
              "name": "SnO2 diluted 1:5",
              "type": "n-type (ETL)",
              "status": "reviewed",
              "solvent_ratio": "DI water",
              "summary": "DI water · reviewed"
            },
            {
              "id": "SOL-017",
              "version": 2,
              "name": "Spiro-OMeTAD standard",
              "type": "p-type (HTL)",
              "status": "draft",
              "solvent_ratio": "Chlorobenzene",
              "summary": "Chlorobenzene · draft"
            }
          ],
          "substrate": {
            "id": "SUB-ITO-01",
            "version": 2,
            "name": "ITO glass substrate",
            "material": "Glass / ITO",
            "alternatives": [
              "Glass / FTO",
              "Flexible ITO / PET"
            ],
            "rigidity": "Rigid",
            "rigidity_options": [
              "Rigid",
              "Flexible"
            ],
            "roughness_rms": {
              "value": 1,
              "unit": "nm"
            },
            "dimensions": {
              "length": {
                "value": 2,
                "unit": "cm"
              },
              "width": {
                "value": 2,
                "unit": "cm"
              },
              "thickness": {
                "value": 1,
                "unit": "mm"
              }
            }
          },
          "fabrication_operations": [
            {
              "id": "OP-01",
              "type": "rinsing",
              "label": "Rinsing / washing",
              "material": "IPA · DI water",
              "planned": "3 cycles",
              "target": "10 min",
              "required": true,
              "capability": "wet_bench"
            },
            {
              "id": "OP-02",
              "type": "sonication",
              "label": "Sonication",
              "material": "IPA",
              "planned": "40 kHz",
              "target": "10 min",
              "required": true,
              "capability": "sonicator"
            },
            {
              "id": "OP-03",
              "type": "uv_ozone",
              "label": "UV/Ozone",
              "material": "none",
              "planned": "Ambient",
              "target": "15 min",
              "required": true,
              "capability": "uv_ozone_cleaner"
            },
            {
              "id": "OP-04",
              "type": "spin_coating",
              "label": "Spin coating",
              "material": "SOL-021 · SnO2",
              "planned": "4000 rpm",
              "target": "30 s",
              "required": true,
              "capability": "spin_coater",
              "produces_layer": "L02"
            },
            {
              "id": "OP-05",
              "type": "annealing",
              "label": "Annealing",
              "material": "none",
              "planned": "100 degC",
              "target": "30 min",
              "required": true,
              "capability": "hotplate"
            },
            {
              "id": "OP-06",
              "type": "spin_coating",
              "label": "Spin coating",
              "material": "SOL-011 · precursor",
              "planned": "4000 rpm",
              "target": "30 s",
              "required": true,
              "capability": "spin_coater",
              "produces_layer": "L03"
            },
            {
              "id": "OP-07",
              "type": "evaporation",
              "label": "Evaporation",
              "material": "Au",
              "planned": "2e-6 mbar",
              "target": "80 nm",
              "required": true,
              "capability": "thermal_evaporator",
              "produces_layer": "L05"
            }
          ],
          "stack": {
            "id": "STK-003",
            "version": 2,
            "architecture": "n-i-p",
            "layers": [
              {
                "id": "L01",
                "material": "Glass / FTO",
                "thickness": "2.2 mm",
                "function": "Substrate + front contact",
                "process": "Cleaning",
                "tone": "substrate",
                "producer": "substrate"
              },
              {
                "id": "L02",
                "material": "SnO2",
                "thickness": "32 nm",
                "function": "Electron transport",
                "process": "Spin coat",
                "tone": "etl",
                "producer": "OP-04"
              },
              {
                "id": "L03",
                "material": "FA/MA perovskite",
                "thickness": "540 nm",
                "function": "Photoactive absorber",
                "process": "Anti-solvent",
                "tone": "absorber",
                "producer": "OP-06"
              },
              {
                "id": "L04",
                "material": "Spiro-OMeTAD",
                "thickness": "180 nm",
                "function": "Hole transport",
                "process": "Spin coat",
                "tone": "htl",
                "producer": "process_variant"
              },
              {
                "id": "L05",
                "material": "Au",
                "thickness": "80 nm",
                "function": "Back contact",
                "process": "Evaporation",
                "tone": "contact",
                "producer": "OP-07"
              }
            ]
          },
          "validation": {
            "summary": {
              "errors": 0,
              "warnings": 0
            },
            "checks": [
              {
                "state": "success",
                "title": "Operation order is coherent",
                "detail": "Substrate preparation precedes coating; transport and contact layers have producers."
              },
              {
                "state": "success",
                "title": "Equipment capabilities are declared",
                "detail": "Required capability categories are explicit; concrete equipment is assigned during Experiment execution."
              }
            ],
            "rule_results": {
              "explicit-units": {
                "status": "pass",
                "detail": "Reference volumes, concentrations, substrate geometry and stack thicknesses declare units."
              },
              "ordered-operations": {
                "status": "pass",
                "detail": "Seven uniquely identified fabrication operations are stored in order."
              },
              "producer-before-consumer": {
                "status": "pass",
                "detail": "Every stack layer references a fabrication producer or an explicit external producer."
              },
              "equipment-capabilities": {
                "status": "pass",
                "detail": "Every required operation declares a required equipment capability category."
              }
            }
          }
        },
        "experiment": {
          "schema_version": "labflow.demo.v1",
          "experiment": {
            "experiment_id": "EXP-067",
            "name": "Mixed-cation validation batch",
            "status": "review",
            "start_date": "2026-08-03",
            "operator": "Matteo Ginesi",
            "operator_options": [
              "Matteo Ginesi",
              "Laura Conti"
            ],
            "environment": {
              "atmosphere": "N2 glovebox",
              "temperature": {
                "value": 24,
                "unit": "degC"
              },
              "humidity": null
            },
            "environment_options": [
              "N2 glovebox",
              "Ambient laboratory"
            ],
            "process_snapshot": {
              "process_id": "PROC-CHOSE-014",
              "version": 2,
              "label": "CHOSE Standard v2 · PROC-CHOSE-014/v2",
              "immutable": true,
              "demo_hash": "sha256:poc-process-snapshot-014-v2"
            },
            "execution_window": "03 Aug 2026 · 09:10–15:32"
          },
          "batches": [
            {
              "id": "SOL-B01",
              "definition": "SOL-011/v3",
              "prepared": "2.00 mL",
              "operator": "01 Aug · MG",
              "status": "reviewed"
            },
            {
              "id": "SOL-B03",
              "definition": "SOL-011/v3",
              "prepared": "1.50 mL",
              "operator": "02 Aug · MG",
              "status": "reviewed"
            },
            {
              "id": "HTL-B02",
              "definition": "SOL-017/v2",
              "prepared": "1.00 mL",
              "operator": "02 Aug · LC",
              "status": "review"
            }
          ],
          "samples": [
            {
              "id": "S06",
              "substrate": "SUB-ITO-01/v2",
              "variant": "Reference",
              "precursor_batch": "B04",
              "devices": 6,
              "status": "review"
            },
            {
              "id": "S07",
              "substrate": "SUB-ITO-01/v2",
              "variant": "Anneal +5 degC",
              "precursor_batch": "B05",
              "devices": 6,
              "status": "active"
            },
            {
              "id": "S08",
              "substrate": "SUB-ITO-01/v2",
              "variant": "Anneal +5 degC",
              "precursor_batch": "B06",
              "devices": 8,
              "status": "active"
            }
          ],
          "execution_records": [
            {
              "operation_id": "OP-01",
              "order": 1,
              "operation": "Rinsing / washing",
              "planned": "3 cycles",
              "actual": "3 cycles",
              "execution_time": "09:10–09:20",
              "equipment": "Wet bench",
              "status": "completed"
            },
            {
              "operation_id": "OP-02",
              "order": 2,
              "operation": "Sonication",
              "planned": "40 kHz · 10 min",
              "actual": "40 kHz · 10 min",
              "execution_time": "09:22–09:32",
              "equipment": "Wet bench",
              "status": "completed"
            },
            {
              "operation_id": "OP-03",
              "order": 3,
              "operation": "UV/Ozone",
              "planned": "15 min",
              "actual": "15 min",
              "execution_time": "09:40–09:55",
              "equipment": "Wet bench",
              "status": "completed"
            },
            {
              "operation_id": "OP-04",
              "order": 4,
              "operation": "SnO2 spin coating",
              "planned": "4000 rpm · 30 s",
              "actual": "3980 rpm · 30 s",
              "execution_time": "10:04",
              "equipment": "Spin coater 02",
              "status": "completed"
            },
            {
              "operation_id": "OP-05",
              "order": 5,
              "operation": "ETL annealing",
              "planned": "100 degC · 30 min",
              "actual": "100 degC · 28 min",
              "execution_time": "10:06–10:34",
              "equipment": "Spin coater 02",
              "status": "deviation"
            },
            {
              "operation_id": "OP-06",
              "order": 6,
              "operation": "Perovskite coating",
              "planned": "4000 rpm · 30 s",
              "actual": "4000 rpm · 30 s",
              "execution_time": "11:02",
              "equipment": "Spin coater 02",
              "status": "completed"
            },
            {
              "operation_id": "OP-07",
              "order": 7,
              "operation": "Au evaporation",
              "planned": "80 nm",
              "actual": "82 nm",
              "execution_time": "15:20",
              "equipment": "Thermal evaporator",
              "status": "completed"
            }
          ],
          "deviations": [
            {
              "id": "DEV-EXP-067-01",
              "operation_id": "OP-05",
              "statement": "ETL annealing ended two minutes earlier than planned.",
              "impact": "Minor · retain sample",
              "decision": "Keep visible in comparison"
            }
          ],
          "completion": {
            "recorded_operations": 7,
            "required_operations": 7,
            "warnings": [
              "Humidity is missing"
            ],
            "ready_for_results": true
          },
          "devices": [
            {
              "id": "S06-D01",
              "sample_id": "S06",
              "status": "declared"
            },
            {
              "id": "S06-D02",
              "sample_id": "S06",
              "status": "declared"
            },
            {
              "id": "S06-D03",
              "sample_id": "S06",
              "status": "declared"
            },
            {
              "id": "S06-D04",
              "sample_id": "S06",
              "status": "declared"
            },
            {
              "id": "S06-D05",
              "sample_id": "S06",
              "status": "declared"
            },
            {
              "id": "S06-D06",
              "sample_id": "S06",
              "status": "declared"
            },
            {
              "id": "S07-D01",
              "sample_id": "S07",
              "status": "declared"
            },
            {
              "id": "S07-D02",
              "sample_id": "S07",
              "status": "declared"
            },
            {
              "id": "S07-D03",
              "sample_id": "S07",
              "status": "declared"
            },
            {
              "id": "S07-D04",
              "sample_id": "S07",
              "status": "declared"
            },
            {
              "id": "S07-D05",
              "sample_id": "S07",
              "status": "declared"
            },
            {
              "id": "S07-D06",
              "sample_id": "S07",
              "status": "declared"
            },
            {
              "id": "S08-D01",
              "sample_id": "S08",
              "status": "declared"
            },
            {
              "id": "S08-D02",
              "sample_id": "S08",
              "status": "declared"
            },
            {
              "id": "S08-D03",
              "sample_id": "S08",
              "status": "declared"
            },
            {
              "id": "S08-D04",
              "sample_id": "S08",
              "status": "declared"
            },
            {
              "id": "S08-D05",
              "sample_id": "S08",
              "status": "declared"
            },
            {
              "id": "S08-D06",
              "sample_id": "S08",
              "status": "declared"
            },
            {
              "id": "S08-D07",
              "sample_id": "S08",
              "status": "declared"
            },
            {
              "id": "S08-D08",
              "sample_id": "S08",
              "status": "declared"
            }
          ],
          "validation": {
            "rule_results": {
              "immutable-snapshot": {
                "status": "pass",
                "detail": "The process snapshot is immutable and carries a demonstration hash."
              },
              "actual-values": {
                "status": "pass",
                "detail": "All seven required operations have actual values and execution times."
              },
              "explicit-deviations": {
                "status": "pass",
                "detail": "The shortened annealing operation has a linked deviation record."
              },
              "environmental-context": {
                "status": "warning",
                "detail": "Humidity is missing from the environment record."
              }
            }
          }
        },
        "results": {
          "schema_version": "labflow.demo.v1",
          "result_set": {
            "result_set_id": "RST-JV-067-01",
            "name": "EXP-067 forward and reverse JV",
            "experiment_id": "EXP-067",
            "measurement_type": "J-V curve",
            "instrument": "Keithley 2450",
            "acquired_by": "Matteo Ginesi",
            "parser_profile": "chose-jv-measurements"
          },
          "source_files": [
            {
              "file_name": "batch_B03_forward.csv",
              "experiment_id": "EXP-067",
              "sample_scope": "S06–S08 · 12 devices",
              "measurement_type": "JV forward",
              "rows": 126,
              "parser": "Keithley JV CSV",
              "quality": "reviewed",
              "demo_identity": "sha256:2b798c1abbd704b9a02c01a6",
              "parser_profile": "chose-jv-measurements",
              "parsing_status": "parsed"
            },
            {
              "file_name": "batch_B03_reverse.csv",
              "experiment_id": "EXP-067",
              "sample_scope": "S06–S08 · 12 devices",
              "measurement_type": "JV reverse",
              "rows": 126,
              "parser": "Keithley JV CSV",
              "quality": "reviewed",
              "demo_identity": "sha256:ef1f4e1bffc99a6a2b607565",
              "parser_profile": "chose-jv-measurements",
              "parsing_status": "parsed"
            },
            {
              "file_name": "aging_500h.xlsx",
              "experiment_id": "EXP-052",
              "sample_scope": "S04–S05",
              "measurement_type": "Stability",
              "rows": 640,
              "parser": "Stability v2",
              "quality": "review",
              "quality_label": "2 gaps",
              "demo_identity": "sha256:f9ec4ea5c9572e524b6f594b",
              "parser_profile": "chose-jv-measurements",
              "parsing_status": "review"
            },
            {
              "file_name": "uvvis_reference.txt",
              "experiment_id": "EXP-041",
              "sample_scope": "S01–S03",
              "measurement_type": "UV–Vis",
              "rows": 356,
              "parser": "UV–Vis Cary",
              "quality": "reviewed",
              "demo_identity": "sha256:4d777bb754450f88fce2708d",
              "parser_profile": "chose-jv-measurements",
              "parsing_status": "parsed"
            }
          ],
          "quality_issues": [
            {
              "id": "DQ-001",
              "severity": "error",
              "title": "Device count conflicts with imported data",
              "detail": "EXP-067 declares 20 devices, while batch_B03_forward.csv contains 24 JV measurements.",
              "source": "Deterministic validation",
              "evidence": "EXP-067 · batch_B03_forward.csv"
            },
            {
              "id": "DQ-002",
              "severity": "warning",
              "title": "Annealing unit is missing",
              "detail": "EXP-067 records annealing temperature as 100 without an explicit unit.",
              "source": "Deterministic validation",
              "evidence": "EXP-067 · process.annealing.temperature"
            },
            {
              "id": "DQ-003",
              "severity": "warning",
              "title": "Solution preparation is not linked",
              "detail": "Batch B06 is used by S08 but EXP-067 has no solution preparation link.",
              "source": "Deterministic validation",
              "evidence": "EXP-067 · S08 · B06"
            },
            {
              "id": "DQ-004",
              "severity": "suggestion",
              "title": "Clarify the coating note",
              "detail": "The note “briefly before annealing” is ambiguous; record an elapsed time instead of inferring one.",
              "source": "AI interpretation",
              "evidence": "EXP-067 · fabrication note"
            },
            {
              "id": "DQ-005",
              "severity": "information",
              "title": "NOMAD preview can be prepared",
              "detail": "Required project and sample identifiers exist; the three issues above remain visible in the package.",
              "source": "Deterministic validation",
              "evidence": "KB-GUIDE-008 · PRJ-2026-014"
            }
          ],
          "normalized_records": [
            {
              "sample": "S01",
              "formulation": "FA0.85MA0.15",
              "batch": "B01",
              "voc": 1.08,
              "jsc": 22.7,
              "ff": 78.1,
              "pce": 19.15,
              "stability": 89,
              "hysteresis": 3.2,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            },
            {
              "sample": "S02",
              "formulation": "FA0.85MA0.15",
              "batch": "B01",
              "voc": 1.1,
              "jsc": 23.2,
              "ff": 79.0,
              "pce": 20.16,
              "stability": 91,
              "hysteresis": 2.8,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            },
            {
              "sample": "S03",
              "formulation": "FA0.80MA0.20",
              "batch": "B02",
              "voc": 1.07,
              "jsc": 22.9,
              "ff": 77.3,
              "pce": 18.94,
              "stability": 85,
              "hysteresis": 4.1,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            },
            {
              "sample": "S04",
              "formulation": "FA0.90MA0.10",
              "batch": "B03",
              "voc": 1.12,
              "jsc": 23.5,
              "ff": 80.2,
              "pce": 21.1,
              "stability": 94,
              "hysteresis": 2.1,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            },
            {
              "sample": "S05",
              "formulation": "FA0.90MA0.10",
              "batch": "B03",
              "voc": 1.09,
              "jsc": 23.0,
              "ff": 79.4,
              "pce": 19.9,
              "stability": 92,
              "hysteresis": 2.5,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            },
            {
              "sample": "S06",
              "formulation": "FA0.75MA0.25",
              "batch": "B04",
              "voc": 1.05,
              "jsc": 21.8,
              "ff": 75.8,
              "pce": 17.36,
              "stability": 78,
              "hysteresis": 5.9,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            },
            {
              "sample": "S07",
              "formulation": "FA0.85MA0.15",
              "batch": "B05",
              "voc": 1.11,
              "jsc": 23.1,
              "ff": 79.7,
              "pce": 20.44,
              "stability": 90,
              "hysteresis": 2.7,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            },
            {
              "sample": "S08",
              "formulation": "FA0.90MA0.10",
              "batch": "B06",
              "voc": 1.13,
              "jsc": 23.4,
              "ff": 80.5,
              "pce": 21.28,
              "stability": 95,
              "hysteresis": 1.9,
              "experiment_id": "EXP-067",
              "source_file": "batch_B03_forward.csv",
              "result_set_id": "RST-JV-067-01"
            }
          ],
          "mapping_decisions": [
            {
              "source": "Sample_ID",
              "target": "device.identifier",
              "decision": "confirmed",
              "source_unit": "text",
              "target_unit": "text",
              "conversion": "none"
            },
            {
              "source": "Voc",
              "target": "measurements.jv.open_circuit_voltage",
              "decision": "confirmed",
              "source_unit": "V",
              "target_unit": "V",
              "conversion": "none"
            },
            {
              "source": "Jsc",
              "target": "measurements.jv.short_circuit_current_density",
              "decision": "review",
              "source_unit": "mA/cm2",
              "target_unit": "A/m2",
              "conversion": "multiply_10"
            },
            {
              "source": "FF",
              "target": "measurements.jv.fill_factor",
              "decision": "confirmed",
              "source_unit": "%",
              "target_unit": "%",
              "conversion": "none"
            },
            {
              "source": "PCE",
              "target": "measurements.jv.efficiency",
              "decision": "confirmed",
              "source_unit": "%",
              "target_unit": "%",
              "conversion": "none"
            },
            {
              "source": "ScanDir",
              "target": "measurements.jv.scan_direction",
              "decision": "review",
              "source_unit": "enum",
              "target_unit": "enum",
              "conversion": "FWD_to_forward"
            }
          ],
          "quality_context": {
            "declared_devices": 20,
            "measured_devices": 24,
            "unresolved_errors": 1,
            "unresolved_warnings": 2
          },
          "interpretation": [
            {
              "type": "observation",
              "label": "Observed data",
              "statement": "S06 has PCE 17.36%; the source-aligned result set contains the imported measurements."
            },
            {
              "type": "correlation",
              "label": "Correlation",
              "statement": "The same experiment has incomplete solution and annealing provenance."
            },
            {
              "type": "hypothesis",
              "label": "Hypothesis",
              "statement": "Process variation may contribute. This is not demonstrated by the available data."
            },
            {
              "type": "suggestion",
              "label": "Suggestion",
              "statement": "Complete provenance and repeat the deterministic comparison."
            }
          ],
          "validation": {
            "rule_results": {
              "stable-identifiers": {
                "status": "pass",
                "detail": "Every normalized record links result set, experiment, sample and source file."
              },
              "explicit-units": {
                "status": "pass",
                "detail": "Mapped scientific quantities inherit explicit target units from the mapping profile."
              },
              "source-provenance": {
                "status": "pass",
                "detail": "Every normalized record preserves its source-file identity."
              },
              "device-count": {
                "status": "warning",
                "detail": "EXP-067 declares 20 devices while source files contain 24 device measurements."
              }
            }
          }
        },
        "review": {
          "schema_version": "labflow.demo.v1",
          "review": {
            "review_id": "REV-EXP-067-01",
            "experiment_id": "EXP-067",
            "result_set_id": "RST-JV-067-01",
            "status": "needs_revision",
            "approval_state": "Pending researcher approval",
            "researcher_conclusion": {
              "conclusion_id": "CON-EXP-067-01",
              "statement": "FA0.90MA0.10 is the strongest current candidate. S04 and S08 should proceed to validation; S06 and the unresolved provenance gaps require review before a final scientific claim is approved.",
              "author": "Matteo Ginesi",
              "review_status": "proposed",
              "evidence_refs": [
                "S04",
                "S06",
                "S08",
                "RST-JV-067-01"
              ]
            }
          },
          "findings": [
            {
              "finding_id": "FND-001",
              "type": "researcher_conclusion",
              "score": 96,
              "title": "FA0.90MA0.10 is the strongest candidate",
              "statement": "S04 and S08 lead both PCE and stability, with the lowest hysteresis.",
              "evidence_refs": [
                "S04",
                "S08",
                "RST-JV-067-01"
              ],
              "evidence_label": "S04, S08 · 7 metrics",
              "review_status": "accepted"
            },
            {
              "finding_id": "FND-002",
              "type": "validation_issue",
              "score": 91,
              "title": "S06 is a multi-metric outlier",
              "statement": "PCE, fill factor and stability are jointly below the robust cohort range; review fabrication notes before exclusion.",
              "evidence_refs": [
                "S06",
                "DQ-001"
              ],
              "evidence_label": "S06 · IQR + robust z",
              "review_status": "needs_revision"
            },
            {
              "finding_id": "FND-003",
              "type": "calculation",
              "score": 88,
              "title": "Batch effect is smaller than formulation effect",
              "statement": "Within-batch variation is limited compared with the shift between formulations.",
              "evidence_refs": [
                "RST-JV-067-01"
              ],
              "evidence_label": "Grouped comparison",
              "review_status": "accepted"
            },
            {
              "finding_id": "FND-004",
              "type": "correlation",
              "score": 84,
              "title": "Stability and hysteresis are inversely associated",
              "statement": "Lower hysteresis appears in the most stable devices; the sample count does not support a causal claim.",
              "evidence_refs": [
                "RST-JV-067-01"
              ],
              "evidence_label": "Spearman preview",
              "review_status": "needs_revision"
            },
            {
              "finding_id": "FND-005",
              "type": "ai_suggestion",
              "score": 78,
              "title": "Two metadata gaps limit reproducibility",
              "statement": "Humidity during coating and elapsed time before annealing are missing for B04 and B05.",
              "evidence_refs": [
                "DQ-002",
                "DQ-003"
              ],
              "evidence_label": "Process records",
              "review_status": "proposed"
            }
          ],
          "overview": {
            "metrics": [
              {
                "id": "best_pce",
                "label": "Best PCE",
                "field": "pce",
                "aggregation": "max",
                "format": "percent_2",
                "detail_field": "sample"
              },
              {
                "id": "mean_pce",
                "label": "Mean PCE",
                "field": "pce",
                "aggregation": "mean",
                "format": "percent_2",
                "detail": "cohort"
              },
              {
                "id": "mean_voc",
                "label": "Mean Voc",
                "field": "voc",
                "aggregation": "mean",
                "format": "voltage_2",
                "detail": "cohort"
              },
              {
                "id": "mean_stability",
                "label": "Stability",
                "field": "stability",
                "aggregation": "mean",
                "format": "percent_0",
                "detail": "normalized"
              },
              {
                "id": "findings",
                "label": "Findings",
                "source": "findings",
                "aggregation": "count",
                "format": "integer",
                "detail": "human review retained"
              }
            ],
            "chart_metrics": [
              {
                "id": "pce",
                "label": "PCE",
                "suffix": "%",
                "decimals": 2
              },
              {
                "id": "stability",
                "label": "Stability",
                "suffix": "%",
                "decimals": 0
              },
              {
                "id": "hysteresis",
                "label": "Hysteresis",
                "suffix": "%",
                "decimals": 1
              }
            ]
          },
          "comparison": {
            "included_experiments": [
              "EXP-041",
              "EXP-052",
              "EXP-067"
            ],
            "selection_criteria": "Current project · uses DMSO",
            "parameters": [
              "Annealing",
              "formulation",
              "batch"
            ],
            "measurements": [
              "PCE",
              "Voc",
              "Jsc",
              "FF"
            ],
            "warning": {
              "title": "Limited comparability",
              "detail": "EXP-067 is missing an annealing unit and solution-preparation link. Summary statistics remain visible, but interpretation requires review."
            },
            "rows": [
              {
                "experiment": "EXP-041",
                "n": 3,
                "mean_pce": "19.42%",
                "median_pce": "19.15%",
                "range": "18.94–20.16%",
                "missing": "0"
              },
              {
                "experiment": "EXP-052",
                "n": 2,
                "mean_pce": "20.50%",
                "median_pce": "20.50%",
                "range": "19.90–21.10%",
                "missing": "0"
              },
              {
                "experiment": "EXP-067",
                "n": 3,
                "mean_pce": "19.69%",
                "median_pce": "20.44%",
                "range": "17.36–21.28%",
                "missing": "2 links"
              }
            ],
            "outlier": {
              "sample": "S06",
              "method": "Deterministic IQR candidate",
              "title": "S06 is a review candidate",
              "detail": "It is low across PCE, FF and stability. Keep the raw row and inspect fabrication evidence before any exclusion."
            }
          },
          "report": {
            "section_catalog": [
              {
                "id": "summary",
                "title": "Executive Summary",
                "detail": "Decision context, objectives and key indicators",
                "enabled_by_default": true
              },
              {
                "id": "methods",
                "title": "Materials, Process & Experiments",
                "detail": "Solution, stack, methodology and experiment coverage",
                "enabled_by_default": true
              },
              {
                "id": "results",
                "title": "Results & Data",
                "detail": "Chart, complete measurements and author interpretation",
                "enabled_by_default": true
              },
              {
                "id": "ai",
                "title": "Evidence-Linked Findings",
                "detail": "Advisory findings with evidence and review state",
                "enabled_by_default": true
              },
              {
                "id": "conclusions",
                "title": "Discussion, Conclusions & Limitations",
                "detail": "Researcher-authored interpretation and boundaries",
                "enabled_by_default": true
              },
              {
                "id": "custom",
                "title": "Custom Author Section",
                "detail": "Optional researcher-authored section with a custom heading",
                "enabled_by_default": false
              },
              {
                "id": "provenance",
                "title": "Provenance & Approval",
                "detail": "Data classes, source controls and final status",
                "enabled_by_default": true
              }
            ],
            "defaults": {
              "subtitle": "Scientific project report",
              "report_type": "Scientific project report",
              "keywords": "perovskite, mixed-cation, JV, stability",
              "executive_summary": "The current evidence identifies FA0.90MA0.10 as the leading formulation across power conversion efficiency, stability and hysteresis. The result remains subject to outlier and metadata review.",
              "methodology": "Structured solution preparation, versioned device stacks, mapped JV measurements and deterministic comparative analysis.",
              "results_narrative": "S08 records the highest PCE in the current cohort. S04 and S08 remain the strongest validation candidates; S06 requires process and provenance review before interpretation.",
              "discussion": "The performance pattern is consistent across PCE, stability and hysteresis, but the small cohort and incomplete process metadata prevent causal conclusions.",
              "conclusions": "FA0.90MA0.10 is the strongest current candidate. S04 and S08 should proceed to validation; S06 and two process metadata gaps require review.",
              "limitations": "The demonstration dataset is small and cannot support causal claims. AI-assisted text is simulated and requires researcher approval.",
              "custom_title": "Additional researcher notes",
              "approval": "Pending researcher approval",
              "chart_metric": "pce"
            },
            "evidence_statement": {
              "label": "Measured statement",
              "statement": "Sample S08 showed the highest measured PCE.",
              "evidence": "batch_B03_forward.csv · S08 · PCE · 21.28%"
            },
            "boundary_statement": {
              "label": "Boundary",
              "statement": "EXP-067 has incomplete process provenance; no causal claim is made."
            },
            "experiment_coverage": [
              {
                "id": "EXP-041",
                "samples": [
                  "S01",
                  "S02",
                  "S03"
                ],
                "process": "100 degC / 30 min",
                "annealing": {
                  "value": 100,
                  "unit": "degC"
                },
                "measurements": 6,
                "status": "reviewed"
              },
              {
                "id": "EXP-052",
                "samples": [
                  "S04",
                  "S05"
                ],
                "process": "105 degC / 25 min",
                "annealing": {
                  "value": 105,
                  "unit": "degC"
                },
                "measurements": 4,
                "status": "reviewed"
              },
              {
                "id": "EXP-067",
                "samples": [
                  "S06",
                  "S07",
                  "S08"
                ],
                "process": "100 degC / unit review",
                "annealing": {
                  "value": 100,
                  "unit": ""
                },
                "measurements": 24,
                "status": "review"
              }
            ]
          },
          "provenance_manifest": [
            {
              "class": "raw",
              "label": "Local source-aligned measurements",
              "evidence": "source_file_manifest"
            },
            {
              "class": "calculated",
              "label": "Deterministic KPI and comparisons",
              "evidence": "analysis_run"
            },
            {
              "class": "researcher",
              "label": "Objectives, interpretation and approval",
              "evidence": "review_record"
            },
            {
              "class": "ai",
              "label": "Simulated advisory findings requiring review",
              "evidence": "assistant_trace"
            }
          ],
          "export_manifest": {
            "include_open_issues": true,
            "include_source_manifest": true,
            "include_provenance_manifest": true,
            "remote_submission": false
          },
          "validation": {
            "rule_results": {
              "finding-evidence": {
                "status": "pass",
                "detail": "Every finding has one or more evidence references."
              },
              "human-review": {
                "status": "error",
                "detail": "FND-005 remains proposed and requires a human decision."
              },
              "open-issues-visible": {
                "status": "pass",
                "detail": "The export manifest preserves all open issues."
              },
              "nomad-readiness": {
                "status": "warning",
                "detail": "The NOMAD preview remains blocked by unresolved result quality issues."
              }
            }
          }
        }
      }
    }
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
