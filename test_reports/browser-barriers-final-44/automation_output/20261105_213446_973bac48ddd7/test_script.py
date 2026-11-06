async def run_test(page, output_dir, page_url):
    from pathlib import Path
    scope={}
    source=Path('/app/tests/phase2_chart_barriers_review.py').read_text()
    print('LOADED HANDLER',[line for line in source.splitlines() if 'async def history' in line])
    source=source.replace('async def history(route,points=points):','async def history(route,request,points=points):')
    exec(compile(source,'/app/tests/phase2_chart_barriers_review.py','exec'),scope)
    try:
        results=await scope['run'](page)
        print('FINAL BARRIERS',results)
    except Exception as exc:print('FAIL BARRIERS',str(exc))
    error_text=await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(", ");}""")
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
