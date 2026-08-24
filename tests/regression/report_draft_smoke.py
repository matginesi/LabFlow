#!/usr/bin/env python3
"""Browser smoke test for Report/Paper drafting controls after ZIP import."""

from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> int:
    errors: list[str] = []
    fixture = Path("TEST_DATA/01_PRECISO_PERFETTO_COMPLETO.zip").resolve()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://127.0.0.1:8765")
        page.locator("#datasetInput").set_input_files(str(fixture))
        page.wait_for_function("window.LabFlow.State.state.experiment.measurements.length > 0")
        page.evaluate("window.LabFlow.UI.activityHide(); window.LabFlow.State.setRoute('experiment-report')")
        report_controls = page.locator('[data-action="report.generate"][data-action-kind="lab"]')
        report_controls.first.wait_for()
        if report_controls.count() < 1:
            raise AssertionError("Draft Report control missing")
        page.evaluate("window.LabFlow.Report.setKind(window.LabFlow.State.state.experiment, 'paper'); window.LabFlow.State.notify('report-kind')")
        paper_controls = page.locator('[data-action="report.generate"][data-action-kind="paper"]')
        paper_controls.first.wait_for()
        if paper_controls.count() < 1:
            raise AssertionError("Draft Paper control missing")
        browser.close()
    if errors:
        raise AssertionError(errors)
    print("REPORT_DRAFT_CONTROLS_OK mobile=390 report=1 paper=1 pageerrors=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
