import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Bell, Check, CheckCircle2, ChevronRight, Crown, Database,
  ExternalLink, LogOut, RefreshCw, Search, Send, ShieldCheck, Smartphone,
  Users, X,
} from 'lucide-react';
import {
  api, type AdminMetrics, type BroadcastNotification, type CloudTelemetry, type User,
} from '../services/api';

type Tab = 'users' | 'notifications' | 'health';
type Audience = 'all' | 'pro_only' | 'single_user' | 'selected_users';

const notificationTemplates = [
  { id: 'product', label: 'Product update', type: 'update', title: 'A new WhisperLedger update is available', body: 'Open WhisperLedger to see what has changed.' },
  { id: 'service', label: 'Service update', type: 'system', title: 'A WhisperLedger service update', body: 'We are making a routine improvement. Your data remains available.' },
  { id: 'security', label: 'Security notice', type: 'security', title: 'A security update for your account', body: 'Open WhisperLedger to review this important account notice.' },
  { id: 'custom', label: 'Custom message', type: 'update', title: '', body: '' },
];
const navigationItems: Array<{ id: Tab; icon: React.ComponentType<{ className?: string }>; label: string }> = [
  { id: 'users', icon: Users, label: 'Users' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'health', icon: Activity, label: 'Service health' },
];

const displayName = (user: User) => user.full_name?.trim() || user.email?.split('@')[0] || 'Unnamed user';
const initials = (user: User) => displayName(user).slice(0, 2).toUpperCase();
const readableDate = (date?: string) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date)) : '—';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [operator, setOperator] = useState<User | null>(null);
  const [accessState, setAccessState] = useState<'checking' | 'authorized'>('checking');
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [telemetry, setTelemetry] = useState<CloudTelemetry | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastNotification[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inspectPlan, setInspectPlan] = useState<'pro' | 'starter_free'>('starter_free');
  const [inspectStatus, setInspectStatus] = useState<'active' | 'suspended' | 'flagged'>('active');
  const [savingUser, setSavingUser] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [templateID, setTemplateID] = useState('product');
  const [notifTitle, setNotifTitle] = useState(notificationTemplates[0].title);
  const [notifBody, setNotifBody] = useState(notificationTemplates[0].body);
  const [notifAudience, setNotifAudience] = useState<Audience>('all');
  const [notifType, setNotifType] = useState(notificationTemplates[0].type);
  const [specificUID, setSpecificUID] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

  const showToast = (message: string) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = useCallback(async () => {
    const startedAt = performance.now();
    try {
      const [metricsResult, telemetryResult, usersResult, notificationsResult] = await Promise.all([
        api.getAdminMetrics(), api.getCloudTelemetry(), api.getAdminUsers(100, 0), api.getBroadcastNotifications(20),
      ]);
      setPingMs(Math.round(performance.now() - startedAt));
      if (metricsResult.success && metricsResult.data) setMetrics(metricsResult.data);
      if (telemetryResult.success && telemetryResult.data) setTelemetry(telemetryResult.data);
      if (usersResult.success && usersResult.data) setUsers(usersResult.data);
      if (notificationsResult.success && notificationsResult.data) setBroadcasts(notificationsResult.data);
    } catch {
      showToast('Could not refresh the console. Check the API connection and try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('whisperledger_access_token');
    if (!token) { navigate('/login', { replace: true }); return; }
    api.getMe().then((result) => {
      if (!mounted) return;
      if (!result.success || !result.data || result.data.role !== 'platform_admin') {
        api.logout(); navigate('/login', { replace: true }); return;
      }
      setOperator(result.data); setAccessState('authorized'); loadData();
    }).catch(() => { api.logout(); navigate('/login', { replace: true }); });
    return () => { mounted = false; };
  }, [loadData, navigate]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const term = searchTerm.toLowerCase().trim();
    return (!term || [user.full_name, user.email, user.id].some((item) => item?.toLowerCase().includes(term)))
      && (planFilter === 'all' || user.plan === planFilter)
      && (statusFilter === 'all' || user.status === statusFilter);
  }), [users, searchTerm, planFilter, statusFilter]);

  const activeCount = users.filter((user) => user.status === 'active').length;
  const proCount = users.filter((user) => user.plan === 'pro').length;
  const allVisibleSelected = filteredUsers.length > 0 && filteredUsers.every((user) => selectedIDs.includes(user.id));

  const toggleUser = (id: string) => setSelectedIDs((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIDs((current) => allVisibleSelected
    ? current.filter((id) => !filteredUsers.some((user) => user.id === id))
    : [...new Set([...current, ...filteredUsers.map((user) => user.id)])]);

  const openInspector = (user: User) => {
    setSelectedUser(user); setInspectPlan(user.plan || 'starter_free'); setInspectStatus(user.status || 'active');
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    try {
      const result = await api.updateUserSubscription(selectedUser.id, inspectPlan, inspectStatus);
      if (!result.success) { showToast(result.error?.message || 'Could not save this user.'); return; }
      setUsers((current) => current.map((user) => user.id === selectedUser.id ? { ...user, plan: inspectPlan, status: inspectStatus } : user));
      setSelectedUser(null); showToast(`Saved changes for ${displayName(selectedUser)}.`);
    } catch { showToast('Could not save this user.'); } finally { setSavingUser(false); }
  };

  const enableProForSelection = async () => {
    const targets = users.filter((user) => selectedIDs.includes(user.id));
    if (!targets.length) return;
    if (!window.confirm(`Enable Pro for ${targets.length} selected ${targets.length === 1 ? 'account' : 'accounts'}?`)) return;
    setBulkUpdating(true);
    const settled = await Promise.allSettled(targets.map((user) => api.updateUserSubscription(user.id, 'pro', user.status || 'active')));
    const succeeded = targets.filter((_, index) => settled[index].status === 'fulfilled' && (settled[index] as PromiseFulfilledResult<{ success: boolean }>).value.success);
    setUsers((current) => current.map((user) => succeeded.some((target) => target.id === user.id) ? { ...user, plan: 'pro' } : user));
    setSelectedIDs([]); setBulkUpdating(false);
    showToast(`Enabled Pro for ${succeeded.length} of ${targets.length} selected accounts.`);
  };

  const changeTemplate = (id: string) => {
    const template = notificationTemplates.find((item) => item.id === id) || notificationTemplates[0];
    setTemplateID(id); setNotifTitle(template.title); setNotifBody(template.body); setNotifType(template.type);
  };

  const sendNotification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) { showToast('Add a title and message before sending.'); return; }
    if (notifAudience === 'single_user' && !specificUID) { showToast('Choose the recipient for this notification.'); return; }
    if (notifAudience === 'selected_users' && !selectedIDs.length) { showToast('Select one or more users from the Users page first.'); return; }
    setSendingNotification(true);
    try {
      const result = await api.sendBroadcastNotification({
        app_name: 'WhisperLedger', title: notifTitle.trim(), body: notifBody.trim(), target: notifAudience,
        target_user_id: notifAudience === 'single_user' ? specificUID : null,
        target_user_ids: notifAudience === 'selected_users' ? selectedIDs : undefined,
        type: notifType,
      });
      if (!result.success || !result.data) { showToast(result.error?.message || 'The notification could not be sent.'); return; }
      setBroadcasts((current) => [result.data, ...current]);
      showToast(`Notification recorded. ${result.data.delivered_count} device${result.data.delivered_count === 1 ? '' : 's'} received it.`);
    } catch { showToast('The notification could not be sent.'); } finally { setSendingNotification(false); }
  };

  if (accessState === 'checking') return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><div className="text-center"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-600" /><p className="text-sm font-medium text-slate-600">Checking administrator access…</p></div></main>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:flex">
      {toastMsg && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />{toastMsg}</div>}
      <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div>
          <div className="flex items-center gap-3 px-2 pb-5"><img src="/assets/logo.png" alt="WhisperLedger" className="h-9 w-9 rounded-xl object-cover" /><div><p className="text-sm font-bold tracking-tight">WhisperLedger</p><p className="text-[11px] text-slate-500">Administration</p></div></div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 pt-4 lg:block lg:space-y-1">
            {navigationItems.map(({ id, icon: Icon, label }) => <button key={id} onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition lg:w-full ${activeTab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>)}
          </nav>
        </div>
        <div className="mt-5 hidden border-t border-slate-100 pt-4 lg:block"><div className="flex items-center gap-2.5 px-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{operator ? initials(operator) : 'A'}</div><div className="min-w-0"><p className="truncate text-xs font-semibold">{operator ? displayName(operator) : 'Administrator'}</p><p className="truncate text-[10px] text-slate-500">{operator?.email}</p></div></div><button onClick={() => { api.logout(); navigate('/login', { replace: true }); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"><LogOut className="h-3.5 w-3.5" />Sign out</button></div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
          <div><h1 className="text-base font-bold tracking-tight">{activeTab === 'users' ? 'Users' : activeTab === 'notifications' ? 'Notifications' : 'Service health'}</h1><p className="mt-0.5 text-xs text-slate-500">{activeTab === 'users' ? 'Review accounts, access and subscriptions.' : activeTab === 'notifications' ? 'Create clear, targeted product messages.' : 'Read-only API and database health.'}</p></div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 sm:inline">{pingMs === null ? 'API status pending' : `API responded in ${pingMs}ms`}</span><button onClick={() => { setIsRefreshing(true); loadData(); }} disabled={isRefreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />Refresh</button></div>
        </header>

        {activeTab === 'users' && <section className="space-y-5 p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Users" value={users.length} note="Accounts in this page" />
            <Metric label="Active in last 7 days" value={metrics?.active_users_7_days ?? '—'} note="Based on recorded ledger activity" />
            <Metric label="Pro enabled" value={proCount} note="Current subscription state" />
            <Metric label="Needs review" value={users.length - activeCount} note="Suspended or flagged accounts" emphasis="warn" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4"><div className="relative min-w-[210px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name, email or ID" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-slate-500" /></div><select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="all">All plans</option><option value="pro">Pro</option><option value="starter_free">Free</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="all">All statuses</option><option value="active">Active</option><option value="flagged">Flagged</option><option value="suspended">Suspended</option></select></div>
            {selectedIDs.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3"><p className="text-xs font-medium text-blue-900">{selectedIDs.length} selected</p><div className="flex gap-2"><button onClick={() => { setNotifAudience('selected_users'); setActiveTab('notifications'); }} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800">Notify selected</button><button onClick={enableProForSelection} disabled={bulkUpdating} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{bulkUpdating ? 'Updating…' : 'Enable Pro'}</button><button onClick={() => setSelectedIDs([])} className="p-1.5 text-blue-700"><X className="h-4 w-4" /></button></div></div>}
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="w-10 px-4 py-3"><input aria-label="Select visible users" type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th><th className="px-3 py-3">User</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Notifications</th><th className="px-4 py-3 text-right">Manage</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredUsers.map((user) => <tr key={user.id} className="hover:bg-slate-50"><td className="px-4 py-3"><input aria-label={`Select ${displayName(user)}`} type="checkbox" checked={selectedIDs.includes(user.id)} onChange={() => toggleUser(user.id)} /></td><td className="px-3 py-3"><div className="flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 font-semibold text-slate-600">{initials(user)}</div><div><p className="font-semibold text-slate-900">{displayName(user)}</p><p className="max-w-[190px] truncate text-[11px] text-slate-500">{user.email}</p></div></div></td><td className="px-3 py-3 text-slate-600">{readableDate(user.created_at)}</td><td className="px-3 py-3"><PlanBadge plan={user.plan} /></td><td className="px-3 py-3"><StatusBadge status={user.status} /></td><td className="px-3 py-3"><span className={user.push_ready ? 'text-emerald-700' : 'text-slate-400'}>{user.push_ready ? 'Ready' : 'Not enabled'}</span></td><td className="px-4 py-3 text-right"><button onClick={() => openInspector(user)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950">View <ChevronRight className="h-3.5 w-3.5" /></button></td></tr>)}{!filteredUsers.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No users match these filters.</td></tr>}</tbody></table></div>
          </div>
          <p className="text-xs leading-5 text-slate-500">The console reports only facts available from the product database. Per-user behavioural analytics should be added only after product event consent and retention rules are defined.</p>
        </section>}

        {activeTab === 'notifications' && <section className="grid gap-5 p-5 sm:p-8 xl:grid-cols-[minmax(0,430px)_1fr]">
          <form onSubmit={sendNotification} className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-5"><div><h2 className="text-sm font-bold">Compose notification</h2><p className="mt-1 text-xs leading-5 text-slate-500">Use a template as a starting point, then send only to the audience you intend.</p></div><FieldLabel label="Template"><select value={templateID} onChange={(event) => changeTemplate(event.target.value)} className="form-control">{notificationTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></FieldLabel><FieldLabel label="Audience"><select value={notifAudience} onChange={(event) => setNotifAudience(event.target.value as Audience)} className="form-control"><option value="all">All users with notifications enabled</option><option value="pro_only">Pro users with notifications enabled</option><option value="selected_users">Selected users ({selectedIDs.length})</option><option value="single_user">One user</option></select></FieldLabel>{notifAudience === 'selected_users' && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{selectedIDs.length ? `${selectedIDs.length} user${selectedIDs.length === 1 ? '' : 's'} selected from the Users page.` : 'Select recipients from the Users page before sending.'}</p>}{notifAudience === 'single_user' && <FieldLabel label="Recipient"><select required value={specificUID} onChange={(event) => setSpecificUID(event.target.value)} className="form-control"><option value="">Choose a user</option>{users.map((user) => <option key={user.id} value={user.id}>{displayName(user)} · {user.email}</option>)}</select></FieldLabel>}<FieldLabel label="Title"><input value={notifTitle} maxLength={120} onChange={(event) => setNotifTitle(event.target.value)} className="form-control" required /></FieldLabel><FieldLabel label="Message"><textarea value={notifBody} maxLength={300} rows={4} onChange={(event) => setNotifBody(event.target.value)} className="form-control resize-y" required /></FieldLabel><FieldLabel label="Category"><select value={notifType} onChange={(event) => setNotifType(event.target.value)} className="form-control"><option value="update">Product update</option><option value="system">Service update</option><option value="security">Security notice</option></select></FieldLabel><button disabled={sendingNotification} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Send className="h-3.5 w-3.5" />{sendingNotification ? 'Sending…' : 'Send notification'}</button></form>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4"><h2 className="text-sm font-bold">Recent notifications</h2><p className="mt-1 text-xs text-slate-500">Delivery counts are calculated by the server from accepted push tokens.</p></div><div className="space-y-3">{broadcasts.map((broadcast) => <article key={broadcast.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{broadcast.type}</span><h3 className="text-xs font-semibold">{broadcast.title}</h3></div><time className="text-[11px] text-slate-500">{readableDate(broadcast.sent_at)}</time></div><p className="mt-2 text-xs leading-5 text-slate-600">{broadcast.body}</p><p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">Audience: <span className="font-medium text-slate-700">{broadcast.target.replace('_', ' ')}</span> · Delivered: <span className="font-medium text-slate-700">{broadcast.delivered_count}</span></p></article>)}{!broadcasts.length && <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500">No notifications have been sent yet.</div>}</div></div>
        </section>}

        {activeTab === 'health' && <section className="space-y-5 p-5 sm:p-8"><div className="grid gap-3 md:grid-cols-3"><Metric label="API service" value={telemetry?.status === 'healthy' ? 'Healthy' : 'Unknown'} note={telemetry?.revision || 'Revision unavailable'} /><Metric label="Database connections" value={telemetry ? `${telemetry.db_pool_acquired}/${telemetry.db_pool_total}` : '—'} note="Active / total pool connections" /><Metric label="Memory in use" value={telemetry ? `${telemetry.memory_alloc_mb.toFixed(1)} MB` : '—'} note="Current API process allocation" /></div><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Operational links</h2><p className="mt-1 text-xs text-slate-500">Open infrastructure consoles in a separate authenticated session.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><HealthLink href={telemetry?.gcp_console_links?.cloud_run || 'https://console.cloud.google.com/'} icon={<Activity className="h-4 w-4" />} title="Cloud Run" description="Service health, revisions and request metrics." /><HealthLink href={telemetry?.gcp_console_links?.neon_console || 'https://console.neon.tech/'} icon={<Database className="h-4 w-4" />} title="Database" description="Postgres operations and database access." /></div></div></section>}
      </main>

      {selectedUser && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"><section role="dialog" aria-modal="true" aria-label="Manage user" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 pb-4"><div><h2 className="text-sm font-bold">Manage user</h2><p className="mt-1 text-xs text-slate-500">{selectedUser.email}</p></div><button onClick={() => setSelectedUser(null)} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="space-y-4 py-5"><div className="grid grid-cols-2 gap-3 text-xs"><Info label="Joined" value={readableDate(selectedUser.created_at)} /><Info label="Notifications" value={selectedUser.push_ready ? 'Enabled' : 'Not enabled'} /></div><FieldLabel label="Subscription"><select value={inspectPlan} onChange={(event) => setInspectPlan(event.target.value as 'pro' | 'starter_free')} className="form-control"><option value="starter_free">Free</option><option value="pro">Pro</option></select></FieldLabel><FieldLabel label="Account status"><select value={inspectStatus} onChange={(event) => setInspectStatus(event.target.value as 'active' | 'suspended' | 'flagged')} className="form-control"><option value="active">Active</option><option value="flagged">Flagged for review</option><option value="suspended">Suspended</option></select></FieldLabel></div><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button onClick={() => setSelectedUser(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Cancel</button><button onClick={saveUser} disabled={savingUser} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingUser ? 'Saving…' : 'Save changes'}</button></div></section></div>}
    </div>
  );
};

function Metric({ label, value, note, emphasis }: { label: string; value: string | number; note: string; emphasis?: 'warn' }) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold tracking-tight ${emphasis === 'warn' ? 'text-amber-700' : 'text-slate-950'}`}>{value}</p><p className="mt-1 text-[11px] text-slate-500">{note}</p></div>; }
function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-slate-700"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function PlanBadge({ plan }: { plan: User['plan'] }) { return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${plan === 'pro' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{plan === 'pro' ? 'Pro' : 'Free'}</span>; }
function StatusBadge({ status }: { status: User['status'] }) { const styles = status === 'active' ? 'bg-emerald-500' : status === 'flagged' ? 'bg-amber-500' : 'bg-rose-500'; return <span className="inline-flex items-center gap-1.5 text-[11px] font-medium capitalize text-slate-700"><span className={`h-1.5 w-1.5 rounded-full ${styles}`} />{status || 'active'}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-medium text-slate-800">{value}</p></div>; }
function HealthLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) { return <a href={href} target="_blank" rel="noreferrer" className="flex items-start justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-400"><div><p className="flex items-center gap-2 text-xs font-semibold">{icon}{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><ExternalLink className="h-4 w-4 text-slate-400" /></a>; }
