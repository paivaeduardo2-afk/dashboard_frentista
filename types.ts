
export interface Abastecimento {
  nome_operador: string;
  tipo_combustivel: string;
  cod_bico: string;
  preco: number;
  litros: number;
  total: number;
  afericao: string;
  seq_caixa: number;
  dt_caixa: string;
  enc_inicial: number;
  enc_final: number;
  id_cartao_frentista: string;
}

export interface Funcionario {
  id_cartao_abast: string;
  apelido: string;
  nome_completo: string;
}

export interface JoinData extends Abastecimento {
  apelido: string;
}

export interface DBConfig {
  host: string;
  path: string;
  port: number;
  status: 'connected' | 'disconnected' | 'connecting';
}

export interface DashboardStats {
  totalRevenue: number;
  totalLiters: number;
  avgPrice: number;
  fuelingCount: number;
}

export interface ChartDataItem {
  name: string;
  total: number;
  litros: number;
}

export interface FuelChartItem {
  name: string;
  value: number;
}
