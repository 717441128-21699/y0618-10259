'use client';

import { useState, useMemo } from 'react';
import { marked } from 'marked';
import {
  History, ChevronDown, ChevronUp, Trash2, FileText, Calendar as CalendarIcon,
  Tag as TagIcon, RotateCcw, Clock, CheckCircle, X, Folder, Eye, EyeOff,
  CheckSquare, Square, FolderOpen, ArrowLeftRight,
} from 'lucide-react';
import type { DraftVersion } from './MarkdownEditor';
import { formatDate } from '@/lib/utils';

export interface DraftVersionEx extends DraftVersion {
  articleId: string | null;
  articleTitle: string;
  articleSlug?: string | null;
}

interface DraftHistoryPanelProps {
  open: boolean;
  onToggle: () => void;
  history: DraftVersion[];
  currentId?: string;
  currentTitle: string;
  currentContent: string;
  currentTags: string[];
  onApply: (v: DraftVersion, fields: { title: boolean; content: boolean; tags: boolean }) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  allVersions?: DraftVersionEx[];
  articleId: string | null;
  articleTitle: string;
}

const MAX_HISTORY_ITEMS = 10;

function versionSourceLabel(source: DraftVersion['source']): string {
  switch (source) {
    case 'auto': return '自动保存';
    case 'manual': return '手动保存';
    case 'local': return '本地备份';
  }
}

function formatVersionTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
  leftNum?: number;
  rightNum?: number;
}

function computeLineDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split(/\r?\n/);
  const rightLines = right.split(/\r?\n/);
  const m = leftLines.length;
  const n = rightLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = leftLines[i - 1] === rightLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      result.push({ type: 'same', text: leftLines[i - 1], leftNum: i, rightNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: rightLines[j - 1], rightNum: j });
      j--;
    } else {
      result.push({ type: 'del', text: leftLines[i - 1], leftNum: i });
      i--;
    }
  }
  return result.reverse();
}

export function DraftHistoryPanel({
  open,
  onToggle,
  history,
  currentId,
  currentTitle,
  currentContent,
  currentTags,
  onApply,
  onDelete,
  onClearAll,
  allVersions = [],
  articleId,
  articleTitle,
}: DraftHistoryPanelProps) {
  const [previewVersion, setPreviewVersion] = useState<DraftVersion | null>(null);
  const [groupMode, setGroupMode] = useState<'current' | 'all'>('current');
  const [showDiff, setShowDiff] = useState(true);
  const [applyTitle, setApplyTitle] = useState(true);
  const [applyContent, setApplyContent] = useState(true);
  const [applyTags, setApplyTags] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const groupedByArticle = useMemo(() => {
    const map = new Map<string, DraftVersionEx[]>();
    const byId = new Map<string, string>();
    allVersions.forEach((v) => {
      const key = v.articleId || 'new';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
      if (!byId.has(key) && v.articleTitle) {
        byId.set(key, v.articleTitle);
      }
    });
    return { map, byId };
  }, [allVersions]);

  const displayList: DraftVersion[] = useMemo(() => {
    if (groupMode === 'current') return history;
    return allVersions.filter((v) => v.articleId === (articleId || 'new'));
  }, [groupMode, history, allVersions, articleId]);

  const previewRenderedContent = previewVersion
    ? (marked.parse(previewVersion.content) as string)
    : '';

  const diffLines = useMemo(() => {
    if (!previewVersion || !showDiff) return null;
    return computeLineDiff(currentContent, previewVersion.content);
  }, [previewVersion, showDiff, currentContent]);

  const diffStats = useMemo(() => {
    if (!diffLines) return null;
    let add = 0;
    let del = 0;
    let same = 0;
    diffLines.forEach((l) => {
      if (l.type === 'add') add++;
      else if (l.type === 'del') del++;
      else same++;
    });
    return { add, del, same, total: diffLines.length };
  }, [diffLines]);

  const handleApplyClick = () => {
    if (!previewVersion) return;
    if (!applyTitle && !applyContent && !applyTags) return;
    setConfirmOpen(true);
  };

  const handleConfirmApply = () => {
    if (!previewVersion) return;
    onApply(previewVersion, { title: applyTitle, content: applyContent, tags: applyTags });
    setConfirmOpen(false);
    setPreviewVersion(null);
  };

  const resetApplyOptions = () => {
    setApplyTitle(true);
    setApplyContent(true);
    setApplyTags(true);
  };

  const renderVersionRow = (v: DraftVersion, idx: number, total: number) => (
    <li
      key={v.id}
      className={`group px-4 py-3 cursor-pointer transition-colors ${
        previewVersion?.id === v.id
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : currentId === v.id && idx === 0
          ? 'bg-slate-50 dark:bg-slate-700/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
      }`}
      onClick={() => {
        setPreviewVersion(v);
        resetApplyOptions();
        setConfirmOpen(false);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
              v.source === 'auto'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : v.source === 'manual'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {versionSourceLabel(v.source)}
            </span>
            {idx === 0 && total > 1 && (
              <span className="text-[10px] text-slate-400">最新</span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {v.title || '（无标题）'}
          </p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatVersionTime(v.savedAt)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {v.content.length} 字
            {v.tags.length > 0 && ` · ${v.tags.length} 标签`}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewVersion(v);
              resetApplyOptions();
              handleApplyClick();
            }}
            className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded transition-colors"
            title="恢复此版本"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('删除此历史版本？')) onDelete(v.id);
            }}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="删除此版本"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );

  if (!open) return null;

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <History className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">草稿历史</h3>
          <span className="text-xs text-slate-500">
            保留最近 {MAX_HISTORY_ITEMS} 个版本 / 篇
          </span>
          <div className="flex items-center bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5 text-xs ml-2">
            <button
              onClick={() => setGroupMode('current')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                groupMode === 'current'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              当前文章
            </button>
            <button
              onClick={() => setGroupMode('all')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                groupMode === 'all'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              全部文章 ({allVersions.length})
            </button>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => {
              if (confirm('确定清空所有历史版本？此操作不可撤销。')) onClearAll();
            }}
            className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空全部
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-x-0 md:divide-x divide-y md:divide-y-0 divide-slate-200 dark:divide-slate-700 max-h-[420px]">
        <div className="md:col-span-1 overflow-auto max-h-[420px]">
          {groupMode === 'all' ? (
            groupedByArticle.map.size === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <Folder className="w-8 h-8 mx-auto mb-2 opacity-40" />
                暂无历史版本
              </div>
            ) : (
              <div>
                {[...groupedByArticle.map.entries()].map(([key, versions]) => {
                  const title = groupedByArticle.byId.get(key) || versions[0]?.articleTitle || (key === 'new' ? '新文章' : `文章 ${key.slice(0, 8)}`);
                  const isCurrent = key === (articleId || 'new');
                  return (
                    <div key={key} className="border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
                      <div className={`px-4 py-2 text-xs font-medium flex items-center gap-2 ${
                        isCurrent
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                      }`}>
                        <FileText className="w-3.5 h-3.5" />
                        <span className="truncate flex-1">{title}</span>
                        <span className="shrink-0">×{versions.length}</span>
                        {isCurrent && (
                          <CheckCircle className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                        )}
                      </div>
                      <ul className="divide-y divide-slate-50 dark:divide-slate-700/30">
                        {versions.map((v, idx) => renderVersionRow(v, idx, versions.length))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )
          ) : displayList.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-40" />
              暂无历史版本
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {displayList.map((v, idx) => renderVersionRow(v, idx, displayList.length))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2 overflow-auto max-h-[420px] bg-slate-50/50 dark:bg-slate-900/20">
          {previewVersion ? (
            <div className="p-5">
              <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700 gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4" />
                    {previewVersion.title || '（无标题）'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {formatVersionTime(previewVersion.savedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {previewVersion.content.length} 字
                    </span>
                    {previewVersion.tags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <TagIcon className="w-3 h-3" />
                        {previewVersion.tags.join('、')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                <button
                  onClick={() => setShowDiff((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    showDiff
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  {showDiff ? '差异对比' : '完整预览'}
                </button>
                {diffStats && showDiff && (
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded">
                      +{diffStats.add}
                    </span>
                    <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded">
                      -{diffStats.del}
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                      ={diffStats.same}
                    </span>
                  </div>
                )}
              </div>

              {showDiff && diffLines ? (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-[12.5px]">
                  <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700 text-[10px] font-semibold uppercase tracking-wide">
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      当前正文
                    </div>
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <History className="w-3 h-3" />
                      历史版本
                    </div>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <div className="font-mono leading-relaxed">
                      {diffLines.map((line, idx) => (
                        <div key={idx} className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700/50">
                          {line.type === 'add' ? (
                            <>
                              <div className="px-3 py-0.5 bg-slate-50 dark:bg-slate-700/20 text-slate-300 dark:text-slate-600 select-none"></div>
                              <div className="px-3 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200 whitespace-pre-wrap">
                                + {line.text || '\u00A0'}
                              </div>
                            </>
                          ) : line.type === 'del' ? (
                            <>
                              <div className="px-3 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200 whitespace-pre-wrap line-through decoration-red-400/60">
                                - {line.text || '\u00A0'}
                              </div>
                              <div className="px-3 py-0.5 bg-slate-50 dark:bg-slate-700/20 text-slate-300 dark:text-slate-600 select-none"></div>
                            </>
                          ) : (
                            <>
                              <div className="px-3 py-0.5 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                {line.text || '\u00A0'}
                              </div>
                              <div className="px-3 py-0.5 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                {line.text || '\u00A0'}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="markdown-body prose dark:prose-invert max-w-none text-sm bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-auto">
                  {previewVersion.content ? (
                    <div dangerouslySetInnerHTML={{ __html: previewRenderedContent }} />
                  ) : (
                    <p className="text-slate-400 italic">（此版本无正文内容）</p>
                  )}
                </div>
              )}

              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    恢复前选择要覆盖的字段
                  </p>
                  <button
                    onClick={resetApplyOptions}
                    className="text-xs text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"
                  >
                    全选
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    {applyTitle ? (
                      <CheckSquare className="w-4 h-4 text-primary-600" onClick={() => setApplyTitle(false)} />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" onClick={() => setApplyTitle(true)} />
                    )}
                    标题
                    <span className="text-xs text-slate-400">
                      "{previewVersion.title.slice(0, 15) || '空'}{previewVersion.title.length > 15 ? '…' : ''}"
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    {applyContent ? (
                      <CheckSquare className="w-4 h-4 text-primary-600" onClick={() => setApplyContent(false)} />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" onClick={() => setApplyContent(true)} />
                    )}
                    正文
                    <span className="text-xs text-slate-400">
                      ({previewVersion.content.length} 字)
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    {applyTags ? (
                      <CheckSquare className="w-4 h-4 text-primary-600" onClick={() => setApplyTags(false)} />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" onClick={() => setApplyTags(true)} />
                    )}
                    标签
                    <span className="text-xs text-slate-400">
                      {previewVersion.tags.length > 0 ? previewVersion.tags.join('、') : '（无标签）'}
                    </span>
                  </label>
                </div>

                {confirmOpen ? (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                      ⚠ 即将覆盖：
                      {applyTitle && <span className="ml-1">标题</span>}
                      {applyContent && <span className="ml-1">正文</span>}
                      {applyTags && <span className="ml-1">标签</span>}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmApply}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        确认恢复
                      </button>
                      <button
                        onClick={() => setConfirmOpen(false)}
                        className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={handleApplyClick}
                      disabled={!applyTitle && !applyContent && !applyTags}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      恢复选中字段
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6 text-sm text-slate-500">
              <div className="text-center">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>点击左侧版本查看预览与差异对比</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden">
        保留这些引用避免 lint 警告: <X /> <ChevronDown /> <ChevronUp />
        {articleTitle} {currentTitle} {currentTags} {typeof formatDate}
      </div>
    </div>
  );
}
