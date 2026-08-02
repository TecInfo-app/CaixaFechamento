/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface ModalFecharCaixaProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sessionData: {
    loja: string;
    turno: string;
    operador: string;
    data: string;
    saldoInicial: number;
    volumeLiquido: number;
    vendasItens: number;
    servicos: number;
    diferenca: number;
  };
}

export default function ModalFecharCaixa({
  isOpen,
  onClose,
  onConfirm,
  sessionData,
}: ModalFecharCaixaProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 transition-all duration-300 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Card Content */}
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-3xl overflow-hidden border border-slate-200 z-10 flex flex-col animate-scale-up">
        
        {/* Top Header */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500/20 text-red-400 p-2.5 rounded-xl border border-rose-500/30">
              <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />
            </div>
            <div>
              <span className="font-sans text-[10px] text-red-400 font-bold uppercase tracking-wider block">
                Fechamento Operacional
              </span>
              <h2 className="text-base md:text-lg font-sans font-black tracking-tight text-white uppercase italic">
                Confirmar Encerramento de Turno
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

        {/* Content Details Area */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          
          <div className="bg-rose-50 border border-rose-100/60 rounded-2xl p-4 flex gap-3 text-rose-800">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="text-[11px] font-sans leading-relaxed">
              <span className="font-bold uppercase block mb-1">Atenção! Ação Irreversível.</span>
              Ao confirmar, este caixa será marcado como <b>fechado</b>, o turno atual será encerrado e o relatório de fechamento definitivo do caixa para a impressora térmica será gerado.
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5">
            <div className="border-b border-slate-200 pb-2.5 flex justify-between text-xs font-mono font-bold uppercase text-slate-500">
              <span>🏪 LOJA</span>
              <span className="text-slate-800">{sessionData.loja}</span>
            </div>
            <div className="border-b border-slate-200 pb-2.5 flex justify-between text-xs font-mono font-bold uppercase text-slate-500">
              <span>👤 OPERADOR</span>
              <span className="text-slate-800">{sessionData.operador}</span>
            </div>
            <div className="flex justify-between text-xs font-mono font-bold uppercase text-slate-500">
              <span>📅 TURNO</span>
              <span className="text-slate-800">
                {sessionData.data.split("-").reverse().join("/")} ({sessionData.turno === "Dia" ? "🌞 Dia" : "🌚 Noite"})
              </span>
            </div>
          </div>

          <h3 className="font-mono text-[10px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-200 pb-1">
            Resumo Financeiro do Período
          </h3>

          {/* Simple Bento Grid of stats */}
          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block font-bold leading-tight">SALDO INICIAL</span>
              <span className="text-sm font-black text-slate-700">R$ {(sessionData?.saldoInicial ?? 0).toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block font-bold leading-tight">VENDAS ITENS</span>
              <span className="text-sm font-black text-purple-600">R$ {(sessionData?.vendasItens ?? 0).toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block font-bold leading-tight">SERVIÇOS</span>
              <span className="text-sm font-black text-emerald-600">R$ {(sessionData?.servicos ?? 0).toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block font-bold leading-tight">DIFERENÇA</span>
              <span className={`text-sm font-black ${(sessionData?.diferenca ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                R$ {(sessionData?.diferenca ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-4.5 text-center font-mono border-t border-slate-800 max-w-full">
            <span className="text-[10px] text-slate-400 uppercase block font-bold leading-tight mb-0.5">ESTIMADO EM CAIXA (S. INICIAL + VOL. LÍQUIDO)</span>
            <span className="text-2xl font-black text-emerald-400 tracking-tight">
              R$ {((sessionData?.saldoInicial ?? 0) + (sessionData?.volumeLiquido ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Buttons Footer */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="bg-slate-100 text-slate-600 hover:bg-slate-200 py-3 rounded-xl font-mono font-bold uppercase text-xs tracking-wider transition-soft cursor-pointer active:scale-95 text-center"
              onClick={onClose}
            >
              Voltar ao Caixa
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-mono font-black uppercase text-xs tracking-wider shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-95 transition-soft cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4.5 h-4.5" /> Fechar Turno
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
