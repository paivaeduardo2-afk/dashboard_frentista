
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Database, 
  RefreshCcw,
  Download,
  Search,
  FolderOpen,
  Zap,
  Server,
  XCircle,
  UserCheck,
  CreditCard,
  FileSpreadsheet
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
        throw new Error("Agente offline. Certifique-se de que o bridge.js está rodando.");
      }

      // Rota específica para buscar apenas funcionários
      const response = await fetch('http://localhost:3001/api/employees');
      
      // Caso a rota acima não exista no seu bridge atual, usamos a de dados gerais e filtramos
      // Ou usamos o mock se falhar a conexão real para demonstração
      if (!response.ok) {
        const fallbackRes = await fetch('http://localhost:3001/api/data');
        if (!fallbackRes.ok) throw new Error("Erro ao ler banco Firebird");
        const allData = await fallbackRes.json();
        // Tenta extrair funcionários únicos dos dados de abastecimento se a tabela direta não estiver disponível
        const uniqueEmps: Record<string, Funcionario> = {};
        allData.forEach((d: any) => {
          if (d.id_cartao_frentista && !uniqueEmps[d.id_cartao_frentista]) {
            uniqueEmps[d.id_cartao_frentista] = {
              id_cartao_abast: d.id_cartao_frentista,
              apelido: d.apelido || 'N/A',
              nome_completo: d.apelido || 'Frentista ' + d.id_cartao_frentista
            };
          }
        });
        setEmployees(Object.values(uniqueEmps));
      } else {
        const realEmps = await response.json();
        setEmployees(realEmps);
      }

      setDbConfig(prev => ({ ...prev, status: 'connected' }));
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Erro de conexão. Carregando dados de exemplo para visualização.");
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
    const search = searchTerm.toLowerCase();
    return employees.filter(emp => 
      (emp.nome_completo || "").toLowerCase().includes(search) ||
      (emp.apelido || "").toLowerCase().includes(search) ||
      (emp.id_cartao_abast || "").toLowerCase().includes(search)
    );
  }, [employees, searchTerm]);

  const exportToCSV = () => {
    if (filteredEmployees.length === 0) return;

    const headers = ["NOME COMPLETO", "APELIDO", "CODIGO CARTAO"];
    const rows = filteredEmployees.map(emp => [
      `"${emp.nome_completo}"`,
      `"${emp.apelido}"`,
      `"${emp.id_cartao_abast}"`
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `funcionarios_firebird_${new Date().toISOString().split('T')[0]}.csv`);
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
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Conectando ao Firebird...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header Fixo */}
      <header className="bg-slate-900 text-white px-8 py-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20">
            <UserCheck size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">Extrator de Identificadores</h1>
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Base de Dados ACS Síntese</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
            <div className={`h-2 w-2 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-black uppercase text-slate-300">
              {bridgeStatus === 'online' ? 'Bridge Ativo' : 'Bridge Offline'}
            </span>
          </div>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all shadow-lg shadow-emerald-900/20"
          >
            <FileSpreadsheet size={18} /> Exportar Planilha
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col p-8 gap-8">
        {/* Barra de Filtros e Config */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
          <div className="lg:col-span-2 space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Pesquisa Rápida</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome ou código do cartão..."
                className="w-full bg-white border-2 border-slate-200 rounded-3xl py-4 pl-12 pr-4 text-sm font-bold focus:border-blue-500 outline-none transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 flex items-center justify-between shadow-sm group hover:border-blue-400 transition-all">
             <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase text-slate-400">Diretório do Banco</span>
               <span className="text-[11px] font-mono font-bold truncate max-w-[200px]">{dbConfig.path}</span>
             </div>
             <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-slate-100 rounded-2xl text-slate-600 hover:bg-blue-600 hover:text-white transition-all"
             >
               <FolderOpen size={18} />
             </button>
             <input type="file" ref={fileInputRef} className="hidden" accept=".fdb" onChange={(e) => {
               const f = e.target.files?.[0];
               if(f) setDbConfig({...dbConfig, path: `C:\\ACS\\sintese\\pdv\\${f.name}`});
             }} />
          </div>
        </div>

        {errorMessage && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-center gap-3">
             <XCircle className="text-amber-500" size={20} />
             <p className="text-xs font-bold text-amber-800">{errorMessage}</p>
          </div>
        )}

        {/* Tabela de Dados */}
        <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b-2 border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Funcionário</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Apelido</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Código do Cartão</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          <UserCheck size={20} />
                        </div>
                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{emp.nome_completo}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-500 uppercase">{emp.apelido}</td>
                    <td className="px-8 py-5">
                      <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 font-mono text-xs font-black text-blue-700">
                        <CreditCard size={14} /> {emp.id_cartao_abast}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase">Sincronizado</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredEmployees.length === 0 && (
              <div className="p-20 text-center">
                <Database size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="text-sm font-black text-slate-300 uppercase">Nenhum registro encontrado</p>
              </div>
            )}
          </div>

          {/* Footer de Resumo */}
          <div className="bg-slate-50 px-8 py-4 border-t-2 border-slate-100 flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
            <div className="flex gap-6">
              <span>Total no Banco: <strong className="text-slate-800">{employees.length}</strong></span>
              <span>Filtrados: <strong className="text-blue-600">{filteredEmployees.length}</strong></span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={handleFetchData}>
              <RefreshCcw size={12} className={isConnecting ? "animate-spin" : ""} /> Atualizar Banco de Dados
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
