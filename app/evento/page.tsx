'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EventBuy from './EventBuy';

function EventBuyWithParams() {
  const slug = useSearchParams().get('slug') || '';
  if (!slug) return <main className="buy"><p>Evento no especificado</p></main>;
  return <EventBuy slug={slug} />;
}

export default function EventoPage() {
  return (
    <Suspense fallback={null}>
      <EventBuyWithParams />
    </Suspense>
  );
}
