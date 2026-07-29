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

  function buildXlsx(sheets) {
    const safeNames = sheets.map((sheet, index) => (sheet.name || `Sheet ${index + 1}`).replace(/[\\/?*\[\]:]/g, ' ').slice(0,31));
    const worksheetFiles = sheets.map((sheet, index) => {
      const rows = sheet.rows || [];
      const xmlRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => {
        const ref = `${columnName(c)}${r + 1}`; const style = r === 0 ? ' s="1"' : '';
        return typeof value === 'number' && Number.isFinite(value)
          ? `<c r="${ref}"${style}><v>${value}</v></c>`
          : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
      }).join('')}</row>`).join('');
      return {name:`xl/worksheets/sheet${index + 1}.xml`, data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>${xmlRows}</sheetData></worksheet>`};
    });
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safeNames.map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563A8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`;
    return zipStore([{name:'[Content_Types].xml', data:contentTypes},{name:'_rels/.rels',data:rels},{name:'xl/workbook.xml',data:workbook},{name:'xl/_rels/workbook.xml.rels',data:workbookRels},{name:'xl/styles.xml',data:styles},...worksheetFiles]);
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

  window.LabFlowExporters = Object.freeze({ buildXlsx, zipStore, rowsToCsv, download, buildPdfFromCanvases, columnName });
})();
