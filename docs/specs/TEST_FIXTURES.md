# Test fixtures

All ZIP fixtures contain deterministic synthetic values. They are not real
measurements and must not be used for scientific conclusions.

| Fixture | Purpose | Expected import |
|---|---|---|
| `01_PRECISO_PERFETTO_COMPLETO.zip` | Clean FW/RV, JV, Parameters and Tracking baseline across six devices | 3 logical experiments, 6 samples, 6 runs, 6 measurements, 12 auxiliary files, no deterministic findings |
| `02_ROVINATO_SPORCO_OPERATIONS.zip` | Damaged names, missing/invalid summaries, recoveries, suspicious values and incomplete Design evidence | Review findings and human-gated correction proposals; never fabricated replacements |
| `03_MULTI_DEVICE_DUPLICATE_NAMES.zip` | Same basenames in different archive paths | Distinct file and measurement identities by full path |
| `04_LARGE_DATASET.zip` | Larger deterministic archive | Bounded context, responsive rendering and import performance |
| `2026_01_22.zip` | Real naming/layout fixture used to validate hierarchy recovery | 5 experiments (`N1`, `N2`, `N3`, `NEW`, `REF`), 31 samples/cells, 42 runs, 72 JV measurements |

Rebuild them from the repository root with:

```bash
python tools/generate_synthetic_test_data.py
```

The generator fixes archive metadata and content so repeated builds are stable.
