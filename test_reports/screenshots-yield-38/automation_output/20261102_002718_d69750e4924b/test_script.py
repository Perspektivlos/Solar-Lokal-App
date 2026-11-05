async def run_test(page, output_dir, page_url):
    namespace = {}
    exec(compile(open('/app/tests/demo_yield_ui_regression.py').read(), 'demo_yield_ui_regression.py', 'exec'), namespace)
    await namespace['run'](page)
