import { test, expect, Page } from '@playwright/test';

// Real-backend demo (no mocks): admin configures events of every shape in the
// visual stage editor, they appear on the home, fans buy, tickets get checked
// in — plus negative paths. Paced like a real, first-time user.

const BEAT = Number(process.env.BEAT || 1000);
const ADMIN = { email: 'admin@retrogroove.com', password: 'retrogroove2026' };

const beat = (page: Page, ms = BEAT) => page.waitForTimeout(ms);

async function narrate(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById('rg-narrator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rg-narrator';
      el.setAttribute(
        'style',
        'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;pointer-events:none;' +
          'background:rgba(10,0,24,.92);color:#fff;border:1px solid #ff1493;border-radius:999px;padding:10px 22px;' +
          'font:600 16px Outfit,system-ui,sans-serif;box-shadow:0 0 26px rgba(255,20,147,.5);max-width:84vw;text-align:center'
      );
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(850);
}

async function ensureAdmin(page: Page) {
  const loginBtn = page.getByRole('button', { name: 'Entrar' });
  // The auth gate renders nothing until it has checked localStorage; wait to see
  // whether it resolves to the login form (not yet authed) or straight to content.
  try {
    await loginBtn.waitFor({ state: 'visible', timeout: 6000 });
  } catch {
    return; // already authenticated — no login form appeared
  }
  await narrate(page, 'El admin inicia sesión');
  await page.getByLabel('Email').pressSequentially(ADMIN.email, { delay: 35 });
  await page.getByLabel('Contraseña').pressSequentially(ADMIN.password, { delay: 35 });
  await beat(page, 400);
  await loginBtn.click();
  await loginBtn.waitFor({ state: 'hidden', timeout: 10000 });
}

interface SectionCfg {
  name: string;
  seatsPerTable: number;
  price1: string;
  price2?: string;
  tables: { x: number; y: number }[];
  shape?: 'round' | 'rect';
  seating?: 'around' | 'rows';
  seatsPerRow?: number;
}
interface EventCfg {
  name: string;
  when: string; // datetime-local "YYYY-MM-DDTHH:MM"
  venue: string;
  sections: SectionCfg[];
}

async function createEvent(page: Page, cfg: EventCfg) {
  await page.goto('/band/tickets/nuevo', { waitUntil: 'commit' });
  await ensureAdmin(page);

  await narrate(page, `Crea el evento: ${cfg.name}`);
  await page.getByLabel('Nombre', { exact: true }).pressSequentially(cfg.name, { delay: 25 });
  await page.getByLabel('Fecha y hora').fill(cfg.when);
  await page.getByLabel('Lugar').pressSequentially(cfg.venue, { delay: 25 });
  await beat(page);

  for (let s = 0; s < cfg.sections.length; s++) {
    const sec = cfg.sections[s];
    if (s > 0) {
      await narrate(page, 'Agrega otra sección con su propio precio');
      await page.getByTestId('add-section').click();
    }
    await page.getByTestId('section-tab').nth(s).click();
    await page.getByLabel('Nombre de la sección').fill(sec.name);
    await page.getByLabel('Asientos por mesa (nuevas)').fill(String(sec.seatsPerTable));
    if (sec.shape) await page.getByLabel('Forma').selectOption(sec.shape);
    if (sec.seating) await page.getByLabel('Distribución').selectOption(sec.seating);
    if (sec.seatsPerRow) await page.getByLabel('Asientos por fila').fill(String(sec.seatsPerRow));
    await page.getByLabel('Precio 1 entrada').fill(sec.price1);
    await page.getByLabel(/combo/i).fill(sec.price2 || '');
    await narrate(page, `Coloca las mesas de "${sec.name}" en el escenario`);
    for (const pos of sec.tables) {
      await page.getByTestId('stage-canvas').click({ position: pos });
      await beat(page, 550);
    }
  }

  await beat(page);
  await narrate(page, 'Crea y publica el evento');
  await page.getByRole('button', { name: /crear y publicar/i }).click();
  await expect(page.getByText(/evento publicado/i)).toBeVisible();
  await beat(page);
}

// Each pick names a section and how many seats to take from it. Selecting by
// section (not by a global flat index) keeps the test independent of the order
// the API happens to return sections/seats in.
interface SeatPick {
  section: string;
  count: number;
}

async function buyFromHome(page: Page, eventName: string, picks: SeatPick[], expectTotal?: string) {
  await page.goto('/', { waitUntil: 'commit' });
  await narrate(page, 'Un fan visita la home y ve el evento');
  const card = page.getByTestId('event-card').filter({ hasText: eventName });
  await expect(card).toBeVisible();
  await beat(page);
  await card.getByTestId('buy-link').click();

  await expect(page.getByRole('heading', { name: eventName })).toBeVisible();
  const total = picks.reduce((n, p) => n + p.count, 0);
  await narrate(page, `Elige ${total} asiento(s)`);
  for (const pick of picks) {
    const section = page.locator('section[data-section-id]').filter({ hasText: pick.section });
    const seats = section.locator('[data-status="available"]');
    await expect(seats.first()).toBeVisible();
    for (let i = 0; i < pick.count; i++) {
      await seats.nth(i).click();
      await beat(page, 500);
    }
  }
  if (expectTotal) await expect(page.getByTestId('selection')).toContainText(expectTotal);

  await narrate(page, 'Ingresa sus datos');
  await page.getByLabel('Nombre', { exact: true }).pressSequentially('Ana', { delay: 40 });
  await page.getByLabel('Apellido').pressSequentially('López', { delay: 40 });
  await page.getByLabel('Email').pressSequentially('ana@example.com', { delay: 30 });
  await beat(page);
  await page.getByRole('button', { name: 'Comprar' }).click();

  await narrate(page, 'Paga con Culqi');
  await expect(page.getByTestId('order-total')).toBeVisible();
  await page.getByRole('button', { name: /pagar/i }).click();
  await expect(page.getByText(/compra confirmada/i)).toBeVisible();
  await narrate(page, '¡Compra confirmada!');
  await beat(page);

  const href = await page.getByTestId('ticket-link').first().getAttribute('href');
  return href!.split('token=')[1];
}

// Staff validates a ticket at the door: scan -> "Válida" -> register entry.
async function checkIn(page: Page, token: string) {
  await page.goto('/band/tickets/check-in', { waitUntil: 'commit' });
  await ensureAdmin(page);
  await narrate(page, 'En la puerta, el staff valida la entrada');
  await page.getByPlaceholder(/código|token/i).pressSequentially(token, { delay: 15 });
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByTestId('result')).toContainText('Válida');
  await page.getByRole('button', { name: /registrar entrada/i }).click();
  await expect(page.getByTestId('result')).toContainText('Entrada registrada');
  await beat(page);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __CULQI_TEST_TOKEN__?: string }).__CULQI_TEST_TOKEN__ = 'tkn_demo';
  });
});

test('Negativos — login inválido, asiento ocupado, doble check-in', async ({ page }) => {
  // (1) invalid admin login
  await page.goto('/band/tickets/check-in', { waitUntil: 'commit' });
  await narrate(page, 'Contraseña incorrecta → error');
  await page.getByLabel('Email').pressSequentially(ADMIN.email, { delay: 25 });
  await page.getByLabel('Contraseña').pressSequentially('malísima', { delay: 25 });
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
  await beat(page);

  // Set up a small event + buy a seat (capture its token for check-in)
  await createEvent(page, {
    name: 'Prueba Negativos',
    when: '2026-12-23T21:00',
    venue: 'Sala Test',
    sections: [{ name: 'Única', seatsPerTable: 2, price1: '30', tables: [{ x: 400, y: 160 }] }],
  });
  const token = await buyFromHome(page, 'Prueba Negativos', [{ section: 'Única', count: 1 }], 'S/ 30.00');

  // (2) the seat is now sold — reopening the event shows it unavailable
  await page.goto('/', { waitUntil: 'commit' });
  await page.getByTestId('event-card').filter({ hasText: 'Prueba Negativos' }).getByTestId('buy-link').click();
  await narrate(page, 'El asiento comprado ya aparece vendido (no seleccionable)');
  await expect(page.locator('[data-status="sold"]').first()).toBeVisible();
  await beat(page);

  // (3) check in the ticket, then a second scan is rejected
  await page.goto('/band/tickets/check-in', { waitUntil: 'commit' });
  await ensureAdmin(page);
  await narrate(page, 'Staff registra la entrada en la puerta');
  await page.getByPlaceholder(/código|token/i).pressSequentially(token, { delay: 15 });
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByTestId('result')).toContainText('Válida');
  await page.getByRole('button', { name: /registrar entrada/i }).click();
  await expect(page.getByTestId('result')).toContainText('Entrada registrada');
  await beat(page);

  await narrate(page, 'Un segundo escaneo se rechaza');
  // Staff clears the previous result before scanning again; "Siguiente" calls
  // reset() and refocuses, so we don't append onto the already-typed token.
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByPlaceholder(/código|token/i).pressSequentially(token, { delay: 15 });
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByTestId('result')).toContainText('Ya usada');
  await beat(page);
});

test('Restaurante — cena show de cumbia: mesas redondas, combo de mesa, validación en puerta', async ({ page }) => {
  await createEvent(page, {
    name: 'Grupo 5 — Noche de Cumbia',
    when: '2026-12-27T21:00',
    venue: 'Restaurante El Huerto, Lima',
    sections: [
      { name: 'VIP Frente al Escenario', shape: 'round', seating: 'around', seatsPerTable: 4, price1: '120', price2: '220', tables: [{ x: 300, y: 150 }] },
      { name: 'Mesas Generales', shape: 'round', seating: 'around', seatsPerTable: 6, price1: '70', tables: [{ x: 620, y: 200 }] },
    ],
  });

  // The seat map renders VIP as a round table of 4 seats.
  await page.goto('/', { waitUntil: 'commit' });
  await page.getByTestId('event-card').filter({ hasText: 'Grupo 5' }).getByTestId('buy-link').click();
  await expect(
    page.locator('section[data-section-id]').filter({ hasText: 'VIP' }).locator('[data-status="available"]')
  ).toHaveCount(4);
  await beat(page);

  // A couple takes two VIP seats — the 2-seat combo (S/ 220), not 2 x 120.
  const token = await buyFromHome(page, 'Grupo 5 — Noche de Cumbia', [{ section: 'VIP', count: 2 }], 'S/ 220.00');

  // At the door, staff validates one of their tickets.
  await checkIn(page, token);
});

test('Teatro — rock en filas: Platea y Mezzanine, precio por zona, compra en grupo', async ({ page }) => {
  await createEvent(page, {
    name: 'Líbido — Rock en el Teatro',
    when: '2026-12-29T21:00',
    venue: 'Teatro Municipal de Lima',
    sections: [
      { name: 'Platea', shape: 'rect', seating: 'rows', seatsPerTable: 20, seatsPerRow: 10, price1: '90', tables: [{ x: 350, y: 150 }] },
      { name: 'Mezzanine', shape: 'rect', seating: 'rows', seatsPerTable: 30, seatsPerRow: 10, price1: '60', tables: [{ x: 350, y: 250 }] },
    ],
  });

  // The seat map renders the zones as labeled theater rows (A1..A10, B1..B10).
  await page.goto('/', { waitUntil: 'commit' });
  await page.getByTestId('event-card').filter({ hasText: 'Líbido' }).getByTestId('buy-link').click();
  const platea = page.locator('section[data-section-id]').filter({ hasText: 'Platea' });
  await expect(platea.locator('[data-status="available"]')).toHaveCount(20);
  await expect(platea).toContainText('Fila B');
  await beat(page);

  // A group buys 1 Platea + 2 Mezzanine — per-zone flat pricing (90 + 2 x 60 = 210).
  const token = await buyFromHome(page, 'Líbido — Rock en el Teatro', [
    { section: 'Platea', count: 1 },
    { section: 'Mezzanine', count: 2 },
  ], 'S/ 210.00');

  await checkIn(page, token);
});

test('Arena — fiesta disco, entrada general de precio único', async ({ page }) => {
  await createEvent(page, {
    name: 'Fiebre Disco 70s — Arena 1',
    when: '2026-12-30T21:00',
    venue: 'Arena 1, Costa Verde',
    sections: [
      { name: 'General', shape: 'rect', seating: 'rows', seatsPerTable: 50, seatsPerRow: 25, price1: '50', tables: [{ x: 350, y: 180 }] },
    ],
  });

  // A lone fan buys a single general ticket (flat S/ 50).
  const token = await buyFromHome(page, 'Fiebre Disco 70s — Arena 1', [{ section: 'General', count: 1 }], 'S/ 50.00');

  await checkIn(page, token);
});

test('Asientos específicos — el comprador recibe EXACTAMENTE los asientos que eligió', async ({ page }) => {
  await createEvent(page, {
    name: 'Función con Numeración',
    when: '2026-12-26T20:00',
    venue: 'Teatro Segura, Lima',
    sections: [
      { name: 'Platea', shape: 'rect', seating: 'rows', seatsPerTable: 30, seatsPerRow: 10, price1: '80', tables: [{ x: 350, y: 160 }] },
    ],
  });

  await page.goto('/', { waitUntil: 'commit' });
  await page.getByTestId('event-card').filter({ hasText: 'Función con Numeración' }).getByTestId('buy-link').click();
  const platea = page.locator('section[data-section-id]').filter({ hasText: 'Platea' });

  // The fan deliberately picks two SPECIFIC seats — B5 and C8 — not "first available".
  const b5 = platea.getByRole('button', { name: 'Asiento B5', exact: true });
  const c8 = platea.getByRole('button', { name: 'Asiento C8', exact: true });
  const idB5 = await b5.getAttribute('data-seat-id');
  const idC8 = await c8.getAttribute('data-seat-id');
  await narrate(page, 'Elige asientos específicos: B5 y C8');
  await b5.click();
  await c8.click();
  await expect(page.getByTestId('selection')).toContainText('S/ 160.00'); // 2 x 80
  await beat(page);

  await narrate(page, 'Ingresa sus datos y paga');
  await page.getByLabel('Nombre', { exact: true }).pressSequentially('Ana', { delay: 30 });
  await page.getByLabel('Apellido').pressSequentially('López', { delay: 30 });
  await page.getByLabel('Email').pressSequentially('ana@example.com', { delay: 25 });
  await page.getByRole('button', { name: 'Comprar' }).click();
  await expect(page.getByTestId('order-total')).toBeVisible();
  await page.getByRole('button', { name: /pagar/i }).click();
  await expect(page.getByText(/compra confirmada/i)).toBeVisible();
  await beat(page);

  // Reopen the event: EXACTLY B5 and C8 are sold; a neighbor (B6) is still free.
  await page.goto('/', { waitUntil: 'commit' });
  await page.getByTestId('event-card').filter({ hasText: 'Función con Numeración' }).getByTestId('buy-link').click();
  await narrate(page, 'Al reabrir, B5 y C8 figuran vendidos; B6 sigue libre');
  await expect(page.locator(`[data-seat-id="${idB5}"]`)).toHaveAttribute('data-status', 'sold');
  await expect(page.locator(`[data-seat-id="${idC8}"]`)).toHaveAttribute('data-status', 'sold');
  const platea2 = page.locator('section[data-section-id]').filter({ hasText: 'Platea' });
  await expect(platea2.getByRole('button', { name: 'Asiento B6', exact: true })).toHaveAttribute('data-status', 'available');
  await beat(page);
});
