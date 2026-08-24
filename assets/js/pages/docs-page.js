(function () {
  'use strict';
  const LF = window.LabFlow = window.LabFlow || {};
  const C = LF.Core;
  let diagramSequence = 0;

  function documents() { return LF.DocsBundle && Array.isArray(LF.DocsBundle.documents) ? LF.DocsBundle.documents : []; }
  function selectedDocument() {
    const docs = documents(), slug = LF.State && LF.State.state && LF.State.state.docsSlug;
    return docs.find(function (doc) { return doc.slug === slug; }) || docs[0] || null;
  }
  function normalizePath(path) {
    const parts = [];
    String(path || '').split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') parts.pop(); else parts.push(part);
    });
    return parts.join('/');
  }
  function linkedMarkdown(markdown, current) {
    return String(markdown || '').replace(/\[([^\]]+)\]\(([^)\s]+\.md)(?:#[^)]+)?\)/gi, function (match, label, href) {
      const base = String(current.path || '').split('/'); base.pop();
      const path = normalizePath((href.charAt(0) === '/' ? '' : base.join('/') + '/') + href.replace(/^\//, ''));
      const target = documents().find(function (doc) { return doc.path.toLowerCase() === path.toLowerCase(); });
      return target ? '[' + label + '](#docs/' + target.slug + ')' : match;
    });
  }
  function labelLines(label) {
    const explicit = String(label || '').replace(/<br\s*\/?>/gi, '|').split('|');
    const lines = [];
    explicit.forEach(function (part) {
      let current = '';
      part.trim().split(/\s+/).forEach(function (word) {
        if (current && (current + ' ' + word).length > 22) { lines.push(current); current = word; }
        else current += (current ? ' ' : '') + word;
      });
      if (current) lines.push(current);
    });
    return lines.slice(0, 3);
  }
  function renderMermaid(source) {
    const lines = String(source || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    const header = lines.shift() || 'flowchart TD';
    const orientation = /\bLR\b/i.test(header) ? 'LR' : 'TD';
    const nodes = new Map(), edges = [];
    function remember(id, label) { if (!nodes.has(id) || label) nodes.set(id, label || nodes.get(id) || id); }
    lines.forEach(function (line) {
      const match = line.match(/^([A-Za-z][\w-]*)(?:\[([^\]]+)\]|\(([^)]+)\))?\s*-->(?:\|([^|]+)\|)?\s*([A-Za-z][\w-]*)(?:\[([^\]]+)\]|\(([^)]+)\))?$/);
      if (!match) return;
      remember(match[1], match[2] || match[3]); remember(match[5], match[6] || match[7]);
      edges.push({from:match[1], to:match[5], label:match[4] || ''});
    });
    if (!nodes.size) return '<div class="notice warning"><strong>Mermaid diagram unavailable.</strong><span>The source remains available below.</span></div>';
    const rank = {}; nodes.forEach(function (_label, id) { rank[id] = 0; });
    for (let pass = 0; pass < nodes.size; pass += 1) edges.forEach(function (edge) { rank[edge.to] = Math.max(rank[edge.to], Math.min(nodes.size - 1, rank[edge.from] + 1)); });
    const groups = []; nodes.forEach(function (_label, id) { const value = rank[id] || 0; groups[value] = groups[value] || []; groups[value].push(id); });
    const maxRank = groups.length - 1, maxGroup = Math.max.apply(Math, groups.map(function (group) { return (group || []).length; }));
    const width = orientation === 'LR' ? Math.max(420, (maxRank + 1) * 180 + 30) : Math.max(420, maxGroup * 180 + 30);
    const height = orientation === 'LR' ? Math.max(150, maxGroup * 68 + 32) : Math.max(180, (maxRank + 1) * 94 + 30);
    const positions = {};
    groups.forEach(function (group, groupIndex) {
      (group || []).forEach(function (id, index) {
        if (orientation === 'LR') positions[id] = {x:18 + groupIndex * 180, y:16 + index * 68};
        else positions[id] = {x:(width - group.length * 180) / 2 + index * 180 + 16, y:14 + groupIndex * 94};
      });
    });
    diagramSequence += 1;
    const marker = 'docs-arrow-' + diagramSequence;
    const edgeSvg = edges.map(function (edge) {
      const from = positions[edge.from], to = positions[edge.to]; if (!from || !to) return '';
      const x1 = orientation === 'LR' ? from.x + 148 : from.x + 74, y1 = orientation === 'LR' ? from.y + 23 : from.y + 46;
      const x2 = orientation === 'LR' ? to.x : to.x + 74, y2 = orientation === 'LR' ? to.y + 23 : to.y;
      const path = orientation === 'LR'
        ? 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + 26) + ' ' + y1 + ', ' + (x2 - 26) + ' ' + y2 + ', ' + x2 + ' ' + y2
        : 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + 24) + ', ' + x2 + ' ' + (y2 - 24) + ', ' + x2 + ' ' + y2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 5;
      return '<path class="mermaid-edge" d="' + path + '" marker-end="url(#' + marker + ')"></path>' + (edge.label ? '<text class="mermaid-edge-label" x="' + mx + '" y="' + my + '" text-anchor="middle">' + C.escapeHtml(edge.label) + '</text>' : '');
    }).join('');
    const nodeSvg = Array.from(nodes).map(function (entry) {
      const id = entry[0], pos = positions[id], lines = labelLines(entry[1]);
      const text = lines.map(function (line, index) { return '<tspan x="' + (pos.x + 74) + '" dy="' + (index ? 13 : 0) + '">' + C.escapeHtml(line) + '</tspan>'; }).join('');
      const firstY = pos.y + 24 - ((lines.length - 1) * 6.5);
      return '<g class="mermaid-node"><rect x="' + pos.x + '" y="' + pos.y + '" width="148" height="46" rx="5"></rect><text x="' + (pos.x + 74) + '" y="' + firstY + '" text-anchor="middle">' + text + '</text></g>';
    }).join('');
    return '<figure class="docs-mermaid"><div class="docs-mermaid-canvas"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Documentation flow diagram"><defs><marker id="' + marker + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs>' + edgeSvg + nodeSvg + '</svg></div><details><summary>Mermaid source</summary><pre><code>' + C.escapeHtml(source) + '</code></pre></details></figure>';
  }
  function headingId(title, counts) {
    const base = String(title || '').replace(/<[^>]+>/g, '').toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    counts[base] = (counts[base] || 0) + 1;
    return counts[base] === 1 ? base : base + '-' + counts[base];
  }
  function renderMarkdown(doc) {
    const diagrams = [];
    let source = linkedMarkdown(doc.markdown, doc).replace(/```mermaid\s*\n([\s\S]*?)```/gi, function (_match, diagram) {
      const token = 'LFMERMAIDTOKEN' + diagrams.length;
      diagrams.push(renderMermaid(diagram.trim()));
      return '\n' + token + '\n';
    });
    let html = C.markdown(source);
    diagrams.forEach(function (diagram, index) { html = html.replace('<p>LFMERMAIDTOKEN' + index + '</p>', diagram); });
    html = html.replace(/<a href="#docs\/([^"#]+)" target="_blank" rel="noopener noreferrer">/g, '<a href="#docs/$1" data-doc-slug="$1">');
    const counts = {};
    html = html.replace(/<h([1-4])>([\s\S]*?)<\/h\1>/g, function (_match, level, title) { return '<h' + level + ' id="' + headingId(title, counts) + '">' + title + '</h' + level + '>'; });
    return html;
  }
  function outlineHtml(doc) {
    const counts = {};
    return (doc.outline || []).filter(function (item) { return item.level <= 3; }).map(function (item) {
      const id = headingId(C.escapeHtml(item.title), counts);
      return '<a class="docs-outline-link level-' + item.level + '" href="#' + id + '">' + C.escapeHtml(item.title) + '</a>';
    }).join('');
  }
  function catalogHtml(active) {
    const grouped = {};
    documents().forEach(function (doc) { (grouped[doc.section] = grouped[doc.section] || []).push(doc); });
    return Object.keys(grouped).map(function (section) {
      return '<section class="docs-catalog-group" data-doc-group><h2>' + C.escapeHtml(section) + '</h2>' + grouped[section].map(function (doc) {
        const search = [doc.title, doc.summary, doc.section, doc.path].join(' ').toLowerCase();
        return '<button type="button" class="docs-topic ' + (doc.slug === active.slug ? 'active' : '') + '" data-doc-slug="' + C.escapeHtml(doc.slug) + '" data-doc-search="' + C.escapeHtml(search) + '" ' + (doc.slug === active.slug ? 'aria-current="page"' : '') + '><strong>' + C.escapeHtml(doc.title) + '</strong><small>' + C.escapeHtml(doc.summary) + '</small><span>' + C.escapeHtml(doc.path.replace(/^docs\//, '')) + ' · ' + doc.words + ' words</span></button>';
      }).join('') + '</section>';
    }).join('');
  }
  function render() {
    const docs = documents(), doc = selectedDocument();
    if (!doc) return '<section class="page"><div class="notice warning"><strong>Documentation bundle is empty.</strong><span>Run the documentation bundle builder.</span></div></section>';
    const sections = Array.from(new Set(docs.map(function (item) { return item.section; })));
    const query = LF.State.state.docsQuery || '', section = LF.State.state.docsSection || 'all';
    return '<section class="page docs-page">' + LF.PageShell.pageHead('Documentation','Researcher guidance and technical reference, rendered locally from versioned Markdown.') +
      '<div class="docs-provenance"><span><strong>' + docs.length + '</strong> Markdown documents</span><span><strong>' + sections.length + '</strong> collections</span><span><strong>Local</strong> no documentation network requests</span><span><strong>Mermaid</strong> diagrams from fenced source</span></div>' +
      '<div class="docs-workbench">' +
        '<aside class="panel docs-catalog" aria-label="Documentation topics"><div class="docs-catalog-tools"><label class="field-label" for="docsSearch">Find documentation</label><input class="input" id="docsSearch" type="search" autocomplete="off" placeholder="Search topics and paths…" value="' + C.escapeHtml(query) + '"><label class="field-label" for="docsSection">Collection</label><select class="select" id="docsSection"><option value="all">All collections</option>' + sections.map(function (name) { return '<option value="' + C.escapeHtml(name) + '" ' + (name === section ? 'selected' : '') + '>' + C.escapeHtml(name) + '</option>'; }).join('') + '</select><span class="docs-result-count" id="docsResultCount" aria-live="polite"></span></div><nav class="docs-topic-list" data-scroll-memory>' + catalogHtml(doc) + '</nav></aside>' +
        '<article class="panel docs-document"><header class="docs-document-head"><div><span class="eyebrow">' + C.escapeHtml(doc.section) + '</span><strong>' + C.escapeHtml(doc.title) + '</strong><small>' + C.escapeHtml(doc.path) + ' · ' + doc.words + ' words</small></div><button type="button" class="button compact" data-copy-doc="' + C.escapeHtml(doc.slug) + '">Copy Markdown</button></header><div class="markdown-view docs-markdown">' + renderMarkdown(doc) + '</div><details class="docs-source"><summary>Markdown source <span>' + C.escapeHtml(doc.path) + '</span></summary><pre><code>' + C.escapeHtml(doc.markdown) + '</code></pre></details></article>' +
        '<aside class="panel docs-outline" aria-label="On this page"><div class="panel-head"><div><span class="eyebrow">ON THIS PAGE</span><strong>' + C.escapeHtml(doc.title) + '</strong></div></div><nav>' + outlineHtml(doc) + '</nav><div class="docs-outline-foot"><span>Source of truth</span><strong>Versioned Markdown</strong><small>Rendered without a backend or CDN.</small></div></aside>' +
      '</div></section>';
  }
  function apply(root) {
    root = root || document;
    const query = String(LF.State.state.docsQuery || '').trim().toLowerCase(), section = LF.State.state.docsSection || 'all';
    let visible = 0;
    root.querySelectorAll('[data-doc-search]').forEach(function (button) {
      const group = button.closest('[data-doc-group]'), inSection = section === 'all' || (group && group.querySelector('h2').textContent === section);
      button.hidden = !inSection || (!!query && !button.dataset.docSearch.includes(query));
      if (!button.hidden) visible += 1;
    });
    root.querySelectorAll('[data-doc-group]').forEach(function (group) { group.hidden = !group.querySelector('[data-doc-search]:not([hidden])'); });
    const count = root.querySelector('#docsResultCount'); if (count) count.textContent = visible + ' topic' + (visible === 1 ? '' : 's');
    return visible;
  }
  function markdownFor(slug) { const doc = documents().find(function (item) { return item.slug === slug; }); return doc ? doc.markdown : ''; }

  LF.DocsPage = {render:render, apply:apply, markdownFor:markdownFor, renderMermaid:renderMermaid};
}());
