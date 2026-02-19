
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
  Search,
  FolderOpen,
  Zap,
  Server,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  User,
  Calendar
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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

type SortField = 'cod_bico' | 'total';
type SortOrder = 'asc' | 'desc';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [data, setData] = useState<JoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAttendant, setExpandedAttendant] = useState<string | null>(null);
  const [detailSort, setDetailSort] = useState<{field: SortField, order: SortOrder}>({ field: 'total', order: 'desc' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dbConfig, setDbConfig] = useState<DBConfig>({
    host: 'localhost',
    path: 'C:\\ACS\\sintese\\pdv\\CAIXA.FDB',
    port: 3050,
    status: 'disconnected'
  });

  // Alterado para capturar todo o histórico por padrão (desde o ano 2000)
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setDbConfig(prev => ({ ...prev, status: 'connecting' }));
    
    try {
      const isOnline = await checkBridge();
      if (!isOnline) {
        throw new Error("Agente offline. Certifique-se de que o arquivo bridge.js está rodando.");
      }

      const response = await fetch('http://localhost:3001/api/data');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errData.error || "Erro ao ler banco Firebird");
      }

      const realData = await response.json();
      if (!Array.isArray(realData)) {
        throw new Error("Formato de dados inválido recebido do banco.");
      }

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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const isOnline = await checkBridge();
      if (isOnline) {
        await handleConnect();
      } else {
        setData(getJoinedData());
      }
      setLoading(false);
    };
    init();
  }, []);

  const parseFirebirdDate = (dateStr: string) => {
    if (!dateStr) return null;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = parseFirebirdDate(item.dt_caixa);
      if (!itemDate) return true; // Se não tem data, mantém (para garantir que não suma nada por erro de data)
      
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      const matchesDate = itemDate >= start && itemDate <= end;

      const searchLower = (searchTerm || '').toLowerCase();
      const matchesSearch = 
        (item.apelido || "").toLowerCase().includes(searchLower) ||
        (item.tipo_combustivel || "").toLowerCase().includes(searchLower) ||
        (item.cod_bico || "").toLowerCase().includes(searchLower);

      return matchesDate && matchesSearch;
    });
  }, [data, startDate, endDate, searchTerm]);

  const groupedByAttendant = useMemo(() => {
    const groups: Record<string, { 
      name: string, 
      total: number, 
      litros: number, 
      count: number,
      sales: JoinData[] 
    }> = {};

    filteredData.forEach(item => {
      const name = item.apelido || 'DESCONHECIDO';
      if (!groups[name]) {
        groups[name] = { name, total: 0, litros: 0, count: 0, sales: [] };
      }
      groups[name].total += (Number(item.total) || 0);
      groups[name].litros += (Number(item.litros) || 0);
      groups[name].count += 1;
      groups[name].sales.push(item);
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const stats = useMemo((): DashboardStats => {
    const totalRevenue = filteredData.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const totalLiters = filteredData.reduce((acc, curr) => acc + (Number(curr.litros) || 0), 0);
    return {
      totalRevenue,
      totalLiters,
      avgPrice: totalLiters > 0 ? totalRevenue / totalLiters : 0,
      fuelingCount: filteredData.length
    };
  }, [filteredData]);

  const chartDataByFrentista = useMemo((): ChartDataItem[] => {
    return groupedByAttendant.map(g => ({
      name: g.name,
      total: g.total,
      litros: g.litros
    })).slice(0, 10);
  }, [groupedByAttendant]);

  const chartDataByFuel = useMemo((): FuelChartItem[] => {
    const grouped: Record<string, FuelChartItem> = {};
    filteredData.forEach(curr => {
      const name = curr.tipo_combustivel || 'OUTROS';
      if (!grouped[name]) grouped[name] = { name, value: 0 };
      grouped[name].value += (Number(curr.total) || 0);
    });
    return Object.values(grouped);
  }, [filteredData]);

  const toggleSort = (field: SortField) => {
    setDetailSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortedSales = (sales: JoinData[]) => {
    return [...sales].sort((a, b) => {
      let valA = a[detailSort.field] ?? "";
      let valB = b[detailSort.field] ?? "";
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return detailSort.order === 'asc' ? -1 : 1;
      if (valA > valB) return detailSort.order === 'asc' ? 1 : -1;
      return 0;
    });
  };

  if (loading && !isConnecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCcw size={40} className="mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Acessando Banco Local...</p>
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
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Dashboard Ativo</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <SidebarLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Resultados" />
          <SidebarLink active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Database size={20} />} label="Transações" />
          <SidebarLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Configuração" />
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="rounded-xl bg-slate-800/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-2 w-2 rounded-full ${bridgeStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="text-[10px] font-bold text-slate-300 uppercase">
                {bridgeStatus === 'online' ? 'Conectado ao PC' : 'Agente Offline'}
              </span>
            </div>
            <p className="truncate text-[9px] text-slate-500 font-mono">http://localhost:3001</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {activeTab === 'dashboard' ? 'Painel de Gestão' : activeTab === 'history' ? 'Histórico Geral' : 'Conexão Firebird'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600 uppercase">
                <Database size={10} /> {data.length} Total do Banco
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-600 uppercase">
                <Info size={10} /> {filteredData.length} Exibidas
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-4 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Início</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-[10px] font-black text-blue-600 outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Fim</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-[10px] font-black text-blue-600 outline-none" />
                </div>
                <button 
                  onClick={() => { setStartDate('2000-01-01'); setEndDate(new Date().toISOString().split('T')[0]); }}
                  className="ml-2 rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 transition-colors"
                  title="Limpar Filtro de Data"
                >
                  <Calendar size={14} />
                </button>
             </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-8">
          {activeTab === 'dashboard' && filteredData.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Vendas Históricas" value={`R$ ${stats.totalRevenue.toLocaleString()}`} icon={<TrendingUp />} color="blue" />
                <MetricCard title="Volume Total" value={`${stats.totalLiters.toFixed(2)} L`} icon={<Fuel />} color="emerald" />
                <MetricCard title="Ticket Médio" value={`R$ ${stats.avgPrice.toFixed(2)}`} icon={<ArrowUpRight />} color="amber" />
                <MetricCard title="Total Registros" value={stats.fuelingCount} icon={<RefreshCcw />} color="indigo" />
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm h-[400px]">
                  <h3 className="mb-6 text-lg font-black text-slate-800 uppercase tracking-tighter">Ranking Acumulado</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataByFrentista} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11, fontWeight: 800}} width={90} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm h-[400px]">
                  <h3 className="mb-6 text-lg font-black text-slate-800 uppercase tracking-tighter">Mix de Combustíveis</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartDataByFuel} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
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
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 max-w-md">
                   <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input 
                    type="text" 
                    placeholder="Pesquisar em todo o histórico..." 
                    className="w-full rounded-2xl border-none bg-slate-50 py-3 pl-12 pr-4 text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                <button className="hidden sm:flex items-center gap-2 rounded-2xl bg-blue-50 px-6 py-3 text-xs font-black uppercase text-blue-600 hover:bg-blue-100 transition-colors">
                  <Download size={16} /> Exportar Backup
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-12"></th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Frentista</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Abastecimentos</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Litros Totais</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Valor Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedByAttendant.map((group) => (
                      <React.Fragment key={group.name}>
                        <tr 
                          onClick={() => setExpandedAttendant(expandedAttendant === group.name ? null : group.name)}
                          className="cursor-pointer hover:bg-slate-50/80 transition-all group"
                        >
                          <td className="px-6 py-4 text-center">
                            {expandedAttendant === group.name ? <ChevronDown size={18} className="text-blue-600" /> : <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400" />}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <User size={16} />
                              </div>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{group.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-500">{group.count}</td>
                          <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-600">{group.litros.toFixed(2)} L</td>
                          <td className="px-6 py-4 text-right text-sm font-black text-blue-600">R$ {group.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        
                        {expandedAttendant === group.name && (
                          <tr>
                            <td colSpan={5} className="bg-slate-50/50 px-8 py-6">
                              <div className="rounded-2xl border border-blue-100 bg-white shadow-lg overflow-hidden">
                                <div className="flex items-center justify-between bg-blue-50/30 px-6 py-3 border-b border-blue-100">
                                  <h4 className="text-[10px] font-black uppercase text-blue-800">Detalhamento Individual: {group.name}</h4>
                                  <div className="flex gap-4">
                                    <button onClick={() => toggleSort('cod_bico')} className={`flex items-center gap-1 text-[9px] font-black uppercase ${detailSort.field === 'cod_bico' ? 'text-blue-600' : 'text-slate-400'}`}>Bico <ArrowUpDown size={12} /></button>
                                    <button onClick={() => toggleSort('total')} className={`flex items-center gap-1 text-[9px] font-black uppercase ${detailSort.field === 'total' ? 'text-blue-600' : 'text-slate-400'}`}>Valor <ArrowUpDown size={12} /></button>
                                  </div>
                                </div>
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="border-b border-slate-50">
                                      <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-tighter">Bico</th>
                                      <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-tighter">Combustível</th>
                                      <th className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-tighter">Data</th>
                                      <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-slate-400 tracking-tighter">Preço (R$)</th>
                                      <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-slate-400 tracking-tighter">Litros</th>
                                      <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-slate-400 tracking-tighter">Total (R$)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {getSortedSales(group.sales).map((sale, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 font-mono text-[10px] font-black text-slate-400">{sale.cod_bico}</td>
                                        <td className="px-6 py-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 uppercase">{sale.tipo_combustivel}</span></td>
                                        <td className="px-6 py-3 text-[10px] font-bold text-slate-400">{parseFirebirdDate(sale.dt_caixa)?.toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-3 text-right font-mono text-[10px] text-slate-500">{(sale.preco || 0).toFixed(3)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-[10px] font-bold text-slate-600">{(sale.litros || 0).toFixed(2)}</td>
                                        <td className="px-6 py-3 text-right text-xs font-black text-emerald-600">R$ {(sale.total || 0).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
                    <h3 className="text-2xl font-black text-slate-800">Status da Conexão</h3>
                    <p className="text-sm font-medium text-slate-400">Configurações Locais</p>
                  </div>
                </div>

                {errorMessage && (
                   <div className="mb-6 rounded-2xl bg-red-50 border border-red-100 p-6 flex items-start gap-3 text-red-600">
                      <XCircle size={20} className="shrink-0 mt-0.5" />
                      <div><p className="text-xs font-black uppercase mb-1">Erro Detectado</p><p className="text-[11px] font-bold leading-relaxed">{errorMessage}</p></div>
                   </div>
                )}

                <div className="space-y-6">
                  <div className="rounded-2xl bg-slate-50 p-6 border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Caminho do Banco Ativo</p>
                    <p className="text-xs font-mono font-bold text-slate-700 break-all">{dbConfig.path}</p>
                  </div>
                  <div className="hidden"><input type="file" ref={fileInputRef} accept=".fdb" onChange={(e) => { const f = e.target.files?.[0]; if(f) setDbConfig({...dbConfig, path: `C:\\ACS\\sintese\\pdv\\${f.name}`}); }} /></div>
                  <div className="flex gap-4">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-3 rounded-3xl bg-slate-100 px-6 py-5 text-sm font-black uppercase tracking-widest text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all"><FolderOpen size={20} /> Mudar Banco</button>
                    <button onClick={handleConnect} disabled={isConnecting} className="flex-1 flex items-center justify-center gap-3 rounded-3xl bg-blue-600 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl hover:bg-blue-500 transition-all disabled:opacity-50">{isConnecting ? <RefreshCcw size={20} className="animate-spin" /> : <Zap size={20} />}{isConnecting ? 'Sincronizando...' : 'Conectar Agora'}</button>
                  </div>
                </div>
              </div>

              <div className="rounded-[2.5rem] border border-slate-200 bg-slate-900 p-10 text-white shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xl font-black mb-6 uppercase text-blue-400 tracking-tighter">Modo de Captura Total</h3>
                  <div className="space-y-6">
                    <Step num="1" title="Histórico Completo" desc="O sistema agora exibe todas as vendas encontradas no banco sem limite de dias." />
                    <Step num="2" title="Query de Sincronização" desc="Recomenda-se remover filtros de data no bridge.js para importar tudo." />
                    <Step num="3" title="Desempenho" desc="Vendas antigas são processadas localmente para manter a rapidez." />
                  </div>
                  <div className="mt-10 p-6 rounded-2xl bg-slate-800 border border-slate-700">
                    <p className="text-[10px] font-black text-emerald-400 uppercase mb-3 font-mono">Query para Todas as Vendas:</p>
                    <code className="text-[11px] font-mono text-slate-300 block bg-black/40 p-4 rounded-xl leading-relaxed whitespace-pre">
                      {"SELECT a.*, f.apelido"} <br/>
                      {"FROM ABASTECIMENTOS a"} <br/>
                      {"LEFT JOIN FUNCIONARIOS f ON a.id_cartao_frentista = f.id_cartao_abast"} <br/>
                      {"ORDER BY a.dt_caixa DESC"}
                    </code>
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

function Step({ num, title, desc }: { num: string, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black">{num}</div>
      <div>
        <h4 className="text-sm font-black uppercase text-white tracking-tight">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = { blue: 'bg-blue-600', emerald: 'bg-emerald-600', amber: 'bg-amber-600', indigo: 'bg-indigo-600' };
  return (
    <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm hover:shadow-xl transition-all group">
      <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform ${colorMap[color]}`}>{icon}</div>
      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      <p className="text-2xl font-black tracking-tighter text-slate-800">{value}</p>
    </div>
  );
}
