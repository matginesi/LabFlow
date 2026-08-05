# Quick Measurement Review

Quick Measurement Review is a deliberately small example pipeline. It proves that LabFlow can host a focused scientific review without copying the CHOSE workflow or changing the shared application shell.

## Workflow

```text
Plan → Add Data → Report → Export
```

| Step | Purpose | Output |
| --- | --- | --- |
| Plan | Define the question, sample and expected evidence | Review plan |
| Add Data | Add a compact table or local measurement file | Review dataset |
| Report | Summarise findings with one chart and a researcher conclusion | Review report |
| Export | Generate a portable local package or NOMAD readiness preview | Portable export bundle |

## Plan

Plan records the scientific question, sample identity, expected measurement and minimum evidence needed for a useful review. It should remain concise and should not expose the full CHOSE Process builder.

## Add Data

The data step supports a compact manual table or local file. Field mapping, units and provenance still follow the same LabFlow rules as CHOSE: source values remain immutable, normalized values are derived and missing scientific information is not invented.

## Report

Report presents one primary chart, a compact result table, visible limitations and an editable researcher conclusion. Deterministic findings and suggestions remain separate from the conclusion.

## Export

Export generates a transparent local bundle and can show NOMAD readiness. It does not claim to upload or submit data.

## Reuse contract

The pipeline reuses the shared Project header, navigator, tabs, panels, tables, chart patterns, findings and export blocks. It exists as a smaller workflow, not as a second visual language.

The canonical source is `pipelines/quick/pipeline.yaml`.
