/* global JSZip */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReportExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const A4 = { w: 595.28, h: 841.89 };
  const xml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const safeText = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const number = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
  function latexReadable(latex) {
    let s=String(latex||'');
    const greek={alpha:'α',beta:'β',gamma:'γ',delta:'δ',Delta:'Δ',epsilon:'ε',varepsilon:'ε',eta:'η',theta:'θ',lambda:'λ',mu:'μ',nu:'ν',pi:'π',rho:'ρ',sigma:'σ',Sigma:'Σ',tau:'τ',phi:'φ',varphi:'φ',chi:'χ',psi:'ψ',omega:'ω',Omega:'Ω'};
    s=s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,'($1)/($2)');
    s=s.replace(/\\(?:mathrm|text|operatorname)\s*\{([^{}]*)\}/g,'$1');
    s=s.replace(/\\([A-Za-z]+)/g,(_m,name)=>Object.prototype.hasOwnProperty.call(greek,name)?greek[name]:({times:'×',cdot:'·',pm:'±',approx:'≈',leq:'≤',geq:'≥',neq:'≠',rightarrow:'→',leftarrow:'←',infty:'∞',partial:'∂',nabla:'∇',sum:'Σ',prod:'Π'}[name]||name));
    return s.replace(/\\[,;!]/g,' ').replace(/\\_/g,'_').replace(/\{([^{}]*)\}/g,'$1').replace(/\s+/g,' ').trim();
  }
  function replaceInlineMath(text){return String(text||'').replace(/\\\(([^\n]*?)\\\)/g,(_m,x)=>latexReadable(x)).replace(/(^|[^\\$])\$([^$\n]+?)\$/g,(_m,p,x)=>p+latexReadable(x));}
  const stripInline = text => replaceInlineMath(text).replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, '$1$2').replace(/`([^`]+)`/g, '$1');

  function parseMarkdown(source) {
    const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i += 1; continue; }
      const fence = line.match(/^```(.*)$/);
      if (fence) {
        const code = []; i += 1;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i += 1; }
        if (i < lines.length) i += 1;
        blocks.push({ type: 'code', lang: fence[1].trim(), text: code.join('\n') });
        continue;
      }
      const displaySame=line.match(/^\s*\$\$([\s\S]*?)\$\$\s*$/);
      if(displaySame){blocks.push({type:'equation',latex:displaySame[1].trim(),equationIndex:blocks.filter(x=>x.type==='equation').length});i+=1;continue;}
      if(/^\s*\$\$\s*$/.test(line)){
        const eq=[];i+=1;while(i<lines.length&&!/^\s*\$\$\s*$/.test(lines[i])){eq.push(lines[i]);i+=1;}if(i<lines.length)i+=1;
        blocks.push({type:'equation',latex:eq.join('\n').trim(),equationIndex:blocks.filter(x=>x.type==='equation').length});continue;
      }
      const bracketSame=line.match(/^\s*\\\[([\s\S]*?)\\\]\s*$/);
      if(bracketSame){blocks.push({type:'equation',latex:bracketSame[1].trim(),equationIndex:blocks.filter(x=>x.type==='equation').length});i+=1;continue;}
      if(/^\s*\\\[\s*$/.test(line)){
        const eq=[];i+=1;while(i<lines.length&&!/^\s*\\\]\s*$/.test(lines[i])){eq.push(lines[i]);i+=1;}if(i<lines.length)i+=1;
        blocks.push({type:'equation',latex:eq.join('\n').trim(),equationIndex:blocks.filter(x=>x.type==='equation').length});continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i += 1; continue; }
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i += 1; }
        blocks.push({ type: 'list', ordered: false, items }); continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i += 1; }
        blocks.push({ type: 'list', ordered: true, items }); continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^>\s?/, '')); i += 1; }
        blocks.push({ type: 'quote', text: quote.join(' ') }); continue;
      }
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
        const split = value => value.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
        const head = split(line); i += 2; const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(split(lines[i])); i += 1; }
        blocks.push({ type: 'table', head, rows }); continue;
      }
      const para = [line.trim()]; i += 1;
      while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^\s*\$\$/.test(lines[i]) && !/^\s*\\\[/.test(lines[i])) {
        if (lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) break;
        para.push(lines[i].trim()); i += 1;
      }
      blocks.push({ type: 'paragraph', text: para.join(' ') });
    }
    return blocks;
  }

  function softBreakLongTokens(text){return String(text||'').split(/(\s+)/).map(function(token){if(/^\s+$/.test(token)||token.length<34)return token;let out='',n=0;for(const ch of token){out+=ch;n++;if(/[\/_\-.]/.test(ch)||n>=28){out+='\u200B';n=0;}}return out;}).join('');}

  function docxRun(text, opts = {}) {
    const rPr = [];
    if (opts.bold) rPr.push('<w:b/>');
    if (opts.italic) rPr.push('<w:i/>');
    if (opts.code) rPr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>', '<w:shd w:fill="F2F4F5"/>');
    if (opts.color) rPr.push(`<w:color w:val="${opts.color}"/>`);
    if (opts.size) rPr.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
    return `<w:r>${rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(softBreakLongTokens(safeText(text)))}</w:t></w:r>`;
  }

  function docxInline(text) {
    const src=String(text||''),regex=/(\$[^$\n]+\$|\\\([^\n]*?\\\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]*\))/g,runs=[];let last=0,m;
    while((m=regex.exec(src))){if(m.index>last)runs.push(docxRun(src.slice(last,m.index)));const token=m[0];if(token.startsWith('**'))runs.push(docxRun(token.slice(2,-2),{bold:true}));else if(token.startsWith('`'))runs.push(docxRun(token.slice(1,-1),{code:true,color:'8F3B35'}));else if(token.startsWith('*'))runs.push(docxRun(token.slice(1,-1),{italic:true}));else if(token.startsWith('$'))runs.push(docxRun(latexReadable(token.slice(1,-1)),{italic:true,color:'315F8C'}));else if(token.startsWith('\\('))runs.push(docxRun(latexReadable(token.slice(2,-2)),{italic:true,color:'315F8C'}));else{const mm=token.match(/^\[([^\]]+)\]/);runs.push(docxRun(mm?mm[1]:token,{color:'315F8C'}));}last=m.index+token.length;}
    if(last<src.length)runs.push(docxRun(src.slice(last)));return runs.join('')||docxRun('');
  }

  function docxParagraph(text, opts = {}) {
    const pPr = [];
    if (opts.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`);
    if (opts.spacingAfter !== undefined) pPr.push(`<w:spacing w:after="${opts.spacingAfter}"/>`);
    if (opts.keepNext) pPr.push('<w:keepNext/>');
    if (opts.shade) pPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>`, '<w:ind w:left="180" w:right="180"/>');
    if (opts.borderLeft) pPr.push(`<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${opts.borderLeft}"/></w:pBdr>`);
    if (opts.bullet) pPr.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.bullet === 'ordered' ? 2 : 1}"/></w:numPr>`);
    const runs = opts.rawRuns || docxInline(text);
    return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${runs}</w:p>`;
  }

  function docxCell(text, opts = {}) {
    const tcPr = [`<w:tcW w:w="${opts.width || 1800}" w:type="dxa"/>`, `<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>`];
    if (opts.fill) tcPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>`);
    const run = docxRun(stripInline(text), { bold: opts.bold, color: opts.color || '303941', size: opts.size || 18 });
    return `<w:tc><w:tcPr>${tcPr.join('')}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run}</w:p></w:tc>`;
  }

  function docxTable(headers, rows, widths, fills) {
    const cols = headers.length;
    const w = widths || Array(cols).fill(Math.floor(9000 / Math.max(1, cols)));
    const header = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((h, i) => docxCell(h, { width: w[i], fill: fills?.[i] || 'E9EEF2', bold: true, color: '34414B' })).join('')}</w:tr>`;
    const body = rows.map((row, ri) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${headers.map((_h, i) => docxCell(row[i] ?? '', { width: w[i], fill: ri % 2 ? 'F8F9FA' : 'FFFFFF' })).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CCD3D8"/><w:left w:val="single" w:sz="4" w:color="CCD3D8"/><w:bottom w:val="single" w:sz="4" w:color="CCD3D8"/><w:right w:val="single" w:sz="4" w:color="CCD3D8"/><w:insideH w:val="single" w:sz="3" w:color="E1E5E8"/><w:insideV w:val="single" w:sz="3" w:color="E1E5E8"/></w:tblBorders></w:tblPr><w:tblGrid>${w.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>${header}${body}</w:tbl>`;
  }


  function confidenceFill(value) {
    const v = String(value || '').toLowerCase();
    if (v === 'high') return 'E7F4EB';
    if (v === 'medium') return 'FFF2D9';
    if (v === 'low') return 'FFEBE7';
    return 'EEF0F2';
  }

  function docxSolutionDiagram(solutions) {
    const rows = (solutions || []).map((x, i) => [
      `${i + 1}`,
      x.name || `Solution ${i + 1}`,
      x.composition || 'Unknown composition',
      x.role || 'Unknown role',
      x.confidence || 'unknown'
    ]);
    if (!rows.length) return '';
    const widths = [550, 1700, 3400, 1900, 1450];
    const header = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${['#','Solution','Composition / concentration','Role','Confidence'].map((h,i)=>docxCell(h,{width:widths[i],fill:['27333C','DCEAF4','DCEAF4','DCEAF4','DCEAF4'][i],bold:true,color:i===0?'FFFFFF':'34414B'})).join('')}</w:tr>`;
    const body = rows.map((row,ri)=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((v,i)=>docxCell(v,{width:widths[i],fill:i===0?'315F8C':i===4?confidenceFill(v):(ri%2?'F8FAFB':'FFFFFF'),bold:i===1,color:i===0?'FFFFFF':'303941'})).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BAC6CE"/><w:left w:val="single" w:sz="4" w:color="BAC6CE"/><w:bottom w:val="single" w:sz="4" w:color="BAC6CE"/><w:right w:val="single" w:sz="4" w:color="BAC6CE"/><w:insideH w:val="single" w:sz="3" w:color="DDE3E7"/><w:insideV w:val="single" w:sz="3" w:color="DDE3E7"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map(x=>`<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>${header}${body}</w:tbl>`;
  }

  function docxStackDiagram(stack) {
    const layers = [...(stack || [])].sort((a,b)=>(Number(b.order)||0)-(Number(a.order)||0));
    if (!layers.length) return '';
    const fills = ['DCEAF4','E5F1EA','F5EEDC','EEE8F5','E3F2F2','F3E9E6','E8EDF0'];
    const widths = [550, 1900, 2700, 2500, 1350];
    const rows = layers.map((x,i)=>[
      x.order ?? layers.length-i,
      x.layer || 'Unknown layer',
      x.material || 'Unknown material',
      x.process || 'Unknown process',
      x.confidence || 'unknown'
    ]);
    const header=`<w:tr><w:trPr><w:tblHeader/></w:trPr>${['#','Layer','Material','Process','Confidence'].map((h,i)=>docxCell(h,{width:widths[i],fill:'27333C',bold:true,color:'FFFFFF'})).join('')}</w:tr>`;
    const body=rows.map((row,ri)=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((v,i)=>docxCell(v,{width:widths[i],fill:i===4?confidenceFill(v):fills[ri%fills.length],bold:i===1,color:'303941'})).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="5" w:color="9FAEB8"/><w:left w:val="single" w:sz="5" w:color="9FAEB8"/><w:bottom w:val="single" w:sz="5" w:color="9FAEB8"/><w:right w:val="single" w:sz="5" w:color="9FAEB8"/><w:insideH w:val="single" w:sz="4" w:color="FFFFFF"/><w:insideV w:val="single" w:sz="3" w:color="C8D1D7"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map(x=>`<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>${header}${body}</w:tbl>`;
  }

  function statsRows(statistics) {
    const s = statistics || {};
    const row = (name, x, unit='') => [name, String(x?.n ?? 0), `${number(x?.mean)}${unit}`, `${number(x?.median)}${unit}`, `${number(x?.std)}${unit}`, `${number(x?.min)}${unit}`, `${number(x?.max)}${unit}`];
    return [
      row('Efficiency RV', s.effRV, '%'), row('Efficiency FW', s.effFW, '%'),
      row('Voc RV', s.vocRV, ' V'), row('Jsc RV', s.jscRV, ' mA/cm²'),
      row('FF RV', s.ffRV, '%'), row('|Hysteresis|', s.hysteresisAbsPct, '%')
    ];
  }

  function dataUrlPayload(dataUrl) {
    const m=String(dataUrl||'').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);if(!m)return null;const ext=m[1].toLowerCase()==='png'?'png':'jpg';return{payload:m[2],ext:ext,mime:ext==='png'?'image/png':'image/jpeg'};
  }

  function docxImage(rId, id, name, widthPx, heightPx) {
    const cx = Math.round(widthPx * 9525), cy = Math.round(heightPx * 9525);
    return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="180"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${xml(name)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${xml(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }

  function docxMarkdown(blocks,mathImages,registerImage) {
    const out=[];
    for(const b of blocks){
      if(b.type==='heading')out.push(docxParagraph(b.text,{style:`Heading${Math.min(3,b.level)}`,keepNext:true}));
      else if(b.type==='paragraph')out.push(docxParagraph(b.text,{spacingAfter:120}));
      else if(b.type==='quote')out.push(docxParagraph(b.text,{shade:'F5F7F8',borderLeft:'8192A0',spacingAfter:120}));
      else if(b.type==='code')out.push(docxParagraph(b.text,{shade:'F3F4F5',rawRuns:docxRun(b.text,{code:true,size:17}),spacingAfter:140}));
      else if(b.type==='list')b.items.forEach(item=>out.push(docxParagraph(item,{bullet:b.ordered?'ordered':'bullet',spacingAfter:50})));
      else if(b.type==='table')out.push(docxTable(b.head,b.rows));
      else if(b.type==='equation'){
        const asset=(mathImages||[]).find(x=>Number(x.index)===Number(b.equationIndex)&&x.dataUrl);
        if(asset&&registerImage){const im=registerImage(asset,'equation'),w=Math.max(1,Number(asset.widthPx)||180),h=Math.max(1,Number(asset.heightPx)||40),scale=Math.min(1,430/w,82/h);out.push(docxImage(im.rId,im.id,`Equation ${b.equationIndex+1}`,Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))));}
        else out.push(docxParagraph(latexReadable(b.latex),{shade:'F7FAFB',borderLeft:'5D91B5',spacingAfter:140}));
      }
    }
    return out.join('');
  }

  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="303941"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="110" w:line="276" w:lineRule="auto"/><w:wordWrap w:val="1"/></w:pPr></w:pPrDefault></w:docDefaults>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:pPr><w:spacing w:before="0" w:after="120"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="38"/><w:color w:val="1F2B33"/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr><w:sz w:val="22"/><w:color w:val="6B7780"/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="260" w:after="100"/><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="243746"/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="210" w:after="80"/><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="315F8C"/></w:rPr></w:style>
    <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="170" w:after="70"/><w:keepNext/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="42515D"/></w:rPr></w:style></w:styles>`;
  }

  function numberingXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="right"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>`;
  }

  function metricRows(model) {
    const m = model.metrics || {}, c = model.validationCounts || {};
    return [
      ['Raw JV files', String(m.rawJV ?? 0), 'Analyzer-visible', String(m.analyzerEligible ?? 0)],
      ['FW summary rows', String(m.summaryFw ?? 0), 'RV summary rows', String(m.summaryRv ?? 0)],
      ['Parameters files', String(m.parametersFiles ?? 0), 'Tracking files', String(m.trackingFiles ?? 0)],
      ['Raw absent from summary', String(m.rawMissingSummary ?? 0), 'RV efficiency = 0', String(m.zeroRvEff ?? 0)],
      ['Warnings', String(c.WARNING ?? 0), 'Errors', String(c.ERROR ?? 0)]
    ];
  }

  function evidenceRows(evidence) {
    const e = evidence || {};
    const join = values => Array.isArray(values) && values.length ? values.join(', ') : '—';
    return [
      ['Devices / cells', join(e.devices)],
      ['Researchers / users', join(e.users)],
      ['Experiment notes', join(e.notes)],
      ['Cell areas (cm²)', join(e.cellAreas)],
      ['Scan rates (mV/s)', join(e.scanRates)],
      ['Typologies', join(e.typologies)],
      ['Inversion settings', join(e.inversion)]
    ];
  }

  async function buildDocx(model) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip is required for DOCX export.');
    const zip=new JSZip(),blocks=parseMarkdown(model.markdown||''),body=[],images=[];
    function registerImage(asset,prefix){const parsed=dataUrlPayload(asset&&asset.dataUrl);if(!parsed)return null;const id=images.length+1,rId=`rId${id}`,target=`media/${prefix||'figure'}-${id}.${parsed.ext}`,im={...asset,...parsed,id,rId,target};images.push(im);return im;}
    body.push(docxParagraph(model.title || 'Scientific report', { style: 'Title' }));
    const sub=[model.reportKind==='paper'?'Scientific paper draft':'Laboratory report',model.author,model.lab,model.project].filter(Boolean).join(' · ');
    body.push(docxParagraph(sub || 'Scientific document', { style: 'Subtitle' }));
    body.push(docxTable(['Document','Value'],[['Source ZIP',model.sourceZip||'—'],['Data basis',model.dataState?.basis||'Original import interpretation'],['Working revision',String(model.dataState?.revision??0)],['Applied changes',String(model.dataState?.appliedChanges??0)],['Missing / incomplete',String(model.missingInformation?.total??0)],['Generated',model.generatedAt||new Date().toISOString()],['Content updated',model.contentUpdatedAt||'—'],['Content source',`Current Report Studio editor · ${model.sourceWords||0} words`]], [2200,6800], ['E9F6F7','F7FAFB']));
    body.push(docxMarkdown(blocks,model.mathImages||[],registerImage));
    if(model.includeCharts!==false && (model.figures||[]).length){
      body.push(docxParagraph('Figures', { style:'Heading1' }));
      for(const fig of (model.figures||[])){
        const im=registerImage(fig,'figure');if(!im)continue;
        body.push(docxParagraph(fig.caption||`Figure ${im.id}`,{style:'Heading3'}));body.push(docxImage(im.rId,im.id,fig.caption||`Figure ${im.id}`,fig.widthPx||620,fig.heightPx||300));
      }
    }
    body.push(`<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="900" w:bottom="850" w:left="900" w:header="520" w:footer="520" w:gutter="0"/></w:sectPr>`);
    const rels=images.map(im=>`<Relationship Id="${im.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${im.target}"/>`).join('');
    const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('')}</w:body></w:document>`;
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.folder('_rels').file('.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.folder('word').file('document.xml',documentXml).file('styles.xml',stylesXml()).file('numbering.xml',numberingXml());
    zip.folder('word').folder('_rels').file('document.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels}</Relationships>`);
    for(const im of images)zip.folder('word').folder('media').file(im.target.replace(/^media\//,''),im.payload,{base64:true});
    const now=new Date().toISOString();zip.folder('docProps').file('core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(model.title||'Scientific report')}</dc:title><dc:creator>${xml(model.author||'')}</dc:creator><cp:lastModifiedBy>${xml(model.author||'')}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`).file('app.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>LabFlow</Application><Company>${xml(model.lab||'')}</Company></Properties>`);
    return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE',compressionOptions:{level:4}});
  }

  // Minimal vector PDF writer. Uses standard WinAnsi fonts so exported text remains selectable.
  const winAnsiMap = new Map([[0x20ac,0x80],[0x2026,0x85],[0x2018,0x91],[0x2019,0x92],[0x201c,0x93],[0x201d,0x94],[0x2022,0x95],[0x2013,0x96],[0x2014,0x97],[0x2122,0x99]]);
  function winAnsiCode(ch) { const cp = ch.codePointAt(0); if (cp <= 255) return cp; return winAnsiMap.get(cp) ?? 63; }
  function pdfEsc(text) {
    let out = '';
    for (const ch of safeText(text)) {
      const code = winAnsiCode(ch);
      if (code === 40 || code === 41 || code === 92) out += `\\${String.fromCharCode(code)}`;
      else if (code === 10 || code === 13) out += ' ';
      else out += String.fromCharCode(code);
    }
    return out;
  }
  function latinBytes(text) { const arr = new Uint8Array(text.length); for (let i=0;i<text.length;i++) arr[i] = text.charCodeAt(i) & 255; return arr; }
  function concatBytes(parts) { const n = parts.reduce((a,b)=>a+b.length,0), out = new Uint8Array(n); let o=0; for(const p of parts){out.set(p,o);o+=p.length;} return out; }
  function base64Bytes(value){if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(String(value||''),'base64'));const raw=atob(String(value||'')),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}

  class PDFLayout {
    constructor(model) { this.model=model; this.pages=[]; this.page=null; this.y=0; this.pageNo=0; this.margin=48; this.usedMathImages={}; this.newPage(); }
    newPage() { this.pageNo += 1; this.page=[]; this.pages.push(this.page); this.y=52; this.header(); }
    cmd(s){ this.page.push(s); }
    yPdf(y){ return A4.h-y; }
    color(hex){ const h=String(hex).replace('#',''); return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]; }
    fill(hex){ const [r,g,b]=this.color(hex); this.cmd(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`); }
    stroke(hex){ const [r,g,b]=this.color(hex); this.cmd(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`); }
    rect(x,y,w,h,{fill,stroke,line=1}={}) { if(fill)this.fill(fill); if(stroke)this.stroke(stroke); this.cmd(`${line} w ${x.toFixed(2)} ${(A4.h-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill&&stroke?'B':fill?'f':'S'}`); }
    line(x1,y1,x2,y2,color='#D7DCE0',width=.6){this.stroke(color);this.cmd(`${width} w ${x1.toFixed(2)} ${this.yPdf(y1).toFixed(2)} m ${x2.toFixed(2)} ${this.yPdf(y2).toFixed(2)} l S`);}
    text(text,x,y,{size=10,bold=false,color='#303941'}={}){this.fill(color);this.cmd(`BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(2)} ${this.yPdf(y).toFixed(2)} Td (${pdfEsc(text)}) Tj ET`);}
    width(text,size=10){return String(text||'').length*size*.49;}
    wrap(text,maxWidth,size=10){const source=stripInline(text),words=source.split(/\s+/).filter(Boolean),lines=[];let cur='';const splitWord=(word)=>{const chunks=[];let part='';for(const ch of String(word)){const test=part+ch;if(part&&this.width(test,size)>maxWidth){chunks.push(part);part=ch;}else part=test;}if(part)chunks.push(part);return chunks;};for(const raw of words){const pieces=this.width(raw,size)>maxWidth?splitWord(raw):[raw];for(const word of pieces){const test=cur?`${cur} ${word}`:word;if(this.width(test,size)<=maxWidth)cur=test;else{if(cur)lines.push(cur);cur=word;}}}if(cur)lines.push(cur);return lines.length?lines:[''];}
    ensure(h){if(this.y+h> A4.h-52) this.newPage();}
    header(){ if(this.pageNo===1) return; this.text(this.model.title||'LabFlow Scientific Report',this.margin,28,{size:7.8,bold:true,color:'#71808B'}); this.text(String(this.pageNo),A4.w-this.margin,28,{size:8,color:'#71808B'}); this.line(this.margin,36,A4.w-this.margin,36,'#DDE2E6',.5); }
    footer(){ const y=A4.h-26; this.line(this.margin,y-9,A4.w-this.margin,y-9,'#E0E4E7',.4); this.text(`LabFlow · ${this.model.sourceZip||'research session'}`,this.margin,y,{size:6.8,color:'#88939B'}); this.text(`Page ${this.pageNo}`,A4.w-this.margin-34,y,{size:6.8,color:'#88939B'}); }
    paragraph(text,{size=9.5,color='#3E4952',gap=6,indent=0}={}){const lines=this.wrap(text,A4.w-2*this.margin-indent,size);this.ensure(lines.length*(size*1.45)+gap);for(const ln of lines){this.text(ln,this.margin+indent,this.y+size,{size,color});this.y+=size*1.45;}this.y+=gap;}
    equation(asset,index,latex){
      const parsed=asset&&dataUrlPayload(asset.dataUrl),pw=Number(asset&&asset.pixelWidth),ph=Number(asset&&asset.pixelHeight);
      if(!parsed||parsed.ext!=='jpg'||!Number.isFinite(pw)||!Number.isFinite(ph)||pw<=0||ph<=0){this.paragraph(latexReadable(latex),{size:9.4,color:'#315F8C',indent:12,gap:10});return;}
      const maxW=Math.min(390,A4.w-2*this.margin-50),maxH=42,ratio=pw/ph,naturalW=Math.max(1,Number(asset.widthPx)||180),naturalH=Math.max(1,Number(asset.heightPx)||40);let h=Math.min(maxH,Math.max(14,naturalH*.52)),w=h*ratio;if(w>maxW){w=maxW;h=w/ratio;}if(w>naturalW*.62){w=naturalW*.62;h=w/ratio;}this.ensure(h+18);const x=this.margin+(A4.w-2*this.margin-w)/2,y=this.y+7,name=`ImEq${Number(index)+1}`;this.usedMathImages[name]=asset;this.cmd(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(A4.h-y-h).toFixed(2)} cm /${name} Do Q`);this.y+=h+14;
    }
    heading(text,level=1){const size=level===1?17:level===2?13:11.2,gap=level===1?14:10,lines=this.wrap(stripInline(text),A4.w-2*this.margin,size),lineH=size*1.18;this.ensure(lines.length*lineH+gap+12);this.y+=level===1?6:4;for(const ln of lines){this.text(ln,this.margin,this.y+size,{size,bold:true,color:level===1?'#243746':level===2?'#127A8B':'#465762'});this.y+=lineH;}if(level===1){this.y+=2;this.line(this.margin,this.y,A4.w-this.margin,this.y,'#B9C7D1',.7);}this.y+=gap;}
    table(headers,rows,widths,colors){
      const total=A4.w-2*this.margin, ws=widths||Array(headers.length).fill(total/headers.length), scale=total/ws.reduce((a,b)=>a+b,0), cols=ws.map(x=>x*scale), hHead=26;
      const cellLines=(value,i,bold=false)=>this.wrap(stripInline(value??''),Math.max(22,cols[i]-8),bold?7.2:7.3);
      this.ensure(hHead+64);
      const drawHeader=()=>{let x=this.margin;headers.forEach((h,i)=>{this.rect(x,this.y,cols[i],hHead,{fill:colors?.[i]||'#E9EEF2',stroke:'#C9D1D7',line:.5});const lines=cellLines(h,i,true).slice(0,2);lines.forEach((ln,j)=>this.text(ln,x+4,this.y+9+j*8,{size:7.2,bold:true,color:'#33424D'}));x+=cols[i];});this.y+=hHead;};
      drawHeader();
      for(let ri=0;ri<rows.length;ri++){
        const wrapped=headers.map((_h,i)=>cellLines(rows[ri][i],i,false));
        const rowH=Math.max(22,wrapped.reduce((m,ls)=>Math.max(m,ls.length),1)*9+9);
        if(this.y+rowH>A4.h-55){this.newPage();drawHeader();}
        let x=this.margin;
        headers.forEach((_h,i)=>{this.rect(x,this.y,cols[i],rowH,{fill:ri%2?'#FAFBFC':'#FFFFFF',stroke:'#E0E4E7',line:.35});wrapped[i].forEach((ln,j)=>this.text(ln,x+4,this.y+13+j*9,{size:7.3,color:'#3E4952'}));x+=cols[i];});
        this.y+=rowH;
      }
      this.y+=10;
    }
    cover(){
      const documentLabel=this.model.reportKind==='paper'?'SCIENTIFIC PAPER DRAFT':'LABORATORY REPORT';
      this.rect(0,0,A4.w,74,{fill:'#0D1F3D'});this.rect(0,74,A4.w,3,{fill:'#127A8B'});
      this.text('LABFLOW · '+documentLabel,this.margin,26,{size:7.2,bold:true,color:'#BFE8EA'});
      const title=this.wrap(this.model.title||'Scientific report',A4.w-2*this.margin,18);let yy=48;
      for(const ln of title.slice(0,4)){this.text(ln,this.margin,yy,{size:18,bold:true,color:'#FFFFFF'});yy+=21;}
      this.y=98;
      const meta=[['Source',this.model.sourceZip||'—'],['Data basis',this.model.dataState?.basis||'Original import interpretation'],['Revision',`r${this.model.dataState?.revision??0} · ${this.model.dataState?.appliedChanges??0} changes`],['Missing / incomplete',String(this.model.missingInformation?.total??0)]];
      const colW=(A4.w-2*this.margin-12)/2;
      meta.forEach((item,i)=>{const col=i%2,row=Math.floor(i/2),x=this.margin+col*(colW+12),y=this.y+row*34;this.text(item[0].toUpperCase(),x,y,{size:6.2,bold:true,color:'#87949E'});this.text(String(item[1]).slice(0,48),x,y+13,{size:8.2,color:'#303941'});});
      this.y+=82;this.line(this.margin,this.y,A4.w-this.margin,this.y,'#D6DDE2',.6);this.y+=14;
    }
    metricPanel(){const m=this.model.metrics||{}, c=this.model.validationCounts||{}; const vals=[['RAW JV',m.rawJV??0,'#EEF4FB'],['ANALYZER VISIBLE',m.analyzerEligible??0,'#EDF6F0'],['WARNINGS',c.WARNING??0,'#FFF4DF'],['ERRORS',c.ERROR??0,'#FFF0ED']];const gap=8,w=(A4.w-2*this.margin-gap*3)/4,h=58;vals.forEach((v,i)=>{const x=this.margin+i*(w+gap);this.rect(x,this.y,w,h,{fill:v[2],stroke:'#D5DDE2',line:.5});this.text(v[0],x+8,this.y+16,{size:6.8,bold:true,color:'#697781'});this.text(String(v[1]),x+8,this.y+42,{size:20,bold:true,color:'#26343D'});});this.y+=h+18;}
    overviewCharts(){
      if(this.model.includeCharts===false)return;
      const vals=(this.model.chartData?.efficiencies||[]).map(Number).filter(Number.isFinite), pts=(this.model.chartData?.scatter||[]).filter(p=>Number.isFinite(Number(p.eff))&&Number.isFinite(Number(p.hysteresisPct)));
      if(!vals.length&&!pts.length)return;
      this.ensure(168);
      const gap=12,w=(A4.w-2*this.margin-gap)/2,h=148,y0=this.y;
      const panel=(x,title)=>{this.rect(x,y0,w,h,{fill:'#FBFCFD',stroke:'#D5DDE2',line:.55});this.text(title,x+10,y0+17,{size:8.5,bold:true,color:'#34444F'});};
      if(vals.length){
        const x0=this.margin;panel(x0,'Efficiency distribution');
        const min=Math.min(...vals),max=Math.max(...vals),bins=Math.max(5,Math.min(9,Math.round(Math.sqrt(vals.length)))),span=max-min||1,counts=Array(bins).fill(0);
        vals.forEach(v=>{const i=Math.min(bins-1,Math.floor((v-min)/span*bins));counts[i]++;});
        const maxC=Math.max(...counts,1),px=x0+29,py=y0+35,pw=w-43,ph=h-62,bw=pw/bins;
        this.line(px,py+ph,px+pw,py+ph,'#9DAAB3',.5);this.line(px,py,px,py+ph,'#9DAAB3',.5);
        counts.forEach((c,i)=>{const bh=(c/maxC)*(ph-8);this.rect(px+i*bw+1,py+ph-bh,bw-2,bh,{fill:i===counts.indexOf(maxC)?'#127A8B':'#71B8C2'});});
        this.text(number(min,1),px,py+ph+14,{size:6.2,color:'#75828B'});this.text(number(max,1),px+pw-18,py+ph+14,{size:6.2,color:'#75828B'});
        const sorted=[...vals].sort((a,b)=>a-b),med=sorted[Math.floor(sorted.length/2)];this.text(`median ${number(med,2)}% · n=${vals.length}`,x0+10,y0+h-8,{size:6.5,color:'#65737D'});
      }
      if(pts.length){
        const x0=this.margin+w+gap;panel(x0,'Efficiency vs hysteresis');
        const minE=Math.min(...pts.map(p=>Number(p.eff))),maxE=Math.max(...pts.map(p=>Number(p.eff))),minH=Math.min(0,...pts.map(p=>Number(p.hysteresisPct))),maxH=Math.max(1,...pts.map(p=>Number(p.hysteresisPct))),px=x0+29,py=y0+35,pw=w-43,ph=h-62;
        const X=v=>px+((v-minE)/(maxE-minE||1))*pw,Y=v=>py+ph-((v-minH)/(maxH-minH||1))*ph;
        this.line(px,py+ph,px+pw,py+ph,'#9DAAB3',.5);this.line(px,py,px,py+ph,'#9DAAB3',.5);
        const threshold=Number(this.model.chartData?.thresholds?.hysteresisPct);if(Number.isFinite(threshold)&&threshold>=minH&&threshold<=maxH){const yy=Y(threshold);this.line(px,yy,px+pw,yy,'#C69439',.7);this.text(`${number(threshold,0)}% warning`,px+3,yy-4,{size:5.8,color:'#9A6A1D'});}
        pts.slice(0,250).forEach(p=>{const xx=X(Number(p.eff)),yy=Y(Number(p.hysteresisPct));this.rect(xx-1.4,yy-1.4,2.8,2.8,{fill:Math.abs(Number(p.hysteresisPct))>threshold?'#B6534B':'#4F7FA3'});});
        this.text(`${number(minE,1)}%`,px,py+ph+14,{size:6.2,color:'#75828B'});this.text(`${number(maxE,1)}%`,px+pw-20,py+ph+14,{size:6.2,color:'#75828B'});this.text(`n=${pts.length}`,x0+10,y0+h-8,{size:6.5,color:'#65737D'});
      }
      this.y+=h+14;
    }
    efficiencyChart(){const top=(this.model.top10||[]).slice(0,8);if(!top.length)return;this.ensure(185);this.text('Top RV efficiency',this.margin,this.y+10,{size:10.5,bold:true,color:'#34444F'});this.y+=20;const max=Math.max(...top.map(x=>Number(x.effRV)||0),1);const labelW=105,barW=A4.w-2*this.margin-labelW-42,row=18;top.forEach((x,i)=>{const y=this.y+i*row;const label=String(x.cell||'').slice(0,20);this.text(label,this.margin,y+11,{size:7.2,color:'#53616B'});this.rect(this.margin+labelW,y+3,barW,row-7,{fill:'#F0F3F5'});this.rect(this.margin+labelW,y+3,barW*(Number(x.effRV||0)/max),row-7,{fill:i===0?'#127A8B':'#4A9AAA'});this.text(number(x.effRV,2),this.margin+labelW+barW+7,y+11,{size:7.3,bold:true,color:'#33424D'});});this.y+=top.length*row+15;}


    efficiencyHysteresisChart(){
      const pts=(this.model.chartData?.scatter||[]).filter(p=>Number.isFinite(Number(p.eff))&&Number.isFinite(Number(p.hysteresisPct)));if(!pts.length)return;
      this.ensure(180);const x0=this.margin,y0=this.y,w=A4.w-2*this.margin,h=160;
      this.rect(x0,y0,w,h,{fill:'#FBFCFD',stroke:'#D5DDE2',line:.5});this.text('Efficiency vs hysteresis',x0+12,y0+18,{size:9.2,bold:true,color:'#34444F'});
      let xmin=Math.min(...pts.map(p=>Number(p.eff))),xmax=Math.max(...pts.map(p=>Number(p.eff))),ymin=Math.min(0,...pts.map(p=>Number(p.hysteresisPct))),ymax=Math.max(1,...pts.map(p=>Number(p.hysteresisPct)));if(xmax===xmin)xmax=xmin+1;if(ymax===ymin)ymax=ymin+1;
      const px=x0+44,py=y0+34,pw=w-66,ph=h-66,X=v=>px+(v-xmin)/(xmax-xmin)*pw,Y=v=>py+ph-(v-ymin)/(ymax-ymin)*ph,threshold=Number(this.model.chartData?.thresholds?.hysteresisPct);
      for(let i=0;i<=4;i++){const yy=py+i*ph/4;this.line(px,yy,px+pw,yy,'#E1E6EA',.35);}this.line(px,py+ph,px+pw,py+ph,'#9DAAB3',.55);this.line(px,py,px,py+ph,'#9DAAB3',.55);
      if(Number.isFinite(threshold)&&threshold>=ymin&&threshold<=ymax){const yy=Y(threshold);this.line(px,yy,px+pw,yy,'#C69439',.7);this.text(`warning ${number(threshold,1)}%`,px+4,yy-4,{size:5.8,color:'#94651F'});}
      pts.slice(0,350).forEach(p=>{const x=X(Number(p.eff)),y=Y(Number(p.hysteresisPct));this.rect(x-1.7,y-1.7,3.4,3.4,{fill:Math.abs(Number(p.hysteresisPct))>threshold?'#B6534B':'#4F7FA3'});});
      this.text(`PCE ${number(xmin,1)} … ${number(xmax,1)}%`,x0+12,y0+h-9,{size:6.3,color:'#65737D'});this.text(`Hysteresis ${number(ymin,1)} … ${number(ymax,1)}% · n=${pts.length}`,x0+w-185,y0+h-9,{size:6.3,color:'#65737D'});this.y+=h+12;
    }
    histogramChart(values,title,xLabel){
      const vals=(values||[]).map(Number).filter(Number.isFinite);if(!vals.length)return;
      this.ensure(158);const x0=this.margin,y0=this.y,w=A4.w-2*this.margin,h=138;
      this.rect(x0,y0,w,h,{fill:'#FBFCFD',stroke:'#D5DDE2',line:.5});this.text(title,x0+12,y0+18,{size:9.2,bold:true,color:'#34444F'});
      const min=Math.min(...vals),max0=Math.max(...vals),max=max0===min?min+1:max0,bins=Math.max(6,Math.min(14,Math.round(Math.sqrt(vals.length)*1.5))),counts=Array(bins).fill(0),span=max-min;
      vals.forEach(v=>{const i=Math.min(bins-1,Math.floor((v-min)/span*bins));counts[i]++;});
      const peak=Math.max(...counts,1),px=x0+38,py=y0+34,pw=w-58,ph=h-62,bw=pw/bins;
      this.line(px,py+ph,px+pw,py+ph,'#9DAAB3',.5);this.line(px,py,px,py+ph,'#9DAAB3',.5);
      counts.forEach((c,i)=>{const bh=(c/peak)*(ph-6);this.rect(px+i*bw+1,py+ph-bh,Math.max(2,bw-2),bh,{fill:c===peak?'#127A8B':'#71B8C2'});});
      const sorted=[...vals].sort((a,b)=>a-b),med=sorted[Math.floor(sorted.length/2)];
      this.text(number(min,1),px,py+ph+13,{size:6.2,color:'#75828B'});this.text(number(max0,1),px+pw-18,py+ph+13,{size:6.2,color:'#75828B'});
      this.text(`${xLabel} · median ${number(med,2)} · n=${vals.length}`,x0+12,y0+h-9,{size:6.5,color:'#65737D'});this.y+=h+12;
    }
    bestJVChart(){
      const c=this.model.chartData?.bestCurve;if(!c||!((c.fw||[]).length||(c.rv||[]).length))return;
      const all=[...(c.fw||[]),...(c.rv||[])];this.ensure(210);const x0=this.margin,y0=this.y,w=A4.w-2*this.margin,h=190;
      this.rect(x0,y0,w,h,{fill:'#FBFCFD',stroke:'#D5DDE2',line:.5});this.text(`Best eligible JV curve · ${String(c.sample||'')}`,x0+12,y0+18,{size:9.2,bold:true,color:'#34444F'});
      let xmin=Math.min(...all.map(p=>p.x)),xmax=Math.max(...all.map(p=>p.x)),ymin=Math.min(...all.map(p=>p.y)),ymax=Math.max(...all.map(p=>p.y));if(xmax===xmin)xmax=xmin+1;if(ymax===ymin)ymax=ymin+1;
      const px=x0+48,py=y0+34,pw=w-70,ph=h-70,X=v=>px+(v-xmin)/(xmax-xmin)*pw,Y=v=>py+ph-(v-ymin)/(ymax-ymin)*ph;
      this.line(px,py+ph,px+pw,py+ph,'#9DAAB3',.5);this.line(px,py,px,py+ph,'#9DAAB3',.5);
      const draw=(arr,color)=>{if(!arr.length)return;this.stroke(color);this.cmd(`1.6 w ${X(arr[0].x).toFixed(2)} ${this.yPdf(Y(arr[0].y)).toFixed(2)} m `+arr.slice(1).map(p=>`${X(p.x).toFixed(2)} ${this.yPdf(Y(p.y)).toFixed(2)} l`).join(' ')+' S');};
      draw(c.fw||[],'#127A8B');draw(c.rv||[],'#B6534B');
      this.text(`V ${number(xmin,2)} … ${number(xmax,2)} V`,x0+12,y0+h-10,{size:6.3,color:'#65737D'});
      this.text(`J ${number(ymin,1)} … ${number(ymax,1)} mA/cm²`,x0+w-145,y0+h-10,{size:6.3,color:'#65737D'});
      this.y+=h+12;
    }
    groupEfficiencyChart(){
      const groups=(this.model.groupStatistics||[]).filter(g=>Number.isFinite(Number(g.medianEff))).slice(0,12);if(!groups.length)return;
      this.ensure(Math.min(290,58+groups.length*20));this.text('Group median efficiency',this.margin,this.y+10,{size:10,bold:true,color:'#34444F'});this.y+=20;
      const max=Math.max(...groups.map(g=>Number(g.medianEff)||0),1),labelW=120,barW=A4.w-2*this.margin-labelW-48,row=18;
      groups.forEach((g,i)=>{const y=this.y+i*row,label=String(g.name||'Ungrouped').slice(0,24),v=Number(g.medianEff)||0;this.text(label,this.margin,y+11,{size:7,color:'#53616B'});this.rect(this.margin+labelW,y+3,barW,row-7,{fill:'#F0F3F5'});this.rect(this.margin+labelW,y+3,barW*(v/max),row-7,{fill:i===0?'#127A8B':'#7B9AB2'});this.text(number(v,2)+'%',this.margin+labelW+barW+6,y+11,{size:7.1,bold:true,color:'#33424D'});});
      this.y+=groups.length*row+14;
    }

    statisticalSummary(){
      const rows=statsRows(this.model.statistics);
      if(!rows.length)return;
      this.heading('Descriptive JV statistics',1);
      this.table(['Metric','n','Mean','Median','SD','Min','Max'],rows,[105,32,68,68,62,62,62],['#E9EEF2','#E9EEF2','#E8F3EC','#E8F3EC','#E9EEF2','#EAF2FA','#EAF2FA']);
    }
    experimentalEvidence(){
      this.heading('Experimental evidence and acquisition settings',1);
      this.table(['Field','Observed values'],evidenceRows(this.model.experimentalEvidence),[125,385],['#E9EEF2','#F7F9FA']);
    }
    groupPerformance(){
      const groups=(this.model.groupStatistics||[]).slice(0,24);
      if(!groups.length)return;
      this.heading('Group-level performance',1);
      this.table(['Group','n','Median Eff','Eff range','Median Voc','Median Jsc','Median FF'],
        groups.map(g=>[g.name,g.n,number(g.medianEff),`${number(g.minEff)}-${number(g.maxEff)}`,number(g.medianVoc,3),number(g.medianJsc),number(g.medianFF,1)]),
        [120,32,68,82,70,78,60],['#E9EEF2','#E9EEF2','#E8F3EC','#E8F3EC','#F2EDF8','#EAF6F6','#F5EFE8']);
    }
    solutionDiagram(){
      const items=(this.model.reconstruction?.solutions||[]);
      if(!items.length)return;
      this.heading('Solution formulation map',1);
      const gap=10, cols=2, w=(A4.w-2*this.margin-gap)/cols, cardH=78;
      for(let i=0;i<items.length;i++){
        const col=i%cols;
        if(col===0)this.ensure(cardH+8);
        const x=this.margin+col*(w+gap), y=this.y, item=items[i];
        const conf=String(item.confidence||'unknown').toLowerCase();
        const accent=conf==='high'?'#3D8F62':conf==='medium'?'#C3862F':conf==='low'?'#BD6255':'#8B98A3';
        this.rect(x,y,w,cardH,{fill:'#FBFCFD',stroke:'#D2D9DE',line:.6});
        this.rect(x,y,4,cardH,{fill:accent});
        // The formulation marker is intentionally a plain information block:
        // exported scientific diagrams use the same block language as the UI.
        this.rect(x+13,y+15,27,48,{fill:'#EAF2F8',stroke:'#BFC9D0',line:.7});
        this.rect(x+13,y+15,4,48,{fill:accent});
        this.text(`S${String(i+1).padStart(2,'0')}`,x+20,y+41,{size:7.2,bold:true,color:'#2E3C46'});
        this.text(String(item.name||`Solution ${i+1}`).slice(0,25),x+47,y+19,{size:8.2,bold:true,color:'#2E3C46'});
        const comp=this.wrap(item.composition||'Composition unknown',w-58,7.1).slice(0,3);
        comp.forEach((ln,j)=>this.text(ln,x+47,y+31+j*9,{size:7.1,color:'#45545E'}));
        this.text(String(item.role||'Role unknown').slice(0,32),x+47,y+62,{size:6.6,color:'#6E7B84'});
        this.text(conf.toUpperCase(),x+w-48,y+18,{size:5.8,bold:true,color:accent});
        if(col===cols-1||i===items.length-1)this.y+=cardH+8;
      }
      const evidence=items.filter(x=>x.evidence);
      if(evidence.length){
        this.heading('Solution evidence',2);
        this.table(['Solution','Evidence / provenance'],evidence.map(x=>[x.name||'Unknown',x.evidence]),[120,390],['#DCEAF4','#E9EEF2']);
      }
    }
    stackDiagram(){
      const layers=[...(this.model.reconstruction?.stack||[])].sort((a,b)=>(Number(b.order)||0)-(Number(a.order)||0));
      if(!layers.length)return;
      this.heading('Perovskite device stack schematic',1);
      const fills=['#DCEAF4','#E5F1EA','#F5EEDC','#EEE8F5','#E3F2F2','#F3E9E6','#E8EDF0'];
      const h=34;
      this.ensure(Math.min(260,layers.length*h+50));
      this.text('TOP / CONTACT',this.margin,this.y+9,{size:6.4,bold:true,color:'#75828B'});
      this.y+=14;
      for(let i=0;i<layers.length;i++){
        const l=layers[i], fill=fills[i%fills.length], conf=String(l.confidence||'unknown').toLowerCase();
        const accent=conf==='high'?'#3D8F62':conf==='medium'?'#C3862F':conf==='low'?'#BD6255':'#8B98A3';
        if(this.y+h>A4.h-58){this.newPage();this.text('STACK CONTINUED',this.margin,this.y+8,{size:6.2,bold:true,color:'#75828B'});this.y+=14;}
        this.rect(this.margin,this.y,A4.w-2*this.margin,h,{fill,stroke:'#BFC9D0',line:.6});
        this.rect(this.margin,this.y,5,h,{fill:accent});
        this.rect(this.margin+12,this.y+7,22,20,{fill:'#27333C'});
        this.text(String(l.order??layers.length-i),this.margin+19,this.y+20,{size:7,bold:true,color:'#FFFFFF'});
        this.text(String(l.layer||'Unknown layer').slice(0,26),this.margin+43,this.y+14,{size:8,bold:true,color:'#2D3B45'});
        this.text(String(l.material||'Unknown material').slice(0,40),this.margin+43,this.y+26,{size:6.7,color:'#4B5A64'});
        this.text(String(l.process||'Process unknown').slice(0,34),this.margin+310,this.y+20,{size:6.4,color:'#67747D'});
        this.text(conf.toUpperCase(),A4.w-this.margin-47,this.y+20,{size:5.8,bold:true,color:accent});
        this.y+=h+3;
      }
      this.rect(this.margin,this.y,A4.w-2*this.margin,24,{fill:'#E8ECEF',stroke:'#AEB9C0',line:.7});
      this.text('SUBSTRATE / BOTTOM',this.margin+185,this.y+15,{size:6.8,bold:true,color:'#5A6872'});
      this.y+=34;
      const evidence=layers.filter(x=>x.evidence);
      if(evidence.length){
        this.heading('Stack evidence',2);
        this.table(['Layer','Evidence / provenance'],evidence.map(x=>[x.layer||'Unknown',x.evidence]),[120,390],['#DCEAF4','#E9EEF2']);
      }
    }
    referenceTable(){
      const top=(this.model.topRef||[]).slice(0,10);
      if(!top.length)return;
      this.heading('Reference-cell performance',1);
      this.table(['REF cell','Eff RV','Eff FW','Hyst. %','Voc RV','Jsc RV','FF RV'],
        top.map(x=>[x.cell,number(x.effRV),number(x.effFW),number(Number(x.hysteresis)*100,1),number(x.vocRV,3),number(x.jscRV),number(x.ffRV,1)]),
        [110,58,58,52,52,78,52],['#E9EEF2','#E8F3EC','#EAF2FA','#FFF4DF','#F2EDF8','#EAF6F6','#F5EFE8']);
    }
    anomalyTable(){
      const rows=(this.model.anomalies||[]).slice(0,40);
      if(!rows.length)return;
      this.heading('Quality-control anomaly table',1);
      this.table(['Cell','Issue','Eff RV','Eff FW','Hyst. %','Jsc RV','Jsc FW'],
        rows.map(x=>[x.cell,x.issue,number(x.effRV),number(x.effFW),number(x.hysteresisPct,1),number(x.jscRV),number(x.jscFW)]),
        [90,175,54,54,50,65,65],['#E9EEF2','#FFF0ED','#E8F3EC','#EAF2FA','#FFF4DF','#EAF6F6','#EAF6F6']);
    }

    markdown(blocks){for(const b of blocks){if(b.type==='heading')this.heading(b.text,b.level);else if(b.type==='paragraph')this.paragraph(b.text);else if(b.type==='quote'){this.ensure(45);this.rect(this.margin,this.y,A4.w-2*this.margin,4,{fill:'#93A9B8'});this.y+=9;this.paragraph(b.text,{size:9,color:'#5A6770',indent:10});}else if(b.type==='list'){b.items.forEach((item,i)=>this.paragraph(`${b.ordered?`${i+1}.`:'•'} ${stripInline(item)}`,{indent:8,gap:2}));this.y+=4;}else if(b.type==='code'){this.ensure(54);const lines=String(b.text).split('\n').slice(0,18);this.rect(this.margin,this.y,A4.w-2*this.margin,Math.max(34,lines.length*11+14),{fill:'#F3F5F6',stroke:'#DCE1E4',line:.4});lines.forEach((ln,i)=>this.text(ln.slice(0,90),this.margin+8,this.y+15+i*10,{size:7.2,color:'#5E4B48'}));this.y+=Math.max(34,lines.length*11+14)+8;}else if(b.type==='table')this.table(b.head,b.rows);else if(b.type==='equation'){const asset=(this.model.mathImages||[]).find(x=>Number(x.index)===Number(b.equationIndex));this.equation(asset,b.equationIndex,b.latex);}}}
    finish(){this.pages.forEach((_p,i)=>{const old=this.page,oldN=this.pageNo;this.page=this.pages[i];this.pageNo=i+1;this.footer();this.page=old;this.pageNo=oldN;});}
  }

  function yieldTask() { return new Promise(resolve => setTimeout(resolve, 0)); }

  function buildPdf(model) {
    const lay=new PDFLayout(model);lay.cover();lay.markdown(parseMarkdown(model.markdown||''));
    if(model.includeCharts!==false){
      const sel=model.chartData?.figureSelection||{};
      const any=sel.pceDistribution!==false||sel.hysteresisDistribution!==false||sel.bestJvmCurve!==false||sel.efficiencyHysteresis!==false||sel.topEfficiency!==false||sel.groupComparison!==false;
      if(any)lay.heading('Figures',1);
      if(sel.pceDistribution!==false)lay.histogramChart(model.chartData?.efficiencies||[],'PCE distribution','Efficiency (%)');
      if(sel.hysteresisDistribution!==false)lay.histogramChart(model.chartData?.hysteresis||[],'Hysteresis distribution','|ΔPCE| (%)');
      if(sel.bestJvmCurve!==false)lay.bestJVChart();
      if(sel.efficiencyHysteresis!==false)lay.efficiencyHysteresisChart();
      if(sel.topEfficiency!==false)lay.efficiencyChart();
      if(sel.groupComparison!==false)lay.groupEfficiencyChart();
    }
    lay.finish();
    const objects=[];const add=body=>{objects.push(body);return objects.length;};const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),imageRefs={};
    Object.keys(lay.usedMathImages).forEach(name=>{const asset=lay.usedMathImages[name],parsed=dataUrlPayload(asset&&asset.dataUrl),w=Math.round(Number(asset&&asset.pixelWidth)||0),h=Math.round(Number(asset&&asset.pixelHeight)||0);if(!parsed||parsed.ext!=='jpg'||w<1||h<1)return;imageRefs[name]=add({stream:base64Bytes(parsed.payload),dict:`/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`});});
    const pageNums=[],contentNums=[];for(const page of lay.pages){const stream=page.join('\n')+'\n',bytes=latinBytes(stream),contentId=add({stream:bytes});contentNums.push(contentId);pageNums.push(add(null));}
    const xobjects=Object.keys(imageRefs).length?` /XObject << ${Object.keys(imageRefs).map(name=>`/${name} ${imageRefs[name]} 0 R`).join(' ')} >>`:'';
    const pagesId=add(null),catalogId=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);pageNums.forEach((id,i)=>{objects[id-1]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4.w.toFixed(2)} ${A4.h.toFixed(2)}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >>${xobjects} >> /Contents ${contentNums[i]} 0 R >>`;});objects[pagesId-1]=`<< /Type /Pages /Count ${pageNums.length} /Kids [${pageNums.map(n=>`${n} 0 R`).join(' ')}] >>`;
    const parts=[latinBytes('%PDF-1.4\n%âãÏÓ\n')],offsets=[0];let offset=parts[0].length;objects.forEach((obj,i)=>{offsets[i+1]=offset;let body;if(obj&&obj.stream){const dict=obj.dict?`${obj.dict} `:'';body=concatBytes([latinBytes(`${i+1} 0 obj\n<< ${dict}/Length ${obj.stream.length} >>\nstream\n`),obj.stream,latinBytes('\nendstream\nendobj\n')]);}else body=latinBytes(`${i+1} 0 obj\n${obj}\nendobj\n`);parts.push(body);offset+=body.length;});const xrefOffset=offset;let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;xref+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;parts.push(latinBytes(xref));return new Blob([concatBytes(parts)],{type:'application/pdf'});
  }

  async function buildPdfAsync(model, onProgress) { const progress=typeof onProgress==='function'?onProgress:function(){};progress({stage:'Rendering document',progress:.25});await yieldTask();const blob=buildPdf(model);progress({stage:'PDF ready',progress:1});return blob; }

  return { parseMarkdown, buildDocx, buildPdf, buildPdfAsync };
});
