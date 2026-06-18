import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EditorPage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/login');
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
      <MarkdownEditor />
    </div>
  );
}
