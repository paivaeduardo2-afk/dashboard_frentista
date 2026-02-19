
import { Abastecimento, Funcionario, JoinData } from '../types';

const generateDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

export const MOCK_FUNCIONARIOS: Funcionario[] = [
  { nome: 'CARLOS AUGUSTO SILVA', apelido: 'Carlos', id_cartao_abast: '1001', id_cartao_abast_2: '2001', id_cartao_abast_3: '' },
  { nome: 'MARTA SOUZA OLIVEIRA', apelido: 'Marta', id_cartao_abast: '1002', id_cartao_abast_2: '', id_cartao_abast_3: '' },
  { nome: 'JOSE JUNIOR DOS SANTOS', apelido: 'Junior', id_cartao_abast: '1003', id_cartao_abast_2: '2003', id_cartao_abast_3: '3003' },
  { nome: 'BEATRIZ LIMA COSTA', apelido: 'Bia', id_cartao_abast: '1004', id_cartao_abast_2: '', id_cartao_abast_3: '' },
];

export const MOCK_ABASTECIMENTOS: Abastecimento[] = Array.from({ length: 10 }, (_, i) => {
  const frentista = MOCK_FUNCIONARIOS[Math.floor(Math.random() * MOCK_FUNCIONARIOS.length)];
  return {
    nome_operador: 'SISTEMA',
    tipo_combustivel: 'GASOLINA',
    cod_bico: '01',
    preco: 5.89,
    litros: 20,
    total: 117.80,
    afericao: 'N',
    seq_caixa: 450,
    dt_caixa: generateDate(0),
    enc_inicial: 1000,
    enc_final: 1020,
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
