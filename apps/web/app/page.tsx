'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE, apiGet, apiPost } from '../lib/api';
import { clearAuth, getLoginUser, isLoggedIn } from '../lib/auth';

type Overview = {
  user?: { email: string; displayName: string; emailVerifiedAt: string | null; createdAt: string };
  progressCount: number;
  masteredCount: number;
  eventCount: number;
  recentAccuracy: number;
  wrongWordsCount?: number;
  dailyTrend7d?: { date: string; count: number }[];
};

type CheckinStatus = {
  checkedToday: boolean;
  streakDays: number;
  totalCheckins: number;
};

export default function HomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  async function loadProtectedData() {
    if (!isLoggedIn()) {
      setOverview(null);
      setCheckin(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [overviewData, checkinData] = await Promise.all([
        apiGet<Overview>('/api/stats/overview'),
        apiGet<CheckinStatus>('/api/checkin/status')
      ]);
      setOverview(overviewData);
      setCheckin(checkinData);
    } catch {
      setOverview(null);
      setCheckin(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const user = getLoginUser();
    setUserName(user?.displayName || '');
    void loadProtectedData();
  }, []);

  async function checkinToday() {
    try {
      const data = await apiPost<CheckinStatus>('/api/checkin/today', {});
      setCheckin(data);
    } catch {
      // ignore for demo
    }
  }

  function logout() {
    clearAuth();
    setUserName('');
    setOverview(null);
    setCheckin(null);
    setLoading(false);
  }

  const loggedIn = isLoggedIn();

  return (
    <main style={{ display: 'grid', gap: 12 }}>
      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h2>系统状态</h2>
        <p>
          后端健康检查：
          <a href={`${API_BASE}/health`} target="_blank" rel="noreferrer">
            {API_BASE}/health
          </a>
        </p>

        {!loggedIn ? (
          <p>
            当前未登录，请先 <Link href="/login">登录</Link>
          </p>
        ) : (
          <>
            <p>
              当前用户：<code>{userName || '已登录'}</code>
            </p>
            <button onClick={logout}>退出登录</button>
          </>
        )}

        {loading ? (
          <p>统计加载中...</p>
        ) : overview ? (
          <ul>
            <li>学习记录：{overview.eventCount}</li>
            <li>已学习单词：{overview.progressCount}</li>
            <li>已掌握：{overview.masteredCount}</li>
            <li>最近正确率：{overview.recentAccuracy}%</li>
            <li>错词本数量：{overview.wrongWordsCount ?? 0}</li>
          </ul>
        ) : loggedIn ? (
          <p style={{ color: '#b94a48' }}>统计加载失败，请确认后端已启动。</p>
        ) : null}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h2>每日打卡</h2>
        {!loggedIn ? (
          <p style={{ color: '#61708a' }}>登录后可打卡并统计连续天数。</p>
        ) : (
          <>
            <p>连续打卡：{checkin?.streakDays ?? 0} 天</p>
            <p>累计打卡：{checkin?.totalCheckins ?? 0} 次</p>
            <button onClick={() => void checkinToday()} disabled={Boolean(checkin?.checkedToday)}>
              {checkin?.checkedToday ? '今日已打卡' : '今日打卡'}
            </button>
          </>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h2>入口导航</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/login">登录 /login</Link>
          <Link href="/learn">学习 /learn</Link>
          <Link href="/wrongbook">错词本 /wrongbook</Link>
          <Link href="/words">词库 /words</Link>
          <Link href="/me">个人页 /me</Link>
          <Link href="/admin">后台 /admin</Link>
        </div>
      </section>
    </main>
  );
}
