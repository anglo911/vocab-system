'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

type DueItem = {
  word: { id: string; text: string; phonetic?: string; meaningZh: string; example?: string; level: string };
  progress: null | { repetitions: number; intervalDays: number; easeFactor: number };
};

type WrongWordItem = {
  id: string;
  wordId: string;
  count: number;
  word: { id: string; text: string; meaningZh: string; phonetic?: string; level: string };
};

type PlanData = {
  dailyTarget: number;
  newWordsPerDay: number;
  reviewWordsPerDay: number;
};

type PlanProgress = {
  doneToday: number;
  dailyTarget: number;
};

type DueResp = {
  items: DueItem[];
  plan: PlanData;
  progress: PlanProgress;
};

export default function LearnPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<DueItem[]>([]);
  const [wrongWords, setWrongWords] = useState<WrongWordItem[]>([]);
  const [plan, setPlan] = useState<PlanData>({ dailyTarget: 20, newWordsPerDay: 10, reviewWordsPerDay: 10 });
  const [progress, setProgress] = useState<PlanProgress>({ doneToday: 0, dailyTarget: 20 });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [error, setError] = useState('');
  const [quizMode, setQuizMode] = useState<'flash' | 'fill' | 'dictation'>('flash');
  const [answer, setAnswer] = useState('');
  const [resultTip, setResultTip] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/learn');
    }
  }, [router]);

  async function loadQueue() {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<DueResp>('/api/learn/due');
      setQueue(data.items);
      setPlan(data.plan);
      setProgress(data.progress);
    } catch (e: any) {
      if (e?.message === 'UNAUTHORIZED') {
        router.replace('/login?next=/learn');
        return;
      }
      setError('加载队列失败，请检查后端服务。');
    } finally {
      setLoading(false);
    }
  }

  async function loadWrongWords() {
    try {
      const data = await apiGet<{ items: WrongWordItem[] }>('/api/wrong-words?limit=10');
      setWrongWords(data.items);
    } catch {
      setWrongWords([]);
    }
  }

  useEffect(() => {
    void loadQueue();
    void loadWrongWords();
  }, []);

  const current = queue[0];

  function normalize(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function maskedWord(word: string) {
    if (word.length <= 2) return '_'.repeat(word.length);
    return word[0] + '_'.repeat(Math.max(word.length - 2, 1)) + word[word.length - 1];
  }

  function playWordAudio(text: string, slow = false) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = slow ? 0.75 : 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  const submitQuality = useCallback(
    async (quality: number) => {
      if (!current || submitting) return;
      setSubmitting(true);
      setError('');

      try {
        await apiPost('/api/learn/check', {
          wordId: current.word.id,
          quality
        });
        setQueue((prev) => prev.slice(1));
        setProgress((prev) => ({ ...prev, doneToday: prev.doneToday + 1 }));
        await loadWrongWords();
      } catch (e: any) {
        if (e?.message === 'UNAUTHORIZED') {
          router.replace('/login?next=/learn');
          return;
        }
        setError('提交评分失败，请稍后重试。');
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting, router]
  );

  async function submitAnswer() {
    if (!current || !answer.trim()) return;
    const ok = normalize(answer) === normalize(current.word.text);
    setResultTip(ok ? '✅ 正确' : `❌ 不对，正确答案：${current.word.text}`);
    await submitQuality(ok ? 4 : 2);
    setAnswer('');
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tag = target.tagName.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
      if (isEditable) return;

      if (e.key === '1') void submitQuality(1);
      if (e.key === '2') void submitQuality(3);
      if (e.key === '3') void submitQuality(4);
      if (e.key === '4') void submitQuality(5);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitQuality]);

  async function savePlan() {
    if (savingPlan) return;
    setSavingPlan(true);
    try {
      const data = await apiPost<{ plan: PlanData; progress: PlanProgress }>('/api/plan', plan);
      setPlan(data.plan);
      setProgress(data.progress);
      await loadQueue();
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <main style={{ display: 'grid', gap: 12 }}>
      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h2>学习 /learn</h2>
        <button onClick={() => void loadQueue()} disabled={loading || submitting}>
          {loading ? '加载中...' : '刷新队列'}
        </button>
        <p>剩余：{queue.length}</p>
        <p>今日进度：{progress.doneToday}/{progress.dailyTarget}</p>
        <p style={{ color: '#61708a', marginTop: 4 }}>快捷键：1=Again，2=Hard，3=Good，4=Easy</p>
        {error ? <p style={{ color: '#b94a48' }}>{error}</p> : null}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h3>学习计划设置</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 8 }}>
          <label>
            每日目标
            <input type="number" value={plan.dailyTarget} onChange={(e) => setPlan({ ...plan, dailyTarget: Number(e.target.value) || 1 })} />
          </label>
          <label>
            新词/天
            <input type="number" value={plan.newWordsPerDay} onChange={(e) => setPlan({ ...plan, newWordsPerDay: Number(e.target.value) || 0 })} />
          </label>
          <label>
            复习/天
            <input type="number" value={plan.reviewWordsPerDay} onChange={(e) => setPlan({ ...plan, reviewWordsPerDay: Number(e.target.value) || 0 })} />
          </label>
        </div>
        <button onClick={() => void savePlan()} disabled={savingPlan}>{savingPlan ? '保存中...' : '保存计划'}</button>
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        {!current ? (
          <p>✅ 今日完成</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => setQuizMode('flash')}>卡片模式</button>
              <button onClick={() => setQuizMode('fill')}>填空模式</button>
              <button onClick={() => setQuizMode('dictation')}>听写模式</button>
            </div>

            {quizMode === 'flash' ? (
              <>
                <h3>
                  {current.word.text} {current.word.phonetic ? <span style={{ color: '#61708a' }}>{current.word.phonetic}</span> : null}
                </h3>
                <p>释义：{current.word.meaningZh}</p>
                {current.word.example ? <p style={{ color: '#61708a' }}>例句：{current.word.example}</p> : null}
                <p style={{ color: '#61708a' }}>级别：{current.word.level}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => void submitQuality(1)} disabled={submitting}>Again</button>
                  <button onClick={() => void submitQuality(3)} disabled={submitting}>Hard</button>
                  <button onClick={() => void submitQuality(4)} disabled={submitting}>Good</button>
                  <button onClick={() => void submitQuality(5)} disabled={submitting}>Easy</button>
                </div>
              </>
            ) : null}

            {quizMode === 'fill' ? (
              <>
                <h3>填空：{maskedWord(current.word.text)}</h3>
                <p style={{ color: '#61708a' }}>提示：{current.word.meaningZh}</p>
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="输入完整英文单词" style={{ width: '100%', maxWidth: 360 }} />
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => void submitAnswer()} disabled={submitting || !answer.trim()}>提交答案</button>
                </div>
                {resultTip ? <p>{resultTip}</p> : null}
              </>
            ) : null}

            {quizMode === 'dictation' ? (
              <>
                <h3>听写模式</h3>
                <p style={{ color: '#61708a' }}>先听发音，再输入你听到的单词</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => playWordAudio(current.word.text, false)}>🔊 正常速度</button>
                  <button onClick={() => playWordAudio(current.word.text, true)}>🐢 慢速</button>
                </div>
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="输入你听到的单词" style={{ width: '100%', maxWidth: 360, marginTop: 8 }} />
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => void submitAnswer()} disabled={submitting || !answer.trim()}>提交听写</button>
                </div>
                {resultTip ? <p>{resultTip}</p> : null}
              </>
            ) : null}
          </>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h3>错词挑战（后端持久化）</h3>
        {wrongWords.length === 0 ? <p style={{ color: '#61708a' }}>暂无错词</p> : null}
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {wrongWords.map((item) => (
            <li key={item.id}>
              {item.word.text}（{item.word.meaningZh}）×{item.count}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
