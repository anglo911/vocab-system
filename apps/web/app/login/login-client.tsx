'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { apiPost } from '../../lib/api';
import { saveAuth } from '../../lib/auth';

type AuthUser = {
  id: string;
  email?: string;
  displayName: string;
  role?: 'USER' | 'ADMIN';
  emailVerified?: boolean;
};

type LoginResp = {
  token: string;
  user: AuthUser;
};

type RegisterResp = {
  ok: boolean;
  user: AuthUser;
  verificationToken: string;
  verificationHint: string;
};

export default function LoginClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/learn', [searchParams]);

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'verify' | 'reset'>('login');
  const [email, setEmail] = useState('admin-demo@example.com');
  const [password, setPassword] = useState('123456');
  const [displayName, setDisplayName] = useState('Mike');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submitLogin() {
    setLoading(true); setError(''); setMessage('');
    try {
      const data = await apiPost<LoginResp>('/api/auth/login', { email: email.trim(), password });
      saveAuth(data.token, data.user);
      router.replace(next);
    } catch {
      setError('登录失败，请检查邮箱和密码。');
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister() {
    setLoading(true); setError(''); setMessage('');
    try {
      const data = await apiPost<RegisterResp>('/api/auth/register', { email: email.trim(), password, displayName: displayName.trim() });
      setMessage(`注册成功。验证 token：${data.verificationToken}`);
      setToken(data.verificationToken);
      setMode('verify');
    } catch {
      setError('注册失败，邮箱可能已存在。');
    } finally {
      setLoading(false);
    }
  }

  async function submitForgot() {
    setLoading(true); setError(''); setMessage('');
    try {
      const data = await apiPost<{ ok: boolean; resetToken?: string }>('/api/auth/forgot-password', { email: email.trim() });
      setMessage(data.resetToken ? `重置 token：${data.resetToken}` : '若邮箱存在，已生成重置流程。');
      if (data.resetToken) {
        setToken(data.resetToken);
        setMode('reset');
      }
    } catch {
      setError('提交失败。');
    } finally {
      setLoading(false);
    }
  }

  async function submitVerify() {
    setLoading(true); setError(''); setMessage('');
    try {
      await apiPost('/api/auth/verify-email', { token: token.trim() });
      setMessage('邮箱验证成功，现在可以登录。');
      setMode('login');
    } catch {
      setError('验证失败，token 无效或已过期。');
    } finally {
      setLoading(false);
    }
  }

  async function submitReset() {
    setLoading(true); setError(''); setMessage('');
    try {
      await apiPost('/api/auth/reset-password', { token: token.trim(), password });
      setMessage('密码重置成功，现在可以登录。');
      setMode('login');
    } catch {
      setError('重置失败，token 无效或已过期。');
    } finally {
      setLoading(false);
    }
  }

  const title = {
    login: '登录',
    register: '注册',
    forgot: '找回密码',
    verify: '邮箱验证',
    reset: '重置密码'
  }[mode];

  return (
    <main style={{ background: '#fff', border: '1px solid #dfe7f3', borderRadius: 12, padding: 16, maxWidth: 560, display: 'grid', gap: 12 }}>
      <h2>{title} /login</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setMode('login')}>登录</button>
        <button onClick={() => setMode('register')}>注册</button>
        <button onClick={() => setMode('forgot')}>找回密码</button>
      </div>

      {(mode === 'login' || mode === 'register' || mode === 'forgot') ? (
        <label>
          邮箱
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="请输入邮箱" style={{ width: '100%' }} />
        </label>
      ) : null}

      {mode === 'register' ? (
        <label>
          昵称
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="显示名称" style={{ width: '100%' }} />
        </label>
      ) : null}

      {(mode === 'login' || mode === 'register' || mode === 'reset') ? (
        <label>
          密码
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" style={{ width: '100%' }} />
        </label>
      ) : null}

      {(mode === 'verify' || mode === 'reset') ? (
        <label>
          Token
          <textarea value={token} onChange={(e) => setToken(e.target.value)} rows={3} style={{ width: '100%' }} />
        </label>
      ) : null}

      {mode === 'login' ? <button onClick={submitLogin} disabled={loading || !email.trim() || !password.trim()}>{loading ? '提交中...' : '登录'}</button> : null}
      {mode === 'register' ? <button onClick={submitRegister} disabled={loading || !email.trim() || !password.trim() || !displayName.trim()}>{loading ? '提交中...' : '注册'}</button> : null}
      {mode === 'forgot' ? <button onClick={submitForgot} disabled={loading || !email.trim()}>{loading ? '提交中...' : '发送重置流程'}</button> : null}
      {mode === 'verify' ? <button onClick={submitVerify} disabled={loading || !token.trim()}>{loading ? '提交中...' : '验证邮箱'}</button> : null}
      {mode === 'reset' ? <button onClick={submitReset} disabled={loading || !token.trim() || !password.trim()}>{loading ? '提交中...' : '重置密码'}</button> : null}

      {message ? <p style={{ color: '#1d6f42', whiteSpace: 'pre-wrap' }}>{message}</p> : null}
      {error ? <p style={{ color: '#b94a48' }}>{error}</p> : null}

      <p style={{ color: '#61708a' }}>
        当前为开发版账号体系：已支持真实注册/登录、验证 token、重置 token；邮件发送稍后可接真实 SMTP/邮件服务。
      </p>
    </main>
  );
}
