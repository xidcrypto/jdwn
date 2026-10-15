'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  Eraser,
  Eye,
  Film,
  Globe,
  Info,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Users,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useConfirm } from './ConfirmProvider';

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

interface ProxyRow {
  id: number;
  proxy: string;
  enabled: boolean;
  failCount: number;
  source: string;
  lastTestOk: boolean | null;
  lastTestAt: string | null;
}

interface ExtractData {
  videoId: string;
  title: string;
  videoUrl: string;
  thumb: string | null;
  expiresAt: string | null;
  proxyId: number | null;
  proxy: string;
}

type ApiOpts = RequestInit & { headers?: Record<string, string> };
type View = 'dashboard' | 'proxies' | 'extract' | 'settings';
type ToastType = 'ok' | 'err' | 'info';

interface AppSettings {
  siteName: string;
  allowedDomains: string[];
  allowAllDomains: boolean;
  publicEnabled: boolean;
}

interface DailyPoint {
  date: string;
  visits: number;
  extracts: number;
  downloads: number;
}

interface StatsData {
  uniqueVisitors: number;
  totalHits: number;
  visitsToday: number;
  visitorsToday: number;
  extractsTotal: number;
  extractsOk: number;
  extractsFailed: number;
  downloadsTotal: number;
  proxyTotal: number;
  proxyActive: number;
  proxyDisabled: number;
  activeSessions: number;
  daily: DailyPoint[];
  activity: Array<{
    id: number;
    type: string;
    detail: string | null;
    ok: boolean;
    createdAt: string;
  }>;
}

interface ToastItemData {
  id: number;
  type: ToastType;
  title: string;
  msg?: string;
}

const TOKEN_KEY = 'jw_token';

function fmtDate(v: string | null): string {
  if (!v) return '—';
  return v.replace('T', ' ').slice(0, 19);
}

/* ------------------------------------------------------------------ */
/* Hooks: count-up + toasts                                            */
/* ------------------------------------------------------------------ */

function useCountUp(value: number, duration = 650): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

function useToasts() {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const idRef = useRef(0);

  const push = useCallback((type: ToastType, title: string, msg?: string) => {
    setToasts((a) => [...a, { id: ++idRef.current, type, title, msg }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((a) => a.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, remove };
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function ToastItem({ t, onClose }: { t: ToastItemData; onClose: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const life = t.type === 'err' ? 6000 : 4200;

  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), life);
    const b = setTimeout(() => onClose(t.id), life + 320);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [life, onClose, t.id]);

  const Icon = t.type === 'ok' ? CircleCheck : t.type === 'err' ? CircleAlert : Info;

  return (
    <div className={`toast ${t.type} ${leaving ? 'leaving' : ''}`} role="status">
      <Icon className="toast-icon" size={18} />
      <div className="toast-body">
        <div className="toast-title">{t.title}</div>
        {t.msg ? <div className="toast-msg">{t.msg}</div> : null}
      </div>
      <button className="toast-close" onClick={() => onClose(t.id)} aria-label="Tutup">
        <X size={15} />
      </button>
    </div>
  );
}

function ToastStack({
  toasts,
  remove,
}: {
  toasts: ToastItemData[];
  remove: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onClose={remove} />
      ))}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'accent',
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: 'accent' | 'ok' | 'err';
}) {
  const n = useCountUp(value);
  return (
    <div className="card stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="stat-num">{n}</div>
        <div className="stat-lbl">{label}</div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  sub?: string;
}) {
  const n = useCountUp(value);
  return (
    <div className="card mini-stat">
      <div className="mini-icon">
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="mini-num">{n}</div>
        <div className="mini-lbl">{label}</div>
        {sub ? <div className="mini-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="empty">
      <Server size={40} />
      <h3>{title}</h3>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main app                                                            */
/* ------------------------------------------------------------------ */

export default function AdminApp() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [view, setView] = useState<View>('dashboard');

  const [proxies, setProxies] = useState<ProxyRow[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(false);
  const [busy, setBusy] = useState<string>('');

  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [liUser, setLiUser] = useState('');
  const [liPass, setLiPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [liBusy, setLiBusy] = useState(false);

  const [pxOne, setPxOne] = useState('');
  const [pxBulk, setPxBulk] = useState('');
  const [exUrl, setExUrl] = useState('');
  const [exBusy, setExBusy] = useState(false);
  const [exData, setExData] = useState<ExtractData | null>(null);
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');

  const { toasts, push, remove } = useToasts();
  const confirm = useConfirm();

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const logoutLocal = useCallback(() => {
    setToken('');
    setUsername('');
    setName('');
    setEmail('');
    setProxies([]);
    setStats(null);
    setSettings(null);
    setExData(null);
    setView('dashboard');
    if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  }, []);

  const api = useCallback(
    async <T,>(path: string, opts: ApiOpts = {}): Promise<T> => {
      const t = tokenRef.current;
      const r = await fetch(path, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: 'Bearer ' + t } : {}),
          ...(opts.headers || {}),
        },
      });
      let data: Record<string, unknown> = {};
      try {
        data = await r.json();
      } catch {
        /* bukan JSON */
      }
      if (r.status === 401) {
        logoutLocal();
        throw new Error('Sesi habis, silakan login ulang');
      }
      if (!r.ok) throw new Error((data.error as string) || 'HTTP ' + r.status);
      return data as T;
    },
    [logoutLocal],
  );

  const loadProxies = useCallback(async () => {
    setProxiesLoading(true);
    try {
      const rows = await api<ProxyRow[]>('/api/proxies');
      setProxies(rows);
    } catch (e) {
      push('err', 'Gagal memuat proxy', (e as Error).message);
    } finally {
      setProxiesLoading(false);
    }
  }, [api, push]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const d = await api<StatsData>('/api/stats');
      setStats(d);
    } catch (e) {
      push('err', 'Gagal memuat statistik', (e as Error).message);
    } finally {
      setStatsLoading(false);
    }
  }, [api, push]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const d = await api<AppSettings>('/api/settings');
      setSettings(d);
    } catch (e) {
      push('err', 'Gagal memuat pengaturan', (e as Error).message);
    } finally {
      setSettingsLoading(false);
    }
  }, [api, push]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : '';
    (async () => {
      try {
        const st = await fetch('/api/auth/install');
        const status = (await st.json().catch(() => ({}))) as { installed?: boolean };
        if (!status.installed) {
          router.replace('/install');
          return;
        }
      } catch {
        /* lanjut; biarkan halaman login tampil */
      }

      if (!saved) {
        setBooting(false);
        return;
      }
      setToken(saved);
      try {
        const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + saved } });
        if (!r.ok) throw new Error('invalid');
        const d = (await r.json()) as { username: string; name?: string; email?: string };
        setUsername(d.username);
        setName(d.name || '');
        setEmail(d.email || '');
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken('');
      } finally {
        setBooting(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (token) {
      loadProxies();
      loadStats();
      loadSettings();
    }
  }, [token, loadProxies, loadStats, loadSettings]);

  /* ---------------- auth ---------------- */

  const doLogin = async () => {
    setLiBusy(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: liUser.trim(), password: liPass }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        token?: string;
        username?: string;
        name?: string;
        email?: string;
        error?: string;
      };
      if (!r.ok || !data.token) throw new Error(data.error || 'HTTP ' + r.status);
      setToken(data.token);
      setUsername(data.username || '');
      setName(data.name || '');
      setEmail(data.email || '');
      localStorage.setItem(TOKEN_KEY, data.token);
      setLiPass('');
      push('ok', 'Selamat datang', 'Login berhasil. Semoga harimu menyenangkan!');
    } catch (e) {
      push('err', 'Login gagal', (e as Error).message);
    } finally {
      setLiBusy(false);
    }
  };

  const doLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* abaikan */
    }
    logoutLocal();
    push('info', 'Keluar', 'Kamu telah keluar dari sesi ini.');
  };

  /* ---------------- proxies ---------------- */

  const addOne = async () => {
    const v = pxOne.trim();
    if (!v) return push('info', 'Perlu isian', 'Isi dulu alamat proxy-nya.');
    try {
      await api('/api/proxies', { method: 'POST', body: JSON.stringify({ proxy: v }) });
      setPxOne('');
      push('ok', 'Proxy ditambahkan', v);
      loadProxies();
    } catch (e) {
      push('err', 'Gagal menambah proxy', (e as Error).message);
    }
  };

  const addBulk = async () => {
    if (!pxBulk.trim()) return push('info', 'Perlu isian', 'Textarea bulk masih kosong.');
    setBusy('bulk');
    try {
      const d = await api<{ added: number; skipped: number; total: number }>('/api/proxies/bulk', {
        method: 'POST',
        body: JSON.stringify({ text: pxBulk }),
      });
      setPxBulk('');
      push('ok', 'Bulk selesai', `${d.added} ditambahkan, ${d.skipped} dilewati dari ${d.total} baris.`);
      loadProxies();
    } catch (e) {
      push('err', 'Bulk gagal', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const scrapeNow = async () => {
    setBusy('scrape');
    try {
      const d = await api<{
        added: number;
        skipped: number;
        total: number;
        perSource: Array<{ ok: boolean; count: number }>;
      }>('/api/proxies/scrape', { method: 'POST', body: '{}' });
      const src = (d.perSource || []).map((s) => (s.ok ? `${s.count} ok` : 'gagal')).join(', ');
      push('ok', 'Scrape selesai', `${d.added} baru, ${d.skipped} duplikat (${d.total} ditemukan) — [${src}]`);
      loadProxies();
    } catch (e) {
      push('err', 'Scrape gagal', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const testAll = async () => {
    const ok = await confirm({
      title: 'Uji semua proxy aktif?',
      message:
        'Proxy yang gagal akan dinonaktifkan otomatis. Proses ini bisa memakan beberapa menit untuk ratusan proxy.',
      confirmText: 'Mulai uji',
      icon: 'question',
    });
    if (!ok) return;
    setBusy('test');
    try {
      const d = await api<{ tested: number; ok: number; failed: number }>('/api/proxies/test-all', {
        method: 'POST',
        body: JSON.stringify({ limit: 500, concurrency: 10 }),
      });
      push('ok', 'Uji massal selesai', `${d.tested} diuji — ${d.ok} OK, ${d.failed} gagal.`);
      loadProxies();
    } catch (e) {
      push('err', 'Uji massal gagal', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const pruneDead = async () => {
    const ok = await confirm({
      title: 'Hapus proxy yang gagal?',
      message: 'Semua proxy hasil scrape dengan riwayat gagal ≥5× akan dihapus permanen.',
      confirmText: 'Hapus gagal ≥5×',
      tone: 'danger',
      icon: 'warning',
    });
    if (!ok) return;
    setBusy('prune');
    try {
      const d = await api<{ deleted: number }>('/api/proxies/prune', {
        method: 'POST',
        body: JSON.stringify({ minFail: 5, onlyScraped: true }),
      });
      push('ok', 'Pembersihan selesai', `${d.deleted} proxy mati dihapus.`);
      loadProxies();
    } catch (e) {
      push('err', 'Gagal menghapus', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const delProxy = async (id: number) => {
    const ok = await confirm({
      title: `Hapus proxy #${id}?`,
      message: 'Proxy ini akan dihapus permanen dari database.',
      confirmText: 'Hapus',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api('/api/proxies/' + id, { method: 'DELETE' });
      push('ok', 'Proxy dihapus', `#${id}`);
      loadProxies();
      loadStats();
    } catch (e) {
      push('err', 'Gagal menghapus', (e as Error).message);
    }
  };

  const deleteAllProxies = async () => {
    if (!proxies.length) return push('info', 'Tidak ada proxy', 'Daftar proxy sudah kosong.');
    const ok = await confirm({
      title: `Hapus semua proxy?`,
      message: `${proxies.length} proxy akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
      confirmText: `Hapus ${proxies.length} proxy`,
      tone: 'danger',
    });
    if (!ok) return;
    setBusy('delete-all');
    try {
      const d = await api<{ deleted: number }>('/api/proxies?scope=all', { method: 'DELETE' });
      push('ok', 'Semua proxy dihapus', `${d.deleted} proxy dihapus.`);
      loadProxies();
      loadStats();
    } catch (e) {
      push('err', 'Gagal menghapus semua', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const toggleProxy = async (id: number, enabled: boolean) => {
    setProxies((a) => a.map((r) => (r.id === id ? { ...r, enabled } : r)));
    try {
      await api('/api/proxies/' + id, { method: 'PATCH', body: JSON.stringify({ enabled }) });
    } catch (e) {
      push('err', 'Gagal mengubah status', (e as Error).message);
      loadProxies();
    }
  };

  const testProxy = async (id: number) => {
    setBusy('test-' + id);
    try {
      const d = await api<{ ok: boolean; ms?: number; status?: number; error?: string }>(
        '/api/proxies/' + id + '/test',
        { method: 'POST' },
      );
      if (d.ok) push('ok', `Proxy #${id} OK`, `${d.ms} ms · HTTP ${d.status}`);
      else push('err', `Proxy #${id} gagal`, d.error || 'unknown');
      loadProxies();
    } catch (e) {
      push('err', 'Uji proxy gagal', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  /* ---------------- extract ---------------- */

  const doExtract = async () => {
    const url = exUrl.trim();
    if (!/^https?:\/\//i.test(url)) return push('info', 'URL tidak valid', 'Isi URL embed jwplyr yang benar.');
    setExBusy(true);
    setExData(null);
    try {
      const d = await api<ExtractData>('/api/extract', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setExData(d);
      push('ok', 'Ekstraksi berhasil', d.title || d.videoId);
    } catch (e) {
      push('err', 'Ekstraksi gagal', (e as Error).message);
    } finally {
      setExBusy(false);
    }
  };

  const copyVideoUrl = () => {
    if (!exData) return;
    navigator.clipboard.writeText(exData.videoUrl).then(
      () => push('ok', 'URL disalin', 'URL video ada di clipboard.'),
      () => push('err', 'Gagal menyalin', 'Perangkat menolak akses clipboard.'),
    );
  };

  /* ---------------- settings ---------------- */

  const cleanDomain = (raw: string): string => {
    let d = String(raw || '').trim().toLowerCase();
    d = d.replace(/^[a-z]+:\/\//, '').replace(/^\/\//, '');
    d = d.split('/')[0].split('?')[0].split('#')[0];
    d = (d.split('@').pop() || d).replace(/:\d+$/, '').replace(/^\*\./, '').replace(/^\./, '');
    return /^[a-z0-9.-]+$/.test(d) && d.includes('.') ? d : '';
  };

  const saveAppSettings = async (patch: Partial<AppSettings>, silent = false) => {
    setSavingSettings(true);
    try {
      const d = await api<{ ok: boolean; settings: AppSettings }>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      setSettings(d.settings);
      if (!silent) push('ok', 'Pengaturan disimpan', 'Perubahan langsung diterapkan.');
      return true;
    } catch (e) {
      push('err', 'Gagal menyimpan', (e as Error).message);
      return false;
    } finally {
      setSavingSettings(false);
    }
  };

  const addDomain = async () => {
    if (!settings) return;
    const d = cleanDomain(domainInput);
    if (!d) return push('info', 'Domain tidak valid', 'Contoh: contoh.com');
    if (settings.allowedDomains.includes(d)) return push('info', 'Sudah ada', `${d} sudah terdaftar.`);
    const ok = await saveAppSettings({ allowedDomains: [...settings.allowedDomains, d] }, true);
    if (ok) {
      setDomainInput('');
      push('ok', 'Domain ditambahkan', d);
    }
  };

  const removeDomain = async (d: string) => {
    if (!settings) return;
    await saveAppSettings({ allowedDomains: settings.allowedDomains.filter((x) => x !== d) }, true);
  };

  const changePw = async () => {
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword: pwOld, newPassword: pwNew }),
      });
      push('ok', 'Password diganti', 'Silakan login ulang dengan password baru.');
      setTimeout(() => {
        logoutLocal();
        setPwOld('');
        setPwNew('');
      }, 1500);
    } catch (e) {
      push('err', 'Gagal ganti password', (e as Error).message);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const toastStack = <ToastStack toasts={toasts} remove={remove} />;

  if (booting) {
    return (
      <>
        {toastStack}
        <div className="login-shell">
          <div className="fade-in" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <Loader2 className="spinner" size={30} />
            <div style={{ marginTop: 12, fontSize: 13 }}>Memuat sesi…</div>
          </div>
        </div>
      </>
    );
  }

  if (!token) {
    return (
      <>
        {toastStack}
        <div className="login-shell">
          <form
            className="card login-card scale-in"
            onSubmit={(e) => {
              e.preventDefault();
              doLogin();
            }}
          >
            <div className="login-logo">
              <Film size={28} />
            </div>
            <div className="login-title">jwplyr Extractor</div>
            <div className="login-sub">Masuk ke panel admin untuk mengelola proxy &amp; video.</div>

            <div className="field">
              <label className="label" htmlFor="liUser">
                <User size={13} /> Username
              </label>
              <input
                id="liUser"
                className="input"
                type="text"
                value={liUser}
                autoComplete="username"
                placeholder="admin"
                onChange={(e) => setLiUser(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="liPass">
                <KeyRound size={13} /> Password
              </label>
              <div className="input-wrap">
                <input
                  id="liPass"
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  value={liPass}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onChange={(e) => setLiPass(e.target.value)}
                />
                <button
                  type="button"
                  className="input-affix"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPass ? <ShieldCheck size={16} /> : <KeyRound size={16} />}
                </button>
              </div>
            </div>

            <button className="btn block signin" type="submit" disabled={liBusy} style={{ marginTop: 6 }}>
              {liBusy ? <Loader2 className="spinner" size={17} /> : <LogIn size={17} />}
              {liBusy ? 'Memproses…' : 'Masuk'}
            </button>

            <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>
              Akun dibuat otomatis saat pertama kali dijalankan.
            </p>
          </form>
        </div>
      </>
    );
  }

  const navItems: { key: View; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'proxies', label: 'Proxy', icon: Server, count: proxies.length },
    { key: 'extract', label: 'Extract', icon: Play },
    { key: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const viewMeta: Record<View, { title: string; sub: string; icon: LucideIcon }> = {
    dashboard: {
      title: 'Dashboard',
      sub: 'Ringkasan pengunjung, ekstraksi, dan status layanan.',
      icon: LayoutDashboard,
    },
    proxies: {
      title: 'Manajemen Proxy',
      sub: 'Kelola pool proxy untuk ekstraksi dengan failover otomatis.',
      icon: Server,
    },
    extract: {
      title: 'Ekstraksi Video',
      sub: 'Ambil URL video asli langsung dari halaman embed.',
      icon: Play,
    },
    settings: {
      title: 'Pengaturan',
      sub: 'Situs yang didukung, keamanan akun, dan endpoint API.',
      icon: Settings,
    },
  };

  const total = proxies.length;
  const active = proxies.filter((r) => r.enabled).length;
  const failSum = proxies.reduce((a, r) => a + (r.failCount || 0), 0);
  const meta = viewMeta[view];

  const maxDaily = Math.max(1, ...(stats?.daily.flatMap((d) => [d.visits, d.extracts, d.downloads]) ?? [1]));
  const dayLabel = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });

  const dlUrl = exData
    ? '/api/download?url=' +
      encodeURIComponent(exUrl.trim()) +
      '&token=' +
      encodeURIComponent(token) +
      '&download=1'
    : '#';
  const playerUrl = exData
    ? '/api/download?url=' + encodeURIComponent(exUrl.trim()) + '&token=' + encodeURIComponent(token)
    : '';

  return (
    <>
      {toastStack}
      <div className="app">
        {/* Sidebar (desktop) */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <Film size={22} />
            </div>
            <div>
              <div className="brand-name">
                jwplyr <span>Extractor</span>
              </div>
              <div className="brand-sub">Admin Panel</div>
            </div>
          </div>

          <nav className="nav">
            <div className="nav-label-head">Menu</div>
            {navItems.map((it) => (
              <button
                key={it.key}
                className={`nav-item ${view === it.key ? 'active' : ''}`}
                onClick={() => setView(it.key)}
              >
                <it.icon size={18} />
                <span>{it.label}</span>
                {typeof it.count === 'number' && it.count > 0 ? (
                  <span className="nav-count">{it.count}</span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="who">
              <div className="who-avatar">{((name || username)[0] || 'A').toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div className="who-name">{name || username || 'admin'}</div>
                <div className="who-role" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="dot live" style={{ color: 'var(--ok)' }} /> Online
                </div>
              </div>
            </div>
            <a className="btn ghost block" href="/" target="_blank" rel="noreferrer">
              <Globe size={16} /> Lihat Situs Publik
            </a>
            <button className="btn ghost block" onClick={doLogout}>
              <LogOut size={16} /> Keluar
            </button>
          </div>
        </aside>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Topbar (mobile) */}
          <header className="topbar-mobile">
            <div className="brand-mark">
              <Film size={18} />
            </div>
            <div>
              <div className="t-title">jwplyr Extractor</div>
              <div className="t-sub">{name || username || 'admin'}</div>
            </div>
            <div className="spacer" />
            <button className="btn ghost icon" onClick={doLogout} aria-label="Keluar">
              <LogOut size={16} />
            </button>
          </header>

          <main className="main">
            <div className="content">
              <div key={view} className="animate-in">
                <div className="page-head">
                  <h1 className="page-title">
                    <span className="title-icon">
                      <meta.icon size={21} />
                    </span>
                    {meta.title}
                  </h1>
                  <p className="page-sub">{meta.sub}</p>
                </div>

                {/* ---------------- DASHBOARD ---------------- */}
                {view === 'dashboard' ? (
                  <>
                    <div className="grid cols-4" style={{ marginBottom: 18 }}>
                      <StatCard icon={Users} label="Pengunjung unik" value={stats?.uniqueVisitors ?? 0} />
                      <StatCard icon={Eye} label="Total kunjungan" value={stats?.totalHits ?? 0} tone="ok" />
                      <StatCard icon={Play} label="Total ekstraksi" value={stats?.extractsTotal ?? 0} />
                      <StatCard icon={Download} label="Total download" value={stats?.downloadsTotal ?? 0} tone="ok" />
                    </div>

                    <div className="grid cols-4" style={{ marginBottom: 18 }}>
                      <MiniStat
                        icon={TrendingUp}
                        label="Kunjungan hari ini"
                        value={stats?.visitsToday ?? 0}
                        sub={`${stats?.visitorsToday ?? 0} pengunjung`}
                      />
                      <MiniStat
                        icon={CircleAlert}
                        label="Ekstraksi gagal"
                        value={stats?.extractsFailed ?? 0}
                        sub={`${stats?.extractsOk ?? 0} sukses`}
                      />
                      <MiniStat
                        icon={Server}
                        label="Proxy aktif"
                        value={stats?.proxyActive ?? 0}
                        sub={`${stats?.proxyTotal ?? 0} total`}
                      />
                      <MiniStat
                        icon={ShieldCheck}
                        label="Sesi admin aktif"
                        value={stats?.activeSessions ?? 0}
                        sub="perangkat login"
                      />
                    </div>

                    <div className="card d1 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <BarChart3 size={16} />
                        </span>
                        <h2>Aktivitas 7 Hari</h2>
                        <div className="spacer" />
                        <button className="btn ghost sm" onClick={loadStats} disabled={statsLoading}>
                          <RefreshCw size={14} className={statsLoading ? 'spinner' : ''} /> Muat ulang
                        </button>
                      </div>

                      <div className="chart-legend">
                        <span><i className="sw visits" /> Kunjungan</span>
                        <span><i className="sw extracts" /> Ekstraksi</span>
                        <span><i className="sw downloads" /> Download</span>
                      </div>

                      {statsLoading && !stats ? (
                        <div className="skeleton" style={{ height: 180, borderRadius: 12 }} />
                      ) : (
                        <div className="chart">
                          {(stats?.daily ?? []).map((d) => (
                            <div className="chart-col" key={d.date} title={`${d.date}\nKunjungan: ${d.visits}\nEkstraksi: ${d.extracts}\nDownload: ${d.downloads}`}>
                              <div className="chart-bars">
                                <span className="bar visits" style={{ height: `${(d.visits / maxDaily) * 100}%` }} />
                                <span className="bar extracts" style={{ height: `${(d.extracts / maxDaily) * 100}%` }} />
                                <span className="bar downloads" style={{ height: `${(d.downloads / maxDaily) * 100}%` }} />
                              </div>
                              <div className="chart-x">{dayLabel(d.date)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="card d2 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <Activity size={16} />
                        </span>
                        <h2>Aktivitas Terbaru</h2>
                      </div>
                      {!stats?.activity.length ? (
                        <p className="hint">Belum ada aktivitas terekam.</p>
                      ) : (
                        <ul className="feed">
                          {stats.activity.map((a) => (
                            <li key={a.id}>
                              <span className={`feed-dot ${a.type} ${a.ok ? '' : 'bad'}`} />
                              <div className="feed-body">
                                <div className="feed-title">
                                  {a.type === 'extract'
                                    ? a.ok
                                      ? 'Ekstraksi berhasil'
                                      : 'Ekstraksi gagal'
                                    : a.type === 'download'
                                      ? 'Video diunduh'
                                      : 'Kunjungan'}
                                </div>
                                {a.detail ? <div className="feed-detail mono">{a.detail}</div> : null}
                              </div>
                              <time className="feed-time">{fmtDate(a.createdAt)}</time>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : null}

                {/* ---------------- PROXIES ---------------- */}
                {view === 'proxies' ? (
                  <>
                    <div className="grid cols-3" style={{ marginBottom: 18 }}>
                      <StatCard icon={Server} label="Total proxy" value={total} />
                      <StatCard icon={Wifi} label="Aktif" value={active} tone="ok" />
                      <StatCard icon={Activity} label="Total gagal (fail count)" value={failSum} tone="err" />
                    </div>

                    <div className="card d1 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <Plus size={16} />
                        </span>
                        <h2>Tambah Proxy</h2>
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="pxOne">
                          <Link2 size={13} /> Proxy tunggal
                        </label>
                        <div className="input-group">
                          <input
                            id="pxOne"
                            className="input"
                            type="text"
                            value={pxOne}
                            placeholder="http://user:pass@host:port — awalan http:// boleh dihilangkan"
                            onChange={(e) => setPxOne(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addOne();
                            }}
                          />
                          <button className="btn" onClick={addOne}>
                            <Plus size={16} /> Tambah
                          </button>
                        </div>
                      </div>

                      <div className="field" style={{ marginBottom: 0 }}>
                        <label className="label" htmlFor="pxBulk">
                          <Upload size={13} /> Bulk — satu proxy per baris
                        </label>
                        <textarea
                          id="pxBulk"
                          className="textarea"
                          value={pxBulk}
                          placeholder={
                            'http://user1:pass1@host1:3128\nsocks5h://user2:pass2@host2:1080\nhost3:8080'
                          }
                          onChange={(e) => setPxBulk(e.target.value)}
                        />
                        <div className="row" style={{ marginTop: 12 }}>
                          <button className="btn ghost" onClick={addBulk} disabled={busy === 'bulk'}>
                            {busy === 'bulk' ? (
                              <Loader2 className="spinner" size={16} />
                            ) : (
                              <Upload size={16} />
                            )}
                            {busy === 'bulk' ? 'Memproses…' : 'Tambah bulk'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="card d2 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <Sparkles size={16} />
                        </span>
                        <h2>Proxy Gratis (auto-scrape)</h2>
                      </div>
                      <p className="hint" style={{ marginBottom: 14 }}>
                        Mengambil daftar proxy HTTP gratis dari sumber publik lalu menyimpannya ke
                        database (duplikat otomatis dilewati). Kualitas campur aduk — jalankan{' '}
                        <b>Uji massal</b> setelahnya untuk menonaktifkan yang mati.
                      </p>
                      <div className="row">
                        <button className="btn" onClick={scrapeNow} disabled={busy === 'scrape'}>
                          {busy === 'scrape' ? (
                            <Loader2 className="spinner" size={16} />
                          ) : (
                            <Globe size={16} />
                          )}
                          Scrape sekarang
                        </button>
                        <button className="btn ghost" onClick={testAll} disabled={busy === 'test'}>
                          {busy === 'test' ? <Loader2 className="spinner" size={16} /> : <Zap size={16} />}
                          Uji massal
                        </button>
                        <button className="btn danger" onClick={pruneDead} disabled={busy === 'prune'}>
                          {busy === 'prune' ? (
                            <Loader2 className="spinner" size={16} />
                          ) : (
                            <Eraser size={16} />
                          )}
                          Hapus gagal ≥5×
                        </button>
                        {busy ? (
                          <span className="status-line">
                            <Loader2 className="spinner" size={14} /> bekerja…
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="card d3 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <ListChecks size={16} />
                        </span>
                        <h2>Daftar Proxy</h2>
                        <div className="spacer" />
                        <button
                          className="btn danger sm"
                          onClick={deleteAllProxies}
                          disabled={busy === 'delete-all' || proxiesLoading || !proxies.length}
                          title="Hapus semua proxy"
                        >
                          {busy === 'delete-all' ? (
                            <Loader2 className="spinner" size={14} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Hapus semua
                        </button>
                        <button
                          className="btn ghost sm"
                          onClick={loadProxies}
                          disabled={proxiesLoading}
                        >
                          <RefreshCw size={14} className={proxiesLoading ? 'spinner' : ''} /> Muat ulang
                        </button>
                      </div>

                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Proxy</th>
                              <th>Sumber</th>
                              <th>Status</th>
                              <th>Fail</th>
                              <th>Tes terakhir</th>
                              <th>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {proxiesLoading && !proxies.length ? (
                              Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i}>
                                  {Array.from({ length: 7 }).map((__, j) => (
                                    <td key={j}>
                                      <div className="skeleton" style={{ height: 16, width: j === 1 ? 160 : 60 }} />
                                    </td>
                                  ))}
                                </tr>
                              ))
                            ) : !proxies.length ? (
                              <tr>
                                <td colSpan={7}>
                                  <EmptyState
                                    title="Belum ada proxy"
                                    sub="Tambahkan manual atau scrape proxy gratis di atas."
                                  />
                                </td>
                              </tr>
                            ) : (
                              proxies.map((r) => (
                                <tr key={r.id}>
                                  <td data-label="#">{r.id}</td>
                                  <td data-label="Proxy" className="mono">
                                    {r.proxy}
                                  </td>
                                  <td data-label="Sumber">
                                    <span className={`badge ${r.source === 'scrape' ? 'neutral' : 'neutral'}`}>
                                      {r.source === 'scrape' ? (
                                        <>
                                          <Globe size={11} /> gratis
                                        </>
                                      ) : (
                                        <>
                                          <Plus size={11} /> manual
                                        </>
                                      )}
                                    </span>
                                  </td>
                                  <td data-label="Status">
                                    <div className="row tight nowrap" style={{ justifyContent: 'flex-end' }}>
                                      {r.enabled ? (
                                        <span className="badge on">
                                          <span className="dot" /> aktif
                                        </span>
                                      ) : (
                                        <span className="badge off">
                                          <span className="dot" /> nonaktif
                                        </span>
                                      )}
                                      {r.lastTestOk === true ? (
                                        <span className="badge on">tes ok</span>
                                      ) : r.lastTestOk === false ? (
                                        <span className="badge bad">tes gagal</span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td data-label="Fail">{r.failCount || 0}</td>
                                  <td data-label="Tes terakhir" className="faint" style={{ fontSize: 12 }}>
                                    {fmtDate(r.lastTestAt)}
                                  </td>
                                  <td data-label="Aksi">
                                    <div className="row tight nowrap" style={{ justifyContent: 'flex-end' }}>
                                      <button
                                        className="btn ghost icon sm"
                                        title="Uji proxy"
                                        onClick={() => testProxy(r.id)}
                                        disabled={busy === 'test-' + r.id}
                                      >
                                        {busy === 'test-' + r.id ? (
                                          <Loader2 className="spinner" size={14} />
                                        ) : (
                                          <Zap size={14} />
                                        )}
                                      </button>
                                      <button
                                        className={`switch ${r.enabled ? 'on' : ''}`}
                                        title={r.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                                        onClick={() => toggleProxy(r.id, !r.enabled)}
                                        aria-label="Ubah status"
                                      />
                                      <button
                                        className="btn danger icon sm"
                                        title="Hapus"
                                        onClick={() => delProxy(r.id)}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}

                {/* ---------------- EXTRACT ---------------- */}
                {view === 'extract' ? (
                  <div className="card animate-in">
                    <div className="card-head">
                      <span className="head-icon">
                        <Link2 size={16} />
                      </span>
                      <h2>URL Embed</h2>
                    </div>
                    <div className="input-group">
                      <input
                        className="input"
                        type="text"
                        value={exUrl}
                        placeholder="https://jwplyr.com/e/xxxx"
                        onChange={(e) => setExUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') doExtract();
                        }}
                      />
                      <button className="btn" onClick={doExtract} disabled={exBusy}>
                        {exBusy ? <Loader2 className="spinner" size={16} /> : <Play size={16} />}
                        {exBusy ? 'Memproses…' : 'Extract'}
                      </button>
                    </div>

                    {exData ? (
                      <div className="animate-in d1" style={{ marginTop: 22 }}>
                        <div className="grid cols-2" style={{ marginBottom: 4 }}>
                          <div>
                            <div className="kv">
                              <b>Judul</b>
                              <span className="val">{exData.title || '—'}</span>
                            </div>
                            <div className="kv">
                              <b>Video ID</b>
                              <span className="val mono">{exData.videoId || '—'}</span>
                            </div>
                          </div>
                          <div>
                            <div className="kv">
                              <b>Proxy</b>
                              <span className="val">
                                {exData.proxyId ? `#${exData.proxyId} ` : ''}
                                {exData.proxy || '—'}
                              </span>
                            </div>
                            <div className="kv">
                              <b>Kedaluwarsa</b>
                              <span className="val">
                                {exData.expiresAt
                                  ? new Date(exData.expiresAt).toLocaleString('id-ID')
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <label className="label" style={{ marginTop: 14 }}>
                          <Link2 size={13} /> URL video asli
                        </label>
                        <div className="code-box">{exData.videoUrl}</div>

                        <div className="row" style={{ marginTop: 14 }}>
                          <button className="btn ghost" onClick={copyVideoUrl}>
                            <Copy size={16} /> Salin URL
                          </button>
                          <a className="btn" href={dlUrl}>
                            <Download size={16} /> Download MP4
                          </a>
                        </div>

                        <div className="video-frame">
                          <div className="video-badge">
                            <span className="dot live" style={{ color: 'var(--ok)' }} /> Streaming
                          </div>
                          <video src={playerUrl} controls playsInline poster={exData.thumb || undefined} />
                        </div>
                      </div>
                    ) : (
                      <div className="empty" style={{ paddingTop: 34 }}>
                        <Play size={38} />
                        <h3>Belum ada hasil</h3>
                        <p>Tempel URL embed jwplyr lalu tekan Extract.</p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* ---------------- SETTINGS ---------------- */}
                {view === 'settings' ? (
                  <>
                    <div className="card d1 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <Globe size={16} />
                        </span>
                        <h2>Situs &amp; Domain Didukung</h2>
                        <div className="spacer" />
                        {settingsLoading ? (
                          <span className="status-line">
                            <Loader2 className="spinner" size={14} /> memuat…
                          </span>
                        ) : null}
                      </div>

                      {!settings ? (
                        <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
                      ) : (
                        <>
                          <div className="field">
                            <label className="label" htmlFor="siteName">
                              <Film size={13} /> Nama situs publik
                            </label>
                            <div className="input-group">
                              <input
                                id="siteName"
                                className="input"
                                type="text"
                                value={settings.siteName}
                                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                              />
                              <button
                                className="btn"
                                onClick={() => saveAppSettings({ siteName: settings.siteName })}
                                disabled={savingSettings}
                              >
                                {savingSettings ? (
                                  <Loader2 className="spinner" size={16} />
                                ) : (
                                  <Save size={16} />
                                )}
                                Simpan
                              </button>
                            </div>
                          </div>

                          <div className="switch-row">
                            <div>
                              <div className="switch-title">Situs publik aktif</div>
                              <div className="switch-desc">
                                Jika dimatikan, halaman publik menolak semua permintaan ekstraksi.
                              </div>
                            </div>
                            <button
                              className={`switch ${settings.publicEnabled ? 'on' : ''}`}
                              aria-label="Aktif/nonaktif situs publik"
                              onClick={() =>
                                saveAppSettings({ publicEnabled: !settings.publicEnabled })
                              }
                            />
                          </div>

                          <div className="switch-row">
                            <div>
                              <div className="switch-title">Izinkan semua website</div>
                              <div className="switch-desc">
                                Abaikan daftar domain di bawah dan terima URL dari host mana pun
                                (tidak disarankan).
                              </div>
                            </div>
                            <button
                              className={`switch ${settings.allowAllDomains ? 'on' : ''}`}
                              aria-label="Izinkan semua website"
                              onClick={() =>
                                saveAppSettings({ allowAllDomains: !settings.allowAllDomains })
                              }
                            />
                          </div>

                          <div className={settings.allowAllDomains ? 'domains-block disabled' : 'domains-block'}>
                            <label className="label">
                              <ShieldCheck size={13} /> Domain yang diizinkan
                            </label>
                            <div className="input-group">
                              <input
                                className="input"
                                type="text"
                                value={domainInput}
                                placeholder="contoh.com — otomatis termasuk subdomain"
                                disabled={settings.allowAllDomains}
                                onChange={(e) => setDomainInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addDomain();
                                }}
                              />
                              <button
                                className="btn"
                                onClick={addDomain}
                                disabled={settings.allowAllDomains || savingSettings}
                              >
                                <Plus size={16} /> Tambah
                              </button>
                            </div>

                            <div className="domain-chips">
                              {settings.allowedDomains.length ? (
                                settings.allowedDomains.map((d) => (
                                  <span className="domain-chip" key={d}>
                                    <Globe size={13} /> {d}
                                    <button
                                      type="button"
                                      className="chip-x"
                                      aria-label={`Hapus ${d}`}
                                      onClick={() => removeDomain(d)}
                                      disabled={settings.allowAllDomains}
                                    >
                                      <X size={13} />
                                    </button>
                                  </span>
                                ))
                              ) : (
                                <span className="hint">Belum ada domain. Tambahkan minimal satu.</span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="card d1 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <User size={16} />
                        </span>
                        <h2>Profil Admin</h2>
                      </div>
                      <div className="kv">
                        <b>Nama</b>
                        <span className="val">{name || '—'}</span>
                      </div>
                      <div className="kv">
                        <b>Email</b>
                        <span className="val">{email || '—'}</span>
                      </div>
                      <div className="kv">
                        <b>Username</b>
                        <span className="val mono">{username || '—'}</span>
                      </div>
                    </div>

                    <div className="card d1 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <KeyRound size={16} />
                        </span>
                        <h2>Ganti Password Admin</h2>
                      </div>
                      <div className="grid cols-2">
                        <div className="field">
                          <label className="label" htmlFor="pwOld">
                            <KeyRound size={13} /> Password lama
                          </label>
                          <input
                            id="pwOld"
                            className="input"
                            type="password"
                            value={pwOld}
                            autoComplete="current-password"
                            onChange={(e) => setPwOld(e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label className="label" htmlFor="pwNew">
                            <ShieldCheck size={13} /> Password baru (min. 6 karakter)
                          </label>
                          <input
                            id="pwNew"
                            className="input"
                            type="password"
                            value={pwNew}
                            autoComplete="new-password"
                            onChange={(e) => setPwNew(e.target.value)}
                          />
                        </div>
                      </div>
                      <button className="btn" onClick={changePw}>
                        <ShieldCheck size={16} /> Simpan password baru
                      </button>
                      <p className="hint" style={{ marginTop: 12 }}>
                        Setelah ganti password, semua sesi login (termasuk perangkat ini) akan dihapus
                        dan harus login ulang.
                      </p>
                    </div>

                    <div className="card d2 animate-in">
                      <div className="card-head">
                        <span className="head-icon">
                          <Info size={16} />
                        </span>
                        <h2>Info Server</h2>
                      </div>
                      <div className="kv">
                        <b>Extract</b>
                        <span className="val mono">
                          POST /api/extract · Authorization: Bearer &lt;token&gt;
                        </span>
                      </div>
                      <div className="kv">
                        <b>Download</b>
                        <span className="val mono">
                          GET /api/download?url=&lt;embed&gt;&amp;token=&lt;token&gt;
                        </span>
                      </div>
                      <div className="kv">
                        <b>Status</b>
                        <span className="val">
                          <span className="badge on">
                            <Check size={11} /> Backend aktif
                          </span>
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="mobile-nav">
        {navItems.map((it) => (
          <button key={it.key} className={view === it.key ? 'active' : ''} onClick={() => setView(it.key)}>
            <it.icon size={20} />
            {it.label}
          </button>
        ))}
      </nav>
    </>
  );
}
