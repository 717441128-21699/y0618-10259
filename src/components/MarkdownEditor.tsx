'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';
import { saveDraft, createArticle, updateArticle } from '@/lib/actions/article';
import { Save, Eye, Edit3, Send, Clock, CheckCircle, AlertCircle, X, HardDrive, RotateCcw } from 'lucide-react';
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

interface LocalBackup {
  title: string;
  content: string;
  tags: string[];
  savedAt: number;
}

function getBackupKey(articleId: string | null): string {
  return `blog_draft_backup_${articleId || 'new'}`;
}

function readLocalBackup(key: string): LocalBackup | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalBackup;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.title !== 'string' || typeof parsed.content !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalBackup(key: string, data: LocalBackup): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function clearLocalBackup(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
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
  const [localBackupTime, setLocalBackupTime] = useState<Date | null>(null);
  const [restorePrompt, setRestorePrompt] = useState<LocalBackup | null>(null);

  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const localBackupTimer = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChanges = useRef(false);

  const renderedContent = marked.parse(content) as string;

  const backupKey = getBackupKey(articleId);

  const scheduleLocalBackup = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (localBackupTimer.current) {
      clearTimeout(localBackupTimer.current);
    }
    localBackupTimer.current = setTimeout(() => {
      if (!title && !content && tags.length === 0) {
        clearLocalBackup(backupKey);
        setLocalBackupTime(null);
        return;
      }
      const backup: LocalBackup = {
        title,
        content,
        tags,
        savedAt: Date.now(),
      };
      writeLocalBackup(backupKey, backup);
      setLocalBackupTime(new Date(backup.savedAt));
    }, LOCAL_BACKUP_DEBOUNCE);
  }, [title, content, tags, backupKey]);

  const clearAllBackups = useCallback(() => {
    clearLocalBackup(getBackupKey(null));
    clearLocalBackup(getBackupKey(articleId));
  }, [articleId]);

  const handleAutoSave = useCallback(async () => {
    if (!hasUnsavedChanges.current) return;

    try {
      setSaving(true);
      setSaveStatus('saving');

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
          const oldKey = getBackupKey(null);
          const oldBackup = readLocalBackup(oldKey);
          if (oldBackup) {
            const newKey = getBackupKey(result.article.id);
            writeLocalBackup(newKey, oldBackup);
            clearLocalBackup(oldKey);
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
  }, [articleId, title, content, tags]);

  useEffect(() => {
    const key = getBackupKey(articleId);
    const backup = readLocalBackup(key);
    if (backup) {
      const isEmpty = !initialArticle?.title && !initialArticle?.content && (initialArticle?.tags?.length || 0) === 0;
      const backupNotEmpty = backup.title || backup.content || backup.tags.length > 0;
      if (isEmpty && backupNotEmpty) {
        setRestorePrompt(backup);
      } else if (backupNotEmpty) {
        const backupTime = new Date(backup.savedAt);
        const initialEmpty = !title && !content && tags.length === 0;
        if (initialEmpty) {
          setRestorePrompt(backup);
        } else {
          setLocalBackupTime(backupTime);
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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((title || content) && typeof window !== 'undefined') {
        const backup: LocalBackup = {
          title,
          content,
          tags,
          savedAt: Date.now(),
        };
        writeLocalBackup(backupKey, backup);
      }
      if (hasUnsavedChanges.current && (title || content)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [title, content, tags, backupKey]);

  const handleRestoreBackup = () => {
    if (!restorePrompt) return;
    setTitle(restorePrompt.title);
    setContent(restorePrompt.content);
    setTags(restorePrompt.tags);
    setLocalBackupTime(new Date(restorePrompt.savedAt));
    setRestorePrompt(null);
    hasUnsavedChanges.current = true;
  };

  const handleDiscardBackup = () => {
    clearLocalBackup(backupKey);
    setRestorePrompt(null);
    setLocalBackupTime(null);
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
        clearAllBackups();
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
                发现本地备份草稿
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                备份时间: {new Date(restorePrompt.savedAt).toLocaleString()}
                {restorePrompt.title && ` · 标题: ${restorePrompt.title}`}
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
                  放弃备份
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
            {localBackupTime && saveStatus === 'idle' && (
              <span className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1" title={`本地备份于 ${localBackupTime.toLocaleString()}`}>
                <HardDrive className="w-4 h-4" />
                {localBackupTime.toLocaleTimeString()}
              </span>
            )}
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

      <div className="flex gap-4 flex-1">
        {!isPreview && (
          <div className={`${isSplit ? 'w-1/2' : 'w-full'} flex flex-col min-h-[500px]`}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此输入 Markdown 内容..."
              className="flex-1 w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
        )}

        {(isPreview || isSplit) && (
          <div className={`${isSplit && !isPreview ? 'w-1/2' : 'w-full'} min-h-[500px] overflow-auto`}>
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
          <HardDrive className="w-3 h-3" />
          本地实时备份（断网可恢复）
        </span>
        <span>字数: {content.length}</span>
      </div>
    </div>
  );
}
