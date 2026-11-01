async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width": 1920, "height": 800})
        await page.get_by_test_id('history-page').wait_for(timeout=20000)
        print('PASS: History page loads')
        await page.get_by_test_id('vp-balance').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-balance-37/automation_output/20261101_162310_46c623cfad6d/initial.jpeg', type="jpeg", quality=40, full_page=False)
        print('Test IDs:', await page.locator('[data-testid]').evaluate_all('(els) => els.map(e => e.dataset.testid)'))
    except Exception as e:
        print('FAIL: initial page load', str(e))
