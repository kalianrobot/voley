// Torneos: editar un torneo ya creado (modal y confirmación).

/* ---------- Edición de un torneo ya creado ---------- */

function openEditarTorneoModal(torneoId) {
  const torneo = getTorneo(torneoId);
  if (!torneo) return;
  editTorneoData = {
    torneoId,
    nombre: torneo.nombre,
    fechaInicio: torneo.fechaInicio,
    fechaFin: torneo.fechaFin,
    puntosPorSet: torneo.puntosPorSet,
    puntosMaximo: torneo.puntosMaximo,
    numSets: torneo.numSets,
    numCampos: torneo.numCampos,
    duracionPartidoMin: torneo.duracionPartidoMin,
    comidaInicio: torneo.comidaInicio || '',
    comidaFin: torneo.comidaFin || '',
    equipos: torneo.equipos.map(e => ({ ...e })),
    numGrupos: torneo.numGrupos,
    clasificadosPorGrupo: torneo.clasificadosPorGrupo,
    numPartidosGrupo: torneo.numPartidosGrupo
  };
  showEditarTorneoModal = true;
  render();
}

function closeEditarTorneoModal() {
  showEditarTorneoModal = false;
  render();
}

// Campos "no controlados": igual que en el modal de creación, no fuerzan render para
// no perder el foco mientras se escribe.
function setEditTorneoField(field, value) {
  editTorneoData[field] = value;
}

function setEditTorneoEquipoNombre(idx, value) {
  editTorneoData.equipos[idx].nombre = value;
}

function reclamarGruposYClasificadosEdit() {
  const opcionesG = opcionesNumGrupos(editTorneoData.equipos.length);
  if (!opcionesG.includes(editTorneoData.numGrupos)) {
    editTorneoData.numGrupos = opcionesG[opcionesG.length - 1];
  }
  const opcionesC = opcionesClasificados(editTorneoData.equipos.length, editTorneoData.numGrupos);
  if (!opcionesC.includes(editTorneoData.clasificadosPorGrupo)) {
    editTorneoData.clasificadosPorGrupo = opcionesC[opcionesC.length - 1];
  }
}

function setEditTorneoNumGrupos(value) {
  editTorneoData.numGrupos = Math.max(1, parseInt(value, 10) || 1);
  const opciones = opcionesClasificados(editTorneoData.equipos.length, editTorneoData.numGrupos);
  if (!opciones.includes(editTorneoData.clasificadosPorGrupo)) {
    editTorneoData.clasificadosPorGrupo = opciones[opciones.length - 1];
  }
  render();
}

function setEditTorneoClasificados(value) {
  editTorneoData.clasificadosPorGrupo = Math.max(1, parseInt(value, 10) || 1);
  render();
}

function setEditTorneoNumPartidos(value) {
  editTorneoData.numPartidosGrupo = Math.max(0, parseInt(value, 10) || 0);
}

function setEditTorneoPuntosPorSet(value) {
  editTorneoData.puntosPorSet = Math.max(1, parseInt(value, 10) || PUNTOS_POR_SET_DEFAULT);
}

function setEditTorneoPuntosMaximo(value) {
  editTorneoData.puntosMaximo = Math.max(1, parseInt(value, 10) || PUNTOS_MAXIMO_DEFAULT);
}

function setEditTorneoNumSets(value) {
  editTorneoData.numSets = Math.max(1, parseInt(value, 10) || NUM_SETS_DEFAULT);
}

function setEditTorneoNumCampos(value) {
  editTorneoData.numCampos = Math.max(1, parseInt(value, 10) || NUM_CAMPOS_DEFAULT);
}

function setEditTorneoDuracionPartido(value) {
  editTorneoData.duracionPartidoMin = Math.max(1, parseInt(value, 10) || DURACION_PARTIDO_DEFAULT);
}

function addEditTorneoEquipo() {
  editTorneoData.equipos.push({ id: null, nombre: '' });
  reclamarGruposYClasificadosEdit();
  render();
}

function removeEditTorneoEquipo(idx) {
  if (editTorneoData.equipos.length <= 2) return; // un torneo necesita al menos 2 equipos
  editTorneoData.equipos.splice(idx, 1);
  reclamarGruposYClasificadosEdit();
  render();
}

async function confirmEditarTorneo() {
  const d = editTorneoData;
  const torneo = getTorneo(d.torneoId);
  if (!torneo) { closeEditarTorneoModal(); return; }

  const nombre = (d.nombre || '').trim();
  if (!nombre) { alert('Debes indicar un nombre para el torneo'); return; }
  if (!d.fechaInicio || !d.fechaFin) { alert('Debes indicar fecha y hora de inicio y de fin'); return; }
  if (d.fechaFin <= d.fechaInicio) { alert('La fecha de fin debe ser posterior a la de inicio'); return; }
  const errorComida = validarComida(d.comidaInicio, d.comidaFin);
  if (errorComida) { alert(errorComida); return; }

  const equiposNombres = d.equipos.map(e => (e.nombre || '').trim());
  if (equiposNombres.length < 2 || equiposNombres.some(n => !n)) {
    alert('Debes indicar el nombre de todos los equipos');
    return;
  }

  const errorComp = validarCompeticion({ numGrupos: d.numGrupos, clasificadosPorGrupo: d.clasificadosPorGrupo, numEquipos: d.equipos.length });
  if (errorComp) { alert(errorComp); return; }

  const errorFormato = validarFormatoPartido(d);
  if (errorFormato) { alert(errorFormato); return; }

  // Los equipos que ya existían conservan su id (para que clasificación/histórico sigan
  // hablando del mismo equipo); los añadidos en este modal (id null) se crean ahora.
  const equiposFinal = d.equipos.map((e, i) => e.id ? { id: e.id, nombre: equiposNombres[i] } : newEquipo(equiposNombres[i]));

  const cambioEstructura = equiposCambianEstructura(torneo.equipos, equiposFinal)
    || d.numGrupos !== torneo.numGrupos
    || d.clasificadosPorGrupo !== torneo.clasificadosPorGrupo;

  // Sin cambio estructural, un mismo id con nombre distinto es un renombrado: se aplica
  // en cascada a grupos/partidos/árbitros/eliminatoria en vez de perder el sorteo.
  const renombres = {};
  if (!cambioEstructura) {
    equiposFinal.forEach(e => {
      const original = torneo.equipos.find(o => o.id === e.id);
      if (original && original.nombre !== e.nombre) renombres[e.id] = e.nombre;
    });
  }

  const camposCompartidosNuevos = {
    nombre, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin,
    puntosPorSet: d.puntosPorSet, puntosMaximo: d.puntosMaximo, numSets: d.numSets,
    numCampos: d.numCampos, duracionPartidoMin: d.duracionPartidoMin,
    comidaInicio: d.comidaInicio || null, comidaFin: d.comidaFin || null
  };
  const cambianCompartidos = CAMPOS_COMPARTIDOS_BLOQUE.some(c => camposCompartidosNuevos[c] !== torneo[c]);
  const bloqueConCompartidos = torneosDelBloque(torneo).map(t => ({ ...t, ...camposCompartidosNuevos }));

  // El número de sets solo afecta al cuadro de eliminatorias (la fase de grupos
  // siempre juega un único set): si ya hay un cuadro generado con otro número de
  // sets, sus resultados dejan de tener sentido y hay que reiniciarlo.
  const cambiaNumSets = d.numSets !== torneo.numSets && torneo.eliminatoria;
  if (cambiaNumSets && !confirm('Cambiar el número de sets por partido reiniciará el cuadro de eliminatorias actual (se perderán sus resultados). ¿Continuar?')) return;

  if (cambioEstructura) {
    if (torneo.grupos) {
      if (!confirm('Cambiar los equipos o los grupos requiere volver a sortear. Se perderán los resultados de la fase de grupos y el cuadro de eliminatorias actuales. ¿Continuar?')) return;
    }
    const torneoEditado = {
      ...torneo,
      ...camposCompartidosNuevos,
      equipos: equiposFinal,
      numGrupos: d.numGrupos,
      clasificadosPorGrupo: d.clasificadosPorGrupo,
      numPartidosGrupo: d.numPartidosGrupo
    };
    if (torneo.grupos) {
      ejecutarSorteo(torneoEditado, bloqueConCompartidos.map(t => t.id === torneo.id ? torneoEditado : t));
    } else {
      // Aún no se han sorteado grupos: basta con guardar la configuración nueva.
      guardarCambiosSinResortear(torneo.id, torneoEditado, bloqueConCompartidos);
    }
  } else {
    let torneoPropio = { ...torneo, ...camposCompartidosNuevos, numPartidosGrupo: d.numPartidosGrupo };
    if (cambiaNumSets) {
      torneoPropio = { ...torneoPropio, eliminatoria: null };
    }
    if (Object.keys(renombres).length > 0) {
      torneoPropio = renombrarEquiposEnTorneo(torneoPropio, renombres);
    }
    if (cambianCompartidos && torneosDelBloque(torneo).some(t => t.grupos)) {
      reprogramarBloque(bloqueConCompartidos.map(t => t.id === torneo.id ? torneoPropio : t));
    } else {
      guardarCambiosSinResortear(torneo.id, torneoPropio, bloqueConCompartidos);
    }
  }

  showEditarTorneoModal = false;
  render();
}
