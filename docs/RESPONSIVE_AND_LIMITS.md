# Responsive behaviour and POC limits

## Responsive behaviour

The supported design range is 360–1440 px.

- Desktop uses a stable compact sidebar and multi-column workspaces.
- Below 980 px the sidebar becomes a dismissible drawer.
- Workflow and context rails scroll horizontally instead of compressing labels.
- Tables remain inside contained horizontal scrollers.
- Forms and two-column scientific comparisons collapse to one column.
- Modals and drawers use internal scrolling and near-full mobile width.
- Primary actions remain visible and controls keep usable touch targets.
- Shared search results stay within the viewport and documentation navigation
  becomes a horizontally scrollable contents rail.

## Functional limits

This repository has no backend, database, authentication, authorization,
multi-user persistence, file storage, LLM, embedding service, vector database
or NOMAD network integration.

Simulated features include:

- AI responses, analysis and anomaly detection;
- controlled agent execution;
- RAG retrieval and source scoring;
- binary-file mapping where no local parser exists;
- NOMAD import, validation submission and API upload;
- shared workspace synchronisation.

Browser-generated CSV, JSON, YAML, SVG and selected report/archive outputs are
real local downloads. Their scientific completeness remains demo-level.

Never place real API keys or sensitive laboratory data in this static POC.
