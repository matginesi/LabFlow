#!/usr/bin/env python3
"""Regenerate the checked-in LabFlow entry pages with one static application shell."""

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

PAGES = {
    "index.html": ("workspace", "Workspace", "LabFlow static research workspace for structured laboratory projects, AI-assisted analysis and NOMAD-ready export."),
    "project.html": ("project", "Project", "LabFlow project workflow, evidence review and local scientific export."),
    "cabinet.html": ("cabinet", "Lab Cabinet", "Reusable local laboratory materials, solutions, stacks, mappings and analysis recipes."),
    "knowledge.html": ("knowledge", "AI & Models", "Evidence-led knowledge, dataset snapshots, model history and reviewed predictions in LabFlow."),
    "tools.html": ("tools", "Tools", "Local document, data and diagram tools for the LabFlow research workspace."),
    "settings.html": ("settings", "Settings", "Temporary local LabFlow appearance, report and demonstration settings."),
    "documentation.html": ("documentation", "Documentation", "Curated LabFlow product, workflow, interface and validation guidance."),
    "ui-kit.html": ("ui-kit", "UI Kit", "LabFlow interface components, page composition patterns and responsive states."),
}

NAV = [
    ("workspace", "index.html", "home", "Workspace"),
    ("cabinet", "cabinet.html", "cabinet", "Lab Cabinet"),
    ("knowledge", "knowledge.html", "spark", "AI & Models"),
    ("tools", "tools.html", "edit", "Tools"),
    ("settings", "settings.html", "settings", "Settings"),
]

REFERENCE = [
    ("documentation", "documentation.html", "book", "Documentation"),
    ("ui-kit", "ui-kit.html", "palette", "UI Kit"),
]

PATHS = json.loads((ROOT / "assets/icons/labflow-icons.json").read_text(encoding="utf-8"))


def icon(name: str, css_class: str = "icon") -> str:
    return f'<svg class="{css_class} icon-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{PATHS[name]}</svg>'


def nav_links(page: str, items: list[tuple[str, str, str, str]]) -> str:
    links = []
    for item_id, href, icon_name, label in items:
        active = page == item_id
        context_parent = page == "project" and item_id == "workspace"
        links.append(f'<a class="nav-link{" active" if active else ""}{" context-parent" if context_parent else ""}"{" aria-current=\"page\"" if active else ""} href="{href}">{icon(icon_name)}<span>{label}</span></a>')
        if page == "project" and item_id == "workspace":
            links.append(f'<a class="nav-link project-nav-entry active" aria-current="page" href="project.html" title="Current project"><span class="project-nav-rail" aria-hidden="true"></span>{icon("layers")}<span class="project-nav-copy"><strong>Current project</strong><small>Loading context…</small></span></a>')
    return "".join(links)


def scripts(page: str) -> str:
    files = ["assets/js/runtime.js"]
    if page == "documentation":
        files += ["assets/js/docs-bundle.js", "assets/js/diagrams.js"]
    elif page == "knowledge":
        files += ["assets/js/diagrams.js", "assets/js/knowledge-pages.js"]
    elif page == "tools":
        files += ["assets/js/workbook.js", "assets/js/diagrams.js", "assets/js/tools-page.js"]
    elif page in ("project", "ui-kit"):
        files.append("assets/js/workbook.js")
    files.append("assets/js/app.js")
    return "\n  ".join(f'<script defer src="{path}"></script>' for path in files)


def render(page: str, title: str, description: str) -> str:
    style_links = '<link rel="stylesheet" href="ui/labflow.bundle.css">'
    return f'''<!doctype html>
<html lang="en" data-theme="light" data-palette="blue" data-density="compact">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{description}">
  <meta name="theme-color" content="#0c1119">
  <title>{title} · LabFlow</title>
  <link rel="icon" href="assets/brand/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="assets/brand/logo-horizontal-shell.svg" as="image" type="image/svg+xml">
  <script src="ui/theme-controller.js"></script>
  {style_links}
</head>
<body data-page="{page}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="app-shell" id="app">
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="sidebar-brand-row"><a class="brand" href="index.html" aria-label="LabFlow — Manage experiments. Accelerate discovery.">
        <img class="brand-lockup" src="assets/brand/logo-horizontal-shell.svg" width="188" height="41" alt="LabFlow">
      </a><button class="btn btn-ghost icon-btn sidebar-close" data-action="menu" type="button" aria-label="Close navigation">{icon("close")}</button></div>
      <div class="sidebar-scroll">
        <div class="nav-label">Research</div>
        <nav class="nav" aria-label="Research workspace">{nav_links(page, NAV)}</nav>
        <div class="nav-label">Reference</div>
        <nav class="nav" aria-label="Product reference">{nav_links(page, REFERENCE)}</nav>
      </div>
      <div class="sidebar-footer"><button class="user-chip" data-action="profile" type="button"><span class="avatar">MG</span><span><strong>Matteo Ginesi</strong><span>Perovskite Researcher</span></span></button></div>
    </aside>
    <header class="topbar">
      <div class="topbar-left">
        <button class="btn btn-ghost icon-btn mobile-menu" data-action="menu" type="button" aria-label="Open navigation">{icon("menu")}</button>
        <a class="mobile-brand" href="index.html" aria-label="LabFlow"><img src="assets/brand/logo-mark.svg" width="25" height="25" alt=""><span class="mobile-brand-copy"><strong>LabFlow</strong><small class="mobile-brand-title">{title}</small></span></a>
        <div class="topbar-context"><span class="topbar-context-brand">LABFLOW</span><span class="topbar-page-title" id="topbar-page-title">{title}</span></div>
      </div>
      <div class="global-search" id="global-search">
        {icon("search")}
        <input id="global-search-input" name="global-search" type="search" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="global-search-results" aria-autocomplete="list" placeholder="Search projects, knowledge, datasets, models and tools…">
<div class="global-search-results" id="global-search-results" role="listbox" hidden></div>
      </div>
      <div class="topbar-right">
        <span class="badge top-status" title="Static local proof of concept">LOCAL POC</span>
        <button class="btn btn-ghost icon-btn mobile-search" data-action="search" type="button" aria-label="Open global search">{icon("search")}</button>
        <button class="btn btn-ghost icon-btn" data-action="assistant" type="button" aria-label="Open Lab Assistant">{icon("spark")}</button>
        <button class="btn btn-ghost icon-btn" data-action="quick-theme" type="button" aria-label="Toggle content theme">{icon("palette")}</button>
        <button class="top-user" data-action="profile" type="button"><span class="avatar">MG</span><span class="top-user-copy"><strong>Matteo Ginesi</strong><span>Advanced Photovoltaics</span></span></button>
      </div>
    </header>
    <main class="main" id="main-content"><div class="content" id="page-content"><div class="page-bootstrap" aria-hidden="true"><span></span><strong>{title}</strong><i></i><i></i></div></div></main>
  </div>
  <div id="global-overlays"></div>
  <div class="modal-backdrop" id="modal" hidden></div>
  {scripts(page)}
</body>
</html>
'''


def main() -> None:
    for filename, (page, title, description) in PAGES.items():
        (ROOT / filename).write_text(render(page, title, description), encoding="utf-8")
    print(f"Wrote {len(PAGES)} static LabFlow entry pages")


if __name__ == "__main__":
    main()
