/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { X, History, Printer, Calendar, ShieldAlert, BadgeCheck, Search, Clock } from "lucide-react";
import { Fechamento } from "../types";

interface ModalHistoricoFechamentosProps {
  isOpen: boolean;
  onClose: () => void;
  historico: Fechamento[];
  onReimprimir: (fechamento: Fechamento) => void;
  onReabrir?: (fechamento: Fechamento) => void;
}

export default function ModalHistoricoFechamentos({
  isOpen,
  onClose,
  historico,
  onReimprimir,
  onReabrir,
}: ModalHistoricoFechamentosProps) {
  const [busca, setBusca] = useState("");

  if (!isOpen) return null;

  // Filter the list of closures by search term (could match date like "26/05", "2026-05-26", operator, store)
  const filteredHistorico = [...historico]
    .reverse()
    .filter((h) => {
      if (!busca.trim()) return true;
      const term = busca.toLowerCase();
      const formattedDate = h.data.split("-").reverse().join("/");
      return (
        h.data.includes(term) ||
        formattedDate.includes(term) ||
        h.operador.toLowerCase().includes(term) ||
        h.loja.toLowerCase().includes(term)
      );
    });

  // Take the top 15 results from the filtered array
  const displayedHistory = filteredHistorico.slice(0, 15);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 transition-all duration-300 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Card Content */}
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-3xl overflow-hidden border border-slate-200 z-10 flex flex-col animate-scale-up">
        
        {/* Top Header */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#e2a829]/25 text-[#e4ad31] p-2.5 rounded-xl border border-amber-500/30">
              <History className="w-5 h-5 text-[#e4ad31]" />
            </div>
            <div>
              <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Histórico Geral
              </span>
              <h2 className="text-base md:text-lg font-sans font-black tracking-tight text-white uppercase italic">
                Buscar &amp; Reimprimir Fechamentos
              </h2>
            </div>
          </div>
          <button 
            className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-all cursor-pointer" 
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar Row */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 shrink-0">
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-3.5 py-1 shadow-inner group focus-within:border-amber-500/50">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0 transition-colors group-focus-within:text-amber-500" />
            <input
              type="text"
              placeholder="Pesquisar por data (Ex: 26/05 ou 2026-05), operador ou loja..."
              className="w-full bg-transparent outline-none text-xs p-1.5 text-slate-800 placeholder-slate-400 font-bold font-sans"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
            {busca && (
              <button 
                onClick={() => setBusca("")} 
                className="text-slate-400 hover:text-slate-600 bg-slate-105 p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="p-6 overflow-y-auto max-h-[55vh] bg-slate-50 space-y-3">
          {displayedHistory.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4 shadow-sm">
              <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto animate-bounce" />
              <div>
                <p className="font-sans text-xs font-black text-slate-500 uppercase tracking-widest">
                  Nenhum registro correspondente
                </p>
                <p className="font-sans text-[11px] text-slate-400 mt-1">
                  Tente digitar outra data ou outro termo na caixa de busca acima.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-450 uppercase pb-1.5 font-bold">
                <span>Resultado da pesquisa:</span>
                <span>{displayedHistory.length} encontrados</span>
              </div>
              {displayedHistory.map((h, index) => {
                const vSum = (h.vendas || []).reduce((sum, v) => sum + (v?.itens ?? 0), 0);
                const entSum = (h.lancamentos || []).filter(l => l && l.tipo === 'entrada').reduce((sum, l) => sum + (l?.valor ?? 0), 0);
                const saiSum = (h.lancamentos || []).filter(l => l && l.tipo === 'saida').reduce((sum, l) => sum + (l?.valor ?? 0), 0);
                const penSum = (h.lancamentos || []).filter(l => l && l.tipo === 'pendente').reduce((sum, l) => sum + (l?.valor ?? 0), 0);
                
                // Volume líquido
                const voltLiq = (entSum + saiSum + penSum + (h.saldoFinal ?? 0)) - (h.saldoInicial ?? 0);
                const diferenca = voltLiq - vSum;

                return (
                  <div 
                    key={h.id || index}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm group"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="bg-slate-100 group-hover:bg-amber-100 text-slate-500 group-hover:text-amber-700 p-2.5 rounded-xl transition-soft flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 font-sans flex-wrap">
                          <span className="font-black text-xs text-slate-800 uppercase tracking-tight truncate">
                            {h.loja}
                          </span>
                          <span className={`font-mono text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${h.turno === "Dia" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"}`}>
                            {h.turno === "Dia" ? "🌞 Dia" : "🌚 Noite"}
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-slate-400 uppercase font-mono font-bold mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1 font-bold text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-300" /> 
                            {h.data.split("-").reverse().join("/")}
                          </span>
                          <span>Op: {h.operador}</span>
                        </div>

                        {/* Detalhes Financeiros do Caixa Fechado */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-slate-100 text-[10px] font-mono">
                          <div>
                            <span className="text-slate-400 block uppercase text-[8px] font-bold">Vendas:</span>
                            <span className="font-bold text-purple-600">R$ {vSum.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block uppercase text-[8px] font-bold">Saídas:</span>
                            <span className="font-bold text-rose-600">R$ {saiSum.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block uppercase text-[8px] font-bold">Gaveta:</span>
                            <span className="font-bold text-slate-700">R$ {(h.saldoFinal ?? 0).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block uppercase text-[8px] font-bold">Diferença:</span>
                            <span className={`font-black ${diferenca >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              R$ {diferenca.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() => onReimprimir(h)}
                        className="w-full sm:w-auto bg-primary-container text-white hover:brightness-125 font-mono font-bold py-2.5 px-3.5 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                        title="Re-Imprimir Fechamento Completo"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-300" /> Imprimir
                      </button>
                      {onReabrir && (
                        <button
                          onClick={() => onReabrir(h)}
                          className="w-full sm:w-auto bg-amber-600 text-white hover:bg-amber-750 font-mono font-bold py-2.5 px-3.5 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                          title="Reabrir este Caixa"
                        >
                          <Clock className="w-3.5 h-3.5 text-white" /> Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Area */}
        <div className="bg-slate-900 border-t border-slate-800 p-4.5 px-6 shrink-0 flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono uppercase">
          <span>Relatórios de turno anteriores</span>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white uppercase px-4 py-2 hover:bg-slate-800 rounded-xl transition-all font-mono"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
}
