import { prisma } from './prisma';

export async function getCommentModerationEnabled(): Promise<boolean> {
  const setting = await prisma.siteSettings.findUnique({
    where: { key: 'comment_moderation_enabled' },
  });
  if (setting) {
    return setting.value === 'true';
  }
  const envValue = process.env.COMMENT_MODERATION_ENABLED;
  const defaultValue = envValue !== 'false';
  await prisma.siteSettings.create({
    data: {
      key: 'comment_moderation_enabled',
      value: String(defaultValue),
    },
  });
  return defaultValue;
}

export async function setCommentModerationEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { key: 'comment_moderation_enabled' },
    update: { value: String(enabled) },
    create: {
      key: 'comment_moderation_enabled',
      value: String(enabled),
    },
  });
}
