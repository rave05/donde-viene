"""Actualiza datos estáticos: python3 scripts/actualizar-datos.py [recargas|caminatas].
Solo se ejecuta al mantener el repositorio; los usuarios no consultan Overpass.
"""
import csv, gzip, io, json, math, sys, urllib.request, urllib.parse, zipfile
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
STAMP=datetime.now(timezone.utc).isoformat()
def download(url, data=None):
    req=urllib.request.Request(url,data=data,headers={'User-Agent':'DondeViene-datos/1.0 (https://rave05.github.io/donde-viene/)','Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req,timeout=180) as r:return r.read()
def save(name,data):
    (ROOT/'datos').mkdir(exist_ok=True)
    payload=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode('utf8')
    if name.endswith('.gz'):(ROOT/'datos'/name).write_bytes(gzip.compress(payload,compresslevel=9,mtime=0))
    else:(ROOT/'datos'/name).write_bytes(payload)
if sys.argv[1]=='recargas':
    url='https://datos-abiertos.montevideo.gub.uy/Locales_recargas_stm.zip'
    content=download(url)
    Path('/tmp/recargas-stm.zip').write_bytes(content)
    z=zipfile.ZipFile(io.BytesIO(content))
    from pyproj import Transformer
    transformar=Transformer.from_crs('EPSG:32721','EPSG:4326',always_xy=True)
    locales=[]
    for name in z.namelist():
        if not name.lower().endswith('.csv'):continue
        raw=z.read(name)
        try:text=raw.decode('utf-8-sig')
        except UnicodeDecodeError:text=raw.decode('latin1')
        for row in csv.DictReader(io.StringIO(text),delimiter=';'):
            try:lon,lat=transformar.transform(float(row['X']),float(row['Y']))
            except (ValueError,KeyError):continue
            if not (-35.1<lat<-34.3 and -56.8<lon<-55.5):continue
            locales.append({'id':str(len(locales)+1),'nombre':row['NOMBRE'].strip(),'direccion':row['DIRECCION'].strip(),'horarios':row['HORARIOS'].strip(),'telefono':row['TELEFONOS'].strip(),'servicio':row['TIPO_SERVICIO'].strip(),'lat':round(lat,6),'lon':round(lon,6)})
    if len(locales)<20:raise RuntimeError('Datos de recarga incompletos')
    save('recargas-stm.json',{'version':1,'actualizado':STAMP,'fuente':url,'licencia':'DAG Uruguay','locales':locales})
    print('Recargas:',len(locales),'locales. Muestra:',locales[:2])
else:
    import osmium
    source='https://download.geofabrik.de/south-america/uruguay-latest.osm.pbf'
    pbf=Path('/tmp/donde-viene-uruguay.osm.pbf')
    if not pbf.exists(): pbf.write_bytes(download(source))
    nodes=[];lookup={};edges=set();blocked=set()
    class Red(osmium.SimpleHandler):
        def node(self,n):
            if n.tags.get('foot') in ('no','private') or n.tags.get('access') in ('no','private'):
                blocked.add(n.id)
        def way(self,w):
            tags=dict(w.tags)
            if not tags.get('highway') or tags['highway'] in ('motorway','motorway_link','trunk','trunk_link','construction','proposed','raceway') or tags.get('area')=='yes':return
            if tags.get('foot') in ('no','private'):return
            if tags.get('access') in ('no','private') and tags.get('foot') not in ('yes','designated','permissive'):return
            # Las restricciones peatonales de sentido requieren un grafo dirigido.
            # Se omiten esos pocos segmentos antes de ofrecer una ruta incorrecta.
            if tags.get('oneway:foot') in ('yes','-1') or tags.get('foot:forward')=='no' or tags.get('foot:backward')=='no':return
            seq=[]
            for n in w.nodes:
                if not n.location.valid(): seq.append(None);continue
                lat,lon=n.lat,n.lon
                if not(-34.97<=lat<=-34.68 and -56.45<=lon<=-55.93) or n.ref in blocked:seq.append(None);continue
                if n.ref not in lookup:lookup[n.ref]=len(nodes);nodes.append([round(lat,6),round(lon,6)])
                seq.append(lookup[n.ref])
            for a,b in zip(seq,seq[1:]):
                if a is not None and b is not None and a!=b:edges.add((min(a,b),max(a,b)))
    Red().apply_file(str(pbf),locations=True)
    if len(nodes)<1000:raise RuntimeError('Extracto incompleto')
    save('caminatas.json.gz',{'version':1,'actualizado':STAMP,'source':source,'creditos':'OpenStreetMap contributors / Geofabrik','licencia':'ODbL-1.0','bbox':[-34.97,-56.45,-34.68,-55.93],'nodes':nodes,'edges':sorted(edges)})
    print('Red peatonal:',len(nodes),'nodos,',len(edges),'segmentos')
