"""Reusable async Playwright regression entry point: await run(page)."""
import os
import re


async def run(page):
    """Checks exercised in iteration 29; public URL comes from the environment."""
    await page.goto(os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/verlauf-preview')
    await page.set_viewport_size({'width': 1920, 'height': 800})
    await page.get_by_test_id('vp-balance').wait_for()
    await page.get_by_test_id('vp-view-multi').click(force=True)
    await page.get_by_test_id('vp-range-24h').click(force=True)
    await page.wait_for_timeout(1000)
    assert await page.locator('[data-testid$="-delta"]').count() == 19
    for tid in ['vp-dist-pv', 'vp-dist-house']:
        bar = page.get_by_test_id(tid)
        await bar.scroll_into_view_if_needed()
        texts = await bar.locator('[data-testid]').all_inner_texts()
        shares = [int(re.search(r': (\d+)%', text).group(1))
                  for text in texts if re.search(r': (\d+)%', text)]
        assert sum(shares) == 100
    chart = page.get_by_test_id('vp-multiline-chart')
    battery = chart.locator('path.recharts-line-curve[stroke="#22D3EE"]')
    assert await battery.count() == 1
    await page.get_by_test_id('vp-legend-akku').click(force=True)
    assert await battery.count() == 0
    await page.get_by_test_id('vp-legend-akku').click(force=True)
    assert await battery.count() == 1
    for rng in ['1h', '3h', '6h', '12h', '24h']:
        async with page.expect_response(lambda r: '/api/history?' in r.url and 'range=' + rng in r.url) as info:
            await page.get_by_test_id('vp-range-' + rng).click(force=True)
        assert (await info.value).status == 200
        assert await page.get_by_test_id('vp-range-' + rng).get_attribute('aria-pressed') == 'true'
    for size in [{'width': 1920, 'height': 800}, {'width': 390, 'height': 844}]:
        await page.set_viewport_size(size)
        for view in ['four', 'multi']:
            await page.get_by_test_id('vp-view-' + view).click(force=True)
            await page.wait_for_timeout(250)
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    await page.get_by_test_id('vp-view-four').click(force=True)
    await page.get_by_test_id('vp-ch-battery').wait_for()
    assert await page.get_by_test_id('vp-ch-battery').locator('path.recharts-line-curve[stroke="#22D3EE"]').count() == 1
    await page.get_by_test_id('vp-back').click(force=True)
    await page.get_by_test_id('history-page').wait_for()
    assert await page.get_by_test_id('grafana-link').is_visible()
    print('PASS preview core UI regression')


async def check_missing_yesterday(page):
    """MOCKED network failure: every comparison must remain explicitly unavailable."""
    async def unavailable(route):
        if 'day_offset=1' in route.request.url:
            await route.abort('failed')
        else:
            await route.continue_()
    await page.route('**/api/today*', unavailable)
    try:
        await page.goto(os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/verlauf-preview')
        await page.get_by_test_id('vp-balance').wait_for()
        await page.wait_for_timeout(800)
        texts = await page.locator('[data-testid$="-delta"]').all_inner_texts()
        assert all('Gestern: –' in text for text in texts), texts
    finally:
        await page.unroute('**/api/today*', unavailable)