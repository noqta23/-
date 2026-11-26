import React, { useState, useEffect } from 'react';
import {
  Send,
  Check,
  X,
  FolderInput,
  DownloadCloud,
  RefreshCw,
} from 'lucide-react';
import { FolderItem, PendingBotFile } from '../types/nukhaa';
import { formatUtcToLocal } from '../utils/arabicHighlight';

interface IntegrationsInboxViewProps {
  folders: FolderItem[];
  onRefreshLibrary: () => void;
}

export const IntegrationsInboxView: React.FC<IntegrationsInboxViewProps> = ({
  folders,
  onRefreshLibrary,
}) => {
  const [pendingFiles, setPendingFiles] = useState<PendingBotFile[]>([]);
  const [botReceive, setBotReceive] = useState(true);
  const [targetFolders, setTargetFolders] = useState<Record<string, string>>({});
  const [courses, setCourses] = useState<any[]>([]);
  const [importedIds, setImportedIds] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadInboxAndCourses = async () => {
    const [inboxRes, coursesRes] = await Promise.all([
      fetch('/api/pending-bot-files'),
      fetch('/api/google/classroom/courses'),
    ]);
    if (inboxRes.ok) {
      const data = await inboxRes.json();
      setPendingFiles(data.items || []);
      setBotReceive(Boolean(data.bot_receive_enabled));
    }
    if (coursesRes.ok) {
      const cData = await coursesRes.json();
      setCourses(cData.courses || []);
    }
  };

  useEffect(() => {
    loadInboxAndCourses();
  }, []);

  const handleToggleBotReceive = async () => {
    const next = !botReceive;
    setBotReceive(next);
    await fetch('/api/bot-receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    });
  };

  const handleAcceptBotFile = async (item: PendingBotFile) => {
    const folderId = targetFolders[item.id] || 'baghdad-med';
    const res = await fetch('/api/assign-file-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: item.id,
        folder_id: folderId,
        tags: item.suggested_tags,
      }),
    });
    if (res.ok) {
      setPendingFiles((prev) => prev.filter((f) => f.id !== item.id));
      setStatusMessage(`تم قبول "${item.file_name}" وإضافته للمجلد المحدد بنجاح.`);
      onRefreshLibrary();
    }
  };

  const handleRejectBotFile = async (id: string) => {
    await fetch(`/api/pending-bot-files/${id}`, { method: 'DELETE' });
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleImportClassroomMaterial = async (mat: any, folderId = 'baghdad-med') => {
    const res = await fetch('/api/google/classroom/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: mat.title,
        size: mat.size,
        tags: mat.tags,
        folder_id: folderId,
      }),
    });
    if (res.ok) {
      setImportedIds((prev) => ({ ...prev, [mat.id]: true }));
      setStatusMessage(`تم استيراد "${mat.title}" من Google Classroom إلى مكتبة نخاع.`);
      onRefreshLibrary();
    }
  };

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs underline cursor-pointer"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* القسم الأول: صندوق وارد بوت تيليجرام (@NukhaaBot) */}
      <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#C9956C]" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                صندوق وارد بوت تيليجرام (@NukhaaBot)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#9aa5b8]">
              الملفات المرسلة للبوت بدون مجلد تبقى معلّقة هنا حتى يتم فرزها وقبولها في المجلد المناسب.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleBotReceive}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                botReceive
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-100 dark:bg-[#0b162c] text-slate-500 border-slate-300 dark:border-white/15'
              }`}
            >
              {botReceive ? '● استقبال ملفات البوت: مفعّل' : '○ استقبال ملفات البوت: متوقف'}
            </button>
            <button
              onClick={loadInboxAndCourses}
              className="p-2 rounded-lg bg-slate-100 dark:bg-[#0b162c] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 cursor-pointer"
              title="تحديث الصندوق"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pendingFiles.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-[#9aa5b8]">
            لا توجد ملفات معلّقة في صندوق وارد البوت حالياً — تم فرز جميع الملفات.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {pendingFiles.map((item) => (
              <div
                key={item.id}
                className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-[#f3ece2]">
                    {item.file_name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{item.caption}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#9aa5b8]">
                    <span>المرسل: {item.sender_name}</span>
                    <span>·</span>
                    <span dir="ltr">{item.sender_username}</span>
                    <span>·</span>
                    <span className="font-mono-num">{item.file_size_formatted}</span>
                    <span>·</span>
                    <span>{formatUtcToLocal(item.received_at)}</span>
                    {item.suggested_tags.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-[#A07040] dark:text-[#C9956C]">
                          الوسوم المقترحة: {item.suggested_tags.join(' / ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0b162c] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                    <FolderInput className="w-3.5 h-3.5 text-[#C9956C]" />
                    <select
                      value={targetFolders[item.id] || 'baghdad-med'}
                      onChange={(e) =>
                        setTargetFolders((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="bg-transparent text-xs text-slate-800 dark:text-[#e8e0d5] focus:outline-none"
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.id} className="bg-white dark:bg-[#0b162c]">
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleAcceptBotFile(item)}
                    className="px-3.5 py-2 rounded-lg bg-[#C9956C] text-[#0b162c] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>قبول وتصنيف</span>
                  </button>
                  <button
                    onClick={() => handleRejectBotFile(item.id)}
                    className="px-3 py-2 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>رفض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* القسم الثاني: استيراد محاضرات Google Classroom & Drive */}
      <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-5">
        <div className="border-b border-slate-200 dark:border-white/10 pb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            استيراد المقررات من Google Classroom و Google Drive
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#9aa5b8] mt-1">
            معاينة المواد المنشورة في الصفوف الجامعية واستيرادها مباشرة إلى مجلدات منصة نخاع مع وسومها الأكاديمية.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b162c]/80 border border-slate-200 dark:border-white/10 space-y-3"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#f3ece2]">
                  {course.name}
                </h3>
                <p className="text-xs text-[#A07040] dark:text-[#C9956C]">{course.section}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                {(course.materials || []).map((mat: any) => {
                  const isDone = Boolean(importedIds[mat.id]);
                  return (
                    <div
                      key={mat.id}
                      className="p-3 rounded-lg bg-white dark:bg-[#111e3e] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-[#e8e0d5] truncate">
                          {mat.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#9aa5b8] mt-0.5">
                          {mat.tags?.join(' · ')}
                        </p>
                      </div>
                      <button
                        disabled={isDone}
                        onClick={() =>
                          handleImportClassroomMaterial(
                            mat,
                            course.id.includes('basra') ? 'basra-zahraa' : 'internal-med'
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          isDone
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-[#C9956C] text-[#0b162c]'
                        }`}
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>{isDone ? 'تم الاستيراد' : 'استيراد للمكتبة'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
