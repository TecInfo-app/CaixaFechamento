/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { X, LockOpen, Check } from "lucide-react";

interface ModalAbrirCaixaProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (initialBalance: number) => void;
  defaultLoja: string;
  defaultTurno: string;
}

export default function ModalAbrirCaixa({
  isOpen,
  onClose,
  onConfirm,
  defaultLoja,
  defaultTurno,
}: ModalAbrirCaixaProps) {
  const [saldoInicial, setSaldoInicial] = useState("0,00");

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(saldoInicial.replace(",", ".")) || 0;
    onConfirm(balance);
    setSaldoInicial("0,00");
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 transition-all duration-300 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Card Content */}
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-3xl overflow-hidden border border-slate-200 z-10 flex flex-col animate-scale-up">
        
        {/* Top Header */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
              <LockOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Controle de Turno
              </span>
              <h2 className="text-base md:text-lg font-sans font-black tracking-tight text-white uppercase italic">
                Abertura de Caixa
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

        {/* Info Area & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-500 font-mono font-bold uppercase">
              <span>Loja de Trabalho:</span>
              <span className="text-slate-800">{defaultLoja}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-mono font-bold uppercase">
              <span>Turno Selecionado:</span>
              <span className="text-slate-800">{defaultTurno === "Dia" ? "🌞 Dia" : "🌚 Noite"}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-black text-slate-600 uppercase tracking-wider block">
              SALDO INICIAL DE ABERTURA (TROCO EM CAIXA)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-slate-400 font-mono text-xs font-bold">R$</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 p-3 font-mono text-sm font-black text-slate-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-soft"
                placeholder="0,00"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-[10px] text-slate-400 font-sans italic">
              Informe o valor em dinheiro fisicamente disponível no caixa para início do turno.
            </p>
          </div>

          {/* Buttons Footer */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="bg-slate-100 text-slate-600 hover:bg-slate-200 py-3 rounded-xl font-mono font-bold uppercase text-xs tracking-wider transition-soft cursor-pointer active:scale-95 text-center"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-mono font-black uppercase text-xs tracking-wider shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 transition-soft cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" /> Iniciar Caixa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
