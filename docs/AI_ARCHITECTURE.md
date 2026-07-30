# AI and agent architecture

LabFlow treats AI as an optional interpretation layer over authoritative data:

`Permission scope → retrieval → evidence bundle → model → draft → human review`

The POC implements selected context, structured demo input, evidence,
confidence, limitations and accept/edit/reject states. Model execution and
retrieval are simulated locally.

Controlled agents expose objective, allowed and blocked actions, steps,
proposals and approval gates. They cannot delete, publish or send API requests.
A future RAG layer may combine structured filters with approved reports, notes,
protocols and file metadata while enforcing workspace permissions.
