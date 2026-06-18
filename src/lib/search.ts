import { prisma } from './prisma';
import { stripHtml } from './utils';
import { renderMarkdown } from './markdown';

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  score: number;
  matchedKeywords: string[];
}

export async function searchArticles(query: string): Promise<SearchResult[]> {
  const keywords = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(k => k.length > 0);

  if (keywords.length === 0) return [];

  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      excerpt: true,
    },
  });

  const results: SearchResult[] = [];

  for (const article of articles) {
    const contentText = stripHtml(renderMarkdown(article.content)).toLowerCase();
    const titleText = article.title.toLowerCase();
    const excerptText = (article.excerpt || '').toLowerCase();

    let score = 0;
    const matched: Set<string> = new Set();

    for (const keyword of keywords) {
      const titleMatches = (titleText.match(new RegExp(keyword, 'g')) || []).length;
      const excerptMatches = (excerptText.match(new RegExp(keyword, 'g')) || []).length;
      const contentMatches = (contentText.match(new RegExp(keyword, 'g')) || []).length;

      if (titleMatches > 0 || excerptMatches > 0 || contentMatches > 0) {
        matched.add(keyword);
        score += titleMatches * 10 + excerptMatches * 5 + contentMatches;
      }
    }

    if (score > 0) {
      let excerpt = article.excerpt || '';
      if (!excerpt) {
        const plainContent = stripHtml(renderMarkdown(article.content));
        const firstKeyword = Array.from(matched)[0];
        const index = plainContent.toLowerCase().indexOf(firstKeyword);
        if (index > -1) {
          const start = Math.max(0, index - 80);
          const end = Math.min(plainContent.length, index + 120);
          excerpt = (start > 0 ? '...' : '') + plainContent.substring(start, end) + (end < plainContent.length ? '...' : '');
        } else {
          excerpt = plainContent.substring(0, 200) + '...';
        }
      }

      results.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt,
        score,
        matchedKeywords: Array.from(matched),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
