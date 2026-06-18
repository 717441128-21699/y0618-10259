import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { renderMarkdown } from '@/lib/markdown';
import { formatDate, generateExcerpt } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { getCommentModerationEnabled } from '@/lib/settings';
import { CommentSection } from '@/components/CommentSection';
import { ViewCounter } from '@/components/ViewCounter';
import Link from 'next/link';
import { Calendar, Clock, Tag, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: { tags: true },
  });

  if (!article) {
    return {
      title: '文章未找到',
    };
  }

  const excerpt = article.excerpt || generateExcerpt(article.content, 160);

  return {
    title: article.title,
    description: excerpt,
    keywords: article.tags.map((t) => t.name),
    openGraph: {
      type: 'article',
      title: article.title,
      description: excerpt,
      publishedTime: article.publishedAt?.toISOString(),
      tags: article.tags.map((t) => t.name),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: excerpt,
    },
  };
}

function buildCommentTree(comments: any[]): any[] {
  const map = new Map<string, any>();
  const roots: any[] = [];

  comments.forEach((c) => {
    map.set(c.id, { ...c, replies: [] });
  });

  comments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: {
      tags: true,
      author: {
        select: { name: true },
      },
    },
  });

  if (!article || article.status !== 'PUBLISHED') {
    notFound();
  }

  const contentHtml = renderMarkdown(article.content);

  const [rawComments, session, moderationEnabled, viewCount] = await Promise.all([
    prisma.comment.findMany({
      where: {
        articleId: article.id,
        isApproved: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    getSession(),
    getCommentModerationEnabled(),
    prisma.view.count({ where: { articleId: article.id } }),
  ]);

  const comments = buildCommentTree(rawComments);
  const isAdmin = session?.isAdmin || false;

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-6">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(article.publishedAt || article.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {article.readTime} 分钟阅读
            </span>
            <ViewCounter articleId={article.id} initialViews={viewCount} />
          </div>

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/?tag=${tag.slug}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <Tag className="w-3 h-3" />
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </header>
      </div>

      {article.excerpt && (
        <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-800/50 border-l-4 border-primary-500 rounded-r-lg">
          <p className="text-slate-600 dark:text-slate-300 italic">
            {article.excerpt}
          </p>
        </div>
      )}

      <div
        className="markdown-body text-slate-800 dark:text-slate-200"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      <CommentSection
        articleId={article.id}
        comments={comments}
        isAdmin={isAdmin}
        moderationEnabled={moderationEnabled}
      />
    </article>
  );
}
