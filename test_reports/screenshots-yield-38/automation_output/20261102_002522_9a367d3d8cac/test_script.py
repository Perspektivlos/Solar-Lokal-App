async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width":1920,"height":800})
        await page.get_by_test_id('dashboard').wait_for(timeout=30000)
        print('PASS dashboard loaded')
        print(await page.locator('[data-testid*="yield"]').evaluate_all('(els)=>els.map(e=>({id:e.dataset.testid,text:e.textContent}))'))
        await page.screenshot(path='/app/test_reports/screenshots-yield-38/automation_output/20261102_002522_9a367d3d8cac/initial.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as e:
        print(f'FAIL initial load: {e}')
