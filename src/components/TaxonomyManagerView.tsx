import React, { useState } from 'react';
import {
  CheckSquare,
  RotateCcw,
  Plus,
  Link2,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import { TagCategory, TagItem } from '../types/nukhaa';

interface TaxonomyManagerViewProps {
  categories: TagCategory[];
  tags: TagItem[];
  selectedTags: string[];
  onToggleTag: (tagName: string) => void;
  onSelectGroupTags: (tagNames: string[]) => void;
  onClearGroupTags: (tagNames: string[]) => void;
  onRefresh: () => void;
}

export const TaxonomyManagerView: React.FC<TaxonomyManagerViewProps> = ({
  categories,
  tags,
  selectedTags,
  onToggleTag,
  onSelectGroupTags,
  onClearGroupTags,
  onRefresh,
}) => {
  const [focusedParentTag, setFocusedParentTag] = useState<TagItem | null>(null);
  const [hoveredTag, setHoveredTag] = useState<TagItem | null>(null);

  // إضافة وسم جديد
  const [newTagName, setNewTagName] = useState('');
  const [newTagNameEn, setNewTagNameEn] = useState('');
  const [newTagIcon, setNewTagIcon] = useState('🏛️');
  const [newTagCatId, setNewTagCatId] = useState(categories[0]?.id || 'univ');
  const [newTagParentId, setNewTagParentId] = useState<string>('');

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTagName.trim(),
        name_en: newTagNameEn.trim(),
        icon: newTagIcon.trim() || '🔖',
        category_id: newTagCatId,
        parent_tag_id: newTagParentId || null,
      }),
    });
    if (res.ok) {
      setNewTagName('');
      setNewTagNameEn('');
      onRefresh();
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
    if (focusedParentTag?.id === tagId) setFocusedParentTag(null);
    onRefresh();
  };

  // فحص ما إذا كان للوسم عناصر فرعية مرتبطة به عبر placements أو parent_tag_id
  const getChildTags = (parentId: string) =>
    tags.filter(
      (t) =>
        t.parent_tag_id === parentId ||
        (t.placements || []).some((p) => p.parent_tag_id === parentId)
    );

  return (
    <div className="space-y-6">
      {/* شريط المعاينة الفورية للوسم المُشار إليه بالرموز */}
      <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C9956C]/15 border border-[#C9956C]/40 flex items-center justify-center text-xl">
            {hoveredTag?.icon || focusedParentTag?.icon || '🏛️'}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-[#f3ece2]">
              {hoveredTag
                ? `${hoveredTag.name} ${hoveredTag.name_en ? `(${hoveredTag.name_en})` : ''}`
                : focusedParentTag
                ? `التفرعات التابعة لـ: ${focusedParentTag.name}`
                : 'دليل التصنيفات والجامعات العراقية (مرّر المؤشر أو انقر على الرمز)'}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#9aa5b8]">
              {selectedTags.length > 0
                ? `الفلاتر المحددة حالياً (${selectedTags.length}): ${selectedTags.join(' · ')}`
                : 'جميع القوائم مستقلة في الجذر، ويمكن استعراض الكليات التابعة لكل جامعة عراقية مباشرة.'}
            </p>
          </div>
        </div>

        {focusedParentTag && (
          <button
            onClick={() => setFocusedParentTag(null)}
            title="العودة لعرض جميع القوائم الجذرية"
            aria-label="العودة لعرض جميع القوائم الجذرية"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#0b162c] text-slate-700 dark:text-[#e8e0d5] border border-slate-200 dark:border-white/10 cursor-pointer"
          >
            إلغاء تركيز التفرع ({focusedParentTag.name})
          </button>
        )}
      </div>

      {/* عرض القوائم المستقلة مع أزرار أيقونية بحتة حسب تفضيل مالك منصة نخاع */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {categories.map((cat) => {
          const catTags = tags.filter(
            (t) =>
              t.category_id === cat.id ||
              (t.placements || []).some((p) => p.category_id === cat.id)
          );
          const catTagNames = catTags.map((t) => t.name);

          return (
            <div
              key={cat.id}
              className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden="true">
                    {cat.icon}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#f3ece2]">
                      {cat.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#9aa5b8]">
                      {cat.description}
                    </p>
                  </div>
                </div>

                {/* أزرار تحديد الكل وإلغاء التحديد رمزية فقط مع تسميات مساعدة */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectGroupTags(catTagNames)}
                    title={`تحديد كل عناصر ${cat.name}`}
                    aria-label={`تحديد كل عناصر ${cat.name}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-[#0b162c] text-slate-700 dark:text-[#e8e0d5] hover:border-[#C9956C] border border-transparent cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4 text-[#C9956C]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onClearGroupTags(catTagNames)}
                    title={`إلغاء تحديد عناصر ${cat.name}`}
                    aria-label={`إلغاء تحديد عناصر ${cat.name}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-[#0b162c] text-slate-700 dark:text-[#e8e0d5] hover:border-[#C9956C] border border-transparent cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* أزرار الخيارات الرمزية (Icon-Only Option Buttons with Tooltip & Accessible Label) */}
              <div className="flex flex-wrap items-center gap-2">
                {catTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.name);
                  const children = getChildTags(tag.id);
                  const isFocused = focusedParentTag?.id === tag.id;

                  return (
                    <div key={tag.id} className="inline-flex items-center">
                      <button
                        type="button"
                        title={`${tag.name}${tag.name_en ? ` — ${tag.name_en}` : ''}`}
                        aria-label={tag.name}
                        onMouseEnter={() => setHoveredTag(tag)}
                        onFocus={() => setHoveredTag(tag)}
                        onClick={() => onToggleTag(tag.name)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#C9956C] text-[#0b162c] border-[#C9956C] shadow-sm scale-105'
                            : 'bg-slate-50 dark:bg-[#0b162c] text-slate-800 dark:text-[#e8e0d5] border-slate-200 dark:border-white/10 hover:border-[#C9956C]/60'
                        }`}
                      >
                        {tag.icon}
                      </button>

                      {children.length > 0 && (
                        <button
                          type="button"
                          title={`فتح التفرعات التابعة لـ ${tag.name} (${children.length})`}
                          aria-label={`فتح التفرعات التابعة لـ ${tag.name}`}
                          onClick={() =>
                            setFocusedParentTag(isFocused ? null : tag)
                          }
                          className={`w-6 h-10 -mr-1 rounded-l-lg flex items-center justify-center border border-r-0 transition-colors cursor-pointer ${
                            isFocused
                              ? 'bg-[#A07040] text-white border-[#C9956C]'
                              : 'bg-slate-100 dark:bg-[#172a54] text-[#C9956C] border-slate-200 dark:border-white/10 hover:bg-[#C9956C]/20'
                          }`}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* عرض التفرعات المرتبطة عند النقر على سهم مؤسسة أو محافظة (مثل جامعة البصرة ← كلية طب الزهراء) */}
      {focusedParentTag && (
        <div className="bg-white/95 dark:bg-[#111e3e]/95 border border-[#C9956C]/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#C9956C]" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                الأقسام والمؤسسات المرتبطة تحت: {focusedParentTag.icon} {focusedParentTag.name}
              </h4>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#9aa5b8]">
              انقر على أي رمز لتحديده في التصفية
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {getChildTags(focusedParentTag.id).map((child) => {
              const active = selectedTags.includes(child.name);
              return (
                <div
                  key={child.id}
                  className="inline-flex items-center gap-1 bg-slate-50 dark:bg-[#0b162c] p-1.5 rounded-lg border border-slate-200 dark:border-white/10"
                >
                  <button
                    type="button"
                    title={`${child.name} (${focusedParentTag.name})`}
                    aria-label={child.name}
                    onMouseEnter={() => setHoveredTag(child)}
                    onClick={() => onToggleTag(child.name)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#C9956C] text-[#0b162c]'
                        : 'bg-white dark:bg-[#132347] hover:border-[#C9956C]'
                    }`}
                  >
                    {child.icon}
                  </button>
                  <span className="text-xs font-medium px-1.5 text-slate-700 dark:text-[#e8e0d5]">
                    {child.name}
                  </span>
                  <button
                    type="button"
                    title={`حذف ${child.name}`}
                    aria-label={`حذف ${child.name}`}
                    onClick={() => handleDeleteTag(child.id)}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* نموذج إضافة مؤسسة أو قسم أو وسم جديد */}
      <form
        onSubmit={handleAddTag}
        className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-slate-900 dark:text-[#f3ece2]">
          إضافة جامعة، كلية، أو وسم أكاديمي جديد
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            required
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="الاسم بالعربية (مثال: جامعة الكوفة)"
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
          />
          <input
            type="text"
            value={newTagNameEn}
            onChange={(e) => setNewTagNameEn(e.target.value)}
            placeholder="الاسم بالإنجليزية (اختياري)"
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
          />
          <input
            type="text"
            value={newTagIcon}
            onChange={(e) => setNewTagIcon(e.target.value)}
            placeholder="الرمز (مثال: 🏛️ أو 🩺)"
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs text-center"
          />
          <select
            value={newTagCatId}
            onChange={(e) => setNewTagCatId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <select
            value={newTagParentId}
            onChange={(e) => setNewTagParentId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
          >
            <option value="">مستقل (بدون عنصر أب)</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                تابع لـ: {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#C9956C] text-[#0b162c] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>حفظ الوسم في الدليل</span>
          </button>
        </div>
      </form>
    </div>
  );
};
