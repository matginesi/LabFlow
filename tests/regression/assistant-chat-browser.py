#!/usr/bin/env python3
"""Provider-free browser regression for the Assistant message lifecycle."""
import sys
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766"
SHOT_DIR = Path("/tmp/labflow-assistant-chat")


def check(value, label):
    if not value:
        raise AssertionError(label)


def reset(page):
    page.evaluate("""
      () => {
        const LF = window.LabFlow;
        LF.State.state.experiment = {
          id: 'assistant-browser-test',
          meta: {name: 'Assistant browser test', sourceName: 'test.zip'},
          sync: {revision: 1, savedRevision: 1, dirty: false},
          derived: {chat: {conversation: []}},
          samples: [], measurements: [], findings: [], design: {devices: [], solutions: []},
          analysis: {}, patches: []
        };
        LF.Storage.getAiSettings = () => ({provider: 'test', endpoint: 'local', model: 'test-model'});
        LF.Storage.getApiKey = () => '';
        LF.AIProviders = {test: {keyRequired: false}};
        LF.Assistant.render({forceBottom: true});
      }
    """)


def install_pending(page):
    page.evaluate("""
      () => {
        window.__assistantRun = {};
        LabFlow.ActionRunner = {
          isRunning: () => false,
          run: (id, options) => new Promise(resolve => {
            window.__assistantRun.options = options;
            window.__assistantRun.resolve = resolve;
          }),
          cancel: () => {
            window.__assistantRun.resolve({status: 'aborted', code: 'ACTION_ABORTED', requestMeta: {}});
            return true;
          }
        };
      }
    """)


with sync_playwright() as p:
    print("launching Chromium", flush=True)
    system_chromium = shutil.which('chromium') or shutil.which('chromium-browser')
    browser = p.chromium.launch(headless=True, executable_path=system_chromium) if system_chromium else p.chromium.launch(headless=True)
    print("opening LabFlow", flush=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(5000)
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        pass
    print("LabFlow loaded", flush=True)
    page.wait_for_function("window.LabFlow && LabFlow.Assistant && LabFlow.State")
    print("Assistant ready", flush=True)

    print("resetting fixture", flush=True)
    reset(page)
    print("installing provider stub", flush=True)
    install_pending(page)
    print("starting streamed turn", flush=True)
    page.evaluate("() => { LabFlow.Assistant.sendChat('Explain the result'); }")
    check(page.locator(".assistant-row").count() == 1, "one Assistant container at request start")
    check(page.locator(".chat-spinner").count() == 1, "spinner shown before content")
    message_id = page.locator(".assistant-row .chat-message").get_attribute("data-message-id")

    page.evaluate("window.__assistantRun.options.onProgress({content: '**Useful** streamed answer', reasoning: 'private reasoning'})")
    check(page.locator(".assistant-row .chat-message").get_attribute("data-message-id") == message_id, "stream retained message identity")
    check(page.locator(".chat-spinner").count() == 0, "first useful content removed spinner")
    check(page.locator(".assistant-row strong", has_text="Useful").count() == 1, "streamed Markdown rendered")

    page.evaluate("window.__assistantRun.resolve({status:'done', result:'**Useful** streamed answer', requestMeta:{final:{provider:'test',model:'test-model',reasoning:'private reasoning',latencyMs:12,tokensPerSecond:20,usage:{promptTokens:4,completionTokens:3,totalTokens:7}}}})")
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator(".assistant-row").count() == 1, "completion did not append another Assistant container")
    check(page.locator(".chat-spinner").count() == 0, "completion left no spinner")
    details = page.locator(".assistant-row details.chat-details")
    if details.count() == 0:
        print(page.evaluate("() => ({messages:LabFlow.State.state.experiment.derived.chat.conversation, html:document.querySelector('.assistant-row').innerHTML})"), flush=True)
    details.wait_for(state="attached")
    check(details.count() == 1 and not details.evaluate("node => node.open"), "reasoning Details closed by default")

    # A second turn must work after the first final State notification. This is
    # the regression for the old stuck-spinner / dead-composer race.
    install_pending(page)
    page.evaluate("() => { LabFlow.Assistant.sendChat('And what should I do next?'); }")
    check(page.locator(".assistant-row").count() == 2, "second turn created exactly one new Assistant container")
    check(page.locator(".chat-spinner").count() == 1, "second turn shows one spinner")
    page.evaluate("window.__assistantRun.options.onProgress({content: 'Review the remaining evidence and then export the report.', reasoning: ''})")
    check(page.locator(".chat-spinner").count() == 0, "second turn first content removed spinner")
    page.evaluate("window.__assistantRun.resolve({status:'done', result:'Review the remaining evidence and then export the report.', requestMeta:{final:{provider:'test',model:'test-model',latencyMs:8}}})")
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator(".assistant-row").count() == 2, "second completion did not duplicate Assistant container")
    check(page.locator(".chat-spinner").count() == 0, "second completion left no spinner")
    check("Review the remaining evidence" in page.locator(".assistant-row").last.inner_text(), "second answer rendered")
    check(not page.locator("#chatInput").is_disabled(), "composer re-enabled after second turn")

    # Error reuses the pending response and exposes Retry.
    reset(page)
    page.evaluate("LabFlow.ActionRunner={isRunning:()=>false,run:()=>Promise.resolve({status:'error',code:'TEST_ERROR',message:'Provider unavailable',requestMeta:{}}),cancel:()=>true}")
    page.evaluate("() => { LabFlow.Assistant.sendChat('Fail safely'); }")
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator(".assistant-row").count() == 1, "error created one Assistant container")
    check(page.locator(".chat-spinner").count() == 0, "error left no spinner")
    check(page.locator("[data-retry-message]").count() == 1, "error exposes Retry")

    # Abort clears transient UI through the ActionRunner cancellation contract.
    reset(page)
    install_pending(page)
    page.evaluate("() => { LabFlow.Assistant.sendChat('Stop this'); }")
    page.locator("#chatSend").click()
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    check(page.locator(".chat-spinner").count() == 0, "abort left no spinner")
    check(page.locator(".chat-cancelled").count() == 1, "abort marked the turn cancelled")

    # Long content grows naturally; only the conversation owns vertical scrolling.
    reset(page)
    long_markdown = "\n\n".join(f"Paragraph {i}: scientific explanation with evidence and context." for i in range(80))
    page.evaluate("""text => {
      LabFlow.ActionRunner={isRunning:()=>false,run:()=>Promise.resolve({status:'done',result:text,requestMeta:{final:{provider:'test',model:'test-model'}}}),cancel:()=>true};
      LabFlow.Assistant.sendChat('Give a long explanation');
    }""", long_markdown)
    page.wait_for_function("!LabFlow.Assistant.isActive()")
    scroll = page.evaluate("""() => {
      const log=document.querySelector('.chat-log'), body=document.querySelector('.assistant-row .chat-body');
      return {logOverflow:getComputedStyle(log).overflowY, bodyOverflow:getComputedStyle(body).overflowY,
        logScrollable:log.scrollHeight>log.clientHeight, bodyScrollable:body.scrollHeight>body.clientHeight};
    }""")
    check(scroll["logOverflow"] == "auto" and scroll["logScrollable"], "conversation did not own long-response scrolling")
    check(scroll["bodyOverflow"] in ("visible", "clip") and not scroll["bodyScrollable"], "response gained an internal scrollbar")
    check(page.locator("#chatJumpLatest").is_hidden(), "near-bottom completion should follow the response")

    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.evaluate("document.querySelectorAll('.toast,.totem-toast').forEach(node => node.remove())")
    for name, viewport in (("desktop", {"width": 1440, "height": 900}), ("narrow", {"width": 390, "height": 800}), ("low", {"width": 1024, "height": 480})):
        page.set_viewport_size(viewport)
        page.screenshot(path=str(SHOT_DIR / f"{name}.png"), full_page=False)
        check(page.locator("#chatInput").is_visible(), f"composer hidden in {name} viewport")
        check(page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), f"horizontal page overflow in {name} viewport")

    print(f"assistant browser regression passed; screenshots: {SHOT_DIR}")
    browser.close()
