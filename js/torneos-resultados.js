// Torneos: sorteo, resultados, borrado y permisos.

// Campos que un torneo simultáneo comparte con sus hermanos de bloque (ver
// torneosDelBloque): al editarlos hay que mantenerlos sincronizados, porque
// programarPartidosBloque solo usa la configuración del primero del bloque.
const CAMPOS_COMPARTIDOS_BLOQUE = ['nombre', 'fechaInicio', 'fechaFin', 'puntosPorSet', 'puntosMaximo', 'puntosPorSetEliminatoria', 'puntosMaximoEliminatoria', 'numSets', 'numCampos', 'duracionPartidoMin', 'comidaInicio', 'comidaFin'];

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

  const ids = bloque.map(t => t.id);
  updateTorneos(ids, actuales => {
    const cambios = {};
    bloque.forEach(t => {
      const id = t.id;
      const actual = actuales[id];
      if (!actual) return;
      if (id === torneoConDatos.id) {
        cambios[id] = {
          ...actual,
          ...soloCamposCompartidos(torneoConDatos),
          equipos: torneoConDatos.equipos,
          numGrupos: torneoConDatos.numGrupos,
          clasificadosPorGrupo: torneoConDatos.clasificadosPorGrupo,
          numPartidosGrupo: torneoConDatos.numPartidosGrupo,
          grupos,
          partidosGrupo: porTorneoConArbitros[id],
          sorteoConfirmado: false,
          eliminatoria: null,
          historial: agregarHistorial(actual.historial, `🎲 Sorteo de grupos realizado (${numGrupos} grupos)`)
        };
      } else {
        cambios[id] = { ...actual, ...soloCamposCompartidos(t), partidosGrupo: porTorneoConArbitros[id] };
      }
    });
    return cambios;
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
  const ids = bloqueActualizado.map(t => t.id);
  updateTorneos(ids, actuales => {
    const cambios = {};
    bloqueActualizado.forEach(t => {
      const actual = actuales[t.id];
      if (!actual) return;
      cambios[t.id] = { ...actual, ...soloCamposCompartidos(t), partidosGrupo: porTorneoConArbitros[t.id] };
    });
    return cambios;
  });
}

// Guarda cambios que no requieren tocar el sorteo: campos compartidos del bloque en
// todos sus torneos, y los campos propios (incluido un posible renombrado de equipos
// ya aplicado a torneoPropioActualizado) solo en el torneo editado.
function guardarCambiosSinResortear(torneoId, torneoPropioActualizado, bloqueActualizado) {
  const ids = bloqueActualizado.map(t => t.id);
  updateTorneos(ids, actuales => {
    const cambios = {};
    bloqueActualizado.forEach(t => {
      const actual = actuales[t.id];
      if (!actual) return;
      if (t.id === torneoId) {
        cambios[t.id] = {
          ...torneoPropioActualizado,
          ...soloCamposCompartidos(t)
        };
      } else {
        cambios[t.id] = { ...actual, ...soloCamposCompartidos(t) };
      }
    });
    return cambios;
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

// Reabre un partido de fase de grupos ya cerrado para poder corregir su
// resultado (el botón ✏️ de renderPartidoGrupoRow).
function editarResultadoPartidoGrupo(partidoId) {
  partidosGrupoEnEdicion.add(partidoId);
  render();
}

// Botón ✓ de renderPartidoGrupoRow: valida que los dos campos tengan algo
// escrito (a diferencia de setResultadoPartidoGrupo, que tolera un resultado
// a medias mientras se está escribiendo) y, si está bien, guarda y cierra.
function confirmarResultadoPartidoGrupo(torneoId, partidoId) {
  const valA = document.getElementById(`pg-a-${partidoId}`).value;
  const valB = document.getElementById(`pg-b-${partidoId}`).value;
  if (valA === '' || valB === '') {
    alert('Debes indicar el resultado de los dos equipos.');
    return;
  }
  setResultadoPartidoGrupo(torneoId, partidoId, valA, valB);
  partidosGrupoEnEdicion.delete(partidoId);
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
  if (torneo && !esResultadoValido(a, b, torneo.puntosPorSetEliminatoria, torneo.puntosMaximoEliminatoria)) {
    alert(`Resultado no válido: hay que ganar el set por 2 puntos de diferencia a partir de ${torneo.puntosPorSetEliminatoria} (o llegar directamente a ${torneo.puntosMaximoEliminatoria}).`);
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

// Reabre un set de eliminatorias ya cerrado para poder corregir su resultado
// (el botón ✏️ de renderPartidoEliminatoria).
function editarResultadoSetEliminatoria(partidoId, setIndex) {
  setsEliminatoriaEnEdicion.add(`${partidoId}:${setIndex}`);
  render();
}

// Botón ✓ de renderPartidoEliminatoria: igual que confirmarResultadoPartidoGrupo,
// exige los dos campos rellenos antes de guardar y cerrar.
function confirmarResultadoSetEliminatoria(torneoId, partidoId, setIndex) {
  const valA = document.getElementById(`pe-${partidoId}-${setIndex}-a`).value;
  const valB = document.getElementById(`pe-${partidoId}-${setIndex}-b`).value;
  if (valA === '' || valB === '') {
    alert('Debes indicar el resultado de los dos equipos.');
    return;
  }
  setResultadoSetEliminatoria(torneoId, partidoId, setIndex, valA, valB);
  setsEliminatoriaEnEdicion.delete(`${partidoId}:${setIndex}`);
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

  const ids = superviviente ? [torneoId, superviviente.id] : [torneoId];
  updateTorneos(ids, actuales => {
    const cambios = { [torneoId]: null };
    if (superviviente && actuales[superviviente.id]) cambios[superviviente.id] = superviviente;
    return cambios;
  });
  // Si se borra desde su propia vista hay que volver al calendario; si se borra
  // desde la tarjeta del calendario, updateTorneos() ya vuelve a renderizar sin tocar el mes que se estaba viendo.
  if (estabaViendolo) goToCalendar();
}

// Gestionar un torneo (sortear, editar, borrar, meter resultados) es cosa
// exclusiva del admin: las reglas de Firestore (firestore.rules) solo dejan
// escribir documentos torneo-* a un usuario autenticado, así que ya no tiene
// sentido comprobar aquí si el dispositivo es el creador del torneo.
function puedeGestionarTorneo(torneo) {
  return isAdmin;
}

