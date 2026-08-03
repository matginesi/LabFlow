(function () {
  "use strict";

  const Log = window.LabFlowLogger?.child("diagrams") || {debug(){},info(){},warn(){},error(){}};
  let sequence = 0;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);

  const DIRECTION_MAP = {TD:"TD",TB:"TD",BT:"BT",LR:"LR",RL:"RL"};
  const EDGE_TYPES = {"-->":"normal","-.->":"dashed","==>":"strong","---":"line"};

  function cleanLabel(value) {
    const label = String(value ?? "").trim();
    if ((label.startsWith('"') && label.endsWith('"')) || (label.startsWith("'") && label.endsWith("'"))) return label.slice(1,-1);
    return label;
  }

  function wrapLabel(value, limit = 25) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let current = "";
    words.forEach((word) => {
      if (!current) current = word;
      else if (`${current} ${word}`.length <= limit) current += ` ${word}`;
      else { lines.push(current); current = word; }
    });
    if (current) lines.push(current);
    return lines.slice(0,4);
  }

  function parseNodeToken(token, nodes, order) {
    const source = String(token || "").trim();
    if (!source) return null;
    const patterns = [
      [/^([A-Za-z][\w-]*)\(\((.*?)\)\)$/s,"circle"],
      [/^([A-Za-z][\w-]*)\[\[(.*?)\]\]$/s,"process"],
      [/^([A-Za-z][\w-]*)\(\[(.*?)\]\)$/s,"stadium"],
      [/^([A-Za-z][\w-]*)\{(.*?)\}$/s,"decision"],
      [/^([A-Za-z][\w-]*)\((.*?)\)$/s,"round"],
      [/^([A-Za-z][\w-]*)\[(.*?)\]$/s,"box"],
      [/^([A-Za-z][\w-]*)$/s,"box"]
    ];
    for (const [pattern,shape] of patterns) {
      const match = source.match(pattern);
      if (!match) continue;
      const id = match[1];
      const existing = nodes.get(id);
      const label = cleanLabel(match[2] ?? existing?.label ?? id) || id;
      const node = {id,label,shape:match[2] == null && existing ? existing.shape : shape,order:existing?.order ?? order};
      nodes.set(id,node);
      return id;
    }
    return null;
  }

  function edgeSegments(line) {
    const pattern = /\s*(-->|-\.->|==>|---)\s*(?:\|([^|]+)\|\s*)?/g;
    const matches = [...line.matchAll(pattern)];
    if (!matches.length) return null;
    const nodes = [];
    const operators = [];
    let cursor = 0;
    matches.forEach((match) => {
      nodes.push(line.slice(cursor,match.index).trim());
      operators.push({operator:match[1],label:cleanLabel(match[2] || "")});
      cursor = match.index + match[0].length;
    });
    nodes.push(line.slice(cursor).trim());
    return {nodes,operators};
  }

  function parse(source) {
    const rawLines = String(source || "").split(/\r?\n/);
    const lines = rawLines.map((value,index) => ({value:value.trim(),line:index + 1})).filter((item) => item.value && !item.value.startsWith("%%"));
    let direction = "TD";
    if (lines.length) {
      const heading = lines[0].value.match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)$/i);
      if (heading) {
        direction = DIRECTION_MAP[heading[1].toUpperCase()] || "TD";
        lines.shift();
      }
    }
    const nodes = new Map();
    const edges = [];
    const warnings = [];
    let order = 0;
    lines.forEach(({value,line}) => {
      if (/^(?:subgraph\b|end\b)/i.test(value)) {
        warnings.push(`Line ${line}: subgraph grouping is ignored by the local renderer`);
        return;
      }
      const chain = edgeSegments(value);
      if (chain) {
        if (chain.nodes.some((node) => !node)) throw new Error(`Line ${line}: an edge is missing a node`);
        const ids = chain.nodes.map((token) => parseNodeToken(token,nodes,order++));
        if (ids.some((id) => !id)) throw new Error(`Line ${line}: invalid node or edge syntax`);
        chain.operators.forEach((item,index) => edges.push({
          from:ids[index],to:ids[index + 1],type:EDGE_TYPES[item.operator] || "normal",label:item.label,line
        }));
        return;
      }
      if (!parseNodeToken(value,nodes,order++)) throw new Error(`Line ${line}: unsupported diagram syntax`);
    });
    if (!nodes.size) throw new Error("Add at least one node, for example: A[Sample] --> B[Result]");
    return {direction,nodes:[...nodes.values()],edges,warnings};
  }

  function layout(graph) {
    const ranks = new Map(graph.nodes.map((node) => [node.id,0]));
    const incoming = new Map(graph.nodes.map((node) => [node.id,[]]));
    const outgoing = new Map(graph.nodes.map((node) => [node.id,[]]));
    graph.edges.forEach((edge) => {
      incoming.get(edge.to)?.push(edge.from);
      outgoing.get(edge.from)?.push(edge.to);
    });
    for (let pass = 0; pass < graph.nodes.length; pass += 1) {
      let changed = false;
      graph.edges.forEach(({from,to}) => {
        const next = Math.min(graph.nodes.length - 1,(ranks.get(from) || 0) + 1);
        if (next > (ranks.get(to) || 0)) { ranks.set(to,next); changed = true; }
      });
      if (!changed) break;
    }
    const groups = new Map();
    graph.nodes.forEach((node) => {
      const rank = ranks.get(node.id) || 0;
      if (!groups.has(rank)) groups.set(rank,[]);
      groups.get(rank).push(node);
    });
    [...groups.keys()].sort((a,b) => a-b).forEach((rank) => {
      groups.get(rank).sort((a,b) => a.order - b.order);
    });

    const vertical = graph.direction === "TD" || graph.direction === "BT";
    const reverse = graph.direction === "BT" || graph.direction === "RL";
    const nodeWidth = 196;
    const nodeHeight = 68;
    const primaryGap = 96;
    const secondaryGap = 32;
    const margin = 42;
    const maxRank = Math.max(0,...groups.keys());
    const maxGroup = Math.max(1,...[...groups.values()].map((group) => group.length));
    const width = vertical
      ? margin * 2 + maxGroup * nodeWidth + Math.max(0,maxGroup - 1) * secondaryGap
      : margin * 2 + (maxRank + 1) * nodeWidth + maxRank * primaryGap;
    const height = vertical
      ? margin * 2 + (maxRank + 1) * nodeHeight + maxRank * primaryGap
      : margin * 2 + maxGroup * nodeHeight + Math.max(0,maxGroup - 1) * secondaryGap;
    const positions = new Map();
    groups.forEach((group,rank) => {
      const groupSpan = group.length * (vertical ? nodeWidth : nodeHeight) + Math.max(0,group.length - 1) * secondaryGap;
      const crossOffset = ((vertical ? width : height) - groupSpan) / 2;
      const axisRank = reverse ? maxRank - rank : rank;
      group.forEach((node,index) => {
        const x = vertical ? crossOffset + index * (nodeWidth + secondaryGap) : margin + axisRank * (nodeWidth + primaryGap);
        const y = vertical ? margin + axisRank * (nodeHeight + primaryGap) : crossOffset + index * (nodeHeight + secondaryGap);
        positions.set(node.id,{x,y,width:nodeWidth,height:nodeHeight});
      });
    });
    return {width,height,positions,incoming,outgoing,vertical,reverse};
  }

  function portOffset(index,count,span = 52) {
    if (count <= 1) return 0;
    return -span / 2 + (span / (count - 1)) * index;
  }

  function renderShape(node,point) {
    const cx = point.x + point.width / 2;
    const cy = point.y + point.height / 2;
    if (node.shape === "decision") return `<path class="diagram-node-shape diagram-node-decision" d="M ${cx} ${point.y} L ${point.x + point.width} ${cy} L ${cx} ${point.y + point.height} L ${point.x} ${cy} Z"/>`;
    if (node.shape === "circle") return `<ellipse class="diagram-node-shape diagram-node-circle" cx="${cx}" cy="${cy}" rx="${Math.min(54,point.width / 2 - 12)}" ry="${Math.min(31,point.height / 2 - 3)}"/>`;
    if (node.shape === "process") return `<rect class="diagram-node-shape diagram-node-process" x="${point.x}" y="${point.y}" width="${point.width}" height="${point.height}" rx="4"/><rect class="diagram-node-shape-secondary" x="${point.x + 7}" y="${point.y + 7}" width="${point.width - 14}" height="${point.height - 14}" rx="2"/>`;
    const radius = node.shape === "round" ? 13 : node.shape === "stadium" ? 34 : 4;
    return `<rect class="diagram-node-shape diagram-node-${node.shape}" x="${point.x}" y="${point.y}" width="${point.width}" height="${point.height}" rx="${radius}"/>`;
  }

  function render(source,options = {}) {
    try {
      const graph = parse(source);
      const {width,height,positions,incoming,outgoing,vertical,reverse} = layout(graph);
      const marker = `lf-arrow-${++sequence}`;
      const edgeUsage = new Map();
      const edges = graph.edges.map((edge) => {
        const a = positions.get(edge.from), b = positions.get(edge.to);
        if (!a || !b) return "";
        const outgoingList = outgoing.get(edge.from) || [];
        const incomingList = incoming.get(edge.to) || [];
        const outgoingKey = `${edge.from}:${edge.to}`;
        const duplicateIndex = edgeUsage.get(outgoingKey) || 0;
        edgeUsage.set(outgoingKey,duplicateIndex + 1);
        const fromIndex = Math.max(0,outgoingList.indexOf(edge.to)) + duplicateIndex;
        const toIndex = Math.max(0,incomingList.indexOf(edge.from)) + duplicateIndex;
        let x1,y1,x2,y2,path,labelX,labelY;
        if (vertical) {
          const forward = b.y >= a.y;
          x1 = a.x + a.width / 2 + portOffset(fromIndex,Math.max(1,outgoingList.length));
          x2 = b.x + b.width / 2 + portOffset(toIndex,Math.max(1,incomingList.length));
          y1 = forward ? a.y + a.height : a.y;
          y2 = forward ? b.y : b.y + b.height;
          const midY = (y1 + y2) / 2;
          path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
          labelX = (x1 + x2) / 2;
          labelY = midY - 7;
        } else {
          const forward = b.x >= a.x;
          x1 = forward ? a.x + a.width : a.x;
          x2 = forward ? b.x : b.x + b.width;
          y1 = a.y + a.height / 2 + portOffset(fromIndex,Math.max(1,outgoingList.length),38);
          y2 = b.y + b.height / 2 + portOffset(toIndex,Math.max(1,incomingList.length),38);
          const midX = (x1 + x2) / 2;
          path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
          labelX = midX;
          labelY = (y1 + y2) / 2 - 8;
        }
        const markerAttribute = edge.type === "line" ? "" : ` marker-end="url(#${marker})"`;
        const label = edge.label ? `<g class="diagram-edge-label" transform="translate(${labelX} ${labelY})"><rect x="${-Math.max(23,edge.label.length * 3.4)}" y="-10" width="${Math.max(46,edge.label.length * 6.8)}" height="19" rx="3"/><text text-anchor="middle" y="4">${esc(edge.label)}</text></g>` : "";
        return `<g class="diagram-edge-group"><path class="diagram-edge diagram-edge-${edge.type}" d="${path}"${markerAttribute}/>${label}</g>`;
      }).join("");
      const nodes = graph.nodes.map((node) => {
        const point = positions.get(node.id);
        const lines = wrapLabel(node.label,node.shape === "decision" ? 20 : 25);
        const textY = point.y + point.height / 2 - ((lines.length - 1) * 8);
        return `<g class="diagram-node diagram-node-${node.shape}" data-node-id="${esc(node.id)}">${renderShape(node,point)}<text x="${point.x + point.width / 2}" y="${textY}" text-anchor="middle">${lines.map((line,index) => `<tspan x="${point.x + point.width / 2}" dy="${index ? 16 : 0}">${esc(line)}</tspan>`).join("")}</text></g>`;
      }).join("");
      const label = options.label || "Workflow diagram";
      const description = `${graph.nodes.length} nodes and ${graph.edges.length} relationships, direction ${graph.direction}.`;
      return `<svg class="lf-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}" data-direction="${graph.direction}" data-node-count="${graph.nodes.length}" data-edge-count="${graph.edges.length}"><title>${esc(label)}</title><desc>${esc(description)}</desc><defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="diagram-arrow"/></marker></defs>${edges}${nodes}</svg>`;
    } catch (error) {
      Log.warn("render.failed",{message:error.message});
      return `<div class="diagram-error" role="alert"><strong>Diagram not rendered</strong><span>${esc(error.message)}</span></div>`;
    }
  }

  Log.info("module.ready");
  window.LabFlowDiagrams = {parse,render};
})();
