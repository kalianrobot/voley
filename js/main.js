// Normalización de datos (saneado de lo leído de Firestore) y arranque de la app.

function sanitizeLista(l) {
  const lugar = (l && typeof l.lugar === 'string') ? l.lugar : '';
  const redesRaw = (l && Array.isArray(l.redes)) ? l.redes : [];

  // Migración: recoger esperas antiguas por red y subirlas al nivel de lista
  const esperaHeredada = redesRaw.flatMap(r => Array.isArray(r.espera) ? r.espera : []);
  const esperaPropia = Array.isArray(l && l.espera) ? l.espera : [];
  const espera = [...esperaPropia, ...esperaHeredada].sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const redes = redesRaw.map((r, i) => ({
    id: r.id || uid(),
    numero: r.numero || (i + 1),
    materiales: {
      balon: (r.materiales && r.materiales.balon) || '',
      red: (r.materiales && r.materiales.red) || '',
      lineas: (r.materiales && r.materiales.lineas) || ''
    },
    jugadores: Array.isArray(r.jugadores) ? r.jugadores : [],
    creatorOwner: r.creatorOwner || null
  }));
  const historial = Array.isArray(l && l.historial) ? l.historial : [];
  return { lugar, espera, redes, historial };
}

function sanitizeEquipo(e) {
  return { id: (e && e.id) || uid(), nombre: (e && typeof e.nombre === 'string') ? e.nombre : '' };
}

function sanitizeGrupo(g) {
  return {
    id: (g && g.id) || uid(),
    nombre: (g && typeof g.nombre === 'string') ? g.nombre : '',
    equipos: (g && Array.isArray(g.equipos)) ? g.equipos.map(sanitizeEquipo) : []
  };
}

function sanitizePuntos(v) {
  return (typeof v === 'number' && !isNaN(v)) ? v : null;
}

function sanitizePartidoGrupo(p) {
  return {
    id: (p && p.id) || uid(),
    grupoId: (p && p.grupoId) || null,
    ronda: (p && typeof p.ronda === 'number') ? p.ronda : 0,
    equipoA: sanitizeEquipo(p && p.equipoA),
    equipoB: sanitizeEquipo(p && p.equipoB),
    puntosA: sanitizePuntos(p && p.puntosA),
    puntosB: sanitizePuntos(p && p.puntosB),
    campo: (p && typeof p.campo === 'number') ? p.campo : null,
    horaInicio: (p && typeof p.horaInicio === 'string') ? p.horaInicio : null,
    arbitro: (p && p.arbitro) ? sanitizeEquipo(p.arbitro) : null
  };
}

function sanitizeSet(s) {
  return { puntosA: sanitizePuntos(s && s.puntosA), puntosB: sanitizePuntos(s && s.puntosB) };
}

function sanitizePartidoEliminatoria(p, i, numSets) {
  const setsRaw = (p && Array.isArray(p.sets)) ? p.sets : [];
  const sets = Array.from({ length: numSets }, (_, idx) => sanitizeSet(setsRaw[idx]));
  return {
    id: (p && p.id) || uid(),
    slotIndex: (p && typeof p.slotIndex === 'number') ? p.slotIndex : i,
    equipoA: (p && p.equipoA) ? sanitizeEquipo(p.equipoA) : null,
    equipoB: (p && p.equipoB) ? sanitizeEquipo(p.equipoB) : null,
    sets,
    ganadorId: (p && p.ganadorId) || null
  };
}

function sanitizeEliminatoria(e, numSets) {
  if (!e || !Array.isArray(e.rondas)) return null;
  const rondas = e.rondas.map(r => ({
    nombre: (r && typeof r.nombre === 'string') ? r.nombre : '',
    partidos: (r && Array.isArray(r.partidos)) ? r.partidos.map((p, i) => sanitizePartidoEliminatoria(p, i, numSets)) : []
  }));
  return { rondas };
}

function sanitizeTorneo(t) {
  const equipos = (t && Array.isArray(t.equipos)) ? t.equipos.map(sanitizeEquipo) : [];
  const numSets = (t && typeof t.numSets === 'number') ? t.numSets : NUM_SETS_DEFAULT;
  return {
    id: (t && t.id) || uid(),
    nombre: (t && typeof t.nombre === 'string') ? t.nombre : '',
    categoria: (t && CATEGORIAS_TORNEO.includes(t.categoria)) ? t.categoria : 'mixto',
    fechaInicio: (t && typeof t.fechaInicio === 'string') ? t.fechaInicio : '',
    fechaFin: (t && typeof t.fechaFin === 'string') ? t.fechaFin : '',
    puntosPorSet: (t && typeof t.puntosPorSet === 'number') ? t.puntosPorSet : PUNTOS_POR_SET_DEFAULT,
    puntosMaximo: (t && typeof t.puntosMaximo === 'number') ? t.puntosMaximo : PUNTOS_MAXIMO_DEFAULT,
    // Si el torneo es de antes de que esto fuera configurable por separado,
    // el fallback es el propio puntosPorSet/puntosMaximo del torneo (no la
    // constante global), para no cambiarle el comportamiento a nadie que ya
    // tuviera un torneo en marcha.
    puntosPorSetEliminatoria: (t && typeof t.puntosPorSetEliminatoria === 'number')
      ? t.puntosPorSetEliminatoria
      : ((t && typeof t.puntosPorSet === 'number') ? t.puntosPorSet : PUNTOS_POR_SET_DEFAULT),
    puntosMaximoEliminatoria: (t && typeof t.puntosMaximoEliminatoria === 'number')
      ? t.puntosMaximoEliminatoria
      : ((t && typeof t.puntosMaximo === 'number') ? t.puntosMaximo : PUNTOS_MAXIMO_DEFAULT),
    numSets,
    numCampos: (t && typeof t.numCampos === 'number') ? t.numCampos : NUM_CAMPOS_DEFAULT,
    duracionPartidoMin: (t && typeof t.duracionPartidoMin === 'number') ? t.duracionPartidoMin : DURACION_PARTIDO_DEFAULT,
    comidaInicio: (t && typeof t.comidaInicio === 'string') ? t.comidaInicio : null,
    comidaFin: (t && typeof t.comidaFin === 'string') ? t.comidaFin : null,
    equipos,
    numGrupos: (t && typeof t.numGrupos === 'number') ? t.numGrupos : 1,
    numPartidosGrupo: (t && typeof t.numPartidosGrupo === 'number') ? t.numPartidosGrupo : 0,
    clasificadosPorGrupo: (t && typeof t.clasificadosPorGrupo === 'number') ? t.clasificadosPorGrupo : 2,
    bloqueId: (t && typeof t.bloqueId === 'string') ? t.bloqueId : null,
    ordenBloque: (t && typeof t.ordenBloque === 'number') ? t.ordenBloque : 0,
    grupos: (t && Array.isArray(t.grupos)) ? t.grupos.map(sanitizeGrupo) : null,
    sorteoConfirmado: !!(t && t.sorteoConfirmado),
    partidosGrupo: (t && Array.isArray(t.partidosGrupo)) ? t.partidosGrupo.map(sanitizePartidoGrupo) : [],
    eliminatoria: sanitizeEliminatoria(t && t.eliminatoria, numSets),
    creatorOwner: (t && t.creatorOwner) || null,
    historial: (t && Array.isArray(t.historial)) ? t.historial : []
  };
}

function sanitizeState(s) {
  if (!s || typeof s !== 'object') {
    return emptyState();
  }
  const listas = {};
  if (s.listas && typeof s.listas === 'object') {
    Object.keys(s.listas).forEach(fecha => {
      listas[fecha] = sanitizeLista(s.listas[fecha]);
    });
  }
  const torneos = {};
  if (s.torneos && typeof s.torneos === 'object') {
    Object.keys(s.torneos).forEach(id => {
      torneos[id] = sanitizeTorneo(s.torneos[id]);
    });
  }
  return { listas, torneos };
}

function getFechaFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fecha = params.get('fecha');
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  } catch (e) {
    // ignorar
  }
  return null;
}

// Permite compartir el enlace de un torneo concreto (para gente externa al
// grupo que no tiene por qué ver las listas de partidos diarios) con
// ?torneo=<id>: entra directo a su vista sin pasar por el calendario.
function getTorneoIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('torneo') || null;
  } catch (e) {
    return null;
  }
}

// Consulta de rango que enumera todos los documentos de 'volea' cuyo ID
// empieza por `prefijo` (torneo-, dia-). Truco estándar de Firestore para
// simular "empieza por": '' es un carácter muy alto en el orden
// lexicográfico, así que sirve de límite superior.
function rangoPrefijo(prefijo) {
  return DOC_REF.parent
    .where(firebase.firestore.FieldPath.documentId(), '>=', prefijo)
    .where(firebase.firestore.FieldPath.documentId(), '<', prefijo + '\uf8ff');
}

// Migración de una sola vez: si todavía no hay ningún documento torneo-*/
// dia-*, reparte el contenido del documento histórico volea/lista-actual en
// un documento por torneo y por lista. lista-actual no se borra ni se
// modifica en ningún caso: queda como copia de seguridad permanente de todo
// lo anterior a este cambio. La escritura es un único batch atómico (todo o
// nada), así que "hay algún documento migrado" es una señal fiable de
// "migración completa" sin necesitar un documento marca aparte.
async function migrarSiHaceFalta() {
  const [torneosSnap, diasSnap] = await Promise.all([
    rangoPrefijo(PREFIJO_TORNEO).limit(1).get(),
    rangoPrefijo(PREFIJO_DIA).limit(1).get()
  ]);
  if (!torneosSnap.empty || !diasSnap.empty) return; // ya migrado

  const viejoSnap = await DOC_REF.get();
  if (!viejoSnap.exists) return; // no había nada que migrar

  let viejo;
  try {
    viejo = sanitizeState(JSON.parse(viejoSnap.data().data));
  } catch (e) {
    console.error('Error leyendo el documento antiguo para migrar', e);
    return;
  }

  const entradas = [
    ...Object.keys(viejo.torneos).map(id => ({ ref: torneoRef(id), datos: viejo.torneos[id] })),
    ...Object.keys(viejo.listas).map(fecha => ({ ref: listaRef(fecha), datos: viejo.listas[fecha] }))
  ];
  if (entradas.length === 0) return;

  if (entradas.length > 500) {
    // Límite de un batch de Firestore: mejor no migrar nada que migrar a
    // medias. Muy improbable a la escala de este club.
    console.error(`Migración abortada: ${entradas.length} documentos superan el límite de un batch atómico.`);
    alert('⚠️ No se ha podido migrar la base de datos automáticamente (demasiados torneos/listas). Avisa para revisarlo a mano.');
    return;
  }

  const batch = db.batch();
  entradas.forEach(e => batch.set(e.ref, { data: JSON.stringify(e.datos) }));
  await batch.commit();
  console.log(`Migración completada: ${entradas.length} documentos creados a partir de ${DOC_REF.path}.`);
}

// Engancha un listener en tiempo real sobre todos los documentos con el
// prefijo dado y mantiene state[clave] al día. estaGuardando/marcarListo
// distinguen guardados propios en curso (para no pisar el cambio optimista)
// de la primera carga (para saber cuándo dejar de mostrar "Cargando…").
function escucharPorPrefijo(clave, prefijo, sanear, estaGuardando, marcarListo, comprobarPrimeraCarga) {
  rangoPrefijo(prefijo).onSnapshot(
    snap => {
      if (estaGuardando()) { marcarListo(); comprobarPrimeraCarga(); return; }

      const mapa = {};
      snap.forEach(doc => {
        const id = doc.id.slice(prefijo.length);
        try {
          mapa[id] = sanear(JSON.parse(doc.data().data));
        } catch (e) {
          console.error(`Error parseando ${clave}`, doc.id, e);
        }
      });

      if (!loading) {
        const activeFocus = document.activeElement;
        const isTyping = activeFocus && activeFocus.tagName === 'INPUT';
        if (isTyping) return;
        if (JSON.stringify(state[clave]) === JSON.stringify(mapa)) return;
      }

      state = { ...(state || emptyState()), [clave]: mapa };
      marcarListo();
      if (loading) comprobarPrimeraCarga(); else render();
    },
    err => {
      console.error(`Error escuchando ${clave}`, err);
      marcarListo();
      comprobarPrimeraCarga();
    }
  );
}

function engancharListeners() {
  let torneosListos = false;
  let diasListos = false;

  function comprobarPrimeraCarga() {
    if (!loading || !torneosListos || !diasListos) return;
    loading = false;
    const torneoUrl = getTorneoIdFromUrl();
    const fechaUrl = getFechaFromUrl();
    if (torneoUrl && state.torneos[torneoUrl]) {
      view = { screen: 'torneo', torneoId: torneoUrl };
      entradaPorEnlaceTorneo = true;
    } else if (fechaUrl && state.listas[fechaUrl]) {
      view = { screen: 'list', fecha: fechaUrl };
    }
    render();
  }

  escucharPorPrefijo('torneos', PREFIJO_TORNEO, sanitizeTorneo, () => savingTorneos, () => { torneosListos = true; }, comprobarPrimeraCarga);
  escucharPorPrefijo('listas', PREFIJO_DIA, sanitizeLista, () => savingListas, () => { diasListos = true; }, comprobarPrimeraCarga);
}

// Solo se arranca la app (y se conecta a Firestore) si la URL lleva la ruta
// secreta (ver RUTA_SECRETA en core.js); cualquier otra ruta, incluida la
// raíz, se queda en blanco.
function rutaValida() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path === RUTA_SECRETA;
}

function init() {
  if (!rutaValida()) return;

  loading = true;
  const today = new Date();
  view = { screen: 'calendar', calYear: today.getFullYear(), calMonth: today.getMonth() };
  render();

  migrarSiHaceFalta()
    .catch(err => console.error('Error migrando a documentos por entidad', err))
    .finally(() => engancharListeners());
}

init();
