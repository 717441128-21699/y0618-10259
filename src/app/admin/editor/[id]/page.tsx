import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface EditArticlePageProps {
  params: {
    id: string;
  };
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/login');
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { tags: true },
  });

  if (!article) {
    redirect('/admin');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回管理
        </Link>
      </div>
      <MarkdownEditor initialArticle={article} />
    </div>
  );
}
