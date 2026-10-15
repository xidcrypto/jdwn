import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #5560e8 0%, #0d9488 100%)',
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            marginLeft: 24,
            borderTop: '38px solid transparent',
            borderBottom: '38px solid transparent',
            borderLeft: '62px solid #ffffff',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
