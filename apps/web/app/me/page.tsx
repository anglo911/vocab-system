'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

type Overview = {
  user?: { email: string; displayName: string; emailVerifiedAt: string | null; createdAt: string };
  progressCount: number;
  masteredCount: number;
  eventCount: number;
  recentAccuracy: number;
  wrongWordsCount: number;
  dailyTrend7d: { date: string; count: number }[];
};

export default function MePage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/me');
      return;
    }
    void (async () => {
      try {
        const res = await apiGet<Overview>('/api/stats/overview');
        setData(res);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <main>加载中...</main>;
  if (!data) return <main>加载失败</main>;

  const max = Math.max(...data.dailyTrend7d.map((d) => d.count), 1);

  return (
    <main style={{ display: 'grid', gap: 12 }}>
      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h2>个人学习统计 /me</h2>
        <p>昵称：{data.user?.displayName}</p>
        <p>邮箱：{data.user?.email}</p>
        <p>邮箱验证：{data.user?.emailVerifiedAt ? '已验证' : '未验证'}</p>
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px,1fr))', gap: 8 }}>
          <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>学习记录：{data.eventCount}</div>
          <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>已学习单词：{data.progressCount}</div>
          <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>已掌握：{data.masteredCount}</div>
          <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>最近正确率：{data.recentAccuracy}%</div>
        </div>
        <p>错词本数量：{data.wrongWordsCount}</p>
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h3>近 7 天学习趋势</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
          {data.dailyTrend7d.map((d) => (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', height: `${(d.count / max) * 120}px`, minHeight: d.count ? 4 : 0, background: '#4a90e2', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: 11, color: '#61708a' }}>{d.date.slice(5)}</span>
              <span style={{ fontSize: 11 }}>{d.count}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
