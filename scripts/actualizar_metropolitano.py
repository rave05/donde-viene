#!/usr/bin/env python3
"""Actualiza desde el recurso oficial, conservando fecha y hash de la fuente."""
import json, re, subprocess, tempfile
from pathlib import Path
from urllib.parse import urlparse
from generar_metropolitano import generate

RESOURCE = 'https://catalogodatos.gub.uy/api/3/action/resource_show?id=9f44b654-751a-42a4-a481-af91b7c9a2e4'

def descargar(url):
    return subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '60', '--max-filesize', '50000000', url])

def main():
    metadata = json.loads(descargar(RESOURCE))
    if not metadata.get('success'): raise ValueError('Recurso MTOP no disponible')
    resource = metadata['result']; url = resource['url']; parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != 'catalogodatos.gub.uy' or not parsed.path.endswith('.zip'):
        raise ValueError('La fuente dejó de ser un ZIP oficial del catálogo')
    match = re.search(r'gtfs_(\d{4})(\d{2})(\d{2})\.zip$', parsed.path)
    source_date = '-'.join(match.groups()) if match else resource['last_modified'][:10]
    with tempfile.TemporaryDirectory() as folder:
        archive = Path(folder) / 'gtfs.zip'; archive.write_bytes(descargar(url))
        generate(archive, 'metropolitano/corredor.json', source_date)

if __name__ == '__main__': main()
