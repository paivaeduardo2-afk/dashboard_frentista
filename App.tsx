
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

  // Query otimizada para trazer apenas quem tem algum cartão preenchido
  const sqlFilter = `WHERE (id_cartao_abast IS NOT NULL AND id_cartao_abast <> '') 
       OR (id_cartao_abast_2 IS NOT NULL AND id_cartao_abast_2 <> '') 
       OR (id_cartao_abast_3 IS NOT NULL AND id_cartao_abast_3 <> '')`;

  const bridgeCode = `const express = require('express');
const Firebird = require('node-firebird');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/status', (req, res) => res.send({ status: 'online' }));

app.get('/api/employees', (req, res) => {
    const dbPath = req.query.path || 'C:\\\\ACS\\\\sintese\\\\pdv\\\\CAIXA.FDB';
    const options = {
        host: '127.0.0.1',
        port: 3050,
        database: dbPath,
        user: 'SYSDBA',
        password: 'masterkey',
        lowercase_keys: true
    };

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).send({ error: "Erro Firebird: " + err.message });
        
        // Query filtrando apenas quem possui algum cartão
        const query = \`SELECT nome, apelido, id_cartao_abast, id_cartao_abast_2, id_cartao_abast_3 
                       FROM FUNCIONARIOS 
                       ${sqlFilter}\`;
                       
        db.query(query, (err, result) => {
            db.detach();
            if (err) return res.status(500).send({ error: "Erro na Query: " + err.message });
            res.json(result);
        });
    });
});

app.listen(3001, () => console.log('Agente rodando em http://localhost:3001'));`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bridgeCode);
    alert("Código copiado! Atualize seu bridge.js e reinicie o servidor.");
  };

  const checkBridge = async () => {
    try {
      const res = await fetch('http://localhost:3001/status', { mode: 'cors' });
      if (res.ok) {
        setBridgeStatus('online');
        return true;
      }
      setBridgeStatus('offline');
      return false;
    } catch (e) {
      setBridgeStatus('offline');
      return false;
    }
  };

  const handleFetchData = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setDbConfig(prev => ({ ...prev, status: 'connecting' }));
    
    try {
      const isOnline = await checkBridge();
      if (!isOnline) {
        throw new Error("Agente Offline: Inicie o Agente Bridge primeiro.");
      }

      const url = `http://localhost:3001/api/employees?path=${encodeURIComponent(dbConfig.path)}`;
      const response = await fetch(url, { method: 'GET', mode: 'cors' });
      
      if (response.status === 404) {
        throw new Error("Erro 404: Rota não encontrada. Atualize o código do bridge.js.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Erro desconhecido." }));
        throw new Error(errorData.error || `Erro (${response.status})`);
      }

      const data: Funcionario[] = await response.json();
      
      // Filtro de segurança no frontend também
      const filteredData = data.filter(emp => 
        (emp.id_cartao_abast && emp.id_cartao_abast.trim() !== "") ||
        (emp.id_cartao_abast_2 && emp.id_cartao_abast_2.trim() !== "") ||
        (emp.id_cartao_abast_3 && emp.id_cartao_abast_3.trim() !== "")
      );

      setEmployees(filteredData);
      setDbConfig(prev => ({ ...prev, status: 'connected' }));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
      // No fallback, apenas mostramos o que tem cartão do mock para exemplo visual
      setEmployees(MOCK_FUNCIONARIOS.filter(f => f.id_cartao_abast)); 
      setDbConfig(prev => ({ ...prev, status: 'disconnected' }));
    } finally {
      setIsConnecting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchData();
    const interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredEmployees = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return employees.filter(emp => 
      (emp.nome || "").toLowerCase().includes(s) ||
      (emp.apelido || "").toLowerCase().includes(s) ||
      (emp.id_cartao_abast || "").toLowerCase().includes(s)
    );
  }, [employees, searchTerm]);

  const exportToCSV = () => {
    if (filteredEmployees.length === 0) return;
    const headers = ["NOME", "APELIDO", "ID_CARTAO_ABAST", "ID_CARTAO_ABAST_2", "ID_CARTAO_ABAST_3"];
    const rows = filteredEmployees.map(emp => [
      `"${emp.nome || ''}"`, `"${emp.apelido || ''}"`, `"${emp.id_cartao_abast || ''}"`, `"${emp.id_cartao_abast_2 || ''}"`, `"${emp.id_cartao_abast_3 || ''}"`
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `EXPORT_CARTOES_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <header className="bg-slate-900 text-white px-8 py-4 shadow-xl flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg"><UserCheck size={22} /></div>
          <div>
            <h1 className="text-md font-black uppercase tracking-tight">Exportador de Cartões</h1>
            <p className="text-[8px] text-blue-400 font-bold uppercase">Somente registros com Cartão</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${bridgeStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[9px] font-black uppercase">{bridgeStatus === 'online' ? 'Agente Conectado' : 'Agente Offline'}</span>
          </div>
          <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-lg ${showConfig ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}><Settings size={18} /></button>
          <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-emerald-900/20"><FileSpreadsheet size={16} /> Exportar CSV</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden relative">
        {showConfig && (
          <div className="absolute right-6 top-6 w-[450px] max-h-[85vh] overflow-y-auto bg-white border-2 border-slate-200 rounded-2xl shadow-2xl z-40 p-6 animate-in slide-in-from-right-4 duration-200">
             <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-xs font-black uppercase">Configuração e Filtros</h3>
                <button onClick={() => setShowConfig(false)} className="text-slate-400"><XCircle size={18} /></button>
             </div>

             <div className="space-y-4">
                <section>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Caminho do Banco</label>
                  <div className="flex gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-[10px] font-mono flex-1 truncate">{dbConfig.path}</span>
                    <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:text-blue-800"><FolderOpen size={16} /></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".fdb" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) setDbConfig({...dbConfig, path: `C:\\ACS\\sintese\\pdv\\${f.name}`});
                  }} />
                </section>

                <section className="bg-slate-900 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-blue-400"><Terminal size={14} /><h4 className="text-[9px] font-black uppercase">Novo Agente bridge.js</h4></div>
                    <button onClick={copyToClipboard} className="text-[8px] bg-slate-800 px-2 py-1 rounded border border-slate-700 hover:bg-slate-700 flex items-center gap-1"><Copy size={10} /> Copiar Novo Código</button>
                  </div>
                  <p className="text-[8px] text-slate-400 mb-2 leading-tight">Atenção: O código abaixo já inclui o filtro SQL para ignorar funcionários sem cartão.</p>
                  <div className="max-h-32 overflow-y-auto bg-black/30 p-2 rounded border border-white/5 font-mono text-[8px] text-slate-300">
                    <pre>{bridgeCode}</pre>
                  </div>
                </section>

                <button onClick={handleFetchData} disabled={isConnecting} className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-500 transition-all">
                  {isConnecting ? <RefreshCcw size={16} className="animate-spin" /> : <Zap size={16} />}
                  Sincronizar e Filtrar
                </button>
             </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border-2 border-red-100 p-4 rounded-xl flex items-center gap-3 shadow-sm">
             <AlertTriangle className="text-red-500" size={20} />
             <div>
               <p className="text-[10px] font-black text-red-900 uppercase">Erro na Importação</p>
               <p className="text-[11px] font-bold text-red-700">{errorMessage}</p>
             </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar entre os funcionários filtrados..."
            className="w-full bg-white border-2 border-slate-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:border-blue-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Funcionário</th>
                  <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Apelido</th>
                  <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">ID Cartão 1</th>
                  <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">ID Cartão 2</th>
                  <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">ID Cartão 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-3 text-[11px] font-black text-slate-800 uppercase">{emp.nome}</td>
                    <td className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase">{emp.apelido}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-md text-[10px] font-mono font-black text-blue-600 border border-blue-100">
                        <CreditCard size={10} /> {emp.id_cartao_abast || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-black border ${emp.id_cartao_abast_2 ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-transparent text-slate-200 border-transparent'}`}>
                        <CreditCard size={10} /> {emp.id_cartao_abast_2 || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-black border ${emp.id_cartao_abast_3 ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-transparent text-slate-200 border-transparent'}`}>
                        <CreditCard size={10} /> {emp.id_cartao_abast_3 || '---'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredEmployees.length === 0 && !isConnecting && (
              <div className="p-20 text-center flex flex-col items-center">
                <div className="p-4 bg-slate-50 rounded-full mb-4">
                  <CreditCard size={40} className="text-slate-200" />
                </div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum funcionário com cartão encontrado</h4>
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-black uppercase text-slate-400">
             <div className="flex gap-4">
               <span>Total Importado: <strong className="text-slate-700">{employees.length}</strong></span>
               <span>Visualizando: <strong className="text-blue-600">{filteredEmployees.length}</strong></span>
             </div>
             <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${dbConfig.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div> 
               Filtro Ativo: Algum Cartão Preenchido
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
