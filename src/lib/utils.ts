import { createHash } from 'crypto';

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateFingerprint(ip: string, userAgent: string): string {
  const combined = `${ip}::${userAgent}`;
  return createHash('sha256').update(combined).digest('hex').substring(0, 64);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function generateExcerpt(markdownContent: string, maxLength: number = 200): string {
  const plainText = markdownContent
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^>+\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .trim();
  return plainText.length > maxLength
    ? plainText.substring(0, maxLength) + '...'
    : plainText;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function calculateReadTime(content: string): number {
  const wordsPerMinute = 300;
  const wordCount = content.length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

export function getUserAgent(headers: Headers): string {
  return headers.get('user-agent') || 'unknown';
}
