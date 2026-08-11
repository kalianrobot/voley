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

function init() {
  loading = true;
  const today = new Date();
  view = { screen: 'calendar', calYear: today.getFullYear(), calMonth: today.getMonth() };
  render();

  DOC_REF.onSnapshot(
    (snap) => {
      if (saving) return;
      let remote = emptyState();
      if (snap.exists) {
        const data = snap.data();
        try {
          remote = sanitizeState(JSON.parse(data.data));
        } catch (e) {
          console.error('Error parseando datos de Firestore', e);
          remote = emptyState();
        }
      }

      const activeFocus = document.activeElement;
      const isTyping = activeFocus && activeFocus.tagName === 'INPUT';

      if (loading) {
        state = remote;
        loading = false;
        const fechaUrl = getFechaFromUrl();
        if (fechaUrl && state.listas[fechaUrl]) {
          view = { screen: 'list', fecha: fechaUrl };
        }
        render();
        return;
      }

      if (isTyping) return;
      if (JSON.stringify(state) === JSON.stringify(remote)) return;
      state = remote;
      render();
    },
    (err) => {
      console.error('Error escuchando Firestore', err);
      if (loading) {
        state = emptyState();
        loading = false;
        render();
      }
    }
  );
}

init();
