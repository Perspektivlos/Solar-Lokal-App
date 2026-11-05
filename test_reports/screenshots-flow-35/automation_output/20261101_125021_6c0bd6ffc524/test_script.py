async def run_test(page, output_dir, page_url):
    await page.set_viewport_size({'width': 1920, 'height': 1080})
    try:
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-flow-35/automation_output/20261101_125021_6c0bd6ffc524/initial.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS frontend loads; flow panel visible')
        print(await page.evaluate("({segments:document.querySelectorAll('[data-testid^=flow-segments-]').length,fonts:[...document.fonts].filter(f=>f.family.includes('DSEG')).map(f=>({family:f.family,status:f.status}))})"))
    except Exception as e:
        print('FAIL initial frontend:',str(e))
