---
title: Test fixtures
section: Engineering reference
summary: Synthetic distributable fixtures and private real-dataset integration fixtures.
order: 60
---

# Test fixtures

Synthetic ZIP fixtures contain deterministic non-scientific values and exist only to exercise import/review behavior. They are safe to distribute and can be regenerated deterministically with `tools/generate_synthetic_test_data.py`.

Private/real laboratory archives live under ignored `TEST_DATA/` paths and are additional integration evidence, not repository dependencies.

The known private hierarchy regression for `2026_01_22.zip` is:

```mermaid
flowchart LR
    E[5 experiments] --> S[31 samples / cells]
    S --> R[42 runs]
    R --> M[72 measurements]
```

A distributable release must not fail merely because private fixtures are absent; self-contained synthetic checks cover the public gate.
