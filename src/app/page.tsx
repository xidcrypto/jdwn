import type { Viewport } from 'next';
import PublicApp from '@/components/PublicApp';

export const viewport: Viewport = { themeColor: '#f5f6fb' };

export default function HomePage() {
  return <PublicApp />;
}
