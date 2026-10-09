#!/usr/bin/env python3
"""Extrae el piloto Las Piedras–Montevideo; conserva tiempos ausentes sin interpolar."""
import csv, hashlib, json, sys, zipfile
from collections import defaultdict
from pathlib import Path

SOURCE = 'https://catalogodatos.gub.uy/dataset/ministerio-de-transporte-y-obras-publicas-horarios-de-omnibus-en-lineas-interdepartamentales/resource/9f44b654-751a-42a4-a481-af91b7c9a2e4'

def rows(z, name):
    with z.open(name) as stream:
        yield from csv.DictReader(line.decode('utf-8-sig') for line in stream)

def seconds(value):
    if not value: return None
    h, m, s = map(int, value.split(':'))
    if h < 0 or not 0 <= m < 60 or not 0 <= s < 60: raise ValueError('Hora GTFS inválida')
    return h * 3600 + m * 60 + s

def generate(path, target, source_date):
    with zipfile.ZipFile(path) as z:
        agencies = {r['agency_id']: {'name': r['agency_name'], 'url': r['agency_url']} for r in rows(z, 'agency.txt')}
        # El nombre de la terminal no describe todas las localidades atendidas.
        # Elegimos las secuencias que realmente pasan por el área del piloto.
        all_stops = {r['stop_id']: r for r in rows(z, 'stops.txt')}
        def in_corridor(s):
            return -34.79 <= float(s['stop_lat']) <= -34.66 and -56.25 <= float(s['stop_lon']) <= -56.15
        routes = {r['route_id']: r for r in rows(z, 'routes.txt') if 'MDEO' in r['route_long_name'].upper()}
        trips = {r['trip_id']: r for r in rows(z, 'trips.txt') if r['route_id'] in routes}
        times = defaultdict(list)
        for r in rows(z, 'stop_times.txt'):
            if r['trip_id'] in trips:
                times[r['trip_id']].append((int(r['stop_sequence']), r['stop_id'], seconds(r['departure_time'] or r['arrival_time'])))
        patterns, index, used = [], {}, set()
        for tid, trip in trips.items():
            ordered = sorted(times[tid])
            if len(ordered) < 2: continue
            sequence = [r[1] for r in ordered]
            if not any(in_corridor(all_stops[s]) for s in sequence): continue
            if not any(float(all_stops[s]['stop_lat']) < -34.79 for s in sequence): continue
            timed = [r[2] for r in ordered]
            known = [t for t in timed if t is not None]
            if not known or known != sorted(known): raise ValueError('Secuencia horaria inválida: ' + tid)
            key = (trip['route_id'], tuple(sequence))
            if key not in index:
                route = routes[trip['route_id']]
                index[key] = len(patterns)
                patterns.append({'routeId': route['route_id'], 'line': route['route_short_name'], 'name': route['route_long_name'].replace('MDEO.', 'Montevideo').replace('LAS PIEDRAS', 'Las Piedras'), 'agency': agencies[route['agency_id']], 'stops': sequence, 'trips': []})
            patterns[index[key]]['trips'].append({'id': tid, 'service': trip['service_id'], 'times': timed})
            used.update(sequence)
        stops = {}
        for r in rows(z, 'stops.txt'):
            if r['stop_id'] in used:
                lat, lon = float(r['stop_lat']), float(r['stop_lon'])
                if not (-35.1 < lat < -33.5 and -57 < lon < -55): raise ValueError('Coordenadas fuera del corredor')
                stops[r['stop_id']] = {'id': 'mtop:' + r['stop_id'], 'name': r['stop_name'], 'description': r['stop_desc'], 'lat': lat, 'lon': lon}
        services = {r['service_id']: r for r in rows(z, 'calendar.txt')}
        exceptions = list(rows(z, 'calendar_dates.txt')) if 'calendar_dates.txt' in z.namelist() else []
        data = {'source': SOURCE, 'sourceDate': source_date, 'sha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(), 'scope': 'Piloto Las Piedras–Montevideo', 'services': services, 'exceptions': exceptions, 'stops': stops, 'patterns': patterns}
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        Path(target).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        print(json.dumps({'routes': len({p['routeId'] for p in patterns}), 'patterns': len(patterns), 'trips': sum(len(p['trips']) for p in patterns), 'stops': len(stops), 'bytes': Path(target).stat().st_size}))

if __name__ == '__main__':
    generate(*sys.argv[1:4])
