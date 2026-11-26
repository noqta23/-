import React, { useState, useEffect } from 'react';
import { RotateCcw, Trash2, Download, Folder, FileText, HelpCircle } from 'lucide-react';
import { DeletedItem } from '../types/nukhaa';
import { formatUtcToLocal } from '../utils/arabicHighlight';

interface AdminDashboardViewProps {
  onRefreshLibrary: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onRefreshLibrary }) => {
  const [stats, setStats] = useState<any>(null);

  const loadDashboard = async () => {
    const res = await fetch('/api/dashboard');
    if (res.ok) {
      setStats(await res.json());
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRestore = async (id: string) => {
    const res = await fetch('/api/deleted/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      await loadDashboard();
      onRefreshLibrary();
    }
  };

  const handlePermanentDelete = async (id: string) => {
    const res = await fetch(`/api/deleted/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadDashboard();
    }
  };

  if (!stats) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        جارٍ تحميل إحصائيات المنصة وسلة المحذوفات...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* شريط المؤشرات الرقمية الدقيقة (Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9aa5b8]">
            <span>إجمالي الملفات والمحاضرات</span>
            <FileText className="w-4 h-4 text-[#C9956C]" />
          </div>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.files_count}
          </p>
        </div>

        <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9aa5b8]">
            <span>الأقسام والمجلدات الأكاديمية</span>
            <Folder className="w-4 h-4 text-[#C9956C]" />
          </div>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.folders_count}
          </p>
        </div>

        <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9aa5b8]">
            <span>بنك الأسئلة ومحطات OSCE</span>
            <HelpCircle className="w-4 h-4 text-[#C9956C]" />
          </div>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.questions_count}
          </p>
        </div>

        <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9aa5b8]">
            <span>الوسوم والجامعات المسجلة</span>
            <Download className="w-4 h-4 text-[#C9956C]" />
          </div>
          <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.tags_count}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* أكثر الملفات تحميلاً */}
        <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">
            أكثر المراجع والمحاضرات تحميلاً
          </h3>
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {(stats.top_downloads || []).map((f: any, idx: number) => (
              <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#e8e0d5] truncate">
                    {idx + 1}. {f.file_name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#9aa5b8] mt-0.5">
                    {(f.tags || []).join(' · ')}
                  </p>
                </div>
                <span className="font-mono-num text-xs font-semibold text-[#A07040] dark:text-[#C9956C] shrink-0">
                  {f.downloads} تنزيل
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* سلة المحذوفات والاستعادة (30 يوماً) */}
        <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">
            سلة المحذوفات المؤقتة (تُحفظ لمدة 30 يوماً)
          </h3>

          {(stats.recent_deleted || []).length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">سلة المحذوفات فارغة حالياً.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {(stats.recent_deleted as DeletedItem[]).map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-[#e8e0d5] truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#9aa5b8] mt-0.5">
                      حُذف في {formatUtcToLocal(item.deleted_at)} · متبقي {item.remaining_days} يوم
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRestore(item.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>استعادة</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(item.id)}
                      className="p-1.5 rounded-lg bg-red-500/15 text-red-500 cursor-pointer"
                      title="حذف نهائي"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
