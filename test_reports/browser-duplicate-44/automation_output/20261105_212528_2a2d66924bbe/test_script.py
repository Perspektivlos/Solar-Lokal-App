async def run_test(page, output_dir, page_url):
    import sys, json
    from pathlib import Path
    sys.path.insert(0,'/app/tests')
    import phase2_duplicate_chart_review
    try:
        results=await phase2_duplicate_chart_review.run(page)
        Path('/app/test_reports/ui_duplicate_results_44.json').write_text(json.dumps(results,indent=2))
        print('RESULTS',results)
        await page.screenshot(path='/app/test_reports/browser-duplicate-44/automation_output/20261105_212528_2a2d66924bbe/duplicate-mobile-44.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as exc:
        print('FAIL',str(exc))
    error_text = await page.evaluate("""() => { const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]')); return errorElements.map(el => el.textContent).join(", "); }""")
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
