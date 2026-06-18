'use client';

import { useState } from 'react';
import { createComment, replyAsAdmin } from '@/lib/actions/comment';
import { MessageSquare, Send, User, Mail, Reply, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Comment, Article } from '@prisma/client';

interface CommentWithReplies extends Comment {
  replies: CommentWithReplies[];
}

interface CommentSectionProps {
  articleId: string;
  comments: CommentWithReplies[];
  isAdmin: boolean;
  moderationEnabled: boolean;
}

export function CommentSection({ articleId, comments, isAdmin, moderationEnabled }: CommentSectionProps) {
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      let result;

      if (isAdmin && parentId) {
        result = await replyAsAdmin({
          articleId,
          content: replyContent,
          parentId,
        });
      } else {
        result = await createComment({
          articleId,
          authorName,
          authorEmail,
          content: parentId ? replyContent : content,
          parentId,
        });
      }

      if ('error' in result && result.error) {
        setError(result.error);
      } else if (result) {
        if ('needsApproval' in result && result.needsApproval) {
          setSuccess('评论已提交，等待审核通过后显示。');
        } else {
          setSuccess('评论发表成功！');
        }
        setContent('');
        setReplyContent('');
        setReplyingTo(null);
        setAuthorName('');
        setAuthorEmail('');
        setTimeout(() => setSuccess(null), 5000);
        window.location.reload();
      }
    } catch (e) {
      setError('评论发表失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const totalComments = comments.length + comments.reduce((sum, c) => sum + c.replies.length, 0);

  return (
    <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <MessageSquare className="w-6 h-6" />
        评论 ({totalComments})
      </h2>

      {moderationEnabled && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            评论需经审核后才会显示
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 mb-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">发表评论</h3>
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
          {!isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  昵称 *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="请输入昵称"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  邮箱 *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              评论内容 *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下您的评论..."
              required
              rows={4}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white resize-none"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
              {success}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {submitting ? '发送中...' : '发表评论'}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-6">
        {comments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无评论，来抢沙发吧！</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} id={`comment-${comment.id}`} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {comment.authorName}
                    </span>
                    {comment.isAdmin && (
                      <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                        博主
                      </span>
                    )}
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words mb-3">
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 transition-colors"
                    >
                      <Reply className="w-4 h-4" />
                      回复
                    </button>
                    {comment.replies.length > 0 && (
                      <button
                        onClick={() => toggleReplies(comment.id)}
                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 transition-colors"
                      >
                        {expandedReplies.has(comment.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        {comment.replies.length} 条回复
                      </button>
                    )}
                  </div>

                  {replyingTo === comment.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                      <form onSubmit={(e) => handleSubmit(e, comment.id)} className="space-y-3">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder={`回复 @${comment.authorName}...`}
                          required
                          rows={3}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white resize-none text-sm"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            {submitting ? '发送中...' : '回复'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {comment.replies.length > 0 && expandedReplies.has(comment.id) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} id={`comment-${reply.id}`} className="flex items-start gap-3 ml-4 pl-4 border-l-2 border-slate-100 dark:border-slate-700">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-medium text-sm text-slate-900 dark:text-white">
                                {reply.authorName}
                              </span>
                              {reply.isAdmin && (
                                <span className="px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                                  博主
                                </span>
                              )}
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                              {reply.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
