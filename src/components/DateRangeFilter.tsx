'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

interface DateRangePreset {
  key: string;
  label: string;
  getRange: () => { from: Date; to?: Date };
}

const PRESETS: DateRangePreset[] = [
  {
    key: '7d',
    label: '近7天',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return { from, to };
    },
  },
  {
    key: '30d',
    label: '近30天',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { from, to };
    },
  },
  {
    key: '90d',
    label: '近3个月',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 90);
      return { from, to };
    },
  },
  {
    key: '1y',
    label: '近1年',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      return { from, to };
    },
  },
];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  const activePreset = useMemo(() => {
    if (!dateFrom && !dateTo) return null;
    if (dateTo) return null;
    const now = new Date();
    const todayYmd = toYmd(now);
    for (const p of PRESETS) {
      const { from, to } = p.getRange();
      if (to && toYmd(to) === todayYmd && toYmd(from) === dateFrom) {
        return p.key;
      }
    }
    return 'custom';
  }, [dateFrom, dateTo]);

  const hasFilter = !!dateFrom || !!dateTo;

  const isCustomMode = activePreset === 'custom';

  useEffect(() => {
    if (isCustomMode && !customOpen) {
      setCustomOpen(true);
      if (!customFrom) setCustomFrom(dateFrom);
      if (!customTo) setCustomTo(dateTo);
    }
  }, [isCustomMode, customOpen, dateFrom, dateTo, customFrom, customTo]);

  const applyParams = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set('dateFrom', from);
    else params.delete('dateFrom');
    if (to) params.set('dateTo', to);
    else params.delete('dateTo');
    const query = params.toString();
    router.replace(query ? `/?${query}` : '/');
  };

  const handlePreset = (preset: DateRangePreset) => {
    const { from, to } = preset.getRange();
    applyParams(toYmd(from), to ? toYmd(to) : '');
    setCustomOpen(false);
  };

  const handleClear = () => {
    applyParams('', '');
    setCustomFrom('');
    setCustomTo('');
    setCustomOpen(false);
  };

  const handleCustomApply = () => {
    applyParams(customFrom, customTo);
    setCustomOpen(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          发布时间
        </h3>
        {hasFilter && (
          <button
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X className="w-3 h-3" />
            清除
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePreset(p)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activePreset === p.key
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activePreset === 'custom' || customOpen
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300'
          }`}
        >
          自定义
        </button>
      </div>

      {hasFilter && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {dateFrom && (
            <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded">
              从: <span className="font-mono">{dateFrom}</span>
            </span>
          )}
          {dateTo && (
            <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded">
              至: <span className="font-mono">{dateTo}</span>
            </span>
          )}
        </div>
      )}

      {customOpen && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">开始日期</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">结束日期</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setCustomOpen(false);
                setCustomFrom(dateFrom);
                setCustomTo(dateTo);
              }}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCustomApply}
              className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              应用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
