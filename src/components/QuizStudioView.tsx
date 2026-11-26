import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowUp,
  ArrowDown,
  Shuffle,
  Microscope,
  Stethoscope,
  HelpCircle,
  Award,
  Trash2,
} from 'lucide-react';
import { QuizItem, QuestionItem, QuestionType, TagItem } from '../types/nukhaa';

interface QuizStudioViewProps {
  quizzes: QuizItem[];
  tags: TagItem[];
  selectedQuizId: string | null;
  onSelectQuiz: (id: string) => void;
  onRefresh: () => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'اختيار من متعدد (MCQ)',
  multi_select: 'اختيارات متعددة (Multi-Select)',
  true_false: 'صح أو خطأ',
  written: 'سؤال سريري كتابي',
  matching: 'مطابقة سريرية',
  osce_station: 'محطة فحص سريري (OSCE)',
  slide: 'شريحة تشخيصية (Slide)',
  content_block: 'فقرة توضيحية',
};

export const QuizStudioView: React.FC<QuizStudioViewProps> = ({
  quizzes,
  tags,
  selectedQuizId,
  onSelectQuiz,
  onRefresh,
}) => {
  const activeQuizId = selectedQuizId || quizzes[0]?.id || null;
  const [quizDetail, setQuizDetail] = useState<(QuizItem & { questions: QuestionItem[] }) | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  // حالات الإجابة التفاعلية للطالب
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [writtenInput, setWrittenInput] = useState('');
  const [slideSubInputs, setSlideSubInputs] = useState<Record<number, string>>({});
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [revealed, setRevealed] = useState(false);

  // مؤقت محطة OSCE
  const [timerSeconds, setTimerSeconds] = useState(360);
  const [timerRunning, setTimerRunning] = useState(false);

  // نافذة إضافة سؤال جديد داخل الاختبار الحالي
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQType, setNewQType] = useState<QuestionType>('multiple_choice');
  const [newQText, setNewQText] = useState('');
  const [newQPoints, setNewQPoints] = useState(2);
  const [newQExplanation, setNewQExplanation] = useState('');
  const [newQOptions, setNewQOptions] = useState<string[]>([
    'الخيار السريري الأول (الإجابة الصحيحة)',
    'الخيار السريري الثاني',
    'الخيار السريري الثالث',
    'الخيار السريري الرابع',
  ]);
  const [newQCorrectIdx, setNewQCorrectIdx] = useState(0);
  const [newQAcceptedAnswer, setNewQAcceptedAnswer] = useState('');
  const [newOsceScenario, setNewOsceScenario] = useState('');
  const [newOsceInstructions, setNewOsceInstructions] = useState('');
  const [newOsceDuration, setNewOsceDuration] = useState(6);

  // نافذة إنشاء اختبار جديد
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDesc, setNewQuizDesc] = useState('');
  const [newQuizType, setNewQuizType] = useState<QuestionType>('multiple_choice');
  const [newQuizTags, setNewQuizTags] = useState<string[]>([]);

  const fetchQuizDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quizzes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setQuizDetail(data);
        setActiveQuestionIdx(0);
        resetInteractionState(data.questions?.[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetInteractionState = (q?: QuestionItem) => {
    setSelectedOptions([]);
    setWrittenInput('');
    setSlideSubInputs({});
    setCheckedItems({});
    setRevealed(false);
    setTimerRunning(false);
    const mins = q?.station?.duration_minutes || 6;
    setTimerSeconds(mins * 60);
  };

  useEffect(() => {
    if (activeQuizId) {
      fetchQuizDetail(activeQuizId);
    }
  }, [activeQuizId]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const questions = quizDetail?.questions || [];
  const currentQuestion = questions[activeQuestionIdx] || null;

  const handleSelectQuestion = (idx: number) => {
    setActiveQuestionIdx(idx);
    resetInteractionState(questions[idx]);
  };

  const handleToggleOption = (idx: number) => {
    if (!currentQuestion) return;
    if (currentQuestion.type === 'multiple_choice') {
      setSelectedOptions([idx]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    }
  };

  const handleReorderQuestion = async (index: number, direction: -1 | 1) => {
    if (!quizDetail) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    setQuizDetail({ ...quizDetail, questions: reordered });
    setActiveQuestionIdx(targetIdx);

    await fetch(`/api/quizzes/${quizDetail.id}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_ids: reordered.map((q) => q.id) }),
    });
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!quizDetail) return;
    await fetch(`/api/questions/${qId}`, { method: 'DELETE' });
    await fetchQuizDetail(quizDetail.id);
    onRefresh();
  };

  const handleShuffleSession = async () => {
    if (!quizDetail) return;
    const res = await fetch('/api/quizzes/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_id: quizDetail.id, shuffle: true, limit: 30 }),
    });
    if (res.ok) {
      const data = await res.json();
      setQuizDetail({ ...quizDetail, questions: data.questions || [] });
      setActiveQuestionIdx(0);
      resetInteractionState(data.questions?.[0]);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizDetail || !newQText.trim()) return;

    const payload: Record<string, any> = {
      quiz_id: quizDetail.id,
      type: newQType,
      text: newQText.trim(),
      points: Number(newQPoints) || 2,
      explanation: { text: newQExplanation.trim() || 'تمت مراجعة الإجابة وفق الدليل السريري القياسي.' },
    };

    if (newQType === 'multiple_choice' || newQType === 'multi_select') {
      payload.options = newQOptions
        .filter((o) => o.trim())
        .map((o) => ({ text: o.trim(), explanation: { text: '' } }));
      payload.correct_indices = [newQCorrectIdx];
    } else if (newQType === 'written' || newQType === 'slide') {
      payload.accepted_answers = newQAcceptedAnswer
        .split('،')
        .flatMap((s) => s.split(','))
        .map((s) => s.trim())
        .filter(Boolean);
      if (newQType === 'slide') {
        payload.slide_notes = newOsceScenario || 'مقطع تشخيصي سريري للمراجعة.';
        payload.slide_question = newQText.trim();
      }
    } else if (newQType === 'osce_station') {
      payload.station = {
        scenario: newOsceScenario.trim() || 'مريض يراجع ردهة الطوارئ بأعراض حادة تتطلب تقييماً سريرياً منظماً.',
        instructions: newOsceInstructions.trim() || 'أجرِ الفحص السريري القياسي واشرح خطواتك للممتحن.',
        duration_minutes: Number(newOsceDuration) || 6,
        checklist: newQOptions
          .filter((o) => o.trim())
          .map((o, idx) => ({
            text: o.trim(),
            points: 2,
            critical: idx === 0,
          })),
      };
    }

    const res = await fetch('/api/questions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowAddQuestion(false);
      setNewQText('');
      setNewQExplanation('');
      await fetchQuizDetail(quizDetail.id);
      onRefresh();
    }
  };

  const handleCreateNewQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) return;
    const res = await fetch('/api/quizzes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newQuizTitle.trim(),
        description: newQuizDesc.trim(),
        quiz_type: newQuizType,
        tags: newQuizTags,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setShowCreateQuiz(false);
      setNewQuizTitle('');
      setNewQuizDesc('');
      setNewQuizTags([]);
      onRefresh();
      if (data.quiz?.id) {
        onSelectQuiz(data.quiz.id);
      }
    }
  };

  // حساب نقاط OSCE الحالية
  const osceChecklist = currentQuestion?.station?.checklist || [];
  const osceTotalPossible = osceChecklist.reduce((acc, item) => acc + item.points, 0);
  const osceEarnedPoints = osceChecklist.reduce(
    (acc, item, idx) => acc + (checkedItems[idx] ? item.points : 0),
    0
  );
  const osceCriticalMissed = osceChecklist.some((item, idx) => item.critical && !checkedItems[idx]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* شريط اختيار الاختبار وأدوات الجلسة */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          {quizzes.map((q) => {
            const isActive = q.id === activeQuizId;
            return (
              <button
                key={q.id}
                onClick={() => onSelectQuiz(q.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#C9956C] text-[#0b162c] font-semibold shadow-sm'
                    : 'bg-white/80 dark:bg-[#132347] text-slate-700 dark:text-[#e8e0d5] border border-slate-200 dark:border-white/10 hover:border-[#C9956C]/50'
                }`}
              >
                {q.title} ({q.questions_count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffleSession}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-white/80 dark:bg-[#132347] text-slate-700 dark:text-[#e8e0d5] border border-slate-200 dark:border-white/10 hover:border-[#C9956C] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#C9956C]" />
            <span>خلط ترتيب الأسئلة</span>
          </button>
          <button
            onClick={() => {
              if (quizDetail) {
                setNewQType(
                  quizDetail.quiz_type === 'custom' ? 'multiple_choice' : quizDetail.quiz_type
                );
              }
              setShowAddQuestion(true);
            }}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#C9956C]/15 text-[#A07040] dark:text-[#C9956C] border border-[#C9956C]/40 hover:bg-[#C9956C]/25 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة سؤال داخل الاختبار</span>
          </button>
          <button
            onClick={() => setShowCreateQuiz(true)}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#C9956C] text-[#0b162c] hover:bg-[#d6a47c] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>اختبار جديد</span>
          </button>
        </div>
      </div>

      {/* تخطيط الـ Two-Zone Sandbox: المسرح التفاعلي (يسار/رئيسي 65%) + لوحة التحكم والأسئلة (يمين 35%) */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
          جارٍ تحميل بيانات الاختبار والأسئلة المرتبطة...
        </div>
      ) : !quizDetail ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
          اختر اختباراً من القائمة أعلاه للبدء.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* المنطقة 1: المسرح التفاعلي للسؤال أو محطة OSCE أو الشريحة السريرية (8 أعمدة) */}
          <div className="lg:col-span-8 bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-6">
            {!currentQuestion ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-base text-slate-600 dark:text-slate-300">
                  لا توجد أسئلة مضافة في هذا الاختبار بعد.
                </p>
                <button
                  onClick={() => setShowAddQuestion(true)}
                  className="px-4 py-2 rounded-lg bg-[#C9956C] text-[#0b162c] font-semibold text-sm cursor-pointer"
                >
                  إضافة السؤال الأول
                </button>
              </div>
            ) : (
              <>
                {/* رأس السؤال والمعلومات الوصفية بدون كبسولات (Zero-Pill Metadata) */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#9aa5b8]">
                    <span className="font-semibold text-[#A07040] dark:text-[#C9956C]">
                      السؤال {activeQuestionIdx + 1} من {questions.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{QUESTION_TYPE_LABELS[currentQuestion.type]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{currentQuestion.points} نقاط</span>
                    {currentQuestion.tags?.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{currentQuestion.tags.slice(0, 3).join(' / ')}</span>
                      </>
                    )}
                  </div>

                  {/* مؤقت محطة OSCE عند اختيار محطة */}
                  {currentQuestion.type === 'osce_station' && (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#0b162c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                      <span
                        className={`font-mono-num text-sm font-bold ${
                          timerSeconds < 60
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-800 dark:text-[#e8e0d5]'
                        }`}
                      >
                        {formatTimer(timerSeconds)}
                      </span>
                      <button
                        onClick={() => setTimerRunning((r) => !r)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-[#C9956C] cursor-pointer"
                        title={timerRunning ? 'إيقاف مؤقت' : 'بدء مؤقت المحطة'}
                      >
                        {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setTimerRunning(false);
                          setTimerSeconds((currentQuestion.station?.duration_minutes || 6) * 60);
                        }}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 cursor-pointer"
                        title="إعادة ضبط المؤقت"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* نص السؤال الرئيسي */}
                <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-[#f3ece2] leading-relaxed">
                  {currentQuestion.text}
                </h2>

                {/* 1. عرض خاص لمحطات OSCE السريرية */}
                {currentQuestion.type === 'osce_station' && currentQuestion.station && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-[#0b162c]/90 p-4 rounded-lg border border-slate-200 dark:border-white/10">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#A07040] dark:text-[#C9956C]">
                          <Stethoscope className="w-4 h-4" />
                          <span>السيناريو السريري للمريض</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {currentQuestion.station.scenario}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400">
                          <HelpCircle className="w-4 h-4" />
                          <span>تعليمات الممتحَن ({currentQuestion.station.duration_minutes} دقائق)</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {currentQuestion.station.instructions}
                        </p>
                      </div>
                    </div>

                    {/* قائمة التقييم الموزونة (Checklist) */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">
                          قائمة التقييم القياسية للمحطة (انقر لتسجيل إتمام الخطوة):
                        </span>
                        <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                          الدرجة المحرزة: {osceEarnedPoints} / {osceTotalPossible}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200 dark:divide-white/10 border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden">
                        {osceChecklist.map((item, idx) => {
                          const done = Boolean(checkedItems[idx]);
                          return (
                            <label
                              key={idx}
                              className={`flex items-start justify-between gap-4 p-3.5 cursor-pointer transition-colors ${
                                done
                                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                                  : 'bg-white dark:bg-[#111e3e] hover:bg-slate-50 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() =>
                                    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))
                                  }
                                  className="mt-1 w-4 h-4 accent-[#C9956C]"
                                />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-slate-800 dark:text-[#e8e0d5]">
                                    {item.text}
                                  </p>
                                  {item.critical && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      <span>خطوة سريرية حرجة (Critical Step)</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-mono-num text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                                {item.points} نقاط
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {/* ملخص حالة النجاح في المحطة مع نص صريح وأيقونة */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-100 dark:bg-[#0b162c] border border-slate-200 dark:border-white/10 text-xs">
                        <div className="flex items-center gap-2">
                          {osceCriticalMissed ? (
                            <>
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                              <span className="font-semibold text-amber-700 dark:text-amber-300">
                                حالة التقييم: ▲ يتطلب إتمام جميع الخطوات السريرية الحرجة
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                حالة التقييم: ● جميع الخطوات الحرجة مكتملة بنجاح
                              </span>
                            </>
                          )}
                        </div>
                        <span className="font-mono-num font-bold">
                          النسبة: {osceTotalPossible ? Math.round((osceEarnedPoints / osceTotalPossible) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. عرض خاص للشرائح السريرية والنسيجية (Slides) */}
                {currentQuestion.type === 'slide' && (
                  <div className="space-y-5">
                    <div className="bg-[#0b162c] border border-[#C9956C]/30 rounded-xl p-5 text-[#e8e0d5] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#C9956C]">
                          <Microscope className="w-4 h-4" />
                          <span>معاينة الشريحة المجهرية والسريرية</span>
                        </div>
                        <span className="text-xs text-slate-400">H&amp;E 400x · Histopathology Stage</span>
                      </div>

                      {/* رسم علمي تفاعلي يوضح المقطع النسيجي للعدلات داخل الطبقة العضلية */}
                      <div className="w-full h-48 rounded-lg bg-gradient-to-br from-[#1b1936] via-[#2c1638] to-[#1a1026] border border-white/10 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                        <svg viewBox="0 0 600 180" className="w-full h-full max-h-36">
                          <rect x="10" y="15" width="580" height="150" rx="12" fill="rgba(236,72,153,0.08)" stroke="rgba(201,149,108,0.35)" strokeDasharray="4 4" />
                          {/* ألياف الطبقة العضلية المخصوصة */}
                          <path d="M 30 55 Q 180 40, 320 60 T 570 50" stroke="#f472b6" strokeWidth="6" fill="none" opacity="0.45" />
                          <path d="M 30 95 Q 200 110, 350 85 T 570 95" stroke="#f472b6" strokeWidth="6" fill="none" opacity="0.45" />
                          <path d="M 30 135 Q 160 120, 340 140 T 570 130" stroke="#f472b6" strokeWidth="6" fill="none" opacity="0.45" />
                          {/* ارتشاح العدلات المفصصة النوى (Polymorphonuclear Neutrophils) */}
                          {[
                            [120, 65],
                            [195, 88],
                            [260, 62],
                            [330, 105],
                            [410, 75],
                            [475, 112],
                          ].map(([cx, cy], i) => (
                            <g key={i}>
                              <circle cx={cx} cy={cy} r="13" fill="#fbcfe8" stroke="#db2777" strokeWidth="1.5" />
                              <circle cx={cx - 4} cy={cy - 2} r="3.5" fill="#581c87" />
                              <circle cx={cx + 4} cy={cy - 1} r="3.5" fill="#581c87" />
                              <circle cx={cx} cy={cy + 4} r="3.5" fill="#581c87" />
                            </g>
                          ))}
                          <text x="560" y="38" textAnchor="start" fill="#f9a8d4" fontSize="12" fontFamily="Vazirmatn">
                            Muscularis Propria — ارتشاح العدلات (PMNs)
                          </text>
                        </svg>
                      </div>

                      {currentQuestion.slide_notes && (
                        <p className="text-sm text-slate-200 leading-relaxed">
                          {currentQuestion.slide_notes}
                        </p>
                      )}
                    </div>

                    {/* السؤال الرئيسي للشريحة */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-800 dark:text-[#e8e0d5]">
                        {currentQuestion.slide_question || 'اكتب التشخيص أو الخلية المميزة في الشريحة:'}
                      </label>
                      <input
                        type="text"
                        value={writtenInput}
                        onChange={(e) => setWrittenInput(e.target.value)}
                        placeholder="مثال: العدلات أو Neutrophils..."
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-sm focus:outline-none focus:border-[#C9956C]"
                      />
                    </div>

                    {/* الأسئلة الفرعية للشريحة */}
                    {currentQuestion.slides?.map((sl, sIdx) => (
                      <div key={sIdx} className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
                        {sl.questions.map((subQ, qIdx) => {
                          const userAns = (slideSubInputs[qIdx] || '').trim().toLowerCase();
                          const isSubCorrect =
                            revealed &&
                            subQ.accepted_answers.some((acc) =>
                              userAns.includes(acc.toLowerCase()) || acc.toLowerCase().includes(userAns)
                            ) &&
                            userAns.length > 0;
                          return (
                            <div key={qIdx} className="space-y-1.5">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                فرع {qIdx + 1}: {subQ.text}
                              </label>
                              <input
                                type="text"
                                value={slideSubInputs[qIdx] || ''}
                                onChange={(e) =>
                                  setSlideSubInputs((prev) => ({ ...prev, [qIdx]: e.target.value }))
                                }
                                placeholder="أدخل إجابتك السريرية..."
                                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-sm focus:outline-none focus:border-[#C9956C]"
                              />
                              {revealed && (
                                <p
                                  className={`text-xs font-medium ${
                                    isSubCorrect
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {isSubCorrect ? '● إجابة مطابقة' : '▲ الإجابات النموذجية المقبولة:'}{' '}
                                  {subQ.accepted_answers.join(' ، ')} — {subQ.notes}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. عرض اختيارات (MCQ & Multi-Select) */}
                {(currentQuestion.type === 'multiple_choice' ||
                  currentQuestion.type === 'multi_select') &&
                  currentQuestion.options && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((opt, idx) => {
                        const isSelected = selectedOptions.includes(idx);
                        const isCorrect = (currentQuestion.correct_indices || []).includes(idx);
                        let stateStyle =
                          'bg-slate-50 dark:bg-[#0b162c]/80 border-slate-200 dark:border-white/10 hover:border-[#C9956C]/60';
                        if (revealed) {
                          if (isCorrect) {
                            stateStyle =
                              'bg-emerald-500/15 border-emerald-500/60 text-emerald-950 dark:text-emerald-200';
                          } else if (isSelected && !isCorrect) {
                            stateStyle =
                              'bg-red-500/15 border-red-500/60 text-red-950 dark:text-red-200';
                          }
                        } else if (isSelected) {
                          stateStyle =
                            'bg-[#C9956C]/20 border-[#C9956C] text-slate-900 dark:text-white';
                        }

                        return (
                          <div
                            key={idx}
                            onClick={() => handleToggleOption(idx)}
                            className={`p-3.5 rounded-lg border transition-colors cursor-pointer ${stateStyle}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <span className="font-mono-num text-xs font-bold text-[#A07040] dark:text-[#C9956C] mt-0.5">
                                  {idx + 1}.
                                </span>
                                <span className="text-sm font-medium leading-relaxed">
                                  {opt.text}
                                </span>
                              </div>
                              {revealed && isCorrect && (
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  ✓ صحيح
                                </span>
                              )}
                            </div>
                            {revealed && opt.explanation?.text && (
                              <p className="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300">
                                {opt.explanation.text}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                {/* 4. عرض المطابقة السريرية (Matching) */}
                {currentQuestion.type === 'matching' && currentQuestion.pairs && (
                  <div className="space-y-3">
                    {currentQuestion.pairs.map((pair, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-[#0b162c]/80 border border-slate-200 dark:border-white/10"
                      >
                        <div className="text-sm font-medium text-slate-800 dark:text-[#e8e0d5]">
                          <span className="text-[#C9956C] font-bold ml-1.5">{idx + 1}.</span>
                          {pair.left}
                        </div>
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 md:border-r md:pr-3 border-slate-200 dark:border-white/10">
                          {revealed ? pair.right : 'انقر «تحقق من الإجابة والشرح» لإظهار المطابقة الصحيحة'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 5. عرض السؤال الكتابي (Written) */}
                {currentQuestion.type === 'written' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={writtenInput}
                      onChange={(e) => setWrittenInput(e.target.value)}
                      placeholder="اكتب الإجابة السريرية هنا..."
                      className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-sm focus:outline-none focus:border-[#C9956C]"
                    />
                    {revealed && currentQuestion.accepted_answers && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200">
                        <span className="font-bold">الإجابات المعتمدة: </span>
                        {currentQuestion.accepted_answers.join(' · ')}
                      </div>
                    )}
                  </div>
                )}

                {/* أزرار التحقق والتنقل بين الأسئلة */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    onClick={() => setRevealed((r) => !r)}
                    className="px-4 py-2 rounded-lg bg-[#C9956C] text-[#0b162c] font-semibold text-sm hover:bg-[#d5a37b] transition-colors cursor-pointer"
                  >
                    {revealed ? 'إخفاء الشرح السريري' : 'تحقق من الإجابة والشرح'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={activeQuestionIdx === 0}
                      onClick={() => handleSelectQuestion(activeQuestionIdx - 1)}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#0b162c] text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      السؤال السابق
                    </button>
                    <button
                      disabled={activeQuestionIdx >= questions.length - 1}
                      onClick={() => handleSelectQuestion(activeQuestionIdx + 1)}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#0b162c] text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      السؤال التالي
                    </button>
                  </div>
                </div>

                {/* صندوق الشرح السريري الشامل */}
                {revealed && currentQuestion.explanation?.text && (
                  <div className="p-4 rounded-lg bg-[#C9956C]/10 border border-[#C9956C]/30 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#A07040] dark:text-[#C9956C]">
                      <Award className="w-4 h-4" />
                      <span>التوضيح السريري المرجعي:</span>
                    </div>
                    <p className="text-sm text-slate-800 dark:text-[#e8e0d5] leading-relaxed">
                      {currentQuestion.explanation.text}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* المنطقة 2: لوحة التحكم وترتيب الأسئلة ووسوم الاختبار (4 أعمدة) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#f3ece2]">
                  قائمة أسئلة الاختبار وترتيبها
                </h3>
                <span className="font-mono-num text-xs text-slate-500 dark:text-[#9aa5b8]">
                  {questions.length} عنصر
                </span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isCurrent = idx === activeQuestionIdx;
                  return (
                    <div
                      key={q.id}
                      onClick={() => handleSelectQuestion(idx)}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'bg-[#C9956C]/15 border-[#C9956C] text-slate-900 dark:text-white'
                          : 'bg-slate-50 dark:bg-[#0b162c]/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#9aa5b8]">
                          <span className="font-mono-num font-bold text-[#C9956C]">#{idx + 1}</span>
                          <span>·</span>
                          <span className="truncate">{QUESTION_TYPE_LABELS[q.type]}</span>
                        </div>
                        <p className="text-xs font-medium truncate mt-0.5">{q.text}</p>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleReorderQuestion(idx, -1)}
                          disabled={idx === 0}
                          title="تحريك لأعلى"
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReorderQuestion(idx, 1)}
                          disabled={idx === questions.length - 1}
                          title="تحريك لأسفل"
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          title="حذف السؤال"
                          className="p-1 rounded hover:bg-red-500/20 text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* بطاقة وسوم الاختبار وتزامنها التلقائي مع الأسئلة */}
            <div className="bg-white/95 dark:bg-[#111e3e]/90 border border-slate-200 dark:border-white/10 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-[#f3ece2]">
                وسوم الاختبار (تنساب تلقائياً للأسئلة المرتبطة)
              </h4>
              <p className="text-xs text-slate-600 dark:text-[#9aa5b8] leading-relaxed">
                {(quizDetail.tags || []).length > 0
                  ? quizDetail.tags.join(' · ')
                  : 'لا توجد وسوم مضافة لهذا الاختبار'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة سؤال جديد داخل الاختبار */}
      {showAddQuestion && quizDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111e3e] border border-slate-200 dark:border-white/15 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                إضافة سؤال جديد في: {quizDetail.title}
              </h3>
              <button
                onClick={() => setShowAddQuestion(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">نوع السؤال</label>
                  <select
                    value={newQType}
                    onChange={(e) => setNewQType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                  >
                    <option value="multiple_choice">اختيار من متعدد (MCQ)</option>
                    <option value="multi_select">اختيارات متعددة</option>
                    <option value="written">سؤال سريري كتابي</option>
                    <option value="osce_station">محطة فحص سريري (OSCE)</option>
                    <option value="slide">شريحة تشخيصية (Slide)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">الدرجة (النقاط)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newQPoints}
                    onChange={(e) => setNewQPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">نص السؤال أو عنوان المحطة</label>
                <textarea
                  rows={3}
                  required
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="اكتب الحالة السريرية أو السؤال..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                />
              </div>

              {(newQType === 'multiple_choice' || newQType === 'multi_select') && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold">
                    الخيارات (حدد رقم الخيار الصحيح):
                  </label>
                  {newQOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOpt"
                        checked={newQCorrectIdx === idx}
                        onChange={() => setNewQCorrectIdx(idx)}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...newQOptions];
                          next[idx] = e.target.value;
                          setNewQOptions(next);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              {(newQType === 'written' || newQType === 'slide') && (
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    الإجابات المقبولة للتصحيح التلقائي (افصل بينها بفاصلة):
                  </label>
                  <input
                    type="text"
                    value={newQAcceptedAnswer}
                    onChange={(e) => setNewQAcceptedAnswer(e.target.value)}
                    placeholder="مثال: البروتامين، Protamine sulfate"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                  />
                </div>
              )}

              {newQType === 'osce_station' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">السيناريو السريري للمحطة</label>
                    <input
                      type="text"
                      value={newOsceScenario}
                      onChange={(e) => setNewOsceScenario(e.target.value)}
                      placeholder="وصف حالة المريض وعلاماته الحيوية..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">تعليمات الطالب</label>
                      <input
                        type="text"
                        value={newOsceInstructions}
                        onChange={(e) => setNewOsceInstructions(e.target.value)}
                        placeholder="قم بإجراء الفحص..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">المدة (دقائق)</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={newOsceDuration}
                        onChange={(e) => setNewOsceDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">الشرح والتوضيح السريري</label>
                <textarea
                  rows={2}
                  value={newQExplanation}
                  onChange={(e) => setNewQExplanation(e.target.value)}
                  placeholder="يظهر للطالب بعد التحقق من الإجابة..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQuestion(false)}
                  className="px-4 py-2 rounded-lg text-xs bg-slate-100 dark:bg-white/10 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#C9956C] text-[#0b162c] cursor-pointer"
                >
                  حفظ السؤال في الاختبار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إنشاء اختبار جديد */}
      {showCreateQuiz && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111e3e] border border-slate-200 dark:border-white/15 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                إنشاء اختبار أو محطة OSCE جديدة
              </h3>
              <button
                onClick={() => setShowCreateQuiz(false)}
                className="text-xs text-slate-500 cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            <form onSubmit={handleCreateNewQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">عنوان الاختبار</label>
                <input
                  type="text"
                  required
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  placeholder="مثال: اختبار الجراحة السريرية — المرحلة الخامسة"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={newQuizDesc}
                  onChange={(e) => setNewQuizDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">النوع الافتراضي للأسئلة الجديدة</label>
                <select
                  value={newQuizType}
                  onChange={(e) => setNewQuizType(e.target.value as QuestionType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0b162c] border border-slate-300 dark:border-white/15 text-xs"
                >
                  <option value="multiple_choice">اختيار من متعدد (MCQ)</option>
                  <option value="osce_station">محطات فحص سريري (OSCE)</option>
                  <option value="slide">شرائح تشخيصية (Slides)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  اختر وسوم الاختبار (بالرموز):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 14).map((t) => {
                    const active = newQuizTags.includes(t.name);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        title={t.name}
                        aria-label={t.name}
                        onClick={() =>
                          setNewQuizTags((prev) =>
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
                  onClick={() => setShowCreateQuiz(false)}
                  className="px-4 py-2 rounded-lg text-xs bg-slate-100 dark:bg-white/10 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#C9956C] text-[#0b162c] cursor-pointer"
                >
                  إنشاء الاختبار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
