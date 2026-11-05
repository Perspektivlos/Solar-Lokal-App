async def run_test(page, output_dir, page_url):
    try:
        namespace = {}
        exec(compile(open('/app/tests/smartshunt_ui_review.py').read(), 'smartshunt_ui_review.py', 'exec'), namespace)
        await namespace['run'](page)
    except Exception as e:
        print(f'FAIL runner: {e}')
