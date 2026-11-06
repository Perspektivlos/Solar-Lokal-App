async def run_test(page, output_dir, page_url):
    from pathlib import Path
    try:
        namespace={}
        exec(Path('/app/tests/phase2_ui_acceptance.py').read_text().replace('-42.jpeg','-43.jpeg').replace('_42.json','_43.json'),namespace)
        results=await namespace['run'](page)
        print('EDGE TOTAL',sum(ok for _,ok in results),'/',len(results))
    except Exception as exc:
        print('FAIL edge runner',str(exc))
