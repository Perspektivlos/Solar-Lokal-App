async def run_test(page, output_dir, page_url):
    try:
        namespace = {}
        exec(compile(open('/app/tests/day_balance_ui_regression.py').read(), '/app/tests/day_balance_ui_regression.py', 'exec'), namespace)
        await namespace['run'](page)
    except Exception as e:
        print('FAIL runner execution:', str(e))
