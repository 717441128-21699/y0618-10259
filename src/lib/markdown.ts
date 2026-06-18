import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(content: string): string {
  return marked.parse(content) as string;
}

export function highlightKeywords(text: string, keywords: string[]): string {
  if (!keywords.length) return text;
  const regex = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');
}

export function searchIndex(text: string): Set<string> {
  const words = text.toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
  return new Set(words);
}
