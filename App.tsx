
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Database, 
  Fuel, 
  TrendingUp, 
  ArrowUpRight, 
  RefreshCcw,
  Download,
  CalendarDays,
  AlertCircle,
  Search,
  FolderOpen,
  CheckCircle2,
  Zap,
  Server,
  Terminal,
  Code,
  XCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { getJoinedData } from './services/mockData';
import { JoinData, DBConfig, DashboardStats, ChartDataItem, FuelChartItem } from './types';
import { GoogleGenAI } from "@google/genai";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [data, setData] = useState<JoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dbConfig, setDbConfig] = useState<DBConfig>({
    host: 'localhost',
    path: 'C:\\PostoMaster\\BD\\DADOS.FDB',
    port: 3050,
    status: 'disconnected'
  });

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [generatingInsight, setGeneratingInsight] = useState(false);

  // Verifica se o agente local está rodando
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const isOnline = await checkBridge();
      if (isOnline) {
        await handleConnect();
      } else {
        setData(getJoinedData()); // Dados demo se estiver offline
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setDbConfig(prev => ({ ...prev, status: 'connecting' }));
    
    try {
      const isOnline = await checkBridge();
      if (!isOnline) {
        throw new Error("Agente local não encontrado na porta 3001. Verifique se o bridge.js está rodando.");
      }

      const response = await fetch('http://localhost:3001/api/data');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao ler banco Firebird");
      }

      const realData = await response.json();
      setData(realData);
      setDbConfig(prev => ({ ...prev, status: 'connected' }));
      setActiveTab('dashboard');
    } catch (err: any) {
      setErrorMessage(err.message);
      setDbConfig(prev => ({ ...prev, status: 'disconnected' }));
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = new Date(item.dt_caixa + 'T00:00:00');
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      return itemDate >= start && itemDate <= end;
    });
  }, [data, startDate, endDate]);

  const stats = useMemo((): DashboardStats => {
    const totalRevenue = filteredData.reduce((acc, curr) => acc + curr.total, 0);
    const totalLiters = filteredData.reduce((acc, curr) => acc + curr.litros, 0);
    return {
      totalRevenue,
      totalLiters,
      avgPrice: totalRevenue / (totalLiters || 1),
      fuelingCount: filteredData.length
    };
  }, [filteredData]);

  const chartDataByFrentista = useMemo((): ChartDataItem[] => {
    const grouped: Record<string, ChartDataItem> = {};
    filteredData.forEach(curr => {
      const name = curr.apelido || 'DESCONHECIDO';
      if (!grouped[name]) grouped[name] = { name, total: 0, litros: 0 };
      grouped[name].total += curr.total;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const chartDataByFuel = useMemo((): FuelChartItem[] => {
    const grouped: Record<string, FuelChartItem> = {};
    filteredData.forEach(curr => {
      const name = curr.tipo_combustivel || 'OUTROS';
      if (!grouped[name]) grouped[name] = { name, value: 0 };
      grouped[name].value += curr.total;
    });
    return Object.values(grouped);
  }, [filteredData]);

  const generateAIInsight = async () => {
    if (!process.env.API_KEY) return;
    setGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const summary = `Dashboard Posto: R$ ${stats.totalRevenue.toFixed(2)} em vendas, ${stats.totalLiters.toFixed(2)} litros. Foco em ${chartDataByFrentista[0]?.name || 'operadores'}.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise esses dados e me dê uma dica de gestão curta: ${summary}`
      });
      setAiInsight(response.text || '');
    } catch (err) {
      setAiInsight('Falha na conexão com a IA.');
    } finally {
      setGeneratingInsight(false);
    }
  };

  if (loading && !isConnecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCcw size={40} className="mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sincronizando com Firebird Local...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 flex-col bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <div className="rounded-lg bg-blue-600 p-2"><Fuel size={24} /></div>
          <div>
            <h1 className="text-lg font-black leading-none">FirebirdPro</h1>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sync Ativo</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <SidebarLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Painel" />
          <SidebarLink active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Database size={20} />} label="Vendas" />
          <SidebarLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Conexão Local" />
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="rounded-xl bg-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-2 w-2 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="text-[10px] font-bold text-slate-300 uppercase">
                Status do Agente: {bridgeStatus === 'online' ? 'Ativo' : 'Desconectado'}
              </span>
            </div>
            <p className="truncate text-[9px] text-slate-500 font-mono">http://localhost:3001</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur-md">
          <h2 className="text-xl font-black text-slate-800">
            {activeTab === 'dashboard' ? 'Resultados' : activeTab === 'history' ? 'Transações' : 'Configuração de Rede'}
          </h2>
          <div className="flex items-center gap-4">
             {bridgeStatus === 'offline' && activeTab !== 'settings' && (
               <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase text-amber-600 border border-amber-100">
                 <AlertCircle size={14} /> Usando Dados de Demonstração
               </div>
             )}
             <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <CalendarDays size={14} className="text-blue-600" />
                <span className="text-[10px] font-black uppercase text-slate-600">{startDate} — {endDate}</span>
             </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Vendas do Período" value={`R$ ${stats.totalRevenue.toLocaleString()}`} icon={<TrendingUp />} color="blue" />
                <MetricCard title="Total Litros" value={`${stats.totalLiters.toFixed(2)} L`} icon={<Fuel />} color="emerald" />
                <MetricCard title="Ticket Médio" value={`R$ ${(stats.totalRevenue / (stats.fuelingCount || 1)).toFixed(2)}`} icon={<ArrowUpRight />} color="amber" />
                <MetricCard title="Atendimentos" value={stats.fuelingCount} icon={<RefreshCcw />} color="indigo" />
              </div>

              <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-xl">
                 <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex-1">
                       <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={18} className="text-blue-400" />
                          <h3 className="text-lg font-black uppercase tracking-wide">Insights da IA (Gemini)</h3>
                       </div>
                       <p className="text-sm text-slate-400 font-medium">
                          {generatingInsight ? 'Processando dados do banco local...' : (aiInsight || 'Clique para analisar o desempenho do seu posto com inteligência artificial.')}
                       </p>
                    </div>
                    <button onClick={generateAIInsight} disabled={generatingInsight || !process.env.API_KEY} className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-50">
                       {generatingInsight ? 'Analisando...' : 'Gerar Insight'}
                    </button>
                 </div>
                 <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-600/10 to-transparent"></div>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Vendas por Frentista</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataByFrentista} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11, fontWeight: 700}} width={80} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Mix de Combustíveis</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartDataByFuel} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                          {chartDataByFuel.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                        <Legend verticalAlign="bottom" iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 p-6">
                <div className="flex items-center justify-between">
                   <div className="relative w-72">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Filtrar operador ou bico..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                   </div>
                   <button className="flex items-center gap-2 text-xs font-black uppercase text-blue-600 hover:text-blue-700 transition-colors">
                      <Download size={16} /> Baixar Planilha
                   </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Data e Hora</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Frentista</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Produto</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400">Qtd Litros</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-[11px] font-bold text-slate-600">{new Date(row.dt_caixa).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 text-xs font-black text-slate-800">{row.apelido}</td>
                        <td className="px-6 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600 uppercase tracking-tight">{row.tipo_combustivel}</span></td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-600">{row.litros.toFixed(3)}</td>
                        <td className="px-6 py-4 text-right text-xs font-black text-blue-600">R$ {row.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm">
                <div className="mb-8 flex items-center gap-4">
                  <div className="rounded-2xl bg-blue-600 p-4 text-white shadow-xl shadow-blue-500/20">
                    <Server size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Terminal de Dados</h3>
                    <p className="text-sm font-medium text-slate-400">Conexão via Agente Firebird</p>
                  </div>
                </div>

                {errorMessage && (
                   <div className="mb-6 rounded-2xl bg-red-50 border border-red-100 p-4 flex items-center gap-3 text-red-600">
                      <XCircle size={20} />
                      <p className="text-xs font-bold uppercase">{errorMessage}</p>
                   </div>
                )}

                <div className="space-y-6">
                  <div className="group relative">
                    <label className="mb-2 block text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Endereço do Arquivo Local</label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input 
                          type="text" 
                          value={dbConfig.path} 
                          onChange={(e) => setDbConfig({...dbConfig, path: e.target.value})}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 px-6 text-xs font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" 
                        />
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-2xl bg-slate-100 p-4 text-slate-600 transition-all hover:bg-slate-200 border border-slate-200 active:scale-95"
                      >
                        <FolderOpen size={20} />
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".fdb,.gdb" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if(file) setDbConfig({...dbConfig, path: `C:\\PostoMaster\\BD\\${file.name}`});
                      }} />
                    </div>
                  </div>

                  <button 
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className={`mt-4 flex w-full items-center justify-center gap-3 rounded-3xl py-5 text-sm font-black uppercase tracking-widest text-white transition-all shadow-xl active:scale-[0.98] ${bridgeStatus === 'online' ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-500' : 'bg-blue-600 shadow-blue-100 hover:bg-blue-500'}`}
                  >
                    {isConnecting ? <RefreshCcw size={20} className="animate-spin" /> : <Zap size={20} />}
                    {isConnecting ? 'Tentando Sincronizar...' : bridgeStatus === 'online' ? 'Reatualizar Dados Reais' : 'Conectar ao Agente Agora'}
                  </button>
                </div>
              </div>

              <div className="rounded-[2.5rem] border border-slate-200 bg-slate-900 p-10 text-white shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <div className="mb-8 flex items-center gap-4">
                    <div className="rounded-2xl bg-slate-800 p-4 border border-slate-700">
                      <Terminal size={32} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Manual de Importação</h3>
                      <p className="text-xs text-slate-400">Passos para ler seu banco .FDB local</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <Step num="1" title="Node.js Instalado" desc="Você precisa ter o Node.js no seu computador para rodar a ponte de comunicação." />
                    <Step num="2" title="Executar Bridge" desc="Abra o código 'bridge.js' que forneci e execute 'node bridge.js' no terminal." />
                    <Step num="3" title="Porta 3001" desc="Certifique-se que o Firewall não está bloqueando a porta 3001 no seu PC local." />
                  </div>

                  <div className="mt-10 rounded-2xl bg-slate-800/50 p-6 border border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Code size={16} className="text-blue-400" />
                      <span className="text-[10px] font-black uppercase text-slate-300">Status do Agente Local</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <p className="text-[11px] font-mono text-blue-300">Listening: localhost:3001</p>
                       <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${bridgeStatus === 'online' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                         {bridgeStatus === 'online' ? 'Sinal Forte' : 'Sem Resposta'}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/5 blur-[120px] -mb-40 -mr-40"></div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Step({ num, title, desc }: { num: string, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black border-2 border-blue-400/30">{num}</div>
      <div>
        <h4 className="text-sm font-black text-white uppercase tracking-tight">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 shadow-blue-200',
    emerald: 'bg-emerald-600 shadow-emerald-200',
    amber: 'bg-amber-600 shadow-amber-200',
    indigo: 'bg-indigo-600 shadow-indigo-200'
  };
  return (
    <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl group">
      <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg group-hover:scale-110 transition-all ${colorMap[color]}`}>
        {icon}
      </div>
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      <p className="text-2xl font-black tracking-tighter text-slate-800">{value}</p>
    </div>
  );
}
