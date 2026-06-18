'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';
import { saveDraft, createArticle, updateArticle } from '@/lib/actions/article';
import {
  Save, Eye, Edit3, Send, Clock, CheckCircle, AlertCircle, X,
  HardDrive, RotateCcw, History, ChevronDown, ChevronUp, Trash2,
  FileText, Calendar as CalendarIcon, Tag as TagIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Article, Tag } from '@prisma/client';

interface MarkdownEditorProps {
  initialArticle?: Article & { tags: Tag[] } | null;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

const AUTO_SAVE_INTERVAL = 60000;
const LOCAL_BACKUP_DEBOUNCE = 2000;
const MAX_HISTORY_ITEMS = 10;

interface DraftVersion {
  id: string;
  title: string;
  content: string;
  tags: string[];
  savedAt: number;
  source: 'local' | 'auto' | 'manual';
}

interface DraftHistory {
  versions: DraftVersion[];
  currentId?: string;
}

function getHistoryKey(articleId: string | null): string {
  return `blog_draft_history_${articleId || 'new'}`;
}

function getLegacyBackupKey(articleId: string | null): string {
  return `blog_draft_backup_${articleId || 'new'}`;
}

function genVersionId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readHistory(key: string): DraftHistory {
  try {
    if (typeof window === 'undefined') return { versions: [] };
    const raw = window.localStorage.getItem(key);
    if (!raw) return { versions: [] };
    const parsed = JSON.parse(raw) as DraftHistory;
    if (!parsed || !Array.isArray(parsed.versions)) return { versions: [] };
    return parsed;
  } catch {
    return { versions: [] };
  }
}

function writeHistory(key: string, history: DraftHistory): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(history));
  } catch {
    // ignore quota errors
  }
}

function appendHistoryVersion(
  key: string,
  version: Omit<DraftVersion, 'id'>,
): DraftHistory {
  const history = readHistory(key);
  const fullVersion: DraftVersion = { ...version, id: genVersionId() };
  const newVersions = [fullVersion, ...history.versions].slice(0, MAX_HISTORY_ITEMS);
  const newHistory: DraftHistory = { versions: newVersions, currentId: fullVersion.id };
  writeHistory(key, newHistory);
  return newHistory;
}

function clearHistory(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readLegacyBackup(key: string): DraftVersion | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.title !== 'string' || typeof parsed.content !== 'string') return null;
    return {
      id: genVersionId(),
      title: parsed.title,
      content: parsed.content,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      savedAt: parsed.savedAt || Date.now(),
      source: 'local',
    };
  } catch {
    return null;
  }
}

function clearLegacyBackup(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

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

export function MarkdownEditor({ initialArticle }: MarkdownEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialArticle?.title || '');
  const [content, setContent] = useState(initialArticle?.content || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialArticle?.tags.map((t) => t.name) || []);
  const [isPreview, setIsPreview] = useState(false);
  const [isSplit, setIsSplit] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [articleId, setArticleId] = useState(initialArticle?.id || null);
  const [history, setHistory] = useState<DraftHistory>({ versions: [] });
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<DraftVersion | null>(null);
  const [restorePrompt, setRestorePrompt] = useState<{ version: DraftVersion; newer: boolean } | null>(null);

  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const localBackupTimer = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChanges = useRef(false);
  const didMigrateLegacy = useRef(false);

  const renderedContent = marked.parse(content) as string;
  const previewRenderedContent = previewVersion
    ? (marked.parse(previewVersion.content) as string)
    : '';

  const historyKey = () => getHistoryKey(articleId);
  const legacyKey = () => getLegacyBackupKey(articleId);

  const refreshHistory = useCallback(() => {
    if (typeof window === 'undefined') return;
    setHistory(readHistory(historyKey()));
  }, [articleId]);

  const commitLocalBackup = useCallback(
    (source: DraftVersion['source']) => {
      if (typeof window === 'undefined') return;
      if (!title && !content && tags.length === 0) return;
      const version: Omit<DraftVersion, 'id'> = {
        title,
        content,
        tags,
        savedAt: Date.now(),
        source,
      };
      const newHistory = appendHistoryVersion(historyKey(), version);
      setHistory(newHistory);
    },
    [title, content, tags, articleId],
  );

  const scheduleLocalBackup = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (localBackupTimer.current) {
      clearTimeout(localBackupTimer.current);
    }
    localBackupTimer.current = setTimeout(() => {
      commitLocalBackup('local');
    }, LOCAL_BACKUP_DEBOUNCE);
  }, [commitLocalBackup]);

  const clearAllHistories = useCallback(() => {
    clearHistory(getHistoryKey(null));
    clearHistory(getHistoryKey(articleId));
    clearLegacyBackup(getLegacyBackupKey(null));
    clearLegacyBackup(getLegacyBackupKey(articleId));
    setHistory({ versions: [] });
  }, [articleId]);

  const applyVersion = useCallback((v: DraftVersion) => {
    setTitle(v.title);
    setContent(v.content);
    setTags(v.tags);
    hasUnsavedChanges.current = true;
    setHistory((h) => ({ ...h, currentId: v.id }));
    setPreviewVersion(null);
    setHistoryPanelOpen(false);
  }, []);

  const deleteVersion = useCallback((id: string) => {
    if (typeof window === 'undefined') return;
    const h = readHistory(historyKey());
    const newVersions = h.versions.filter((v) => v.id !== id);
    const newHistory: DraftHistory = {
      versions: newVersions,
      currentId: h.currentId === id ? undefined : h.currentId,
    };
    writeHistory(historyKey(), newHistory);
    setHistory(newHistory);
    if (previewVersion?.id === id) setPreviewVersion(null);
  }, [articleId, previewVersion]);

  const clearAllVersions = useCallback(() => {
    if (typeof window === 'undefined') return;
    writeHistory(historyKey(), { versions: [] });
    setHistory({ versions: [] });
    setPreviewVersion(null);
  }, [articleId]);

  const handleAutoSave = useCallback(async () => {
    if (!hasUnsavedChanges.current) return;

    try {
      setSaving(true);
      setSaveStatus('saving');

      commitLocalBackup('auto');

      const result = await saveDraft({
        id: articleId || undefined,
        title,
        content,
        tagNames: tags,
      });

      if ('error' in result && result.error) {
        setError(result.error);
        setSaveStatus('error');
      } else if ('article' in result && result.article) {
        if (!articleId && result.article.id) {
          const oldHistory = readHistory(getHistoryKey(null));
          if (oldHistory.versions.length > 0) {
            writeHistory(getHistoryKey(result.article.id), oldHistory);
            clearHistory(getHistoryKey(null));
          }
          const oldLegacy = readLegacyBackup(getLegacyBackupKey(null));
          if (oldLegacy) {
            const oldAsVersion: DraftVersion = { ...oldLegacy, source: 'local' };
            appendHistoryVersion(getHistoryKey(result.article.id), oldAsVersion);
            clearLegacyBackup(getLegacyBackupKey(null));
          }
          setArticleId(result.article.id);
        }
        setLastSaved(new Date());
        setSaveStatus('success');
        hasUnsavedChanges.current = false;
      }
    } catch (e) {
      setError('自动保存失败');
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [articleId, title, content, tags, commitLocalBackup]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (didMigrateLegacy.current) return;
    didMigrateLegacy.current = true;

    const key = historyKey();
    const legacy = legacyKey();
    const legacyBackup = readLegacyBackup(legacy);

    let historyData = readHistory(key);
    if (legacyBackup) {
      const versions = [
        { ...legacyBackup, id: legacyBackup.id || genVersionId(), source: 'local' as const },
        ...historyData.versions,
      ].slice(0, MAX_HISTORY_ITEMS);
      historyData = { versions, currentId: historyData.currentId || versions[0]?.id };
      writeHistory(key, historyData);
      clearLegacyBackup(legacy);
    }
    setHistory(historyData);

    const latest = historyData.versions[0];
    if (latest) {
      const hasServerContent = !!(
        initialArticle?.title ||
        initialArticle?.content ||
        (initialArticle?.tags?.length || 0) > 0
      );
      const serverUpdatedAt = initialArticle?.updatedAt
        ? new Date(initialArticle.updatedAt).getTime()
        : 0;

      if (!hasServerContent) {
        const notEmpty = latest.title || latest.content || latest.tags.length > 0;
        if (notEmpty) {
          setRestorePrompt({ version: latest, newer: false });
        }
      } else if (latest.savedAt > serverUpdatedAt) {
        const sameAsServer =
          latest.title === (initialArticle?.title || '') &&
          latest.content === (initialArticle?.content || '') &&
          JSON.stringify([...latest.tags].sort()) ===
            JSON.stringify([...(initialArticle?.tags?.map((t) => t.name) || [])].sort());
        if (!sameAsServer) {
          setRestorePrompt({ version: latest, newer: true });
        }
      }
    }
  }, []);

  useEffect(() => {
    hasUnsavedChanges.current = true;
    scheduleLocalBackup();
  }, [title, content, tags, scheduleLocalBackup]);

  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (title || content) {
        handleAutoSave();
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimer.current) {
        clearInterval(autoSaveTimer.current);
      }
    };
  }, [handleAutoSave, title, content]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if ((title || content) && typeof window !== 'undefined') {
        commitLocalBackup('local');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [title, content, tags, commitLocalBackup]);

  const handleRestoreBackup = () => {
    if (!restorePrompt) return;
    applyVersion(restorePrompt.version);
    setRestorePrompt(null);
  };

  const handleDiscardBackup = () => {
    setRestorePrompt(null);
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleManualSave = async () => {
    commitLocalBackup('manual');
    await handleAutoSave();
  };

  const handlePublish = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!title.trim()) {
      setError('请输入文章标题');
      return;
    }

    try {
      setSaving(true);
      const action = articleId
        ? updateArticle(articleId, { title, content, status, tagNames: tags })
        : createArticle({ title, content, status, tagNames: tags });

      const result = await action;

      if ('error' in result && result.error) {
        setError(result.error);
      } else if ('article' in result && result.article) {
        clearAllHistories();
        if (status === 'PUBLISHED') {
          router.push(`/articles/${result.article.slug}`);
        } else {
          router.push('/admin');
        }
      }
    } catch (e) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {restorePrompt && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {restorePrompt.newer ? '本地有更新的草稿内容' : '发现本地备份草稿'}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {versionSourceLabel(restorePrompt.version.source)} · {formatVersionTime(restorePrompt.version.savedAt)}
                {restorePrompt.version.title && ` · 标题: ${restorePrompt.version.title}`}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleRestoreBackup}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  恢复备份
                </button>
                <button
                  onClick={handleDiscardBackup}
                  className="px-3 py-1.5 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  使用服务器版本
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 px-1 sm:px-0">
        <div className="flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入文章标题..."
            className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => { setIsPreview(false); setIsSplit(false); }}
              className={`p-2 rounded-md transition-colors ${!isPreview && !isSplit ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
              title="仅编辑"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setIsSplit(true); setIsPreview(false); }}
              className={`p-2 rounded-md transition-colors ${isSplit ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
              title="分屏预览"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setIsPreview(true); setIsSplit(false); }}
              className={`p-2 rounded-md transition-colors ${isPreview ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
              title="仅预览"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Save className="w-4 h-4 animate-spin" />
                保存中...
              </span>
            )}
            {saveStatus === 'success' && lastSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                保存失败
              </span>
            )}
            <button
              onClick={() => { setHistoryPanelOpen((v) => !v); refreshHistory(); }}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                historyPanelOpen
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                  : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title={`草稿历史 (${history.versions.length})`}
            >
              <History className="w-4 h-4" />
              历史
              {history.versions.length > 0 && (
                <span className="text-xs bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded-full">
                  {history.versions.length}
                </span>
              )}
              {historyPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              保存草稿
            </button>
            <button
              onClick={() => handlePublish('PUBLISHED')}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              发布
            </button>
          </div>
        </div>
      </div>

      {historyPanelOpen && (
        <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">草稿历史</h3>
              <span className="text-xs text-slate-500">
                保留最近 {MAX_HISTORY_ITEMS} 个版本
              </span>
            </div>
            {history.versions.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('确定清空所有历史版本？此操作不可撤销。')) clearAllVersions();
                }}
                className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空全部
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-x-0 md:divide-x divide-y md:divide-y-0 divide-slate-200 dark:divide-slate-700 max-h-[340px]">
            <div className="md:col-span-1 overflow-auto max-h-[340px]">
              {history.versions.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  暂无历史版本
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {history.versions.map((v, idx) => (
                    <li
                      key={v.id}
                      className={`group px-4 py-3 cursor-pointer transition-colors ${
                        previewVersion?.id === v.id
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : history.currentId === v.id && idx === 0
                          ? 'bg-slate-50 dark:bg-slate-700/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      }`}
                      onClick={() => setPreviewVersion(v)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              v.source === 'auto'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : v.source === 'manual'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {versionSourceLabel(v.source)}
                            </span>
                            {idx === 0 && (
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
                              applyVersion(v);
                            }}
                            className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded transition-colors"
                            title="恢复此版本"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('删除此历史版本？')) deleteVersion(v.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="删除此版本"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:col-span-2 overflow-auto max-h-[340px] bg-slate-50/50 dark:bg-slate-900/20">
              {previewVersion ? (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
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
                    <button
                      onClick={() => applyVersion(previewVersion)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      恢复此版本
                    </button>
                  </div>
                  <div className="markdown-body prose dark:prose-invert max-w-none text-sm">
                    {previewVersion.content ? (
                      <div dangerouslySetInnerHTML={{ __html: previewRenderedContent }} />
                    ) : (
                      <p className="text-slate-400 italic">（此版本无正文内容）</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-6 text-sm text-slate-500">
                  <div className="text-center">
                    <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>点击左侧版本查看预览</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span className="text-sm text-slate-500">标签:</span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
          >
            {tag}
            <button onClick={() => handleRemoveTag(tag)} className="hover:text-primary-900 dark:hover:text-primary-100">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={handleAddTag}
          placeholder="输入标签后按回车..."
          className="flex-1 min-w-[150px] px-2 py-1 text-sm bg-transparent border-none outline-none"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4 flex-1 overflow-hidden">
        {!isPreview && (
          <div className={`${isSplit ? 'w-1/2' : 'w-full'} flex flex-col min-h-0`}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此输入 Markdown 内容..."
              className="flex-1 w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
        )}

        {(isPreview || isSplit) && (
          <div className={`${isSplit && !isPreview ? 'w-1/2' : 'w-full'} min-h-0 overflow-auto`}>
            <div className="h-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="markdown-body prose dark:prose-invert max-w-none">
                {content ? (
                  <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
                ) : (
                  <p className="text-slate-400 text-center py-12">预览区域 - 开始输入内容...</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-400 flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          每60秒自动保存草稿
        </span>
        <span className="flex items-center gap-1">
          <History className="w-3 h-3" />
          {history.versions.length > 0
            ? `历史版本: ${history.versions.length} 个 (最新 ${history.versions[0] ? formatVersionTime(history.versions[0].savedAt).split(' ')[1] : ''})`
            : '暂无历史版本'}
        </span>
        <span>字数: {content.length}</span>
      </div>
    </div>
  );
}
