
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
  Settings,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Copy
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
      const res = await fetch('http://localhost:3001/status', { mode: 'cors' });
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
        throw new Error("O Agente Bridge não está rodando. Verifique o passo a passo nas configurações.");
      }

      // Enviamos o caminho do banco como parâmetro para o backend abrir o arquivo correto
      const response = await fetch(`http://localhost:3001/api/employees?path=${encodeURIComponent(dbConfig.path)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Erro interno no Agente." }));
        throw new Error(errorData.error || "Erro ao ler a tabela FUNCIONARIOS.");
      }

      const data = await response.json();
      setEmployees(data);
      setDbConfig(prev => ({ ...prev, status: 'connected' }));
      setErrorMessage(null);
    } catch (err: any) {
      console.error("Connection Error:", err);
      setErrorMessage(err.message);
      setEmployees(MOCK_FUNCIONARIOS); // Fallback para demonstração
      setDbConfig(prev => ({ ...prev, status: 'disconnected' }));
    } finally {
      setIsConnecting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchData();
    const interval = setInterval(checkBridge, 5000);
    return () => clearInterval(interval);
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
    const headers = ["NOME", "APELIDO", "ID_CARTAO_ABAST", "ID_CARTAO_ABAST_2", "ID_CARTAO_ABAST_3"];
    const rows = filteredEmployees.map(emp => [
      `"${emp.nome || ''}"`,
      `"${emp.apelido || ''}"`,
      `"${emp.id_cartao_abast || ''}"`,
      `"${emp.id_cartao_abast_2 || ''}"`,
      `"${emp.id_cartao_abast_3 || ''}"`
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `EXPORT_FUNCIONARIOS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            <p className="text-blue-400 text-[9px] font-bold uppercase tracking-widest mt-1">Status: {dbConfig.status.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${bridgeStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <div className={`h-2 w-2 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={`text-[9px] font-black uppercase ${bridgeStatus === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
              {bridgeStatus === 'online' ? 'Agente Conectado' : 'Agente Desconectado'}
            </span>
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg transition-colors ${showConfig ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Configurações de Conexão"
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-emerald-900/20"
          >
            <FileSpreadsheet size={18} /> Exportar CSV
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden relative">
        {/* Painel de Configuração e Ajuda */}
        {showConfig && (
          <div className="absolute right-6 top-6 w-96 max-h-[90%] overflow-y-auto bg-white border-2 border-slate-200 rounded-3xl shadow-2xl z-40 p-6 animate-in slide-in-from-right-4 duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase text-slate-800">Painel de Conexão</h3>
                <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
             </div>

             <div className="space-y-6">
                <section>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Banco de Dados Firebird</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col overflow-hidden">
                      <span className="text-[8px] font-bold text-slate-400 uppercase mb-1">Caminho Local</span>
                      <span className="text-[10px] font-mono font-bold text-slate-700 truncate">{dbConfig.path}</span>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="px-3 bg-slate-100 rounded-xl text-slate-600 hover:bg-blue-600 hover:text-white transition-all"><FolderOpen size={18} /></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".fdb" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) setDbConfig({...dbConfig, path: `C:\\ACS\\sintese\\pdv\\${f.name}`});
                  }} />
                </section>

                <section className="bg-slate-900 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-3 text-blue-400">
                    <Terminal size={16} />
                    <h4 className="text-[10px] font-black uppercase tracking-tighter">Instrução para TI / Suporte</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                    Para que o sistema acesse o Firebird, você precisa rodar o Agente Bridge em <strong>Node.js</strong> na porta 3001.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-[9px] font-bold text-slate-300">
                      <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span>Instale o módulo <code>node-firebird</code></span>
                    </div>
                    <div className="flex items-start gap-2 text-[9px] font-bold text-slate-300">
                      <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span>Configure CORS para permitir porta do navegador</span>
                    </div>
                  </div>
                  <button className="w-full mt-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-[9px] font-black uppercase hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                    <Copy size={12} /> Copiar Código bridge.js
                  </button>
                </section>

                <button 
                  onClick={handleFetchData} 
                  disabled={isConnecting}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-blue-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                >
                  {isConnecting ? <RefreshCcw size={18} className="animate-spin" /> : <Zap size={18} />}
                  {isConnecting ? 'Tentando Conexão...' : 'Testar Conexão Agora'}
                </button>
             </div>
          </div>
        )}

        {/* Notificações de Erro */}
        {errorMessage && (
          <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-300">
             <div className="flex items-center gap-4">
               <div className="bg-red-500 p-2 rounded-lg text-white"><AlertTriangle size={20} /></div>
               <div>
                 <p className="text-[10px] font-black text-red-800 uppercase leading-none mb-1">Falha na Comunicação com o Banco</p>
                 <p className="text-[11px] font-bold text-red-600/80">{errorMessage}</p>
               </div>
             </div>
             <button onClick={handleFetchData} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-[10px] font-black uppercase transition-colors">Tentar Novamente</button>
          </div>
        )}

        {/* Filtro de Busca */}
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={22} />
          <input 
            type="text" 
            placeholder="Digite o nome, apelido ou código do cartão para filtrar..."
            className="w-full bg-white border-2 border-slate-200 rounded-2xl py-5 pl-16 pr-8 text-sm font-bold focus:border-blue-500 outline-none transition-all shadow-sm focus:shadow-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tabela de Dados */}
        <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b-2 border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[30%]">Nome do Funcionário</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-[15%]">Apelido</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cartão Principal</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cartão Auxiliar 2</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cartão Auxiliar 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                          <UserCheck size={20} />
                        </div>
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{emp.nome || '---'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg uppercase">{emp.apelido || '---'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 font-mono text-xs font-black text-blue-700">
                        <CreditCard size={14} /> {emp.id_cartao_abast || 'VAZIO'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-xs font-black transition-all ${emp.id_cartao_abast_2 ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-50/50 border-dashed border-slate-200 text-slate-300'}`}>
                        <CreditCard size={14} /> {emp.id_cartao_abast_2 || '---'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-xs font-black transition-all ${emp.id_cartao_abast_3 ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-50/50 border-dashed border-slate-200 text-slate-300'}`}>
                        <CreditCard size={14} /> {emp.id_cartao_abast_3 || '---'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredEmployees.length === 0 && !isConnecting && (
              <div className="p-32 text-center">
                <div className="inline-flex p-6 bg-slate-50 rounded-full mb-6">
                  <Database size={56} className="text-slate-200" />
                </div>
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Sem dados disponíveis</h4>
                <p className="text-xs text-slate-300 mt-2 font-bold uppercase">Verifique a conexão ou ajuste os filtros de pesquisa</p>
              </div>
            )}
          </div>

          {/* Footer de Resumo */}
          <div className="bg-slate-50 px-10 py-4 border-t-2 border-slate-100 flex items-center justify-between">
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Base de Dados</span>
                <span className="text-[10px] font-black text-slate-800 uppercase">{employees.length} Cadastros</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Resultado do Filtro</span>
                <span className="text-[10px] font-black text-blue-600 uppercase">{filteredEmployees.length} Encontrados</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Exportação Pronta: UTF-8 / CSV</span>
              </div>
              <button 
                onClick={handleFetchData}
                className="p-2 text-slate-400 hover:text-blue-600 transition-colors" 
                title="Sincronizar Manualmente"
              >
                <RefreshCcw size={16} className={isConnecting ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
