# JV Measurements

Observed JV files contain general metadata, JV settings, cell settings, a two-row FW/RV metric table, and then raw FW/RV curve points.

Core metrics:

- Voc (V)
- Jsc (mA/cm²)
- VMPP (V)
- JMPP (mA/cm²)
- PMPP (mW/cm²)
- Rs (Ohm)
- Rsh / R// (Ohm)
- FF (%)
- Efficiency (%)

LabFlow computes hysteresis deterministically from matched FW/RV efficiency values. Raw curve data is never produced by AI.
