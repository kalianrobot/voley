// Torneos: crear un torneo nuevo (modal y confirmación).

/* ---------- Acciones sobre un torneo ---------- */

function getTorneo(id) {
  return state.torneos[id];
}

function updateTorneo(id, updater, opts) {
  return update(prev => {
    const actual = prev.torneos[id];
    if (!actual) return prev;
    const nuevo = typeof updater === 'function' ? updater(actual) : updater;
    return { ...prev, torneos: { ...prev.torneos, [id]: nuevo } };
  }, opts);
}

function nuevaCompeticionBorrador(categoria) {
  const numEquipos = 8;
  const numGrupos = sugerirNumGrupos(numEquipos);
  return {
    categoria,
    numEquipos,
    equiposNombres: Array(numEquipos).fill(''),
    numGrupos,
    numPartidosGrupo: sugerirNumPartidos(numEquipos, numGrupos),
    clasificadosPorGrupo: sugerirClasificados()
  };
}

// competiciones tiene SIEMPRE 2 entradas aunque el modo sea 'uno': así no se pierde
// lo ya escrito en la segunda si el usuario alterna entre uno y dos torneos.
function openNewTorneoModal() {
  newTorneoData = {
    nombre: '',
    modo: 'uno',
    fechaInicio: '',
    fechaFin: '',
    puntosPorSet: PUNTOS_POR_SET_DEFAULT,
    puntosMaximo: PUNTOS_MAXIMO_DEFAULT,
    numSets: NUM_SETS_DEFAULT,
    numCampos: NUM_CAMPOS_DEFAULT,
    duracionPartidoMin: DURACION_PARTIDO_DEFAULT,
    comidaInicio: '',
    comidaFin: '',
    competiciones: [nuevaCompeticionBorrador('mixto'), nuevaCompeticionBorrador('masculino')]
  };
  showNewTorneoModal = true;
  render();
}

function closeNewTorneoModal() {
  showNewTorneoModal = false;
  render();
}

function competicionesActivas(d) {
  return d.competiciones.slice(0, d.modo === 'dos' ? 2 : 1);
}

// Campos "no controlados": se guardan en el borrador sin forzar un render,
// igual que setLugar(), para no perder el foco mientras se escribe.
function setTorneoField(field, value) {
  newTorneoData[field] = value;
}

function setTorneoCompField(i, field, value) {
  newTorneoData.competiciones[i][field] = value;
}

function setTorneoEquipoNombre(i, j, value) {
  newTorneoData.competiciones[i].equiposNombres[j] = value;
}

// El desplegable de categoría hace doble función: elegir categoría o activar el
// modo de dos torneos simultáneos.
function setTorneoTipo(value) {
  if (value === 'dos') {
    newTorneoData.modo = 'dos';
  } else {
    newTorneoData.modo = 'uno';
    newTorneoData.competiciones[0].categoria = value;
  }
  render();
}

// numGrupos/clasificadosPorGrupo sí necesitan render (afectan a los desplegables y a
// las sugerencias). Ambos campos son <select> con solo opciones válidas (potencias de
// 2), así que grupos × clasificados siempre da una potencia de 2 automáticamente.
function setTorneoNumGrupos(i, value) {
  const comp = newTorneoData.competiciones[i];
  comp.numGrupos = Math.max(1, parseInt(value, 10) || 1);
  // Al cambiar el número de grupos puede que "clasificados" ya no quepa en el grupo
  // más pequeño (p.ej. 4 clasificados con grupos de 2 equipos): se ajusta al mayor
  // valor válido disponible.
  const opciones = opcionesClasificados(comp.numEquipos, comp.numGrupos);
  if (!opciones.includes(comp.clasificadosPorGrupo)) {
    comp.clasificadosPorGrupo = opciones[opciones.length - 1];
  }
  render();
}

function setTorneoClasificados(i, value) {
  newTorneoData.competiciones[i].clasificadosPorGrupo = Math.max(1, parseInt(value, 10) || 1);
  render();
}

function setTorneoNumPartidos(i, value) {
  newTorneoData.competiciones[i].numPartidosGrupo = Math.max(0, parseInt(value, 10) || 0);
}

function setTorneoPuntosPorSet(value) {
  newTorneoData.puntosPorSet = Math.max(1, parseInt(value, 10) || PUNTOS_POR_SET_DEFAULT);
}

function setTorneoPuntosMaximo(value) {
  newTorneoData.puntosMaximo = Math.max(1, parseInt(value, 10) || PUNTOS_MAXIMO_DEFAULT);
}

function setTorneoNumSets(value) {
  newTorneoData.numSets = Math.max(1, parseInt(value, 10) || NUM_SETS_DEFAULT);
}

function setTorneoNumCampos(value) {
  newTorneoData.numCampos = Math.max(1, parseInt(value, 10) || NUM_CAMPOS_DEFAULT);
}

function setTorneoDuracionPartido(value) {
  newTorneoData.duracionPartidoMin = Math.max(1, parseInt(value, 10) || DURACION_PARTIDO_DEFAULT);
}

// Los nombres de equipo no se re-renderizan al escribir, así que hay que leerlos
// del DOM antes de rehacer la lista con el nuevo tamaño.
function onNumEquiposChangeTorneo(i, value) {
  const comp = newTorneoData.competiciones[i];
  const nombresCapturados = (comp.equiposNombres || []).map((n, j) => {
    const el = document.getElementById(`torneo-${i}-equipo-${j}`);
    return el ? el.value : n;
  });
  const numEquipos = Math.max(2, parseInt(value, 10) || 0);
  const numGrupos = sugerirNumGrupos(numEquipos);
  newTorneoData.competiciones[i] = {
    ...comp,
    numEquipos,
    equiposNombres: Array.from({ length: numEquipos }, (_, j) => nombresCapturados[j] || ''),
    numGrupos,
    clasificadosPorGrupo: sugerirClasificados(),
    numPartidosGrupo: sugerirNumPartidos(numEquipos, numGrupos)
  };
  render();
}

async function confirmNewTorneo() {
  const d = newTorneoData;
  const nombre = (d.nombre || '').trim();
  if (!nombre) { alert('Debes indicar un nombre para el torneo'); return; }
  if (!d.fechaInicio || !d.fechaFin) { alert('Debes indicar fecha y hora de inicio y de fin'); return; }
  if (d.fechaFin <= d.fechaInicio) { alert('La fecha de fin debe ser posterior a la de inicio'); return; }
  const errorComida = validarComida(d.comidaInicio, d.comidaFin);
  if (errorComida) { alert(errorComida); return; }

  const activas = competicionesActivas(d);
  const dos = activas.length > 1;

  for (let i = 0; i < activas.length; i++) {
    const nombres = (activas[i].equiposNombres || []).map(n => (n || '').trim());
    if (nombres.length < 2 || nombres.some(n => !n)) {
      alert(dos
        ? `Torneo ${i + 1} (${activas[i].categoria}): debes indicar el nombre de todos los equipos`
        : 'Debes indicar el nombre de todos los equipos');
      return;
    }
  }

  const validacion = validarTorneoModal(d);
  if (!validacion.valid) {
    alert(validacion.error.replace('⚠️ ', ''));
    return;
  }

  const bloqueId = dos ? uid() : null;
  const torneos = activas.map((comp, i) => emptyTorneo({
    nombre,
    categoria: comp.categoria,
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin,
    puntosPorSet: d.puntosPorSet,
    puntosMaximo: d.puntosMaximo,
    numSets: d.numSets,
    numCampos: d.numCampos,
    duracionPartidoMin: d.duracionPartidoMin,
    comidaInicio: d.comidaInicio || null,
    comidaFin: d.comidaFin || null,
    equipos: comp.equiposNombres.map(n => newEquipo(n.trim())),
    numGrupos: comp.numGrupos,
    numPartidosGrupo: comp.numPartidosGrupo,
    clasificadosPorGrupo: comp.clasificadosPorGrupo,
    bloqueId,
    ordenBloque: i
  }));

  const resultado = await update(prev => {
    const mapa = { ...prev.torneos };
    torneos.forEach(t => { mapa[t.id] = t; });
    return { ...prev, torneos: mapa };
  });
  if (!resultado) return; // el guardado falló (ya se ha avisado); no navegar a un torneo que no se ha creado
  showNewTorneoModal = false;
  openTorneo(torneos[0].id);
}
