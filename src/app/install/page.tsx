import type { Metadata } from 'next';
import InstallForm from '@/components/InstallForm';

export const metadata: Metadata = {
  title: 'Instalasi',
  description: 'Buat akun admin pertama.',
  robots: { index: false, follow: false },
};

export default function InstallPage() {
  return <InstallForm />;
}
