import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6d8cff 0%, #22d3ee 100%)',
          borderRadius: 16,
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            marginLeft: 8,
            borderTop: '14px solid transparent',
            borderBottom: '14px solid transparent',
            borderLeft: '23px solid #ffffff',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
