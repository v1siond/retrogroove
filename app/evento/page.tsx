'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EventBuy from './EventBuy';

function EventBuyWithParams() {
  const params = useSearchParams();
  const slug = params.get('slug') || '';
  const orderId = params.get('order') || '';

  // Either a slug (normal buy flow) or an order id (Izipay return URL) is enough.
  if (!slug && !orderId) {
    return <main className="buy"><p>Evento no especificado</p></main>;
  }
  return <EventBuy slug={slug} orderId={orderId || undefined} />;
}

export default function EventoPage() {
  return (
    <Suspense fallback={null}>
      <EventBuyWithParams />
    </Suspense>
  );
}
