# Tools, exports and NOMAD

Tools is the canonical scientific workbench. Every operation carries Experiment,
Stack, File, Dataset and Measure context. Ready, Prototype and Simulated labels
state what the POC actually implements.

Report & Export Center is the canonical output entry point: CSV, Excel, JSON,
YAML, SVG, PNG, PDF, complete experiment archive, NOMAD package and a separate
simulated NOMAD API send.

API credentials belong to user Settings, never to an Experiment. The static POC
does not persist or transmit keys. NOMAD validation keeps errors visible and
allows correction, reviewable AI suggestions or export with warnings.
