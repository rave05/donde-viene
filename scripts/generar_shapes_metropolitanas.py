"""Geometrías oficiales por ID de variante; no aproxima calles con paradas."""
import json, math, sys, xml.etree.ElementTree as ET
from pathlib import Path
SOURCE = 'https://catalogodatos.gub.uy/dataset/3633b022-4fa8-4633-bf51-eb39f959ef8b/resource/ffc2dc6a-7ee6-4109-93d6-e45a5b0ea3a8/download/recorridos_metropolitanos.kml'
def distance(a,b): return math.hypot((a[0]-b[0])*111000,(a[1]-b[1])*91000)
def generate_shapes(kml, corridor, target):
    data=json.loads(Path(corridor).read_text()); ns={'k':'http://www.opengis.net/kml/2.2'}; shapes={}
    for pm in ET.parse(kml).findall('.//k:Placemark',ns):
        variant=pm.find('.//k:SimpleData[@name="Variante"]',ns)
        if variant is None: continue
        patterns=[p for p in data['patterns'] if p['routeId']==variant.text]
        if not patterns: continue
        segments=[[[round(float(c.split(',')[1]),6),round(float(c.split(',')[0]),6)] for c in el.text.split()] for el in pm.findall('.//k:LineString/k:coordinates',ns)]
        first=data['stops'][patterns[0]['stops'][0]]; start=[first['lat'],first['lon']]
        # Ordena fragmentos por sus extremos, sin unir discontinuidades de la fuente.
        shape=[]; point=start
        while segments:
            options=[(distance(point,s[0]),i,False) for i,s in enumerate(segments)]+[(distance(point,s[-1]),i,True) for i,s in enumerate(segments)]
            gap,i,reverse=min(options)
            if gap>200: raise ValueError('Geometría discontinua: '+variant.text)
            segment=segments.pop(i); segment=segment[::-1] if reverse else segment
            shape.extend(segment); point=shape[-1]
        for p in patterns:
            last=data['stops'][p['stops'][-1]]
            if distance(shape[-1],[last['lat'],last['lon']])>200: raise ValueError('Sentido incompatible: '+variant.text)
        shapes[variant.text]=shape
    if len(shapes)!=len({p['routeId'] for p in data['patterns']}): raise ValueError('Falta una variante oficial')
    Path(target).write_text(json.dumps({'source':SOURCE,'shapes':shapes},separators=(',',':'))+'\n')
if __name__=='__main__': generate_shapes(*sys.argv[1:4])
