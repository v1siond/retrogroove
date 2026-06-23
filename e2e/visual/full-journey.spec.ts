import { test, expect, Page } from '@playwright/test';
import { mockEvent } from '../ticketing/fixtures';

// A realistic, narrated walk-through of the whole product:
// a fan buys two seats, opens their QR ticket, then staff checks it in.
// Paced like a real person (reads, hesitates, types) and recorded to video.

const BEAT = Number(process.env.BEAT || 1100); // ms between deliberate actions

async function beat(page: Page, ms = BEAT) {
  await page.waitForTimeout(ms);
}

async function narrate(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById('rg-narrator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rg-narrator';
      el.setAttribute(
        'style',
        'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;pointer-events:none;' +
          'background:rgba(10,0,24,.92);color:#fff;border:1px solid #ff1493;border-radius:999px;' +
          'padding:10px 22px;font:600 16px Outfit,system-ui,sans-serif;box-shadow:0 0 26px rgba(255,20,147,.5);' +
          'max-width:80vw;text-align:center'
      );
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(900);
}

function ticket(token: string, seat: string, status = 'valid') {
  return {
    id: 't_' + token,
    code: 'RG-' + token.toUpperCase(),
    public_token: token,
    status,
    qr_svg: '<svg viewBox="0 0 100 100" data-qr="1"><rect width="100" height="100" fill="#000"/><rect x="20" y="20" width="60" height="60" fill="#fff"/></svg>',
    checked_in_at: status === 'used' ? '2026-12-31T22:05:00Z' : null,
    seat_id: seat,
  };
}

async function setupMocks(page: Page) {
  let checkedIn = false;

  await page.route('**/api/events/gala-2026', (r) => r.fulfill({ status: 200, json: { event: mockEvent } }));

  await page.route('**/api/orders', (r) =>
    r.fulfill({
      status: 201,
      json: {
        order: {
          id: 'ord1', status: 'pending', total: '70', buyer_email: 'ana@example.com',
          buyer_first_name: null, buyer_last_name: null, expires_at: '2026-12-31T21:15:00Z', tickets: [],
        },
      },
    })
  );

  // Izipay payment-link: return fake URL (redirect suppressed by test hook)
  await page.route('**/api/orders/ord1/payment-link', (r) =>
    r.fulfill({ status: 200, json: { payment_url: 'https://secure.micuentaweb.pe/t/test-stub' } })
  );

  // getOrder returns paid (IPN already processed in stub)
  await page.route('**/api/orders/ord1', (r) => {
    if (r.request().method() === 'GET') {
      return r.fulfill({
        status: 200,
        json: {
          order: {
            id: 'ord1', status: 'paid', total: '70', buyer_email: 'ana@example.com',
            buyer_first_name: 'Ana', buyer_last_name: 'López', expires_at: null,
            tickets: [ticket('tok1', 's1'), ticket('tok2', 's2')],
          },
        },
      });
    }
    return r.continue();
  });

  await page.route('**/api/tickets/tok1/check-in', (r) => {
    checkedIn = true;
    return r.fulfill({ status: 200, json: { ticket: ticket('tok1', 's1', 'used') } });
  });

  await page.route('**/api/tickets/tok1', (r) =>
    r.fulfill({ status: 200, json: { ticket: ticket('tok1', 's1', checkedIn ? 'used' : 'valid') } })
  );

  await page.route('**/api/auth/login', (r) =>
    r.fulfill({ status: 200, json: { token: 'jwt', user: { id: 'u1', email: 'staff@retrogroove.com', name: 'Staff', role: 'staff' } } })
  );
}

test('full journey: fan buys two seats, then staff checks one in', async ({ page }) => {
  await setupMocks(page);
  await page.addInitScript(() => {
    (window as Window & { __IZIPAY_TEST_SKIP__?: boolean }).__IZIPAY_TEST_SKIP__ = true;
  });

  // --- The fan ---
  await test.step('Fan opens the event page', async () => {
    await page.goto('/evento?slug=gala-2026', { waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Gala 2026' })).toBeVisible();
    await narrate(page, 'Ana abre la página del evento');
    await beat(page);
  });

  await test.step('Picks two seats', async () => {
    await narrate(page, 'Elige su primer asiento…');
    await page.locator('[data-seat-id="s1"]').click();
    await beat(page);
    await narrate(page, '…y un segundo asiento (combo de 2 = S/ 70)');
    await page.locator('[data-seat-id="s2"]').click();
    await expect(page.getByTestId('selection')).toContainText('70.00');
    await beat(page);
  });

  await test.step('Enters her email and continues', async () => {
    await narrate(page, 'Ingresa su correo');
    await page.getByLabel('Email').pressSequentially('ana@example.com', { delay: 60 });
    await beat(page, 700);
    await page.getByRole('button', { name: 'Comprar' }).click();
    await expect(page.getByTestId('order-total')).toContainText('70');
    await beat(page);
  });

  await test.step('Pays with Izipay', async () => {
    await narrate(page, 'Paga con tarjeta / Yape (Izipay — redirigido y confirmado)');
    await page.getByRole('button', { name: /pagar/i }).click();
    await expect(page.getByText(/compra confirmada/i)).toBeVisible();
    await narrate(page, '¡Compra confirmada! Recibe sus entradas');
    await beat(page);
  });

  await test.step('Opens her QR ticket', async () => {
    await expect(page.getByTestId('ticket-link').first()).toBeVisible();
    await narrate(page, 'Abre su entrada con código QR');
    await page.goto('/t?token=tok1', { waitUntil: 'commit' });
    await expect(page.getByTestId('ticket-qr')).toBeVisible();
    await beat(page, 1500);
  });

  // --- The door ---
  await test.step('Staff logs into the admin', async () => {
    await page.goto('/admin/check-in', { waitUntil: 'commit' });
    await narrate(page, 'En la puerta, el staff inicia sesión');
    await page.getByLabel('Email').pressSequentially('staff@retrogroove.com', { delay: 40 });
    await page.getByLabel('Contraseña').pressSequentially('password123', { delay: 40 });
    await beat(page, 600);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible();
    await beat(page);
  });

  await test.step('Scans the ticket and registers entry', async () => {
    await narrate(page, 'Escanea el ticket (ingresa el token)');
    await page.getByPlaceholder(/código|token/i).pressSequentially('tok1', { delay: 80 });
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByTestId('result')).toContainText('Válida');
    await beat(page);
    await narrate(page, 'Registra la entrada');
    await page.getByRole('button', { name: /registrar entrada/i }).click();
    await expect(page.getByTestId('result')).toContainText('Entrada registrada');
    await expect(page.getByTestId('count')).toContainText('1 entrada');
    await narrate(page, '✅ Listo — entrada validada');
    await beat(page, 1500);
  });
});
