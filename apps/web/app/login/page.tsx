import { Suspense } from 'react';
import LoginClientPage from './login-client';

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>登录页加载中...</main>}>
      <LoginClientPage />
    </Suspense>
  );
}
