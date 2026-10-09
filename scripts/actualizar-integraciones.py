"""Regenera datos locales oficiales. Uso: python3 scripts/actualizar-integraciones.py [direcciones|accesibilidad]."""
import argparse,csv,gzip,hashlib,io,json,pathlib,tempfile,unicodedata,urllib.request,zipfile
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAMP=datetime.now(timezone.utc).date().isoformat()
def descargar(url):
    req=urllib.request.Request(url,headers={'User-Agent':'DondeViene-datos/1.0 (https://rave05.github.io/donde-viene/)'})
    with urllib.request.urlopen(req,timeout=120) as response:return response.read()
def escribir(path,datos):
    payload=json.dumps(datos,ensure_ascii=False,separators=(',',':')).encode()
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(gzip.compress(payload,mtime=0) if path.suffix=='.gz' else payload)
def direcciones():
    import shapefile
    from pyproj import Transformer
    # El generador prepara el ZIP descargable en la ruta oficial.
    descargar('https://intgis.montevideo.gub.uy/sit/php/common/datos/generar_zip2.php?nom_tab=v_mdg_accesos&tipo=gis')
    raw=descargar('https://intgis.montevideo.gub.uy/sit/tmp/v_mdg_accesos.zip')
    transformar=Transformer.from_crs(32721,4326,always_xy=True)
    calles={}
    with tempfile.TemporaryDirectory(prefix='dv-direcciones-') as temp:
        z=zipfile.ZipFile(io.BytesIO(raw))
        # Solo componentes del SHP conocido; no extrae rutas arbitrarias del ZIP.
        for extension in ['shp','shx','dbf']:
            nombre=next(n for n in z.namelist() if pathlib.PurePosixPath(n).name=='v_mdg_accesos.'+extension)
            (pathlib.Path(temp)/('v_mdg_accesos.'+extension)).write_bytes(z.read(nombre))
        reader=shapefile.Reader(str(pathlib.Path(temp)/'v_mdg_accesos.shp'),encoding='utf8')
        for registro,shape in zip(reader.iterRecords(),reader.iterShapes()):
            r=registro.as_dict();nombre=r['NOM_CALLE'].strip();numero=r['NUM_PUERTA'];letra=r['LETRA'].strip()
            if not nombre or not numero or numero<1 or not shape.points:continue
            lon,lat=transformar.transform(*shape.points[0])
            if not(-35.05<=lat<=-34.65 and -56.45<=lon<=-55.90):continue
            clave=''.join(c for c in unicodedata.normalize('NFD',nombre) if not unicodedata.combining(c)).lower()
            calles.setdefault(clave,{'nombre':nombre,'puntos':set()})['puntos'].add((numero,letra,round(lat,6),round(lon,6)))
    if len(calles)<3000:raise RuntimeError('Fuente incompleta: no se sobrescriben los datos existentes')
    fragmentos=[{} for _ in range(64)];indice=[]
    for clave,v in sorted(calles.items()):
        shard=int(hashlib.sha256(clave.encode()).hexdigest()[:8],16)%64
        fragmentos[shard][clave]=sorted(v['puntos']);indice.append([clave,v['nombre'],shard])
    destino=ROOT/'datos'/'direcciones'
    for i,shard in enumerate(fragmentos):escribir(destino/f'{i:02d}.json.gz',shard)
    escribir(destino/'indice.json',{'version':STAMP.replace('-',''),'fuente':'https://ckan.montevideo.gub.uy/dataset/direcciones-oficiales-de-montevideo','licencia':'dag-uy','descargado':STAMP,'calles':indice})
    print(len(calles),'calles y',sum(len(v['puntos']) for v in calles.values()),'accesos')
def accesibilidad():
    raw=descargar('https://datos-abiertos.montevideo.gub.uy/accesibilidad_lugares.zip')
    z=zipfile.ZipFile(io.BytesIO(raw));name=next(n for n in z.namelist() if n.endswith('.csv'))
    payload=z.read(name)
    try:text=payload.decode('utf-8-sig')
    except UnicodeDecodeError:text=payload.decode('latin1')
    lugares=[]
    for r in csv.DictReader(io.StringIO(text)):
        try:lat,lon=map(float,r['Ubicación'].split(','))
        except (ValueError,KeyError):continue
        if not(-35.05<=lat<=-34.65 and -56.45<=lon<=-55.90):continue
        caracteristicas={k:r.get(k,'').strip()[:500] for k in ['Rampa','Escalones','Baños','Circulación accesible','Ascensor','Accesibilidad del entorno '] if r.get(k,'').strip()}
        lugares.append({'nombre':r['Título'],'direccion':r['Dirección'],'lat':lat,'lon':lon,'revisado':r['Fecha de modificación'],'caracteristicas':caracteristicas})
    if len(lugares)<20:raise RuntimeError('Fuente incompleta: no se sobrescriben los datos existentes')
    escribir(ROOT/'datos'/'accesibilidad-lugares.json',{'fuente':'https://ckan.montevideo.gub.uy/dataset/espacios-accesibles-de-montevideo','licencia':'dag-uy','descargado':STAMP,'lugares':lugares})
    print(len(lugares),'lugares con fecha de registro original')
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('fuente',choices=['direcciones','accesibilidad']);args=parser.parse_args()
    (direcciones if args.fuente=='direcciones' else accesibilidad)()
