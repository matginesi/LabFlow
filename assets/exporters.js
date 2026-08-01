(() => {
  'use strict';

  const encoder = new TextEncoder();

  function columnName(index) {
    let result = ''; index += 1;
    while (index > 0) { const mod = (index - 1) % 26; result = String.fromCharCode(65 + mod) + result; index = Math.floor((index - 1) / 26); }
    return result;
  }

  function xmlEscape(value) {
    return String(value ?? '').replace(/[<>&'\"]/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[char]));
  }

  function crc32(bytes) {
    if (!crc32.table) crc32.table = Array.from({length: 256}, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crc32.table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  const le16 = value => [value & 255, (value >>> 8) & 255];
  const le32 = value => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];

  function zipStore(files) {
    const localParts = []; const centralParts = []; let offset = 0;
    files.forEach(file => {
      const name = encoder.encode(file.name);
      const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
      const crc = crc32(data);
      const local = new Uint8Array([80,75,3,4, ...le16(20), ...le16(0x0800), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(name.length), ...le16(0), ...name]);
      localParts.push(local, data);
      const central = new Uint8Array([80,75,1,2, ...le16(20), ...le16(20), ...le16(0x0800), ...le16(0), ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(name.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...name]);
      centralParts.push(central);
      offset += local.length + data.length;
    });
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array([80,75,5,6, ...le16(0), ...le16(0), ...le16(files.length), ...le16(files.length), ...le32(centralSize), ...le32(offset), ...le16(0)]);
    return new Blob([...localParts, ...centralParts, end], {type:'application/zip'});
  }

  function exportAppearance() {
    const root=document.documentElement, palette=root.dataset.palette || 'blue', theme=root.dataset.theme || 'light';
    const fallbacks={blue:{accent:'#2767a9',nav:'#18283c'},red:{accent:'#9b3344',nav:'#341b20'},green:{accent:'#397653',nav:'#183729'},violet:{accent:'#7459ad',nav:'#30263d'}};
    const fallback=fallbacks[palette] || fallbacks.blue;
    const style=typeof getComputedStyle==='function'?getComputedStyle(root):null;
    const read=(name,value)=>{const candidate=style?.getPropertyValue(name)?.trim();return /^#[0-9a-f]{6}$/i.test(candidate||'')?candidate:value};
    return {palette,theme,accent:read('--accent',fallback.accent),nav:read('--nav',fallback.nav)};
  }

  function buildXlsx(sheets) {
    const appearance=exportAppearance(), accentArgb=`FF${appearance.accent.slice(1).toUpperCase()}`, navArgb=`FF${appearance.nav.slice(1).toUpperCase()}`;
    const safeNames = sheets.map((sheet, index) => (sheet.name || `Sheet ${index + 1}`).replace(/[\\/?*\[\]:]/g, ' ').slice(0,31));
    const worksheetFiles = sheets.map((sheet, index) => {
      const rows = sheet.rows || [];
      const width = Math.max(...rows.map(row=>row.length), 1);
      const widths = Array.from({length:width},(_,c)=>Math.min(42,Math.max(10,...rows.slice(0,120).map(row=>String(row[c]??'').length+2))));
      const cols = `<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
      const xmlRows = rows.map((row, r) => `<row r="${r + 1}"${r===0?' ht="24" customHeight="1"':''}>${row.map((value, c) => {
        const ref = `${columnName(c)}${r + 1}`; const style = r === 0 ? ' s="1"' : ' s="2"';
        return typeof value === 'number' && Number.isFinite(value)
          ? `<c r="${ref}"${style}><v>${value}</v></c>`
          : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
      }).join('')}</row>`).join('');
      const filter = rows.length>1 && width>1 ? `<autoFilter ref="A1:${columnName(width-1)}${rows.length}"/>` : '';
      return {name:`xl/worksheets/sheet${index + 1}.xml`, data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${index===0?' tabSelected="1"':''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetFormatPr defaultRowHeight="18"/><sheetData>${xmlRows}</sheetData>${filter}<pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.25" footer="0.25"/></worksheet>`};
    });
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safeNames.map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Aptos"/><color rgb="FF1C2733"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="${accentArgb}"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="${navArgb}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F7FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFDDE3E9"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`;
    return zipStore([{name:'[Content_Types].xml', data:contentTypes},{name:'_rels/.rels',data:rels},{name:'xl/workbook.xml',data:workbook},{name:'xl/_rels/workbook.xml.rels',data:workbookRels},{name:'xl/styles.xml',data:styles},...worksheetFiles]);
  }

  function wordRun(text, options={}) {
    const color = options.color ? `<w:color w:val="${options.color.replace('#','').toUpperCase()}"/>` : '';
    const bold = options.bold ? '<w:b/>' : '';
    const size = options.size ? `<w:sz w:val="${Math.round(options.size*2)}"/><w:szCs w:val="${Math.round(options.size*2)}"/>` : '';
    return `<w:r><w:rPr>${bold}${color}${size}<w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
  }
  function wordParagraph(text='', options={}) {
    const shade = options.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.shade.replace('#','').toUpperCase()}"/>` : '';
    const spacing = `<w:spacing w:before="${options.before||0}" w:after="${options.after??100}"/>`;
    const align = options.align ? `<w:jc w:val="${options.align}"/>` : '';
    const border = options.bottomBorder ? `<w:pBdr><w:bottom w:val="single" w:sz="10" w:space="4" w:color="${options.bottomBorder.replace('#','').toUpperCase()}"/></w:pBdr>` : '';
    return `<w:p><w:pPr>${shade}${spacing}${align}${border}</w:pPr>${wordRun(text,options)}</w:p>`;
  }
  function wordTable(rows, appearance) {
    if(!rows?.length) return '';
    const widths = Array.from({length:Math.max(...rows.map(row=>row.length),1)},()=>Math.floor(9300/Math.max(...rows.map(row=>row.length),1)));
    const rowXml = rows.map((row,r)=>`<w:tr>${row.map((value,c)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[c]}" w:type="dxa"/>${r===0?`<w:shd w:val="clear" w:fill="${appearance.accent.slice(1).toUpperCase()}"/>`:''}</w:tcPr>${wordParagraph(value,{bold:r===0,color:r===0?'#ffffff':'#1c2733',size:r===0?9.5:9,after:40})}</w:tc>`).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="DDE3E9"/><w:left w:val="single" w:sz="4" w:color="DDE3E9"/><w:bottom w:val="single" w:sz="4" w:color="DDE3E9"/><w:right w:val="single" w:sz="4" w:color="DDE3E9"/><w:insideH w:val="single" w:sz="4" w:color="DDE3E9"/><w:insideV w:val="single" w:sz="4" w:color="DDE3E9"/></w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>${rowXml}</w:tbl>`;
  }
  function buildDocx(documentData={}) {
    const appearance=exportAppearance();
    const sections=documentData.sections||[];
    const metaRows=(documentData.meta||[]).map(item=>Array.isArray(item)?item:[item.label,item.value]);
    const body=[
      wordParagraph('LABFLOW',{shade:appearance.nav,color:'#ffffff',bold:true,size:18,after:40}),
      wordParagraph(documentData.title||'LabFlow report',{bold:true,size:26,color:appearance.accent,after:80}),
      documentData.subtitle?wordParagraph(documentData.subtitle,{size:11,color:'#617083',after:160}):'',
      metaRows.length?wordTable([['Field','Value'],...metaRows],appearance):'',
      wordParagraph('',{after:80})
    ];
    sections.forEach((section,index)=>{
      body.push(wordParagraph(`${String(index+1).padStart(2,'0')}  ${section.heading||'Section'}`,{bold:true,size:15,color:appearance.accent,before:160,after:70,bottomBorder:appearance.accent}));
      (section.paragraphs||[]).forEach(paragraph=>body.push(wordParagraph(paragraph,{size:10.5,color:'#1c2733',after:100})));
      if(section.bullets?.length){section.bullets.forEach(item=>body.push(`<w:p><w:pPr><w:spacing w:after="60"/><w:ind w:left="360" w:hanging="180"/></w:pPr>${wordRun(`• ${item}`,{size:10})}</w:p>`));}
      if(section.table?.length)body.push(wordTable(section.table,appearance));
    });
    body.push(wordParagraph(`Generated locally by LabFlow · ${new Date().toLocaleString()}`,{size:8.5,color:'#617083',before:180,after:0,bottomBorder:'#DDE3E9'}));
    const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="450" w:footer="450"/></w:sectPr></w:body></w:document>`;
    const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
    const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(documentData.title||'LabFlow report')}</dc:title><dc:creator>LabFlow</dc:creator><cp:lastModifiedBy>LabFlow</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`;
    const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LabFlow</Application><Company>LabFlow research workspace</Company></Properties>`;
    return zipStore([{name:'[Content_Types].xml',data:contentTypes},{name:'_rels/.rels',data:rels},{name:'word/document.xml',data:documentXml},{name:'docProps/core.xml',data:core},{name:'docProps/app.xml',data:app}]);
  }

  function buildSummaryPdf(data={}) {
    const appearance=exportAppearance(),W=1240,H=1754,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    const ink='#18212c',muted='#617083',line='#dbe2e9',surface='#f4f7f9',white='#ffffff',accent=appearance.accent,nav=appearance.nav;
    const font=(weight,size)=>`${weight} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const wrap=(text,x,y,maxWidth,lineHeight,maxLines=6)=>{const words=String(text||'').split(/\s+/);let lineText='',lines=0;for(const word of words){const test=lineText?`${lineText} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&lineText){ctx.fillText(lineText,x,y);y+=lineHeight;lines++;if(lines>=maxLines)return y;lineText=word}else lineText=test}if(lineText&&lines<maxLines){ctx.fillText(lineText,x,y);y+=lineHeight}return y};
    ctx.fillStyle=white;ctx.fillRect(0,0,W,H);ctx.fillStyle=nav;ctx.fillRect(0,0,W,126);ctx.fillStyle=accent;ctx.fillRect(0,126,W,7);ctx.fillStyle=white;ctx.font=font(800,30);ctx.fillText('LABFLOW',64,54);ctx.font=font(500,14);ctx.fillStyle='#c5d0dc';ctx.fillText('PROJECT SUMMARY · LOCAL EXPORT',64,84);
    let y=184;ctx.fillStyle=accent;ctx.font=font(800,14);ctx.fillText(String(data.eyebrow||'PROJECT REPORT').toUpperCase(),64,y);y+=42;ctx.fillStyle=ink;ctx.font=font(800,38);y=wrap(data.title||'LabFlow Project',64,y,1100,44,2);ctx.fillStyle=muted;ctx.font=font(500,16);y=wrap(data.subtitle||'',64,y+6,1100,23,3)+24;
    const metrics=data.metrics||[];metrics.slice(0,4).forEach((item,i)=>{const x=64+i*276;ctx.fillStyle=surface;ctx.fillRect(x,y,258,86);ctx.fillStyle=accent;ctx.fillRect(x,y,5,86);ctx.fillStyle=muted;ctx.font=font(700,10);ctx.fillText(String(item[0]).toUpperCase(),x+16,y+24);ctx.fillStyle=ink;ctx.font=font(800,24);ctx.fillText(String(item[1]),x+16,y+56);});y+=118;
    (data.sections||[]).slice(0,6).forEach((section,index)=>{ctx.fillStyle=accent;ctx.fillRect(64,y,32,28);ctx.fillStyle=white;ctx.font=font(800,12);ctx.fillText(String(index+1).padStart(2,'0'),72,y+19);ctx.fillStyle=ink;ctx.font=font(800,20);ctx.fillText(section.heading||'Section',112,y+21);y+=43;ctx.fillStyle=muted;ctx.font=font(500,13);y=wrap((section.paragraphs||[]).join(' '),64,y,1100,19,5)+15;if(section.table?.length){const rows=section.table.slice(0,6),cols=Math.max(...rows.map(r=>r.length),1),cw=1112/cols;rows.forEach((row,r)=>{ctx.fillStyle=r===0?nav:(r%2?surface:white);ctx.fillRect(64,y,1112,30);row.forEach((cell,c)=>{ctx.fillStyle=r===0?white:ink;ctx.font=font(r===0?700:500,10);ctx.fillText(String(cell).slice(0,36),72+c*cw,y+20)});y+=30});y+=12}if(y>H-180)return;});
    ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(64,H-64);ctx.lineTo(W-64,H-64);ctx.stroke();ctx.fillStyle=muted;ctx.font=font(500,11);ctx.fillText(`Generated locally · palette ${appearance.palette}`,64,H-36);return buildPdfFromCanvases([canvas]);
  }

  function rowsToCsv(rows) {
    return rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  }

  function download(content, type, filename) {
    const blob = content instanceof Blob ? content : new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function bytesFromDataUrl(dataUrl) {
    const binary = atob(dataUrl.split(',')[1]); const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function concatBytes(parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0); const out = new Uint8Array(size); let offset = 0;
    parts.forEach(part => { out.set(part, offset); offset += part.length; }); return out;
  }

  function buildPdfFromCanvases(canvases) {
    const objects = []; const pageIds = [];
    objects[1] = encoder.encode('<< /Type /Catalog /Pages 2 0 R >>');
    canvases.forEach((canvas, index) => {
      const pageId = 3 + index * 3, imageId = pageId + 1, contentId = pageId + 2; pageIds.push(pageId);
      const jpeg = bytesFromDataUrl(canvas.toDataURL('image/jpeg', 0.94));
      const imageHead = encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      objects[imageId] = concatBytes([imageHead, jpeg, encoder.encode('\nendstream')]);
      const command = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
      objects[contentId] = encoder.encode(`<< /Length ${command.length} >>\nstream\n${command}\nendstream`);
      objects[pageId] = encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });
    objects[2] = encoder.encode(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    const header = encoder.encode('%PDF-1.4\n%âãÏÓ\n'); const parts = [header]; const offsets = [0]; let offset = header.length; const maxId = Math.max(...Object.keys(objects).map(Number));
    for (let id = 1; id <= maxId; id++) {
      const pre = encoder.encode(`${id} 0 obj\n`), post = encoder.encode('\nendobj\n'); offsets[id] = offset;
      parts.push(pre, objects[id], post); offset += pre.length + objects[id].length + post.length;
    }
    const xrefOffset = offset; let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= maxId; id++) xref += `${String(offsets[id]).padStart(10,'0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(encoder.encode(xref)); return new Blob(parts, {type:'application/pdf'});
  }

  window.LabFlowExporters = Object.freeze({ buildXlsx, buildDocx, buildSummaryPdf, zipStore, rowsToCsv, download, buildPdfFromCanvases, columnName, exportAppearance });
})();
