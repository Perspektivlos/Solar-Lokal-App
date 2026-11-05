# Public-URL device counter rendering, polling, daily-summary source and responsive layouts.
async def run(page):
    import re
    failures = []
    passed = 0
    live_responses = []
    today_responses = []
    runtime = []
    async def response_seen(response):
        try:
            if response.url.endswith('/api/live') and response.status == 200:
                live_responses.append(await response.json())
            if response.url.split('?')[0].endswith('/api/today') and 'day_offset=1' not in response.url and response.status == 200:
                today_responses.append(await response.json())
        except Exception:
            pass
    page.on('response', response_seen)
    page.on('pageerror', lambda error: runtime.append(str(error)))
    def check(ok, label):
        nonlocal passed
        if ok:
            passed += 1
            print('PASS '+label)
        else:
            failures.append(label)
            print('FAIL '+label)
    def number(text):
        return float(re.search(r'\d+(?:,\d+)?', text.replace('.', '')).group().replace(',', '.'))
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.reload()
        await page.get_by_test_id('dashboard').wait_for(timeout=30000)
        await page.wait_for_timeout(400)
        for size in [{'width':1920,'height':800}, {'width':390,'height':844}]:
            await page.set_viewport_size(size)
            previous = None
            for poll in range(3):
                if poll:
                    count = len(live_responses)
                    await page.wait_for_timeout(3400)
                    check(len(live_responses)>count, f'{size["width"]} poll {poll} live response')
                await page.wait_for_timeout(200)
                live = live_responses[-1]
                selectors = [(f'ahoy-ch-{c["ch"]}-yield-day', c['yield_day'],2) for c in live['ahoy']['channels']]
                selectors += [(f'victron-{m["id"]}-yield-day',m['yield_today'],2) for m in live['victron']['mppts']]
                selectors += [('trucki-yield-day',live['trucki']['day_energy_kwh'],2),('trucki-yield-total',live['trucki']['total_energy_kwh'],1)]
                current = []
                for testid, expected, decimals in selectors:
                    element = page.get_by_test_id(testid)
                    text = await element.inner_text()
                    value = number(text)
                    current.append(value)
                    check(await element.count()==1 and abs(value-expected)<=0.5*10**(-decimals)+0.000001 and 'NaN' not in text, f'{size["width"]} poll {poll} {testid}={text}')
                if previous:
                    check(all(b>=a for a,b in zip(previous,current)), f'{size["width"]} poll {poll} counters nondecreasing')
                previous = current
                pv = number(await page.get_by_test_id('summary-pv-value').inner_text())
                check(abs(pv-today_responses[-1]['pv_kwh'])<=0.005001, f'{size["width"]} summary uses today pv_kwh')
            check(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), f'{size["width"]} no document overflow')
            await page.get_by_test_id('card-ahoy').scroll_into_view_if_needed()
            await page.wait_for_timeout(900)
            await page.screenshot(path=f'/app/test_reports/screenshots-yield-38/ahoy-{size["width"]}.jpeg',quality=40,full_page=False)
            await page.get_by_test_id('card-trucki').scroll_into_view_if_needed()
            await page.wait_for_timeout(900)
            await page.screenshot(path=f'/app/test_reports/screenshots-yield-38/trucki-{size["width"]}.jpeg',quality=40,full_page=False)
        check(not runtime, f'No runtime errors: {runtime}')
        error_text = await page.evaluate("""() => {
const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
return errorElements.map(el => el.textContent).join(', ');
}""")
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        check(not error_text, 'No page error state')
        print('History testids:', await page.locator('[data-testid]').evaluate_all('(els)=>els.map(e=>e.dataset.testid).filter(s=>s.includes("nav"))'))
    except Exception as error:
        failures.append(str(error))
        print(f'FAIL UI runner: {error}')
    print(f'UI RESULTS: {passed} passed; {len(failures)} failed; {failures}')