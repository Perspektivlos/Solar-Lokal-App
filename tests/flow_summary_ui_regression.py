# Run with browser page at the externally configured frontend URL: await run(page).
import asyncio


async def run(page):
    samples = {'today': [], 'live': [], 'config': []}
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    async def capture(response):
        key = response.url.split('/api/')[-1].split('?')[0]
        if key in samples and response.status == 200:
            samples[key].append(await response.json())

    page.on('response', capture)
    try:
        await page.set_viewport_size({'width': 1920, 'height': 800})
        await page.reload()
        await page.get_by_test_id('flow-summary').wait_for(state='visible', timeout=20000)
        await page.wait_for_timeout(250)
        assert all(samples.values()), 'Missing captured API responses'
        for tile in ('pv', 'battery', 'grid', 'autarky'):
            for part in ('label', 'value', 'unit', 'source'):
                assert await page.get_by_test_id(f'summary-{tile}-{part}').count() == 1
        print('PASS: all 16 unique summary test IDs')
        today, live, cfg = (samples[k][-1] for k in ('today', 'live', 'config'))
        expected = await page.evaluate('''({today, live, cfg}) => {
            const fmt = (v, n) => Number(v).toLocaleString('de-DE', {minimumFractionDigits:n, maximumFractionDigits:n});
            return {pv:fmt(today.pv_kwh,2), grid:fmt(today.grid_import_kwh,2), autarky:fmt(today.autarky_pct,1), battery:fmt(live.summary.battery_soc / 100 * cfg.display.usable_kwh,2)};
        }''', {'today':today, 'live':live, 'cfg':cfg})
        for tile, value in expected.items():
            actual = await page.get_by_test_id(f'summary-{tile}-value').inner_text()
            assert actual == value, f'{tile}: {actual} != {value}'
            print(f'PASS: {tile} exact displayed/API-rounded value {actual}')
        assert await page.get_by_test_id('summary-battery-label').text_content() == 'Akku verfügbar'
        assert 'Schätzwert' in await page.get_by_test_id('summary-battery-source').inner_text()
        assert await page.get_by_test_id('summary-autarky-label').text_content() == 'Autarkie heute'
        for tile in ('pv', 'grid'):
            assert 'Simulierter Messverlauf seit 00:00 UTC' in await page.get_by_test_id(f'summary-{tile}-source').inner_text()
        for tile in ('pv', 'grid', 'battery'):
            assert await page.get_by_test_id(f'summary-{tile}-unit').inner_text() == 'kWh'
        assert await page.get_by_test_id('summary-autarky-unit').inner_text() == '%'
        await page.get_by_test_id('section-pv-grid-details-toggle').click(force=True)
        details = page.get_by_test_id('section-pv-grid-details')
        await details.wait_for(state='visible')
        explanation = await details.inner_text()
        assert 'YDay-Gerätezähler nur simulierte Näherungswerte' in explanation
        assert 'aus dem Messverlauf integriert' in explanation
        assert 'seit Mitternacht kumuliert' not in explanation
        await page.get_by_test_id('section-pv-grid-details-toggle').click(force=True)
        await details.wait_for(state='hidden')
        print('PASS: PV/netz details open/close and correctly describe demo counters')
        counters = sum(c['yield_day'] for c in live['ahoy']['channels']) + sum(m['yield_today'] for m in live['victron']['mppts'])
        assert abs(float(expected['pv'].replace('.', '').replace(',', '.')) - counters) > 0.01
        print(f'PASS: PV uses integrated daily value, not demo device counter sum {counters:.3f}')
        counts = {key:len(samples[key]) for key in ('today', 'live')}
        await page.wait_for_timeout(6500)
        for key in counts:
            assert len(samples[key]) >= counts[key] + 2, f'{key} polling stopped'
        assert samples['live'][-1]['timestamp'] != live['timestamp']
        assert await page.get_by_test_id('flow-summary').is_visible()
        assert await page.get_by_test_id('dashboard-error').count() == 0
        print('PASS: at least two further live/today polls and summary remains rendered')
        expected_after = await page.evaluate('''({today, live, cfg}) => {
            const fmt = (v, n) => Number(v).toLocaleString('de-DE', {minimumFractionDigits:n, maximumFractionDigits:n});
            return {pv:fmt(today.pv_kwh,2), grid:fmt(today.grid_import_kwh,2), autarky:fmt(today.autarky_pct,1), battery:fmt(live.summary.battery_soc / 100 * cfg.display.usable_kwh,2)};
        }''', {'today':samples['today'][-1], 'live':samples['live'][-1], 'cfg':cfg})
        for tile, value in expected_after.items():
            assert await page.get_by_test_id(f'summary-{tile}-value').inner_text() == value
        print('PASS: all four summary values remain API-synced after polling')
        for width, height in ((1920, 800), (390, 844)):
            await page.set_viewport_size({'width':width, 'height':height})
            await page.get_by_test_id('flow-summary').scroll_into_view_if_needed()
            await page.wait_for_timeout(250)
            bounds = await page.evaluate('''() => {
                const tiles = [...document.querySelectorAll('[data-testid="flow-summary"] > div')];
                const clipped = tiles.flatMap(tile => [...tile.querySelectorAll('[data-testid]')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.dataset.testid));
                const outside = [...document.querySelectorAll('[data-testid="flow-summary"] [data-testid]')].filter(el => { const r=el.getBoundingClientRect(); const t=el.closest('[data-testid="flow-summary"] > div').getBoundingClientRect(); return r.right > t.right + 1 || r.left < t.left - 1; }).map(el=>el.dataset.testid);
                return {viewport:innerWidth, document:document.documentElement.scrollWidth, clipped, outside};
            }''')
            assert bounds['document'] <= width, bounds
            assert not bounds['clipped'] and not bounds['outside'], bounds
            print(f'PASS: {width}x{height} no horizontal document overflow or summary clipping {bounds}')
            await page.screenshot(path=f'flow_summary_{width}.jpg', quality=40, full_page=False)
        error_text = await page.evaluate('''() => {
            const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
            return errorElements.map(el => el.textContent).join(', ');
        }''')
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        assert not errors, errors
        print('PASS: no browser runtime errors')
    except Exception as exc:
        print(f'FAIL: FlowSummary regression: {exc}')
        raise