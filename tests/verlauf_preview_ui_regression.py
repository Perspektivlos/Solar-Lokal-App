"""Reusable async Playwright regression entry point: await run(page)."""
import os
import re


async def run(page):
    """Phase-2 regression: legacy preview redirects to the production history page."""
    await page.goto(os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/verlauf-preview')
    await page.set_viewport_size({'width': 1920, 'height': 800})
    await page.get_by_test_id('vp-balance').wait_for()
    assert page.url.endswith('/verlauf')
    await page.get_by_test_id('history-page').wait_for()
    await page.get_by_test_id('intro-history-toggle').click(force=True)
    assert await page.get_by_test_id('intro-section-Ansichten').is_visible()
    await page.get_by_test_id('intro-history-toggle').click(force=True)
    config = await page.request.get(os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/api/config')
    link = page.get_by_test_id('grafana-link')
    assert await link.get_attribute('href') == (await config.json())['grafana_url']
    assert await link.get_attribute('target') == '_blank'
    assert await page.get_by_test_id('vp-back').count() == 0
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
    separate = page.get_by_test_id('vp-battery-chart')
    await check_battery_plot(page, separate, dash='5 4', check_w_axis=True)
    await check_daily_bars(page)
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
    await check_battery_plot(page, page.get_by_test_id('vp-ch-battery'), dash='4 3')
    await page.get_by_test_id('vp-range-6h').click(force=True)
    await page.reload()
    await page.get_by_test_id('vp-four').wait_for()
    assert await page.get_by_test_id('vp-range-6h').get_attribute('aria-pressed') == 'true'
    await page.get_by_test_id('sun-timeline').scroll_into_view_if_needed()
    assert await page.get_by_test_id('sun-timeline').is_visible()
    print('PASS production history core UI regression')


async def check_battery_plot(page, container, dash, check_w_axis=False):
    """Battery curve colors, dashed SoC, axes and unit-aware hover tooltip."""
    try:
        await container.scroll_into_view_if_needed()
        assert await container.locator('path.recharts-line-curve[stroke="#22D3EE"]').count() == 1
        soc = container.locator('path.recharts-line-curve[stroke="#A3E635"]')
        assert await soc.count() == 1
        assert await soc.get_attribute('stroke-dasharray') == dash
        ticks = await container.locator('svg text').all_text_contents()
        assert any(t.endswith('%') for t in ticks)
        if check_w_axis:
            assert any(t.endswith('W') for t in ticks)
        box = await container.locator('.recharts-wrapper').bounding_box()
        await page.mouse.move(box['x'] + box['width'] * .88, box['y'] + box['height'] * .45)
        await page.wait_for_timeout(250)
        tooltip = await container.get_by_test_id('vp-tooltip').inner_text()
        assert re.search(r'Akku\s+[^\n]* W', tooltip)
        assert re.search(r'SoC\s+[^\n]* %', tooltip)
        print('PASS battery plot', await container.get_attribute('data-testid'))
    except Exception as exc:
        print('FAIL battery plot', str(exc))
        raise


async def check_daily_bars(page):
    """Four grouped daily kWh series match real public API values and channel colors."""
    try:
        chart = page.get_by_test_id('vp-balance').get_by_test_id('vp-balance-history-bars')
        await chart.scroll_into_view_if_needed()
        await page.wait_for_timeout(500)
        response = await page.request.get(os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/api/energy/balance?period=day&limit=14')
        assert response.status == 200
        rows = (await response.json())['buckets']
        groups = chart.locator('.recharts-bar')
        assert await groups.count() == 4
        for index, (key, color) in enumerate([('pv_kwh', '#F59E0B'), ('self_kwh', '#F43F5E'), ('import_kwh', '#818CF8'), ('export_kwh', '#10B981')]):
            shapes = groups.nth(index).locator('path.recharts-rectangle')
            expected = sum(row[key] > 0 for row in rows)
            assert await shapes.count() == expected
            if expected:
                assert await shapes.first.get_attribute('fill') == color
        await groups.first.locator('path.recharts-rectangle').first.hover(force=True)
        await page.wait_for_timeout(250)
        tooltip = await chart.locator('.recharts-tooltip-wrapper').inner_text()
        row = next(row for row in rows if row['pv_kwh'] > 0)
        for key, label in [('pv_kwh', 'PV-Ertrag'), ('self_kwh', 'Eigenverbrauch'), ('import_kwh', 'Netzbezug'), ('export_kwh', 'Einspeisung')]:
            assert label in tooltip
            assert ('%.2f' % row[key]).replace('.', ',') + ' kWh' in tooltip
        print('PASS daily grouped bars and API tooltip values')
    except Exception as exc:
        print('FAIL daily grouped bars', str(exc))
        raise


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


async def check_hover_resize_overflow(page):
    """Regression for iteration 31: hidden daily tooltip must not widen mobile page."""
    await page.goto(os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/verlauf')
    await page.set_viewport_size({'width': 1920, 'height': 800})
    await page.get_by_test_id('vp-view-four').click(force=True)
    chart = page.get_by_test_id('vp-balance-history-bars')
    await chart.locator('.recharts-bar').first.wait_for()
    await chart.scroll_into_view_if_needed()
    await chart.locator('.recharts-bar').first.locator('path.recharts-rectangle').first.hover(force=True)
    await page.wait_for_timeout(250)
    await page.get_by_test_id('sun-timeline').scroll_into_view_if_needed()
    await page.get_by_test_id('sun-view-bogen').click(force=True)
    await page.get_by_test_id('sun-view-balken').click(force=True)
    await page.set_viewport_size({'width': 390, 'height': 844})
    await page.get_by_test_id('vp-view-four').click(force=True)
    await page.wait_for_timeout(500)
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')