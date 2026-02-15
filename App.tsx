import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle
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
  const [dbConfig] = useState<DBConfig>({
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
        // Simulando delay de rede/processamento de banco
        await new Promise(resolve => setTimeout(resolve, 600));
        setData(getJoinedData());
      } catch (err) {
        setError('Erro ao carregar dados do Firebird. Verifique a conexão com o servidor.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = new Date(item.dt_caixa + 'T00:00:00');
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      
      const matchDate = itemDate >= start && itemDate <= end;
      const matchFrentista = !frentistaFilter || item.apelido === frentistaFilter;
      const matchBico = !bicoFilter || item.cod_bico === bicoFilter;
      
      return matchDate && matchFrentista && matchBico;
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
      if (!grouped[curr.apelido]) {
        grouped[curr.apelido] = { name: curr.apelido, total: 0, litros: 0 };
      }
      grouped[curr.apelido].total += curr.total;
      grouped[curr.apelido].litros += curr.litros;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const chartDataByFuel = useMemo((): FuelChartItem[] => {
    const grouped: Record<string, FuelChartItem> = {};
    filteredData.forEach(curr => {
      if (!grouped[curr.tipo_combustivel]) {
        grouped[curr.tipo_combustivel] = { name: curr.tipo_combustivel, value: 0 };
      }
      grouped[curr.tipo_combustivel].value += curr.total;
    });
    return Object.values(grouped);
  }, [filteredData]);

  const generateAIInsight = async () => {
    if (!process.env.API_KEY) {
      setAiInsight('Chave de API não configurada no ambiente.');
      return;
    }
    setGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const summary = `Dashboard Posto: Receita R$ ${stats.totalRevenue.toFixed(2)}, Volume ${stats.totalLiters.toFixed(2)}L em ${stats.fuelingCount} abastecimentos.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise estes dados de um posto de combustíveis e dê um conselho curto de gestão (max 2 frases): ${summary}`
      });
      
      setAiInsight(response.text || 'Sem recomendações disponíveis.');
    } catch (err) {
      setAiInsight('Falha na análise inteligente.');
    } finally {
      setGeneratingInsight(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Sequencial', 'Frentista', 'Bico', 'Combustivel', 'Preco', 'Litros', 'Total'];
    const rows = filteredData.map(d => [
      d.dt_caixa, d.seq_caixa, d.apelido, d.cod_bico, 
      d.tipo_combustivel, d.preco.toFixed(2), d.litros.toFixed(3), d.total.toFixed(2)
    ]);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_posto_${startDate}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCcw size={40} className="mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Acessando Firebird SQL...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h3 className="mb-2 text-xl font-bold text-slate-800">Erro Crítico</h3>
          <p className="text-slate-500">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white">Tentar Novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar - Estilo Profissional Dark */}
      <aside className="flex w-64 flex-col bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <div className="rounded-lg bg-blue-600 p-2">
            <Fuel size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black leading-none">FirebirdPro</h1>
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Dashboard v2.0</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <SidebarLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Início" />
          <SidebarLink active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Database size={20} />} label="Abastecimentos" />
          <SidebarLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Configuração" />
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="rounded-xl bg-slate-800/50 p-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-300 uppercase">Banco Online</span>
            </div>
            <p className="truncate text-[9px] text-slate-500">{dbConfig.host}:{dbConfig.port}</p>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-black text-slate-800">
              {activeTab === 'dashboard' ? 'Visão Geral Operacional' : activeTab === 'history' ? 'Logs do Sistema' : 'Configurações'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
              <CalendarDays size={12} />
              <span>{startDate} até {endDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={exportToCSV} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200">
              <Download size={14} />
              Exportar CSV
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-600">DB</div>
              <span className="text-[10px] font-black uppercase text-slate-500">Master</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-8">
          {/* Filtros Ativos */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-6">
              <FilterGroup label="Data Inicial" value={startDate} onChange={setStartDate} type="date" />
              <FilterGroup label="Data Final" value={endDate} onChange={setEndDate} type="date" />
              <div className="flex-1 min-w-[150px]">
                <label className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">Frentista</label>
                <select value={frentistaFilter} onChange={(e) => setFrentistaFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Todos os Operadores</option>
                  {MOCK_FUNCIONARIOS.map(f => <option key={f.id_cartao_abast} value={f.apelido}>{f.apelido}</option>)}
                </select>
              </div>
              <div className="w-32">
                <label className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">Bico</label>
                <select value={bicoFilter} onChange={(e) => setBicoFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Todos</option>
                  {['01', '02', '03', '04', '05', '06'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Receita Total" value={`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={<TrendingUp />} color="blue" />
                <MetricCard title="Volume de Vendas" value={`${stats.totalLiters.toFixed(2)} L`} icon={<Fuel />} color="emerald" />
                <MetricCard title="Ticket Médio" value={`R$ ${(stats.totalRevenue / (stats.fuelingCount || 1)).toFixed(2)}`} icon={<ArrowUpRight />} color="amber" />
                <MetricCard title="Abastecimentos" value={stats.fuelingCount} icon={<RefreshCcw />} color="indigo" />
              </div>

              {/* Seção AI */}
              <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl">
                <div className="relative z-10 flex flex-col items-center justify-between gap-8 lg:flex-row">
                  <div className="flex-1">
                    <h3 className="mb-2 text-2xl font-black">Análise por Inteligência Artificial</h3>
                    <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
                      {generatingInsight ? 'Processando tendências do Firebird...' : (aiInsight || 'O Gemini AI analisará as vendas atuais para oferecer sugestões de otimização operacional.')}
                    </p>
                  </div>
                  <button 
                    onClick={generateAIInsight}
                    disabled={generatingInsight}
                    className="flex items-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black transition-all hover:bg-blue-500 disabled:opacity-50 shadow-xl shadow-blue-500/20"
                  >
                    {generatingInsight ? <RefreshCcw size={18} className="animate-spin" /> : <TrendingUp size={18} />}
                    Gerar Análise
                  </button>
                </div>
                <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Desempenho por Frentista</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataByFrentista} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11, fontWeight: 700}} width={80} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Mix de Produtos (R$)</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartDataByFuel} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                          {chartDataByFuel.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                        <Legend verticalAlign="bottom" align="center" iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Transação / Data</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Operador</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Bico / Produto</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Volume (L)</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Vlr Total</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="text-xs font-black text-slate-800">{row.dt_caixa}</div>
                          <div className="text-[10px] font-mono text-slate-400">#SEQ_{row.seq_caixa}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-black text-slate-700">{row.apelido}</div>
                          <div className="text-[10px] font-bold text-slate-400">{row.id_cartao_frentista}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] font-black text-blue-600 uppercase">BICO {row.cod_bico}</div>
                          <div className="text-[10px] font-medium text-slate-500">{row.tipo_combustivel}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-600">{row.litros.toFixed(3)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">R$ {row.total.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center justify-center gap-1.5">
                             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                             <span className="text-[9px] font-black uppercase text-slate-400">Efivado</span>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm">
              <h3 className="mb-8 flex items-center gap-3 text-xl font-black text-slate-800">
                <Database className="text-blue-600" />
                Conexão Firebird
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase text-slate-400">Caminho do Banco (.FDB)</label>
                  <input type="text" value={dbConfig.path} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase text-slate-400">Servidor</label>
                    <input type="text" value={dbConfig.host} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase text-slate-400">Porta SQL</label>
                    <input type="text" value={dbConfig.port} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-500 outline-none" />
                  </div>
                </div>
                <div className="pt-4">
                   <p className="text-[10px] leading-relaxed text-slate-400">
                     * Os parâmetros de conexão são lidos diretamente do arquivo de configuração local do PDV. Alterações manuais podem comprometer a integridade do banco de dados GDB/FDB.
                   </p>
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
    <button 
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
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
    <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl group cursor-default">
      <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform ${colorMap[color]}`}>
        {icon}
      </div>
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      <p className="text-2xl font-black tracking-tighter text-slate-800">{value}</p>
    </div>
  );
}

function FilterGroup({ label, value, onChange, type }: { label: string, value: string, onChange: (v: string) => void, type: string }) {
  return (
    <div className="flex-1 min-w-[140px]">
      <label className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" 
      />
    </div>
  );
}