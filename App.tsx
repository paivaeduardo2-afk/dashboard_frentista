
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
import { JoinData, DBConfig, DashboardStats } from './types';
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

  // Filters
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
    // Simulating initial fetch
    setTimeout(() => {
      setData(getJoinedData());
      setLoading(false);
    }, 1000);
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = new Date(item.dt_caixa);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
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

  // Fix: Explicitly type the result of chartDataByFrentista to avoid 'unknown' element type errors
  const chartDataByFrentista = useMemo(() => {
    const grouped = filteredData.reduce((acc: Record<string, any>, curr) => {
      if (!acc[curr.apelido]) acc[curr.apelido] = { name: curr.apelido, total: 0, litros: 0 };
      acc[curr.apelido].total += curr.total;
      acc[curr.apelido].litros += curr.litros;
      return acc;
    }, {} as Record<string, any>);
    return Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
  }, [filteredData]);

  // Fix: Explicitly type the result of chartDataByFuel for consistency
  const chartDataByFuel = useMemo(() => {
    const grouped = filteredData.reduce((acc: Record<string, any>, curr) => {
      if (!acc[curr.tipo_combustivel]) acc[curr.tipo_combustivel] = { name: curr.tipo_combustivel, value: 0 };
      acc[curr.tipo_combustivel].value += curr.total;
      return acc;
    }, {} as Record<string, any>);
    return Object.values(grouped);
  }, [filteredData]);

  const exportToCSV = () => {
    const headers = [
      'dt_caixa', 'seq_caixa', 'apelido', 'id_cartao_frentista', 
      'cod_bico', 'preco', 'litros', 'total', 'enc_inicial', 'enc_final'
    ];
    
    const rows = filteredData.map(d => [
      d.dt_caixa,
      d.seq_caixa,
      d.apelido,
      d.id_cartao_frentista,
      d.cod_bico,
      d.preco,
      d.litros,
      d.total,
      d.enc_inicial,
      d.enc_final
    ].map(val => (typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val)));

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `vendas_frentistas_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAIInsight = async () => {
    setGeneratingInsight(true);
    try {
      // Fix: Use process.env.API_KEY directly in the named parameter object as per @google/genai rules
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Fix: Explicitly cast to any to resolve "Property 'name' does not exist on type 'unknown'" error on line 152
      const topFrentista = (chartDataByFrentista[0] as any)?.name || 'N/A';
      const summary = `Total faturado: ${stats.totalRevenue.toFixed(2)}, Litros: ${stats.totalLiters.toFixed(2)}, Melhor frentista: ${topFrentista}. Período: ${startDate} a ${endDate}.`;
      const prompt = `Como um analista financeiro de postos de combustíveis, analise estes dados e sugira uma ação prática (em português, max 3 frases): ${summary}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      // Fix: Use response.text property (not a function call) to get the generated text
      setAiInsight(response.text || 'Nenhuma percepção disponível no momento.');
    } catch (err) {
      setAiInsight('Ocorreu um erro ao gerar os insights. Verifique a conexão.');
    } finally {
      setGeneratingInsight(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Fuel size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">PostoPro</h1>
            <p className="text-xs text-slate-400">Firebird Edition</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Database size={20} />
            <span className="font-medium">Abastecimentos</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings size={20} />
            <span className="font-medium">Configurações</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status do Banco</span>
              <div className={`w-2 h-2 rounded-full ${dbConfig.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            </div>
            <p className="text-xs font-mono truncate text-slate-300">{dbConfig.path}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'history' && 'Registros de Abastecimento'}
              {activeTab === 'settings' && 'Configurações Firebird'}
            </h2>
            <p className="text-sm text-gray-500">
              {startDate} — {endDate} | {filteredData.length} registros
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Download size={18} />
              Exportar CSV
            </button>
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">S</div>
              <span className="text-sm font-medium text-gray-700">sysdba</span>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {activeTab === 'dashboard' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Faturamento Total" 
                  value={`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                  icon={<TrendingUp className="text-blue-600" />}
                  trend="+12.5%"
                  positive={true}
                />
                <StatCard 
                  title="Litros Vendidos" 
                  value={`${stats.totalLiters.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L`} 
                  icon={<Fuel className="text-emerald-600" />}
                  trend="+5.2%"
                  positive={true}
                />
                <StatCard 
                  title="Ticket Médio" 
                  value={`R$ ${(stats.totalRevenue / (stats.fuelingCount || 1)).toFixed(2)}`} 
                  icon={<TrendingUp className="text-amber-600" />}
                  trend="-2.1%"
                  positive={false}
                />
                <StatCard 
                  title="Abastecimentos" 
                  value={stats.fuelingCount} 
                  icon={<ChevronRight className="text-purple-600" />}
                  trend="Consistente"
                  positive={true}
                />
              </div>

              {/* Advanced Filter Component */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Filter size={18} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Filtros Avançados</h3>
                </div>
                <div className="flex flex-wrap gap-6 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Período de Início</label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-44"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Período de Fim</label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-44"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Frentista</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <select 
                        value={frentistaFilter}
                        onChange={(e) => setFrentistaFilter(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-44 appearance-none"
                      >
                        <option value="">Todos os Frentistas</option>
                        {MOCK_FUNCIONARIOS.map(f => <option key={f.id_cartao_abast} value={f.apelido}>{f.apelido}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Bico</label>
                    <div className="relative">
                      <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <select 
                        value={bicoFilter}
                        onChange={(e) => setBicoFilter(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-32 appearance-none"
                      >
                        <option value="">Todos</option>
                        {['01', '02', '03', '04', '05', '06'].map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const sevenDaysAgo = new Date();
                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                      setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
                      setEndDate(new Date().toISOString().split('T')[0]);
                      setFrentistaFilter('');
                      setBicoFilter('');
                    }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-blue-600 font-medium transition-colors border border-transparent hover:border-blue-100 rounded-lg"
                  >
                    Resetar Filtros
                  </button>
                </div>
              </div>

              {/* AI Insight Box */}
              <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-blue-600/30 p-2 rounded-lg backdrop-blur-md">
                        <TrendingUp size={20} className="text-blue-400" />
                      </div>
                      <h3 className="font-bold text-lg">Analista IA PostoPro</h3>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed max-w-2xl italic">
                      "{generatingInsight ? 'Processando dados de volumetria e faturamento...' : (aiInsight || 'Pronto para analisar o desempenho do seu posto. Clique para começar.')}"
                    </p>
                  </div>
                  <button 
                    onClick={generateAIInsight}
                    disabled={generatingInsight}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {generatingInsight ? <RefreshCcw size={18} className="animate-spin" /> : <TrendingUp size={18} />}
                    Gerar Percepção IA
                  </button>
                </div>
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Dynamic Bar Chart: Sales by Frentista */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-gray-800">Soma de Abastecimentos por Frentista</h3>
                      <p className="text-xs text-gray-400">Total acumulado (R$) no período filtrado</p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <User size={18} className="text-blue-600" />
                    </div>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataByFrentista} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#1e293b', fontSize: 12, fontWeight: 600}} />
                        <Tooltip 
                          cursor={{fill: '#f1f5f9'}}
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']}
                        />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart: Fuel Mix */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-gray-800">Mix de Combustíveis (Volume)</h3>
                      <p className="text-xs text-gray-400">Distribuição por tipo de produto</p>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <Fuel size={18} className="text-emerald-600" />
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataByFuel}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartDataByFuel.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                           formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                   <input 
                    type="text" 
                    placeholder="Filtrar na visualização..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
                <button 
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition-all"
                >
                  <Download size={18} />
                  Exportar Filtro Atual
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data / Caixa</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Frentista</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Bico / Prod.</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Litros</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Preço</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Encerrantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          Nenhum registro encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    ) : filteredData.map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{row.dt_caixa}</div>
                          <div className="text-xs text-gray-400 font-mono">SEQ: {row.seq_caixa}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                              {row.apelido.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-700">{row.apelido}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{row.id_cartao_frentista}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-blue-600">Bico {row.cod_bico}</div>
                          <div className="text-[10px] text-gray-500 uppercase truncate max-w-[120px]">{row.tipo_combustivel}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-slate-600">
                          {row.litros.toFixed(3)} L
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-slate-500">
                          {row.preco.toFixed(3)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-black text-slate-900 font-mono">
                            R$ {row.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-[10px] text-gray-400 font-mono">I: {row.enc_inicial.toFixed(1)}</div>
                          <div className="text-[10px] text-blue-500 font-mono font-bold">F: {row.enc_final.toFixed(1)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Database size={20} className="text-blue-600" />
                Configurações da Instalação Firebird
              </h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Host (Local ou Rede)</label>
                    <input 
                      type="text" 
                      value={dbConfig.host}
                      onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})}
                      placeholder="Ex: 192.168.0.100"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Porta Firebird</label>
                    <input 
                      type="number" 
                      value={dbConfig.port}
                      onChange={(e) => setDbConfig({...dbConfig, port: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Caminho do Banco de Dados (.FDB)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={dbConfig.path}
                      onChange={(e) => setDbConfig({...dbConfig, path: e.target.value})}
                      placeholder="C:\Pasta\Dados.fdb"
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Usuário do Banco</label>
                    <input 
                      type="text" 
                      defaultValue="sysdba"
                      readOnly
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Senha Master</label>
                    <input 
                      type="password" 
                      defaultValue="masterkey"
                      readOnly
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400 italic">Configure o IP para acesso em rede local.</p>
                  <button 
                    onClick={() => {
                      setDbConfig({...dbConfig, status: 'connecting'});
                      setTimeout(() => setDbConfig({...dbConfig, status: 'connected'}), 1500);
                    }}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                  >
                    {dbConfig.status === 'connecting' ? 'Testando...' : 'Salvar Alterações'}
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trend}
        </div>
      </div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
    </div>
  );
}
