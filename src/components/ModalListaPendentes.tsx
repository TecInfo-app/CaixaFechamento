/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Search, DollarSign, Calendar, ClipboardList, Check, Printer, User, ArrowRight, CornerDownRight, Landmark, Pencil } from "lucide-react";
import { Lancamento, PagamentoPendente } from "../types";

interface ModalListaPendentesProps {
  isOpen: boolean;
  onClose: () => void;
  lancamentos: Lancamento[];
  activeLoja: string;
  lojasDisponiveis: string[];
  caixaAberto: boolean;
  onSavePayment: (
    cliente: string,
    valorPago: number,
    updatedLancamentos: Lancamento[],
    tipoRegistroCaixa: "entrada" | "saida" | "nenhum"
  ) => void;
  onPrintRecebimento: (
    cliente: string,
    valorPago: number,
    saldoDevedorAnterior: number,
    saldoDevedorAtual: number,
    loja: string
  ) => void;
  onAddLancamentoPendente?: (
    descricao: string,
    valor: number,
    loja: string
  ) => void;
  onPrintListaPendentes?: (
    loja: string,
    devedores: { cliente: string; saldoDevedor: number }[],
    totalPendentes: number
  ) => void;
  onUpdateLancamentos?: (updatedLancamentos: Lancamento[]) => void;
}

interface ItemDevedorDetail {
  id: number;
  data: string;
  turno: string;
  valorOriginal: number;
  valorPago: number;
  valorRestante: number;
  pagamentos: PagamentoPendente[];
}

interface DevedorAgrupado {
  cliente: string;
  loja: string;
  totalOriginal: number;
  totalPago: number;
  saldoDevedor: number;
  registros: ItemDevedorDetail[];
}

export default function ModalListaPendentes({
  isOpen,
  onClose,
  lancamentos,
  activeLoja,
  lojasDisponiveis,
  caixaAberto,
  onSavePayment,
  onPrintRecebimento,
  onAddLancamentoPendente,
  onPrintListaPendentes,
  onUpdateLancamentos,
}: ModalListaPendentesProps) {
  const [filtroLoja, setFiltroLoja] = useState(activeLoja);
  const [busca, setBusca] = useState("");
  const [showApenasDevedoresAtivos, setShowApenasDevedoresAtivos] = useState(true);

  // Sync shop filter if prop changes
  useEffect(() => {
    setFiltroLoja(activeLoja);
  }, [activeLoja]);

  // States for the active payment configuration
  const [selectedDevedor, setSelectedDevedor] = useState<DevedorAgrupado | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState<"total" | "parcial">("total");
  const [valorParcial, setValorParcial] = useState("");
  const [registrarCaixa, setRegistrarCaixa] = useState<"entrada" | "saida" | "nenhum">("entrada");
  const [sucessoMensagem, setSucessoMensagem] = useState(false);

  // States for adding a new pending debit
  const [showNovoPendente, setShowNovoPendente] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [statusNovoPendenteSucesso, setStatusNovoPendenteSucesso] = useState(false);
  const [origemNovoCliente, setOrigemNovoCliente] = useState<"salvo" | "novo">("salvo");

  // States for editing an existing pending debit title
  const [editingPendente, setEditingPendente] = useState<ItemDevedorDetail | null>(null);
  const [editingPendenteClienteOriginal, setEditingPendenteClienteOriginal] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editData, setEditData] = useState("");
  const [editTurno, setEditTurno] = useState<"Dia" | "Noite">("Dia");
  const [origemEditCliente, setOrigemEditCliente] = useState<"salvo" | "novo">("salvo");
  const [statusEditPendenteSucesso, setStatusEditPendenteSucesso] = useState(false);

  // Clean form state when showNovoPendente is toggled
  useEffect(() => {
    if (!showNovoPendente) {
      setNovoNome("");
      setNovoValor("");
      setOrigemNovoCliente("salvo");
    }
  }, [showNovoPendente]);

  if (!isOpen) return null;

  // --- Aggregate debt by Client Name for the selected store ---
  const getDevedoresAgrupados = (): DevedorAgrupado[] => {
    const map = new Map<string, DevedorAgrupado>();

    // Filter only land-registered 'pendente' lancamentos of the selected store
    const pendentes = lancamentos.filter(
      (l) => l.tipo === "pendente" && l.loja === filtroLoja
    );

    pendentes.forEach((l) => {
      const clientName = l.descricao.trim();
      const totalPagoItem = (l.pagamentos || []).reduce((acc, p) => acc + p.valor, 0);
      const valorRestanteItem = l.valor - totalPagoItem;

      const itemDetail: ItemDevedorDetail = {
        id: l.id,
        data: l.data,
        turno: l.turno,
        valorOriginal: l.valor,
        valorPago: totalPagoItem,
        valorRestante: valorRestanteItem,
        pagamentos: l.pagamentos || [],
      };

      if (!map.has(clientName)) {
        map.set(clientName, {
          cliente: clientName,
          loja: filtroLoja,
          totalOriginal: l.valor,
          totalPago: totalPagoItem,
          saldoDevedor: valorRestanteItem,
          registros: [itemDetail],
        });
      } else {
        const existing = map.get(clientName)!;
        existing.totalOriginal += l.valor;
        existing.totalPago += totalPagoItem;
        existing.saldoDevedor += valorRestanteItem;
        existing.registros.push(itemDetail);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.saldoDevedor - a.saldoDevedor);
  };

  const rawDevedores = getDevedoresAgrupados();

  // Apply filters
  const devedoresFiltrados = rawDevedores.filter((dev) => {
    const coincideBusca = dev.cliente.toLowerCase().includes(busca.toLowerCase());
    const coincideAtivos = showApenasDevedoresAtivos ? dev.saldoDevedor > 0.01 : true;
    return coincideBusca && coincideAtivos;
  });

  const handleStartPayment = (devedor: DevedorAgrupado) => {
    setSelectedDevedor(devedor);
    setTipoPagamento("total");
    setValorParcial(devedor.saldoDevedor.toFixed(2));
    setIsPaying(true);
    setRegistrarCaixa(caixaAberto); // Default to logging into cashier if open
  };

  const handleConfirmPayment = () => {
    if (!selectedDevedor) return;

    const valorPago =
      tipoPagamento === "total"
        ? selectedDevedor.saldoDevedor
        : parseFloat(valorParcial.replace(",", ".")) || 0;

    if (valorPago <= 0) {
      alert("Por favor, digite um valor de pagamento maior que zero.");
      return;
    }

    if (valorPago > selectedDevedor.saldoDevedor + 0.01) {
      alert(`Valor de pagamento excede a dívida de R$ ${selectedDevedor.saldoDevedor.toFixed(2)}`);
      return;
    }

    // --- FIFO debt clearing algorithm ---
    // Make a copy of ALL lancamentos
    const updatedLancamentosList = [...lancamentos];
    let remainingPaymentToApply = valorPago;

    // Filter records of this specific client in this specific store, sorted oldest first (by ID or date)
    const clientRegistros = selectedDevedor.registros
      .filter((r) => r.valorRestante > 0)
      .sort((a, b) => a.id - b.id); // Oldest id first

    const currentDate = new Date().toISOString().split("T")[0];

    clientRegistros.forEach((reg) => {
      if (remainingPaymentToApply <= 0) return;

      const payAmount = Math.min(remainingPaymentToApply, reg.valorRestante);
      remainingPaymentToApply -= payAmount;

      // Find the relative lancamento inside updatedLancamentosList
      const index = updatedLancamentosList.findIndex((item) => item.id === reg.id);
      if (index !== -1) {
        const originalItem = updatedLancamentosList[index];
        const updatedPagamentos = [
          ...(originalItem.pagamentos || []),
          {
            id: `${Date.now()}-${Math.random()}`,
            data: currentDate,
            valor: payAmount,
          },
        ];

        updatedLancamentosList[index] = {
          ...originalItem,
          pagamentos: updatedPagamentos,
        };
      }
    });

    // Call the callback to update the DB and create the cash receipt if checked
    onSavePayment(
      selectedDevedor.cliente,
      valorPago,
      updatedLancamentosList,
      registrarCaixa
    );

    // Dynamic printed calculations
    const saldoAnterior = selectedDevedor.saldoDevedor;
    const saldoAtual = saldoAnterior - valorPago;

    // Trigger printing of payment receipt
    onPrintRecebimento(
      selectedDevedor.cliente,
      valorPago,
      saldoAnterior,
      saldoAtual,
      filtroLoja
    );

    setSucessoMensagem(true);
    setTimeout(() => {
      setSucessoMensagem(false);
      setIsPaying(false);
      setSelectedDevedor(null);
    }, 1500);
  };

  const handleAddNewPendenteSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = novoNome.trim();
    const parsedValue = parseFloat(novoValor.replace(",", ".")) || 0;

    if (!finalName) {
      alert("Por favor, selecione ou digite o nome do devedor.");
      return;
    }
    if (parsedValue <= 0) {
      alert("O valor do débito deve ser maior que zero.");
      return;
    }

    if (onAddLancamentoPendente) {
      onAddLancamentoPendente(finalName, parsedValue, filtroLoja);
    }

    setStatusNovoPendenteSucesso(true);
    setTimeout(() => {
      setStatusNovoPendenteSucesso(false);
      setNovoNome("");
      setNovoValor("");
      setShowNovoPendente(false);
    }, 1500);
  };

  const handleStartEditPendente = (reg: ItemDevedorDetail, clientName: string) => {
    setEditingPendente(reg);
    setEditingPendenteClienteOriginal(clientName);
    setEditNome(clientName);
    setEditValor(reg.valorOriginal.toString());
    setEditData(reg.data);
    setEditTurno(reg.turno as "Dia" | "Noite");
    
    // Check if the current name exists in unique list of clients
    if (todosDevedoresExistentes.includes(clientName)) {
      setOrigemEditCliente("salvo");
    } else {
      setOrigemEditCliente("novo");
    }
  };

  const handleSaveEditPendente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPendente) return;

    const finalName = editNome.trim();
    const parsedValue = parseFloat(editValor.replace(",", ".")) || 0;

    if (!finalName) {
      alert("Por favor, selecione ou digite o nome do devedor.");
      return;
    }

    if (parsedValue <= 0) {
      alert("O valor do débito deve ser maior que zero.");
      return;
    }

    if (parsedValue < editingPendente.valorPago) {
      alert(`O valor original não pode ser menor que o valor já pago de R$ ${editingPendente.valorPago.toFixed(2)}.`);
      return;
    }

    // Prepare updated lancamentos list
    const updated = lancamentos.map((item) => {
      if (item.id === editingPendente.id) {
        return {
          ...item,
          descricao: finalName,
          valor: parsedValue,
          data: editData,
          turno: editTurno,
        };
      }
      return item;
    });

    if (onUpdateLancamentos) {
      onUpdateLancamentos(updated);
    } else {
      onSavePayment("", 0, updated, "nenhum");
    }

    setStatusEditPendenteSucesso(true);
    setTimeout(() => {
      setStatusEditPendenteSucesso(false);
      setEditingPendente(null);
    }, 1500);
  };

  const handlePrintAllDevedores = () => {
    if (onPrintListaPendentes) {
      const activeDevedoresOnlyList = rawDevedores
        .filter(d => d.saldoDevedor > 0.01)
        .map(d => ({
          cliente: d.cliente,
          saldoDevedor: d.saldoDevedor
        }));

      const totalPendentesSum = activeDevedoresOnlyList.reduce((acc, d) => acc + d.saldoDevedor, 0);

      onPrintListaPendentes(filtroLoja, activeDevedoresOnlyList, totalPendentesSum);
    }
  };

  // Extract list of all unique client names across the entire system to help auto-select existing ones
  const todosDevedoresExistentes = Array.from(
    new Set(
      lancamentos
        .filter((l) => l.tipo === "pendente")
        .map((l) => l.descricao.trim())
    )
  ).sort();

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 transition-all duration-300">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>

      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-3xl overflow-hidden max-h-[88vh] border border-slate-200 z-10 flex flex-col animate-scale-up">
        
        {/* Top Header Card */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#e2a829]/20 text-[#e4ad31] p-2 rounded-xl">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Contas a Receber
              </span>
              <h2 className="text-base md:text-lg font-sans font-black tracking-tight text-white uppercase italic">
                Painel Geral de Contas Pendentes
              </h2>
            </div>
          </div>
          <button className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-all cursor-pointer" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard filter bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Store selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1">
              <span className="font-mono text-[9px] font-bold text-slate-400 mr-2 uppercase shrink-0">Loja:</span>
              <select
                className="w-full bg-transparent font-bold text-xs p-1.5 outline-none text-slate-800 cursor-pointer"
                value={filtroLoja}
                onChange={(e) => {
                  setFiltroLoja(e.target.value);
                  setIsPaying(false);
                  setSelectedDevedor(null);
                }}
              >
                {lojasDisponiveis.map((store) => (
                  <option key={store} value={store}>
                    🏪 {store}
                  </option>
                ))}
              </select>
            </div>

            {/* Client input filter */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Pesquisar por nome do cliente..."
                className="w-full bg-transparent outline-none text-xs p-1.5 text-slate-800 placeholder-slate-400 font-bold"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-500 uppercase tracking-wide font-black select-none">
              <input
                type="checkbox"
                checked={showApenasDevedoresAtivos}
                onChange={(e) => setShowApenasDevedoresAtivos(e.target.checked)}
                className="rounded text-[#e2a829] border-slate-300 focus:ring-[#e2a829] w-4 h-4"
              />
              Mostrar apenas devedores ativos (Saldo &gt; 0)
            </label>
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full font-bold">
              {devedoresFiltrados.length} Encontrados
            </span>
          </div>
        </div>

        {/* Scrollable Main Area */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-100/40 space-y-4">
          
          {/* Action Row for List Printing and Add New Entry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            <button
              onClick={handlePrintAllDevedores}
              disabled={devedoresFiltrados.length === 0}
              className="bg-slate-900 text-white disabled:opacity-50 disabled:cursor-not-allowed font-mono font-bold py-3 px-4 rounded-xl uppercase text-xs tracking-wider shadow-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-slate-800"
            >
              <Printer className="w-4 h-4 text-amber-400 animate-pulse" /> Imprimir Lista Devedores
            </button>
            <button
              onClick={() => {
                setShowNovoPendente(!showNovoPendente);
                setIsPaying(false);
                setSelectedDevedor(null);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold py-3 px-4 rounded-xl uppercase text-xs tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ClipboardList className="w-4 h-4 text-emerald-200" /> Registrar Novo Débito
            </button>
          </div>

          {/* NEW DEBIT REGISTRATION MODAL OVERLAY */}
          {showNovoPendente && (
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4">
              {/* Nested Backdrop */}
              <div 
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" 
                onClick={() => setShowNovoPendente(false)}
              ></div>
              
              <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 z-10 flex flex-col overflow-hidden animate-scale-up">
                <form onSubmit={handleAddNewPendenteSave} className="flex flex-col">
                  {/* Header */}
                  <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-emerald-400" />
                      <span className="font-sans font-black text-xs uppercase tracking-wider text-white">Lançar Novo Débito</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowNovoPendente(false)} 
                      className="text-slate-400 hover:text-white bg-slate-800/80 p-1.5 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4 bg-slate-50/50">
                    <div className="space-y-3">
                      <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                        Como deseja identificar o devedor?
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setOrigemNovoCliente("salvo");
                            setNovoNome("");
                          }}
                          className={`py-2 px-3 text-center text-[10px] font-black rounded-lg uppercase transition-all font-sans ${
                            origemNovoCliente === "salvo"
                              ? "bg-white text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          👤 Cliente Salvo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOrigemNovoCliente("novo");
                            setNovoNome("");
                          }}
                          className={`py-2 px-3 text-center text-[10px] font-black rounded-lg uppercase transition-all font-sans ${
                            origemNovoCliente === "novo"
                              ? "bg-white text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          ➕ Novo Cliente
                        </button>
                      </div>
                    </div>

                    {origemNovoCliente === "salvo" ? (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Selecionar devedor salvo
                        </label>
                        <select
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none cursor-pointer"
                          onChange={(e) => setNovoNome(e.target.value)}
                          value={novoNome}
                          required
                        >
                          <option value="">-- SELECIONAR CLIENTE DA LISTA --</option>
                          {todosDevedoresExistentes.map((name) => (
                            <option key={name} value={name}>
                              👤 {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Nome Completo do Devedor
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 p-2.5 rounded-xl outline-none font-bold text-xs uppercase text-slate-850 tracking-wide focus:border-emerald-500 transition-soft"
                          placeholder="Nome Completo do Cliente"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                        Valor Pendente (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-mono font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 p-2.5 font-mono text-xs font-black text-slate-850 outline-none focus:border-emerald-500 transition-soft"
                          placeholder="0.00"
                          value={novoValor}
                          onChange={(e) => setNovoValor(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-slate-50 border-t border-slate-150 p-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowNovoPendente(false)}
                      className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-mono font-bold py-2.5 rounded-xl uppercase text-[10px] tracking-wider transition-all"
                    >
                      Cancelar
                    </button>
                    <div className="flex-1">
                      {statusNovoPendenteSucesso ? (
                        <div className="w-full bg-emerald-600 text-white rounded-xl py-2.5 text-center text-[10px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Salvo!
                        </div>
                      ) : (
                        <button
                          type="submit"
                          disabled={statusNovoPendenteSucesso}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-black py-2.5 rounded-xl uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10 active:scale-[0.98]"
                        >
                          <Check className="w-3.5 h-3.5" /> Cadastrar
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* PAYMENT DISPATCH MODAL OVERLAY */}
          {isPaying && selectedDevedor && (
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4">
              {/* Nested Backdrop */}
              <div 
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" 
                onClick={() => setIsPaying(false)}
              ></div>

              <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 z-10 flex flex-col overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-amber-400" />
                    <span className="font-sans font-black text-xs uppercase tracking-wider text-white">Recebimento de Pendente</span>
                  </div>
                  <button 
                    onClick={() => setIsPaying(false)} 
                    className="text-slate-400 hover:text-white bg-slate-800/80 p-1.5 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 bg-slate-50/50">
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 gap-3 shadow-inner">
                    <div>
                      <span className="font-mono text-[8px] uppercase font-bold text-slate-400 block mb-0.5">
                        Devedor
                      </span>
                      <p className="font-extrabold text-xs text-slate-800 uppercase truncate">
                        {selectedDevedor.cliente}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[8px] uppercase font-bold text-slate-400 block mb-0.5">
                        Dívida Total
                      </span>
                      <p className="font-mono font-black text-xs text-rose-600">
                        R$ {selectedDevedor.saldoDevedor.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="font-mono text-[9px] uppercase font-bold text-slate-500 block">Forma de Recebimento</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 font-black text-[9px] text-slate-600 uppercase cursor-pointer select-none">
                        <input
                          type="radio"
                          name="paymode"
                          checked={tipoPagamento === "total"}
                          onChange={() => {
                            setTipoPagamento("total");
                            setValorParcial(selectedDevedor.saldoDevedor.toFixed(2));
                          }}
                          className="text-[#e2a829] focus:ring-[#e2a829] w-4 h-4"
                        />
                        Quitar Tudo
                      </label>
                      <label className="flex items-center gap-2 font-black text-[9px] text-slate-600 uppercase cursor-pointer select-none">
                        <input
                          type="radio"
                          name="paymode"
                          checked={tipoPagamento === "parcial"}
                          onChange={() => {
                            setTipoPagamento("parcial");
                            setValorParcial("");
                          }}
                          className="text-[#e2a829] focus:ring-[#e2a829] w-4 h-4"
                        />
                        Pagar Parcial
                      </label>
                    </div>

                    {tipoPagamento === "parcial" && (
                      <div className="space-y-1.5 animate-fade-in max-w-xs">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Valor que veio pagar (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-mono font-bold text-slate-400">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 p-2.5 font-mono text-xs font-black text-slate-800 outline-none focus:border-amber-500"
                            placeholder="0.00"
                            value={valorParcial}
                            onChange={(e) => setValorParcial(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-200/60">
                    <span className="font-mono text-[9px] uppercase font-bold text-slate-500">Fluxo de Turno (Caixa Geral):</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-[9px] text-slate-600 uppercase font-black cursor-pointer">
                        <input type="radio" value="entrada" checked={registrarCaixa === "entrada"} disabled={!caixaAberto} onChange={() => setRegistrarCaixa("entrada")} className="text-emerald-500 focus:ring-emerald-500 w-4 h-4" /> Entrada
                      </label>
                      <label className="flex items-center gap-2 text-[9px] text-slate-600 uppercase font-black cursor-pointer">
                        <input type="radio" value="saida" checked={registrarCaixa === "saida"} disabled={!caixaAberto} onChange={() => setRegistrarCaixa("saida")} className="text-rose-500 focus:ring-rose-500 w-4 h-4" /> Saída
                      </label>
                      <label className="flex items-center gap-2 text-[9px] text-slate-600 uppercase font-black cursor-pointer">
                        <input type="radio" value="nenhum" checked={registrarCaixa === "nenhum"} onChange={() => setRegistrarCaixa("nenhum")} className="text-slate-500 focus:ring-slate-500 w-4 h-4" /> Não registrar
                      </label>
                    </div>
                    {!caixaAberto && (
                      <span className="text-[8px] text-rose-600 uppercase font-bold mt-1">
                        ⚠️ O caixa atual está fechado. O pagamento não poderá ingressar no fluxo do turno.
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-150 p-4 flex flex-col gap-3">
                  {sucessoMensagem ? (
                    <div className="bg-emerald-600 text-white rounded-xl p-3 text-center text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                      <Check className="w-4 h-4 animate-bounce" /> Pagamento Processado &amp; Comprovante Imprimido!
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsPaying(false)}
                        className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-mono font-bold py-3 rounded-xl uppercase text-[10px] tracking-wider transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmPayment}
                        className="flex-1 bg-[#d6961c] hover:bg-[#b07b19] text-white font-mono font-black py-3 rounded-xl uppercase text-[10px] tracking-wider shadow active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-amber-200" /> Receber e Imprimir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* EDIT DEBIT REGISTRATION MODAL OVERLAY */}
          {editingPendente && (
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4">
              {/* Nested Backdrop */}
              <div 
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" 
                onClick={() => setEditingPendente(null)}
              ></div>
              
              <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 z-10 flex flex-col overflow-hidden animate-scale-up">
                <form onSubmit={handleSaveEditPendente} className="flex flex-col">
                  {/* Header */}
                  <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pencil className="w-5 h-5 text-[#e2a829]" />
                      <span className="font-sans font-black text-xs uppercase tracking-wider text-white">Editar Título Pendente</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEditingPendente(null)} 
                      className="text-slate-400 hover:text-white bg-slate-800/80 p-1.5 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4 bg-slate-50/50">
                    
                    <div className="space-y-3">
                      <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                        Identificação do Devedor
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setOrigemEditCliente("salvo");
                            setEditNome("");
                          }}
                          className={`py-2 px-3 text-center text-[10px] font-black rounded-lg uppercase transition-all font-sans ${
                            origemEditCliente === "salvo"
                              ? "bg-white text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          👤 Cliente Salvo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOrigemEditCliente("novo");
                            setEditNome("");
                          }}
                          className={`py-2 px-3 text-center text-[10px] font-black rounded-lg uppercase transition-all font-sans ${
                            origemEditCliente === "novo"
                              ? "bg-white text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          ➕ Novo Cliente
                        </button>
                      </div>
                    </div>

                    {origemEditCliente === "salvo" ? (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Escolher devedor salvo
                        </label>
                        <select
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none cursor-pointer"
                          onChange={(e) => setEditNome(e.target.value)}
                          value={editNome}
                          required
                        >
                          <option value="">-- SELECIONAR CLIENTE DA LISTA --</option>
                          {todosDevedoresExistentes.map((name) => (
                            <option key={name} value={name}>
                              👤 {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Nome Completo do Devedor
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 p-2.5 rounded-xl outline-none font-bold text-xs uppercase text-slate-850 tracking-wide focus:border-emerald-500 transition-soft"
                          placeholder="Nome Completo do Cliente"
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Valor Original (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-mono font-bold text-slate-400">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 p-2.5 font-mono text-xs font-black text-slate-850 outline-none focus:border-emerald-500 transition-soft"
                            placeholder="0.00"
                            value={editValor}
                            onChange={(e) => setEditValor(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Valor Já Pago (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-mono font-bold text-slate-300">R$</span>
                          <input
                            type="text"
                            disabled
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-8 p-2.5 font-mono text-xs font-black text-slate-400 outline-none cursor-not-allowed"
                            value={editingPendente.valorPago.toFixed(2)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Data do Título
                        </label>
                        <input
                          type="date"
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-mono text-xs font-bold text-slate-850 outline-none focus:border-emerald-500 transition-soft"
                          value={editData}
                          onChange={(e) => setEditData(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-mono text-[9px] uppercase font-bold text-slate-500 block">
                          Turno
                        </label>
                        <select
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-mono text-xs font-bold text-slate-850 outline-none cursor-pointer"
                          value={editTurno}
                          onChange={(e) => setEditTurno(e.target.value as "Dia" | "Noite")}
                        >
                          <option value="Dia">☀️ Dia</option>
                          <option value="Noite">🌙 Noite</option>
                        </select>
                      </div>
                    </div>

                  </div>

                  {/* Footer */}
                  <div className="bg-slate-50 border-t border-slate-150 p-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingPendente(null)}
                      className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-mono font-bold py-2.5 rounded-xl uppercase text-[10px] tracking-wider transition-all"
                    >
                      Cancelar
                    </button>
                    <div className="flex-1">
                      {statusEditPendenteSucesso ? (
                        <div className="w-full bg-emerald-600 text-white rounded-xl py-2.5 text-center text-[10px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Atualizado!
                        </div>
                      ) : (
                        <button
                          type="submit"
                          disabled={statusEditPendenteSucesso}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-black py-2.5 rounded-xl uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10 active:scale-[0.98]"
                        >
                          <Check className="w-3.5 h-3.5" /> Salvar Alterações
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MAIN DEBT LIST DISPLAY */}
          <div className="space-y-2.5">
            {devedoresFiltrados.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-sans text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Nenhum registro pendente para esta loja
                </p>
              </div>
            ) : (
              devedoresFiltrados.map((dev) => (
                <div 
                  key={dev.cliente} 
                  className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                    selectedDevedor?.cliente === dev.cliente 
                      ? "border-[#e2a829]/60 ring-2 ring-[#e2a829]/10" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  
                  {/* Card Header information */}
                  <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase shrink-0 border border-slate-300">
                        {dev.cliente.substring(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 uppercase font-sans tracking-wide text-xs">
                          {dev.cliente}
                        </h4>
                        <div className="flex gap-2.5 mt-0.5 text-[9px] text-slate-400 uppercase font-mono font-bold">
                          <span>📋 {dev.registros.length} Títulos</span>
                          <span>🏪 LOJA: {dev.loja}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between sm:justify-start items-center gap-4">
                      
                      {/* Financial values */}
                      <div className="text-right">
                        <span className="font-mono text-[8px] text-slate-400 uppercase block font-bold leading-tight">SALDO RESTANTE</span>
                        <span className="font-mono text-sm font-black text-rose-500 tracking-tight">
                          R$ {dev.saldoDevedor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {dev.saldoDevedor > 0.01 ? (
                        <button
                          onClick={() => handleStartPayment(dev)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-mono font-bold py-2 px-3.5 rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-emerald-500/10 active:scale-[0.98]"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Pagar
                        </button>
                      ) : (
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 font-mono text-[9px] font-bold px-3 py-1.5 rounded-xl uppercase flex items-center gap-1 shadow-sm">
                          <Check className="w-3.5 h-3.5" /> Quitado
                        </span>
                      )}

                    </div>
                  </div>

                  {/* Nested accordion items list */}
                  <div className="px-4 py-3 bg-white divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {dev.registros.map((reg) => (
                      <div key={reg.id} className="py-2 flex justify-between items-center text-[10px] font-mono">
                        
                        {/* Transaction meta */}
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                          <div>
                            <span className="text-slate-700 font-semibold uppercase">{reg.data.split("-").reverse().join("/")} ({reg.turno})</span>
                            <span className="text-slate-400 block text-[9px]">IDTítulo: #{reg.id}</span>
                          </div>
                        </div>

                        {/* Values details */}
                        <div className="text-right font-mono flex gap-4 items-center">
                          <div className="text-slate-400 text-[9px]">
                            Orig: R$ {reg.valorOriginal.toFixed(2)} | Pago: R$ {reg.valorPago.toFixed(2)}
                          </div>
                          <span className={`font-bold ${reg.valorRestante > 0 ? "text-slate-700" : "text-slate-400 line-through"}`}>
                            Dev: R$ {reg.valorRestante.toFixed(2)}
                          </span>
                          <button
                            onClick={() => handleStartEditPendente(reg, dev.cliente)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-soft cursor-pointer"
                            title="Editar este título"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>

                </div>
              ))
            )}
          </div>

        </div>

        {/* Modal footer information bar */}
        <div className="bg-slate-50 border-t border-slate-200 p-4.5 px-6 shrink-0 flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono uppercase">
          <span>Acesso direto ao livro de créditos</span>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 uppercase px-4 py-2 hover:bg-slate-200 rounded-xl transition-all font-mono"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
}
