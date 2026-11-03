import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { calculateDREFromRaw } from '../src/utils/gcpConnector';
import { buildMonthWaterfallData, buildYTDWaterfallData } from '../src/utils/waterfallGenerator';
import * as policy from '../src/utils/reportingPeriod';
import { buildNioDynamicPageData } from '../server/nioData';
import type { GcpRawRecord } from '../src/types';
import { createRequire } from 'node:module';
import { buildNioExecutiveDocx } from '../server/nioDocBuilder';
import { buildVtalExecutiveDocx, buildTectoExecutiveDocx } from '../server/vtalTectoDocBuilder';
import PptxGenJS from 'pptxgenjs';
import { addSlideForDRERow } from '../src/utils/pptxExport';
const require = createRequire(import.meta.url);
const JSZip = createRequire(require.resolve('pptxgenjs'))('jszip');

// Executa o resolver real do backend, sem inicializar servidor nem acessar produção.
const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const resolverSource = source.slice(source.indexOf('const normalizeReportPeriod ='), source.indexOf('// Carrega todas as linhas persistidas'));
const context = vm.createContext({ ...policy });
vm.runInContext(transformSync(resolverSource + '\nglobalThis.resolve = resolveEntryForPeriod;', { loader: 'ts', format: 'cjs' }).code, context);
const resolve = (entry: object, period: string) => JSON.parse(JSON.stringify(context.resolve(entry, period)));
const impact = { id: 'manual', name: 'Título setembro', value: 30, justification: 'Comentário somente setembro' };
const september = { momImpacts: [impact], vsOrcadoImpacts: [impact], ytdImpacts: [impact] };

test('somente outubro liberado e setembro continua disponível', () => {
  assert.equal(policy.EDITABLE_JUSTIFICATION_PERIOD, '2026/10');
  assert.ok(policy.AVAILABLE_REPORT_PERIODS.includes('2026/9'));
  assert.equal(policy.previousReportPeriod('2026/10'), '2026/9');
  assert.equal(policy.previousReportPeriod('2027/1'), '2026/12');
  assert.match(source, /String\(period\).trim\(\) !== EDITABLE_JUSTIFICATION_PERIOD/);
});

for (const company of ['nio', 'vtal', 'tecto']) {
  test(`${company}: outubro vazio, setembro preservado e novas edições persistem`, () => {
    const entry = { companyId: company, periods: { '2026/9': september } };
    const before = JSON.stringify(entry);
    const empty = policy.exactPeriodJustifications();
    assert.deepEqual(resolve(entry, '2026/10'), empty);
    assert.deepEqual(resolve(entry, '2026/11'), empty);
    assert.deepEqual(resolve(entry, '2026/9'), september);
    assert.equal(JSON.stringify(entry), before);
    const october = { momImpacts: [{ ...impact, name: 'Novo outubro' }], vsOrcadoImpacts: [], ytdImpacts: [] };
    assert.deepEqual(resolve({ periods: { ...entry.periods, '2026/10': october } }, '2026/10'), { ...october, suppressHistorical: true });
    assert.deepEqual(resolve({ period: '2026/9', justifications: september }, '2026/10'), empty);
  });
  test(`${company}: MoM set/out, Budget out, YTD jan/out excluem novembro`, () => {
    const records: GcpRawRecord[] = [];
    for (let month = 1; month <= 12; month++) {
      for (const [tipo, multiplier] of [['ACTUAL 2026', 100], ['Budget 2026', 120]] as const) {
        records.push({ diretoria: company, area: 'Área', responsavel: 'Resp', n1: 'N1', n2: 'N2', n3: 'N3', anomes: `2026/${month}`, tipo, valor: -month * multiplier });
      }
    }
    const wb = calculateDREFromRaw(records, '2026/10');
    assert.equal(wb.monthPrevious, '2026/9');
    const row = wb.rows[0];
    assert.equal(row.realMMinus1, -900);
    assert.equal(row.realCurrent, -1000);
    assert.equal(row.orcadoCurrent, -1200);
    assert.equal(row.realYTD, -5500);
    assert.equal(row.orcadoYTD, -6600);
    const empty = { momImpacts: [], vsOrcadoImpacts: [], ytdImpacts: [] };
    const monthly = buildMonthWaterfallData(row, empty);
    assert.deepEqual(monthly.bars.map(b => b.displayValue), [-900, -1000, -1200, -1000]);
    const ytd = buildYTDWaterfallData(row, empty);
    assert.deepEqual(ytd.bars.map(b => b.displayValue), [-5500, -6600]);
  });
}

test('NIO sem base não recupera indicadores estáticos de agosto', () => {
  const data = buildNioDynamicPageData({ period: '2026/10', financialRows: [], physicalRows: [] });
  assert.ok(!JSON.stringify(data).includes('3.312'));
});

test('Word e portal usam o mesmo resolver e cache antigo fica isolado', () => {
  assert.match(source.slice(source.indexOf('async function loadReportJustifications')), /resolveEntryForPeriod\(entry, period\)/);
  assert.equal(policy.JUSTIFICATIONS_CACHE_VERSION, 'v4');
  assert.equal(policy.REPORT_MONTH, '2026-10');
});

test('Word das três empresas gera pacote válido de outubro sem textos antigos', async () => {
  const common = { period: '2026/10', financialRows: [], physicalRows: [] };
  const nio = await buildNioExecutiveDocx({ ...common, narrative: {
    executiveSummary: 'Sem justificativas de outubro.', keyMessages: [], monthReading: '', ytdReading: '',
    kpisAnalysis: { baseAndNetAdds: '', grossAddsAndSales: '', churn: '', organicVision: '' },
    revenueAnalysis: { netRevenueBullets: [], arpuBullets: [] },
    costsAnalysis: { relRevenueBullets: [], costToServeBullets: [], adminBullets: [], cacBullets: [], oneOffsBullets: [] },
    cacUnitaryAnalysis: { unitaryIntro: '', channelReading: '', commissionsAndDeferral: '' },
  }});
  const vtal = await buildVtalExecutiveDocx({ ...common, narrative: { highlights: [], ytdBauBullets: [], revenueDetailBullets: [], newBusinessBullets: [], projectsFootnote: '', projectsBullets: [] } });
  const tecto = await buildTectoExecutiveDocx({ ...common, narrative: { highlights: [], ytdBauBullets: [], opexDetailBullets: [] } });
  for (const [company, buffer] of [['nio', nio], ['vtal', vtal], ['tecto', tecto]] as const) {
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml').async('string');
    assert.match(xml, /Outubro/i, company);
    assert.doesNotMatch(xml, /Comentário somente setembro|Vs julho|3\.312/);
    if (company === 'nio') {
      assert.match(xml, /Set\/26/i);
      assert.match(xml, /Out\/26/i);
      assert.doesNotMatch(xml, /Jul\/26|Ago\/26/i);
    }
  }
});

test('PPT das três empresas inclui competência e não declara conciliação sem justificativa', async () => {
  // Canvas substituído apenas no teste de empacotamento; cálculo dos gráficos é testado acima.
  const originalDocument = globalThis.document;
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const ctx = new Proxy({}, { get: (_target, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 6 }) : () => {} });
  globalThis.document = { createElement: () => ({ width: 1800, height: 1000, getContext: () => ctx, toDataURL: () => pixel }) } as unknown as Document;
  try {
    const record: GcpRawRecord = { diretoria: 'Dir', area: 'Área', responsavel: 'Resp', n1: 'N1', n2: 'N2', n3: 'N3', anomes: '2026/10', tipo: 'ACTUAL 2026', valor: -1000 };
    const row = calculateDREFromRaw([record], '2026/10').rows[0];
    for (const company of ['nio', 'vtal', 'tecto'] as const) {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      await addSlideForDRERow(pptx, row, { momImpacts: [], vsOrcadoImpacts: [], ytdImpacts: [] }, '', company, '2026/10');
      const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
      const xml = await zip.file('ppt/slides/slide1.xml').async('string');
      assert.match(xml, /Competência 2026\/10/);
      assert.match(xml, /2026\/9/);
      assert.match(xml, /YTD ainda não preenchidas/);
      assert.doesNotMatch(xml, /Aderência integral|em conformidade com/);
    }
  } finally { globalThis.document = originalDocument; }
});
