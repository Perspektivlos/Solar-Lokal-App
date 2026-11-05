"""Run all collected backend cases in batches <=20; omit existing-data mutations explicitly."""
import json
import os
from pathlib import Path
import subprocess
import sys
from dotenv import dotenv_values

os.environ.update({k:v for k,v in dotenv_values('/app/frontend/.env').items() if v is not None})
os.environ['PYTHONPATH']='/app/backend'
root=Path('/app/test_reports/pytest')
iteration=os.environ['TEST_ITERATION']
root.mkdir(parents=True,exist_ok=True)
command=[sys.executable,'-m','pytest','/app/backend/tests','--collect-only','-q']
collected=subprocess.run(command,capture_output=True,text=True,cwd='/app/backend')
if collected.returncode:
    print(collected.stdout,collected.stderr)
    sys.exit(collected.returncode)
nodes=[line.strip() for line in collected.stdout.splitlines() if '.py::' in line]
unsafe_names={'test_put_config_persists_changes','test_demo_off_returns_data_with_offline',
              'test_config_nested_keys_and_partial_put','test_diagnostics',
              'test_diagnostics_run_structure','test_diagnostics_run_required_checks',
              'test_diagnostics_ok_field_types','test_diagnostics_backend_and_mongo_pass',
              'test_hoymiles_limit','test_trucki_zepc_on','test_control_endpoints'}
blocked=[n for n in nodes if n.split('::')[-1].split('[')[0] in unsafe_names or 'test_selftest_history.py::' in n or ('test_discovery_endpoints.py::' in n and 'test_unknown_device_404' not in n)]
safe=[n for n in nodes if n not in blocked]
manifest={'collected':len(nodes),'executed':len(safe),'not_executed_existing_data_safety':blocked,'batches':[]}
failed=False
for i in range(0,len(safe),20):
    batch=safe[i:i+20]
    xml=str(root/f'backend_acceptance_{iteration}_batch_{i//20+1}.xml')
    result=subprocess.run([sys.executable,'-m','pytest',*batch,'-q','--tb=short',f'--junitxml={xml}'],cwd='/app/backend')
    manifest['batches'].append({'junit':xml,'exit_code':result.returncode})
    failed=failed or bool(result.returncode)
Path(f'/app/test_reports/backend_manifest_{iteration}.json').write_text(json.dumps(manifest,indent=2))
print('COLLECTED',len(nodes),'EXECUTED',len(safe),'SAFETY_OMITTED',len(blocked))
sys.exit(1 if failed else 0)