// Torneos: acciones (crear, editar, resultados, borrar) y modales asociados.

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

  await update(prev => {
    const mapa = { ...prev.torneos };
    torneos.forEach(t => { mapa[t.id] = t; });
    return { ...prev, torneos: mapa };
  });
  showNewTorneoModal = false;
  openTorneo(torneos[0].id);
}

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

// Campos que un torneo simultáneo comparte con sus hermanos de bloque (ver
// torneosDelBloque): al editarlos hay que mantenerlos sincronizados, porque
// programarPartidosBloque solo usa la configuración del primero del bloque.
const CAMPOS_COMPARTIDOS_BLOQUE = ['nombre', 'fechaInicio', 'fechaFin', 'puntosPorSet', 'puntosMaximo', 'numSets', 'numCampos', 'duracionPartidoMin', 'comidaInicio', 'comidaFin'];

function soloCamposCompartidos(t) {
  const campos = {};
  CAMPOS_COMPARTIDOS_BLOQUE.forEach(c => { campos[c] = t[c]; });
  return campos;
}

// Baraja los equipos de torneoConDatos, arma grupos nuevos, genera y programa sus
// partidos (junto con los del resto del bloque) y asigna árbitros. torneoConDatos puede
// venir tal cual está en `state` (sortearGrupos) o con campos ya editados sin guardar
// todavía (confirmEditarTorneo) — en ambos casos el resultado se escribe de una vez.
function ejecutarSorteo(torneoConDatos, bloqueBase) {
  const equipos = [...torneoConDatos.equipos];
  for (let i = equipos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [equipos[i], equipos[j]] = [equipos[j], equipos[i]];
  }

  const numGrupos = torneoConDatos.numGrupos;
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const grupos = Array.from({ length: numGrupos }, (_, i) => ({ id: uid(), nombre: `Grupo ${letras[i] || (i + 1)}`, equipos: [] }));
  equipos.forEach((eq, i) => {
    grupos[i % numGrupos].equipos.push(eq);
  });
  const partidosSinProgramar = generarPartidosGrupo(grupos);

  // Al cambiar las tandas de este torneo se desplazan las franjas de sus torneos
  // simultáneos, así que hay que reprogramar el bloque entero. A los hermanos solo
  // se les recolocan hora y campo: sus partidos y resultados se mantienen.
  const torneoConNuevosPartidos = { ...torneoConDatos, partidosGrupo: partidosSinProgramar };
  const bloque = bloqueBase.map(t => t.id === torneoConDatos.id ? torneoConNuevosPartidos : t);
  const { porTorneo, excedeFin } = programarPartidosBloque(bloque);

  if (excedeFin) {
    alert('⚠️ Con los campos y la duración configurados, la fase de grupos no cabe antes de la fecha/hora de fin del torneo. Se ha generado igualmente el horario completo.');
  }

  // El árbitro se asigna por torneo (equipos de la propia categoría), una vez ya
  // repartidas hora y campo de todo el bloque.
  const porTorneoConArbitros = {};
  bloque.forEach(t => {
    porTorneoConArbitros[t.id] = asignarArbitros(t.equipos, porTorneo[t.id]);
  });

  update(prev => {
    const torneos = { ...prev.torneos };
    bloque.forEach(t => {
      const id = t.id;
      if (!torneos[id]) return;
      if (id === torneoConDatos.id) {
        torneos[id] = {
          ...torneos[id],
          ...soloCamposCompartidos(torneoConDatos),
          equipos: torneoConDatos.equipos,
          numGrupos: torneoConDatos.numGrupos,
          clasificadosPorGrupo: torneoConDatos.clasificadosPorGrupo,
          numPartidosGrupo: torneoConDatos.numPartidosGrupo,
          grupos,
          partidosGrupo: porTorneoConArbitros[id],
          sorteoConfirmado: false,
          eliminatoria: null,
          historial: agregarHistorial(torneos[id].historial, `🎲 Sorteo de grupos realizado (${numGrupos} grupos)`)
        };
      } else {
        torneos[id] = { ...torneos[id], ...soloCamposCompartidos(t), partidosGrupo: porTorneoConArbitros[id] };
      }
    });
    return { ...prev, torneos };
  });
}

function sortearGrupos(torneoId) {
  const torneo = getTorneo(torneoId);
  if (!torneo) return;
  if (torneo.sorteoConfirmado) {
    if (!confirm('Ya hay resultados registrados en la fase de grupos. ¿Seguro que quieres volver a sortear? Se perderán los resultados de grupos y el cuadro de eliminatorias.')) return;
  }
  ejecutarSorteo(torneo, torneosDelBloque(torneo));
}

// Reprograma horas/campos/árbitros de todo el bloque sin tocar grupos ni resultados
// (usado al editar campos compartidos como nº de campos/duración/fechas cuando ya hay
// grupos sorteados). bloqueActualizado ya trae los campos compartidos con sus valores nuevos.
function reprogramarBloque(bloqueActualizado) {
  const { porTorneo, excedeFin } = programarPartidosBloque(bloqueActualizado);
  if (excedeFin) {
    alert('⚠️ Con los campos y la duración configurados, la fase de grupos no cabe antes de la fecha/hora de fin del torneo. Se ha generado igualmente el horario completo.');
  }
  const porTorneoConArbitros = {};
  bloqueActualizado.forEach(t => {
    porTorneoConArbitros[t.id] = asignarArbitros(t.equipos, porTorneo[t.id]);
  });
  update(prev => {
    const torneos = { ...prev.torneos };
    bloqueActualizado.forEach(t => {
      if (!torneos[t.id]) return;
      torneos[t.id] = { ...torneos[t.id], ...soloCamposCompartidos(t), partidosGrupo: porTorneoConArbitros[t.id] };
    });
    return { ...prev, torneos };
  });
}

// Guarda cambios que no requieren tocar el sorteo: campos compartidos del bloque en
// todos sus torneos, y los campos propios (incluido un posible renombrado de equipos
// ya aplicado a torneoPropioActualizado) solo en el torneo editado.
function guardarCambiosSinResortear(torneoId, torneoPropioActualizado, bloqueActualizado) {
  update(prev => {
    const torneos = { ...prev.torneos };
    bloqueActualizado.forEach(t => {
      if (!torneos[t.id]) return;
      if (t.id === torneoId) {
        torneos[t.id] = {
          ...torneoPropioActualizado,
          ...soloCamposCompartidos(t)
        };
      } else {
        torneos[t.id] = { ...torneos[t.id], ...soloCamposCompartidos(t) };
      }
    });
    return { ...prev, torneos };
  });
}

function setResultadoPartidoGrupo(torneoId, partidoId, puntosA, puntosB) {
  const a = (puntosA === '' || puntosA == null) ? null : Math.max(0, parseInt(puntosA, 10) || 0);
  const b = (puntosB === '' || puntosB == null) ? null : Math.max(0, parseInt(puntosB, 10) || 0);
  const torneo = getTorneo(torneoId);
  if (torneo && !esResultadoValido(a, b, torneo.puntosPorSet, torneo.puntosMaximo)) {
    alert(`Resultado no válido: hay que ganar por 2 puntos de diferencia a partir de ${torneo.puntosPorSet} (o llegar directamente a ${torneo.puntosMaximo}).`);
    render();
    return;
  }
  updateTorneo(torneoId, prev => ({
    ...prev,
    partidosGrupo: prev.partidosGrupo.map(p => p.id === partidoId ? { ...p, puntosA: a, puntosB: b } : p),
    sorteoConfirmado: (a != null && b != null) ? true : prev.sorteoConfirmado
  }));
}

function generarEliminatorias(torneoId) {
  const torneo = getTorneo(torneoId);
  if (!torneo || !puedeGenerarEliminatorias(torneo)) return;
  if (torneo.eliminatoria) {
    const hayProgreso = torneo.eliminatoria.rondas.some(r => r.partidos.some(p => p.ganadorId));
    if (hayProgreso && !confirm('Ya hay resultados en el cuadro de eliminatorias. ¿Seguro que quieres regenerarlo? Se perderán.')) return;
  }

  const pares = crearEmparejamientosPrimeraRonda(torneo);

  const rondas = [];
  let n = pares.length;
  while (true) {
    const partidos = [];
    for (let i = 0; i < n; i++) {
      partidos.push({
        id: uid(),
        slotIndex: i,
        equipoA: null,
        equipoB: null,
        sets: Array.from({ length: torneo.numSets || NUM_SETS_DEFAULT }, () => ({ puntosA: null, puntosB: null })),
        ganadorId: null
      });
    }
    rondas.push({ nombre: sizeToRoundName(n), partidos });
    if (n === 1) break;
    n = n / 2;
  }
  rondas[0].partidos.forEach((partido, i) => {
    partido.equipoA = pares[i][0];
    partido.equipoB = pares[i][1];
  });

  updateTorneo(torneoId, prev => ({
    ...prev,
    eliminatoria: { rondas },
    historial: agregarHistorial(prev.historial, `🏆 Cuadro de eliminatorias generado (${pares.length * 2} equipos)`)
  }));
}

function setResultadoSetEliminatoria(torneoId, partidoId, setIndex, puntosA, puntosB) {
  const a = (puntosA === '' || puntosA == null) ? null : Math.max(0, parseInt(puntosA, 10) || 0);
  const b = (puntosB === '' || puntosB == null) ? null : Math.max(0, parseInt(puntosB, 10) || 0);
  const torneo = getTorneo(torneoId);
  if (torneo && !esResultadoValido(a, b, torneo.puntosPorSet, torneo.puntosMaximo)) {
    alert(`Resultado no válido: hay que ganar el set por 2 puntos de diferencia a partir de ${torneo.puntosPorSet} (o llegar directamente a ${torneo.puntosMaximo}).`);
    render();
    return;
  }

  updateTorneo(torneoId, prev => {
    const eliminatoria = JSON.parse(JSON.stringify(prev.eliminatoria));
    let rondaIdx = -1, partidoIdx = -1;
    eliminatoria.rondas.forEach((ronda, ri) => {
      ronda.partidos.forEach((p, pi) => {
        if (p.id === partidoId) { rondaIdx = ri; partidoIdx = pi; }
      });
    });
    if (rondaIdx === -1) return prev;
    const partido = eliminatoria.rondas[rondaIdx].partidos[partidoIdx];
    partido.sets[setIndex] = { puntosA: a, puntosB: b };
    partido.ganadorId = (partido.equipoA && partido.equipoB) ? evaluarGanadorPartido(partido, prev.numSets) : null;
    if (partido.ganadorId) {
      avanzarGanador(eliminatoria, rondaIdx, partidoIdx);
    }
    return { ...prev, eliminatoria };
  });
}

function deleteTorneo(torneoId) {
  const torneo = getTorneo(torneoId);
  if (!torneo) return;

  const hermanos = torneosDelBloque(torneo).filter(t => t.id !== torneoId);
  const aviso = hermanos.length > 0
    ? ` Se juega a la vez que "${nombreTorneo(hermanos[0])}", que pasará a jugarse solo y verá recolocado su horario.`
    : '';
  if (!confirm(`¿Borrar el torneo "${nombreTorneo(torneo)}"? Se perderá toda la información: equipos, grupos y eliminatorias.${aviso}`)) return;

  const estabaViendolo = view.screen === 'torneo' && view.torneoId === torneoId;

  // Si el bloque se queda con un único torneo deja de ser simultáneo: se le quita el
  // bloqueId y se recompacta su horario para que no arrastre los huecos del otro.
  let superviviente = null;
  if (hermanos.length === 1) {
    const solo = { ...hermanos[0], bloqueId: null, ordenBloque: 0 };
    const { porTorneo } = programarPartidosBloque([solo]);
    // Las horas cambian al recompactar, así que los árbitros se reasignan desde cero
    // (quién estaba "libre en ese momento" ya no es lo mismo).
    superviviente = { ...solo, partidosGrupo: asignarArbitros(solo.equipos, porTorneo[solo.id]) };
  }

  update(prev => {
    const torneos = { ...prev.torneos };
    delete torneos[torneoId];
    if (superviviente && torneos[superviviente.id]) torneos[superviviente.id] = superviviente;
    return { ...prev, torneos };
  });
  // Si se borra desde su propia vista hay que volver al calendario; si se borra
  // desde la tarjeta del calendario, update() ya vuelve a renderizar sin tocar el mes que se estaba viendo.
  if (estabaViendolo) goToCalendar();
}

function puedeGestionarTorneo(torneo) {
  if (isAdmin) return true;
  return torneo.creatorOwner === DEVICE_ID;
}

