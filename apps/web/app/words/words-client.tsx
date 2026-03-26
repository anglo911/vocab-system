'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '../../lib/api';

type Word = {
  id: string;
  text: string;
  phonetic?: string;
  meaningZh: string;
  level: string;
  example?: string;
};

type Level = 'ALL' | 'A1' | 'A2' | 'B1';

function parseLevel(raw: string | null): Level {
  if (raw === 'A1' || raw === 'A2' || raw === 'B1') return raw;
  return 'ALL';
}

export default function WordsClientPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level>('ALL');

  useEffect(() => {
    let active = true;

    apiGet<{ items: Word[] }>('/api/words?limit=500')
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch(() => {
        if (active) setError('词库加载失败，请确认后端已启动。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const paramSearch = searchParams.get('search') ?? '';
    const paramLevel = parseLevel(searchParams.get('level'));

    setSearch((prev) => (prev === paramSearch ? prev : paramSearch));
    setLevel((prev) => (prev === paramLevel ? prev : paramLevel));
  }, [searchParams]);

  function updateQuery(nextSearch: string, nextLevel: Level) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextSearch.trim()) {
      params.set('search', nextSearch);
    } else {
      params.delete('search');
    }

    if (nextLevel === 'ALL') {
      params.delete('level');
    } else {
      params.set('level', nextLevel);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((w) => {
      const levelMatch = level === 'ALL' ? true : w.level === level;
      const searchMatch =
        q.length === 0
          ? true
          : w.text.toLowerCase().includes(q) ||
            (w.phonetic || '').toLowerCase().includes(q) ||
            w.meaningZh.toLowerCase().includes(q) ||
            (w.example || '').toLowerCase().includes(q);

      return levelMatch && searchMatch;
    });
  }, [items, level, search]);

  return (
    <main style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
      <h2>词库 /words</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="搜索单词 / 释义 / 例句"
          value={search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            updateQuery(next, level);
          }}
          style={{ minWidth: 260 }}
        />
        <select
          value={level}
          onChange={(e) => {
            const next = parseLevel(e.target.value);
            setLevel(next);
            updateQuery(search, next);
          }}
        >
          <option value="ALL">全部级别</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
        </select>
      </div>

      {loading ? <p>加载中...</p> : null}
      {error ? <p style={{ color: '#b94a48' }}>{error}</p> : null}
      {!loading && !error ? <p>共 {filtered.length} 条</p> : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.map((w) => (
          <div key={w.id} style={{ border: '1px solid #e7edf8', borderRadius: 10, padding: 10 }}>
            <b>{w.text}</b> {w.phonetic ? <span style={{ color: '#61708a' }}>{w.phonetic}</span> : null} · {w.level}
            <div>{w.meaningZh}</div>
            {w.example ? <small style={{ color: '#61708a' }}>例句：{w.example}</small> : null}
          </div>
        ))}
      </div>
    </main>
  );
}
