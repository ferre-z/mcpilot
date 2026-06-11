import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MCPilot — Take control of your MCP stack',
  description: 'Manage, monitor, and optimize all your MCP servers from one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
