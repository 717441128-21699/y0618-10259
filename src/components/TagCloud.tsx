import Link from 'next/link';
import { Tag } from 'lucide-react';
import type { Tag as TagModel } from '@prisma/client';

interface TagCloudProps {
  tags: (TagModel & {
    _count: { articles: number };
  })[];
  activeTag?: string;
}

export function TagCloud({ tags, activeTag }: TagCloudProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Tag className="w-4 h-4" />
        标签
      </h3>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/"
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
            !activeTag
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/30'
          }`}
        >
          全部
        </Link>
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={`/?tag=${tag.slug}`}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
              activeTag === tag.slug
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/30'
            }`}
          >
            {tag.name}
            <span className={`text-xs ${activeTag === tag.slug ? 'text-primary-100' : 'text-slate-400'}`}>
              ({tag._count.articles})
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
