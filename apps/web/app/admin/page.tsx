'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../lib/api';
import { getLoginUser, isLoggedIn } from '../../lib/auth';

type DashboardData = {
  totalUsers: number;
  totalWords: number;
  todayLearningEvents: number;
  todayCheckins: number;
  trend7d: { date: string; count: number }[];
};

type ImportResult = {
  createdCount: number;
  updatedCount: number;
  failedRows: { row: number; reason: string }[];
  jobId?: string;
};

type ImportJob = {
  id: string;
  source: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  status: string;
  errorLog: string | null;
  startedAt: string;
  completedAt: string | null;
  user: { id: string; displayName: string };
};

export default function AdminPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    text: '',
    phonetic: '',
    meaningZh: '',
    example: '',
    level: 'A1',
    tags: ''
  });
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [csvText, setCsvText] = useState('text,phonetic,meaningZh,example,level,tags\nhabit,/ˈhæbɪt/,习惯,Reading daily is a good habit.,A1,daily|study');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/admin');
      return;
    }
    const user = getLoginUser();
    if (user?.role && user.role !== 'ADMIN') {
      setForbidden(true);
      return;
    }
    void refreshDashboard();
    void refreshImportJobs();
  }, [router]);

  async function refreshDashboard() {
    setLoadingDashboard(true);
    try {
      const data = await apiGet<DashboardData>('/api/admin/dashboard');
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function refreshImportJobs() {
    setLoadingJobs(true);
    try {
      const res = await apiGet<{ items: ImportJob[]; total: number }>('/api/admin/import-jobs?limit=20');
      setImportJobs(res.items);
    } catch {
      setImportJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setMsg('');

    try {
      await apiPost('/api/admin/words', {
        text: form.text,
        phonetic: form.phonetic || undefined,
        meaningZh: form.meaningZh,
        example: form.example || undefined,
        level: form.level,
        tags: form.tags
          ? form.tags
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : []
      });
      setMsg('✅ 添加成功，去 /words 可立即搜索到');
      setForm({ text: '', phonetic: '', meaningZh: '', example: '', level: 'A1', tags: '' });
      void refreshDashboard();
    } catch {
      setMsg('❌ 添加失败，请检查输入或是否重复单词。');
    } finally {
      setSubmitting(false);
    }
  }

  async function importCsvFromText() {
    if (!csvText.trim() || importing) return;
    setImporting(true);
    try {
      const data = await apiPost<ImportResult>('/api/admin/words/import-csv', { csvText });
      setImportResult(data);
      void refreshDashboard();
      void refreshImportJobs();
    } catch {
      setImportResult({ createdCount: 0, updatedCount: 0, failedRows: [{ row: 0, reason: '导入失败' }] });
    } finally {
      setImporting(false);
    }
  }

  async function importCsvFromFile(file: File) {
    if (importing) return;
    setImporting(true);

    try {
      const text = await file.text();
      const data = await apiPost<ImportResult>('/api/admin/words/import-csv', { csvText: text });
      setImportResult(data);
      void refreshDashboard();
      void refreshImportJobs();
    } catch {
      setImportResult({ createdCount: 0, updatedCount: 0, failedRows: [{ row: 0, reason: '文件导入失败' }] });
    } finally {
      setImporting(false);
    }
  }

  const isSuccess = msg.startsWith('✅');

  if (forbidden) {
    return (
      <main style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16, maxWidth: 560 }}>
        <h2>Admin Only</h2>
        <p style={{ color: '#61708a' }}>当前账号没有管理员权限，不能访问 /admin。</p>
        <Link href="/learn">返回学习页</Link>
      </main>
    );
  }

  return (
    <main style={{ display: 'grid', gap: 12 }}>
      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16 }}>
        <h2>Admin Dashboard v1</h2>
        <button onClick={() => void refreshDashboard()} disabled={loadingDashboard}>{loadingDashboard ? '刷新中...' : '刷新看板'}</button>

        {!dashboard ? (
          <p style={{ color: '#61708a' }}>暂无看板数据</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px,1fr))', gap: 8 }}>
              <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>总用户数：{dashboard.totalUsers}</div>
              <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>总单词数：{dashboard.totalWords}</div>
              <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>今日学习事件：{dashboard.todayLearningEvents}</div>
              <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 8 }}>今日打卡人数：{dashboard.todayCheckins}</div>
            </div>
            <h4>近7日学习事件趋势</h4>
            {dashboard.trend7d.length === 0 ? (
              <p style={{ color: '#61708a' }}>暂无趋势数据</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '10px 0' }}>
                {(() => {
                  const max = Math.max(...dashboard.trend7d.map(d => d.count), 1);
                  return dashboard.trend7d.map((x) => (
                    <div key={x.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${(x.count / max) * 100}px`,
                          background: '#4a90e2',
                          borderRadius: '4px 4px 0 0',
                          minHeight: x.count > 0 ? 4 : 0
                        }}
                        title={`${x.date}: ${x.count} 次学习`}
                      />
                      <span style={{ fontSize: 11, color: '#61708a' }}>{x.date.slice(5)}</span>
                      <span style={{ fontSize: 10, color: '#4a90e2', fontWeight: 'bold' }}>{x.count}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </>
        )}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16, display: 'grid', gap: 8 }}>
        <h2>后台 /admin：新增单词</h2>
        <input placeholder="word" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <input placeholder="phonetic" value={form.phonetic} onChange={(e) => setForm({ ...form, phonetic: e.target.value })} />
        <input placeholder="中文释义" value={form.meaningZh} onChange={(e) => setForm({ ...form, meaningZh: e.target.value })} />
        <input placeholder="example" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
        <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
          <option>A1</option>
          <option>A2</option>
          <option>B1</option>
        </select>
        <input placeholder="tags,comma,separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <button onClick={() => void submit()} disabled={submitting || !form.text.trim() || !form.meaningZh.trim()}>
          {submitting ? '提交中...' : '提交'}
        </button>

        <div>{msg}</div>
        {isSuccess ? (
          <Link
            href="/words"
            style={{ display: 'inline-block', width: 'fit-content', padding: '6px 10px', border: '1px solid #cfe0ff', borderRadius: 8, background: '#f3f8ff' }}
          >
            去词库查看
          </Link>
        ) : null}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16, display: 'grid', gap: 8 }}>
        <h2>批量导入 CSV</h2>
        <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={8} style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => void importCsvFromText()} disabled={importing}>{importing ? '导入中...' : '从文本导入'}</button>
          <label style={{ border: '1px solid #dfe7f3', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
            上传 .csv
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importCsvFromFile(file);
              }}
            />
          </label>
        </div>

        {importResult ? (
          <div style={{ border: '1px solid #e7edf8', borderRadius: 8, padding: 10 }}>
            <div>createdCount: {importResult.createdCount}</div>
            <div>updatedCount: {importResult.updatedCount}</div>
            <div>failedRows: {importResult.failedRows.length}</div>
            {importResult.failedRows.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {importResult.failedRows.map((f, idx) => (
                  <li key={`${f.row}-${idx}`}>第 {f.row} 行：{f.reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>导入任务日志</h2>
          <button onClick={() => void refreshImportJobs()} disabled={loadingJobs}>{loadingJobs ? '刷新中...' : '刷新'}</button>
        </div>
        {importJobs.length === 0 ? (
          <p style={{ color: '#61708a' }}>暂无导入任务</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f5f7fa' }}>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'left' }}>时间</th>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'left' }}>用户</th>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'left' }}>来源</th>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right' }}>总行</th>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right' }}>新建</th>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right' }}>更新</th>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right' }}>失败</th>
                <th style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'center' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {importJobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ padding: 8, border: '1px solid #e7edf8' }}>{new Date(job.startedAt).toLocaleString()}</td>
                  <td style={{ padding: 8, border: '1px solid #e7edf8' }}>{job.user.displayName}</td>
                  <td style={{ padding: 8, border: '1px solid #e7edf8' }}>{job.source}</td>
                  <td style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right' }}>{job.totalRows}</td>
                  <td style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right' }}>{job.createdCount}</td>
                  <td style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right' }}>{job.updatedCount}</td>
                  <td style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'right', color: job.failedCount > 0 ? '#e74c3c' : 'inherit' }}>{job.failedCount}</td>
                  <td style={{ padding: 8, border: '1px solid #e7edf8', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      background: job.status === 'completed' ? '#d4edda' : job.status === 'running' ? '#fff3cd' : '#f8d7da',
                      color: job.status === 'completed' ? '#155724' : job.status === 'running' ? '#856404' : '#721c24'
                    }}>
                      {job.status === 'completed' ? '完成' : job.status === 'running' ? '进行中' : '失败'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
