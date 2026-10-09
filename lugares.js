(function () {
  'use strict';

  // Coordenadas revisadas el 2026-10-02. Datos © colaboradores de OpenStreetMap (ODbL 1.0).
  // https://www.openstreetmap.org/copyright
  // Puntos del edificio/predio; no representan cada entrada o puerta del recinto.
  const lugares = [
    // Puntos de parada publicados por MTOP, no centros de localidades.
    { nombre: 'Las Piedras (San Luis y Washington)', categoria: 'terminal', lat: -34.71778, lon: -56.19388, fuente: 'https://catalogodatos.gub.uy/dataset/ministerio-de-transporte-y-obras-publicas-horarios-de-omnibus-en-lineas-interdepartamentales', consulta: 'Las Piedras (San Luis y Washington)', aliases: ['Las Piedras', 'Terminal Las Piedras', 'Las Piedras centro'] },
    { nombre: 'Las Piedras · San Francisco (Borrazas y Elías Regules)', categoria: 'terminal', lat: -34.69755, lon: -56.21495, fuente: 'https://catalogodatos.gub.uy/dataset/ministerio-de-transporte-y-obras-publicas-horarios-de-omnibus-en-lineas-interdepartamentales', consulta: 'Las Piedras · San Francisco (Borrazas y Elías Regules)', aliases: ['Las Piedras San Francisco', 'Terminal San Francisco'] },
    { nombre: 'Tres Cruces', categoria: 'terminal', lat: -34.8938334, lon: -56.1665762, fuente: 'https://www.openstreetmap.org/way/56393958', consulta: 'Terminal Tres Cruces', aliases: ['Terminal Tres Cruces', 'Shopping Tres Cruces', 'Tres Cruces Shopping'] },
    { nombre: 'Montevideo Shopping', categoria: 'shopping', lat: -34.9030628, lon: -56.1363655, fuente: 'https://www.openstreetmap.org/way/37684509', consulta: 'Montevideo Shopping', aliases: ['Montevideo Shopping Center'] },
    { nombre: 'Nuevocentro Shopping', categoria: 'shopping', lat: -34.8688546, lon: -56.1697834, fuente: 'https://www.openstreetmap.org/way/243502545', consulta: 'Nuevocentro Shopping', aliases: ['Nuevo Centro', 'Nuevocentro'] },
    { nombre: 'Portones Shopping', categoria: 'shopping', lat: -34.8812008, lon: -56.0808727, fuente: 'https://www.openstreetmap.org/way/1418459306', consulta: 'Portones Shopping', aliases: ['Portones'] },
    { nombre: 'Punta Carretas Shopping', categoria: 'shopping', lat: -34.9239559, lon: -56.1585930, fuente: 'https://www.openstreetmap.org/way/81796454', consulta: 'Punta Carretas Shopping', aliases: ['Shopping Punta Carretas'] },
    { nombre: 'Mercado Agrícola de Montevideo', categoria: 'mercado', lat: -34.8869732, lon: -56.1834097, fuente: 'https://www.openstreetmap.org/way/231952139', consulta: 'Mercado Agrícola de Montevideo', aliases: ['Mercado Agricola', 'MAM'] },

    { nombre: 'Hospital de Clínicas', categoria: 'hospital', lat: -34.8915348, lon: -56.1517800, fuente: 'https://www.openstreetmap.org/way/37514653', consulta: 'Hospital de Clínicas Dr. Manuel Quintela', aliases: ['Hospital de Clinicas', 'Clinicas'] },
    { nombre: 'Hospital Maciel', categoria: 'hospital', lat: -34.9083534, lon: -56.2118645, fuente: 'https://www.openstreetmap.org/way/905392238', consulta: 'Hospital Maciel', aliases: ['Maciel'] },
    { nombre: 'Hospital Pereira Rossell', categoria: 'hospital', lat: -34.8986985, lon: -56.1628577, fuente: 'https://www.openstreetmap.org/way/156270380', consulta: 'Hospital Pereira Rossell', aliases: ['Pereira Rossell'] },
    { nombre: 'Hospital Español', categoria: 'hospital', lat: -34.8750288, lon: -56.1814005, fuente: 'https://www.openstreetmap.org/way/251822831', consulta: 'Hospital Español', aliases: ['Hospital Espanol'] },
    { nombre: 'Hospital Saint Bois', categoria: 'hospital', lat: -34.7881126, lon: -56.2411163, fuente: 'https://www.openstreetmap.org/way/270163664', consulta: 'Hospital Saint Bois', aliases: ['Saint Bois'] },

    { nombre: 'Facultad de Ingeniería', categoria: 'facultad', lat: -34.9185853, lon: -56.1666396, fuente: 'https://www.openstreetmap.org/way/37355537', consulta: 'Facultad de Ingeniería Udelar', aliases: ['Facultad de Ingenieria', 'FING'] },
    { nombre: 'Facultad de Derecho', categoria: 'facultad', lat: -34.9026218, lon: -56.1765357, fuente: 'https://www.openstreetmap.org/way/56382400', consulta: 'Facultad de Derecho Udelar', aliases: ['Derecho Udelar'] },
    { nombre: 'Facultad de Medicina', categoria: 'facultad', lat: -34.8881744, lon: -56.1863796, fuente: 'https://www.openstreetmap.org/way/70407061', consulta: 'Facultad de Medicina Udelar', aliases: ['Medicina Udelar'] },
    { nombre: 'Facultad de Psicología', categoria: 'facultad', lat: -34.8994572, lon: -56.1786158, fuente: 'https://www.openstreetmap.org/way/226021442', consulta: 'Facultad de Psicología Udelar', aliases: ['Facultad de Psicologia', 'Psicologia Udelar'] },
    { nombre: 'Facultad de Ciencias Económicas', categoria: 'facultad', lat: -34.9123845, lon: -56.1731960, fuente: 'https://www.openstreetmap.org/way/209110122', consulta: 'Facultad de Ciencias Económicas y de Administración Udelar', aliases: ['Facultad de Ciencias Economicas', 'FCEA'] },

    { nombre: 'Estadio Centenario', categoria: 'estadio', lat: -34.8945392, lon: -56.1526841, fuente: 'https://www.openstreetmap.org/relation/2512517', consulta: 'Estadio Centenario', aliases: ['Centenario'] },
    { nombre: 'Gran Parque Central', categoria: 'estadio', lat: -34.8844576, lon: -56.1587294, fuente: 'https://www.openstreetmap.org/way/37578954', consulta: 'Gran Parque Central', aliases: ['Parque Central'] },
    { nombre: 'Estadio Campeón del Siglo', categoria: 'estadio', lat: -34.7979283, lon: -56.0662552, fuente: 'https://www.openstreetmap.org/way/591439203', consulta: 'Estadio Campeón del Siglo', aliases: ['Campeon del Siglo'] },
    { nombre: 'Palacio Peñarol', categoria: 'estadio', lat: -34.8988920, lon: -56.1827163, fuente: 'https://www.openstreetmap.org/way/179739488', consulta: 'Palacio Peñarol', aliases: ['Palacio Penarol'] },
    { nombre: 'Antel Arena', categoria: 'espectaculos', lat: -34.8629854, lon: -56.1535615, fuente: 'https://www.openstreetmap.org/way/283022176', consulta: 'Antel Arena', aliases: ['Arena Antel'] },

    { nombre: 'Plaza Independencia', categoria: 'plaza', lat: -34.9064755, lon: -56.1997577, fuente: 'https://www.openstreetmap.org/way/36001728', consulta: 'Plaza Independencia', aliases: [] },
    { nombre: 'Plaza Cagancha', categoria: 'plaza', lat: -34.9062185, lon: -56.1913394, fuente: 'https://www.openstreetmap.org/relation/7943089', consulta: 'Plaza de Cagancha', aliases: ['Plaza Libertad'] },
    { nombre: 'Plaza Zabala', categoria: 'plaza', lat: -34.9076019, lon: -56.2081314, fuente: 'https://www.openstreetmap.org/way/77848372', consulta: 'Plaza Zabala', aliases: [] },
    { nombre: 'Plaza Seregni', categoria: 'plaza', lat: -34.8968836, lon: -56.1719081, fuente: 'https://www.openstreetmap.org/way/205233712', consulta: 'Plaza Líber Seregni', aliases: ['Plaza Liber Seregni'] },
    { nombre: 'Plaza Matriz', categoria: 'plaza', lat: -34.9065843, lon: -56.2035494, fuente: 'https://www.openstreetmap.org/way/36001749', consulta: 'Plaza Constitución Montevideo', aliases: ['Plaza Constitucion', 'Plaza Constitución'] },

    { nombre: 'Terminal Río Branco', categoria: 'terminal', lat: -34.9001731, lon: -56.1971876, fuente: 'https://www.openstreetmap.org/way/38742656', consulta: 'Terminal Río Branco', aliases: ['Terminal Rio Branco', 'Rio Branco'] },
    { nombre: 'Terminal Colón', categoria: 'terminal', lat: -34.7995396, lon: -56.2223665, fuente: 'https://www.openstreetmap.org/way/332130134', consulta: 'Terminal Colón Montevideo', aliases: ['Terminal Colon'] },
    // Ubicación contrastada con OSM way/270104521 y la parada STM 4135.
    { nombre: 'Terminal Paso de la Arena', categoria: 'terminal', lat: -34.83496, lon: -56.27568, fuente: 'https://www.openstreetmap.org/way/270104521', consulta: 'Terminal de Ómnibus Paso de la Arena', aliases: ['Paso de la Arena Terminal', 'Terminal de Paso de la Arena', 'Terminal de Ómnibus Paso de la Arena'] },

    { nombre: 'Intendencia de Montevideo', categoria: 'edificio-publico', lat: -34.9065941, lon: -56.1860929, fuente: 'https://www.openstreetmap.org/way/38761156', consulta: 'Intendencia de Montevideo', aliases: ['IMM', 'Intendencia'] },
    { nombre: 'Palacio Legislativo', categoria: 'edificio-publico', lat: -34.8912113, lon: -56.1871749, fuente: 'https://www.openstreetmap.org/relation/20800840', consulta: 'Palacio Legislativo de Uruguay', aliases: ['Parlamento'] },
    { nombre: 'Teatro Solís', categoria: 'cultura', lat: -34.9078788, lon: -56.2010001, fuente: 'https://www.openstreetmap.org/relation/16099422', consulta: 'Teatro Solís', aliases: ['Teatro Solis'] },
    { nombre: 'Mercado del Puerto', categoria: 'mercado', lat: -34.9056495, lon: -56.2117422, fuente: 'https://www.openstreetmap.org/way/179066483', consulta: 'Mercado del Puerto Montevideo', aliases: [] },
    { nombre: 'LATU', categoria: 'institucion', lat: -34.8789915, lon: -56.0764017, fuente: 'https://www.openstreetmap.org/way/220619938', consulta: 'Laboratorio Tecnológico del Uruguay LATU', aliases: ['Laboratorio Tecnologico del Uruguay'] },
    { nombre: 'Parque Rodó', categoria: 'parque', lat: -34.9155643, lon: -56.1675704, fuente: 'https://www.openstreetmap.org/way/36807838', consulta: 'Parque Rodó Montevideo', aliases: ['Parque Rodo'] },
    { nombre: 'Jardín Botánico', categoria: 'parque', lat: -34.8593556, lon: -56.2004612, fuente: 'https://www.openstreetmap.org/way/205233646', consulta: 'Jardín Botánico de Montevideo', aliases: ['Jardin Botanico'] },
    { nombre: 'Villa Dolores', categoria: 'parque', lat: -34.9007158, lon: -56.1452772, fuente: 'https://www.openstreetmap.org/way/82094010', consulta: 'Villa Dolores Montevideo', aliases: ['Zoológico Villa Dolores', 'Zoo Villa Dolores'] }
  ];

  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  const indice = new Map();

  for (const lugar of lugares) {
    for (const nombre of [
      lugar.nombre,
      lugar.consulta,
      ...(lugar.aliases || [])
    ]) {
      const clave = normalizar(nombre);
      if (clave && !indice.has(clave)) {
        indice.set(clave, lugar);
      }
    }
  }

  window.LUGARES_MONTEVIDEO = lugares;

  window.buscarLugarMontevideo = function (texto) {
    const clave = normalizar(texto);

    if (!clave) {
      return null;
    }

    if (indice.has(clave)) {
      return indice.get(clave);
    }

    if (clave.length >= 5) {
      const coincidencias =
        lugares.filter(lugar =>
          [
            lugar.nombre,
            lugar.consulta,
            ...(lugar.aliases || [])
          ]
            .map(normalizar)
            .some(opcion =>
              opcion.startsWith(clave) ||
              clave.startsWith(opcion)
            )
        );

      if (coincidencias.length === 1) {
        return coincidencias[0];
      }
    }

    return null;
  };
})();
