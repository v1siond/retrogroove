import React from 'react'
import { Money } from './Money'

interface LineItem {
  label: string
  unitPrice: number
  qty: number
}

interface OrderSummaryProps {
  items: LineItem[]
  comboDiscount?: { label: string; amount: number }
  holdMinutes?: number
}

export function OrderSummary({ items, comboDiscount, holdMinutes = 20 }: OrderSummaryProps) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const discount = comboDiscount?.amount ?? 0
  const total = subtotal - discount

  const containerStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-card)',
    padding: '22px',
    boxShadow: 'var(--shadow-frame)',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '11px 0',
    borderBottom: '1px solid var(--color-border)',
  }

  const priceStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: '1.2rem',
    color: 'var(--color-pink)',
  }

  return (
    <div style={containerStyle}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: '0.06em', marginBottom: '4px' }}>
        RESUMEN
      </div>
      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-faint)', marginBottom: '14px' }}>
        Reserva por {holdMinutes} min
      </div>

      {items.map((item, i) => (
        <div key={i} style={rowStyle}>
          <div style={{ fontSize: '0.9rem' }}>
            {item.label}
            <small style={{ display: 'block', color: 'var(--color-text-faint)', fontSize: '0.7rem' }}>
              {item.qty} × S/ {item.unitPrice.toFixed(2)}
            </small>
          </div>
          <div style={priceStyle}>
            <Money value={item.unitPrice * item.qty} />
          </div>
        </div>
      ))}

      {comboDiscount && (
        <div style={{
          marginTop: '12px',
          background: 'rgba(255,215,0,0.1)',
          border: '1px solid rgba(255,215,0,0.55)',
          borderRadius: 'var(--radius-combo)',
          padding: '11px 13px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600 }}>
            <span>{comboDiscount.label}</span>
            <span>−<Money value={comboDiscount.amount} /></span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '14px' }}>
        <span>Subtotal</span>
        <span><Money value={subtotal} /></span>
      </div>

      {comboDiscount && (
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-gold)', fontSize: '0.82rem', marginTop: '4px' }}>
          <span>Descuento combo</span>
          <span>−<Money value={discount} /></span>
        </div>
      )}

      <div style={{ height: '1px', background: 'var(--color-border)', margin: '12px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.04em' }}>TOTAL</span>
        <span
          data-testid="order-total-value"
          style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)' }}
        >
          <Money value={total} />
        </span>
      </div>

      <div style={{ marginTop: '8px', fontSize: '0.62rem', color: 'var(--color-text-faint)' }}>
        sin cargos sorpresa · Yape · PLIN · tarjeta
      </div>
    </div>
  )
}
