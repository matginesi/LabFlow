#!/usr/bin/env python3
"""Responsive browser audit for every LabFlow route.

The test intentionally measures the rendered application instead of inferring
layout safety from media queries. Horizontal scrolling is allowed only inside
explicit local regions such as tables, tab rows, toolbars and stack editors.
"""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("LABFLOW_TEST_BASE_URL", "http://127.0.0.1:8765")
ZIP_PATH = Path("TEST_DATA/02_ROVINATO_SPORCO_TASKS.zip").resolve()
VIEWPORTS = ((1440, 900), (1100, 800), (900, 800), (700, 800), (390, 844))
ROUTES = (
    "experiment-understand",
    "experiment-results",
    "experiment-design",
    "experiment-report",
    "experiment-nomad",
    "settings",
    "logs",
    "ui-kit",
)


AUDIT_JS = r"""() => {
  const visible = node => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const localScroll = node => node.closest([
    '.table-wrap', '.scroll-x-region', '.tabs', '.toolbar', '.topbar', '.sidebar',
    '.stack-editor-scroll', '.design-variant-rail .panel-body', '.design-variant-rail-v3 .panel-body', '.activity-request-body', '.activity-disclosure',
    '.code-block', '.md-table-wrap', '.report-ai-tools', '.report-toolbar', '.experiment-strip'
  ].join(','));
  const offenders = [...document.body.querySelectorAll('*')].filter(node => {
    if (!visible(node) || localScroll(node)) return false;
    const rect = node.getBoundingClientRect();
    return rect.right > innerWidth + 1 || rect.left < -1;
  }).slice(0, 20).map(node => {
    const rect = node.getBoundingClientRect();
    return {tag:node.tagName.toLowerCase(), id:node.id, cls:String(node.className).slice(0,100), left:Math.round(rect.left), right:Math.round(rect.right), width:Math.round(rect.width)};
  });
  const main = document.querySelector('.main-area');
  const sidebar = document.querySelector('.sidebar');
  const strip = document.querySelector('.experiment-strip');
  const steps = strip ? [...strip.querySelectorAll('.step')].map(node => {
    const rect=node.getBoundingClientRect();
    return {left:Math.round(rect.left), right:Math.round(rect.right), width:Math.round(rect.width), visible:visible(node)};
  }) : [];
  const sidebarRect = sidebar.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();
  return {
    route: window.LabFlow.State.state.route,
    viewport: {width:innerWidth,height:innerHeight},
    documentOverflow: document.documentElement.scrollWidth > innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    mainOverflow: main.scrollWidth > main.clientWidth + 1,
    main: {left:Math.round(mainRect.left),right:Math.round(mainRect.right),clientWidth:main.clientWidth,scrollWidth:main.scrollWidth},
    sidebar: {top:Math.round(sidebarRect.top),left:Math.round(sidebarRect.left),width:Math.round(sidebarRect.width),height:Math.round(sidebarRect.height)},
    stepper: strip ? {clientWidth:strip.clientWidth,scrollWidth:strip.scrollWidth,steps} : null,
    offenders
  };
}"""


def main() -> int:
    findings: list[dict] = []
    screenshot_dir = Path("/tmp/labflow-responsive")
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser_path = os.environ.get("LABFLOW_BROWSER") or shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
        browser = playwright.chromium.launch(headless=True, executable_path=browser_path) if browser_path else playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")

        # Audit the upload-first state before adding experiment data.
        findings.append(page.evaluate(AUDIT_JS))
        page.locator("#datasetInput").set_input_files(str(ZIP_PATH))
        page.wait_for_function("window.LabFlow.State.state.route === 'experiment-understand'")
        page.wait_for_timeout(200)
        page.evaluate("window.LabFlow.UI.activityHide()")
        if page.locator("#assistantClose").is_visible():
            page.locator("#assistantClose").click()

        for width, height in VIEWPORTS:
            page.set_viewport_size({"width": width, "height": height})
            for route in ROUTES:
                page.evaluate("route => window.LabFlow.State.setRoute(route)", route)
                page.wait_for_timeout(120)
                if route == "ui-kit":
                    page.locator(".ui-kit-frame").wait_for()
                    page.frame_locator(".ui-kit-frame").locator("h1").first.wait_for()
                result = page.evaluate(AUDIT_JS)
                result["surface"] = "default"
                findings.append(result)

                # Route-internal views often carry their own grids and are
                # part of the responsive contract, not optional test detail.
                if route == "experiment-results":
                    for tab in ("overview", "measurements", "curves", "boxplots"):
                        page.locator(f'[data-result-tab="{tab}"]').first.click()
                        page.wait_for_timeout(80)
                        nested = page.evaluate(AUDIT_JS)
                        nested["surface"] = f"results:{tab}"
                        findings.append(nested)
                elif route == "experiment-report":
                    for mode in ("editor", "preview"):
                        page.locator(f'[data-report-mode="{mode}"]').click()
                        page.wait_for_timeout(60)
                        nested = page.evaluate(AUDIT_JS)
                        nested["surface"] = f"report:{mode}"
                        findings.append(nested)
                elif route == "settings":
                    for section in ("provider", "assistant", "workspace", "advanced"):
                        page.locator(f'[data-settings-section="{section}"]').click()
                        page.wait_for_timeout(60)
                        nested = page.evaluate(AUDIT_JS)
                        nested["surface"] = f"settings:{section}"
                        findings.append(nested)
                elif route == "ui-kit":
                    frame = next(candidate for candidate in page.frames if candidate.url.endswith("/ui-kit.html"))
                    inner = frame.evaluate("""() => {
                      const main=document.querySelector('.main-area'), edge=main.getBoundingClientRect().left+main.clientWidth;
                      const allowed='.table-wrap,.scroll-x-region,.tabs,.toolbar,.topbar,.sidebar,.design-variant-rail .panel-body,.design-variant-rail-v3 .panel-body,.code-block,.md-table-wrap,.report-ai-tools,.report-toolbar';
                      const offenders=[...main.querySelectorAll('*')].filter(node => {
                        const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
                        return style.display!=='none' && rect.width>0 && rect.right>edge+1 && !node.closest(allowed);
                      }).slice(0,12).map(node => ({tag:node.tagName.toLowerCase(),cls:String(node.className).slice(0,100),right:Math.round(node.getBoundingClientRect().right),width:Math.round(node.getBoundingClientRect().width)}));
                      return {documentOverflow:document.documentElement.scrollWidth>innerWidth,mainOverflow:main.scrollWidth>main.clientWidth+1,clientWidth:main.clientWidth,scrollWidth:main.scrollWidth,offenders};
                    }""")
                    result["uiKitDocument"] = inner
                if width in (900, 390):
                    page.screenshot(path=str(screenshot_dir / f"{width}-{route}.png"), full_page=False)

        browser.close()

    failures = [item for item in findings if (
        item["documentOverflow"] or item["mainOverflow"] or item["offenders"] or
        item.get("uiKitDocument", {}).get("documentOverflow") or
        item.get("uiKitDocument", {}).get("mainOverflow") or
        (item["viewport"]["width"] <= 1100 and item["sidebar"]["left"] >= 0) or
        (item.get("stepper") and (
            item["stepper"]["scrollWidth"] > item["stepper"]["clientWidth"] + 1 or
            len(item["stepper"]["steps"]) != 6 or
            not all(step["visible"] for step in item["stepper"]["steps"])
        ))
    )]
    print(json.dumps({"failureCount": len(failures), "surfaces": len(findings), "failures": failures}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
