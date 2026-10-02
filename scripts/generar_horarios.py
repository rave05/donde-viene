#!/usr/bin/env python3
import csv, json, re, sys, zipfile
from collections import defaultdict
from pathlib import Path

def rows(zf, name):
    with zf.open(name) as raw:
        yield from csv.DictReader(line.decode("utf-8-sig") for line in raw)

def gtfs_seconds(value):
    try:
        h, m, s = str(value).strip().split(":")
        return int(h) * 3600 + int(m) * 60 + int(s)
    except Exception:
        return None

def safe_name(value):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(value).strip()) or "linea"

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Uso: python scripts/generar_horarios.py google_transit.zip horarios")

    zip_path = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path) as zf:
        names = set(zf.namelist())

        stop_alias = {}
        stop_coords = {}
        for r in rows(zf, "stops.txt"):
            sid = str(r.get("stop_id", "")).strip()
            code = str(r.get("stop_code", "")).strip()
            if sid:
                stop_alias[sid] = code or sid
                try:
                    stop_coords[sid] = (
                        float(r.get("stop_lat", "")),
                        float(r.get("stop_lon", ""))
                    )
                except Exception:
                    pass

        route_line = {}
        for r in rows(zf, "routes.txt"):
            rid = str(r.get("route_id", "")).strip()
            line = str(r.get("route_short_name", "")).strip()
            if rid and line:
                route_line[rid] = line

        trips = {}
        line_services = defaultdict(set)
        for r in rows(zf, "trips.txt"):
            trip_id = str(r.get("trip_id", "")).strip()
            route_id = str(r.get("route_id", "")).strip()
            service_id = str(r.get("service_id", "")).strip()
            line = route_line.get(route_id)
            if not trip_id or not line or not service_id:
                continue
            trips[trip_id] = {
                "line": line,
                "service_id": service_id,
                "destination": str(r.get("trip_headsign", "")).strip() or "SIN DESTINO",
                "shape_id": str(r.get("shape_id", "")).strip(),
            }
            line_services[line].add(service_id)

        data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(set))))
        trip_stops = defaultdict(list)
        for r in rows(zf, "stop_times.txt"):
            info = trips.get(str(r.get("trip_id", "")).strip())
            if not info:
                continue
            stop_id = str(r.get("stop_id", "")).strip()
            stop_key = stop_alias.get(stop_id, stop_id)
            sec = gtfs_seconds(r.get("arrival_time") or r.get("departure_time"))
            if not stop_key or sec is None:
                continue
            line = info["line"]
            dest = info["destination"]
            service = info["service_id"]

            try:
                stop_sequence = int(r.get("stop_sequence", "0"))
            except Exception:
                stop_sequence = len(trip_stops[str(r.get("trip_id", "")).strip()])

            trip_stops[str(r.get("trip_id", "")).strip()].append(
                (stop_sequence, stop_key)
            )
            data[line][stop_key][dest][service].add(sec)
            if stop_id and stop_id != stop_key:
                data[line][stop_id][dest][service].add(sec)

        shapes = defaultdict(list)
        if "shapes.txt" in names:
            for r in rows(zf, "shapes.txt"):
                shape_id = str(r.get("shape_id", "")).strip()
                if not shape_id:
                    continue
                try:
                    lat = float(r.get("shape_pt_lat", ""))
                    lon = float(r.get("shape_pt_lon", ""))
                    seq = int(r.get("shape_pt_sequence", "0"))
                except Exception:
                    continue
                shapes[shape_id].append((seq, lat, lon))

            for shape_id in shapes:
                shapes[shape_id].sort(key=lambda item: item[0])

        services = {}
        if "calendar.txt" in names:
            for r in rows(zf, "calendar.txt"):
                sid = str(r.get("service_id", "")).strip()
                if not sid:
                    continue
                services[sid] = {
                    "start": str(r.get("start_date", "")),
                    "end": str(r.get("end_date", "")),
                    "days": "".join(str(r.get(day, "0")) for day in [
                        "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
                    ])
                }

        exceptions = defaultdict(lambda: {"add": [], "remove": []})
        if "calendar_dates.txt" in names:
            for r in rows(zf, "calendar_dates.txt"):
                sid = str(r.get("service_id", "")).strip()
                date = str(r.get("date", "")).strip()
                kind = str(r.get("exception_type", "")).strip()
                if sid and date:
                    if kind == "1":
                        exceptions[date]["add"].append(sid)
                    elif kind == "2":
                        exceptions[date]["remove"].append(sid)

    # Índice liviano parada -> líneas/destinos para que la web pueda
    # mostrar servicios programados aunque no haya vehículos en vivo.
    stop_index = defaultdict(dict)
    for line, stops in data.items():
        for stop, destinations in stops.items():
            for destination in destinations.keys():
                key = f"{line}|{destination}"
                stop_index[stop][key] = {
                    "line": line,
                    "destination": destination,
                    "programmedOnly": True
                }

    manifest = {"generated": True, "lines": {}}

    for line in sorted(data):
        filename = safe_name(line) + ".json"
        manifest["lines"][line] = filename
        used = line_services.get(line, set())

        payload = {
            "line": line,
            "services": {sid: services[sid] for sid in used if sid in services},
            "exceptions": {},
            "stops": {}
        }

        for date, item in exceptions.items():
            add = [sid for sid in item["add"] if sid in used]
            remove = [sid for sid in item["remove"] if sid in used]
            if add or remove:
                payload["exceptions"][date] = {"add": add, "remove": remove}

        for stop, destinations in data[line].items():
            payload["stops"][stop] = {
                dest: {sid: sorted(times) for sid, times in by_service.items()}
                for dest, by_service in destinations.items()
            }

        (out / filename).write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8"
        )

    (out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )

    paradas_payload = {
        stop: list(entries.values())
        for stop, entries in stop_index.items()
    }

    (out / "paradas.json").write_text(
        json.dumps(paradas_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )

    # Recorridos compactos por línea para dibujar el tramo elegido
    # en el mapa sin procesar shapes.txt en el navegador.
    recorridos_out = out.parent / "recorridos"
    recorridos_out.mkdir(parents=True, exist_ok=True)

    recorridos_manifest = {"generated": True, "lines": {}}
    patterns_by_line = defaultdict(list)
    seen_patterns = set()

    for trip_id, info in trips.items():
        shape_id = info.get("shape_id")
        if not shape_id or shape_id not in shapes:
            continue

        ordered_stops = [
            stop_key
            for _, stop_key in sorted(
                trip_stops.get(trip_id, []),
                key=lambda item: item[0]
            )
        ]

        if len(ordered_stops) < 2:
            continue

        key = (
            info["line"],
            info["destination"],
            shape_id,
            tuple(ordered_stops)
        )

        if key in seen_patterns:
            continue

        seen_patterns.add(key)

        points = shapes[shape_id]
        # Muestreo liviano: conserva extremos y reduce shapes muy densos.
        step = max(1, len(points) // 700)
        sampled = [
            [round(lat, 6), round(lon, 6)]
            for _, lat, lon in points[::step]
        ]
        if points and sampled[-1] != [
            round(points[-1][1], 6),
            round(points[-1][2], 6)
        ]:
            sampled.append([
                round(points[-1][1], 6),
                round(points[-1][2], 6)
            ])

        patterns_by_line[info["line"]].append({
            "destination": info["destination"],
            "stops": ordered_stops,
            "shape": sampled
        })

    for line, patterns in patterns_by_line.items():
        filename = safe_name(line) + ".json"
        recorridos_manifest["lines"][line] = filename
        (recorridos_out / filename).write_text(
            json.dumps(
                {"line": line, "patterns": patterns},
                ensure_ascii=False,
                separators=(",", ":")
            ),
            encoding="utf-8"
        )

    (recorridos_out / "manifest.json").write_text(
        json.dumps(
            recorridos_manifest,
            ensure_ascii=False,
            separators=(",", ":")
        ),
        encoding="utf-8"
    )

    print(
        f"Generadas {len(manifest['lines'])} lineas, "
        f"{len(paradas_payload)} paradas y "
        f"{len(recorridos_manifest['lines'])} recorridos en {out.parent}"
    )

if __name__ == "__main__":
    main()
