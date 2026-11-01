async def run_test(page, output_dir, page_url):
    await page.set_viewport_size({"width": 1920, "height": 800})
    try:
        await page.get_by_test_id('dashboard').wait_for(timeout=20000)
        print('PASS dashboard loads')
        print(await page.get_by_test_id('device-cards').inner_text())
        await page.screenshot(path='/app/test_reports/screenshots-metrics-34/automation_output/20261101_111905_fb1438a567ce/initial.jpeg', type="jpeg", quality=40, full_page=False)
        print('OVERFLOW', await page.evaluate('document.documentElement.scrollWidth > window.innerWidth'))
    except Exception as e:
        print('FAIL initial dashboard', str(e))
