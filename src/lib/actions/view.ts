'use server';

import { prisma } from '@/lib/prisma';
import { generateFingerprint, getClientIp, getUserAgent } from '@/lib/utils';
import { headers } from 'next/headers';

export async function incrementView(articleId: string): Promise<{ views: number; isNew: boolean }> {
  const reqHeaders = headers();
  const ip = getClientIp(reqHeaders);
  const userAgent = getUserAgent(reqHeaders);
  const fingerprint = generateFingerprint(ip, userAgent);

  const existingView = await prisma.view.findUnique({
    where: {
      articleId_fingerprint: {
        articleId,
        fingerprint,
      },
    },
  });

  if (existingView) {
    const totalViews = await prisma.view.count({ where: { articleId } });
    return { views: totalViews, isNew: false };
  }

  await prisma.view.create({
    data: {
      articleId,
      fingerprint,
      ip,
      userAgent,
    },
  });

  const totalViews = await prisma.view.count({ where: { articleId } });
  return { views: totalViews, isNew: true };
}

export async function getViewCount(articleId: string): Promise<number> {
  return prisma.view.count({ where: { articleId } });
}
