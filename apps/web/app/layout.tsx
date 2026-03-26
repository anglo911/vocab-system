import React from 'react';

export const metadata = {
  title: 'Vocab System',
  description: 'Vocabulary learning system'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: 'Inter, Arial, sans-serif', background: '#f4f7fb' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
          <header style={{ marginBottom: 16 }}>
            <h1 style={{ margin: '12px 0' }}>📚 Vocab Learning System</h1>
            <nav style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <a href="/">首页</a>
              <a href="/login">登录</a>
              <a href="/learn">学习</a>
              <a href="/me">个人页</a>
              <a href="/wrongbook">错词本</a>
              <a href="/words">词库</a>
              <a href="/admin">后台</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
