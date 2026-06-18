'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, ArrowRight, FileText, SortAsc, SortDesc, Sparkles, Clock, X, Copy, Check, Type, FileText as FileTextIcon, Hash } from 'lucide-react';
import { searchArticles, type SearchResult, type SearchSort, type SearchScope } from '@/lib/search';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

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
          <span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>,
        );
      }
      parts.push(
        <mark
          key={`mark-${match.index}`}
          className="bg-yellow-200 dark:bg-yellow-700/50 px-0.5 rounded"
        >
          {match[0]}
        </mark>,
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

const SORT_OPTIONS: { value: SearchSort; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'relevance', label: '相关度', icon: Sparkles },
  { value: 'date-desc', label: '时间 (新→旧)', icon: SortDesc },
  { value: 'date-asc', label: '时间 (旧→新)', icon: SortAsc },
];

const SCOPE_OPTIONS: { value: SearchScope; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: '全部', icon: Hash },
  { value: 'title', label: '仅标题', icon: Type },
  { value: 'content', label: '仅正文', icon: FileTextIcon },
];

function isValidSort(v: string | null): v is SearchSort {
  return v === 'relevance' || v === 'date-desc' || v === 'date-asc';
}

function isValidScope(v: string | null): v is SearchScope {
  return v === 'all' || v === 'title' || v === 'content';
}

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialQuery = searchParams.get('q') || '';
  const initialSort = searchParams.get('sort');
  const initialScope = searchParams.get('scope');
  const defaultSort: SearchSort = isValidSort(initialSort) ? initialSort : 'relevance';
  const defaultScope: SearchScope = isValidScope(initialScope) ? initialScope : 'all';

  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SearchSort>(defaultSort);
  const [scope, setScope] = useState<SearchScope>(defaultScope);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const syncUrl = useCallback(
    (nextQuery: string, nextSort: SearchSort, nextScope: SearchScope) => {
      const params = new URLSearchParams();
      if (nextQuery.trim()) {
        params.set('q', nextQuery.trim());
      }
      if (nextSort !== 'relevance') {
        params.set('sort', nextSort);
      }
      if (nextScope !== 'all') {
        params.set('scope', nextScope);
      }
      const queryStr = params.toString();
      router.replace(queryStr ? `?${queryStr}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const doSearch = useCallback(
    async (searchQuery: string, searchSort: SearchSort, searchScope: SearchScope) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setHasSearched(false);
        setSearchTime(null);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);
      setError(null);
      setSearchTime(null);
      const started = performance.now();

      try {
        const searchResults = await searchArticles(searchQuery.trim(), searchSort, searchScope);
        setResults(searchResults);
        setSearchTime(performance.now() - started);
      } catch (err) {
        console.error('Search error:', err);
        setError('搜索时出现错误，请稍后重试');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    syncUrl(query, sort, scope);
    await doSearch(query, sort, scope);
  };

  const handleSortChange = async (newSort: SearchSort) => {
    setSort(newSort);
    syncUrl(query, newSort, scope);
    if (hasSearched && query.trim()) {
      await doSearch(query, newSort, scope);
    }
  };

  const handleScopeChange = async (newScope: SearchScope) => {
    setScope(newScope);
    syncUrl(query, sort, newScope);
    if (hasSearched && query.trim()) {
      await doSearch(query, sort, newScope);
    }
  };

  const handleClearQuery = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    syncUrl('', sort, scope);
  };

  const handleCopyLink = async () => {
    try {
      const params = new URLSearchParams(searchParams.toString());
      const url = `${window.location.origin}${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const qFromUrl = searchParams.get('q') || '';
    const sortFromUrl = searchParams.get('sort');
    const scopeFromUrl = searchParams.get('scope');
    const parsedSort: SearchSort = isValidSort(sortFromUrl) ? sortFromUrl : 'relevance';
    const parsedScope: SearchScope = isValidScope(scopeFromUrl) ? scopeFromUrl : 'all';

    setSort(parsedSort);
    setScope(parsedScope);

    if (qFromUrl && qFromUrl.trim()) {
      setQuery(qFromUrl);
      setHasSearched(false);
      doSearch(qFromUrl, parsedSort, parsedScope);
    } else {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const resultLinkHref = (slug: string) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (sort !== 'relevance') params.set('sort', sort);
    if (scope !== 'all') params.set('scope', scope);
    const queryStr = params.toString();
    return queryStr ? `/articles/${slug}?${queryStr}` : `/articles/${slug}`;
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文章标题和内容..."
            className="w-full pl-12 pr-32 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white text-lg"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={handleClearQuery}
              className="absolute right-24 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="清空"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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

      {hasSearched && query.trim() && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>
              找到 <span className="font-semibold text-slate-700 dark:text-slate-200">{results.length}</span> 个结果
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono text-xs">
              <Search className="w-3 h-3" />
              {query.trim()}
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
              scope === 'title'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : scope === 'content'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {scope === 'title' ? '仅标题' : scope === 'content' ? '仅正文' : '全部范围'}
            </span>
            {searchTime !== null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {searchTime < 1000 ? `${Math.round(searchTime)} ms` : `${(searchTime / 1000).toFixed(2)} s`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 text-xs">
              {SCOPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleScopeChange(opt.value)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors ${
                      scope === opt.value
                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                    }`}
                    title={`搜索范围:${opt.label}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 text-xs">
              {SORT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSortChange(opt.value)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors ${
                      sort === opt.value
                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                    }`}
                    title={`按${opt.label}排序`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="复制当前搜索链接"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制链接
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {hasSearched && !isSearching && (
        <div>
          {results.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-2">未找到相关文章</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                尝试使用其他关键词，或切换搜索范围
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={resultLinkHref(result.slug)}
                  className="block bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {highlightText(result.title, result.matchedKeywords)}
                    </h3>
                    {result.publishedAt && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap mt-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(new Date(result.publishedAt))}
                      </span>
                    )}
                  </div>
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
