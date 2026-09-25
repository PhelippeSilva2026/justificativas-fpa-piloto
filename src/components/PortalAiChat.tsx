import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  RotateCcw, 
  Copy, 
  Check 
} from 'lucide-react';
import { CompanyId } from '../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  companyContext?: CompanyId | 'all';
}

interface PortalAiChatProps {
  onSelectCompany?: (companyId: CompanyId) => void;
}

// Helper para renderizar formatações inline: negrito, itálico, código e remoção de escapes R\$
function renderInline(text: string, isUser = false) {
  // Remove barras invertidas de escape comuns em respostas do modelo (ex: R\$ -> R$)
  const clean = text.replace(/\\([$*#|`_\\])/g, '$1');
  const parts = clean.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className={isUser ? "font-bold text-white" : "font-bold text-neutral-900"}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**') && part.length >= 2) {
      return (
        <em key={idx} className={isUser ? "italic text-white/90" : "italic text-neutral-600"}>
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={idx} className={isUser ? "bg-white/20 text-white px-1.5 py-0.5 rounded font-mono text-[11px]" : "bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded font-mono text-[11px] border border-neutral-250"}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Parser avançado de Markdown que interpreta cabeçalhos, parágrafos, listas e TABELAS no padrão Power BI Claro
function renderMarkdownContent(rawText: string, isUser = false) {
  const lines = rawText.split('\n');
  const blocks: Array<
    | { type: 'heading'; level: number; text: string }
    | { type: 'table'; headers: string[]; alignments: string[]; rows: string[][] }
    | { type: 'paragraph'; lines: string[] }
  > = [];

  let currentTable: { headers: string[]; alignments: string[]; rows: string[][] } | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: [...currentParagraph] });
      currentParagraph = [];
    }
  };

  const flushTable = () => {
    if (currentTable) {
      blocks.push({ type: 'table', ...currentTable });
      currentTable = null;
    }
  };

  const isTableRow = (line: string) => {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
  };

  const isDelimiterRow = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
    const inner = trimmed.slice(1, -1);
    const cols = inner.split('|');
    return cols.length > 0 && cols.every((c) => /^[\s:-]+$/.test(c.trim()));
  };

  const parseCells = (line: string) => {
    const trimmed = line.trim();
    const inner = trimmed.startsWith('|') && trimmed.endsWith('|')
      ? trimmed.slice(1, -1)
      : trimmed;
    return inner.split('|').map((c) => c.trim());
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Cabeçalhos (ex: ### Tabela / resultado)
    if (trimmed.startsWith('#')) {
      flushTable();
      flushParagraph();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: 'heading',
          level: match[1].length,
          text: match[2].trim()
        });
        continue;
      }
    }

    // Identificação de Tabela Markdown real (com linha delimitadora de colunas)
    if (isTableRow(line)) {
      if (!currentTable) {
        if (i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
          flushParagraph();
          const headers = parseCells(line);
          const delimiterCells = parseCells(lines[i + 1]);
          const alignments = delimiterCells.map((d) => {
            const hasLeft = d.startsWith(':');
            const hasRight = d.endsWith(':');
            if (hasLeft && hasRight) return 'center';
            if (hasRight) return 'right';
            return 'left';
          });
          currentTable = { headers, alignments, rows: [] };
          i++; // pula a linha delimitadora
          continue;
        }
      } else {
        const cells = parseCells(line);
        currentTable.rows.push(cells);
        continue;
      }
    } else {
      flushTable();
    }

    // Se for uma linha avulsa envolvida por pipes (ex: | 1. OPEX... |), limpa os pipes externos
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !currentTable) {
      const cleanedLine = trimmed.replace(/^\|\s*/, '').replace(/\s*\|$/, '');
      currentParagraph.push(cleanedLine);
    } else {
      currentParagraph.push(line);
    }
  }

  flushTable();
  flushParagraph();

  return (
    <div className="space-y-2">
      {blocks.map((block, bIdx) => {
        if (block.type === 'heading') {
          return (
            <div key={bIdx} className="pt-2 pb-1 border-b border-neutral-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                {renderInline(block.text, isUser)}
              </h4>
            </div>
          );
        }

        if (block.type === 'table') {
          return (
            <div
              key={bIdx}
              className="my-3 overflow-x-auto rounded-xl border border-neutral-300 shadow-xs bg-white"
            >
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  {/* Cabeçalho no padrão Power BI Claro: Cinza suave corporativo com tipografia nítida */}
                  <tr className="bg-[#E9ECEF] text-neutral-800 border-b border-neutral-300">
                    {block.headers.map((h, hIdx) => {
                      const align = block.alignments[hIdx] || 'left';
                      return (
                        <th
                          key={hIdx}
                          className={`px-3 py-2.5 font-bold uppercase tracking-wider text-[11px] text-neutral-700 border-r border-neutral-300 last:border-r-0 ${
                            align === 'right'
                              ? 'text-right'
                              : align === 'center'
                              ? 'text-center'
                              : 'text-left'
                          }`}
                        >
                          {renderInline(h, isUser)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={`${
                        rIdx % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FA]'
                      } hover:bg-neutral-100/70 transition-colors`}
                    >
                      {block.headers.map((_, cIdx) => {
                        const cell = row[cIdx] || '';
                        const align = block.alignments[cIdx] || 'left';
                        const isNegative = cell.includes('(') || (cell.startsWith('-') && !cell.startsWith('--'));

                        return (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 text-[11.5px] border-r border-neutral-200 last:border-r-0 leading-snug ${
                              align === 'right'
                                ? 'text-right font-mono'
                                : align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            } ${isNegative ? 'text-red-600 font-semibold' : 'text-neutral-800'}`}
                          >
                            {renderInline(cell, isUser)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Parágrafos normais
        return (
          <div key={bIdx} className="space-y-1">
            {block.lines.map((line, lIdx) => {
              if (!line.trim()) return <div key={lIdx} className="h-1.5" />;
              return (
                <p key={lIdx} className={`leading-relaxed ${isUser ? 'text-white font-medium' : 'text-neutral-800'}`}>
                  {renderInline(line, isUser)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export const PortalAiChat: React.FC<PortalAiChatProps> = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('portal_ai_chat_messages_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignora
      }
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'agent',
        text: 'Olá! Sou o **Agente de FP&A** da V.tal.\n\nComo posso apoiar sua análise de DRE, variações e desvios de **NIO Fibra**, **V.tal** e **Tecto** hoje?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        companyContext: 'all'
      }
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('portal_ai_chat_messages_v2', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      companyContext: 'all'
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          companyId: 'all',
          history: messages.slice(-6)
        })
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.reply) {
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          companyContext: 'all'
        };
        setMessages((prev) => [...prev, agentMessage]);
      } else {
        const fallbackText = data?.message || 
          'Não foi possível obter os dados do Agente no momento. Por favor, tente novamente em instantes.';

        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}`,
            sender: 'agent',
            text: fallbackText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            companyContext: 'all'
          }
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-err-${Date.now()}`,
          sender: 'agent',
          text: 'Não foi possível conectar ao endpoint no momento. Verifique sua conexão ou tente novamente em instantes.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          companyContext: 'all'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    const welcome: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      sender: 'agent',
      text: 'Conversa reiniciada. Em que posso colaborar na análise de FP&A do grupo?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      companyContext: 'all'
    };
    setMessages([welcome]);
    localStorage.removeItem('portal_ai_chat_messages_v2');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-300 shadow-md flex flex-col h-full max-h-full overflow-hidden">
      {/* Topo do Painel de Chat - Estilo Executivo Claro e Límpido */}
      <div className="bg-[#F8F9FA] text-neutral-800 px-5 py-3 border-b border-neutral-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white border border-neutral-300 flex items-center justify-center text-neutral-700 shadow-2xs">
            <Bot className="w-4.5 h-4.5 text-neutral-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800 tracking-tight">
              Agente FP&amp;A
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearChat}
            title="Limpar conversa"
            className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer border border-neutral-200 shadow-2xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Área de Mensagens (Scrollable interna - não empurra a página para baixo) */}
      <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#F8F9FA] custom-chat-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-neutral-200/80 border border-neutral-300 text-neutral-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
                </div>
              )}

              <div className={`max-w-[90%] md:max-w-[85%] group relative ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#475569] text-white rounded-tr-xs'
                      : 'bg-white border border-neutral-300 text-neutral-800 rounded-tl-xs'
                  }`}
                >
                  {renderMarkdownContent(msg.text, isUser)}
                </div>

                {/* Rodapé da mensagem com hora e botão de copiar */}
                <div className={`flex items-center gap-2 mt-1 text-[10px] text-neutral-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span>{msg.timestamp}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="opacity-0 group-hover:opacity-100 hover:text-neutral-900 transition-opacity cursor-pointer"
                    title="Copiar texto"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-neutral-900" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-600" />
                </div>
              )}
            </div>
          );
        })}

        {/* Indicador de Carregamento: 3 pontinhos animados discretos */}
        {isLoading && (
          <div className="flex items-start gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-lg bg-neutral-200/80 border border-neutral-300 text-neutral-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-neutral-600 animate-pulse" />
            </div>
            <div className="bg-white border border-neutral-300 px-4 py-3 rounded-2xl rounded-tl-xs shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Caixa de Entrada de Mensagem */}
      <div className="p-3 sm:p-4 bg-white border-t border-neutral-200 shrink-0">
        <div className="relative flex items-end gap-2 bg-[#F8F9FA] border border-neutral-300 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-500/10 rounded-2xl p-2 transition-all shadow-2xs">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Pergunte ao Agente FP&A sobre EBITDA, desvios, custos ou indicadores..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-neutral-900 placeholder-neutral-400 resize-none leading-relaxed px-1"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isLoading}
            className="bg-[#475569] hover:bg-[#334155] text-white p-2.5 rounded-xl font-bold shadow-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer shrink-0"
            title="Enviar mensagem (Enter)"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1.5 px-1">
          <span>Pressione <strong>Enter</strong> para enviar, <strong>Shift+Enter</strong> para nova linha.</span>
        </div>
      </div>
    </div>
  );
};
