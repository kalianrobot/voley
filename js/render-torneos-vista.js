// Render: vista de un torneo en curso (grupos, horario, eliminatorias).

function renderTorneoView() {
  const torneo = getTorneo(view.torneoId);
  if (!torneo) {
    return `
      <div class="main">
        <button class="back-btn" onclick="goToCalendar()">‹ Calendario</button>
        <div class="empty-state">
          <div class="big">Este torneo ya no existe</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="header">
      <div class="header-inner">
        <button class="back-btn" onclick="goToCalendar()">‹ Calendario</button>
        <div class="eyebrow">Volea Beach Forever 🏝️ · Torneo</div>
        <div class="list-date-label">${formatRangoFechasTorneo(torneo)}</div>
        <div class="title-row">
          <h1 class="title">${esc(torneo.nombre)}</h1>
        </div>
        <div class="subtitle-row">
          <div class="field-pill"><span class="icon">🏐</span><span>${esc(torneo.categoria)}</span></div>
          <div class="field-pill"><span class="icon">👥</span><span>${torneo.equipos.length} equipos</span></div>
        </div>
        ${renderSelectorBloque(torneo)}
      </div>
    </div>

    <div class="main">
      ${renderTorneoEquiposYGrupos(torneo)}
      ${torneo.grupos ? renderEliminatoriasSection(torneo) : ''}
      ${puedeGestionarTorneo(torneo) ? `
        <button class="back-btn" style="background:rgba(27,94,99,0.1); border-color:rgba(27,94,99,0.3); color:var(--sea-deep); margin-top:16px;" onclick="openEditarTorneoModal('${torneo.id}')">✏️ Editar torneo</button>
        <button class="back-btn" style="background:rgba(232,105,74,0.1); border-color:rgba(232,105,74,0.3); color:var(--coral); margin-top:8px;" onclick="deleteTorneo('${torneo.id}')">🗑 Borrar este torneo</button>
      ` : ''}
    </div>
  `;
}

// Selector para saltar entre los torneos que se juegan simultáneamente.
function renderSelectorBloque(torneo) {
  const bloque = torneosDelBloque(torneo);
  if (bloque.length < 2) return '';
  const pills = bloque.map(t => t.id === torneo.id
    ? `<span class="torneo-switcher-pill active">${esc(capitalizar(t.categoria))}</span>`
    : `<span class="torneo-switcher-pill" onclick="openTorneo('${t.id}')">${esc(capitalizar(t.categoria))}</span>`
  ).join('');
  return `<div class="torneo-switcher"><span class="torneo-switcher-label">⇄ A la vez:</span>${pills}</div>`;
}

function renderTorneoEquiposYGrupos(torneo) {
  const gestionar = puedeGestionarTorneo(torneo);
  if (!torneo.grupos) {
    const listaEquipos = torneo.equipos.map(e => `<div class="empty-slot" style="opacity:0.8; font-style:normal;">${esc(e.nombre)}</div>`).join('');
    return `
      <div class="empty-state" style="padding: 24px 20px 8px;">
        <div class="big">Todavía no se han sorteado los grupos</div>
        <div>${torneo.equipos.length} equipos listos para el sorteo en ${torneo.numGrupos} grupo${torneo.numGrupos !== 1 ? 's' : ''}</div>
      </div>
      <div class="players-list" style="margin-bottom: 16px;">${listaEquipos}</div>
      ${gestionar ? `<button class="add-red-btn" onclick="sortearGrupos('${torneo.id}')">🎲 Sortear grupos</button>` : ''}
    `;
  }

  const estadoCampos = calcularEstadoPartidosPorCampo(torneo);
  const gruposHtml = torneo.grupos.map(g => renderGrupoCard(torneo, g, estadoCampos)).join('');
  return `
    ${gestionar ? `<button class="add-red-btn" onclick="sortearGrupos('${torneo.id}')">🎲 Volver a sortear grupos</button>` : ''}
    ${renderHorarioGeneral(torneo, estadoCampos)}
    ${gruposHtml}
  `;
}

// El horario muestra los partidos de todo el bloque (los torneos simultáneos comparten
// pistas), etiquetando cada partido con su torneo y atenuando los del torneo hermano.
function renderHorarioGeneral(torneo, estadoCampos) {
  const bloque = torneosDelBloque(torneo);
  const hayVarios = bloque.length > 1;

  const grupoPorId = {};
  const entradas = [];
  bloque.forEach(t => {
    (t.grupos || []).forEach(g => { grupoPorId[g.id] = g.nombre; });
    (t.partidosGrupo || []).forEach(p => entradas.push({ partido: p, torneo: t }));
  });
  if (entradas.length === 0) return '';

  const porHora = {};
  entradas.forEach(e => {
    const key = e.partido.horaInicio || '';
    if (!porHora[key]) porHora[key] = [];
    porHora[key].push(e);
  });

  const { comidaInicio, comidaFin } = torneo;
  const horasOrdenadas = Object.keys(porHora).sort();
  const filas = horasOrdenadas.map((hora, idx) => {
    let filaComida = '';
    if (comidaInicio && comidaFin && hora && idx > 0) {
      const diaActual = hora.slice(0, 10);
      const horaAnterior = horasOrdenadas[idx - 1];
      if (horaAnterior.slice(0, 10) === diaActual
        && horaAnterior.slice(11, 16) < comidaInicio
        && hora.slice(11, 16) >= comidaFin) {
        filaComida = `
          <div class="horario-fila horario-comida">
            <div class="horario-hora">🍽️ ${comidaInicio}–${comidaFin}</div>
            <div class="horario-celdas"><span style="opacity:0.6;">Pausa para comer</span></div>
          </div>
        `;
      }
    }
    const celdas = porHora[hora]
      .slice()
      .sort((a, b) => (a.partido.campo || 0) - (b.partido.campo || 0))
      .map(({ partido: p, torneo: t }) => {
        const estado = estadoCampos ? estadoCampos[p.id] : null;
        const claseEstado = estado === 'jugado' ? 'campo-jugado' : (estado === 'actual' ? 'campo-actual' : '');
        return `
        <div class="horario-celda ${hayVarios && t.id !== torneo.id ? 'otro-torneo' : ''} ${claseEstado}">
          <span class="horario-campo">Campo ${p.campo}</span>
          ${hayVarios ? `<span class="horario-torneo-badge">${esc(capitalizar(t.categoria))}</span>` : ''}
          ${estado === 'actual' ? '<span class="campo-disponible">🟢 Disponible</span>' : ''}
          <span>${esc(p.equipoA.nombre)} vs ${esc(p.equipoB.nombre)}</span>
          <span style="opacity:0.5;">${esc(grupoPorId[p.grupoId] || '')}</span>
          <span class="horario-arbitro ${p.arbitro ? '' : 'pendiente'}">${p.arbitro ? `Árbitro: ${esc(p.arbitro.nombre)}` : 'Árbitro por asignar'}</span>
        </div>
      `;
      }).join('');
    return `
      ${filaComida}
      <div class="horario-fila">
        <div class="horario-hora">${hora ? formatFechaHoraCorta(hora) : '—'}</div>
        <div class="horario-celdas">${celdas}</div>
      </div>
    `;
  }).join('');

  const pendientes = hayVarios
    ? bloque.filter(t => !t.grupos).map(t => capitalizar(t.categoria))
    : [];
  const aviso = pendientes.length > 0
    ? `<div class="horario-aviso">⚠️ Falta sortear los grupos de ${pendientes.join(' y ')}. Al hacerlo, las horas se recolocarán para alternar los dos torneos.</div>`
    : '';

  return `
    <div class="red-card grupo-card">
      <div class="red-head">
        <div class="red-name-row"><span class="red-number">🗓️ Horario general</span></div>
      </div>
      <div class="players-list">${aviso}${filas}</div>
    </div>
  `;
}

function renderGrupoCard(torneo, grupo, estadoCampos) {
  const clasificacion = calcularClasificacionGrupo(torneo, grupo.id);
  const filas = clasificacion.map((s, i) => `
    <tr class="${i < torneo.clasificadosPorGrupo ? 'clasificado' : ''}">
      <td>${i + 1}</td>
      <td>${esc(s.equipo.nombre)}</td>
      <td>${s.jugados}</td>
      <td>${s.puntos}</td>
      <td>${s.diferencia > 0 ? '+' : ''}${s.diferencia}</td>
    </tr>
  `).join('');

  const partidos = torneo.partidosGrupo
    .filter(p => p.grupoId === grupo.id)
    .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || '') || (a.campo || 0) - (b.campo || 0));
  const partidosHtml = partidos.map(p => renderPartidoGrupoRow(torneo, p, estadoCampos)).join('');

  return `
    <div class="red-card grupo-card">
      <div class="red-head">
        <div class="red-name-row">
          <span class="red-number">${esc(grupo.nombre)}</span>
          <span class="grupo-categoria">${esc(capitalizar(torneo.categoria))}</span>
        </div>
      </div>
      <div class="players-list">
        <table class="grupo-standings-table">
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>Pts</th><th>Dif</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div class="players-list">${partidosHtml}</div>
    </div>
  `;
}

function renderPartidoGrupoRow(torneo, partido, estadoCampos) {
  const idA = `pg-a-${partido.id}`;
  const idB = `pg-b-${partido.id}`;
  const arbitroTexto = partido.arbitro
    ? `Árbitro: ${esc(partido.arbitro.nombre)}`
    : `<span class="arbitro-pendiente">Árbitro por asignar</span>`;
  const estado = estadoCampos ? estadoCampos[partido.id] : null;
  const etiquetaEstado = estado === 'actual' ? ' <span class="campo-disponible">🟢 Campo libre</span>' : '';
  const meta = partido.horaInicio
    ? `<div class="partido-meta">${formatFechaHoraCorta(partido.horaInicio)} · Campo ${partido.campo} · ${arbitroTexto}${etiquetaEstado}</div>`
    : '';
  const filaClase = estado === 'jugado' ? ' partido-jugado' : (estado === 'actual' ? ' partido-actual' : '');

  // Un resultado sin completar siempre se muestra editable; uno ya guardado
  // se cierra (marcador + botón editar) salvo que se haya reabierto a
  // propósito. Los inputs no autoguardan: solo se guarda al pulsar ✓, así
  // el DOM no se destruye a mitad de escribir el segundo marcador. Solo el
  // admin mete o corrige resultados; el resto solo los ve.
  const completo = partido.puntosA != null && partido.puntosB != null;
  const editando = isAdmin && (!completo || partidosGrupoEnEdicion.has(partido.id));
  const marcador = editando
    ? `
      <input type="text" inputmode="numeric" pattern="[0-9]*" id="${idA}" class="player-time-input score-input" style="width:56px; text-align:center;" value="${partido.puntosA != null ? partido.puntosA : ''}" />
      <span>–</span>
      <input type="text" inputmode="numeric" pattern="[0-9]*" id="${idB}" class="player-time-input score-input" style="width:56px; text-align:center;" value="${partido.puntosB != null ? partido.puntosB : ''}" />
      <button class="confirmar-resultado" title="Confirmar resultado" onclick="confirmarResultadoPartidoGrupo('${torneo.id}','${partido.id}')">✓</button>
    `
    : completo
      ? `
        <span class="player-time">${partido.puntosA}</span>
        <span>–</span>
        <span class="player-time">${partido.puntosB}</span>
        ${isAdmin ? `<button class="editar-resultado" title="Editar resultado" onclick="editarResultadoPartidoGrupo('${partido.id}')">✏️</button>` : ''}
      `
      : `<span class="resultado-pendiente">Pendiente</span>`;

  return `
    ${meta}
    <div class="player-row${filaClase}">
      <span class="player-name">${esc(partido.equipoA.nombre)}</span>
      ${marcador}
      <span class="player-name" style="text-align:right;">${esc(partido.equipoB.nombre)}</span>
    </div>
  `;
}

function renderEliminatoriasSection(torneo) {
  if (!torneo.eliminatoria) {
    const puede = puedeGenerarEliminatorias(torneo);
    return `
      <div style="margin-top: 24px;">
        <button class="add-red-btn" ${puede ? '' : 'disabled'} style="${puede ? '' : 'opacity:0.4; cursor:not-allowed;'}" onclick="generarEliminatorias('${torneo.id}')">🏆 Generar eliminatorias</button>
        ${puede ? '' : '<div style="text-align:center; font-size:12px; opacity:0.6; margin-top:6px;">Completa todos los resultados de la fase de grupos para generar el cuadro.</div>'}
      </div>
    `;
  }
  return `
    <div style="margin-top: 24px;">
      <div class="cal-month-label" style="margin-bottom: 12px;">Eliminatorias</div>
      ${renderBracket(torneo)}
    </div>
  `;
}

function renderBracket(torneo) {
  const rondas = torneo.eliminatoria.rondas;
  const columnas = rondas.map((ronda, ri) => {
    const partidos = ronda.partidos.map(p => renderPartidoEliminatoria(torneo, p)).join('');
    return `
      <div class="bracket-round">
        <div class="bracket-round-title">${esc(ronda.nombre)}</div>
        ${partidos}
      </div>
    `;
  }).join('');
  return `<div class="bracket-container">${columnas}</div>`;
}

function renderPartidoEliminatoria(torneo, partido) {
  const nombreA = partido.equipoA ? esc(partido.equipoA.nombre) : 'Por determinar';
  const nombreB = partido.equipoB ? esc(partido.equipoB.nombre) : 'Por determinar';
  const puedeJugarse = !!(partido.equipoA && partido.equipoB);

  let setsHtml = '';
  if (puedeJugarse) {
    const totalSets = torneo.numSets || NUM_SETS_DEFAULT;
    const setsParaGanar = Math.ceil(totalSets / 2);
    let ganadosA = 0, ganadosB = 0;
    for (let s = 0; s < totalSets; s++) {
      if (ganadosA >= setsParaGanar || ganadosB >= setsParaGanar) break;
      const set = partido.sets[s] || { puntosA: null, puntosB: null };
      const idA = `pe-${partido.id}-${s}-a`;
      const idB = `pe-${partido.id}-${s}-b`;
      const completo = set.puntosA != null && set.puntosB != null;
      const editando = isAdmin && (!completo || setsEliminatoriaEnEdicion.has(`${partido.id}:${s}`));
      const marcadorSet = editando
        ? `
          <input type="text" inputmode="numeric" pattern="[0-9]*" class="score-input" id="${idA}" value="${set.puntosA != null ? set.puntosA : ''}" />
          <input type="text" inputmode="numeric" pattern="[0-9]*" class="score-input" id="${idB}" value="${set.puntosB != null ? set.puntosB : ''}" />
          <button class="confirmar-resultado" title="Confirmar resultado" onclick="confirmarResultadoSetEliminatoria('${torneo.id}','${partido.id}',${s})">✓</button>
        `
        : completo
          ? `
            <span class="player-time">${set.puntosA}</span>
            <span class="player-time">${set.puntosB}</span>
            ${isAdmin ? `<button class="editar-resultado" title="Editar resultado" onclick="editarResultadoSetEliminatoria('${partido.id}',${s})">✏️</button>` : ''}
          `
          : `<span class="resultado-pendiente">Pendiente</span>`;
      setsHtml += `
        <div class="bracket-set-row">
          <span>Set ${s + 1}</span>
          ${marcadorSet}
        </div>
      `;
      if (set.puntosA != null && set.puntosB != null) {
        if (set.puntosA > set.puntosB) ganadosA++; else if (set.puntosB > set.puntosA) ganadosB++;
      } else {
        break; // no mostrar el siguiente set hasta rellenar este
      }
    }
  }

  const esGanadorA = partido.ganadorId && partido.equipoA && partido.ganadorId === partido.equipoA.id;
  const esGanadorB = partido.ganadorId && partido.equipoB && partido.ganadorId === partido.equipoB.id;

  return `
    <div class="bracket-match">
      <div class="bracket-team ${esGanadorA ? 'winner' : ''}">${nombreA}</div>
      <div class="bracket-team ${esGanadorB ? 'winner' : ''}">${nombreB}</div>
      ${setsHtml}
    </div>
  `;
}

