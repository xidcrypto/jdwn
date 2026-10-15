'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, HelpCircle, Loader2, ShieldAlert, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger';
  icon?: 'question' | 'warning' | 'danger';
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm harus dipakai di dalam <ConfirmProvider>');
  return ctx;
}

interface InternalState {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InternalState | null>(null);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef<InternalState | null>(null);
  stateRef.current = state;

  const confirm = useCallback<ConfirmFn>((opts) => {
    const o = typeof opts === 'string' ? { title: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setBusy(false);
      setState({ opts: o, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    const s = stateRef.current;
    if (!s) return;
    stateRef.current = null;
    setState(null);
    queueMicrotask(() => s.resolve(value));
  }, []);

  useEffect(() => {
    if (!state) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [state, close]);

  const o = state?.opts;
  const danger = o?.tone === 'danger';
  const iconKind = o?.icon ?? (danger ? 'danger' : 'question');
  const Icon = iconKind === 'danger' ? ShieldAlert : iconKind === 'warning' ? CircleAlert : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {o ? (
        <div
          className="confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className={`confirm-card ${danger ? 'danger' : ''}`} role="alertdialog" aria-modal="true">
            <button className="confirm-x" onClick={() => close(false)} aria-label="Tutup">
              <X size={16} />
            </button>
            <div className={`confirm-icon ${danger ? 'danger' : ''}`}>
              <Icon size={26} />
            </div>
            <h3 className="confirm-title">{o.title}</h3>
            {o.message ? <p className="confirm-msg">{o.message}</p> : null}
            <div className="confirm-actions">
              <button className="btn ghost" onClick={() => close(false)} disabled={busy}>
                {o.cancelText || 'Batal'}
              </button>
              <button
                className={`btn ${danger ? 'danger' : ''}`}
                autoFocus
                onClick={() => {
                  setBusy(true);
                  close(true);
                }}
                disabled={busy}
              >
                {busy ? <Loader2 className="spinner" size={16} /> : null}
                {o.confirmText || (danger ? 'Hapus' : 'Lanjutkan')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
