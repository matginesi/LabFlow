#!/usr/bin/env python3
"""Regenerate the checked-in LabFlow entry pages with one static application shell."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PAGES = {
    "index.html": ("workspace", "Workspace", "LabFlow static research workspace for structured laboratory projects, AI-assisted analysis and NOMAD-ready export."),
    "project.html": ("project", "Project", "LabFlow project workflow, evidence review and local scientific export."),
    "cabinet.html": ("cabinet", "Lab Cabinet", "Reusable local laboratory materials, solutions, stacks, mappings and analysis recipes."),
    "knowledge.html": ("knowledge", "Knowledge", "Ask LabFlow across laboratory knowledge, data, relationships and evidence."),
    "tools.html": ("tools", "Tools", "Local document, data and diagram tools for the LabFlow research workspace."),
    "settings.html": ("settings", "Settings", "Temporary local LabFlow appearance, report and demonstration settings."),
    "documentation.html": ("documentation", "Documentation", "Curated LabFlow product, workflow, interface and validation guidance."),
    "ui-kit.html": ("ui-kit", "UI Kit", "LabFlow interface components, page composition patterns and responsive states."),
}

NAV = [
    ("workspace", "index.html", "home", "Workspace"),
    ("cabinet", "cabinet.html", "cabinet", "Lab Cabinet"),
    ("knowledge", "knowledge.html", "book", "Knowledge"),
    ("tools", "tools.html", "edit", "Tools"),
    ("settings", "settings.html", "settings", "Settings"),
]

REFERENCE = [
    ("documentation", "documentation.html", "book", "Documentation"),
    ("ui-kit", "ui-kit.html", "palette", "UI Kit"),
]

PATHS = {
    "home": '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    "cabinet": '<path d="M4 3h16v6H4zM5 9h14v12H5zM9 13h6"/>',
    "book": '<path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM20 4h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4z"/>',
    "edit": '<path d="m4 20 4-1 11-11-3-3L5 16zM14 7l3 3"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19 15l2 2-4 4-2-2a8 8 0 0 1-6 0l-2 2-4-4 2-2a8 8 0 0 1 0-6L3 7l4-4 2 2a8 8 0 0 1 6 0l2-2 4 4-2 2a8 8 0 0 1 0 6Z"/>',
    "palette": '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M12 7h.01M16 10h.01M8 15h.01M15 16c1 0 2-1 2-2s-1-2-2-2h-1c-1 0-2 1-2 2s1 2 2 2z"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "close": '<path d="m6 6 12 12M18 6 6 18"/>',
    "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.1 5.1"/>',
    "spark": '<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>',
    "layers": '<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
}


def icon(name: str, css_class: str = "icon") -> str:
    return f'<svg class="{css_class} icon-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{PATHS[name]}</svg>'


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
    files = [
        "assets/js/settings-bundle.js",
        "assets/js/data.js",
        "assets/js/pipeline-bundle.js",
        "assets/js/exporters.js",
    ]
    if page in {"project", "tools", "ui-kit"}:
        files.append("assets/js/workbook.js")
    files += ["assets/js/state.js", "assets/js/docs-bundle.js"]
    if page in {"knowledge", "tools", "documentation", "ui-kit"}:
        files.append("assets/js/diagrams.js")
    if page == "knowledge":
        files.append("assets/js/knowledge-pages.js")
    if page == "tools":
        files.append("assets/js/tools-page.js")
    files.append("assets/js/app.js")
    return "\n  ".join(f'<script defer src="{path}"></script>' for path in files)


def render(page: str, title: str, description: str) -> str:
    styles = [
        "ui/foundations/tokens.css",
        "ui/themes/theme-base.css",
        "ui/themes/theme-dark.css",
        "ui/themes/theme-light.css",
        "ui/themes/palettes.css",
        "ui/foundations/base.css",
        "ui/layout/shell.css",
        "ui/components/core.css",
        "ui/components/scientific.css",
        "ui/components/knowledge-tools.css",
        "ui/foundations/utilities.css",
        "ui/layout/responsive.css",
    ]
    style_links = "\n  ".join(f'<link rel="stylesheet" href="{path}">' for path in styles)
    return f'''<!doctype html>
<html lang="en" data-theme="light" data-palette="blue" data-density="compact">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{description}">
  <meta name="theme-color" content="#0c1119">
  <title>{title} · LabFlow</title>
  <link rel="icon" href="assets/brand/favicon.svg" type="image/svg+xml">
  <script src="ui/theme-controller.js"></script>
  {style_links}
</head>
<body data-page="{page}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="app-shell" id="app">
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="sidebar-brand-row"><a class="brand" href="index.html">
        <img class="brand-mark" src="assets/brand/logo-mark.svg" width="32" height="32" alt="">
        <span class="brand-copy"><strong>Lab<span>Flow</span></strong><span>Research workspace</span></span>
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
        <a class="mobile-brand" href="index.html" aria-label="LabFlow Workspace"><img src="assets/brand/logo-mark.svg" width="22" height="22" alt=""><span>{title}</span></a>
        <span class="topbar-page-title" id="topbar-page-title">{title}</span>
      </div>
      <div class="global-search" id="global-search">
        {icon("search")}
        <input id="global-search-input" name="global-search" type="search" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="global-search-results" aria-autocomplete="list" placeholder="Search projects, steps, knowledge and tools…">
        <kbd>⌘ K</kbd><div class="global-search-results" id="global-search-results" role="listbox" hidden></div>
      </div>
      <div class="topbar-right">
        <span class="badge badge-accent top-status">Local POC · No cloud sync</span>
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
