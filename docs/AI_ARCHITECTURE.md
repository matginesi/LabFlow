# AI, RAG and agent architecture

## Separation of responsibilities

LabFlow exposes three distinct concepts:

| Surface | Purpose | Must not become |
| --- | --- | --- |
| Knowledge Chat | Search and consult shared laboratory knowledge. | Uncited scientific authority. |
| AI Analysis | Interpret selected measurements and results. | Automatic modification of source data. |
| Controlled Agents | Propose bounded multi-step workflow actions. | Autonomous execution without approval. |

All three are static simulations.

## Knowledge Chat

`knowledge.html` represents a shared laboratory RAG interface. Its demo
knowledge base contains manuals, protocols, procedures, papers, technical
sheets, shared notes, Lab Cabinet resources, experiments, approved reports and
NOMAD documentation.

Each source exposes title, type, provenance, tags, status, date and linked
record/file. Retrieval contexts are all laboratory, documents and protocols,
Lab Cabinet, experiments, current experiment and NOMAD.

Every simulated answer includes:

- a “simulated synthesis / to verify” state;
- numbered citations and provenance;
- evidence used and related records;
- deterministic retrieval scores;
- conflict or insufficiency warnings;
- contextual actions behind explicit confirmation.

The Add Knowledge wizard accepts a simulated file, Cabinet resource, protocol,
experiment, report or shared note. It only creates an in-memory record.

## AI Analysis

AI Analysis operates on explicit experiment, stack, file, column, measure and
filter context. Output includes assumptions, findings, anomalies, missing data,
evidence, confidence, limitations and review state.

Original measurements remain authoritative. Suggestions can be accepted,
edited or rejected but must not silently replace evidence.

## Controlled Agents

An agent run shows objective, allowed inputs, permitted and blocked actions,
steps, proposals, evidence and approval gates. Delete, publish and external API
actions are blocked in the demo.

## Future implementation boundary

A real implementation would require permission-scoped retrieval, document
parsing, embeddings or another retrieval index, model execution, prompt and
model versioning, audit logs, evaluation, secure tool execution and human
approval persistence.

None of those services exists in this repository.
