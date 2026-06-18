import { prisma } from '@/lib/prisma';
import { ArticleCard } from '@/components/ArticleCard';
import { TagCloud } from '@/components/TagCloud';
import { HomeSearchBar } from '@/components/HomeSearchBar';
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
  };
}

function matchesSearch(text: string, keyword: string): boolean {
  if (!keyword) return true;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const tagSlug = searchParams.tag;
  const keyword = (searchParams.q || '').trim();

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

  const filteredArticles = keyword
    ? articles.filter((article) => {
        const plainContent = stripHtml(article.content);
        return (
          matchesSearch(article.title, keyword) ||
          matchesSearch(plainContent, keyword) ||
          article.tags.some((t) => matchesSearch(t.name, keyword))
        );
      })
    : articles;

  const activeTag = tags.find((t) => t.slug === tagSlug);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
          {activeTag ? `标签: ${activeTag.name}` : keyword ? `搜索: "${keyword}"` : '欢迎来到我的博客'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {activeTag
            ? `共找到 ${filteredArticles.length} 篇关于"${activeTag.name}"的文章${keyword ? `（关键词: ${keyword}）` : ''}`
            : keyword
            ? `共找到 ${filteredArticles.length} 篇相关文章`
            : `共 ${filteredArticles.length} 篇文章`}
        </p>
      </div>

      <div className="mb-8">
        <HomeSearchBar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          {filteredArticles.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400">
                {keyword ? '没有找到匹配的文章，请尝试其他关键词' : '暂无文章'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.id} article={article} highlightKeyword={keyword || undefined} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <TagCloud tags={tags} activeTag={tagSlug} />
        </div>
      </div>
    </div>
  );
}
