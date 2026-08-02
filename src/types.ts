/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ShiftType = 'Dia' | 'Noite';
export type LancamentoType = 'entrada' | 'saida' | 'pendente';

export interface PagamentoPendente {
  id: string;
  data: string;
  valor: number;
}

export interface Lancamento {
  id: number;
  valor: number;
  descricao: string;
  tipo: LancamentoType;
  turno: ShiftType;
  data: string;
  loja: string;
  pagamentos?: PagamentoPendente[];
}

export interface Venda {
  id: number;
  servico: number;
  itens: number;
  turno: ShiftType;
  data: string;
  loja: string;
}

export interface DadosManuaisDay {
  delivery: number;
  taxaEntrega: number;
  couvert: number;
  descDelivery: number;
}

export interface DadosManuais {
  [idDia: string]: DadosManuaisDay;
}

export interface Fechamento {
  id: number;
  loja: string;
  operador: string;
  data: string;
  turno: ShiftType;
  saldoInicial: number;
  saldoFinal: number;
  lancamentos: Lancamento[];
  vendas: Venda[];
  dataHora: string;
}

export interface LocalDB {
  vendas: Venda[];
  lancamentos: Lancamento[];
  dadosManuais: DadosManuais;
  historicoFechamentos: Fechamento[];
  lojas?: string[];
  operadores?: string[];
}

export interface CaixaTurno {
  lancamentos: Lancamento[];
  vendas: Venda[];
  saldoInicial: number;
  aberto: boolean;
}
