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
- All canonical pages use the shared 1480 px outer frame and tokenised page
  padding. Narrower reading surfaces constrain an inner column rather than
  redefining page edges.
- Shared search results stay within the viewport and documentation navigation
  becomes a horizontally scrollable contents rail.
- Personal Settings and Admin Settings collapse their shared section rail to a
  horizontal scroller, then stack forms and policy cards on small screens.

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

Scientific state is stored only in the tab session. Appearance/account display
preferences may remain in `localStorage`. The app sets no cookies, includes no
trackers or analytics, uses no CDN resources and does not upload selected files.
The first load in every new browser-tab session clears saved scientific state;
reloads and navigation within that same tab retain current work.

Never place real API keys or sensitive laboratory data in this static POC.
