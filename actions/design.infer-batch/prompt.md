# Task

Suggest missing **solution chemistry** and **device stack** for each supplied experiment.

For every `scope.device_ids` entry, return one item with the exact same `target_device_id`.

Rules:
- Never overwrite known values.
- Experiment/source evidence is authoritative.
- Scientific Knowledge Base records are optional background.
- Qualitative model inference is allowed when plausible and must be labelled `model_inference`.
- Never invent sample identities.
- Never invent unsupported exact concentration, ratio or thickness values; leave those unresolved.
- Do not return coating, annealing, atmosphere or other fabrication-process fields.
- Keep each experiment concise.

Return only JSON matching the supplied schema.
