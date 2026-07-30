# LabFlow

Frontend-only POC for a wizard-driven laboratory workspace connecting perovskite research to NOMAD.

**Core workflow:** Workspace → Project → Experiment → Stack definition → Work → Review → NOMAD export

**Key features:**
- Wizard-guided experiment creation with material stack management (solutions, materials, conditions, pipeline, actions)
- Dynamic charts, report generation (PDF), and multi-format export (JSON, CSV, XLSX, YAML)
- NOMAD integration: package builder with simulated upload and import
- Reusable object library (materials, solutions, stacks, methods, processes)
- AI assistant, local tools (code/markdown editor, workbook, image editor, chart builder)
- Full documentation and UI kit

Built with zero dependencies — pure HTML/CSS/JavaScript. Designed for static demonstration; a backend is required for real authentication, persistence, and NOMAD API communication.
