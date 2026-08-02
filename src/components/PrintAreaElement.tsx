/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lancamento, Fechamento } from "../types";

interface PrintAreaElementProps {
  printType: "fechamento" | "item" | "consolidado" | "recebimento" | "lista_pendentes" | null;
  activeItem: Lancamento | null;
  activeFechamento: Fechamento | null;
  activeConsolidado: {
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
  } | null;
  activeRecebimento?: {
    cliente: string;
    valorPago: number;
    saldoDevedorAnterior: number;
    saldoDevedorAtual: number;
    loja: string;
    dataHora: string;
  } | null;
  activeListaPendentes?: {
    loja: string;
    devedores: { cliente: string; saldoDevedor: number }[];
    totalPendentes: number;
    dataHora: string;
  } | null;
}

export default function PrintAreaElement({
  printType,
  activeItem,
  activeFechamento,
  activeConsolidado,
  activeRecebimento,
  activeListaPendentes,
}: PrintAreaElementProps) {
  if (!printType) return <div id="printArea"></div>;

  return (
    <div id="printArea" className="receipt-mode text-black text-sm p-4 w-[300px] bg-white mx-auto">
      {/* 1. SINGLE ITEM VOUCHER PRINT */}
      {printType === "item" && activeItem && (
        <div className="space-y-4">
          <div className="text-center font-black text-lg border-b border-dashed border-black pb-2 mb-2 uppercase">
            {activeItem.loja}
          </div>
          <div className="text-center font-bold tracking-wider mb-3">
            COMPROVANTE DE LANÇAMENTO
          </div>
          <div className="space-y-1 font-mono text-xs">
            <p><b>ID:</b> {activeItem.id}</p>
            <p><b>DATA:</b> {activeItem.data}</p>
            <p><b>TURNO:</b> {activeItem.turno}</p>
            <p><b>CATEGORIA:</b> {activeItem.tipo.toUpperCase()}</p>
            <p className="whitespace-pre-wrap"><b>DESC:</b> {activeItem.descricao}</p>
          </div>
          <hr className="border-t border-dashed border-black my-3" />
          <div className="text-right text-lg font-black font-mono">
            VALOR: R$ {activeItem.valor.toFixed(2)}
          </div>
          <br />
          <div className="text-center text-[10px] mt-8 border-t border-slate-300 pt-2">
            Responsável: ___________________________
          </div>
        </div>
      )}

      {/* 2. SHIFT CLOSING REPORT PRINT */}
      {printType === "fechamento" && activeFechamento && (
        <div className="space-y-3">
          <div className="text-center font-extrabold text-xl border-b-2 border-black pb-2 mb-2 uppercase">
            {activeFechamento.loja}
          </div>
          <div className="text-center font-black tracking-wide border-b border-black pb-2">
            RELATÓRIO DE FECHAMENTO
          </div>
          <div className="space-y-1 font-mono text-xs text-center border-b border-dashed border-black pb-2">
            <p><b>DATA:</b> {activeFechamento.data}</p>
            <p><b>TURNO:</b> {activeFechamento.turno}</p>
            <p><b>OPERADOR:</b> {activeFechamento.operador}</p>
            <p><b>FECHADO EM:</b> {activeFechamento.dataHora}</p>
          </div>

          <div className="space-y-1 font-mono text-xs pt-2">
            <div className="flex justify-between">
              <span>SALDO INICIAL (ABERTURA):</span>
              <span className="font-bold">R$ {(activeFechamento.saldoInicial ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>VENDA ITENS (LANÇADOS):</span>
              <span className="font-bold">R$ {(activeFechamento.vendas || []).reduce((vSum, v) => vSum + (v?.itens ?? 0), 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>TAXAS DE SERVIÇO:</span>
              <span className="font-bold">R$ {(activeFechamento.vendas || []).reduce((vSum, v) => vSum + (v?.servico ?? 0), 0).toFixed(2)}</span>
            </div>
            <hr className="border-t border-dashed border-black my-2" />
            
            <div className="flex justify-between font-bold">
              <span>(+) ENTRADAS (CONSUMO):</span>
              <span>R$ {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'entrada').reduce((sum, l) => sum + (l?.valor ?? 0), 0).toFixed(2)}</span>
            </div>
            {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'entrada').length > 0 && (
              <div className="pl-3 pr-1 py-0.5 text-[11px] text-slate-705 font-mono border-l border-dashed border-slate-350 space-y-0.5 my-1">
                {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'entrada').map((l) => (
                  <div key={l?.id} className="flex justify-between">
                    <span className="truncate max-w-[160px]">- {l?.descricao || 'Sem descrição'}</span>
                    <span>R$ {(l?.valor ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>(-) SAÍDAS (DINHEIRO):</span>
              <span>R$ {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'saida').reduce((sum, l) => sum + (l?.valor ?? 0), 0).toFixed(2)}</span>
            </div>
            {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'saida').length > 0 && (
              <div className="pl-3 pr-1 py-0.5 text-[11px] text-slate-705 font-mono border-l border-dashed border-slate-350 space-y-0.5 my-1">
                {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'saida').map((l) => (
                  <div key={l?.id} className="flex justify-between">
                    <span className="truncate max-w-[160px]">- {l?.descricao || 'Sem descrição'}</span>
                    <span>R$ {(l?.valor ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>⏳ PENDENTES:</span>
              <span>R$ {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'pendente').reduce((sum, l) => sum + (l?.valor ?? 0), 0).toFixed(2)}</span>
            </div>
            {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'pendente').length > 0 && (
              <div className="pl-3 pr-1 py-0.5 text-[11px] text-slate-705 font-mono border-l border-dashed border-slate-350 space-y-0.5 my-1">
                {(activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'pendente').map((l) => (
                  <div key={l?.id} className="flex justify-between">
                    <span className="truncate max-w-[160px]">- {l?.descricao || 'Sem descrição'}</span>
                    <span>R$ {(l?.valor ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            
            <hr className="border-t border-dashed border-black my-2" />
            <div className="flex justify-between">
              <span>GAVETA FINAL (DIGITADO):</span>
              <span className="font-bold">R$ {(activeFechamento.saldoFinal ?? 0).toFixed(2)}</span>
            </div>
            
            {(() => {
              const vEnt = (activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'entrada').reduce((a,b) => a + (b?.valor ?? 0), 0);
              const vSai = (activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'saida').reduce((a,b) => a + (b?.valor ?? 0), 0);
              const vPen = (activeFechamento.lancamentos || []).filter(l => l && l.tipo === 'pendente').reduce((a,b) => a + (b?.valor ?? 0), 0);
              const voltLiq = (vEnt + vSai + vPen + (activeFechamento.saldoFinal ?? 0)) - (activeFechamento.saldoInicial ?? 0);
              const fItens = (activeFechamento.vendas || []).reduce((vSum, v) => vSum + (v?.itens ?? 0), 0);
              const diferenca = voltLiq - fItens;
              
              return (
                <>
                  <div className="flex justify-between font-black">
                    <span>VOLUME LÍQUIDO:</span>
                    <span>R$ {voltLiq.toFixed(2)}</span>
                  </div>
                  <hr className="border-t-2 border-black my-2" />
                  <div className="flex justify-between text-lg font-black pt-1">
                    <span>DIFERENÇA:</span>
                    <span>R$ {diferenca.toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </div>
          <br /><br />
          <div className="text-center text-[10px] border-t border-black pt-3">
            _________________________________<br />
            Assinatura Responsável
          </div>
        </div>
      )}

      {/* 3. CONSOLIDATED PERIOD REPORT PRINT */}
      {printType === "consolidado" && activeConsolidado && (
        <div className="space-y-3">
          <div className="text-center font-extrabold text-xl border-b-2 border-black pb-2 mb-2 uppercase">
            {activeConsolidado.loja}
          </div>
          <div className="text-center font-black tracking-wide border-b border-black pb-2 uppercase">
            FECHAMENTO CONSOLIDADO
          </div>
          <div className="space-y-1 font-mono text-xs text-center border-b border-dashed border-black pb-2">
            <p><b>INÍCIO:</b> {activeConsolidado.dataInicio}</p>
            <p><b>FIM:</b> {activeConsolidado.dataFim}</p>
            <p><b>IMPRESSO EM:</b> {new Date().toLocaleString()}</p>
          </div>

          <div className="space-y-2 font-mono text-xs pt-2">
            <div>
              <p className="font-bold text-center border-b border-slate-300 pb-1 mb-1">FATURAMENTO (+)</p>
              <div className="flex justify-between">
                <span>Itens Dia:</span>
                <span>R$ {activeConsolidado.itensDia.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Itens Noite:</span>
                <span>R$ {activeConsolidado.itensNoite.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Bruto:</span>
                <span>R$ {activeConsolidado.delivery.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                <span>Subtotal Faturado:</span>
                <span>R$ {(activeConsolidado.itensDia + activeConsolidado.itensNoite + activeConsolidado.delivery).toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-2">
              <p className="font-bold text-center border-b border-slate-300 pb-1 mb-1">DEDUÇÕES (-)</p>
              <div className="flex justify-between">
                <span>Serviço Dia:</span>
                <span>R$ {activeConsolidado.servDia.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Serviço Noite:</span>
                <span>R$ {activeConsolidado.servNoite.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Consumos Internos:</span>
                <span>R$ {activeConsolidado.entradas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Desconto/Comissão Deliv:</span>
                <span>R$ {activeConsolidado.descDelivery.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de Entrega:</span>
                <span>R$ {activeConsolidado.taxaEntrega.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Couvert:</span>
                <span>R$ {activeConsolidado.couvert.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                <span>Subtotal Deduções:</span>
                <span>
                  R$ {(
                    activeConsolidado.servDia +
                    activeConsolidado.servNoite +
                    activeConsolidado.entradas +
                    activeConsolidado.descDelivery +
                    activeConsolidado.taxaEntrega +
                    activeConsolidado.couvert
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <hr className="border-t-2 border-black my-2" />
            <div className="flex justify-between text-base font-black pt-1">
              <span>TOTAL LÍQUIDO:</span>
              <span>R$ {activeConsolidado.totalFinal.toFixed(2)}</span>
            </div>
          </div>
          <br /><br />
          <div className="text-center text-[10px] border-t border-black pt-3">
            _________________________________<br />
            Assinatura Responsável
          </div>
        </div>
      )}

      {/* 4. PAYMENT RECEIPT VOUCHER */}
      {printType === "recebimento" && activeRecebimento && (
        <div className="space-y-4">
          <div className="text-center font-black text-lg border-b border-dashed border-black pb-2 mb-2 uppercase">
            {activeRecebimento.loja}
          </div>
          <div className="text-center font-bold tracking-wider mb-2">
            RECIBO DE PAGAMENTO (PENDENTE)
          </div>
          <p className="font-mono text-[10px] text-center text-slate-500">
            COMPROVANTE DO CLIENTE
          </p>
          
          <div className="space-y-1.5 font-mono text-xs pt-1">
            <p><b>CLIENTE:</b> {activeRecebimento.cliente.toUpperCase()}</p>
            <p><b>DATA/HORA:</b> {activeRecebimento.dataHora}</p>
            <p><b>LOJA:</b> {activeRecebimento.loja.toUpperCase()}</p>
          </div>

          <hr className="border-t border-dashed border-black my-2" />
          
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span>SALDO DEVEDOR ANTERIOR:</span>
              <span>R$ {activeRecebimento.saldoDevedorAnterior.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-800 font-bold">
              <span>VALOR PAGO AGORA (-):</span>
              <span>R$ {activeRecebimento.valorPago.toFixed(2)}</span>
            </div>
            <hr className="border-t border-dotted border-black my-1.5" />
            <div className="flex justify-between font-black text-sm text-slate-900">
              <span>SALDO DEVEDOR RESTANTE:</span>
              <span>R$ {activeRecebimento.saldoDevedorAtual.toFixed(2)}</span>
            </div>
          </div>

          <hr className="border-t border-dashed border-black my-3" />
          
          <div className="text-center text-[10px] mt-8 border-t border-slate-300 pt-2 font-mono">
            Assinatura Operador: _____________________
          </div>
          <div className="text-center text-[9px] text-slate-400 font-mono mt-1">
            Obrigado e volte sempre!
          </div>
        </div>
      )}

      {/* 5. LIST OF DEBTORS */}
      {printType === "lista_pendentes" && activeListaPendentes && (
        <div className="space-y-4">
          <div className="text-center font-black text-lg border-b border-dashed border-black pb-2 mb-2 uppercase">
            {activeListaPendentes.loja}
          </div>
          <div className="text-center font-bold tracking-wider mb-2">
            RELAÇÃO DE DEVEDORES
          </div>
          <p className="font-mono text-[9px] text-center text-slate-500 uppercase">
            EMISSÃO: {activeListaPendentes.dataHora}
          </p>
          
          <hr className="border-t border-dashed border-black my-2" />
          
          <div className="space-y-1 font-mono text-xs">
            {activeListaPendentes.devedores.map((dev, i) => (
              <div key={i} className="flex justify-between border-b border-dotted border-black/30 pb-1">
                <span className="truncate max-w-[180px]">{dev.cliente.toUpperCase()}</span>
                <span className="font-bold">R$ {dev.saldoDevedor.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <hr className="border-t-2 border-black my-2" />
          <div className="flex justify-between font-black text-xs text-slate-900 font-mono">
            <span>TOTAL DE PENDENTES:</span>
            <span>R$ {activeListaPendentes.totalPendentes.toFixed(2)}</span>
          </div>

          <div className="text-center text-[10px] mt-8 border-t border-slate-300 pt-2 font-mono">
            Relatório emitido via terminal de caixa.
          </div>
        </div>
      )}
    </div>
  );
}
