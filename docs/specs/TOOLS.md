---
title: Tools and internal services
section: AI and Actions
summary: Internal read/write capabilities used by Actions and Assistant; not researcher-facing Actions.
order: 30
---

# Tools and internal services

Tools are implementation capabilities. They exist to make execution boundaries explicit; they are not automatically user-facing workflow items.

## Tool registry

`LabFlow.ToolRegistry` publishes deterministic tool definitions and execution metadata. Agent-visible tools are restricted by declared read/write capability; read-only Assistant/agent contexts must not gain write access by calling an internal function indirectly.

## Action-step tools

Current Action manifests use deterministic steps such as collecting ambiguities, validating comparison/design coverage, and storing proposals/annotations. Their exact IDs are implementation detail discoverable from the registry/manifests.

The important rule is ownership: a write step stores through the relevant owner (`ActionData`, Design apply service, correction service) rather than assigning arbitrary state.

## Services that are not tools/Actions

Import parsing, canonical naming, hierarchy linking, deterministic JV analysis, review construction, safe-cleanup detection, Design projection and NOMAD package preparation remain ordinary deterministic services/pipeline work.

Choose a Tool only when an execution system needs a named capability boundary. Do not create registry entries simply to avoid importing a normal helper.
