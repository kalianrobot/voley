// Torneos: cálculo (sorteo, calendario de partidos, clasificación, cuadro de
// eliminatorias) y acciones (crear, editar, resultados).

/* ---------- Torneos: cálculo y sorteo ---------- */

function esPotenciaDeDos(n) {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

// Sugerencia simple basada en el número de equipos, solo un punto de partida editable.
function sugerirNumGrupos(numEquipos) {
  if (numEquipos <= 4) return 1;
  if (numEquipos <= 8) return 2;
  if (numEquipos <= 16) return 4;
  return 8;
}

function sugerirClasificados() {
  return 2;
}

// Potencias de dos desde 1 hasta max (inclusive). Se usan para limitar los desplegables
// de "Nº de grupos" y "Clasifican por grupo" a combinaciones que siempre son válidas
// (grupos × clasificados es automáticamente potencia de 2 si ambos lo son).
function opcionesPotenciasDeDosHasta(max) {
  const opciones = [];
  for (let p = 1; p <= max; p *= 2) opciones.push(p);
  return opciones.length ? opciones : [1];
}

function opcionesNumGrupos(numEquipos) {
  return opcionesPotenciasDeDosHasta(Math.max(1, numEquipos));
}

function opcionesClasificados(numEquipos, numGrupos) {
  const maxPorGrupo = Math.max(1, Math.floor(numEquipos / Math.max(1, numGrupos)));
  return opcionesPotenciasDeDosHasta(maxPorGrupo);
}

function sugerirNumPartidos(numEquipos, numGrupos) {
  const tam = Math.max(1, Math.round(numEquipos / Math.max(1, numGrupos)));
  return Math.round(tam * (tam - 1) / 2);
}

// Devuelve un mensaje de error (o null) para la pausa de comer: ambos campos vacíos
// (sin pausa) es válido; si se rellena uno, el otro también es obligatorio.
function validarComida(comidaInicio, comidaFin) {
  if (!comidaInicio && !comidaFin) return null;
  if (!comidaInicio || !comidaFin) {
    return 'Si indicas la pausa para comer, hace falta tanto la hora de inicio como la de fin';
  }
  if (comidaFin <= comidaInicio) {
    return 'La hora de fin de la comida debe ser posterior a la de inicio';
  }
  return null;
}

function validarCompeticion(comp) {
  const producto = comp.numGrupos * comp.clasificadosPorGrupo;
  if (!esPotenciaDeDos(producto)) {
    return `grupos × clasificados debe ser una potencia de 2 (2, 4, 8, 16...). Actualmente: ${comp.numGrupos} × ${comp.clasificadosPorGrupo} = ${producto}.`;
  }
  if (comp.numGrupos > 0 && comp.clasificadosPorGrupo > Math.floor(comp.numEquipos / comp.numGrupos)) {
    return `No puede haber ${comp.clasificadosPorGrupo} clasificados por grupo si algún grupo tiene menos equipos que eso.`;
  }
  return null;
}

// Valida el formato de puntuación compartido por fase de grupos y eliminatorias:
// el tope debe estar por encima de los puntos por set (si no, el margen de 2 nunca
// llegaría a decidir el set) y el número de sets debe ser impar para que siempre
// haya un ganador claro.
function validarFormatoPartido(d) {
  if (!(d.puntosMaximo > d.puntosPorSet)) {
    return `El tope de puntos (${d.puntosMaximo}) debe ser mayor que los puntos por set (${d.puntosPorSet}).`;
  }
  if (d.numSets % 2 === 0) {
    return `El número de sets debe ser impar (1, 3, 5...) para que siempre haya un ganador.`;
  }
  return null;
}

function validarTorneoModal(data) {
  const activas = competicionesActivas(data);
  const dos = activas.length > 1;

  if (dos && activas[0].categoria === activas[1].categoria) {
    return { valid: false, error: '⚠️ Los dos torneos simultáneos deben ser de categorías distintas.' };
  }

  for (let i = 0; i < activas.length; i++) {
    const error = validarCompeticion(activas[i]);
    if (error) {
      return { valid: false, error: dos ? `⚠️ Torneo ${i + 1}: ${error}` : `⚠️ ${error}` };
    }
  }

  const errorFormato = validarFormatoPartido(data);
  if (errorFormato) {
    return { valid: false, error: `⚠️ ${errorFormato}` };
  }
  return { valid: true, error: null };
}

// Método del "círculo": reparte los equipos de un grupo en rondas donde cada equipo
// juega como mucho una vez por ronda (si el grupo es impar se añade un hueco/bye).
// Esto es lo que luego permite repartir partidos de distintos grupos en la misma
// franja horaria sin que ningún equipo tenga que jugar dos partidos a la vez.
function generarRondasRoundRobin(equiposOriginales) {
  const equipos = [...equiposOriginales];
  if (equipos.length < 2) return [];
  if (equipos.length % 2 !== 0) equipos.push(null); // bye
  const n = equipos.length;
  const numRondas = n - 1;
  const rondas = [];
  let arreglo = equipos.slice();
  for (let r = 0; r < numRondas; r++) {
    const ronda = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arreglo[i];
      const b = arreglo[n - 1 - i];
      if (a && b) ronda.push([a, b]);
    }
    rondas.push(ronda);
    const fijo = arreglo[0];
    const resto = arreglo.slice(1);
    resto.push(resto.shift());
    arreglo = [fijo, ...resto];
  }
  return rondas;
}

// El calendario de grupos siempre es todos-contra-todos; numPartidosGrupo es solo orientativo,
// no hay una forma justa de decidir qué partidos recortar si no coincide.
function generarPartidosGrupo(grupos) {
  const partidos = [];
  (grupos || []).forEach(grupo => {
    const rondas = generarRondasRoundRobin(grupo.equipos);
    rondas.forEach((ronda, rIdx) => {
      ronda.forEach(([equipoA, equipoB]) => {
        partidos.push({
          id: uid(),
          grupoId: grupo.id,
          ronda: rIdx,
          equipoA,
          equipoB,
          puntosA: null,
          puntosB: null,
          campo: null,
          horaInicio: null
        });
      });
    });
  });
  return partidos;
}

function toDateTimeLocalString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${mi}`;
}

// Trocea los partidos de un torneo en "tandas": lo que cabe en una franja horaria.
// Todos los partidos de una misma ronda son seguros en paralelo (ningún equipo se
// repite dentro de una ronda, ver generarRondasRoundRobin), pero partidos de rondas
// distintas NO pueden compartir franja, así que se trocea ronda a ronda.
function tandasDePartidos(partidos, numCampos) {
  const maxRonda = partidos.reduce((m, p) => Math.max(m, p.ronda || 0), 0);
  const tandas = [];
  for (let r = 0; r <= maxRonda; r++) {
    const partidosRonda = partidos
      .filter(p => (p.ronda || 0) === r)
      .sort((a, b) => String(a.grupoId).localeCompare(String(b.grupoId)));
    for (let i = 0; i < partidosRonda.length; i += numCampos) {
      tandas.push(partidosRonda.slice(i, i + numCampos));
    }
  }
  return tandas;
}

// Si `momentoMs` cae dentro de la pausa para comer de ESE día ('HH:mm'-'HH:mm',
// se repite cada día que dure el torneo), lo adelanta hasta el final de la pausa.
// Sin comidaInicio/comidaFin configurados es un no-op.
function saltarComidaSiHaceFalta(momentoMs, comidaInicio, comidaFin) {
  if (!comidaInicio || !comidaFin) return momentoMs;
  const d = new Date(momentoMs);
  const [hIni, mIni] = comidaInicio.split(':').map(Number);
  const [hFin, mFin] = comidaFin.split(':').map(Number);
  const inicioMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hIni, mIni).getTime();
  const finMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hFin, mFin).getTime();
  return (momentoMs >= inicioMs && momentoMs < finMs) ? finMs : momentoMs;
}

// Asigna hora y campo a los partidos de fase de grupos de todo un bloque de torneos
// simultáneos. Las tandas de cada torneo se van intercalando franja a franja, de modo
// que mientras un torneo ocupa los campos el otro descansa (y quien juega los dos
// nunca tiene dos partidos a la vez). Con un solo torneo son tandas consecutivas.
// Solo toca campo/horaInicio: no regenera partidos, así que reprogramar no pierde resultados.
function programarPartidosBloque(torneos) {
  const config = torneos[0] || {};
  const numCampos = Math.max(1, config.numCampos || 1);
  const duracionMs = Math.max(1, config.duracionPartidoMin || 20) * 60000;
  const inicio = config.fechaInicio ? new Date(config.fechaInicio).getTime() : Date.now();

  const porTorneo = {};
  const tandasPorTorneo = torneos.map(t => {
    const partidos = (t.partidosGrupo || []).map(p => ({ ...p }));
    porTorneo[t.id] = partidos;
    return tandasDePartidos(partidos, numCampos);
  });

  const siguiente = tandasPorTorneo.map(() => 0);
  let cursor = inicio;
  let quedan = true;
  while (quedan) {
    quedan = false;
    for (let k = 0; k < tandasPorTorneo.length; k++) {
      if (siguiente[k] >= tandasPorTorneo[k].length) continue;
      cursor = saltarComidaSiHaceFalta(cursor, config.comidaInicio, config.comidaFin);
      const tanda = tandasPorTorneo[k][siguiente[k]];
      siguiente[k] += 1;
      const hora = toDateTimeLocalString(new Date(cursor));
      tanda.forEach((partido, i) => {
        partido.campo = i + 1;
        partido.horaInicio = hora;
      });
      cursor += duracionMs;
      if (siguiente[k] < tandasPorTorneo[k].length) quedan = true;
    }
  }

  cursor = saltarComidaSiHaceFalta(cursor, config.comidaInicio, config.comidaFin);
  const horaFinEstimada = toDateTimeLocalString(new Date(cursor));
  const excedeFin = !!config.fechaFin && horaFinEstimada > config.fechaFin;
  return { porTorneo, horaFinEstimada, excedeFin };
}

function programarPartidosGrupo(torneo) {
  const { porTorneo, horaFinEstimada, excedeFin } = programarPartidosBloque([torneo]);
  return { partidos: porTorneo[torneo.id], horaFinEstimada, excedeFin };
}

// Asigna árbitro a cada partido de grupo: un equipo del mismo torneo (misma categoría,
// por construcción, ya que solo se mira dentro de sus propios equipos) que no juegue
// en esa franja horaria. Reparte el arbitraje lo más equitativamente posible entre los
// equipos libres de cada franja; si no hay bastantes libres para todos los partidos
// simultáneos, esos partidos se quedan sin árbitro (no se reutiliza un equipo ocupado).
function asignarArbitros(equiposTorneo, partidos) {
  const contador = {};
  equiposTorneo.forEach(e => { contador[e.id] = 0; });

  const porHora = {};
  partidos.forEach(p => {
    const key = p.horaInicio || '';
    if (!porHora[key]) porHora[key] = [];
    porHora[key].push(p);
  });

  const resultado = partidos.map(p => ({ ...p, arbitro: null }));
  const porId = {};
  resultado.forEach(p => { porId[p.id] = p; });

  Object.keys(porHora).sort().forEach(hora => {
    const partidosSlot = porHora[hora];
    const ocupados = new Set(partidosSlot.flatMap(p => [p.equipoA.id, p.equipoB.id]));
    const libres = equiposTorneo
      .filter(e => !ocupados.has(e.id))
      .sort((a, b) => contador[a.id] - contador[b.id]);
    const usados = new Set();
    partidosSlot.forEach(p => {
      const candidato = libres.find(e => !usados.has(e.id));
      if (!candidato) return;
      porId[p.id].arbitro = { id: candidato.id, nombre: candidato.nombre };
      usados.add(candidato.id);
      contador[candidato.id]++;
    });
  });

  return resultado;
}

// Un cambio "estructural" en los equipos (añadir, quitar, o cualquier id nuevo) invalida
// los grupos ya sorteados; un simple renombrado (mismos ids) no.
function equiposCambianEstructura(actuales, nuevos) {
  if (actuales.length !== nuevos.length) return true;
  const idsActuales = new Set(actuales.map(e => e.id));
  return nuevos.some(e => !e.id || !idsActuales.has(e.id));
}

// Aplica un renombrado de equipos (por id) a todas las copias que el torneo tiene
// embebidas: equipos, grupos, partidos de grupo (incluido el árbitro) y eliminatoria.
// No toca nada más, así que resultados y horarios ya calculados se mantienen intactos.
function renombrarEquiposEnTorneo(torneo, renombres) {
  if (!renombres || Object.keys(renombres).length === 0) return torneo;
  const conNuevoNombre = (e) => (e && renombres[e.id]) ? { ...e, nombre: renombres[e.id] } : e;
  return {
    ...torneo,
    equipos: torneo.equipos.map(conNuevoNombre),
    grupos: (torneo.grupos || []).map(g => ({ ...g, equipos: g.equipos.map(conNuevoNombre) })),
    partidosGrupo: (torneo.partidosGrupo || []).map(p => ({
      ...p,
      equipoA: conNuevoNombre(p.equipoA),
      equipoB: conNuevoNombre(p.equipoB),
      arbitro: p.arbitro ? conNuevoNombre(p.arbitro) : null
    })),
    eliminatoria: torneo.eliminatoria ? {
      rondas: torneo.eliminatoria.rondas.map(r => ({
        ...r,
        partidos: r.partidos.map(p => ({
          ...p,
          equipoA: conNuevoNombre(p.equipoA),
          equipoB: conNuevoNombre(p.equipoB)
        }))
      }))
    } : null
  };
}

function calcularClasificacionGrupo(torneo, grupoId) {
  const grupo = (torneo.grupos || []).find(g => g.id === grupoId);
  if (!grupo) return [];
  const stats = {};
  grupo.equipos.forEach(eq => {
    stats[eq.id] = { equipo: eq, puntos: 0, jugados: 0, ganados: 0, favor: 0, contra: 0, diferencia: 0 };
  });
  (torneo.partidosGrupo || []).forEach(p => {
    if (p.grupoId !== grupoId) return;
    if (p.puntosA == null || p.puntosB == null) return;
    const a = stats[p.equipoA.id];
    const b = stats[p.equipoB.id];
    if (!a || !b) return;
    a.jugados += 1; b.jugados += 1;
    a.favor += p.puntosA; a.contra += p.puntosB;
    b.favor += p.puntosB; b.contra += p.puntosA;
    if (p.puntosA > p.puntosB) { a.puntos += 2; a.ganados += 1; }
    else if (p.puntosB > p.puntosA) { b.puntos += 2; b.ganados += 1; }
  });
  const lista = Object.values(stats).map(s => ({ ...s, diferencia: s.favor - s.contra }));
  lista.sort((x, y) => {
    if (y.puntos !== x.puntos) return y.puntos - x.puntos;
    if (y.diferencia !== x.diferencia) return y.diferencia - x.diferencia;
    return x.equipo.nombre.localeCompare(y.equipo.nombre);
  });
  return lista;
}

// Para cada campo (compartido con los torneos simultáneos del mismo bloque), calcula
// qué partido es "el actual": el más próximo sin resultado en orden de horario, que es
// el que puede jugarse en cuanto el campo quede libre. Los partidos con resultado se
// marcan como jugados (siguen siendo editables); el resto queda sin marcar.
function calcularEstadoPartidosPorCampo(torneo) {
  const bloque = torneosDelBloque(torneo);
  const porCampo = {};
  bloque.forEach(t => {
    (t.partidosGrupo || []).forEach(p => {
      if (p.campo == null) return;
      if (!porCampo[p.campo]) porCampo[p.campo] = [];
      porCampo[p.campo].push(p);
    });
  });
  const estado = {};
  Object.values(porCampo).forEach(lista => {
    lista.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    let asignadoActual = false;
    lista.forEach(p => {
      if (p.puntosA != null && p.puntosB != null) {
        estado[p.id] = 'jugado';
      } else if (!asignadoActual) {
        estado[p.id] = 'actual';
        asignadoActual = true;
      }
    });
  });
  return estado;
}

function puedeGenerarEliminatorias(torneo) {
  if (!torneo.grupos || torneo.grupos.length === 0) return false;
  // Si algún grupo tiene un solo equipo no genera partidos: se puede pasar directo a eliminatorias.
  return (torneo.partidosGrupo || []).every(p => p.puntosA != null && p.puntosB != null);
}

// Orden clásico de seeding de un cuadro: seed 1 y 2 solo pueden verse en la final,
// seeds 1-4 solo desde semifinales, etc. Ej: bracketOrder(8) = [1,8,4,5,2,7,3,6]
function bracketOrder(tamano) {
  let orden = [1];
  while (orden.length < tamano) {
    const nuevoTamano = orden.length * 2;
    const siguiente = [];
    orden.forEach(seed => {
      siguiente.push(seed);
      siguiente.push(nuevoTamano + 1 - seed);
    });
    orden = siguiente;
  }
  return orden;
}

function sizeToRoundName(numPartidosEnRonda) {
  if (numPartidosEnRonda === 1) return 'Final';
  if (numPartidosEnRonda === 2) return 'Semifinal';
  if (numPartidosEnRonda === 4) return 'Cuartos de final';
  if (numPartidosEnRonda === 8) return 'Octavos de final';
  return `Ronda de ${numPartidosEnRonda * 2}`;
}

function crearEmparejamientosPrimeraRonda(torneo) {
  const q = torneo.clasificadosPorGrupo;
  const grupos = torneo.grupos;
  // 1. Seeds por niveles: 1os de cada grupo, luego 2os de cada grupo, etc.
  const seeds = [];
  for (let rankLevel = 0; rankLevel < q; rankLevel++) {
    grupos.forEach(grupo => {
      const clasificacion = calcularClasificacionGrupo(torneo, grupo.id);
      const clasificado = clasificacion[rankLevel];
      seeds.push({ ...clasificado.equipo, grupoId: grupo.id });
    });
  }

  const tamano = seeds.length;
  const orden = bracketOrder(tamano);
  const slots = orden.map(seedNum => seeds[seedNum - 1]);

  const pares = [];
  for (let i = 0; i < tamano; i += 2) {
    pares.push([slots[i], slots[i + 1]]);
  }

  // 2. Corregir choques de equipos del mismo grupo en primera ronda.
  for (let i = 0; i < pares.length; i++) {
    const [a, b] = pares[i];
    if (a.grupoId !== b.grupoId) continue;
    for (let j = 0; j < pares.length; j++) {
      if (j === i) continue;
      const [c, d] = pares[j];
      if (c.grupoId !== a.grupoId && c.grupoId !== b.grupoId && d.grupoId !== a.grupoId) {
        pares[i][1] = d;
        pares[j][1] = b;
        break;
      }
    }
  }

  return pares;
}

function evaluarSetsGanados(partido, lado) {
  let count = 0;
  (partido.sets || []).forEach(s => {
    if (s.puntosA == null || s.puntosB == null) return;
    if (lado === 'A' && s.puntosA > s.puntosB) count++;
    if (lado === 'B' && s.puntosB > s.puntosA) count++;
  });
  return count;
}

function evaluarGanadorPartido(partido, numSets) {
  const setsParaGanar = Math.ceil((numSets || NUM_SETS_DEFAULT) / 2);
  let setsA = 0, setsB = 0;
  (partido.sets || []).forEach(s => {
    if (s.puntosA == null || s.puntosB == null) return;
    if (s.puntosA > s.puntosB) setsA += 1;
    else if (s.puntosB > s.puntosA) setsB += 1;
  });
  if (setsA >= setsParaGanar) return partido.equipoA.id;
  if (setsB >= setsParaGanar) return partido.equipoB.id;
  return null;
}

// Un set/partido a puntos se gana llegando al menos a "puntosPorSet" con 2 de ventaja;
// para que no se alargue indefinidamente, alcanzar "puntosMaximo" gana directamente
// aunque la ventaja sea de un solo punto (p.ej. a 15 con tope 21: gana 15-13, 18-16 o
// 21-20, pero no 15-14 ni 16-15).
function esResultadoValido(puntosA, puntosB, puntosPorSet, puntosMaximo) {
  if (puntosA == null || puntosB == null) return true;
  if (puntosA === puntosB) return false;
  const max = Math.max(puntosA, puntosB);
  const diferencia = Math.abs(puntosA - puntosB);
  if (max > puntosMaximo) return false;
  if (max === puntosMaximo) return true;
  return max >= puntosPorSet && diferencia >= 2;
}

function avanzarGanador(eliminatoria, rondaIdx, partidoIdx) {
  if (rondaIdx + 1 >= eliminatoria.rondas.length) return;
  const partido = eliminatoria.rondas[rondaIdx].partidos[partidoIdx];
  if (!partido.ganadorId) return;
  const ganador = (partido.equipoA && partido.equipoA.id === partido.ganadorId) ? partido.equipoA : partido.equipoB;
  const siguienteIdx = Math.floor(partidoIdx / 2);
  const siguiente = eliminatoria.rondas[rondaIdx + 1].partidos[siguienteIdx];
  if (partidoIdx % 2 === 0) siguiente.equipoA = ganador;
  else siguiente.equipoB = ganador;
}


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

