import zlib from 'zlib';
import { BigQuery } from '@google-cloud/bigquery';

function crc32Update(buf: Buffer, prevCrc = 0): number {
  return zlib.crc32(buf, prevCrc);
}

interface ZipEntryInput {
  name: string;
  compressedData: Buffer;
  uncompressedSize: number;
  crc: number;
}

function deflateBufferRaw(data: Buffer): { compressedData: Buffer; uncompressedSize: number; crc: number } {
  return {
    compressedData: zlib.deflateRawSync(data, { level: 1 }),
    uncompressedSize: data.length,
    crc: crc32Update(data, 0),
  };
}

function buildZipArchive(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');

    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(entry.crc >>> 0, 14);
    lh.writeUInt32LE(entry.compressedData.length >>> 0, 18);
    lh.writeUInt32LE(entry.uncompressedSize >>> 0, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBuf.copy(lh, 30);

    localParts.push(lh, entry.compressedData);

    const ch = Buffer.alloc(46 + nameBuf.length);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(entry.crc >>> 0, 16);
    ch.writeUInt32LE(entry.compressedData.length >>> 0, 20);
    ch.writeUInt32LE(entry.uncompressedSize >>> 0, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset >>> 0, 42);
    nameBuf.copy(ch, 46);

    centralParts.push(ch);
    offset += lh.length + entry.compressedData.length;
  }

  const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize >>> 0, 12);
  eocd.writeUInt32LE(offset >>> 0, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function escapeXmlText(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function getColumnLetter(colIdx: number): string {
  let n = colIdx;
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function unwrapBigQueryVal(val: unknown): string | number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
    const inner = (val as { value: unknown }).value;
    if (inner === null || inner === undefined || inner === '') return null;
    return String(inner);
  }
  return String(val);
}

/**
 * Gera um arquivo .xlsx (OpenXML) em alta velocidade e baixo uso de memória (streaming deflate + SharedStrings),
 * suportando centenas de milhares de linhas do BigQuery sem estourar o heap do Node.js.
 */
export async function buildFastXlsxBuffer(
  rows: Record<string, unknown>[],
  sheetName = 'Razao'
): Promise<Buffer> {
  const safeSheetName = escapeXmlText(sheetName.slice(0, 31) || 'Razao');
  const cols = rows.length > 0 ? Object.keys(rows[0]) : ['Mensagem'];
  const colLetters = cols.map((_, idx) => getColumnLetter(idx));

  const sharedMap = new Map<string, number>();
  const sharedList: string[] = [];
  let totalStringRefs = 0;

  const getSharedStringIdx = (str: string): number => {
    totalStringRefs += 1;
    let idx = sharedMap.get(str);
    if (idx === undefined) {
      idx = sharedList.length;
      sharedMap.set(str, idx);
      sharedList.push(str);
    }
    return idx;
  };

  // 1. Stream-compress xl/worksheets/sheet1.xml
  const sheetDeflate = zlib.createDeflateRaw({ level: 1 });
  const sheetChunks: Buffer[] = [];
  sheetDeflate.on('data', (c: Buffer) => sheetChunks.push(c));
  const sheetDone = new Promise<void>((resolve, reject) => {
    sheetDeflate.on('end', () => resolve());
    sheetDeflate.on('error', reject);
  });

  let sheetCrc = 0;
  let sheetUncompressed = 0;
  const writeSheetXml = (xmlChunk: string) => {
    const buf = Buffer.from(xmlChunk, 'utf8');
    sheetCrc = crc32Update(buf, sheetCrc);
    sheetUncompressed += buf.length;
    sheetDeflate.write(buf);
  };

  const lastColLetter = colLetters[colLetters.length - 1] || 'A';
  const totalRowCount = Math.max(1, rows.length + 1);

  writeSheetXml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="A1:${lastColLetter}${totalRowCount}"/>` +
      `<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<sheetData>`
  );

  // Linha 1: Cabeçalho (estilo s="1" em negrito com fundo corporativo)
  let headerRowXml = `<row r="1" ht="20" customHeight="1">`;
  for (let c = 0; c < cols.length; c++) {
    const sIdx = getSharedStringIdx(cols[c]);
    headerRowXml += `<c r="${colLetters[c]}1" s="1" t="s"><v>${sIdx}</v></c>`;
  }
  headerRowXml += `</row>`;
  writeSheetXml(headerRowXml);

  // Linhas de dados em blocos de 1500 para manter o consumo de RAM mínimo
  let batchXml = '';
  for (let r = 0; r < rows.length; r++) {
    const rowObj = rows[r];
    const rowNum = r + 2;
    batchXml += `<row r="${rowNum}">`;
    for (let c = 0; c < cols.length; c++) {
      const rawVal = rowObj[cols[c]];
      const val = unwrapBigQueryVal(rawVal);
      if (val === null) continue;
      if (typeof val === 'number') {
        batchXml += `<c r="${colLetters[c]}${rowNum}"><v>${val}</v></c>`;
      } else {
        const sIdx = getSharedStringIdx(val);
        batchXml += `<c r="${colLetters[c]}${rowNum}" t="s"><v>${sIdx}</v></c>`;
      }
    }
    batchXml += `</row>`;

    if ((r + 1) % 1500 === 0) {
      writeSheetXml(batchXml);
      batchXml = '';
    }
  }
  if (batchXml) {
    writeSheetXml(batchXml);
  }

  writeSheetXml(
    `</sheetData>` +
      `<autoFilter ref="A1:${lastColLetter}${totalRowCount}"/>` +
      `</worksheet>`
  );
  sheetDeflate.end();
  await sheetDone;
  const sheetCompressed = Buffer.concat(sheetChunks);

  // 2. Stream-compress xl/sharedStrings.xml
  const ssDeflate = zlib.createDeflateRaw({ level: 1 });
  const ssChunks: Buffer[] = [];
  ssDeflate.on('data', (c: Buffer) => ssChunks.push(c));
  const ssDone = new Promise<void>((resolve, reject) => {
    ssDeflate.on('end', () => resolve());
    ssDeflate.on('error', reject);
  });

  let ssCrc = 0;
  let ssUncompressed = 0;
  const writeSsXml = (xmlChunk: string) => {
    const buf = Buffer.from(xmlChunk, 'utf8');
    ssCrc = crc32Update(buf, ssCrc);
    ssUncompressed += buf.length;
    ssDeflate.write(buf);
  };

  writeSsXml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalStringRefs}" uniqueCount="${sharedList.length}">`
  );

  let ssBatch = '';
  for (let i = 0; i < sharedList.length; i++) {
    ssBatch += `<si><t xml:space="preserve">${escapeXmlText(sharedList[i])}</t></si>`;
    if ((i + 1) % 4000 === 0) {
      writeSsXml(ssBatch);
      ssBatch = '';
    }
  }
  if (ssBatch) {
    writeSsXml(ssBatch);
  }
  writeSsXml(`</sst>`);
  ssDeflate.end();
  await ssDone;
  const ssCompressed = Buffer.concat(ssChunks);

  // 3. Demais arquivos estáticos do pacote OpenXML (.xlsx)
  const contentTypesXml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `</Types>`,
    'utf8'
  );

  const rootRelsXml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    'utf8'
  );

  const workbookXml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets>` +
      `</workbook>`,
    'utf8'
  );

  const workbookRelsXml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
      `</Relationships>`,
    'utf8'
  );

  const stylesXml = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<fonts count="2">` +
      `<font><sz val="10"/><color rgb="FF1F2937"/><name val="Calibri"/></font>` +
      `<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
      `</fonts>` +
      `<fills count="3">` +
      `<fill><patternFill patternType="none"/></fill>` +
      `<fill><patternFill patternType="gray125"/></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FF14412A"/><bgColor indexed="64"/></patternFill></fill>` +
      `</fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="2">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
      `</cellXfs>` +
      `</styleSheet>`,
    'utf8'
  );

  const entries: ZipEntryInput[] = [
    { name: '[Content_Types].xml', ...deflateBufferRaw(contentTypesXml) },
    { name: '_rels/.rels', ...deflateBufferRaw(rootRelsXml) },
    { name: 'xl/workbook.xml', ...deflateBufferRaw(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', ...deflateBufferRaw(workbookRelsXml) },
    { name: 'xl/styles.xml', ...deflateBufferRaw(stylesXml) },
    {
      name: 'xl/sharedStrings.xml',
      compressedData: ssCompressed,
      uncompressedSize: ssUncompressed,
      crc: ssCrc,
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      compressedData: sheetCompressed,
      uncompressedSize: sheetUncompressed,
      crc: sheetCrc,
    },
  ];

  return buildZipArchive(entries);
}

/**
 * Executa uma query no BigQuery e faz o download paralelo dos blocos da tabela temporária de destino,
 * reduzindo o tempo de leitura de grandes volumes (100k–400k linhas) em até 8x.
 */
export async function queryBigQueryFast(
  bigquery: BigQuery,
  query: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const options: { query: string; params?: Record<string, unknown>; location?: string } = {
    query,
    location: 'southamerica-east1',
  };
  if (params && Object.keys(params).length > 0) {
    options.params = params;
  }

  let job;
  try {
    [job] = await bigquery.createQueryJob(options);
  } catch {
    delete options.location;
    [job] = await bigquery.createQueryJob(options);
  }

  const [firstPage, , firstResp] = await job.getQueryResults({ maxResults: 10000, autoPaginate: false });
  const totalRows = Number((firstResp as { totalRows?: string | number })?.totalRows || firstPage.length);

  if (totalRows <= firstPage.length) {
    return firstPage as Record<string, unknown>[];
  }

  const dest = job.metadata?.configuration?.query?.destinationTable as
    | { projectId: string; datasetId: string; tableId: string }
    | undefined;

  if (!dest || !dest.datasetId || !dest.tableId) {
    const [allRows] = await job.getQueryResults({ autoPaginate: true });
    return allRows as Record<string, unknown>[];
  }

  const destTable = bigquery.dataset(dest.datasetId, { projectId: dest.projectId }).table(dest.tableId);
  const CHUNK_SIZE = 10000;
  const starts: number[] = [];
  for (let start = firstPage.length; start < totalRows; start += CHUNK_SIZE) {
    starts.push(start);
  }

  const resultsByChunk: Record<string, unknown>[][] = new Array(starts.length);
  const CONCURRENCY = 16;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, starts.length) }, async () => {
    while (cursor < starts.length) {
      const idx = cursor++;
      const startOffset = starts[idx];
      const expected = Math.min(CHUNK_SIZE, totalRows - startOffset);
      const collected: Record<string, unknown>[] = [];

      while (collected.length < expected) {
        const remaining = expected - collected.length;
        const [chunkRows] = await destTable.getRows({
          startIndex: String(startOffset + collected.length),
          maxResults: remaining,
          autoPaginate: false,
        });
        if (!chunkRows || chunkRows.length === 0) break;
        for (let i = 0; i < chunkRows.length && collected.length < expected; i++) {
          collected.push(chunkRows[i] as Record<string, unknown>);
        }
      }
      resultsByChunk[idx] = collected;
    }
  });

  await Promise.all(workers);

  const finalRows: Record<string, unknown>[] = [...(firstPage as Record<string, unknown>[])];
  for (const chunk of resultsByChunk) {
    if (chunk) {
      for (let i = 0; i < chunk.length; i++) {
        finalRows.push(chunk[i]);
      }
    }
  }
  return finalRows;
}
