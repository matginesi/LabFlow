# POC architecture

LabFlow is a static multi-page application using HTML, two shared stylesheets,
one interaction layer and browser-side exporters. The shared shell, demo stores
and delegated handlers live in `assets/app.js`.

Canonical destinations are Workspace, Experiments, Lab Cabinet, Imports, Tools,
Report & Export Center, Settings, Documentation, UI Kit and AI workspace.
Specialist detail pages remain deep links rather than competing navigation
concepts. Relative paths and local assets preserve GitHub Pages compatibility.
