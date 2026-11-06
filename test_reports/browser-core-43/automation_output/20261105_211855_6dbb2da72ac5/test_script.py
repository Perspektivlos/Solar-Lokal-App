async def run_test(page, output_dir, page_url):
    import json
    from pathlib import Path
    try:
        namespace={}
        exec(Path('/app/tests/phase2_ui_review.py').read_text().replace('-42.jpeg','-43.jpeg'),namespace)
        results=await namespace['run'](page)
        Path('/app/test_reports/ui_core_results_43.json').write_text(json.dumps(results,indent=2))
        print('CORE TOTAL',sum(ok for _,ok in results),'/',len(results))
    except Exception as exc:
        print('FAIL core runner',str(exc))
