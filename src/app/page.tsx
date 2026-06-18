import { prisma } from '@/lib/prisma';
import { ArticleCard } from '@/components/ArticleCard';
import { TagCloud } from '@/components/TagCloud';
import { HomeSearchBar } from '@/components/HomeSearchBar';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import type { Metadata } from 'next';
import { stripHtml } from '@/lib/utils';

export const metadata: Metadata = {
  title: '首页',
};

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: {
    tag?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

function matchesSearch(text: string, keyword: string): boolean {
  if (!keyword) return true;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function parseYmd(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function inDateRange(publishedAt: Date | null, from: Date | null, to: Date | null): boolean {
  if (!from && !to) return true;
  if (!publishedAt) return false;
  if (from && publishedAt < from) return false;
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    if (publishedAt > endOfDay) return false;
  }
  return true;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const tagSlug = searchParams.tag;
  const keyword = (searchParams.q || '').trim();
  const dateFrom = parseYmd(searchParams.dateFrom);
  const dateTo = parseYmd(searchParams.dateTo);

  const [articles, tags] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        ...(tagSlug
          ? {
              tags: {
                some: {
                  slug: tagSlug,
                },
              },
            }
          : {}),
      },
      include: {
        tags: true,
        _count: {
          select: { views: true },
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
    }),
    prisma.tag.findMany({
      include: {
        _count: {
          select: { articles: { where: { status: 'PUBLISHED' } } },
        },
      },
    }),
  ]);

  tags.sort((a, b) => b._count.articles - a._count.articles);

  const filteredArticles = articles.filter((article) => {
    if (dateFrom || dateTo) {
      if (!inDateRange(article.publishedAt, dateFrom, dateTo)) return false;
    }
    if (keyword) {
      const plainContent = stripHtml(article.content);
      const matchTitle = matchesSearch(article.title, keyword);
      const matchContent = matchesSearch(plainContent, keyword);
      const matchTags = article.tags.some((t) => matchesSearch(t.name, keyword));
      if (!matchTitle && !matchContent && !matchTags) return false;
    }
    return true;
  });

  const activeTag = tags.find((t) => t.slug === tagSlug);

  const hasAnyFilter = !!(tagSlug || keyword || dateFrom || dateTo);
  const filterLabels: string[] = [];
  if (activeTag) filterLabels.push(`标签:${activeTag.name}`);
  if (keyword) filterLabels.push(`关键词:${keyword}`);
  if (searchParams.dateFrom) filterLabels.push(`从 ${searchParams.dateFrom}`);
  if (searchParams.dateTo) filterLabels.push(`至 ${searchParams.dateTo}`);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
          {activeTag
            ? `标签: ${activeTag.name}`
            : keyword
            ? `搜索: "${keyword}"`
            : '欢迎来到我的博客'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {hasAnyFilter
            ? `筛选后共 ${filteredArticles.length} 篇文章`
            : `共 ${filteredArticles.length} 篇文章`}
        </p>
        {filterLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {filterLabels.map((label, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-mono"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-8 space-y-4">
        <HomeSearchBar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          {filteredArticles.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400">
                {hasAnyFilter
                  ? '没有找到匹配的文章，请调整筛选条件或清空筛选后重试'
                  : '暂无文章'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  highlightKeyword={keyword || undefined}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <TagCloud tags={tags} activeTag={tagSlug} />
          <DateRangeFilter />
        </div>
      </div>
    </div>
  );
}
