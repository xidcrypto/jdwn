import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/settings';

export const alt = 'Unduh video gratis, cepat, tanpa registrasi, dan tanpa watermark.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

const CHIPS = ['Gratis', 'Tanpa registrasi', 'Tanpa watermark', 'Proses instan'];

function PlayMark({ box, tri }: { box: number; tri: number }) {
  return (
    <div
      style={{
        width: box,
        height: box,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round(box * 0.26),
        background: 'linear-gradient(135deg, #6d8cff 0%, #22d3ee 100%)',
      }}
    >
      <div
        style={{
          width: 0,
          height: 0,
          marginLeft: Math.round(tri * 0.34),
          borderTop: `${Math.round(tri * 0.6)}px solid transparent`,
          borderBottom: `${Math.round(tri * 0.6)}px solid transparent`,
          borderLeft: `${tri}px solid #ffffff`,
        }}
      />
    </div>
  );
}

export default async function OpengraphImage() {
  let siteName = 'Video Downloader';
  try {
    const s = await getSettings();
    if (s.siteName) siteName = s.siteName;
  } catch {
    /* fallback bila settings belum tersedia */
  }

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '58px 64px 52px',
          background: 'linear-gradient(150deg, #0a0b10 0%, #141a34 55%, #0e1330 100%)',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -140,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(109,140,255,0.45) 0%, rgba(109,140,255,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -220,
            left: -160,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(34,211,238,0.30) 0%, rgba(34,211,238,0) 70%)',
            display: 'flex',
          }}
        />

        {/* brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <PlayMark box={72} tri={26} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>
              {siteName}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                fontWeight: 400,
                color: '#9aa4c0',
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginTop: 4,
              }}
            >
              Unduhan video
            </div>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.04 }}>
            <div style={{ display: 'flex', fontSize: 78, fontWeight: 700, letterSpacing: -2 }}>
              Unduh video favoritmu,
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 78,
                fontWeight: 700,
                letterSpacing: -2,
                color: '#8ea3ff',
              }}
            >
              cepat dan mudah.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 27,
              fontWeight: 400,
              color: '#9aa4c0',
              marginTop: 22,
              maxWidth: 900,
              lineHeight: 1.45,
            }}
          >
            Tempel tautan videonya, lalu simpan dalam kualitas terbaik—langsung ke perangkatmu.
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 34 }}>
            {CHIPS.map((c) => (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 22px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.05)',
                  fontSize: 23,
                  fontWeight: 400,
                  color: '#cdd5ea',
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 22,
            fontWeight: 400,
            color: '#7d87a3',
          }}
        >
          <div style={{ display: 'flex' }}>Gratis · Tanpa akun · Tanpa watermark</div>
          <div style={{ display: 'flex' }}>Unduh video sekarang</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
