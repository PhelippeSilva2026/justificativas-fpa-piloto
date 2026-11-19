import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { buildChatArtifact, extractAttachmentContext, extractMarkdownTables, requestedArtifactFormat } from '../server/chatArtifacts';

const answer = [
  '### Resultado',
  '| fornecedor | conta_do_razao | total_valor |',
  '| --- | --- | ---: |',
  '| Bloomberg | 4102010104 | R$ 90.543,41 |',
].join('\n');

test('identifica pedidos explícitos de Excel, PowerPoint e PDF', () => {
  assert.equal(requestedArtifactFormat('Gere uma planilha Excel desta análise'), 'xlsx');
  assert.equal(requestedArtifactFormat('Crie um PPT executivo'), 'pptx');
  assert.equal(requestedArtifactFormat('Segue o Excel, gere um PPT executivo'), 'pptx');
  assert.equal(requestedArtifactFormat('Gere uma apresentação em PDF'), 'pdf');
  assert.equal(requestedArtifactFormat('Qual o EBITDA?'), null);
});

test('gera PDF válido com a análise', async () => {
  const file = await buildChatArtifact('pdf', 'Crie um PDF executivo', answer);
  assert.match(file.name, /\.pdf$/);
  const bytes = Buffer.from(file.dataBase64!, 'base64');
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  assert.ok(bytes.length > 1_000);
});

test('extrai tabelas markdown para arquivos', () => {
  assert.deepEqual(extractMarkdownTables(answer), [[
    ['fornecedor', 'conta_do_razao', 'total_valor'],
    ['Bloomberg', '4102010104', 'R$ 90.543,41'],
  ]]);
});

test('gera Excel válido com os dados da resposta', async () => {
  const file = await buildChatArtifact('xlsx', 'Gere um Excel', answer);
  assert.match(file.name, /\.xlsx$/);
  const workbook = XLSX.read(Buffer.from(file.dataBase64!, 'base64'));
  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  assert.equal(rows[1][0], 'Bloomberg');
  assert.equal(rows[1][1], '4102010104');
});

test('gera PowerPoint válido com a análise', async () => {
  const file = await buildChatArtifact('pptx', 'Crie um PPT executivo', answer);
  assert.match(file.name, /\.pptx$/);
  const bytes = Buffer.from(file.dataBase64!, 'base64');
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  assert.ok(bytes.length > 10_000);
});

test('extrai o conteúdo real de CSV e Excel anexados', async () => {
  const csv = Buffer.from('fornecedor,valor\nFornecedor A,1000').toString('base64');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['indicador', 'valor'], ['EBITDA', 2500]]), 'Dados');
  const xlsx = (XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer).toString('base64');
  const context = await extractAttachmentContext([
    { name: 'fornecedores.csv', mimeType: 'text/csv', dataBase64: csv },
    { name: 'financeiro.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dataBase64: xlsx },
  ]);
  assert.match(context, /Fornecedor A,1000/);
  assert.match(context, /ABA Dados/);
  assert.match(context, /EBITDA,2500/);
});
