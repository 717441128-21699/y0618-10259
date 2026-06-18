'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowRight, FileText } from 'lucide-react';
import { searchArticles, type SearchResult } from '@/lib/search';
import Link from 'next/link';

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    router.push(`?q=${encodeURIComponent(query.trim())}`);

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchResults = await searchArticles(query.trim());
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const highlightText = (text: string, keywords: string[]) => {
    if (!keywords.length) return text;
    const regex = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      keywords.some((k) => k.toLowerCase() === part.toLowerCase()) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文章标题和内容..."
            className="w-full pl-12 pr-24 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white text-lg"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? '搜索中...' : (
              <>
                <span>搜索</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {hasSearched && !isSearching && (
        <div>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            找到 {results.length} 个相关结果
          </p>

          {results.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-2">未找到相关文章</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">尝试使用其他关键词搜索</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/articles/${result.slug}`}
                  className="block bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"
                >
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2 transition-colors">
                    {highlightText(result.title, result.matchedKeywords)}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    {highlightText(result.excerpt, result.matchedKeywords)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
