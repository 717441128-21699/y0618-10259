import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { createDefaultAdmin } from '@/lib/auth';

createDefaultAdmin();

export const metadata: Metadata = {
  title: {
    default: '我的博客 - 分享知识与思考',
    template: '%s | 我的博客',
  },
  description: '一个基于Next.js和Markdown的个人博客系统',
  keywords: ['博客', 'Markdown', 'Next.js', '技术分享'],
  authors: [{ name: '博客作者' }],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: '我的博客',
    description: '一个基于Next.js和Markdown的个人博客系统',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
