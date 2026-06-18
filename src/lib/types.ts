export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

export const ArticleStatusValues: ArticleStatus[] = ['DRAFT', 'PUBLISHED'];

export function isArticleStatus(value: string): value is ArticleStatus {
  return ArticleStatusValues.includes(value as ArticleStatus);
}
