/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { X, ShoppingCart, DollarSign, ArrowRight, Check } from "lucide-react";
import { Venda } from "../types";

interface ModalVendaProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (servico: number, itens: number, editId: number | null) => void;
  vendaToEdit?: Venda | null;
}

export default function ModalVenda({ isOpen, onClose, onSave, vendaToEdit }: ModalVendaProps) {
  const [servico, setServico] = useState("");
  const [itens, setItens] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (vendaToEdit) {
        setServico(vendaToEdit.servico > 0 ? vendaToEdit.servico.toString().replace(".", ",") : "");
        setItens(vendaToEdit.itens.toString().replace(".", ","));
      } else {
        setServico("");
        setItens("");
      }
    }
  }, [isOpen, vendaToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const s = parseFloat(servico.replace(",", ".")) || 0;
    const i = parseFloat(itens.replace(",", ".")) || 0;
    onSave(s, i, vendaToEdit ? vendaToEdit.id : null);
    setServico("");
    setItens("");
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 transition-all duration-300 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Card Content */}
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-3xl overflow-hidden border border-slate-200 z-10 flex flex-col animate-scale-up">
        
        {/* Top Header Card */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 text-purple-400 p-2.5 rounded-xl border border-purple-500/30">
              <ShoppingCart className="w-5 h-5 text-status-sales" />
            </div>
            <div>
              <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Operações de Caixa
              </span>
              <h2 className="text-base md:text-lg font-sans font-black tracking-tight text-white uppercase italic">
                Registrar Nova Venda
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-black text-rose-600 uppercase tracking-wider block">
              TAXA DE SERVIÇO / GORJETA (OPCIONAL)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-slate-400 font-mono text-xs font-bold">R$</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 p-3 font-mono text-sm font-black text-slate-800 outline-none focus:bg-white focus:border-status-sales focus:ring-1 focus:ring-status-sales transition-soft"
                placeholder="0,00"
                value={servico}
                onChange={(e) => setServico(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-[10px] text-slate-400 font-sans italic">
              Preencha apenas caso a venda possua comissão/gorjeta inclusa.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-black text-purple-600 uppercase tracking-wider block">
              VALOR DOS ITENS VENDIDOS (R$)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-slate-400 font-mono text-xs font-bold">R$</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 p-3 font-mono text-sm font-black text-slate-800 outline-none focus:bg-white focus:border-status-sales focus:ring-1 focus:ring-status-sales transition-soft"
                placeholder="0,00"
                value={itens}
                onChange={(e) => setItens(e.target.value)}
                required
              />
            </div>
            <p className="text-[10px] text-slate-400 font-sans italic">
              Este valor irá computar no faturamento de vendas final do turno.
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
              className="bg-status-sales hover:bg-[#802cc9] text-white py-3 rounded-xl font-mono font-black uppercase text-xs tracking-wider shadow-md shadow-purple-500/10 hover:shadow-purple-500/20 active:scale-95 transition-soft cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" /> Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
