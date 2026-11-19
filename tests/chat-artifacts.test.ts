import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { buildChatArtifact, extractMarkdownTables, requestedArtifactFormat } from '../server/chatArtifacts';

const answer = [
  '### Resultado',
  '| fornecedor | conta_do_razao | total_valor |',
  '| --- | --- | ---: |',
  '| Bloomberg | 4102010104 | R$ 90.543,41 |',
].join('\n');

test('identifica pedidos explícitos de Excel e PowerPoint', () => {
  assert.equal(requestedArtifactFormat('Gere uma planilha Excel desta análise'), 'xlsx');
  assert.equal(requestedArtifactFormat('Crie um PPT executivo'), 'pptx');
  assert.equal(requestedArtifactFormat('Qual o EBITDA?'), null);
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
