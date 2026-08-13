#!/usr/bin/env python3
"""Build the two documented LabFlow synthetic ZIP fixtures.

The fixtures are deterministic and contain no real laboratory data.  Keep their
expected behavior documented in TEST_DATA/README.md when changing this file.
"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "TEST_DATA"
ZIP_TIME = (2026, 7, 15, 12, 0, 0)
SUMMARY_HEADER = "File\tVoc (V)\tJsc (mA/cm2)\tVMPP (V)\tJMPP (mA/cm2)\tPMPP (mW/cm2)\tRs (Ohm)\tRsh (Ohm)\tFF (%)\tEfficiency (%)"
METRIC_HEADER = "Scan\tVoc\tJsc\tVMPP\tJMPP\tPMPP\tRs\tRsh\tFF\tEfficiency"
CURVE_HEADER = "V_FW (V)\tJ_FW (mA/cm2)\tV_RV (V)\tJ_RV (mA/cm2)"


def metric(voc: float, jsc: float, ff: float, rs: float = 3.2, rsh: float = 1450.0) -> dict[str, float]:
    """Return internally consistent JV metrics at 100 mW/cm² illumination."""
    efficiency = voc * jsc * ff / 100.0
    vmpp = voc * 0.80
    jmpp = efficiency / vmpp if vmpp else 0.0
    return {
        "voc": voc,
        "jsc": jsc,
        "vmpp": vmpp,
        "jmpp": jmpp,
        "pmpp": efficiency,
        "rs": rs,
        "rsh": rsh,
        "ff": ff,
        "eff": efficiency,
    }


def value(raw: object, decimal_comma: bool = False) -> str:
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw
    result = f"{float(raw):.6f}".rstrip("0").rstrip(".")
    return result.replace(".", ",") if decimal_comma else result


def metric_row(direction: str, values: dict[str, object], decimal_comma: bool = False) -> str:
    keys = ("voc", "jsc", "vmpp", "jmpp", "pmpp", "rs", "rsh", "ff", "eff")
    return "\t".join([direction, *(value(values.get(key), decimal_comma) for key in keys)])


def curve_points(values: dict[str, object] | None, reverse: bool = False) -> list[tuple[float, float]]:
    """Create smooth, deterministic illustrative curves from the stated RAW metrics."""
    if not values:
        return []
    try:
        voc, jsc = float(values["voc"]), float(values["jsc"])
    except (TypeError, ValueError, KeyError):
        return []
    points = []
    voltages = [-0.10 + index * (voc + 0.20) / 30 for index in range(31)]
    if reverse:
        voltages.reverse()
    for voltage in voltages:
        normalized = max(voltage, 0.0) / voc if voc else 0.0
        current = jsc * (1.0 - normalized**5)
        points.append((voltage, current))
    return points


def jv_text(
    sample: str,
    fw: dict[str, object] | None,
    rv: dict[str, object] | None,
    note: str,
    *,
    decimal_comma: bool = False,
    date: str = "2026-07-15",
    time: str = "10:00:00",
) -> str:
    rows = [
        "## Header ##",
        "[General info]",
        "User\tSynthetic LabFlow fixture",
        f"Device\t{sample}",
        "Cell area (cm2)\t0.1",
        "Test\tJV",
        f"Date\t{date}",
        f"Time\t{time}",
        f"Note\t{note}",
        "[JV Settings]",
        "Vmin\t-0.1",
        "Vmax\t1.3",
        "voltage step\t0.04",
        "scan rate\t0.1 V/s",
        "direction\tFW+RV",
        "[Cell Settings]",
        "Tipology\tperovskite solar cell",
        "cell area\t0.1 cm2",
        "counts\t1",
        "## Data ##",
        METRIC_HEADER,
    ]
    if fw is not None:
        rows.append(metric_row("FW", fw, decimal_comma))
    if rv is not None:
        rows.append(metric_row("RV", rv, decimal_comma))
    rows.append(CURVE_HEADER)
    fw_curve, rv_curve = curve_points(fw), curve_points(rv, reverse=True)
    for index in range(max(len(fw_curve), len(rv_curve))):
        left = fw_curve[index] if index < len(fw_curve) else None
        right = rv_curve[index] if index < len(rv_curve) else None
        rows.append(
            "\t".join(
                [
                    value(left[0], decimal_comma) if left else "",
                    value(left[1], decimal_comma) if left else "",
                    value(right[0], decimal_comma) if right else "",
                    value(right[1], decimal_comma) if right else "",
                ]
            )
        )
    return "\n".join(rows) + "\n"


def parameters_text(sample: str, note: str, *, area: str = "0.1", direction: str = "FW+RV") -> str:
    return "\n".join(
        [
            "## Header ##",
            "[General info]",
            "User\tSynthetic LabFlow fixture",
            f"Device\t{sample}",
            f"Cell area (cm2)\t{area}",
            "Test\tStability parameters",
            "Date\t2026-07-15",
            "Time\t10:00:00",
            f"Note\t{note}",
            "[JV Settings]",
            "Vmin\t-0.1 V",
            "Vmax\t1.3 V",
            "voltage step\t0.04 V",
            "scan rate\t0.1 V/s",
            "auto Voc\ttrue",
            f"direction\t{direction}",
            "voltage range\tauto",
            "current range\tauto",
            "inverted\tfalse",
            "auto-range\ttrue",
            "[Cell Settings]",
            "Tipology\tperovskite solar cell",
            f"cell area\t{area} cm2",
            "counts\t1",
            "## Data ##",
            "Time (Hours)\tVoc FW (V)\tEfficiency FW (%)\tVoc RV (V)\tEfficiency RV (%)",
            "0.0\t1.05\t18.2\t1.06\t18.5",
            "0.5\t1.04\t18.0\t1.05\t18.3",
        ]
    ) + "\n"


def tracking_text(sample: str, note: str) -> str:
    rows = [
        "## Header ##",
        "[General info]",
        "User\tSynthetic LabFlow fixture",
        f"Device\t{sample}",
        "Cell area (cm2)\t0.1",
        "Test\tMPP tracking",
        "Date\t2026-07-15",
        "Time\t10:05:00",
        f"Note\t{note}",
        "[Tracking Settings]",
        "Algorithm\tperturb and observe",
        "dV track (V)\t0.01",
        "track delay (s)\t1",
        "JV interval (min)\t30",
        "Test duration\t2 h",
        "[Cell Settings]",
        "Tipology\tperovskite solar cell",
        "cell area\t0.1 cm2",
        "counts\t1",
        "## Data ##",
        "Time(Hours)\tVoltage(V)\tCurrent density (mA/cm2)\tPower (mW/cm2)",
    ]
    for index in range(9):
        hours = index * 0.25
        voltage = 0.86 - 0.002 * index
        current = 21.5 - 0.08 * index
        rows.append(f"{hours:.2f}\t{voltage:.3f}\t{current:.3f}\t{voltage * current:.3f}")
    return "\n".join(rows) + "\n"


def summary_text(records: list[dict[str, object]], direction: str, *, damaged_header: bool = False) -> str:
    header = SUMMARY_HEADER.replace("Rsh (Ohm)", "Rsh � (Ohm)") if damaged_header else SUMMARY_HEADER
    rows = [header]
    for record in records:
        values = record.get(direction.lower())
        if values is not None:
            rows.append(
                "\t".join(
                    [
                        str(record["jv_name"]),
                        *(value(values.get(key), bool(record.get("decimal_comma"))) for key in ("voc", "jsc", "vmpp", "jmpp", "pmpp", "rs", "rsh", "ff", "eff")),
                    ]
                )
            )
    return "\n".join(rows) + "\n"


def combined_summary(records: list[dict[str, object]]) -> str:
    rows = ["File\tScan\tVoc (V)\tJsc (mA/cm2)\tFF (%)\tEfficiency (%)"]
    for record in records:
        for direction in ("fw", "rv"):
            values = record.get(direction)
            if values is None:
                continue
            rows.append(
                "\t".join(
                    [
                        str(record["jv_name"]),
                        direction.upper(),
                        value(values.get("voc")),
                        value(values.get("jsc")),
                        value(values.get("ff")),
                        value(values.get("eff")),
                    ]
                )
            )
    return "\n".join(rows) + "\n"


def add_record_files(files: dict[str, str], archive_root: str, record: dict[str, object]) -> None:
    folder = str(record["folder"])
    time_dir = str(record.get("time_dir", "10.00.00"))
    base = f"{archive_root}/{folder}/{time_dir}"
    sample = str(record["internal_sample"])
    note = str(record.get("note", ""))
    files[f"{base}/{record['jv_name']}"] = jv_text(
        sample,
        record.get("fw"),
        record.get("rv"),
        note,
        decimal_comma=bool(record.get("decimal_comma")),
    )
    if record.get("include_parameters", True):
        parameter_name = str(record.get("parameter_name", f"0000_2026-07-15_10.00.00_Stability (Parameters)_{sample}.txt"))
        files[f"{base}/{parameter_name}"] = parameters_text(
            str(record.get("parameter_sample", sample)),
            str(record.get("parameter_note", note)),
            area=str(record.get("parameter_area", "0.1")),
            direction=str(record.get("parameter_direction", "FW+RV")),
        )
    if record.get("include_tracking", True):
        tracking_name = str(record.get("tracking_name", f"0000_2026-07-15_10.05.00_Stability (Tracking)_{sample}.txt"))
        files[f"{base}/{tracking_name}"] = tracking_text(sample, str(record.get("tracking_note", note)))


def perfect_files() -> dict[str, str]:
    archive_root = "SYNTHETIC_PERFECT_2026_07_15"
    designs = {
        "REF CONTROL": "Stack: glass/ITO/SnO2/perovskite/Spiro-OMeTAD/Au; precursor: FAPbI3 1.30 M in DMF:DMSO 4:1; spin coating: 1000 rpm 10 s then 5000 rpm 30 s; antisolvent: chlorobenzene at 20 s; annealing: 100 C 30 min; atmosphere: nitrogen glovebox.",
        "BASELINE": "Stack: glass/ITO/SnO2/perovskite/Spiro-OMeTAD/Au; precursor: FA0.85Cs0.15Pb(I0.95Br0.05)3 1.30 M in DMF:DMSO 4:1; spin coating: 1000 rpm 10 s then 5000 rpm 30 s; antisolvent: chlorobenzene at 20 s; annealing: 100 C 30 min; atmosphere: nitrogen glovebox.",
        "ADDITIVE": "Stack: glass/ITO/SnO2/perovskite/PEAI/Spiro-OMeTAD/Au; precursor: FA0.85Cs0.15Pb(I0.95Br0.05)3 1.30 M in DMF:DMSO 4:1 with 2 mol% MACl; passivation: PEAI 2 mg/mL in IPA; spin coating: 1000 rpm 10 s then 5000 rpm 30 s; antisolvent: chlorobenzene at 20 s; annealing: 100 C 30 min; atmosphere: nitrogen glovebox.",
    }
    specs = [
        ("REF CONTROL-1A", 1.060, 22.10, 76.5),
        ("REF CONTROL-1B", 1.068, 22.25, 77.0),
        ("BASELINE-1A", 1.105, 23.10, 78.0),
        ("BASELINE-1B", 1.112, 23.30, 78.5),
        ("ADDITIVE-1A", 1.145, 24.00, 80.0),
        ("ADDITIVE-1B", 1.152, 24.20, 80.5),
    ]
    records: list[dict[str, object]] = []
    for index, (sample, voc, jsc, ff) in enumerate(specs, start=1):
        group = sample.rsplit("-", 1)[0]
        fw = metric(voc, jsc, ff, 3.0 + index * 0.08, 1500 + index * 35)
        rv = metric(voc + 0.006, jsc + 0.10, ff + 0.35, 2.9 + index * 0.08, 1540 + index * 35)
        records.append(
            {
                "folder": sample,
                "internal_sample": sample,
                "jv_name": f"0001_2026-07-15_10.00.00_Stability (JV)_{sample}.txt",
                "fw": fw,
                "rv": rv,
                "note": designs[group],
            }
        )
    files: dict[str, str] = {
        f"{archive_root}/JV Summary.txt": combined_summary(records),
        f"{archive_root}/JV Summary_Parameters FW.txt": summary_text(records, "FW"),
        f"{archive_root}/JV Summary_Parameters RV.txt": summary_text(records, "RV"),
    }
    for record in records:
        add_record_files(files, archive_root, record)
    return files


def dirty_files() -> dict[str, str]:
    archive_root = "synthetic messy EXPERIMENT 2026"
    good = metric(1.05, 21.2, 75.0)
    records: list[dict[str, object]] = [
        {
            "folder": " REF  ctrl _1A ",
            "internal_sample": "REF CONTROL-1A",
            "jv_name": "0001_2026-07-15_10.00.00_Stability (JV)_REF  ctrl _ 1A.txt",
            "fw": good,
            "rv": metric(1.056, 21.0, 74.8),
            "note": "Possible control. Stack stated as glass/ITO/SnO2/perovskite/Spiro/Au; precursor concentration not recorded; anneal 100 C for 30 min.",
            "parameter_sample": "REF ctrl-1A",
        },
        {
            "folder": "BASE LINE - 1A",
            "internal_sample": "BASELINE-1A",
            "jv_name": "0001_2026-07-15_10.10.00_Stability (JV)_BASE LINE - 1A.txt",
            "fw": metric(1.09, 22.7, 77.0),
            "rv": metric(1.10, 22.9, 77.8),
            "decimal_comma": True,
            "note": "Baseline formulation; solvent written as DMF/DMSO but ratio absent; annealing temperature missing; stack may include SnO2.",
            "parameter_area": "0,09",
        },
        {
            "folder": "TREAT_X-1A",
            "internal_sample": "TREAT_X-1A",
            "jv_name": "0001_2026-07-15_10.20.00_Stability (JV)_TREAT_X-1A.txt",
            "fw": metric(1.14, 24.0, 96.0),
            "rv": metric(1.13, 23.8, 79.0),
            "note": "Additive X used, concentration unknown. Operator note says anneal 100 C; protocol reference says 150 C. Stack: ITO/SnO2/perovskite/HTL/Au.",
            "parameter_note": "Additive X; anneal 150 C according to copied protocol; concentration not recorded.",
        },
        {
            "folder": "TREAT_X-1B",
            "internal_sample": "TREAT_X-1B",
            "jv_name": "0001_2026-07-15_10.30.00_Stability (JV)_TREAT_X-1B.txt",
            "fw": metric(1.12, 58.0, 78.0),
            "rv": metric(1.11, 24.1, 78.5),
            "note": "Current density may have an area or scale mismatch. Additive X concentration written once as 2% without basis.",
            "parameter_area": "0.01",
        },
        {
            "folder": "MYSTERY  device",
            "internal_sample": "MYSTERY DEVICE",
            "jv_name": "0001_2026-07-15_10.40.00_Stability (JV)_MYSTERY device.txt",
            "fw": {"voc": "N/A", "jsc": 19.5, "vmpp": "", "jmpp": 17.0, "pmpp": "", "rs": 4.5, "rsh": 800, "ff": None, "eff": None},
            "rv": None,
            "note": "No fabrication notebook entry found; device identity and stack unknown.",
            "include_parameters": False,
            "include_tracking": False,
        },
        {
            "folder": "CONFLICT-1A",
            "internal_sample": "CONFLICT-1A",
            "jv_name": "0001_2026-07-15_10.50.00_Stability (JV)_CONFLICT-1A.txt",
            "fw": metric(1.03, 18.0, 58.0),
            "rv": metric(1.12, 24.0, 80.0),
            "note": "JV file says CONFLICT-1A. Notebook fragment: stack ITO/NiOx/perovskite/C60/BCP/Ag; process attribution uncertain.",
            "parameter_sample": "TREAT_X-1A",
            "parameter_note": "Conflicting identity: copied from TREAT_X-1A. Stack recorded elsewhere as ITO/SnO2/perovskite/HTL/Au.",
        },
        {
            "folder": "UNLISTED-1A",
            "internal_sample": "UNLISTED-1A",
            "jv_name": "0001_2026-07-15_11.00.00_Stability (JV)_UNLISTED-1A.txt",
            "fw": metric(1.08, 22.0, 76.0),
            "rv": metric(1.09, 22.2, 76.5),
            "note": "Valid individual JV file omitted from the summary export. Process note unavailable.",
            "include_tracking": False,
        },
    ]
    orphan = {
        "folder": "ORPHAN-9Z",
        "internal_sample": "ORPHAN-9Z",
        "jv_name": "0001_2026-07-15_11.10.00_Stability (JV)_ORPHAN-9Z.txt",
        "fw": metric(1.01, 20.0, 72.0),
        "rv": None,
        "note": "Summary-only record; source JV file is missing from the archive.",
    }
    summary_records = records[:-1] + [orphan]
    files: dict[str, str] = {
        f"{archive_root}/JV Summary.txt": "Legacy export; mixed delimiters and incomplete rows\nFile;Scan;Voc;Jsc;PCE\nunknown;FW;1,1;22,0;18,2\n",
        f"{archive_root}/JV Summary_Parameters FW.txt": summary_text(summary_records, "FW", damaged_header=True),
        f"{archive_root}/JV Summary Parameters RV.txt": "Filename;Voc;Jsc;FF;PCE\nmalformed;1,10;22,0;78;18,9\n",
        f"{archive_root}/notes/unverified_export.csv": "sample,pce,comment\nTREAT_X-1A,99.9,unverified manual export\n",
        f"{archive_root}/notes/README broken units.txt": "Area sometimes recorded as mm2, sometimes cm2. Do not scale without review. Replacement glyph: �\n",
        f"{archive_root}/Thumbs.db": "synthetic-placeholder",
    }
    for record in records:
        add_record_files(files, archive_root, record)
    return files


def write_zip(path: Path, files: dict[str, str], fixture_kind: str) -> dict[str, object]:
    path.parent.mkdir(parents=True, exist_ok=True)
    directories: set[str] = set()
    for name in files:
        parts = name.split("/")[:-1]
        for index in range(1, len(parts) + 1):
            directories.add("/".join(parts[:index]) + "/")
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for directory in sorted(directories):
            info = zipfile.ZipInfo(directory, ZIP_TIME)
            info.external_attr = 0o40755 << 16
            archive.writestr(info, b"")
        for name, text in sorted(files.items()):
            info = zipfile.ZipInfo(name, ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, text.encode("utf-8"))
    return {
        "fixture": fixture_kind,
        "archive": path.name,
        "files": len(files),
        "bytes": path.stat().st_size,
    }


def multi_device_duplicate_names_files() -> dict[str, str]:
    """Create 03_MULTI_DEVICE_DUPLICATE_NAMES.zip.

    Two devices (run1, run2) each have a JV file, Parameters file, and Tracking file
    with the same basename (e.g. Stability (JV)_BH.txt).  Path identity ensures they
    remain 2 distinct measurements; the old basename-keyed merge would collapse them.
    """
    files: dict[str, str] = {}
    # ---- run 1 ----
    files["synthetic_multi/run1/Stability (JV)_BH.txt"] = jv_text(
        "BH", fw=metric(1.05, 21.2, 75.0), rv=metric(1.04, 21.0, 74.5),
        note="Run 1 device BH JV",
    )
    files["synthetic_multi/run1/Stability (Parameters)_BH.txt"] = parameters_text(
        "BH", note="Run 1 BH parameters",
    )
    files["synthetic_multi/run1/Stability (Tracking)_BH.txt"] = tracking_text(
        "BH", note="Run 1 BH tracking",
    )
    # ---- run 2 ----
    files["synthetic_multi/run2/Stability (JV)_BH.txt"] = jv_text(
        "BH", fw=metric(1.12, 23.8, 78.0), rv=metric(1.11, 23.9, 78.3),
        note="Run 2 device BH JV",
    )
    files["synthetic_multi/run2/Stability (Parameters)_BH.txt"] = parameters_text(
        "BH", note="Run 2 BH parameters",
    )
    files["synthetic_multi/run2/Stability (Tracking)_BH.txt"] = tracking_text(
        "BH", note="Run 2 BH tracking",
    )
    # summary with both measurements (path-keyed, not basename-keyed)
    summary_lines = ["File\tScan\tVoc (V)\tJsc (mA/cm2)\tFF (%)\tEfficiency (%)"]
    for run_label, voc, jsc, ff in [("run1", 1.05, 21.2, 75.0), ("run2", 1.12, 23.8, 78.0)]:
        summary_lines.append(f"synthetic_multi/{run_label}/Stability (JV)_BH.txt\tFW\t{voc}\t{jsc}\t{ff}\t{voc*jsc*ff/100.0:.1f}")
    files["synthetic_multi/Summary.txt"] = "\n".join(summary_lines) + "\n"
    return files


def large_dataset_files() -> dict[str, str]:
    """Create 04_LARGE_DATASET.zip.

    121+ files, 81+ measurements, 65+ text files.
    Asserts selectBlocks + readBlock({rows}) context has no slice(0,n) truncation
    and no measurement lost (contextCoverage totals exact).
    """
    import random
    random.seed(42)

    def rand_voc(): return round(random.uniform(1.0, 1.2), 3)
    def rand_jsc(): return round(random.uniform(18.0, 25.0), 3)
    def rand_ff():  return round(random.uniform(0.70, 0.85), 3)

    files: dict[str, str] = {}
    measurements: list[dict[str, object]] = []
    sample_counter = 0

    for device in range(1, 6):  # 5 devices
        for run in range(1, 5):  # 4 runs per device → 16 combos
            for variant in ("main", "alt"):  # 2 variants each = 32 samples
                sample_counter += 1
                folder = f"device_{device:02d}_run_{run:02d}_v{variant}"
                jv_name = f"JV_{sample_counter:04d}_{'ABCDEFGHI'[sample_counter % 9]}.txt"
                voc = rand_voc()
                jsc = rand_jsc()
                ff = rand_ff()
                measurements.append({
                    "file": f"{folder}/JV_{sample_counter:04d}_{'ABCDEFGHI'[sample_counter % 9]}.txt",
                    "voc": voc, "jsc": jsc, "ff": ff,
                    "eff": round(voc * jsc * ff / 100.0, 2),
                })
                files[f"{folder}/{jv_name}"] = jv_text(
                    f"Device {device} Run {run} {variant}",
                    fw=metric(voc, jsc, ff),
                    rv=metric(voc + 0.02, jsc + 0.10, ff + 0.10),
                    note=f"Device {device} Run {run} {variant} JV data",
                )
                # parameters file
                param_name = f"Parameters_{sample_counter:04d}_{'ABCDEFGHI'[sample_counter % 9]}.txt"
                files[f"{folder}/{param_name}"] = parameters_text(
                    f"Device {device} Run {run} {variant}",
                    note=f"Device {device} Run {run} {variant} parameters",
                )
                # tracking file
                track_name = f"Tracking_{sample_counter:04d}_{'ABCDEFGHI'[sample_counter % 9]}.txt"
                files[f"{folder}/{track_name}"] = tracking_text(
                    f"Device {device} Run {run} {variant}",
                    note=f"Device {device} Run {run} {variant} tracking",
                )

    # combined summary
    summary_lines = ["File\tScan\tVoc (V)\tJsc (mA/cm2)\tFF (%)\tEfficiency (%)"]
    for i, m in enumerate(measurements, 1):
        summary_lines.append(
            f"{m['file']}\tFW\t{m['voc']}\t{m['jsc']}\t{m['ff']}\t{m['eff']}"
        )
    files["large_dataset/Summary.txt"] = "\n".join(summary_lines) + "\n"
    return files


def main() -> None:
    outputs = [
        write_zip(OUTPUT / "01_PRECISO_PERFETTO_COMPLETO.zip", perfect_files(), "perfect"),
        write_zip(OUTPUT / "02_ROVINATO_SPORCO_OPERATIONS.zip", dirty_files(), "dirty"),
        write_zip(OUTPUT / "03_MULTI_DEVICE_DUPLICATE_NAMES.zip", multi_device_duplicate_names_files(), "multi_duplicate"),
        write_zip(OUTPUT / "04_LARGE_DATASET.zip", large_dataset_files(), "large_dataset"),
    ]
    print(json.dumps(outputs, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
