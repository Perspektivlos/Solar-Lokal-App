"""Phase-2 history configuration contract through the public endpoint."""
import os
import requests


def test_history_grafana_config():
    response = requests.get(os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/api/config', timeout=30)
    assert response.status_code == 200
    config = response.json()
    assert isinstance(config['grafana_url'], str)
    assert config['grafana_url'].startswith(('http://', 'https://'))
    assert isinstance(config['demo_mode'], bool)
    assert '_id' not in config