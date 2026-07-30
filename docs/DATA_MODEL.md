# Data model

`Workspace` owns Projects and shared `LabResource` records. A `Project` contains
Experiments. Each Experiment contains stacks, resource usages, process runs,
samples, measurements, files, results, reports and export packages.

`ExperimentResourceUsage` keeps `resource_ref`, `stack_ids`, amount, unit,
parameters, actual conditions, `used_at` and a snapshot of relevant definition
fields. It separates shared definitions from historical evidence.

## AI-ready records

`AIAnalysis`: id, workspace/experiment/stack scope, source refs, analysis type,
prompt, model, parameters, outputs, evidence, confidence, limitations, status,
author and timestamps.

`AIOutput`: analysis reference, type, content, structured data, sources, status,
human edits, approval and provenance.

`AgentDefinition`: purpose, allowed inputs/actions, approval gates, outputs and
version. `AgentRun`: objective, scoped inputs, steps, proposals, evidence,
approvals, outputs, status and timestamps.

`SemanticIndexEntry` is planned metadata for source reference, summary,
embedding version and creation time. No embeddings are implemented in the POC.
AI outputs never overwrite original measurements.
