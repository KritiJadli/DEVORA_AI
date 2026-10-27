import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'DEVORA — AI-powered SDLC platform',
  description: 'Plan, build, test and ship software in one workspace.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
