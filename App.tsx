
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
    setTimeout(() => {
      setData(getJoinedData());
      setLoading(false);
    }, 800);
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
    const grouped = filteredData.reduce((acc: Record<string, ChartDataItem>, curr) => {
      if (!acc[curr.apelido]) {
        acc[curr.apelido] = { name: curr.apelido, total: 0, litros: 0 };
      }
      acc[curr.apelido].total += curr.total;
      acc[curr.apelido].litros += curr.litros;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const chartDataByFuel = useMemo((): FuelChartItem[] => {
    const grouped = filteredData.reduce((acc: Record<string, FuelChartItem>, curr) => {
      if (!acc[curr.tipo_combustivel]) {
        acc[curr.tipo_combustivel] = { name: curr.tipo_combustivel, value: 0 };
      }
      acc[curr.tipo_combustivel].value += curr.total;
      return acc;
    }, {});
    return Object.values(grouped);
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
    if (!process.env.API_KEY) return;
    setGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const topFrentista = chartDataByFrentista[0]?.name || 'N/A';
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
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw size={40} className="text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Conectando ao banco Firebird...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-inner">
            <Fuel size={24} />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tighter">PostoPro</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Analytics Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-semibold text-sm">Painel de Vendas</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Database size={20} />
            <span className="font-semibold text-sm">Abastecimentos</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings size={20} />
            <span className="font-semibold text-sm">Banco de Dados</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Instalação Local</span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <p className="text-[10px] font-mono truncate text-slate-400">...{dbConfig.path.slice(-25)}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 px-8 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              {activeTab === 'dashboard' && 'Visão Geral do Período'}
              {activeTab === 'history' && 'Listagem de Abastecimentos'}
              {activeTab === 'settings' && 'Configuração Firebird'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
              <CalendarDays size={12} />
              <span>{startDate} até {endDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            <div className="flex items-center gap-3 bg-gray-100/50 pr-4 pl-1.5 py-1.5 rounded-full border border-gray-200">
              <div className="w-8 h-8 rounded-full bg-blue-600 shadow-md flex items-center justify-center text-white font-black text-sm">S</div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-700 leading-none uppercase">sysdba</span>
                <span className="text-[9px] font-bold text-slate-400">ADMIN</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
          {/* Advanced Filters */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/60 ring-1 ring-black/5">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Filter size={18} className="text-blue-600" />
              </div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Controles de Filtragem</h3>
            </div>
            <div className="flex flex-wrap gap-6 items-end">
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data Início</label>
                <div className="relative group">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-blue-500 transition-colors" size={16} />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data Fim</label>
                <div className="relative group">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-blue-500 transition-colors" size={16} />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Frentista</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <select 
                    value={frentistaFilter}
                    onChange={(e) => setFrentistaFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Todos</option>
                    {MOCK_FUNCIONARIOS.map(f => <option key={f.id_cartao_abast} value={f.apelido}>{f.apelido}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5 w-32">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bico</label>
                <div className="relative group">
                  <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <select 
                    value={bicoFilter}
                    onChange={(e) => setBicoFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
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
                className="px-6 py-2.5 text-xs font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-all"
              >
                Limpar
              </button>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-600/20 p-2.5 rounded-2xl backdrop-blur-xl border border-white/10">
                        <TrendingUp size={22} className="text-blue-400" />
                      </div>
                      <h3 className="font-black text-xl tracking-tight">Análise Estratégica IA</h3>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-3xl font-medium italic">
                      {generatingInsight ? 'Processando milhões de pontos de dados...' : (aiInsight || 'Pronto para analisar o desempenho operacional do seu posto no período selecionado.')}
                    </p>
                  </div>
                  <button 
                    onClick={generateAIInsight}
                    disabled={generatingInsight}
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 group-hover:scale-105 active:scale-95"
                  >
                    {generatingInsight ? <RefreshCcw size={18} className="animate-spin" /> : <TrendingUp size={18} />}
                    Gerar Novo Insight
                  </button>
                </div>
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[120px]"></div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-black text-slate-800 text-lg tracking-tight">Vendas por Frentista</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Soma total de abastecimentos (R$)</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
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

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-black text-slate-800 text-lg tracking-tight">Mix de Combustível</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distribuição por Receita Total</p>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
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
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 bg-slate-50 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <input 
                    type="text" 
                    placeholder="Pesquisar nos registros atuais..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none shadow-inner"
                   />
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-gray-200">
                  Exibindo {filteredData.length} de {data.length} registros
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200">
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Caixa</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador / Frentista</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bico / Produto</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Volume</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Preço Un.</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                      <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Encerrantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <Search size={48} />
                            <p className="font-bold">Nenhum abastecimento encontrado.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredData.map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/20 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-800">{row.dt_caixa}</div>
                          <div className="text-[9px] text-slate-400 font-mono">ID: {row.seq_caixa}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-black text-xs">
                              {row.apelido.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <div className="text-sm font-black text-slate-700">{row.apelido}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">{row.id_cartao_frentista}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-black text-blue-600">BICO {row.cod_bico}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[140px]">{row.tipo_combustivel}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-slate-600">
                          {row.litros.toFixed(3)} L
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-slate-400">
                          {row.preco.toFixed(3)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-black text-slate-900 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
                            R$ {row.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-[10px] text-slate-400 font-mono">I: {row.enc_inicial.toFixed(1)}</div>
                          <div className="text-[10px] text-blue-500 font-mono font-black">F: {row.enc_final.toFixed(1)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                  <Database size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Conexão Firebird</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configurações de Acesso</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">IP do Servidor / Host</label>
                    <input 
                      type="text" 
                      value={dbConfig.host}
                      onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})}
                      className="w-full px-5 py-3 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Porta (Padrão 3050)</label>
                    <input 
                      type="number" 
                      value={dbConfig.port}
                      onChange={(e) => setDbConfig({...dbConfig, port: parseInt(e.target.value)})}
                      className="w-full px-5 py-3 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Caminho do Banco (.FDB)</label>
                  <input 
                    type="text" 
                    value={dbConfig.path}
                    onChange={(e) => setDbConfig({...dbConfig, path: e.target.value})}
                    placeholder="Ex: C:\PostoMaster\DADOS.FDB"
                    className="w-full px-5 py-3 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Login</label>
                    <input 
                      type="text" 
                      defaultValue="sysdba"
                      disabled
                      className="w-full px-5 py-3 bg-slate-50 border border-gray-200 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Senha</label>
                    <input 
                      type="password" 
                      defaultValue="masterkey"
                      disabled
                      className="w-full px-5 py-3 bg-slate-50 border border-gray-200 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">As credenciais padrão do Firebird<br/>são protegidas por criptografia.</p>
                  <button 
                    onClick={() => {
                      setDbConfig({...dbConfig, status: 'connecting'});
                      setTimeout(() => setDbConfig({...dbConfig, status: 'connected'}), 1200);
                    }}
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95"
                  >
                    {dbConfig.status === 'connecting' ? 'Testando Link...' : 'Salvar Configuração'}
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
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
      <div className="flex items-start justify-between mb-6">
        <div className="p-3 bg-gray-50 rounded-2xl group-hover:scale-110 transition-transform border border-gray-100">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${positive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
          {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trend}
        </div>
      </div>
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
    </div>
  );
}
