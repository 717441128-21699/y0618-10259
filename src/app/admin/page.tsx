import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import Link from 'next/link';
import { PenLine, Trash2, Eye, FileText, Clock, CheckCircle, Calendar, MessageSquare, Settings } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getCommentModerationEnabled } from '@/lib/settings';
import type { ArticleStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/login');
  }

  const [articles, pendingComments, moderationEnabled] = await Promise.all([
    prisma.article.findMany({
      include: {
        tags: true,
        _count: {
          select: { views: true, comments: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }),
    prisma.comment.count({
      where: { isApproved: false },
    }),
    getCommentModerationEnabled(),
  ]);

  const statusConfig: Record<ArticleStatus, { label: string; color: string; icon: any }> = {
    DRAFT: {
      label: '草稿',
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      icon: Clock,
    },
    PUBLISHED: {
      label: '已发布',
      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      icon: CheckCircle,
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">管理后台</h1>
          <p className="text-slate-500 dark:text-slate-400">管理您的文章和评论</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/comments"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            评论管理
            {pendingComments > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {pendingComments}
              </span>
            )}
          </Link>
          <Link
            href="/admin/editor"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <PenLine className="w-4 h-4" />
            写文章
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{articles.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">总文章</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {articles.filter((a) => a.status === 'PUBLISHED').length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">已发布</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {articles.filter((a) => a.status === 'DRAFT').length}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">草稿</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {articles.reduce((sum, a) => sum + a._count.views, 0)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">总阅读</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  标题
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                  标签
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    阅读
                  </span>
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    更新时间
                  </span>
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    暂无文章，点击右上角"写文章"开始创作
                  </td>
                </tr>
              ) : (
                articles.map((article) => {
                  const statusKey = article.status as ArticleStatus;
                  const status = statusConfig[statusKey] || statusConfig.DRAFT;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={article.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate">
                          <Link
                            href={article.status === 'PUBLISHED' ? `/articles/${article.slug}` : '#'}
                            className="font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                          >
                            {article.title}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {article.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs"
                            >
                              {tag.name}
                            </span>
                          ))}
                          {article.tags.length > 2 && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">
                              +{article.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 hidden md:table-cell">
                        {article._count.views}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm hidden lg:table-cell">
                        {formatDate(article.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/editor/${article.id}`}
                            className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <PenLine className="w-4 h-4" />
                          </Link>
                          <form action={async () => {
                            'use server';
                            const { deleteArticle } = await import('@/lib/actions/article');
                            await deleteArticle(article.id);
                          }}>
                            <button
                              type="submit"
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="删除"
                              onClick={(e) => {
                                if (!confirm('确定要删除这篇文章吗？')) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
