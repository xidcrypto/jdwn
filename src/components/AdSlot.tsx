'use client';

import { useEffect, useRef } from 'react';

/**
 * Menyisipkan kode iklan (HTML + <script>) mentah dari pengaturan admin.
 * <script> yang disisipkan via innerHTML tidak otomatis dieksekusi, jadi kita
 * membuat ulang elemen script agar iklan (Adsterra dll.) benar-benar berjalan.
 */
export default function AdSlot({ html, className }: { html?: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const code = (html || '').trim();
    if (!code) return;

    const tpl = document.createElement('template');
    tpl.innerHTML = code;

    const scripts: HTMLScriptElement[] = [];
    tpl.content.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const attr of Array.from(old.attributes)) {
        s.setAttribute(attr.name, attr.value);
      }
      s.text = old.text;
      scripts.push(s);
      old.remove();
    });

    el.appendChild(tpl.content.cloneNode(true));
    for (const s of scripts) el.appendChild(s);

    return () => {
      el.innerHTML = '';
    };
  }, [html]);

  if (!html || !html.trim()) return null;
  return <div ref={ref} className={className} />;
}
