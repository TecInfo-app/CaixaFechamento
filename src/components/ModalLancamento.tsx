/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, KeyboardEvent, FormEvent, MouseEvent } from "react";
import { X, Plus, Calculator, Trash2, Printer } from "lucide-react";
import { Lancamento, LancamentoType } from "../types";

interface Adicao {
  id: string;
  valor: number;
}

interface ModalLancamentoProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: LancamentoType | null;
  itemToEdit: Lancamento | null;
  onSave: (id: number | null, descricao: string, valor: number, tipo: LancamentoType, observacao?: string) => void;
  onPrint?: (descricao: string, valor: number, tipo: LancamentoType, observacao?: string) => void;
  existentesClientes?: string[];
}

export default function ModalLancamento({ isOpen, onClose, tipo, itemToEdit, onSave, onPrint, existentesClientes = [] }: ModalLancamentoProps) {
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [adicoes, setAdicoes] = useState<Adicao[]>([]);
  const [origemCliente, setOrigemCliente] = useState<"salvo" | "novo">("salvo");

  // Initialize form states when editing or creating
  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setDescricao(itemToEdit.descricao);
        setObservacao(itemToEdit.observacao || "");
        setInputValue("");
        setAdicoes([{ id: "initial", valor: itemToEdit.valor }]);
        setOrigemCliente(existentesClientes.includes(itemToEdit.descricao) ? "salvo" : "novo");
      } else {
        setDescricao("");
        setObservacao("");
        setInputValue("");
        setAdicoes([]);
        setOrigemCliente(existentesClientes.length > 0 ? "salvo" : "novo");
      }
    }
  }, [isOpen, itemToEdit, existentesClientes]);

  const somaTemporaria = adicoes.reduce((acc, current) => acc + current.valor, 0);
  const contagemTemporaria = adicoes.length;

  const handleAddSoma = (val: number) => {
    const permitNegative = tipo === "saida";
    if (permitNegative ? val !== 0 : val > 0) {
      setAdicoes((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, valor: val }]);
    }
  };

  const handleKeyDownValue = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = parseFloat(inputValue.replace(",", ".")) || 0;
      const permitNegative = tipo === "saida";
      if (permitNegative ? val !== 0 : val > 0) {
        handleAddSoma(val);
        setInputValue("");
      }
    }
  };

  const handleAddSomaManual = () => {
    const val = parseFloat(inputValue.replace(",", ".")) || 0;
    const permitNegative = tipo === "saida";
    if (permitNegative ? val !== 0 : val > 0) {
      handleAddSoma(val);
      setInputValue("");
    }
  };

  const handleRemoveAddition = (id: string) => {
    setAdicoes((prev) => prev.filter((item) => item.id !== id));
  };

  const getFinalValor = (): number => {
    let finalValor = somaTemporaria;
    const extraVal = parseFloat(inputValue.replace(",", ".")) || 0;
    const permitNegative = tipo === "saida";
    if (permitNegative ? extraVal !== 0 : extraVal > 0) {
      finalValor += extraVal;
    }
    return finalValor;
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    
    const finalValor = getFinalValor();
    const permitNegative = tipo === "saida";

    if (permitNegative ? finalValor === 0 : finalValor <= 0) {
      alert(permitNegative ? "Por favor, informe ou some valores diferentes de zero." : "Por favor, informe ou some valores maiores que zero.");
      return;
    }

    const finalDesc = descricao.trim() || (tipo === 'entrada' ? 'Consumo' : tipo === 'saida' ? 'Retirada' : 'Pendente');
    onSave(itemToEdit ? itemToEdit.id : null, finalDesc, finalValor, tipo, observacao.trim() || undefined);
    onClose();
  };

  const handleSaveAndPrint = (e?: MouseEvent) => {
    if (e) e.preventDefault();
    const finalValor = getFinalValor();
    const permitNegative = tipo === "saida";

    if (permitNegative ? finalValor === 0 : finalValor <= 0) {
      alert(permitNegative ? "Por favor, informe ou some valores diferentes de zero." : "Por favor, informe ou some valores maiores que zero.");
      return;
    }

    const finalDesc = descricao.trim() || (tipo === 'entrada' ? 'Consumo' : tipo === 'saida' ? 'Retirada' : 'Pendente');
    
    // 1. Salva o lançamento no caixa/banco de dados primeiro
    onSave(itemToEdit ? itemToEdit.id : null, finalDesc, finalValor, tipo, observacao.trim() || undefined);

    // 2. Envia para a impressora
    if (onPrint) {
      onPrint(finalDesc, finalValor, tipo, observacao.trim() || undefined);
    } else {
      alert("Impressão não configurada ou disponível neste contexto.");
    }

    // 3. Fecha o modal
    onClose();
  };

  const handlePrintOnly = (e?: MouseEvent) => {
    if (e) e.preventDefault();
    const finalValor = getFinalValor();
    const permitNegative = tipo === "saida";

    if (permitNegative ? finalValor === 0 : finalValor <= 0) {
      alert(permitNegative ? "Por favor, informe ou some valores diferentes de zero." : "Por favor, informe ou some valores maiores que zero.");
      return;
    }

    const finalDesc = descricao.trim() || (tipo === 'entrada' ? 'Consumo' : tipo === 'saida' ? 'Retirada' : 'Pendente');
    
    // Apenas envia o cupom para a impressora sem fechar nem limpar o formulário
    if (onPrint) {
      onPrint(finalDesc, finalValor, tipo, observacao.trim() || undefined);
    } else {
      alert("Impressão não configurada ou disponível neste contexto.");
    }
  };

  // Keyboard shortcut listener (Alt + I or F4)
  useEffect(() => {
    const handleKeyDownShortcut = (e: globalThis.KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Checking for Alt + I or F4 -> Salvar e Imprimir
      if ((e.altKey && key === "i") || e.key === "F4") {
        e.preventDefault();
        handleSaveAndPrint();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDownShortcut);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDownShortcut);
    };
  }, [isOpen, tipo, descricao, observacao, inputValue, adicoes, onPrint]);

  const getThemeProps = () => {
    switch (tipo) {
      case "entrada":
        return {
          bannerColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          textColor: "text-emerald-600",
          btnColor: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10",
          borderColor: "hover:border-emerald-500",
          focusRing: "focus:border-emerald-500 focus:ring-emerald-500",
          title: "Novo Consumo / Entrada",
          subtitle: "Registrar faturamento ou consumo de equipe",
          badge: "📈 Entrada",
          descLabel: "DESCRIÇÃO DO CONSUMO / ENTRADA"
        };
      case "saida":
        return {
          bannerColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          textColor: "text-rose-600",
          btnColor: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10",
          borderColor: "hover:border-rose-500",
          focusRing: "focus:border-rose-500 focus:ring-rose-500",
          title: "Nova Retirada / Saída",
          subtitle: "Registrar sangrias ou saídas de valores",
          badge: "📉 Saída",
          descLabel: "DESCRIÇÃO DA RETIRADA"
        };
      case "pendente":
        return {
          bannerColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
          textColor: "text-amber-600",
          btnColor: "bg-[#d6961c] hover:bg-[#b07b19] shadow-amber-500/10",
          borderColor: "hover:border-amber-500",
          focusRing: "focus:border-[#d6961c] focus:ring-[#d6961c]",
          title: "Novo Débito Pendente",
          subtitle: "Registrar ficha ou conta pendente de cliente",
          badge: "⚠️ Pendente",
          descLabel: "DESCRIÇÃO DEVE SER O NOME DO CLIENTE"
        };
      default:
        return {
          bannerColor: "bg-slate-500/10 text-slate-400 border-slate-500/20",
          textColor: "text-slate-600",
          btnColor: "bg-slate-600 hover:bg-slate-700 shadow-slate-600/10",
          borderColor: "hover:border-slate-500",
          focusRing: "focus:border-slate-500 focus:ring-slate-500",
          title: "Operações",
          subtitle: "Lançamento no fluxo de caixa",
          badge: "📋 Operação",
          descLabel: "DESCRIÇÃO"
        };
    }
  };

  if (!isOpen || !tipo) return null;

  const theme = getThemeProps();

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 transition-all duration-300 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Container Card */}
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-3xl overflow-hidden border border-slate-200 z-10 flex flex-col animate-scale-up">
        
        {/* Top Header */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${theme.bannerColor}`}>
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                {itemToEdit ? "Edição Operacional" : "Lançamento de Caixa"}
              </span>
              <h2 className="text-base font-sans font-black tracking-tight text-white uppercase italic">
                {itemToEdit ? `Editar Lançamento` : theme.title}
              </h2>
            </div>
          </div>
          <button 
            className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-all cursor-pointer" 
            type="button" 
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          
          <div className="space-y-3">
            <label className="font-mono text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              {theme.descLabel}
            </label>
            
            {tipo === "pendente" && existentesClientes && existentesClientes.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setOrigemCliente("salvo");
                      setDescricao("");
                    }}
                    className={`py-2 px-3 text-center text-[10px] font-black rounded-lg uppercase transition-all font-sans ${
                      origemCliente === "salvo"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    👤 Cliente Salvo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrigemCliente("novo");
                      setDescricao("");
                    }}
                    className={`py-2 px-3 text-center text-[10px] font-black rounded-lg uppercase transition-all font-sans ${
                      origemCliente === "novo"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    ➕ Novo Cliente
                  </button>
                </div>
              </div>
            )}

            {tipo === "pendente" && existentesClientes && existentesClientes.length > 0 && origemCliente === "salvo" ? (
              <div className="space-y-1.5 animate-fade-in">
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:bg-white focus:border-[#d6961c] cursor-pointer"
                  onChange={(e) => {
                    setDescricao(e.target.value);
                  }}
                  value={descricao}
                  required
                >
                  <option value="">👤 SELECIONAR CLIENTE DA LISTA EXISTENTES...</option>
                  {existentesClientes.map((c, idx) => (
                    <option key={idx} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white p-3 rounded-xl outline-none font-bold text-xs text-slate-800 tracking-wide transition-soft"
                placeholder={tipo === "entrada" ? "Ex: Consumo Equipe" : tipo === "saida" ? "Ex: Sangria Banco" : "Nome do cliente devedor (Ex: João Silva)"}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                required
                autoFocus
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Observação (Opcional)
            </label>
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white p-3 rounded-xl outline-none font-bold text-xs text-slate-800 tracking-wide transition-soft"
              placeholder="Ex: Número do recibo, observação importante..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              VALOR DO LANÇAMENTO OU COMPONENTES DA SOMA (R$)
            </label>
            <div className="relative flex gap-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 font-mono text-xs font-bold">R$</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white pl-8 p-3 rounded-xl outline-none font-mono text-xs font-bold text-slate-800 transition-soft"
                placeholder="0.00 (Teclado Enter para acumular)"
                value={inputValue}
                onKeyDown={handleKeyDownValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button
                type="button"
                className={`px-3.5 rounded-xl text-white ${theme.btnColor} font-mono font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer`}
                onClick={handleAddSomaManual}
                title="Somar valor"
              >
                <Plus className="w-4 h-4" /> Somar
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-sans italic">
              Você pode somar múltiplos recibos neste lançamento. Digite o valor e clique em &quot;Somar&quot;.
            </p>
          </div>

          {/* SOMA VISOR CARD */}
          <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl flex justify-between items-center text-white">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] text-[#e4ad31] uppercase tracking-wide flex items-center gap-1 font-bold">
                <Calculator className="w-3.5 h-3.5 text-[#e4ad31]" /> Soma Consolidada
              </span>
              <span className="font-mono text-[9px] text-slate-400 font-bold uppercase mt-1">
                {contagemTemporaria} {contagemTemporaria === 1 ? 'Adição Salva' : 'Adições Salvas'}
              </span>
            </div>
            <div className="font-mono text-lg text-emerald-400 font-black tracking-tight">
              R$ {somaTemporaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* ADDED SUB-VALUES LIST */}
          {adicoes.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 max-h-32 overflow-y-auto">
              <p className="font-mono text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Lista de Parcelas Somadas:
              </p>
              <div className="space-y-1">
                {adicoes.map((item, index) => (
                  <div key={item.id} className="flex justify-between items-center bg-white border border-slate-200/60 px-2.5 py-1.5 rounded-xl text-[10px] font-mono">
                    <span className="text-slate-400 font-bold">PARCELA #{index + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">R$ {item.valor.toFixed(2)}</span>
                      {item.id !== "initial" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAddition(item.id)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-lg transition-soft cursor-pointer"
                          title="Apagar este valor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            {/* Primary actions: Cancelar vs Salvar */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                className="bg-slate-100 text-slate-600 hover:bg-slate-200 py-3 rounded-xl font-mono font-bold uppercase text-xs tracking-wider transition-soft cursor-pointer active:scale-95 text-center"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`text-white py-3 rounded-xl font-mono font-black uppercase text-xs tracking-wider shadow-md active:scale-[0.98] transition-soft cursor-pointer text-center ${theme.btnColor}`}
              >
                💾 Salvar
              </button>
            </div>

            {/* Print actions: Apenas Imprimir vs Salvar e Imprimir */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handlePrintOnly}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 py-2.5 rounded-xl font-black uppercase text-[11px] tracking-wider font-mono active:scale-[0.98] transition-soft cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200"
                title="Imprime apenas o cupom prévio sem fechar o formulário"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" /> Apenas Imprimir
              </button>
              <button
                type="button"
                onClick={handleSaveAndPrint}
                className="bg-slate-900 hover:bg-slate-800 text-amber-300 py-2.5 rounded-xl font-black uppercase text-[11px] tracking-wider font-mono active:scale-[0.98] transition-soft cursor-pointer flex items-center justify-center gap-1.5 border border-slate-850 shadow-sm"
                title="Salva o lançamento no caixa e imprime o cupom [Alt + I / F4]"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" /> Salvar e Imprimir [Alt+I]
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
