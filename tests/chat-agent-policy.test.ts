import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildGroundedAgentPrompt,
  normalizeAgentReplyMarkdown,
  sanitizeAgentHistory,
} from '../server/chatAgentPolicy';
import { CHAT_SESSION_TTL_MS, isChatSessionFresh } from '../src/utils/chatSession';

test('mantém contexto recente e identifica claramente a solicitação atual', () => {
  const history = [
    { sender: 'user', text: 'Onde estão Bloomberg e agências de rating?' },
    { sender: 'agent', text: 'Localizei somente Bloomberg.' },
  ];
  const prompt = buildGroundedAgentPrompt('Mas não estou vendo rating aqui', history);
  assert.match(prompt, /Bloomberg e agências de rating/);
  assert.match(prompt, /Localizei somente Bloomberg/);
  assert.match(prompt, /SOLICITAÇÃO ATUAL:\nMas não estou vendo rating aqui/);
});

test('política proíbe inferência e exige valores exatos em reais', () => {
  const prompt = buildGroundedAgentPrompt('Pesquise dois fornecedores', []);
  assert.match(prompt, /cada uma separadamente/);
  assert.match(prompt, /não localizado nos dados consultados/);
  assert.match(prompt, /R\$ 12\.345,67/);
  assert.match(prompt, /Não converta lançamentos para Mn\/M/);
  assert.match(prompt, /4102010104/);
});

test('normaliza códigos e quantidades em tabelas sem alterar textos', () => {
  const raw = [
    '| CONTA_DO_RAZAO | QTD_LANCAMENTOS | TOTAL_VALOR | TEXTO |',
    '| --- | ---: | ---: | --- |',
    '| 4.102.010.104,0 | 1,0 | R$ 8.765,43 | AJUSTE CAMBIO - BLOOMBERG |',
  ].join('\n');
  const normalized = normalizeAgentReplyMarkdown(raw);
  assert.match(normalized, /\| 4102010104 \| 1 \| R\$ 8\.765,43 \|/);
  assert.match(normalized, /AJUSTE CAMBIO - BLOOMBERG/);
});

test('limita e higieniza o histórico recebido do navegador', () => {
  const input = Array.from({ length: 30 }, (_, index) => ({ sender: index % 2 ? 'agent' : 'user', text: `mensagem ${index}` }));
  const history = sanitizeAgentHistory(input);
  assert.equal(history.length, 24);
  assert.equal(history[0].text, 'mensagem 6');
  assert.equal(history.at(-1)?.text, 'mensagem 29');
});

test('sessão conserva a conversa por uma hora e expira depois do limite', () => {
  const now = Date.parse('2026-11-10T14:00:00-03:00');
  assert.equal(CHAT_SESSION_TTL_MS, 3_600_000);
  assert.equal(isChatSessionFresh(now - 59 * 60 * 1000, now), true);
  assert.equal(isChatSessionFresh(now - CHAT_SESSION_TTL_MS, now), true);
  assert.equal(isChatSessionFresh(now - CHAT_SESSION_TTL_MS - 1, now), false);
});
