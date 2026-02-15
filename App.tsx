import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Database, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Fuel, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCcw,
  Download,
  CalendarDays
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
  const [dbConfig, setDbConfig] = useState<DBConfig>({
    host: 'localhost',
    path: 'C:\\PostoMaster\\BD\\DADOS.FDB',
    port: 3050,
    status: 'connected'
  });

  // Filtros Avançados
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
    let isMounted = true;
    setLoading(true);
    
    const timer = setTimeout(() => {
      if (isMounted) {
        setData(getJoinedData());
        setLoading(false);
      }
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = new Date(item.dt_caixa + 'T00:00:00');
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      
      const matchDate = (!start || itemDate >= start) && (!end || itemDate <= end);
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
    const initialAcc: Record<string, ChartDataItem> = {};
    const grouped = filteredData.reduce((acc, curr) => {
      if (!acc[curr.apelido]) {
        acc[curr.apelido] = { name: curr.apelido, total: 0, litros: 0 };
      }
      acc[curr.apelido].total += curr.total;
      acc[curr.apelido].litros += curr.litros;
      return acc;
    }, initialAcc);
    return (Object.values(grouped) as ChartDataItem[]).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const chartDataByFuel = useMemo((): FuelChartItem[] => {
    const initialAcc: Record<string, FuelChartItem> = {};
    const grouped = filteredData.reduce((acc, curr) => {
      if (!acc[curr.tipo_combustivel]) {
        acc[curr.tipo_combustivel] = { name: curr.tipo_combustivel, value: 0 };
      }
      acc[curr.tipo_combustivel].value += curr.total;
      return acc;
    }, initialAcc);
    return Object.values(grouped) as FuelChartItem[];
  }, [filteredData]);

  const exportToCSV = () => {
    const headers = [
      'Data Caixa', 'Sequencial', 'Frentista', 'ID Cartao', 
      'Bico', 'Preco', 'Litros', 'Total', 'Enc. Inicial', 'Enc. Final'
    ];
    
    const rows = filteredData.map(d => [
      d.dt_caixa,
      d.seq_caixa,
      d.apelido,
      d.id_cartao_frentista,
      d.cod_bico,
      d.preco.toFixed(2),
      d.litros.toFixed(3),
      d.total.toFixed(2),
      d.enc_inicial.toFixed(1),
      d.enc_final.toFixed(1)
    ].map(val => (typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val)));

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `vendas_posto_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAIInsight = async () => {
    setGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const topFrentista = chartDataByFrentista[0]?.name || 'N/A';
      const summary = `Dashboard Posto: Receita R$ ${stats.totalRevenue.toFixed(2)}, Volume ${stats.totalLiters.toFixed(2)}L, Destaque ${topFrentista}.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise estes dados de um posto de combustíveis e dê um conselho curto e prático de gestão: ${summary}`
      });
      
      setAiInsight(response.text || 'Sem recomendações no momento.');
    } catch (err) {
      console.error(err);
      setAiInsight('Falha na conexão com a IA.');
    } finally {
      setGeneratingInsight(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw size={48} className="animate-spin text-blue-600" />
          <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Conectando ao Firebird...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <div className="rounded-lg bg-blue-600 p-2 shadow-inner">
            <Fuel size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter">FirebirdPro</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Analytics Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-sm font-semibold">Painel Geral</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Database size={20} />
            <span className="text-sm font-semibold">Abastecimentos</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings size={20} />
            <span className="text-sm font-semibold">Configurações</span>
          </button>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="space-y-2 rounded-xl bg-slate-800/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500">Status DB</span>
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
            </div>
            <p className="truncate font-mono text-[9px] text-slate-400">{dbConfig.path}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-800">
              {activeTab === 'dashboard' && 'Visão Operacional'}
              {activeTab === 'history' && 'Logs de Transação'}
              {activeTab === 'settings' && 'Conectividade Firebird'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <CalendarDays size={12} />
              <span>{startDate} — {endDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95"
            >
              <Download size={14} />
              CSV
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 pr-4 pl-1.5 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">S</div>
              <span className="text-[10px] font-black uppercase text-slate-600">sysdba</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-8">
          {/* Global Filter Bar */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex-1 space-y-1.5 min-w-[140px]">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Data Inicial</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="flex-1 space-y-1.5 min-w-[140px]">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Data Final</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="flex-1 space-y-1.5 min-w-[140px]">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Frentista</label>
                <select value={frentistaFilter} onChange={(e) => setFrentistaFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Todos</option>
                  {MOCK_FUNCIONARIOS.map(f => <option key={f.id_cartao_abast} value={f.apelido}>{f.apelido}</option>)}
                </select>
              </div>
              <div className="w-32 space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Bico</label>
                <select value={bicoFilter} onChange={(e) => setBicoFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Todos</option>
                  {['01', '02', '03', '04', '05', '06'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Receita Total" value={`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={<TrendingUp />} color="blue" />
                <StatCard title="Volume (Litros)" value={`${stats.totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} L`} icon={<Fuel />} color="emerald" />
                <StatCard title="Ticket Médio" value={`R$ ${(stats.totalRevenue / (stats.fuelingCount || 1)).toFixed(2)}`} icon={<ArrowUpRight />} color="amber" />
                <StatCard title="Abastecimentos" value={stats.fuelingCount} icon={<RefreshCcw />} color="indigo" />
              </div>

              {/* AI Insight */}
              <div className="group relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl">
                <div className="relative z-10 flex flex-col items-center justify-between gap-8 lg:flex-row">
                  <div className="flex-1">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-2xl bg-blue-600 p-3 shadow-lg">
                        <TrendingUp size={24} className="text-white" />
                      </div>
                      <h3 className="text-2xl font-black tracking-tight">Conselheiro IA</h3>
                    </div>
                    <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-400 italic">
                      {generatingInsight ? 'Analisando tendências e métricas...' : (aiInsight || 'Clique no botão ao lado para analisar o desempenho do posto via Gemini AI.')}
                    </p>
                  </div>
                  <button 
                    onClick={generateAIInsight}
                    disabled={generatingInsight}
                    className="flex items-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black transition-all hover:bg-blue-500 disabled:opacity-50"
                  >
                    {generatingInsight ? <RefreshCcw size={18} className="animate-spin" /> : <TrendingUp size={18} />}
                    Gerar Análise
                  </button>
                </div>
                <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl"></div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Vendas por Frentista</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataByFrentista} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#1e293b', fontSize: 11, fontWeight: 700}} width={80} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-6 text-lg font-black text-slate-800">Mix de Combustível</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartDataByFuel} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                          {chartDataByFuel.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                        <Legend verticalAlign="bottom" height={36} />
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
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">ID / Data</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Frentista</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Bico / Combustível</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400">Volume</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400">Valor Total</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Encerrante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                           <div className="font-bold text-slate-800">{row.dt_caixa}</div>
                           <div className="text-[10px] text-slate-400">Seq: {row.seq_caixa}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-black text-slate-700">{row.apelido}</div>
                          <div className="text-[10px] text-slate-400 font-bold">{row.id_cartao_frentista}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-black text-blue-600 uppercase">BICO {row.cod_bico}</div>
                          <div className="text-[10px] font-medium text-slate-400">{row.tipo_combustivel}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-xs font-bold">{row.litros.toFixed(3)} L</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">R$ {row.total.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-[10px] font-mono text-slate-400">F: {row.enc_final.toFixed(2)}</div>
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
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-2xl bg-blue-600 p-3">
                  <Database size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Conexão Firebird</h3>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Caminho do Banco (.FDB)</label>
                  <input type="text" value={dbConfig.path} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-500 cursor-not-allowed" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Servidor</label>
                    <input type="text" value={dbConfig.host} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-500 cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Porta</label>
                    <input type="text" value={dbConfig.port} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-500 cursor-not-allowed" />
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

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 shadow-blue-200',
    emerald: 'bg-emerald-600 shadow-emerald-200',
    amber: 'bg-amber-600 shadow-amber-200',
    indigo: 'bg-indigo-600 shadow-indigo-200'
  };
  
  return (
    <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform ${colorMap[color]}">
        {icon}
      </div>
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      <p className="text-2xl font-black tracking-tighter text-slate-800">{value}</p>
    </div>
  );
}