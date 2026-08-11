// Torneos: cálculo (sorteo, calendario de partidos, clasificación, cuadro de
// eliminatorias).

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
