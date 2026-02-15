
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
  LogOut,
  ChevronRight,
  Info,
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

// Polyfill básico para process.env caso rode fora de ambientes que o injetam automaticamente
// Isso evita erros de "process is not defined" em navegadores padrão
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} };
}

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
    setLoading(true);
    const timer = setTimeout(() => {
      setData(getJoinedData());
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
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

  // Fix: Explicitly type the initial value of reduce and cast Object.values to avoid 'unknown' and 'total' access errors
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
    // Cast to ChartDataItem[] to ensure correct typing for .sort() and final result
    return (Object.values(grouped) as ChartDataItem[]).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  // Fix: Explicitly type the initial value of reduce and cast Object.values to avoid 'unknown' errors
  const chartDataByFuel = useMemo((): FuelChartItem[] => {
    const initialAcc: Record<string, FuelChartItem> = {};
    const grouped = filteredData.reduce((acc, curr) => {
      if (!acc[curr.tipo_combustivel]) {
        acc[curr.tipo_combustivel] = { name: curr.tipo_combustivel, value: 0 };
      }
      acc[curr.tipo_combustivel].value += curr.total;
      return acc;
    }, initialAcc);
    // Cast to FuelChartItem[]
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
      // Fix: Initialize GoogleGenAI with process.env.API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const topFrentista = (chartDataByFrentista[0] as ChartDataItem)?.name || 'N/A';
      const summary = `Dados: Faturamento R$ ${stats.totalRevenue.toFixed(2)}, Volume ${stats.totalLiters.toFixed(2)}L, Destaque: ${topFrentista}.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise estes dados de um posto e dê um conselho de gestão curto: ${summary}`
      });
      
      setAiInsight(response.text || 'Sem recomendações no momento.');
    } catch (err) {
      console.error(err);
      setAiInsight('Erro ao conectar com a IA.');
    } finally {
      setGeneratingInsight(false);
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw size={40} className="animate-spin text-blue-600" />
          <p className="font-medium text-gray-500">Conectando ao banco Firebird...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-slate-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <div className="rounded-lg bg-blue-600 p-2 shadow-inner">
            <Fuel size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter">PostoPro</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Analytics Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-sm font-semibold">Painel de Vendas</span>
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
            <span className="text-sm font-semibold">Banco de Dados</span>
          </button>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="space-y-2 rounded-xl bg-slate-800/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500">Instalação Local</span>
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
            </div>
            <p className="truncate font-mono text-[10px] text-slate-400">...{dbConfig.path.slice(-25)}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-800">
              {activeTab === 'dashboard' && 'Visão Geral do Período'}
              {activeTab === 'history' && 'Listagem de Abastecimentos'}
              {activeTab === 'settings' && 'Configuração Firebird'}
            </h2>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
              <CalendarDays size={12} />
              <span>{startDate} até {endDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <div className="mx-2 h-8 w-px bg-gray-200"></div>
            <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-gray-100 pr-4 pl-1.5 py-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white shadow-md">S</div>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase leading-none text-slate-700">sysdba</span>
                <span className="text-[9px] font-bold text-slate-400">ADMIN</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-8 pb-16">
          {/* Advanced Filters */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Filter size={18} className="text-blue-600" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Controles de Filtragem</h3>
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Data Início</label>
                <div className="group relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-hover:text-blue-500" size={16} />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm font-bold outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Data Fim</label>
                <div className="group relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-hover:text-blue-500" size={16} />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm font-bold outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div className="min-w-[160px] flex-1 space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Frentista</label>
                <div className="group relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <select 
                    value={frentistaFilter}
                    onChange={(e) => setFrentistaFilter(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Todos</option>
                    {MOCK_FUNCIONARIOS.map(f => <option key={f.id_cartao_abast} value={f.apelido}>{f.apelido}</option>)}
                  </select>
                </div>
              </div>
              <div className="w-32 space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Bico</label>
                <div className="group relative">
                  <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <select 
                    value={bicoFilter}
                    onChange={(e) => setBicoFilter(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Todos</option>
                    {['01', '02', '03', '04', '05', '06'].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <button 
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setFrentistaFilter('');
                  setBicoFilter('');
                }}
                className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 transition-all hover:text-red-500"
              >
                Limpar
              </button>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                  title="Receita Líquida" 
                  value={`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                  icon={<TrendingUp className="text-blue-600" />}
                  trend="+8.2%"
                  positive={true}
                />
                <StatCard 
                  title="Volume Total" 
                  value={`${stats.totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L`} 
                  icon={<Fuel className="text-emerald-600" />}
                  trend="+14.1%"
                  positive={true}
                />
                <StatCard 
                  title="Ticket Médio" 
                  value={`R$ ${(stats.totalRevenue / (stats.fuelingCount || 1)).toFixed(2)}`} 
                  icon={<ArrowUpRight className="text-amber-600" />}
                  trend="-1.5%"
                  positive={false}
                />
                <StatCard 
                  title="Qtd. Abastecimentos" 
                  value={stats.fuelingCount} 
                  icon={<RefreshCcw className="text-indigo-600" />}
                  trend="Estável"
                  positive={true}
                />
              </div>

              {/* AI Insight Section */}
              <div className="group relative overflow-hidden rounded-[2rem] bg-slate-900 p-8 text-white shadow-2xl">
                <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="rounded-2xl border border-white/10 bg-blue-600 p-2.5">
                        <TrendingUp size={22} className="text-blue-400" />
                      </div>
                      <h3 className="text-xl font-black tracking-tight">Análise Estratégica IA</h3>
                    </div>
                    <p className="max-w-3xl text-sm font-medium italic leading-relaxed text-slate-400">
                      {generatingInsight ? 'Processando milhões de pontos de dados...' : (aiInsight || 'Pronto para analisar o desempenho operacional do seu posto no período selecionado.')}
                    </p>
                  </div>
                  <button 
                    onClick={generateAIInsight}
                    disabled={generatingInsight}
                    className="flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black text-white shadow-xl transition-all hover:bg-blue-500 disabled:opacity-50 active:scale-95"
                  >
                    {generatingInsight ? <RefreshCcw size={18} className="animate-spin" /> : <TrendingUp size={18} />}
                    Gerar Insight
                  </button>
                </div>
                <div className="absolute top-0 right-0 h-[400px] w-[400px] -translate-y-1/2 translate-x-1/2 rounded-full bg-blue-600/10 blur-xl"></div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="flex flex-col rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm">
                  <div className="mb-8 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-800">Vendas por Frentista</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Soma total de abastecimentos (R$)</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                      <User size={18} className="text-slate-400" />
                    </div>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataByFrentista} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#1e293b', fontSize: 11, fontWeight: 800}} 
                        />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontWeight: 'bold'}}
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                        />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm">
                  <div className="mb-8 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-800">Mix de Combustível</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Distribuição por Receita Total</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5">
                      <Fuel size={18} className="text-emerald-500" />
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataByFuel}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={10}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartDataByFuel.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontWeight: 'bold'}}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between border-b border-gray-200 bg-slate-50 p-5">
                <div className="relative max-w-md flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <input 
                    type="text" 
                    placeholder="Pesquisar nos registros atuais..."
                    className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-xs font-bold outline-none shadow-inner focus:ring-2 focus:ring-blue-500/20"
                   />
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Exibindo {filteredData.length} registros
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-slate-50">
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Data / Caixa</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Frentista</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Bico / Produto</th>
                      <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Volume</th>
                      <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Preço Un.</th>
                      <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Encerrantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                          <p className="font-bold opacity-30">Nenhum abastecimento encontrado.</p>
                        </td>
                      </tr>
                    ) : filteredData.map((row, i) => (
                      <tr key={i} className="group transition-colors hover:bg-blue-50/20">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-bold text-slate-800">{row.dt_caixa}</div>
                          <div className="font-mono text-[9px] text-slate-400">ID: {row.seq_caixa}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs font-black text-slate-600 uppercase">
                              {row.apelido.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <div className="text-sm font-black text-slate-700">{row.apelido}</div>
                              <div className="text-[9px] font-bold uppercase text-slate-400">{row.id_cartao_frentista}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-black text-blue-600">BICO {row.cod_bico}</div>
                          <div className="max-w-[140px] truncate text-[9px] font-bold uppercase text-slate-400">{row.tipo_combustivel}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right font-mono text-sm font-bold text-slate-600">
                          {row.litros.toFixed(3)} L
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right font-mono text-sm text-slate-400">
                          {row.preco.toFixed(3)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-black text-slate-900">
                            R$ {row.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="font-mono text-[10px] text-slate-400">I: {row.enc_inicial.toFixed(1)}</div>
                          <div className="font-mono text-[10px] font-black text-blue-500">F: {row.enc_final.toFixed(1)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl rounded-[2.5rem] border border-gray-200 bg-white p-10 shadow-sm">
              <div className="mb-8 flex items-center gap-4">
                <div className="rounded-2xl bg-blue-600 p-3 shadow-lg shadow-blue-200">
                  <Database size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Conexão Firebird</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Acesso Local</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Host</label>
                    <input 
                      type="text" 
                      value={dbConfig.host}
                      onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})}
                      className="w-full rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Porta</label>
                    <input 
                      type="number" 
                      value={dbConfig.port}
                      onChange={(e) => setDbConfig({...dbConfig, port: parseInt(e.target.value)})}
                      className="w-full rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Caminho do Banco (.FDB)</label>
                  <input 
                    type="text" 
                    value={dbConfig.path}
                    onChange={(e) => setDbConfig({...dbConfig, path: e.target.value})}
                    placeholder="Ex: C:\PostoMaster\DADOS.FDB"
                    className="w-full rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Login</label>
                    <input type="text" defaultValue="sysdba" disabled className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-400" />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Senha</label>
                    <input type="password" defaultValue="masterkey" disabled className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-8">
                  <p className="text-[10px] font-bold uppercase leading-relaxed text-slate-400">Credenciais protegidas.</p>
                  <button 
                    onClick={() => {
                      setDbConfig({...dbConfig, status: 'connecting'});
                      setTimeout(() => setDbConfig({...dbConfig, status: 'connected'}), 1000);
                    }}
                    className="rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black text-white shadow-xl transition-all hover:bg-blue-700 active:scale-95"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, trend, positive }: { title: string, value: string | number, icon: React.ReactNode, trend: string, positive: boolean }) {
  return (
    <div className="group rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-xl">
      <div className="mb-6 flex items-start justify-between">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 transition-transform group-hover:scale-110">
          {icon}
        </div>
        <div className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-tighter ${positive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
          {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trend}
        </div>
      </div>
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      <p className="text-2xl font-black tracking-tight text-slate-800">{value}</p>
    </div>
  );
}
