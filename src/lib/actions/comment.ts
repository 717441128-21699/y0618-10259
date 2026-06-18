'use server';

import { prisma } from '@/lib/prisma';
import { getCommentModerationEnabled } from '@/lib/settings';
import { isAuthenticated, getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createComment(data: {
  articleId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  parentId?: string;
}) {
  if (!data.authorName.trim()) {
    return { error: '请输入昵称' };
  }
  if (!data.authorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.authorEmail)) {
    return { error: '请输入有效的邮箱地址' };
  }
  if (!data.content.trim()) {
    return { error: '评论内容不能为空' };
  }

  const article = await prisma.article.findUnique({ where: { id: data.articleId } });
  if (!article) {
    return { error: '文章不存在' };
  }

  if (data.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.articleId !== data.articleId) {
      return { error: '父评论不存在' };
    }
  }

  const moderationEnabled = await getCommentModerationEnabled();
  const session = await getSession();
  const isAdmin = session?.isAdmin || false;

  const comment = await prisma.comment.create({
    data: {
      articleId: data.articleId,
      parentId: data.parentId || null,
      authorName: data.authorName.trim(),
      authorEmail: data.authorEmail.trim(),
      content: data.content.trim(),
      isApproved: !moderationEnabled || isAdmin,
      isAdmin,
      userId: session?.id || null,
    },
    include: {
      replies: true,
    },
  });

  revalidatePath(`/articles/${article.slug}`);

  return {
    comment,
    needsApproval: moderationEnabled && !isAdmin,
  };
}

export async function approveComment(id: string) {
  const authed = await isAuthenticated();
  if (!authed) {
    return { error: '未授权' };
  }

  const comment = await prisma.comment.update({
    where: { id },
    data: { isApproved: true },
    include: { article: true },
  });

  revalidatePath(`/articles/${comment.article.slug}`);

  return { success: true };
}

export async function deleteComment(id: string) {
  const authed = await isAuthenticated();
  if (!authed) {
    return { error: '未授权' };
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { article: true },
  });

  if (!comment) {
    return { error: '评论不存在' };
  }

  await prisma.comment.delete({ where: { id } });

  revalidatePath(`/articles/${comment.article.slug}`);

  return { success: true };
}

export async function replyAsAdmin(data: {
  articleId: string;
  content: string;
  parentId: string;
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    return { error: '未授权' };
  }

  const session = await getSession();
  if (!session) {
    return { error: '未登录' };
  }

  const comment = await prisma.comment.create({
    data: {
      articleId: data.articleId,
      parentId: data.parentId,
      authorName: session.name,
      authorEmail: session.email,
      content: data.content.trim(),
      isApproved: true,
      isAdmin: true,
      userId: session.id,
    },
  });

  const article = await prisma.article.findUnique({ where: { id: data.articleId } });
  if (article) {
    revalidatePath(`/articles/${article.slug}`);
  }

  return { comment };
}
