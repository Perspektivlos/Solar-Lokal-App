"""Browser-only MOCKED unique DC source cadence against duplicate poll placeholders."""
import json
from pathlib import Path


async def run(page):
    base = page.url.split('/smartshunt-phase2')[0]
    points = []
    for poll, source in [(0, 0), (15, 0), (30, 30), (45, 30), (60, 60)]:
        duplicate = poll != source
        points.append({
            'ts': f'2026-01-01T00:00:{poll:02d}Z' if poll < 60 else '2026-01-01T00:01:00Z',
            'battery_source_ts': f'2026-01-01T00:00:{source:02d}Z' if source < 60 else '2026-01-01T00:01:00Z',
            'status': 'current', 'battery_dc_power_w': None if duplicate else -1000,
            'battery_voltage_v': None if duplicate else 52.5,
            'battery_soc_pct': None if duplicate else 70,
            'inverter_ac_power_w': 900,
        })
    async def history(route):
        await route.fulfill(json={'range':'6h', 'demo':True, 'points':points})
    results = []
    await page.route('**/api/smartshunt-phase2/history?*', history)
    try:
        for width, height in [(1920,800),(390,844)]:
            try:
                await page.set_viewport_size({'width':width,'height':height})
                await page.goto(base+'/smartshunt-phase2/verlauf')
                await page.get_by_test_id('phase2-history-refresh').wait_for()
                await page.wait_for_timeout(600)
                missing = []
                for chart in ['dc-ac','voltage-soc']:
                    paths = await page.get_by_test_id('phase2-chart-'+chart).locator('.recharts-line-curve').evaluate_all('(els)=>els.map(e=>e.getAttribute("d"))')
                    print('DUPLICATE PATHS',width,chart,paths)
                    assert len(paths)==2 and all('L' in p and p.count('M')==1 for p in paths), paths
                    if chart == 'dc-ac':
                        if len(paths)!=2 or 'L' not in paths[0]:
                            missing.append('DC: '+str(paths))
                    else:
                        if len(paths)!=2 or not all('L' in p for p in paths):
                            missing.append('V/SoC: '+str(paths))
                assert not missing, 'Valid unique source samples have no visible connecting segments: '+str(missing)
                results.append([str(width), True])
                print('PASS duplicate source chart',width)
            except Exception as exc:
                results.append([str(width), False])
                print('FAIL duplicate source chart',width,str(exc))
    finally:
        await page.unroute('**/api/smartshunt-phase2/history?*',history)
    Path('/app/test_reports/ui_duplicate_results_45.json').write_text(json.dumps(results,indent=2))
    return results