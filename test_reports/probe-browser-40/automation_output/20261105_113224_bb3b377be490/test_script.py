async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width":1920,"height":1080})
        await page.get_by_test_id('smartshunt-preview-page').wait_for(timeout=20000)
        print('PASS frontend loaded')
        print(await page.locator('[data-testid]').evaluate_all('(els)=>els.map(e=>e.dataset.testid).filter(s=>s.includes("tab"))'))
        await page.screenshot(path='/app/test_reports/probe-browser-40/automation_output/20261105_113224_bb3b377be490/probe-initial.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as e:
        print(f'FAIL load: {e}')
