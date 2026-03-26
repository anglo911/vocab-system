'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

type WrongWordItem = {
  id: string;
  wordId: string;
  count: number;
  createdAt: string;
  lastReviewedAt?: string | null;
  word: { id: string; text: string; phonetic?: string; meaningZh: string; level: string };
};

export default function WrongBookPage() {
  const router = useRouter();
  const [items, setItems] = useState<WrongWordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/wrongbook');
      return;
    }

    void load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const data = await apiGet<{ items: WrongWordItem[] }>('/api/wrong-words?limit=100');
      setItems(data.items);
    } catch (e: any) {
      if (e?.message === 'UNAUTHORIZED') {
        router.replace('/login?next=/wrongbook');
        return;
      }
      setError('错词本加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function remove(wordId: string) {
    await apiPost('/api/wrong-words/remove', { wordId });
    setItems((prev) => prev.filter((x) => x.wordId !== wordId));
  }

  return (
    <main style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
      <h2>错词本 /wrongbook</h2>
      <p style={{ color: '#61708a' }}>错词由后端持久化，重新登录后仍可保留。</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => void load()} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
        <Link href="/learn">去学习页</Link>
      </div>

      {error ? <p style={{ color: '#b94a48' }}>{error}</p> : null}
      {!loading && items.length === 0 ? <p>暂无错词</p> : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={{ border: '1px solid #e7edf8', borderRadius: 10, padding: 10 }}>
            <b>{item.word.text}</b> {item.word.phonetic ? <span style={{ color: '#61708a' }}>{item.word.phonetic}</span> : null} · {item.word.level}
            <div>{item.word.meaningZh}</div>
            <small style={{ color: '#61708a' }}>错误次数：{item.count}</small>
            <div>
              <button onClick={() => void remove(item.wordId)}>移除</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
