'use server';

import { prisma } from '@/lib/prisma';
import { slugify, generateExcerpt, calculateReadTime } from '@/lib/utils';
import { isAuthenticated } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ArticleStatus } from '@/lib/types';

export async function createArticle(data: {
  title: string;
  content: string;
  status: ArticleStatus;
  tagNames: string[];
  coverImage?: string;
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    return { error: '未授权' };
  }

  if (!data.title.trim()) {
    return { error: '标题不能为空' };
  }

  const baseSlug = slugify(data.title);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const tags = await Promise.all(
    data.tagNames.filter(t => t.trim()).map(async (name) => {
      const tagSlug = slugify(name);
      return prisma.tag.upsert({
        where: { name: name.trim() },
        update: {},
        create: { name: name.trim(), slug: tagSlug },
      });
    })
  );

  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (!admin) {
    return { error: '管理员用户不存在' };
  }

  const article = await prisma.article.create({
    data: {
      slug,
      title: data.title.trim(),
      content: data.content,
      excerpt: generateExcerpt(data.content),
      status: data.status,
      coverImage: data.coverImage,
      authorId: admin.id,
      readTime: calculateReadTime(data.content),
      tags: { connect: tags.map(t => ({ id: t.id })) },
      publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
    },
    include: { tags: true },
  });

  if (data.status === 'PUBLISHED') {
    revalidatePath('/');
    revalidatePath(`/articles/${slug}`);
    revalidatePath('/sitemap.xml');
  }

  return { article };
}

export async function updateArticle(
  id: string,
  data: {
    title?: string;
    content?: string;
    status?: ArticleStatus;
    tagNames?: string[];
    coverImage?: string;
  }
) {
  const authed = await isAuthenticated();
  if (!authed) {
    return { error: '未授权' };
  }

  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) {
    return { error: '文章不存在' };
  }

  const updateData: any = {};

  if (data.title !== undefined) {
    updateData.title = data.title.trim();
    const newSlug = slugify(data.title);
    if (newSlug !== existing.slug) {
      let slug = newSlug;
      let counter = 1;
      while (await prisma.article.findUnique({ where: { slug } })) {
        slug = `${newSlug}-${counter}`;
        counter++;
      }
      updateData.slug = slug;
    }
  }

  if (data.content !== undefined) {
    updateData.content = data.content;
    updateData.excerpt = generateExcerpt(data.content);
    updateData.readTime = calculateReadTime(data.content);
  }

  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'PUBLISHED' && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }

  if (data.coverImage !== undefined) {
    updateData.coverImage = data.coverImage;
  }

  const updated = await prisma.article.update({
    where: { id },
    data: {
      ...updateData,
      tags: data.tagNames
        ? {
            set: [],
            connectOrCreate: data.tagNames.filter(t => t.trim()).map((name) => ({
              where: { name: name.trim() },
              create: { name: name.trim(), slug: slugify(name) },
            })),
          }
        : undefined,
    },
    include: { tags: true },
  });

  revalidatePath('/');
  revalidatePath(`/articles/${updated.slug}`);
  if (existing.slug !== updated.slug) {
    revalidatePath(`/articles/${existing.slug}`);
  }
  revalidatePath('/sitemap.xml');

  return { article: updated };
}

export async function deleteArticle(id: string) {
  const authed = await isAuthenticated();
  if (!authed) {
    return { error: '未授权' };
  }

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return { error: '文章不存在' };
  }

  await prisma.article.delete({ where: { id } });

  revalidatePath('/');
  revalidatePath(`/articles/${article.slug}`);
  revalidatePath('/sitemap.xml');

  return { success: true };
}

export async function saveDraft(data: {
  id?: string;
  title: string;
  content: string;
  tagNames: string[];
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    return { error: '未授权' };
  }

  if (data.id) {
    const result = await updateArticle(data.id, {
      title: data.title,
      content: data.content,
      tagNames: data.tagNames,
      status: 'DRAFT',
    });
    return result;
  }

  return createArticle({
    title: data.title || '无标题草稿',
    content: data.content,
    status: 'DRAFT',
    tagNames: data.tagNames,
  });
}
