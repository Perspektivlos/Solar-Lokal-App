"""Browser-only MOCKED chart barriers and independent AC regression, no DB writes."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.async_api import expect


def point(poll, source, status='current', missing=False):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {'ts': (start+timedelta(seconds=poll)).isoformat(),
            'battery_source_ts': (start+timedelta(seconds=source)).isoformat() if source is not None else None,
            'status': status, 'battery_dc_power_w': None if missing else -1000,
            'battery_voltage_v': None if missing else 52.5,
            'battery_soc_pct': None if missing else 70, 'inverter_ac_power_w': 900}


async def run(page):
    base = page.url.split('/smartshunt-phase2')[0]
    results = []
    cases = [
        ('stale', [point(0,0),point(15,15),point(30,15,'stale',True),point(45,45),point(60,60)], [2,1,2,2]),
        ('unavailable', [point(0,0),point(15,15),point(30,15,'unavailable',True),point(45,45),point(60,60)], [2,1,2,2]),
        ('new-source-missing', [point(0,0),point(15,15),point(30,30,missing=True),point(45,45),point(60,60)], [2,1,2,2]),
        ('no-source-missing', [point(0,0),point(15,15),point(30,None,missing=True),point(45,45),point(60,60)], [2,1,2,2]),
        ('source-gap-601-independent-AC', [point(0,0),point(15,15),point(30,616),point(45,631)], [2,1,2,2]),
        ('source-gap-600-boundary', [point(0,0),point(15,15),point(30,615),point(45,630)], [1,1,1,1]),
        ('poll-gap-601', [point(0,0),point(15,15),point(616,616),point(631,631)], [2,2,2,2]),
        ('poll-gap-600-boundary', [point(0,0),point(15,15),point(615,615),point(630,630)], [1,1,1,1]),
    ]
    for width,height in [(1920,800),(390,844)]:
        await page.set_viewport_size({'width':width,'height':height})
        for label,points,expected in cases:
            async def history(route,request,points=points):
                await route.fulfill(json={'range':'6h','demo':True,'points':points})
            await page.route('**/api/smartshunt-phase2/history?*',history)
            try:
                await page.goto(base+'/smartshunt-phase2/verlauf')
                await expect(page.get_by_test_id('phase2-history-refresh')).to_be_enabled()
                await page.wait_for_timeout(300)
                paths=[]
                for chart in ['dc-ac','voltage-soc']:
                    paths.extend(await page.get_by_test_id('phase2-chart-'+chart).locator('.recharts-line-curve').evaluate_all('(els)=>els.map(e=>e.getAttribute("d"))'))
                counts=[p.count('M') for p in paths]
                assert counts==expected, (counts,expected,paths)
                assert all('L' in p for p in paths), paths
                print('PASS',width,label,counts)
                results.append([str(width)+'-'+label,True])
            except Exception as exc:
                print('FAIL',width,label,str(exc))
                results.append([str(width)+'-'+label,False,str(exc)])
            finally:
                await page.unroute('**/api/smartshunt-phase2/history?*',history)
    Path('/app/test_reports/ui_barrier_results_45.json').write_text(json.dumps(results,indent=2))
    return results