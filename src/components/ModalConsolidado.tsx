/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { X, Save, Printer, TrendingUp, TrendingDown, DollarSign, Calendar, Info, Store, FileText, Check } from "lucide-react";
import { Venda, Lancamento, DadosManuais } from "../types";

interface ModalConsolidadoProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLoja: string;
  defaultData: string;
  vendas: Venda[];
  lancamentos: Lancamento[];
  dadosManuais: DadosManuais;
  onSaveDadosManuais: (
    loja: string,
    data: string,
    values: { delivery: number; taxaEntrega: number; couvert: number; descDelivery: number }
  ) => void;
  onPrintReport: (data: {
    loja: string;
    dataInicio: string;
    dataFim: string;
    itensDia: number;
    itensNoite: number;
    servDia: number;
    servNoite: number;
    entradas: number;
    delivery: number;
    taxaEntrega: number;
    couvert: number;
    descDelivery: number;
    totalFinal: number;
  }) => void;
}

export default function ModalConsolidado({
  isOpen,
  onClose,
  defaultLoja,
  defaultData,
  vendas,
  lancamentos,
  dadosManuais,
  onSaveDadosManuais,
  onPrintReport,
}: ModalConsolidadoProps) {
  const [filtroLoja, setFiltroLoja] = useState(defaultLoja);
  const [dataInicio, setDataInicio] = useState(defaultData);
  const [dataFim, setDataFim] = useState(defaultData);

  // Manual values input states
  const [delivery, setDelivery] = useState("");
  const [taxaEntrega, setTaxaEntrega] = useState("");
  const [couvert, setCouvert] = useState("");
  const [descDelivery, setDescDelivery] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync initial setup
  useEffect(() => {
    if (isOpen) {
      setFiltroLoja(defaultLoja);
      setDataInicio(defaultData);
      setDataFim(defaultData);
    }
  }, [isOpen, defaultLoja, defaultData]);

  // Dynamically extract selectable stores list
  const getLojasList = () => {
    const list = new Set<string>();
    if (defaultLoja) list.add(defaultLoja);
    vendas.forEach((v) => list.add(v.loja));
    lancamentos.forEach((l) => list.add(l.loja));
    return Array.from(list);
  };

  // Get cumulative manual values over selected date range
  const getCumulativeManuais = () => {
    let aggDelivery = 0;
    let aggTaxa = 0;
    let aggCouvert = 0;
    let aggDescDelivery = 0;

    let current = new Date(dataInicio + "T00:00:00");
    const end = new Date(dataFim + "T00:00:00");

    // Loop through each date in the range inclusive
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      const key = `${filtroLoja}_${dateStr}`;
      const dayData = dadosManuais[key];
      if (dayData) {
        aggDelivery += dayData.delivery || 0;
        aggTaxa += dayData.taxaEntrega || 0;
        aggCouvert += dayData.couvert || 0;
        aggDescDelivery += dayData.descDelivery || 0;
      }
      current.setDate(current.getDate() + 1);
    }

    return { delivery: aggDelivery, taxaEntrega: aggTaxa, couvert: aggCouvert, descDelivery: aggDescDelivery };
  };

  const aggManuais = getCumulativeManuais();

  // Populate inputs with the values of the start date if they match exactly (so editing works easily)
  useEffect(() => {
    const singleKey = `${filtroLoja}_${dataInicio}`;
    const singleData = dadosManuais[singleKey];
    if (singleData) {
      setDelivery(singleData.delivery ? String(singleData.delivery) : "");
      setTaxaEntrega(singleData.taxaEntrega ? String(singleData.taxaEntrega) : "");
      setCouvert(singleData.couvert ? String(singleData.couvert) : "");
      setDescDelivery(singleData.descDelivery ? String(singleData.descDelivery) : "");
    } else {
      setDelivery("");
      setTaxaEntrega("");
      setCouvert("");
      setDescDelivery("");
    }
    setSavedSuccess(false);
  }, [filtroLoja, dataInicio, dadosManuais, isOpen]);

  if (!isOpen) return null;

  // Filter lists based on selected dates and store
  const vFiltered = vendas.filter(
    (v) => v.loja === filtroLoja && v.data >= dataInicio && v.data <= dataFim
  );
  const lFiltered = lancamentos.filter(
    (l) => l.loja === filtroLoja && l.data >= dataInicio && l.data <= dataFim
  );

  const itensDia = vFiltered.filter((v) => v.turno === "Dia").reduce((sum, v) => sum + v.itens, 0);
  const itensNoite = vFiltered.filter((v) => v.turno === "Noite").reduce((sum, v) => sum + v.itens, 0);
  const servDia = vFiltered.filter((v) => v.turno === "Dia").reduce((sum, v) => sum + v.servico, 0);
  const servNoite = vFiltered.filter((v) => v.turno === "Noite").reduce((sum, v) => sum + v.servico, 0);
  const entradasVal = lFiltered.filter((l) => l.tipo === "entrada").reduce((sum, l) => sum + l.valor, 0);

  // Total manually inputted variables (depends on the range: if user has inputs, we use current input values if range is single-day, otherwise aggregated)
  const isSingleDay = dataInicio === dataFim;
  const currentDelivery = isSingleDay
    ? (parseFloat(delivery.replace(",", ".")) || 0)
    : aggManuais.delivery;
  const currentTaxa = isSingleDay
    ? (parseFloat(taxaEntrega.replace(",", ".")) || 0)
    : aggManuais.taxaEntrega;
  const currentCouvert = isSingleDay
    ? (parseFloat(couvert.replace(",", ".")) || 0)
    : aggManuais.couvert;
  const currentDescDelivery = isSingleDay
    ? (parseFloat(descDelivery.replace(",", ".")) || 0)
    : aggManuais.descDelivery;

  const faturamento = itensDia + itensNoite + currentDelivery;
  const deducoes = servDia + servNoite + currentTaxa + entradasVal + currentCouvert + currentDescDelivery;
  const totalLíquido = faturamento - deducoes;

  // Formatted stats
  const totalLançamentos = vFiltered.length + lFiltered.length;

  const handleSave = () => {
    if (!filtroLoja || !dataInicio) {
      alert("Loja e data início são obrigatórios.");
      return;
    }
    const values = {
      delivery: parseFloat(delivery.replace(",", ".")) || 0,
      taxaEntrega: parseFloat(taxaEntrega.replace(",", ".")) || 0,
      couvert: parseFloat(couvert.replace(",", ".")) || 0,
      descDelivery: parseFloat(descDelivery.replace(",", ".")) || 0,
    };
    onSaveDadosManuais(filtroLoja, dataInicio, values);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handlePrint = () => {
    onPrintReport({
      loja: filtroLoja,
      dataInicio,
      dataFim,
      itensDia,
      itensNoite,
      servDia,
      servNoite,
      entradas: entradasVal,
      delivery: currentDelivery,
      taxaEntrega: currentTaxa,
      couvert: currentCouvert,
      descDelivery: currentDescDelivery,
      totalFinal: totalLíquido,
    });
  };

  // Date formatting for human-friendly visual
  const formatDateHuman = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 transition-all duration-300">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" 
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white w-full max-w-3xl rounded-3xl shadow-3xl overflow-hidden max-h-[92vh] border border-slate-200 z-10 flex flex-col animate-scale-up">
        
        {/* Top Header Card Background */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-2xl border border-emerald-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-widest block leading-tight">
                Consolidação Operacional do Caixa
              </span>
              <h2 className="text-lg md:text-xl font-sans font-black tracking-tight text-white flex items-center gap-2">
                Fechamento Consolidado Geral
              </h2>
            </div>
          </div>
          <button 
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-705 p-2 rounded-xl transition-all cursor-pointer ring-1 ring-white/10" 
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Controls / Filter section */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-sans text-[10px] font-black text-slate-500 block uppercase tracking-wider flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" /> Selecionar Loja
              </label>
              <select
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs p-3 transition-all outline-none text-slate-800 cursor-pointer"
                value={filtroLoja}
                onChange={(e) => setFiltroLoja(e.target.value)}
              >
                {getLojasList().map((store) => (
                  <option key={store} value={store}>
                    🏪 {store}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-sans text-[10px] font-black text-slate-500 block uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Período Inicial
              </label>
              <input
                type="date"
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs p-2.5 transition-all outline-none font-mono text-slate-800"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="font-sans text-[10px] font-black text-slate-500 block uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Período Final
              </label>
              <input
                type="date"
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-xs p-2.5 transition-all outline-none font-mono text-slate-800"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          {/* Aggregated period notification */}
          {!isSingleDay ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed shadow-sm">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Exibindo Período Consolidado:</strong> Você está visualizando o balanço acumulado de {formatDateHuman(dataInicio)} até {formatDateHuman(dataFim)}.
                <span className="block mt-1 font-semibold text-amber-700">
                  ⚠️ Observação: Eventuais lançamentos e campos manuais salvos nesta tela serão gravados apenas no dia inicial ({formatDateHuman(dataInicio)}).
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 text-white rounded-2xl px-4 py-2.5 flex justify-between items-center text-xs shadow-sm font-sans">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span>Análise Diária Simplificada</span>
              </div>
              <span className="opacity-80 font-mono text-[10px] uppercase">
                {formatDateHuman(dataInicio)}
              </span>
            </div>
          )}

          {/* Quick Stats Panel */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-100 p-3 rounded-xl text-center shadow-xs">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Registros</span>
              <span className="text-sm font-bold text-slate-800 font-mono">{totalLançamentos}</span>
            </div>
            <div className="bg-white border border-slate-100 p-3 rounded-xl text-center shadow-xs">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Loja Foco</span>
              <span className="text-xs font-bold text-slate-800 truncate block max-w-full px-1">{filtroLoja}</span>
            </div>
            <div className="bg-white border border-slate-100 p-3 rounded-xl text-center shadow-xs">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Modalidade</span>
              <span className="text-xs font-bold text-emerald-600 uppercase font-sans">
                {isSingleDay ? "Unitário" : "Acumulado"}
              </span>
            </div>
          </div>

          {/* Main Financial Grid (Faturamento vs Deduções) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left Column: Faturamento (+) */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-600 font-mono flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Receitas &amp; Faturamento (+)
                </h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                  Créditos
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center font-mono text-xs bg-slate-50/50 hover:bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                  <span className="text-slate-500 font-sans">Venda de Itens (Dia)</span>
                  <span className="font-bold text-slate-800">R$ {itensDia.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center font-mono text-xs bg-slate-50/50 hover:bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                  <span className="text-slate-500 font-sans">Venda de Itens (Noite)</span>
                  <span className="font-bold text-slate-800">R$ {itensNoite.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-sans text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Faturamento Delivery Bruto (R$)
                  </label>
                  {!isSingleDay && (
                    <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-mono">
                      Calculado
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-mono">
                    R$
                  </div>
                  <input
                    type="text"
                    disabled={!isSingleDay}
                    inputMode="decimal"
                    className={`w-full bg-slate-50/70 border border-slate-200 focus:border-emerald-500 text-slate-800 text-xs font-mono pl-8 p-3 rounded-xl focus:outline-none transition-soft ${
                      !isSingleDay ? "bg-slate-100/60 opacity-80 cursor-not-allowed select-none" : ""
                    }`}
                    placeholder="0.00"
                    value={delivery}
                    onChange={(e) => setDelivery(e.target.value)}
                  />
                </div>
                {isSingleDay && (
                  <p className="text-[9px] text-slate-400 leading-tight">
                    * Digite as vendas de delivery para consolidação de faturamento.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Deduções (-) */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-xs uppercase tracking-wider text-rose-600 font-mono flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Descontos &amp; Deduções (-)
                </h3>
                <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                  Débitos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1">Serviço Dia</span>
                  <span className="text-xs font-bold text-rose-600 font-mono">R$ {servDia.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1">Serviço Noite</span>
                  <span className="text-xs font-bold text-rose-600 font-mono">R$ {servNoite.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1">Consumo Interno</span>
                  <span className="text-xs font-bold text-rose-600 font-mono">R$ {entradasVal.toFixed(2)}</span>
                </div>
              </div>

              {/* Editable manual deducoões grid */}
              <div className="border-t border-slate-100 pt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-sans text-[9px] text-slate-500 uppercase font-bold tracking-wide block">
                      Comissão Delivery (R$)
                    </label>
                    <input
                      type="text"
                      disabled={!isSingleDay}
                      inputMode="decimal"
                      className={`w-full bg-slate-50/75 border border-slate-200 focus:border-rose-400 text-xs font-mono p-2.5 rounded-xl focus:outline-none transition-soft ${
                        !isSingleDay ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      placeholder="0.00"
                      value={descDelivery}
                      onChange={(e) => setDescDelivery(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-sans text-[9px] text-slate-500 uppercase font-bold tracking-wide block">
                      Taxa de Entrega (R$)
                    </label>
                    <input
                      type="text"
                      disabled={!isSingleDay}
                      inputMode="decimal"
                      className={`w-full bg-slate-50/75 border border-slate-200 focus:border-rose-400 text-xs font-mono p-2.5 rounded-xl focus:outline-none transition-soft ${
                        !isSingleDay ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                      placeholder="0.00"
                      value={taxaEntrega}
                      onChange={(e) => setTaxaEntrega(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-sans text-[9px] text-slate-500 uppercase font-bold tracking-wide block">
                    Gastos Diversos / Couvert (R$)
                  </label>
                  <input
                    type="text"
                    disabled={!isSingleDay}
                    inputMode="decimal"
                    className={`w-full bg-slate-50/75 border border-slate-200 focus:border-rose-400 text-xs font-mono p-2.5 rounded-xl focus:outline-none transition-soft ${
                      !isSingleDay ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    placeholder="0.00"
                    value={couvert}
                    onChange={(e) => setCouvert(e.target.value)}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Premium Totalizer Display card */}
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center text-center">
            
            {/* Ambient visual indicator */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <span className="font-sans text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-1 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25">
              Faturamento Líquido Geral
            </span>

            <div className="flex items-center gap-1.5 mt-2 mb-1.5">
              <DollarSign className="w-8 h-8 text-emerald-400 mt-1 shrink-0" />
              <p className="font-mono text-3xl md:text-4xl font-black text-white tracking-tight leading-none">
                {totalLíquido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <p className="font-sans text-[9px] text-slate-400 leading-normal max-w-md uppercase tracking-wider font-semibold">
              Fórmula: (vendas + delivery) - (serviços + taxas + comissões + couvert + consumos)
            </p>

            <div className="mt-4 flex gap-4 text-[10px] font-mono border-t border-slate-800/80 pt-3.5 w-full justify-around text-slate-400">
              <div>
                Receita Total: <span className="text-emerald-400 font-bold">R$ {faturamento.toFixed(2)}</span>
              </div>
              <div className="w-px h-3.5 bg-slate-800 self-center"></div>
              <div>
                Desconto Total: <span className="text-rose-400 font-bold">R$ {deducoes.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Action Controls Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-5 px-6 flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={!isSingleDay}
            className={`flex-1 font-sans font-black py-4 rounded-xl uppercase text-xs tracking-wider shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !isSingleDay 
                ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none" 
                : savedSuccess 
                  ? "bg-emerald-600 text-white" 
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" /> Dados Gravados com Sucesso!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Gravar Lançamentos Manuais
              </>
            )}
          </button>
          
          <button
            onClick={handlePrint}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white px-7 py-4 rounded-xl font-sans font-bold uppercase text-xs tracking-wider shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            title="Imprimir Relatório Consolidado"
          >
            <Printer className="w-4 h-4" /> Imprimir Relatório
          </button>
        </div>

      </div>
    </div>
  );
}
