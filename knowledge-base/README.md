# LabFlow Knowledge Base

This directory is the versioned, folder-backed LabFlow Knowledge Base.

Open **Knowledge Base** in LabFlow, choose this directory, and grant read/write access. LabFlow manages `library.json` directly from the browser. Records remain separate from the experiment Working Copy. A deterministic lexical retriever selects a small relevant slice for the Assistant and scientific AI Actions; retrieved records never become evidence about the imported experiment.

The Knowledge Base is retrieval-only at runtime: it has no API that writes records directly into Design. A retrieved record can influence an AI proposal, but only the normal locally validated, fill-only proposal workflow may change the Working Copy.

`library.json` uses schema version `1` and contains 34 reusable `material`, `solution`, `process`, and `stack` records. The starter records are transcribed from the primary literature cited in each record's `sources` array. Design filling retrieves relevant records automatically and attaches every used record ID to the AI proposal. The researcher still reviews the resulting proposal before it fills empty Design fields; existing ZIP/researcher values remain protected.
