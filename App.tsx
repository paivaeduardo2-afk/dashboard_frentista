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
  CheckCircle2
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
import { getJoinedData, MOCK_FUNCIONARIOS } from './services/mockData';
import { JoinData, DBConfig, DashboardStats, ChartDataItem, FuelChartItem } from './types';
import { GoogleGenAI } from "@google/genai";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [data, setData] = useState<JoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dbConfig, setDbConfig] = useState<DBConfig>({
    host: 'localhost',
    path: 'C:\\PostoMaster\\BD\\DADOS.FDB',
    port: 3050,
    status: 'connected'
  });

  // Filtros
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [frentistaFilter, setFrentistaFilter] = useState('');
  const [bicoFilter, setBicoFilter] = useState('');

  // AI Insights
  const [aiInsight, setAiInsight] = useState<string>('');
  const [generatingInsight, setGeneratingInsight] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        setData(getJoinedData());
      } catch (err) {
        setError('Erro ao carregar dados do Firebird.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [dbConfig.path]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = new Date(item.dt_caixa + 'T00:00:00');
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      return itemDate >= start && itemDate <= end && 
             (!frentistaFilter || item.apelido === frentistaFilter) && 
             (!bicoFilter || item.cod_bico === bicoFilter);
    });
  }, [data, startDate, endDate, frentistaFilter, bicoFilter]);

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
      if (!grouped[curr.apelido]) grouped[curr.apelido] = { name: curr.apelido, total: 0, litros: 0 };
      grouped[curr.apelido].total += curr.total;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const chartDataByFuel = useMemo((): FuelChartItem[] => {
    const grouped: Record<string, FuelChartItem> = {};
    filteredData.forEach(curr => {
      if (!grouped[curr.tipo_combustivel]) grouped[curr.tipo_combustivel] = { name: curr.tipo_combustivel, value: 0 };
      grouped[curr.tipo_combustivel].value += curr.total;
    });
    return Object.values(grouped);
  }, [filteredData]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Como navegadores não fornecem o caminho real C:\ por segurança, 
      // simulamos a atualização do path para fins de visualização do dashboard.
      setDbConfig(prev => ({
        ...prev,
        path: `C:\\...\\${file.name}`,
        status: 'connecting'
      }));
      
      setLoading(true);
      setTimeout(() => {
        setDbConfig(prev => ({ ...prev, status: 'connected' }));
        setLoading(false);
      }, 1000);
    }
  };

  const generateAIInsight = async () => {
    if (!process.env.API_KEY) return;
    setGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const summary = `Receita R$ ${stats.totalRevenue.toFixed(2)}, Volume ${stats.totalLiters.toFixed(2)}L.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise rapidamente estes dados de um posto de combustíveis: ${summary}`
      });
      setAiInsight(response.text || '');
    } catch (err) {
      setAiInsight('Falha na IA.');
    } finally {
      setGeneratingInsight(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCcw size={40} className="mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sincronizando Firebird...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <div className="rounded-lg bg-blue-600 p-2"><Fuel size={24} /></div>
          <div>
            <h1 className="text-lg font-black leading-none tracking-tight">FirebirdPro</h1>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Local DB Active</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <SidebarLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <SidebarLink active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Database size={20} />} label="Transações" />
          <SidebarLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Configurar Local" />
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="rounded-xl bg-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-2 w-2 rounded-full ${dbConfig.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
              <span className="text-[10px] font-bold text-slate-300 uppercase">Local Engine</span>
            </div>
            <p className="truncate text-[9px] text-slate-500 font-mono">{dbConfig.path}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur-md">
          <h2 className="text-xl font-black text-slate-800">
            {activeTab === 'dashboard' ? 'Métricas em Tempo Real' : activeTab === 'history' ? 'Histórico Firebird' : 'Localizar Base de Dados'}
          </h2>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <CalendarDays size={14} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase text-slate-600">{startDate} — {endDate}</span>
             </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Vendas Brutas" value={`R$ ${stats.totalRevenue.toLocaleString()}`} icon={<TrendingUp />} color="blue" />
                <MetricCard title="Volume Total" value={`${stats.totalLiters.toFixed(2)} L`} icon={<Fuel />} color="emerald" />
                <MetricCard title="Ticket Médio" value={`R$ ${(stats.totalRevenue / (stats.fuelingCount || 1)).toFixed(2)}`} icon={<ArrowUpRight />} color="amber" />
                <MetricCard title="Abastecimentos" value={stats.fuelingCount} icon={<RefreshCcw />} color="indigo" />
              </div>

              {/* AI Insight Box */}
              <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-xl">
                 <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex-1">
                       <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={18} className="text-blue-400" />
                          <h3 className="text-lg font-black uppercase tracking-wide">Análise de Gestão</h3>
                       </div>
                       <p className="text-sm text-slate-400 font-medium">
                          {generatingInsight ? 'Analisando seu banco Firebird local...' : (aiInsight || 'Clique para gerar um insight baseado nos dados locais.')}
                       </p>
                    </div>
                    <button onClick={generateAIInsight} disabled={generatingInsight} className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase transition-all hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                       {generatingInsight ? 'Gerando...' : 'Analisar agora'}
                    </button>
                 </div>
                 <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-600/10 to-transparent"></div>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Ranking por Operador</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataByFrentista} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11, fontWeight: 700}} width={80} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Participação de Combustíveis</h3>
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
                      <input type="text" placeholder="Pesquisar transação..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                   </div>
                   <button className="flex items-center gap-2 text-xs font-black uppercase text-blue-600">
                      <Download size={16} /> Exportar Logs
                   </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Data/Hora</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Frentista</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Bico</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400">Litros</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400">Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.slice(0, 15).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-800">{row.dt_caixa}</td>
                        <td className="px-6 py-4 text-xs font-black text-slate-700">{row.apelido}</td>
                        <td className="px-6 py-4"><span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600 uppercase">Bico {row.cod_bico}</span></td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-bold">{row.litros.toFixed(3)}</td>
                        <td className="px-6 py-4 text-right text-xs font-black text-blue-700">R$ {row.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-8">
              <div className="rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm">
                <div className="mb-10 flex items-center gap-4">
                  <div className="rounded-2xl bg-blue-600 p-4 shadow-xl shadow-blue-500/20 text-white">
                    <FolderOpen size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Conectar Banco de Dados Local</h3>
                    <p className="text-sm font-medium text-slate-400">Localize o arquivo .FDB ou .GDB no seu computador para sincronizar.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="group relative">
                    <label className="mb-2 block text-[10px] font-black uppercase text-slate-400 ml-1">Caminho da Base de Dados Firebird</label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          value={dbConfig.path} 
                          onChange={(e) => setDbConfig({...dbConfig, path: e.target.value})}
                          placeholder="Ex: C:\PostoMaster\BD\DADOS.FDB" 
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-xs font-bold outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" 
                        />
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-xs font-black uppercase text-white transition-all hover:bg-slate-800 active:scale-95 shadow-lg"
                      >
                        <FolderOpen size={18} />
                        Procurar
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".fdb,.gdb"
                        onChange={handleFileSelect}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Endereço do Servidor (Host)</label>
                      <input type="text" value={dbConfig.host} onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 focus:ring-4" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Porta TCP/IP</label>
                      <input type="number" value={dbConfig.port} onChange={(e) => setDbConfig({...dbConfig, port: parseInt(e.target.value)})} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 focus:ring-4" />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-blue-50/50 p-6 border border-blue-100 flex items-start gap-4">
                     <AlertCircle className="text-blue-600 mt-1" size={20} />
                     <div className="space-y-1">
                        <h4 className="text-xs font-black text-blue-900 uppercase">Instruções de Conexão</h4>
                        <p className="text-[11px] text-blue-700 leading-relaxed">
                          Para ler dados diretamente do banco de dados local, certifique-se de que o serviço <strong>Firebird Server</strong> está rodando e que as permissões de leitura do arquivo .FDB estão liberadas para o usuário do sistema.
                        </p>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
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
      <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg group-hover:rotate-12 transition-all ${colorMap[color]}`}>
        {icon}
      </div>
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      <p className="text-2xl font-black tracking-tighter text-slate-800">{value}</p>
    </div>
  );
}