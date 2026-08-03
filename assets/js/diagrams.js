(function () {
  "use strict";

  const Log = window.LabFlowLogger?.child("diagrams") || {debug(){},info(){},warn(){},error(){}};
  let sequence = 0;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);

  function parse(source) {
    const lines = String(source || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("%%"));
    const heading = lines.shift() || "flowchart TD";
    const direction = /\bLR\b/i.test(heading) ? "LR" : "TD";
    const nodes = new Map();
    const edges = [];
    const readNode = (token) => {
      const match = token.trim().match(/^([\w-]+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(([^)]+)\))?$/);
      if (!match) return null;
      const id = match[1];
      const label = match[2] || match[3] || match[4] || nodes.get(id)?.label || id;
      const shape = match[3] ? "decision" : match[4] ? "round" : "box";
      nodes.set(id, {id, label, shape});
      return id;
    };
    lines.forEach((line) => {
      const parts = line.split(/\s*--(?:>|&gt;)\s*/);
      if (parts.length === 2) {
        const from = readNode(parts[0]);
        const to = readNode(parts[1]);
        if (from && to) edges.push({from, to});
      } else {
        readNode(line);
      }
    });
    if (!nodes.size) throw new Error("Add at least one node, for example: A[Sample] --> B[Result]");
    return {direction, nodes:[...nodes.values()], edges};
  }

  function layout(graph) {
    const ranks = new Map(graph.nodes.map((node) => [node.id, 0]));
    for (let pass = 0; pass < graph.nodes.length; pass += 1) {
      graph.edges.forEach(({from, to}) => ranks.set(to, Math.max(ranks.get(to) || 0, Math.min(graph.nodes.length - 1, (ranks.get(from) || 0) + 1))));
    }
    const groups = new Map();
    graph.nodes.forEach((node) => {
      const rank = ranks.get(node.id) || 0;
      if (!groups.has(rank)) groups.set(rank, []);
      groups.get(rank).push(node);
    });
    const nodeWidth = 174, nodeHeight = 58, primaryGap = 86, secondaryGap = 28, margin = 34;
    const maxRank = Math.max(...groups.keys());
    const maxGroup = Math.max(...[...groups.values()].map((group) => group.length));
    const width = graph.direction === "LR" ? margin * 2 + (maxRank + 1) * nodeWidth + maxRank * primaryGap : margin * 2 + maxGroup * nodeWidth + (maxGroup - 1) * secondaryGap;
    const height = graph.direction === "LR" ? margin * 2 + maxGroup * nodeHeight + (maxGroup - 1) * secondaryGap : margin * 2 + (maxRank + 1) * nodeHeight + maxRank * primaryGap;
    const positions = new Map();
    groups.forEach((group, rank) => group.forEach((node, index) => {
      const groupSpan = group.length * (graph.direction === "LR" ? nodeHeight : nodeWidth) + (group.length - 1) * secondaryGap;
      const offset = ((graph.direction === "LR" ? height : width) - groupSpan) / 2;
      const x = graph.direction === "LR" ? margin + rank * (nodeWidth + primaryGap) : offset + index * (nodeWidth + secondaryGap);
      const y = graph.direction === "LR" ? offset + index * (nodeHeight + secondaryGap) : margin + rank * (nodeHeight + primaryGap);
      positions.set(node.id, {x, y, width:nodeWidth, height:nodeHeight});
    }));
    return {width, height, positions};
  }

  function render(source, options = {}) {
    try {
      const graph = parse(source);
      const {width, height, positions} = layout(graph);
      const marker = `lf-arrow-${++sequence}`;
      const edges = graph.edges.map(({from, to}) => {
        const a = positions.get(from), b = positions.get(to);
        if (!a || !b) return "";
        const horizontal = graph.direction === "LR";
        const x1 = horizontal ? a.x + a.width : a.x + a.width / 2;
        const y1 = horizontal ? a.y + a.height / 2 : a.y + a.height;
        const x2 = horizontal ? b.x : b.x + b.width / 2;
        const y2 = horizontal ? b.y + b.height / 2 : b.y;
        const bend = horizontal ? `C ${x1 + 42} ${y1}, ${x2 - 42} ${y2}, ${x2} ${y2}` : `C ${x1} ${y1 + 42}, ${x2} ${y2 - 42}, ${x2} ${y2}`;
        return `<path class="diagram-edge" d="M ${x1} ${y1} ${bend}" marker-end="url(#${marker})"/>`;
      }).join("");
      const nodes = graph.nodes.map((node) => {
        const point = positions.get(node.id);
        const lines = String(node.label).match(/.{1,24}(?:\s|$)/g)?.map((line) => line.trim()).filter(Boolean) || [node.label];
        const textY = point.y + point.height / 2 - ((lines.length - 1) * 8);
        const shape = node.shape === "decision"
          ? `<path class="diagram-node-shape" d="M ${point.x + point.width / 2} ${point.y} L ${point.x + point.width} ${point.y + point.height / 2} L ${point.x + point.width / 2} ${point.y + point.height} L ${point.x} ${point.y + point.height / 2} Z"/>`
          : `<rect class="diagram-node-shape" x="${point.x}" y="${point.y}" width="${point.width}" height="${point.height}" rx="${node.shape === "round" ? 28 : 4}"/>`;
        return `<g class="diagram-node">${shape}<text x="${point.x + point.width / 2}" y="${textY}" text-anchor="middle">${lines.map((line, index) => `<tspan x="${point.x + point.width / 2}" dy="${index ? 16 : 0}">${esc(line)}</tspan>`).join("")}</text></g>`;
      }).join("");
      return `<svg class="lf-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label || "Workflow diagram")}"><defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="diagram-arrow"/></marker></defs>${edges}${nodes}</svg>`;
    } catch (error) {
      return `<div class="diagram-error" role="alert"><strong>Diagram not rendered</strong><span>${esc(error.message)}</span></div>`;
    }
  }

  Log.info("module.ready");
  window.LabFlowDiagrams = {parse, render};
})();
