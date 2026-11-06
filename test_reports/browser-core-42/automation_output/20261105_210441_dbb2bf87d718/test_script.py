async def run_test(page, output_dir, page_url):
    import importlib.util
    import json
    from pathlib import Path
    try:
     spec=importlib.util.spec_from_file_location('phase2_ui','/app/tests/phase2_ui_review.py')
     module=importlib.util.module_from_spec(spec)
     spec.loader.exec_module(module)
     results=await module.run(page)
     Path('/app/test_reports/ui_core_results_42.json').write_text(json.dumps(results,indent=2))
     print('CORE RESULTS SAVED',len(results))
    except Exception as e:
     print('FAIL saved UI runner',str(e))
