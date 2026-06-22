import { test, expect } from '@playwright/test';
import { setupMusicMocks } from './fixtures';

// /pedir is the public "request a song" picker. Songs come from GET /api/songs.

test.describe('/pedir song picker', () => {
  test('lists enabled songs from the API and hides disabled ones', async ({ page }) => {
    await setupMusicMocks(page);
    await page.goto('/pedir');

    // Advance past the Yape guide into the song selector.
    await page.getByRole('button', { name: /quiero pedir/i }).click();

    // Enabled songs from the API are shown.
    await expect(page.getByText('Take on Me')).toBeVisible();
    await expect(page.getByText('I Will Survive')).toBeVisible();
    await expect(page.getByText('Celebration')).toBeVisible();

    // The disabled song must never appear in the public picker.
    await expect(page.getByText('Hidden Track')).toHaveCount(0);
  });

  test('search filters the API-backed song list', async ({ page }) => {
    await setupMusicMocks(page);
    await page.goto('/pedir');
    await page.getByRole('button', { name: /quiero pedir/i }).click();

    await page.getByPlaceholder(/buscar canción/i).fill('survive');
    await expect(page.getByText('I Will Survive')).toBeVisible();
    await expect(page.getByText('Take on Me')).toHaveCount(0);
  });
});
