import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Activity, LogOut, RefreshCw, Crown, Bell, Send, 
  ExternalLink, Server, Database, Cpu, Clock, CheckCircle2,
  AlertTriangle, Search, Filter, HardDrive, BarChart3,
  Layers, ArrowUpRight, ShieldCheck, Smartphone, Check, X
} from 'lucide-react';
import { 
  api, type User, type AdminMetrics, type CloudTelemetry, type BroadcastNotification 
} from '../services/api';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'notifications' | 'telemetry' | 'control'>('users');
  const [operator, setOperator] = useState<User | null>(null);
  const [accessState, setAccessState] = useState<'checking' | 'authorized'>('checking');

  // Live Data States
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [telemetry, setTelemetry] = useState<CloudTelemetry | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastNotification[]>([]);

  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  // Inspector State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectPlan, setInspectPlan] = useState<'pro' | 'starter_free'>('starter_free');
  const [inspectStatus, setInspectStatus] = useState<'active' | 'suspended' | 'flagged'>('active');
  const [savingUser, setSavingUser] = useState(false);

  // Notification Composer States
  const [notifTitle, setNotifTitle] = useState('⚡ Special Pro Offer: 33% Off');
  const [notifBody, setNotifBody] = useState('Upgrade to WhisperLedger Pro for unlimited household shared spaces and formal statutory refund tracking.');
  const [notifImageUrl, setNotifImageUrl] = useState('/assets/banners/discount_banner.jpg');
  const [notifAudience, setNotifAudience] = useState<'all' | 'pro_only' | 'single_user'>('all');
  const [notifType, setNotifType] = useState('promo');
  const [specificUid, setSpecificUid] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

  // UI States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = useCallback(async () => {
    const t0 = performance.now();
    try {
      const [mRes, tRes, uRes, bRes] = await Promise.all([
        api.getAdminMetrics(),
        api.getCloudTelemetry(),
        api.getAdminUsers(100, 0),
        api.getBroadcastNotifications(20),
      ]);

      setPingMs(Math.round(performance.now() - t0));

      if (mRes.success && mRes.data) setMetrics(mRes.data);
      if (tRes.success && tRes.data) setTelemetry(tRes.data);
      if (uRes.success && uRes.data) setUsers(uRes.data);
      if (bRes.success && bRes.data) setBroadcasts(bRes.data);
    } catch (err) {
      console.error('Failed to fetch admin operations data:', err);
      showToast('Error refreshing live telemetry from Cloud API.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('whisperledger_access_token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    api.getMe().then((res) => {
      if (!active) return;
      if (res.success && res.data) {
        const role = res.data.role;
        if (role !== 'platform_admin') {
          api.logout();
          navigate('/login', { replace: true });
          return;
        }
        setOperator(res.data);
        setAccessState('authorized');
        loadData();
      } else {
        api.logout();
        navigate('/login', { replace: true });
      }
    }).catch(() => {
      api.logout();
      navigate('/login', { replace: true });
    });

    return () => { active = false; };
  }, [navigate, loadData]);

  const handleLogout = () => {
    api.logout();
    navigate('/login', { replace: true });
  };

  const openInspector = (user: User) => {
    setSelectedUser(user);
    setInspectPlan(user.plan || 'starter_free');
    setInspectStatus(user.status || 'active');
    setInspectorOpen(true);
  };

  const handleSaveUserChanges = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    try {
      const res = await api.updateUserSubscription(selectedUser.id, inspectPlan, inspectStatus);
      if (res.success) {
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, plan: inspectPlan, status: inspectStatus } : u));
        setInspectorOpen(false);
        showToast(`Saved subscription changes for ${selectedUser.full_name || 'user'}.`);
      } else {
        showToast(res.error?.message || 'Could not update user subscription.');
      }
    } catch {
      showToast('Failed to connect to backend server.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleQuickTogglePlan = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const nextPlan = user.plan === 'pro' ? 'starter_free' : 'pro';
    try {
      const res = await api.updateUserSubscription(userId, nextPlan, user.status || 'active');
      if (res.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, plan: nextPlan } : u));
        showToast(`Changed ${user.full_name}'s tier to ${nextPlan === 'pro' ? 'Pro' : 'Starter Free'}`);
      }
    } catch {
      showToast('Error toggling plan in PostgreSQL.');
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      showToast('Please provide both notification title and message body.');
      return;
    }
    if (notifAudience === 'single_user' && !specificUid.trim()) {
      showToast('Please enter the target User UUID for single user delivery.');
      return;
    }

    setSendingNotification(true);
    try {
      const deliveredCount = notifAudience === 'all' ? users.length : (notifAudience === 'pro_only' ? users.filter(u => u.plan === 'pro').length : 1);
      const res = await api.sendBroadcastNotification({
        app_name: 'WhisperLedger',
        title: notifTitle.trim(),
        body: notifBody.trim(),
        image_url: notifImageUrl.trim() || undefined,
        target: notifAudience,
        target_user_id: notifAudience === 'single_user' ? specificUid.trim() : null,
        type: notifType,
        delivered_count: deliveredCount,
      });

      if (res.success && res.data) {
        setBroadcasts([res.data, ...broadcasts]);
        showToast(`Push Notification transmitted under app WhisperLedger to ${deliveredCount} recipients!`);
      } else {
        showToast(res.error?.message || 'Failed to dispatch broadcast.');
      }
    } catch {
      showToast('Error transmitting notification to Cloud API.');
    } finally {
      setSendingNotification(false);
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.id?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const totalUsers = users.length;
  const proUsers = users.filter(u => u.plan === 'pro').length;
  const maxVolume = telemetry?.daily_volumes?.reduce((max, d) => Math.max(max, d.amount), 1) || 1;

  if (accessState === 'checking') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Connecting to WhisperLedger Admin Gateway…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-white border-r border-slate-200 p-5 flex flex-col justify-between shrink-0 shadow-sm">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <img src="/assets/logo.png" alt="WhisperLedger" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-950 leading-tight">
                Whisper<span className="text-blue-600">Ledger</span>
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 font-mono bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                <Server className="w-2.5 h-2.5" /> ROOT OPERATIONS
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-3 mb-2">Management</p>
            
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Subscriptions</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                activeTab === 'users' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {users.length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Push Notifications</span>
              {broadcasts.length > 0 && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === 'notifications' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {broadcasts.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('telemetry')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'telemetry' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Cloud Telemetry & Graphs</span>
            </button>

            <button 
              onClick={() => setActiveTab('control')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'control' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>System & Console Links</span>
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
              {operator?.full_name ? operator.full_name[0].toUpperCase() : 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">{operator?.full_name || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">{operator?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Operations Body */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">
                {activeTab === 'users' && 'User Monitoring & Subscription Management'}
                {activeTab === 'notifications' && 'Push Notification Broadcaster'}
                {activeTab === 'telemetry' && 'GCP Cloud Run Metrics & Neon DB Pool'}
                {activeTab === 'control' && 'Platform Scale & Infrastructure Controls'}
              </h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live PostgreSQL
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Service: <span className="font-mono text-slate-700 font-semibold">{telemetry?.service || 'whisperledger-api'}</span>
              {' • '}Revision: <span className="font-mono text-slate-700 font-semibold">{telemetry?.revision || 'whisperledger-api-00003-pjb'}</span>
              {pingMs !== null && ` • ${pingMs}ms latency`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadData();
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing…' : 'Refresh Operations'}</span>
            </button>
          </div>
        </header>

        {/* TAB 1: User Subscriptions Management */}
        {activeTab === 'users' && (
          <div className="p-6 space-y-6">
            {/* Quick KPI stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Total Users</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalUsers}</p>
                <span className="text-[11px] text-slate-400">PostgreSQL accounts</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Pro Subscribers</span>
                <p className="text-2xl font-black text-amber-500 mt-1 flex items-center gap-1.5">
                  <Crown className="w-5 h-5 text-amber-500" /> {proUsers}
                </p>
                <span className="text-[11px] text-slate-400">Premium unlocked</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Active Accounts</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {users.filter(u => u.status === 'active').length}
                </p>
                <span className="text-[11px] text-slate-400">Normal standing</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Flagged / Suspended</span>
                <p className="text-2xl font-black text-rose-600 mt-1">
                  {users.filter(u => u.status === 'flagged' || u.status === 'suspended').length}
                </p>
                <span className="text-[11px] text-slate-400">Action required</span>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search user name, email, or UUID…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 transition"
                  />
                </div>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Plans</option>
                  <option value="pro">Pro Tier Only</option>
                  <option value="starter_free">Starter Free Only</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>

              <span className="text-xs font-semibold text-slate-500">
                Showing {filteredUsers.length} of {users.length} Users
              </span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Subscription Plan</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Quick Toggle</th>
                      <th className="py-3.5 px-4">Push Ready</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => {
                        const isPro = user.plan === 'pro';
                        return (
                          <tr key={user.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{user.full_name || 'Anonymous'}</p>
                                  <p className="text-[11px] text-slate-500 font-mono">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  isPro
                                    ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isPro && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                                {isPro ? 'Pro Member' : 'Starter Free'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                                  user.status === 'suspended'
                                    ? 'text-rose-600'
                                    : user.status === 'flagged'
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    user.status === 'suspended'
                                      ? 'bg-rose-500'
                                      : user.status === 'flagged'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                />
                                {user.status ? user.status.toUpperCase() : 'ACTIVE'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => handleQuickTogglePlan(user.id)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                                  isPro
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                                }`}
                              >
                                {isPro ? 'Downgrade' : 'Upgrade to Pro'}
                              </button>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                                  user.push_ready ? 'text-emerald-600' : 'text-slate-400'
                                }`}
                              >
                                <Smartphone className="w-3 h-3" />
                                {user.push_ready ? 'Ready' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => openInspector(user)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No users matched your filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Push Notifications Broadcaster */}
        {activeTab === 'notifications' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Push Composer Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-600" /> Dispatch Push Broadcast
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Send push notification directly under app name <strong>WhisperLedger</strong> to user devices.
                  </p>
                </div>

                <form onSubmit={handleSendNotification} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Audience</label>
                    <select
                      value={notifAudience}
                      onChange={(e) => setNotifAudience(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                    >
                      <option value="all">All Devices (Broad Audience)</option>
                      <option value="pro_only">Pro Tier Subscribers Only</option>
                      <option value="single_user">Single Specific User UUID</option>
                    </select>
                  </div>

                  {notifAudience === 'single_user' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Target User UUID</label>
                      <input
                        type="text"
                        value={specificUid}
                        onChange={(e) => setSpecificUid(e.target.value)}
                        placeholder="e.g. fb1a2293-4d50-4c09-..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono outline-none"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Notification Title</label>
                    <input
                      type="text"
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="e.g. ⚡ Special Pro Offer: 33% Off"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Message Body</label>
                    <textarea
                      rows={3}
                      value={notifBody}
                      onChange={(e) => setNotifBody(e.target.value)}
                      placeholder="Notification text delivered to status bar…"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Image URL (Optional)</label>
                    <input
                      type="text"
                      value={notifImageUrl}
                      onChange={(e) => setNotifImageUrl(e.target.value)}
                      placeholder="https://.../banner.jpg"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Notification Category</label>
                    <select
                      value={notifType}
                      onChange={(e) => setNotifType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                    >
                      <option value="promo">Promotional / Special Offer</option>
                      <option value="system">System Maintenance</option>
                      <option value="security">Security Alert</option>
                      <option value="update">New Feature Announcement</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingNotification}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingNotification ? 'Transmitting…' : 'Transmit Push Notification'}
                  </button>
                </form>
              </div>

              {/* Broadcast Delivery History */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Broadcast Transmission History</h3>
                    <p className="text-xs text-slate-500">Recent push announcements recorded in PostgreSQL</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {broadcasts.length} Recorded
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px]">
                  {broadcasts.length > 0 ? (
                    broadcasts.map((b) => (
                      <div
                        key={b.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[9px] bg-blue-100 text-blue-800">
                              {b.type}
                            </span>
                            <span className="font-bold text-slate-900">{b.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(b.sent_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{b.body}</p>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>Target: <strong className="text-slate-800">{b.target}</strong></span>
                          <span>Delivered: <strong className="text-slate-800">{b.delivered_count} devices</strong></span>
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <Check className="w-3 h-3" /> Transmitted
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center text-slate-400">
                      <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs">No notifications broadcast yet. Use the composer on the left.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Cloud Telemetry & Graphs */}
        {activeTab === 'telemetry' && (
          <div className="p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Spending Volume Tracked</span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  ₹{(metrics?.total_volume_tracked || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[11px] text-emerald-600 font-medium">PostgreSQL Ledger Total</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Neon Database Pool</span>
                <p className="text-2xl font-black text-purple-600 mt-1">
                  {telemetry?.db_pool_acquired ?? 0} active / {telemetry?.db_pool_idle ?? 0} idle
                </p>
                <span className="text-[11px] text-slate-500">Max limit: {telemetry?.db_pool_total ?? 10}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Cloud Run Memory</span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {(telemetry?.memory_alloc_mb || 0).toFixed(1)} MB
                </p>
                <span className="text-[11px] text-slate-500">Sys: {(telemetry?.memory_sys_mb || 0).toFixed(1)} MB</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Service Uptime</span>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {formatUptime(telemetry?.uptime_seconds)}
                </p>
                <span className="text-[11px] text-slate-500">Go Runtime: {telemetry?.go_version || 'go1.26.9'}</span>
              </div>
            </div>

            {/* 14-Day Volume Interactive Bar Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">14-Day Spending Volume Distribution</h3>
                  <p className="text-xs text-slate-500">Daily ledger volume aggregates computed from PostgreSQL</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
                  14-Day Historical Window
                </span>
              </div>

              {telemetry?.daily_volumes && telemetry.daily_volumes.length > 0 ? (
                <div className="h-56 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-100 overflow-x-auto">
                  {telemetry.daily_volumes.map((d, index) => {
                    const heightPercent = Math.max(12, Math.round((d.amount / maxVolume) * 100));
                    return (
                      <div key={index} className="flex-1 min-w-[48px] flex flex-col items-center gap-2 group relative">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap pointer-events-none z-20">
                          ₹{d.amount.toLocaleString('en-IN')} ({d.count} txns)
                        </div>
                        <div className="w-full flex items-end justify-center h-40">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className="w-full max-w-[36px] bg-blue-500 hover:bg-blue-600 rounded-t-lg transition-all duration-300"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{d.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <BarChart3 className="w-8 h-8 text-slate-300" />
                  <p className="text-xs">No volume records logged in the last 14 days yet.</p>
                </div>
              )}
            </div>

            {/* Live Operational Log Feed */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Live Operational System Log Stream</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">PostgreSQL Audit Stream</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {telemetry?.recent_logs && telemetry.recent_logs.length > 0 ? (
                  telemetry.recent_logs.map((log, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 text-xs space-y-1 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                              log.level === 'ERROR'
                                ? 'bg-rose-100 text-rose-700'
                                : log.level === 'WARN'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {log.level}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 capitalize">[{log.source}]</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-800 font-mono text-[11px] leading-relaxed break-words">{log.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">No events logged yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: System Shortcuts & External Consoles */}
        {activeTab === 'control' && (
          <div className="p-6 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Direct Infrastructure Operations</h3>
              <p className="text-xs text-slate-500">
                Direct access to Google Cloud Run, Cloud Logging, Cloud Build, and Neon Serverless Database.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <a
                  href="https://console.cloud.google.com/run/detail/asia-south1/whisperledger-api/metrics?project=whisperledger-94715"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-sm transition flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-blue-600" /> Cloud Run Metrics
                    </span>
                    <p className="text-[11px] text-slate-500">CPU, memory, latency percentiles, and traffic graphs.</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>

                <a
                  href="https://console.cloud.google.com/logs/query?project=whisperledger-94715"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-sm transition flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-purple-600" /> Cloud Logs Explorer
                    </span>
                    <p className="text-[11px] text-slate-500">Real-time structured stdout/stderr streaming from Go microservice.</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>

                <a
                  href="https://console.neon.tech/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-sm transition flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-emerald-600" /> Neon Database Console
                    </span>
                    <p className="text-[11px] text-slate-500">Inspect PostgreSQL branches, storage size, and active connection pools.</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>

                <a
                  href="https://github.com/WhisperLedger/whisperledger-backend"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:shadow-sm transition flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-slate-700" /> GitHub Backend
                    </span>
                    <p className="text-[11px] text-slate-500">View Go source code, database migrations, and CI/CD workflow status.</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* User Inspector Modal / Drawer */}
      {selectedUser && inspectorOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">User Subscription Inspector</h3>
              <button
                onClick={() => setInspectorOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">User UUID</span>
                <p className="font-mono text-[11px] text-slate-800 break-all">{selectedUser.id}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Full Name</span>
                <p className="font-semibold text-slate-900">{selectedUser.full_name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Email Address</span>
                <p className="font-mono text-slate-800">{selectedUser.email}</p>
              </div>

              {/* Subscription Tier Form */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Subscription Tier</label>
                  <select
                    value={inspectPlan}
                    onChange={(e) => setInspectPlan(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                  >
                    <option value="starter_free">Starter Free</option>
                    <option value="pro">Pro (Unlimited Households & Statutory Recovery)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Account Standing</label>
                  <select
                    value={inspectStatus}
                    onChange={(e) => setInspectStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                  >
                    <option value="active">Active (Normal Access)</option>
                    <option value="flagged">Flagged (Under Audit)</option>
                    <option value="suspended">Suspended (Access Revoked)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setInspectorOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserChanges}
                disabled={savingUser}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50"
              >
                {savingUser ? 'Saving…' : 'Save to PostgreSQL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
