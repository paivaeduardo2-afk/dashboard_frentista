
import { Abastecimento, Funcionario, JoinData } from '../types';

const generateDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

export const MOCK_FUNCIONARIOS: Funcionario[] = [
  { id_cartao_abast: '1001', apelido: 'Carlos', nome_completo: 'Carlos Silva' },
  { id_cartao_abast: '1002', apelido: 'Marta', nome_completo: 'Marta Souza' },
  { id_cartao_abast: '1003', apelido: 'Junior', nome_completo: 'José Junior' },
  { id_cartao_abast: '1004', apelido: 'Bia', nome_completo: 'Beatriz Lima' },
];

export const MOCK_ABASTECIMENTOS: Abastecimento[] = Array.from({ length: 150 }, (_, i) => {
  const frentista = MOCK_FUNCIONARIOS[Math.floor(Math.random() * MOCK_FUNCIONARIOS.length)];
  const bicos = ['01', '02', '03', '04', '05', '06'];
  const combustiveis = ['GASOLINA COMUM', 'GASOLINA ADITIVADA', 'ETANOL', 'DIESEL S10'];
  const preco = 5.89 + (Math.random() * 0.5);
  const litros = 10 + (Math.random() * 40);
  const total = preco * litros;
  
  return {
    nome_operador: 'SISTEMA',
    tipo_combustivel: combustiveis[Math.floor(Math.random() * combustiveis.length)],
    cod_bico: bicos[Math.floor(Math.random() * bicos.length)],
    preco: parseFloat(preco.toFixed(2)),
    litros: parseFloat(litros.toFixed(3)),
    total: parseFloat(total.toFixed(2)),
    afericao: Math.random() > 0.95 ? 'S' : 'N',
    seq_caixa: 450 + Math.floor(i / 10),
    dt_caixa: generateDate(Math.floor(Math.random() * 7)),
    enc_inicial: 1000 + i * 50,
    enc_final: 1000 + i * 50 + litros,
    id_cartao_frentista: frentista.id_cartao_abast
  };
});

export const getJoinedData = (): JoinData[] => {
  return MOCK_ABASTECIMENTOS.map(abast => {
    const func = MOCK_FUNCIONARIOS.find(f => f.id_cartao_abast === abast.id_cartao_frentista);
    return {
      ...abast,
      apelido: func ? func.apelido : 'DESCONHECIDO'
    };
  });
};
