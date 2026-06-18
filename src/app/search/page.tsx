import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchClient } from '@/components/SearchClient';
import { Search } from 'lucide-react';

export const metadata: Metadata = {
  title: '搜索',
  description: '在博客中搜索文章',
};

export default function SearchPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
          <Search className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">全文搜索</h1>
        <p className="text-slate-500 dark:text-slate-400">搜索文章的标题和内容</p>
      </div>
      <Suspense fallback={<div>加载中...</div>}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
