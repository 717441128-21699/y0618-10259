import Link from 'next/link';
import { Calendar, Clock, Tag as TagIcon, Eye } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Article, Tag as TagModel } from '@prisma/client';

interface ArticleCardProps {
  article: Article & {
    tags: TagModel[];
    _count?: {
      views: number;
    };
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-slate-200 dark:border-slate-700 group">
      <Link href={`/articles/${article.slug}`}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-2">
          {article.title}
        </h2>
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {formatDate(article.publishedAt || article.createdAt)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {article.readTime} 分钟阅读
        </span>
        {article._count !== undefined && (
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {article._count.views} 阅读
          </span>
        )}
      </div>

      {article.excerpt && (
        <p className="text-slate-600 dark:text-slate-300 mb-4 line-clamp-3">
          {article.excerpt}
        </p>
      )}

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/?tag=${tag.slug}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              <TagIcon className="w-3 h-3" />
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
