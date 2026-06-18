import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isAuthenticated } from '@/lib/auth';
import Link from 'next/link';
import { ArrowLeft, Check, Trash2, Clock, CheckCircle, User, Mail, MessageSquare, MessageCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { approveComment, deleteComment } from '@/lib/actions/comment';
import { getCommentModerationEnabled, setCommentModerationEnabled } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function CommentsAdminPage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/login');
  }

  const [comments, moderationEnabled] = await Promise.all([
    prisma.comment.findMany({
      include: {
        article: {
          select: { title: true, slug: true },
        },
        parent: {
          select: { authorName: true },
        },
      },
      orderBy: {
        isApproved: 'asc',
        createdAt: 'desc',
      },
    }),
    getCommentModerationEnabled(),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回管理
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">评论管理</h1>
            <p className="text-slate-500 dark:text-slate-400">管理所有评论内容，包括审核和删除</p>
          </div>
          <form
            action={async () => {
              'use server';
              await setCommentModerationEnabled(!moderationEnabled);
            }}
          >
            <button
              type="submit"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                moderationEnabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {moderationEnabled ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              评论审核: {moderationEnabled ? '开启' : '关闭'}
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无评论</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`bg-white dark:bg-slate-800 rounded-xl p-5 border ${
                !comment.isApproved
                  ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {comment.authorName}
                        </span>
                        {comment.isAdmin && (
                          <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                            博主
                          </span>
                        )}
                        {!comment.isApproved && (
                          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            待审核
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {comment.authorEmail}
                        </span>
                        <span>·</span>
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!comment.isApproved && (
                    <form action={async () => {
                      'use server';
                      await approveComment(comment.id);
                    }}>
                      <button
                        type="submit"
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="通过审核"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </form>
                  )}
                  <form action={async () => {
                    'use server';
                    await deleteComment(comment.id);
                  }}>
                    <button
                      type="submit"
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="删除"
                      onClick={(e) => {
                        if (!confirm('确定要删除这条评论吗？')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>

              {comment.parent && (
                <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border-l-4 border-primary-500">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    回复 @{comment.parent.authorName}
                  </p>
                </div>
              )}

              <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words mb-3">
                {comment.content}
              </p>

              <Link
                href={`/articles/${comment.article.slug}#comment-${comment.id}`}
                className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <MessageCircle className="w-4 h-4" />
                查看原文: {comment.article.title}
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
