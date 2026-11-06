async def run_test(page, output_dir, page_url):
    import importlib.util
    try:
     spec=importlib.util.spec_from_file_location('phase2_edges','/app/tests/phase2_ui_acceptance.py')
     module=importlib.util.module_from_spec(spec)
     spec.loader.exec_module(module)
     await module.run(page)
    except Exception as e:
     print('FAIL edge runner',str(e))
