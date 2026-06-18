import Link from 'next/link';
import { Search, PenLine, LogIn, BookOpen } from 'lucide-react';
import { getSession } from '@/lib/auth';

export async function Header() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <BookOpen className="w-6 h-6 text-primary-600 group-hover:text-primary-700 transition-colors" />
            <span className="text-xl font-bold text-slate-900 dark:text-white">我的博客</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/search"
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="搜索"
            >
              <Search className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Link>

            {session ? (
              <>
                <Link
                  href="/admin/editor"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  <PenLine className="w-4 h-4" />
                  <span className="hidden sm:inline">写文章</span>
                </Link>
                <Link
                  href="/admin"
                  className="hidden sm:inline-block px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium"
                >
                  管理
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">登录</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
