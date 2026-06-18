'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowRight, FileText } from 'lucide-react';
import { searchArticles, type SearchResult } from '@/lib/search';
import Link from 'next/link';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, keywords: string[]): React.ReactNode[] {
  if (!keywords.length || !text) return [text];

  try {
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
    const escapedKeywords = sortedKeywords.map(escapeRegex);
    const pattern = escapedKeywords.join('|');

    if (!pattern) return [text];

    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>
        );
      }
      parts.push(
        <mark
          key={`mark-${match.index}`}
          className="bg-yellow-200 dark:bg-yellow-700/50 px-0.5 rounded"
        >
          {match[0]}
        </mark>
      );
      lastIndex = match.index + match[0].length;
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : [text];
  } catch (e) {
    return [text];
  }
}

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);
  const [error, setError] = useState<string | null>(null);

  const doSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setError(null);

    try {
      const searchResults = await searchArticles(searchQuery.trim());
      setResults(searchResults);
    } catch (err) {
      console.error('Search error:', err);
      setError('搜索时出现错误，请稍后重试');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      router.replace(`?q=${encodeURIComponent(query.trim())}`, { scroll: false });
    }
    await doSearch(query);
  };

  useEffect(() => {
    if (initialQuery && !hasSearched) {
      setQuery(initialQuery);
      doSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {hasSearched && !isSearching && (
        <div>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            找到 <span className="font-semibold text-slate-700 dark:text-slate-200">{results.length}</span> 个相关结果
            {query && (
              <>，关键词: <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{query}</span></>
            )}
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
