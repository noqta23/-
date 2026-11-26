import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Folder,
  FileText,
  Volume2,
  HelpCircle,
  Star,
  Download,
  Trash2,
  Plus,
  ChevronLeft,
  Sun,
  Moon,
  RotateCcw,
  Bold,
  Italic,
  Code,
  Quote,
  ExternalLink,
  Layers,
} from 'lucide-react';
import {
  FolderItem,
  TagCategory,
  TagItem,
  QuizItem,
} from './types/nukhaa';
import { highlightArabicText, formatUtcToLocal } from './utils/arabicHighlight';
import { QuizStudioView } from './components/QuizStudioView';
import { TaxonomyManagerView } from './components/TaxonomyManagerView';
import { IntegrationsInboxView } from './components/IntegrationsInboxView';
import { AdminDashboardView } from './components/AdminDashboardView';

type ActiveTab = 'library' | 'quizzes' | 'taxonomy' | 'inbox' | 'admin';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('library');
  const [darkMode, setDarkMode] = useState(true);

  // بيانات المكتبة والمجلدات
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [items, setItems] = useState<any[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: 'root', name: 'الرئيسية' },
  ]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);

  // البحث والتصفية بالوسوم
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDeep, setSearchDeep] = useState(true);
  const [tagMatchMode, setTagMatchMode] = useState<'all' | 'any'>('any');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'rating' | 'size'>('date');
  const [hoveredTagLabel, setHoveredTagLabel] = useState<string>('');

  // بيانات الوسوم والاختبارات
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  // نافذة التفاصيل الموحدة للملفات والاختبارات (#modal-file-details)
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [mediaPlayerOpen, setMediaPlayerOpen] = useState(false);

  // نافذة إضافة محتوى جديد (مجلد / ملف / ملاحظة نصية منسقة)
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'file' | 'note' | 'folder'>('file');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newContentHtml, setNewContentHtml] = useState('');
  const [newFileType, setNewFileType] = useState<'pdf' | 'audio' | 'document'>('pdf');
  const [newModalTags, setNewModalTags] = useState<string[]>([]);

  useEffect(() => {
    const rootEl = document.documentElement;
    if (darkMode) {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchMetadata = useCallback(async () => {
    const [tagsRes, foldersRes, quizzesRes] = await Promise.all([
      fetch('/api/tags'),
      fetch('/api/folders'),
      fetch('/api/quizzes'),
    ]);
    if (tagsRes.ok) {
      const tData = await tagsRes.json();
      setCategories(tData.categories || []);
      setTags(tData.tags || []);
    }
    if (foldersRes.ok) {
      setAllFolders(await foldersRes.json());
    }
    if (quizzesRes.ok) {
      setQuizzes(await quizzesRes.json());
    }
  }, []);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        folder_id: currentFolderId,
        q: searchQuery,
        sort_by: sortBy,
        sort_order: 'desc',
        search_deep: searchDeep ? '1' : '0',
        tag_match: tagMatchMode,
        tags: selectedTags.join(','),
      });
      const res = await fetch(`/api/contents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setBreadcrumbs(data.path || [{ id: 'root', name: 'الرئيسية' }]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, searchQuery, sortBy, searchDeep, tagMatchMode, selectedTags]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const handleToggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleSelectGroupTags = (groupNames: string[]) => {
    setSelectedTags((prev) => Array.from(new Set([...prev, ...groupNames])));
  };

  const handleClearGroupTags = (groupNames: string[]) => {
    const removeSet = new Set(groupNames);
    setSelectedTags((prev) => prev.filter((t) => !removeSet.has(t)));
  };

  // تحديث فوري للتقييم بالنجوم (toggleRatingInline pattern)
  const handleRateItem = async (item: any, stars = 5, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const itemType = item.item_type || 'file';
    // تحديث فوري في الواجهة
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              user_rating: stars,
              rating: {
                avg: stars,
                count: (it.rating?.count || 0) + (it.user_rating ? 0 : 1),
                total: (it.rating?.total || 0) + stars,
              },
            }
          : it
      )
    );
    if (detailItem && detailItem.id === item.id) {
      setDetailItem((prev: any) => ({ ...prev, user_rating: stars }));
    }

    const res = await fetch(`/api/ratings/${itemType}/${item.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, rating: updated.rating, user_rating: updated.user_rating }
            : it
        )
      );
    }
  };

  const handleDownloadFile = async (fileItem: any) => {
    const res = await fetch(`/api/files/${fileItem.id}/download`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) =>
        prev.map((it) => (it.id === fileItem.id ? { ...it, downloads: data.downloads } : it))
      );
      if (detailItem?.id === fileItem.id) {
        setDetailItem((prev: any) => ({ ...prev, downloads: data.downloads }));
      }
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (item.item_type === 'folder') {
      await fetch(`/api/folders/${item.id}`, { method: 'DELETE' });
    } else if (item.item_type === 'file') {
      await fetch(`/api/files/${item.id}`, { method: 'DELETE' });
    }
    setDetailItem(null);
    await fetchContents();
    await fetchMetadata();
  };

  const insertFormatTag = (tag: 'b' | 'i' | 'code' | 'blockquote') => {
    const sample =
      tag === 'b'
        ? '<b>نص طبي مهم</b>'
        : tag === 'i'
        ? '<i>مصطلح سريري</i>'
        : tag === 'code'
        ? '<code>PaCO2 = 40 mmHg</code>'
        : '<blockquote>ملاحظة سريرية مهمة للطالب</blockquote>';
    setNewContentHtml((prev) => (prev ? `${prev}<br/>${sample}` : sample));
  };

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (addMode === 'folder') {
      await fetch('/api/folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTitle.trim(),
          parent_id: currentFolderId,
          description: newDesc.trim(),
          tags: newModalTags,
        }),
      });
    } else {
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: newTitle.trim(),
          file_type: addMode === 'note' ? 'text_note' : newFileType,
          file_size: addMode === 'note' ? 16400 : 4850000,
          folder_id: currentFolderId,
          tags: newModalTags,
          description: newDesc.trim(),
          content: addMode === 'note' ? newContentHtml : '',
        }),
      });
    }

    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewContentHtml('');
    setNewModalTags([]);
    await fetchContents();
    await fetchMetadata();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f4efe6] to-[#e8dfd1] dark:from-[#0b162c] dark:to-[#15274d] text-slate-900 dark:text-[#e8e0d5] transition-colors">
      {/* =========================================================
          الشريط العلوي القياسي (3-Zone Top Bar Contract)
         ========================================================= */}
      <header className="sticky top-0 z-40 h-16 bg-white/90 dark:bg-[#081026]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 md:px-8 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (single element, whitespace-nowrap shrink-0) */}
        <a
          href="#library"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('library');
            setCurrentFolderId('root');
          }}
          className="flex items-center gap-2.5 text-xl font-bold font-amiri text-[#A07040] dark:text-[#C9956C] whitespace-nowrap shrink-0"
        >
          <img
            src="/static/assets/nukhaa-logo.png"
            alt="شعار نخاع"
            referrerPolicy="no-referrer"
            className="w-8 h-8 object-contain"
          />
          <span>نخاع</span>
        </a>

        {/* Zone 2: 5 Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-[#b0a898]">
          <button
            onClick={() => setActiveTab('library')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'library'
                ? 'text-[#A07040] dark:text-[#C9956C] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            المكتبة والملفات
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'quizzes'
                ? 'text-[#A07040] dark:text-[#C9956C] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            الاختبارات و OSCE
          </button>
          <button
            onClick={() => setActiveTab('taxonomy')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'taxonomy'
                ? 'text-[#A07040] dark:text-[#C9956C] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            تصنيفات الجامعات
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'inbox'
                ? 'text-[#A07040] dark:text-[#C9956C] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            وارد البوت و Classroom
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'admin'
                ? 'text-[#A07040] dark:text-[#C9956C] font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            الإحصائيات والمحذوفات
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-semibold bg-[#C9956C] text-[#0b162c] rounded-lg hover:bg-[#d7a67e] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            + إضافة محتوى
          </button>
        </div>
      </header>

      {/* شريط تنقل متجاوب للشاشات الصغيرة */}
      <div className="md:hidden flex items-center justify-around bg-white/90 dark:bg-[#0b162c]/95 border-b border-slate-200 dark:border-white/10 px-2 py-2 text-xs">
        {(
          [
            ['library', 'المكتبة'],
            ['quizzes', 'الاختبارات'],
            ['taxonomy', 'الجامعات'],
            ['inbox', 'الوارد'],
            ['admin', 'الإدارة'],
          ] as Array<[ActiveTab, string]>
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`px-2.5 py-1.5 rounded-md whitespace-nowrap shrink-0 ${
              activeTab === tabKey
                ? 'bg-[#C9956C] text-[#0b162c] font-bold'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* =========================================================
          المحتوى الرئيسي (1440px max-w-7xl container)
         ========================================================= */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* شريط أدوات مساحة العمل (البحث، الترتيب، المظهر) */}
        <section className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* حقل البحث العربي الذكي */}
          <div className="flex-1 flex items-center gap-2.5 bg-slate-50 dark:bg-[#0b162c] border border-slate-200 dark:border-white/15 rounded-lg px-3.5 py-2 focus-within:border-[#C9956C]">
            <Search className="w-4 h-4 text-[#C9956C] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'library') setActiveTab('library');
              }}
              placeholder="ابحث في المحاضرات، الملاحظات السريرية، المجلدات (يدعم تطابق الهمزات والياء والكاف)..."
              className="w-full bg-transparent text-xs md:text-sm text-slate-900 dark:text-[#e8e0d5] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>

          {/* أدوات التحكم الثانوية: البحث العميق، مطابقة الوسوم، الترتيب، والوضع الليلي */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSearchDeep((d) => !d)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                searchDeep
                  ? 'bg-[#C9956C]/15 text-[#A07040] dark:text-[#C9956C] border-[#C9956C]/40'
                  : 'bg-slate-50 dark:bg-[#0b162c] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
              }`}
            >
              {searchDeep ? '● بحث شامل بالتفرعات' : '○ المجلد الحالي فقط'}
            </button>

            <button
              onClick={() => setTagMatchMode((m) => (m === 'all' ? 'any' : 'all'))}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-50 dark:bg-[#0b162c] text-slate-700 dark:text-[#e8e0d5] border border-slate-200 dark:border-white/10 hover:border-[#C9956C] whitespace-nowrap shrink-0 cursor-pointer"
              title="تبديل نمط مطابقة الوسوم المختارة"
            >
              مطابقة الوسوم: {tagMatchMode === 'all' ? 'الكل (AND)' : 'أي وسم (OR)'}
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-50 dark:bg-[#0b162c] text-slate-700 dark:text-[#e8e0d5] border border-slate-200 dark:border-white/10 focus:outline-none"
            >
              <option value="date">الترتيب: الأحدث</option>
              <option value="name">الترتيب: أبجدياً</option>
              <option value="rating">الترتيب: الأعلى تقييماً</option>
              <option value="size">الترتيب: الحجم</option>
            </select>

            <button
              onClick={() => setDarkMode((d) => !d)}
              title={darkMode ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
              aria-label="تبديل المظهر"
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-[#0b162c] border border-slate-200 dark:border-white/10 text-[#A07040] dark:text-[#C9956C] hover:border-[#C9956C] cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </section>

        {/* =========================================================
            التبويب 1: المكتبة والملفات والمجلدات (Library View)
           ========================================================= */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            {/* شريط التصفية الرمزي السريع للقوائم المستقلة (Icon-Only Taxonomy Bar) */}
            <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800 dark:text-[#f3ece2]">
                    التصفية الرمزية السريعة:
                  </span>
                  <span className="text-[#A07040] dark:text-[#C9956C] font-medium">
                    {hoveredTagLabel ||
                      (selectedTags.length > 0
                        ? `محدد (${selectedTags.length}): ${selectedTags.join(' · ')}`
                        : 'مرّر المؤشر على أي رمز لمعرفة اسمه أو انقر للتصفية الفورية')}
                  </span>
                </div>

                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    title="إلغاء جميع الفلاتر"
                    aria-label="إلغاء جميع الفلاتر"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15 text-red-500 hover:bg-red-500/25 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {categories.map((cat) => {
                  const catTags = tags.filter((t) => t.category_id === cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-1.5 pl-3 border-l last:border-l-0 border-slate-200 dark:border-white/10"
                    >
                      <span
                        title={cat.name}
                        className="text-xs text-slate-400 dark:text-slate-500 ml-1"
                      >
                        {cat.icon}
                      </span>
                      {catTags.map((tag) => {
                        const active = selectedTags.includes(tag.name);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            title={`${tag.name} (${cat.name})`}
                            aria-label={tag.name}
                            onMouseEnter={() => setHoveredTagLabel(`${cat.name}: ${tag.name}`)}
                            onMouseLeave={() => setHoveredTagLabel('')}
                            onClick={() => handleToggleTag(tag.name)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-all cursor-pointer ${
                              active
                                ? 'bg-[#C9956C] text-[#0b162c] border-[#C9956C] scale-105 shadow-sm'
                                : 'bg-slate-50 dark:bg-[#0b162c] border-slate-200 dark:border-white/10 hover:border-[#C9956C]/60'
                            }`}
                          >
                            {tag.icon}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* مسار التنقل بين المجلدات (RTL Flex Breadcrumbs) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 text-xs md:text-sm">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <button
                        onClick={() => setCurrentFolderId(crumb.id)}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          isLast
                            ? 'font-bold text-[#A07040] dark:text-[#C9956C] bg-[#C9956C]/15'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5'
                        }`}
                      >
                        {crumb.name}
                      </button>
                      {!isLast && (
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <span className="font-mono-num text-xs text-slate-500 dark:text-[#9aa5b8]">
                {items.length} عنصر معروض
              </span>
            </div>

            {/* شبكة البطاقات (Grid Only - حسب اتفاقيات منصة نخاع) */}
            {loading ? (
              <div className="py-16 text-center text-sm text-slate-500 dark:text-[#9aa5b8]">
                جارٍ جلب الملفات والمجلدات من الخادم...
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white/90 dark:bg-[#111e3e]/80 border border-slate-200 dark:border-white/10 rounded-xl p-12 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  لا توجد عناصر مطابقة للبحث أو الوسوم المحددة في هذا المجلد.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTags([]);
                    setCurrentFolderId('root');
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#C9956C] text-[#0b162c] cursor-pointer"
                >
                  إعادة ضبط البحث والعودة للرئيسية
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((item) => {
                  const isFolder = item.item_type === 'folder';
                  const isQuiz = item.item_type === 'quiz';
                  const isNote = item.file_type === 'text_note';
                  const isAudio = item.file_type === 'audio';
                  const allItemTags = Array.from(
                    new Set([...(item.tags || []), ...(item.inherited_tags || [])])
                  );

                  return (
                    <article
                      key={`${item.item_type}_${item.id}`}
                      onClick={() => {
                        if (isFolder) {
                          setCurrentFolderId(item.id);
                        } else {
                          setMediaPlayerOpen(false);
                          setDetailItem(item);
                        }
                      }}
                      className="group bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 hover:border-[#C9956C] rounded-xl p-5 flex flex-col justify-between gap-4 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="space-y-3">
                        {/* سطر النوع العلوي الهادئ بدون كبسولات + زر التقييم الفوري */}
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#9aa5b8]">
                          <div className="flex items-center gap-2">
                            {isFolder ? (
                              <Folder className="w-4 h-4 text-[#C9956C] shrink-0" />
                            ) : isQuiz ? (
                              <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : isAudio ? (
                              <Volume2 className="w-4 h-4 text-sky-400 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-[#C9956C] shrink-0" />
                            )}
                            <span>
                              {isFolder
                                ? 'مجلد أكاديمي'
                                : isQuiz
                                ? 'اختبار تفاعلي'
                                : isNote
                                ? 'ملاحظة سريرية نصية'
                                : isAudio
                                ? 'تسجيل صوتي سريري'
                                : 'مرجع PDF'}
                            </span>
                            {item.folder_path && item.folder_path.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate max-w-[140px]">
                                  {item.folder_path.join(' / ')}
                                </span>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) =>
                              handleRateItem(item, item.user_rating === 5 ? 4 : 5, e)
                            }
                            title="تقييم العنصر"
                            className="inline-flex items-center gap-1 text-xs font-mono-num text-amber-500 hover:scale-110 transition-transform cursor-pointer"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                (item.rating?.avg || 0) > 0 ? 'fill-amber-400 text-amber-400' : ''
                              }`}
                            />
                            <span>{item.rating?.avg || '—'}</span>
                          </button>
                        </div>

                        {/* العنوان مع تظليل المتغيرات العربية للبحث */}
                        <h3 className="text-base font-bold text-slate-900 dark:text-[#f3ece2] group-hover:text-[#A07040] dark:group-hover:text-[#C9956C] transition-colors leading-snug">
                          {highlightArabicText(item.name || item.title || '', searchQuery)}
                        </h3>

                        {/* الوصف أو معاينة الملاحظة النصية */}
                        {(item.content_preview || item.description) && (
                          <p className="text-xs text-slate-600 dark:text-[#b0a898] line-clamp-2 leading-relaxed">
                            {highlightArabicText(
                              item.content_preview || item.description || '',
                              searchQuery
                            )}
                          </p>
                        )}
                      </div>

                      {/* ذيل البطاقة: بيانات وصفية نصية نظيفة بدون كبسولات (Zero-Pill Metadata) */}
                      <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 space-y-1.5 text-[11px] text-slate-500 dark:text-[#9aa5b8]">
                        {allItemTags.length > 0 && (
                          <div className="truncate text-[#A07040] dark:text-[#C9956C]">
                            {allItemTags.join(' · ')}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-mono-num">
                            {isFolder ? (
                              <>
                                <span>{item.files_count || 0} ملف</span>
                                <span>·</span>
                                <span>{item.subfolders_count || 0} مجلد فرعي</span>
                              </>
                            ) : isQuiz ? (
                              <>
                                <span>{item.questions_count || 0} سؤال</span>
                                <span>·</span>
                                <span>تصحيح فوري</span>
                              </>
                            ) : (
                              <>
                                <span>{item.file_size_formatted}</span>
                                <span>·</span>
                                <span>{item.downloads || 0} تنزيل</span>
                              </>
                            )}
                          </div>
                          <span>{formatUtcToLocal(item.created_at || item.upload_date)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            التبويب 2: استوديو الاختبارات ومحطات OSCE والشرائح
           ========================================================= */}
        {activeTab === 'quizzes' && (
          <QuizStudioView
            quizzes={quizzes}
            tags={tags}
            selectedQuizId={selectedQuizId}
            onSelectQuiz={(id) => setSelectedQuizId(id)}
            onRefresh={() => {
              fetchMetadata();
              fetchContents();
            }}
          />
        )}

        {/* =========================================================
            التبويب 3: إدارة الوسوم والجامعات العراقية
           ========================================================= */}
        {activeTab === 'taxonomy' && (
          <TaxonomyManagerView
            categories={categories}
            tags={tags}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
            onSelectGroupTags={handleSelectGroupTags}
            onClearGroupTags={handleClearGroupTags}
            onRefresh={fetchMetadata}
          />
        )}

        {/* =========================================================
            التبويب 4: صندوق وارد تيليجرام و Google Classroom
           ========================================================= */}
        {activeTab === 'inbox' && (
          <IntegrationsInboxView
            folders={allFolders}
            onRefreshLibrary={() => {
              fetchContents();
              fetchMetadata();
            }}
          />
        )}

        {/* =========================================================
            التبويب 5: لوحة الإحصائيات وسلة المحذوفات
           ========================================================= */}
        {activeTab === 'admin' && (
          <AdminDashboardView
            onRefreshLibrary={() => {
              fetchContents();
              fetchMetadata();
            }}
          />
        )}
      </main>

      {/* =========================================================
          نافذة تفاصيل الملف أو الاختبار الموحدة (#modal-file-details)
         ========================================================= */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="bg-white dark:bg-[#111e3e] border border-slate-200 dark:border-white/15 rounded-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#A07040] dark:text-[#C9956C]">
                  <span>
                    {detailItem.item_type === 'quiz'
                      ? 'تفاصيل الاختبار التفاعلي'
                      : detailItem.file_type === 'text_note'
                      ? 'ملاحظة سريرية منسقة'
                      : detailItem.file_type === 'audio'
                      ? 'ملف صوتي سريري'
                      : 'تفاصيل المرجع الأكاديمي'}
                  </span>
                  <span>·</span>
                  <span>{formatUtcToLocal(detailItem.created_at || detailItem.upload_date)}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {detailItem.name || detailItem.title}
                </h2>
              </div>

              <button
                onClick={() => setDetailItem(null)}
                className="px-3 py-1 rounded-lg text-xs bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            {/* الوصف */}
            {detailItem.description && (
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {detailItem.description}
              </p>
            )}

            {/* عرض محتوى الملاحظة النصية المنسقة بـ HTML */}
            {detailItem.file_type === 'text_note' && detailItem.content && (
              <div
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b162c] border border-slate-200 dark:border-white/10 text-sm leading-relaxed space-y-2"
                dangerouslySetInnerHTML={{ __html: detailItem.content }}
              />
            )}

            {/* مشغل الصوتيات التفاعلي عند الطلب (loadMediaPlayer pattern) */}
            {detailItem.file_type === 'audio' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b162c] border border-slate-200 dark:border-white/10 space-y-3">
                {!mediaPlayerOpen ? (
                  <button
                    onClick={() => setMediaPlayerOpen(true)}
                    className="w-full py-3 rounded-lg bg-[#C9956C]/20 border border-[#C9956C]/50 text-[#A07040] dark:text-[#C9956C] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>▶ تشغيل التسجيل الصوتي السريري مباشرة</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#C9956C]">
                      <span>مشغل الصوتيات السريري — S1 / S2 / Murmur</span>
                      <span className="font-mono-num">02:45</span>
                    </div>
                    <audio controls className="w-full h-9">
                      <source src="" type="audio/mpeg" />
                    </audio>
                  </div>
                )}
              </div>
            )}

            {/* الوسوم المباشرة والموروثة من المجلدات الأب */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  الوسوم المباشرة:{' '}
                </span>
                <span className="text-[#A07040] dark:text-[#C9956C]">
                  {(detailItem.tags || []).length > 0
                    ? detailItem.tags.join(' · ')
                    : 'بدون وسوم مباشرة'}
                </span>
              </div>
              {(detailItem.inherited_tags || []).length > 0 && (
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    الوسوم الموروثة من المجلد الأب:{' '}
                  </span>
                  <span className="text-slate-500 dark:text-[#9aa5b8]">
                    {detailItem.inherited_tags.join(' · ')}
                  </span>
                </div>
              )}
            </div>

            {/* أزرار الإجراءات داخل نافذة التفاصيل */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRateItem(detailItem, star)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                    title={`تقييم ${star} نجوم`}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        (detailItem.user_rating || detailItem.rating?.avg || 0) >= star
                          ? 'fill-amber-400'
                          : ''
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {detailItem.item_type === 'quiz' ? (
                  <button
                    onClick={() => {
                      const qid = detailItem.id;
                      setDetailItem(null);
                      setSelectedQuizId(qid);
                      setActiveTab('quizzes');
                    }}
                    className="px-4 py-2 rounded-lg bg-[#C9956C] text-[#0b162c] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح الاختبار والأسئلة</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleDownloadFile(detailItem)}
                      className="px-4 py-2 rounded-lg bg-[#C9956C] text-[#0b162c] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تنزيل ({detailItem.downloads || 0})</span>
                    </button>
                    <button
                      onClick={() => handleDeleteItem(detailItem)}
                      className="px-3 py-2 rounded-lg bg-red-500/15 text-red-500 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>نقل للمحذوفات</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          نافذة إضافة محتوى جديد (ملف / ملاحظة نصية مع شريط تنسيق / مجلد)
         ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111e3e] border border-slate-200 dark:border-white/15 rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                إضافة محتوى جديد في المجلد الحالي
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            {/* اختيار نوع الإضافة */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-[#0b162c] rounded-lg">
              {(
                [
                  ['file', 'ملف / محاضرة'],
                  ['note', 'ملاحظة نصية منسقة'],
                  ['folder', 'مجلد فرعي'],
                ] as const
              ).map(([modeKey, label]) => (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => setAddMode(modeKey)}
                  className={`py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    addMode === modeKey
                      ? 'bg-[#C9956C] text-[#0b162c]'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateContent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  {addMode === 'folder' ? 'اسم المجلد الجديد' : 'العنوان / اسم الملف'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    addMode === 'folder'
                      ? 'مثال: محاضرات طب الأطفال — المرحلة الخامسة'
                      : 'مثال: ملخص تشخيص التهاب السحايا البكتيري.pdf'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                />
              </div>

              {addMode === 'file' && (
                <div>
                  <label className="block text-xs font-semibold mb-1">نوع الملف</label>
                  <select
                    value={newFileType}
                    onChange={(e) => setNewFileType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                  >
                    <option value="pdf">ملف PDF أكاديمي</option>
                    <option value="audio">تسجيل صوتي سريري (MP3)</option>
                    <option value="document">مستند نصي (DOCX)</option>
                  </select>
                </div>
              )}

              {addMode === 'note' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">محتوى الملاحظة السريرية (HTML)</label>
                    {/* شريط التنسيق (upload-fmt-bar pattern) */}
                    <div id="upload-fmt-bar" className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => insertFormatTag('b')}
                        title="عريض"
                        className="p-1.5 rounded bg-slate-100 dark:bg-[#0b162c] hover:border-[#C9956C] border border-transparent cursor-pointer"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatTag('i')}
                        title="مائل"
                        className="p-1.5 rounded bg-slate-100 dark:bg-[#0b162c] hover:border-[#C9956C] border border-transparent cursor-pointer"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatTag('code')}
                        title="كود / قيمة مختبرية"
                        className="p-1.5 rounded bg-slate-100 dark:bg-[#0b162c] hover:border-[#C9956C] border border-transparent cursor-pointer"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatTag('blockquote')}
                        title="اقتباس سريري"
                        className="p-1.5 rounded bg-slate-100 dark:bg-[#0b162c] hover:border-[#C9956C] border border-transparent cursor-pointer"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={newContentHtml}
                    onChange={(e) => setNewContentHtml(e.target.value)}
                    placeholder="اكتب الملاحظة السريرية هنا..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">الوصف المختصر</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="وصف يساعد الطلبة عند البحث..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                />
              </div>

              {/* منتقي الوسوم الرمزي الموحد */}
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  اختر الوسوم الأكاديمية (بالرموز):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const active = newModalTags.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        title={t.name}
                        aria-label={t.name}
                        onClick={() =>
                          setNewModalTags((prev) =>
                            prev.includes(t.name)
                              ? prev.filter((x) => x !== t.name)
                              : [...prev, t.name]
                          )
                        }
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-base border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#C9956C] text-[#0b162c] border-[#C9956C] scale-105'
                            : 'bg-slate-50 dark:bg-[#0b162c] border-slate-200 dark:border-white/10'
                        }`}
                      >
                        {t.icon}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs bg-slate-100 dark:bg-white/10 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#C9956C] text-[#0b162c] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>حفظ وإضافة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ذيل الصفحة الهادئ */}
      <footer className="border-t border-slate-200 dark:border-white/10 py-4 px-8 text-center text-xs text-slate-500 dark:text-[#9aa5b8] flex flex-wrap items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#C9956C]" />
          <span>منصة نخاع (Nukhaa) التعليمية — المكتبة الأكاديمية وبنك الأسئلة السريري</span>
        </div>
        <span>جميع الحقوق محفوظة © {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

export default App;
