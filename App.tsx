
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Database, 
  RefreshCcw,
  Search,
  FolderOpen,
  Zap,
  XCircle,
  UserCheck,
  CreditCard,
  FileSpreadsheet,
  Settings
} from 'lucide-react';
import { MOCK_FUNCIONARIOS } from './services/mockData';
import { Funcionario, DBConfig } from './types';

export default function App() {
  const [employees, setEmployees] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dbConfig, setDbConfig] = useState<DBConfig>({
    host: 'localhost',
    path: 'C:\\ACS\\sintese\\pdv\\CAIXA.FDB',
    port: 3050,
    status: 'disconnected'
  });

  const checkBridge = async () => {
    try {
      const res = await fetch('http://localhost:3001/status');
      if (res.ok) {
        setBridgeStatus('online');
        return true;
      }
    } catch (e) {
      setBridgeStatus('offline');
      return false;
    }
    return false;
  };

  const handleFetchData = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setDbConfig(prev => ({ ...prev, status: 'connecting' }));
    
    try {
      const isOnline = await checkBridge();
      if (!isOnline) {
        throw new Error("Agente bridge.js não detectado em localhost:3001.");
      }

      // Requisição focada na tabela de funcionários
      const response = await fetch('http://localhost:3001/api/employees');
      
      if (!response.ok) {
        throw new Error("Erro ao acessar a tabela FUNCIONARIOS no banco Firebird.");
      }

      const data = await response.json();
      setEmployees(data);
      setDbConfig(prev => ({ ...prev, status: 'connected' }));
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Utilizando dados de demonstração (conexão local não encontrada).");
      setEmployees(MOCK_FUNCIONARIOS);
      setDbConfig(prev => ({ ...prev, status: 'disconnected' }));
    } finally {
      setIsConnecting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchData();
  }, []);

  const filteredEmployees = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return employees.filter(emp => 
      (emp.nome || "").toLowerCase().includes(s) ||
      (emp.apelido || "").toLowerCase().includes(s) ||
      (emp.id_cartao_abast || "").toLowerCase().includes(s) ||
      (emp.id_cartao_abast_2 || "").toLowerCase().includes(s) ||
      (emp.id_cartao_abast_3 || "").toLowerCase().includes(s)
    );
  }, [employees, searchTerm]);

  const exportToCSV = () => {
    if (filteredEmployees.length === 0) return;

    // Cabeçalho exatamente como solicitado
    const headers = ["NOME", "APELIDO", "ID_CARTAO_ABAST", "ID_CARTAO_ABAST_2", "ID_CARTAO_ABAST_3"];
    
    // Mapeamento de cada funcionário para uma linha
    const rows = filteredEmployees.map(emp => [
      `"${emp.nome || ''}"`,
      `"${emp.apelido || ''}"`,
      `"${emp.id_cartao_abast || ''}"`,
      `"${emp.id_cartao_abast_2 || ''}"`,
      `"${emp.id_cartao_abast_3 || ''}"`
    ]);

    // Geração do conteúdo CSV com BOM para Excel reconhecer caracteres PT-BR
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `EXPORT_FUNCIONARIOS_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !isConnecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCcw size={40} className="mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Acessando Tabela Funcionários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Header Fixo */}
      <header className="bg-slate-900 text-white px-8 py-4 shadow-xl flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
            <UserCheck size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight leading-none">Exportador de Cartões</h1>
            <p className="text-blue-400 text-[9px] font-bold uppercase tracking-widest mt-1">Tabela: FUNCIONARIOS</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            <div className={`h-2 w-2 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
            <span className="text-[9px] font-black uppercase text-slate-300">
              {bridgeStatus === 'online' ? 'Conexão OK' : 'Sem Conexão'}
            </span>
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg transition-colors ${showConfig ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-lg"
          >
            <FileSpreadsheet size={18} /> Gerar Planilha
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden relative">
        {/* Painel de Configuração Lateral (Toggle) */}
        {showConfig && (
          <div className="absolute right-6 top-6 w-80 bg-white border-2 border-slate-200 rounded-3xl shadow-2xl z-40 p-6 animate-in slide-in-from-right-4 duration-200">
             <h3 className="text-xs font-black uppercase text-slate-400 mb-4 border-b border-slate-100 pb-2">Configurações de Banco</h3>
             <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Caminho FDB</span>
                  <div className="flex gap-2">
                    <input readOnly value={dbConfig.path} className="flex-1 bg-slate-50 text-[10px] font-mono p-2 rounded border border-slate-200 truncate" />
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-100 rounded text-slate-600 hover:bg-blue-600 hover:text-white transition-all"><FolderOpen size={14} /></button>
                  </div>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 text-white">
                   <p className="text-[9px] font-black text-emerald-400 uppercase mb-2">Query no bridge.js:</p>
                   <code className="text-[9px] font-mono text-slate-300 block leading-tight break-all">
                    SELECT nome, apelido, id_cartao_abast, id_cartao_abast_2, id_cartao_abast_3 FROM FUNCIONARIOS
                   </code>
                </div>
                <button onClick={handleFetchData} className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                  <Zap size={14} /> Sincronizar Agora
                </button>
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept=".fdb" onChange={(e) => {
               const f = e.target.files?.[0];
               if(f) setDbConfig({...dbConfig, path: `C:\\ACS\\sintese\\pdv\\${f.name}`});
             }} />
          </div>
        )}

        {/* Barra de Busca */}
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Pesquisar por Nome, Apelido ou qualquer um dos 3 IDs de Cartão..."
            className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-blue-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {errorMessage && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-lg flex items-center gap-3">
             <XCircle className="text-amber-500" size={18} />
             <p className="text-[10px] font-bold text-amber-800 uppercase">{errorMessage}</p>
          </div>
        )}

        {/* Tabela Principal */}
        <div className="flex-1 bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b-2 border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Nome</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/6">Apelido</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ID Cartão 1</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ID Cartão 2</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ID Cartão 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          <UserCheck size={16} />
                        </div>
                        <span className="text-xs font-black text-slate-800 uppercase">{emp.nome || '---'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{emp.apelido || '---'}</td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-[10px] font-black text-blue-600">
                        <CreditCard size={12} /> {emp.id_cartao_abast || 'VAZIO'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[10px] font-black ${emp.id_cartao_abast_2 ? 'bg-slate-50 border-slate-200 text-blue-600' : 'bg-red-50/30 border-red-100 text-red-300'}`}>
                        <CreditCard size={12} /> {emp.id_cartao_abast_2 || 'NÃO POSSUI'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[10px] font-black ${emp.id_cartao_abast_3 ? 'bg-slate-50 border-slate-200 text-blue-600' : 'bg-red-50/30 border-red-100 text-red-300'}`}>
                        <CreditCard size={12} /> {emp.id_cartao_abast_3 || 'NÃO POSSUI'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredEmployees.length === 0 && (
              <div className="p-20 text-center">
                <Database size={40} className="mx-auto mb-4 text-slate-200" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum registro encontrado nesta consulta</p>
              </div>
            )}
          </div>

          {/* Footer Informativo */}
          <div className="bg-slate-50 px-8 py-3 border-t-2 border-slate-100 flex items-center justify-between text-[9px] font-black uppercase text-slate-400">
            <div className="flex gap-6">
              <span>Total de Registros: <strong className="text-slate-800">{employees.length}</strong></span>
              <span>Resultados Filtrados: <strong className="text-blue-600">{filteredEmployees.length}</strong></span>
            </div>
            <div className="flex items-center gap-4">
              <span>Exportação: CSV (Ponto e Vírgula)</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Banco Pronto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
