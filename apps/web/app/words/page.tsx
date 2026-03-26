import { Suspense } from 'react';
import WordsClientPage from './words-client';

export default function WordsPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>词库加载中...</main>}>
      <WordsClientPage />
    </Suspense>
  );
}
