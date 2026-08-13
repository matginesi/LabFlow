# Laboratory Data Format

The current source is commonly delivered as a ZIP with one experiment root folder. The root may contain summary files and many sample folders. Sample folders contain one or more time folders, each containing JV, Parameters, and Tracking files.

LabFlow does not require perfect conformance. Unknown files remain in the manifest; missing summaries trigger fallback parsing of individual JV files.

Known files include:

- `JV Summary.txt`
- `JV Summary_Parameters FW.txt`
- `JV Summary_Parameters RV.txt`
- `Stability (JV)`
- `Stability (Parameters)`
- `Stability (Tracking)`

Text is tab-separated in the observed dataset, with section markers such as `## Header ##`, `[General info]`, `[JV Settings]`, `[Cell Settings]`, and `## Data ##`.

Observed files may contain mojibake in unit labels such as squared-centimeter symbols. Parsing must rely on stable field positions/names where possible, not exact rendering of the unit glyph.
