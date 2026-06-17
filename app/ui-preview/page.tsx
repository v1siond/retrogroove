'use client'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Money } from '@/components/ui/Money'
import { SectionEyebrow } from '@/components/ui/SectionEyebrow'
import { SeatLegend } from '@/components/ui/SeatLegend'
import { OrderSummary } from '@/components/ui/OrderSummary'
import { Nav } from '@/components/ui/Nav'
import { Footer } from '@/components/ui/Footer'

export default function UIPreview() {
  return (
    <>
      <Nav />
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* T1 */}
        <h1 data-testid="display-heading" style={{ fontFamily: 'var(--font-display)', fontSize: '3rem' }}>
          RETROGROOVE
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Body text in Outfit</p>

        {/* T2 */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" data-testid="btn-primary">COMPRAR ENTRADAS</Button>
          <Button variant="secondary" data-testid="btn-secondary">SECONDARY</Button>
          <Button variant="ghost" data-testid="btn-ghost">GHOST</Button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip variant="gold" data-testid="chip-gold">Combo pareja VIP</Chip>
          <Chip variant="plain" data-testid="chip-plain">Entrada General</Chip>
          <Chip variant="cyan" data-testid="chip-cyan">Preventa</Chip>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Badge variant="green" data-testid="badge-green">Válida</Badge>
          <Badge variant="red" data-testid="badge-red">Usada</Badge>
          <Badge variant="cyan" data-testid="badge-cyan">Disponible</Badge>
        </div>

        <div style={{ maxWidth: '360px' }}>
          <Input label="Email" id="email-demo" placeholder="fan@example.com" data-testid="input-demo" />
        </div>

        <div style={{ maxWidth: '360px' }}>
          <Select label="Zona" id="zona-demo" data-testid="select-demo">
            <option>VIP</option>
            <option>General</option>
          </Select>
        </div>

        <Card data-testid="card-demo" style={{ maxWidth: '360px' }}>
          <p>Card content</p>
        </Card>

        {/* T3 */}
        <div data-testid="money-basic"><Money value={340} /></div>
        <div data-testid="money-prefix"><Money value={340} prefix="Desde" /></div>

        <SectionEyebrow data-testid="eyebrow-demo">Zona / Sector</SectionEyebrow>

        <SeatLegend data-testid="seat-legend" />

        <OrderSummary
          items={[{ label: 'Entrada VIP', unitPrice: 70, qty: 2 }]}
          comboDiscount={{ label: 'Combo pareja VIP aplicado', amount: 20 }}
        />
      </div>
      <Footer />
    </>
  )
}
