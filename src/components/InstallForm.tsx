'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  AtSign,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Film,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';

const TOKEN_KEY = 'jw_token';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const STRENGTH_LABEL = ['Sangat lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'];

export default function InstallForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [siteName, setSiteName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/auth/install')
      .then((r) => r.json())
      .then((d: { installed?: boolean }) => {
        if (d.installed) router.replace('/admin');
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (siteName.trim().length < 2) e.siteName = 'Nama website minimal 2 karakter';
    if (name.trim().length < 2) e.name = 'Nama minimal 2 karakter';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Format email tidak valid';
    if (!USERNAME_RE.test(username.trim()))
      e.username = 'Username 3–32 karakter (huruf, angka, _ . -)';
    if (password.length < 6) e.password = 'Password minimal 6 karakter';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const r = await fetch('/api/auth/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username, password, siteName }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
        fields?: Record<string, string>;
      };
      if (!r.ok || !data.token) {
        setErrors({ ...(data.fields || {}), _: data.error || 'Instalasi gagal' });
        return;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setDone(true);
      setTimeout(() => router.replace('/admin'), 900);
    } catch {
      setErrors({ _: 'Tidak dapat menghubungi server' });
    } finally {
      setBusy(false);
    }
  };

  const strength = scorePassword(password);

  if (checking) {
    return (
      <div className="login-shell">
        <div className="fade-in" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <Loader2 className="spinner" size={30} />
          <div style={{ marginTop: 12, fontSize: 13 }}>Memeriksa status instalasi…</div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="login-shell">
        <div className="card login-card scale-in" style={{ textAlign: 'center' }}>
          <div className="login-logo">
            <Check size={30} />
          </div>
          <div className="login-title">Instalasi Berhasil</div>
          <div className="login-sub" style={{ marginBottom: 0 }}>
            Mengalihkan ke panel admin…
          </div>
          <Loader2 className="spinner" size={22} style={{ marginTop: 18, color: 'var(--accent)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <form className="card login-card scale-in" onSubmit={submit} noValidate>
        <div className="login-logo">
          <Film size={28} />
        </div>
        <div className="login-title">Instalasi Awal</div>
        <div className="login-sub">Beri nama website lalu buat akun admin pertama.</div>

        <div className="install-banner">
          <Sparkles size={15} />
          <span>
            <b style={{ color: 'var(--txt)' }}>Instalasi awal</b> — belum ada admin terdaftar.
          </span>
        </div>

        {errors._ ? (
          <div className="field-error" style={{ marginTop: 0, marginBottom: 14 }}>
            <CircleAlert size={13} /> {errors._}
          </div>
        ) : null}

        <div className="field">
          <label className="label" htmlFor="inSite">
            <Globe size={13} /> Nama website
          </label>
          <input
            id="inSite"
            className={`input ${errors.siteName ? 'invalid' : ''}`}
            type="text"
            value={siteName}
            autoComplete="organization"
            placeholder="Contoh: UnduhCepat"
            onChange={(e) => setSiteName(e.target.value)}
          />
          {errors.siteName ? (
            <div className="field-error">
              <CircleAlert size={12} /> {errors.siteName}
            </div>
          ) : (
            <div className="field-hint">Nama ini tampil di judul, navbar, dan halaman publik.</div>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="inName">
            <User size={13} /> Nama lengkap
          </label>
          <input
            id="inName"
            className={`input ${errors.name ? 'invalid' : ''}`}
            type="text"
            value={name}
            autoComplete="name"
            placeholder="Budi Santoso"
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name ? (
            <div className="field-error">
              <CircleAlert size={12} /> {errors.name}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label className="label" htmlFor="inEmail">
            <Mail size={13} /> Email
          </label>
          <input
            id="inEmail"
            className={`input ${errors.email ? 'invalid' : ''}`}
            type="email"
            value={email}
            autoComplete="email"
            placeholder="budi@contoh.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email ? (
            <div className="field-error">
              <CircleAlert size={12} /> {errors.email}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label className="label" htmlFor="inUser">
            <AtSign size={13} /> Username
          </label>
          <input
            id="inUser"
            className={`input ${errors.username ? 'invalid' : ''}`}
            type="text"
            value={username}
            autoComplete="username"
            placeholder="admin"
            onChange={(e) => setUsername(e.target.value)}
          />
          {errors.username ? (
            <div className="field-error">
              <CircleAlert size={12} /> {errors.username}
            </div>
          ) : (
            <div className="field-hint">Dipakai untuk login (boleh juga pakai email).</div>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="inPass">
            <KeyRound size={13} /> Password
          </label>
          <div className="input-wrap">
            <input
              id="inPass"
              className={`input ${errors.password ? 'invalid' : ''}`}
              type={showPass ? 'text' : 'password'}
              value={password}
              autoComplete="new-password"
              placeholder="Minimal 6 karakter"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="input-affix"
              onClick={() => setShowPass((s) => !s)}
              aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password ? (
            <>
              <div className="strength">
                {[1, 2, 3, 4].map((i) => (
                  <i key={i} className={i <= strength ? `s${strength}` : ''} />
                ))}
              </div>
              <div className="strength-label">
                <ShieldCheck size={12} /> Kekuatan: {STRENGTH_LABEL[strength]}
              </div>
            </>
          ) : null}
          {errors.password ? (
            <div className="field-error">
              <CircleAlert size={12} /> {errors.password}
            </div>
          ) : null}
        </div>

        <button className="btn block signin" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? <Loader2 className="spinner" size={17} /> : <ArrowRight size={17} />}
          {busy ? 'Membuat akun…' : 'Daftar & Masuk'}
        </button>

        <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>
          Halaman ini hanya tersedia selama belum ada admin terdaftar.
        </p>
      </form>
    </div>
  );
}
