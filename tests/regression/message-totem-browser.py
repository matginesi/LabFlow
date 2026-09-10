#!/usr/bin/env python3
"""Regression: transient app feedback uses the shared, visibly styled Message Totem."""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
TOKENS = (ROOT / "assets/css/tokens.css").read_text()
UI_CSS = (ROOT / "assets/css/ui.css").read_text()
FEEDBACK_JS = (ROOT / "assets/js/ui/feedback.js").read_text()
APP_JS = (ROOT / "assets/js/app.js").read_text()


def main() -> int:
    # The concrete NOMAD stub must call the canonical Message Totem service.
    assert "closest('#uploadNomadStub')" in APP_JS
    assert "LF.UI.message('Direct NOMAD upload is not implemented yet." in APP_JS
    assert "'info','NOMAD upload'" in APP_JS

    with sync_playwright() as playwright:
        browser_path = os.environ.get("LABFLOW_BROWSER") or shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
        browser = playwright.chromium.launch(headless=True, executable_path=browser_path) if browser_path else playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        # Avoid external/local navigation so this regression also runs in locked-down CI browsers.
        page.set_content(f"<style>{TOKENS}\n{UI_CSS}</style><div class='message-region' id='messageRegion' aria-live='polite'></div>")
        page.add_script_tag(content="window.LabFlow={Core:{},Logger:{scope:function(){return {debug:function(){},info:function(){},warn:function(){},error:function(){}};}}};")
        page.add_script_tag(content=FEEDBACK_JS)
        page.evaluate("() => LabFlow.UI.message('Direct NOMAD upload is not implemented yet. The configured credentials were not used and no data was sent.','info','NOMAD upload')")

        totem = page.locator("#messageRegion .message-totem.message-totem-compact.info").last
        totem.wait_for(state="visible")
        assert totem.locator("strong").inner_text() == "NOMAD upload"
        assert "Direct NOMAD upload is not implemented yet." in totem.inner_text()
        style = totem.evaluate("node => ({background:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderTopColor,display:getComputedStyle(node).display,opacity:getComputedStyle(node).opacity})")
        assert style["display"] == "grid"
        assert style["opacity"] == "1"
        assert style["background"] not in ("transparent", "rgba(0, 0, 0, 0)")
        assert style["border"] not in ("transparent", "rgba(0, 0, 0, 0)")
        assert page.locator("#toastRegion").count() == 0
        browser.close()
    print("Message Totem browser regression: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
