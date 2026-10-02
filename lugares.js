(function () {
  'use strict';

  const lugares = [
    { nombre: 'Tres Cruces', categoria: 'terminal', consulta: 'Terminal Tres Cruces', aliases: ['Terminal Tres Cruces', 'Shopping Tres Cruces', 'Tres Cruces Shopping'] },
    { nombre: 'Montevideo Shopping', categoria: 'shopping', consulta: 'Montevideo Shopping', aliases: ['Montevideo Shopping Center'] },
    { nombre: 'Nuevocentro Shopping', categoria: 'shopping', consulta: 'Nuevocentro Shopping', aliases: ['Nuevo Centro', 'Nuevocentro'] },
    { nombre: 'Portones Shopping', categoria: 'shopping', consulta: 'Portones Shopping', aliases: ['Portones'] },
    { nombre: 'Punta Carretas Shopping', categoria: 'shopping', consulta: 'Punta Carretas Shopping', aliases: ['Shopping Punta Carretas'] },
    { nombre: 'Mercado Agrícola de Montevideo', categoria: 'mercado', consulta: 'Mercado Agrícola de Montevideo', aliases: ['Mercado Agricola', 'MAM'] },

    { nombre: 'Hospital de Clínicas', categoria: 'hospital', consulta: 'Hospital de Clínicas Dr. Manuel Quintela', aliases: ['Hospital de Clinicas', 'Clinicas'] },
    { nombre: 'Hospital Maciel', categoria: 'hospital', consulta: 'Hospital Maciel', aliases: ['Maciel'] },
    { nombre: 'Hospital Pereira Rossell', categoria: 'hospital', consulta: 'Hospital Pereira Rossell', aliases: ['Pereira Rossell'] },
    { nombre: 'Hospital Español', categoria: 'hospital', consulta: 'Hospital Español', aliases: ['Hospital Espanol'] },
    { nombre: 'Hospital Saint Bois', categoria: 'hospital', consulta: 'Hospital Saint Bois', aliases: ['Saint Bois'] },

    { nombre: 'Facultad de Ingeniería', categoria: 'facultad', consulta: 'Facultad de Ingeniería Udelar', aliases: ['Facultad de Ingenieria', 'FING'] },
    { nombre: 'Facultad de Derecho', categoria: 'facultad', consulta: 'Facultad de Derecho Udelar', aliases: ['Derecho Udelar'] },
    { nombre: 'Facultad de Medicina', categoria: 'facultad', consulta: 'Facultad de Medicina Udelar', aliases: ['Medicina Udelar'] },
    { nombre: 'Facultad de Psicología', categoria: 'facultad', consulta: 'Facultad de Psicología Udelar', aliases: ['Facultad de Psicologia', 'Psicologia Udelar'] },
    { nombre: 'Facultad de Ciencias Económicas', categoria: 'facultad', consulta: 'Facultad de Ciencias Económicas y de Administración Udelar', aliases: ['Facultad de Ciencias Economicas', 'FCEA'] },

    { nombre: 'Estadio Centenario', categoria: 'estadio', consulta: 'Estadio Centenario', aliases: ['Centenario'] },
    { nombre: 'Gran Parque Central', categoria: 'estadio', consulta: 'Gran Parque Central', aliases: ['Parque Central'] },
    { nombre: 'Estadio Campeón del Siglo', categoria: 'estadio', consulta: 'Estadio Campeón del Siglo', aliases: ['Campeon del Siglo'] },
    { nombre: 'Palacio Peñarol', categoria: 'estadio', consulta: 'Palacio Peñarol', aliases: ['Palacio Penarol'] },
    { nombre: 'Antel Arena', categoria: 'espectaculos', consulta: 'Antel Arena', aliases: ['Arena Antel'] },

    { nombre: 'Plaza Independencia', categoria: 'plaza', consulta: 'Plaza Independencia', aliases: [] },
    { nombre: 'Plaza Cagancha', categoria: 'plaza', consulta: 'Plaza de Cagancha', aliases: ['Plaza Libertad'] },
    { nombre: 'Plaza Zabala', categoria: 'plaza', consulta: 'Plaza Zabala', aliases: [] },
    { nombre: 'Plaza Seregni', categoria: 'plaza', consulta: 'Plaza Líber Seregni', aliases: ['Plaza Liber Seregni'] },
    { nombre: 'Plaza Matriz', categoria: 'plaza', consulta: 'Plaza Constitución Montevideo', aliases: ['Plaza Constitucion', 'Plaza Constitución'] },

    { nombre: 'Terminal Río Branco', categoria: 'terminal', consulta: 'Terminal Río Branco', aliases: ['Terminal Rio Branco', 'Rio Branco'] },
    { nombre: 'Terminal Colón', categoria: 'terminal', consulta: 'Terminal Colón Montevideo', aliases: ['Terminal Colon'] },
    { nombre: 'Terminal Paso de la Arena', categoria: 'terminal', consulta: 'Terminal Paso de la Arena', aliases: ['Paso de la Arena Terminal'] },

    { nombre: 'Intendencia de Montevideo', categoria: 'edificio-publico', consulta: 'Intendencia de Montevideo', aliases: ['IMM', 'Intendencia'] },
    { nombre: 'Palacio Legislativo', categoria: 'edificio-publico', consulta: 'Palacio Legislativo de Uruguay', aliases: ['Parlamento'] },
    { nombre: 'Teatro Solís', categoria: 'cultura', consulta: 'Teatro Solís', aliases: ['Teatro Solis'] },
    { nombre: 'Mercado del Puerto', categoria: 'mercado', consulta: 'Mercado del Puerto Montevideo', aliases: [] },
    { nombre: 'LATU', categoria: 'institucion', consulta: 'Laboratorio Tecnológico del Uruguay LATU', aliases: ['Laboratorio Tecnologico del Uruguay'] },
    { nombre: 'Parque Rodó', categoria: 'parque', consulta: 'Parque Rodó Montevideo', aliases: ['Parque Rodo'] },
    { nombre: 'Jardín Botánico', categoria: 'parque', consulta: 'Jardín Botánico de Montevideo', aliases: ['Jardin Botanico'] },
    { nombre: 'Villa Dolores', categoria: 'parque', consulta: 'Villa Dolores Montevideo', aliases: ['Zoológico Villa Dolores', 'Zoo Villa Dolores'] }
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
