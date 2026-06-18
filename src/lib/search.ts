import { prisma } from './prisma';
import { stripHtml } from './utils';
import { renderMarkdown } from './markdown';

export type SearchSort = 'relevance' | 'date-desc' | 'date-asc';
export type SearchScope = 'all' | 'title' | 'content';

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  score: number;
  matchedKeywords: string[];
  publishedAt: string | null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeMatch(text: string, keyword: string): number {
  try {
    const escaped = escapeRegex(keyword);
    const matches = text.match(new RegExp(escaped, 'gi'));
    return matches ? matches.length : 0;
  } catch {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    let count = 0;
    let idx = lowerText.indexOf(lowerKeyword);
    while (idx !== -1) {
      count++;
      idx = lowerText.indexOf(lowerKeyword, idx + lowerKeyword.length);
    }
    return count;
  }
}

export async function searchArticles(
  query: string,
  sort: SearchSort = 'relevance',
  scope: SearchScope = 'all',
): Promise<SearchResult[]> {
  const keywords = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  if (keywords.length === 0) return [];

  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      excerpt: true,
      publishedAt: true,
    },
  });

  const results: SearchResult[] = [];
  const scopeTitle = scope === 'all' || scope === 'title';
  const scopeContent = scope === 'all' || scope === 'content';

  for (const article of articles) {
    const contentText = stripHtml(renderMarkdown(article.content)).toLowerCase();
    const titleText = article.title.toLowerCase();
    const excerptText = (article.excerpt || '').toLowerCase();

    let score = 0;
    const matched: Set<string> = new Set();

    for (const keyword of keywords) {
      const titleMatches = scopeTitle ? safeMatch(titleText, keyword) : 0;
      const excerptMatches = scopeContent ? safeMatch(excerptText, keyword) : 0;
      const contentMatches = scopeContent ? safeMatch(contentText, keyword) : 0;

      if (titleMatches > 0 || excerptMatches > 0 || contentMatches > 0) {
        matched.add(keyword);
        score += titleMatches * 10 + excerptMatches * 5 + contentMatches;
      }
    }

    if (score > 0) {
      let excerpt = article.excerpt || '';
      if (!excerpt && scopeContent) {
        const plainContent = stripHtml(renderMarkdown(article.content));
        const firstKeyword = Array.from(matched)[0];
        const index = plainContent.toLowerCase().indexOf(firstKeyword);
        if (index > -1) {
          const start = Math.max(0, index - 80);
          const end = Math.min(plainContent.length, index + 120);
          excerpt =
            (start > 0 ? '...' : '') +
            plainContent.substring(start, end) +
            (end < plainContent.length ? '...' : '');
        } else {
          excerpt = plainContent.substring(0, 200) + '...';
        }
      }

      results.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: excerpt || (scopeTitle ? article.title : ''),
        score,
        matchedKeywords: Array.from(matched),
        publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
      });
    }
  }

  switch (sort) {
    case 'date-desc':
      return results.sort((a, b) => {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.score - a.score;
      });
    case 'date-asc':
      return results.sort((a, b) => {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return b.score - a.score;
      });
    case 'relevance':
    default:
      return results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return tb - ta;
      });
  }
}
