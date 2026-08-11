// Render: pantallas de torneos (fase de grupos, horario, eliminatorias, modales).

/* ---------- Render: torneos ---------- */

function renderTorneosSection() {
  const torneos = Object.values(state.torneos || {}).sort((a, b) => (a.fechaInicio || '').localeCompare(b.fechaInicio || ''));
  if (torneos.length === 0) return '';

  const cards = torneos.map(t => {
    const badge = estadoTorneo(t);
    const badgeClass = badge === 'En curso' ? 'live' : (badge === 'Finalizado' ? 'done' : 'upcoming');
    const deleteBtn = puedeGestionarTorneo(t)
      ? `<button class="delete-torneo" onclick="event.stopPropagation(); deleteTorneo('${t.id}')" title="Borrar torneo">✕</button>`
      : '';
    return `
      <div class="torneo-card" onclick="openTorneo('${t.id}')">
        <div class="torneo-card-head">
          <span class="torneo-card-nombre">${esc(nombreTorneo(t))}</span>
          <span class="torneo-card-head-right">
            <span class="torneo-badge ${badgeClass}">${badge}</span>
            ${deleteBtn}
          </span>
        </div>
        <div class="torneo-card-meta">🏐 ${esc(t.categoria)} · 👥 ${t.equipos.length} equipos · ${faseTorneo(t)}${t.bloqueId ? ' · ⇄ simultáneo' : ''}</div>
        <div class="torneo-card-fechas">${formatRangoFechasTorneo(t)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="main torneos-section">
      <div class="cal-month-label" style="margin-bottom: 12px;">Torneos</div>
      ${cards}
    </div>
  `;
}

function renderCompeticionCampos(d, comp, i) {
  const dos = d.modo === 'dos';
  const equiposInputs = comp.equiposNombres.map((nombre, j) => `
    <input type="text" id="torneo-${i}-equipo-${j}" class="equipo-input-row" placeholder="Equipo ${j + 1}" maxlength="30" value="${esc(nombre)}" oninput="setTorneoEquipoNombre(${i}, ${j}, this.value)" />
  `).join('');

  const cabecera = dos ? `<div class="competicion-titulo">Torneo ${i + 1}</div>` : '';
  const selectorCategoria = dos ? `
    <div class="labeled-field">
      <label>Categoría</label>
      <select id="torneo-${i}-categoria" onchange="setTorneoCompField(${i}, 'categoria', this.value); render()">
        ${CATEGORIAS_TORNEO.map(c => `<option value="${c}" ${c === comp.categoria ? 'selected' : ''}>${capitalizar(c)}</option>`).join('')}
      </select>
    </div>
  ` : '';

  return `
    <div class="${dos ? 'competicion-block' : ''}">
      ${cabecera}
      ${selectorCategoria}
      <div class="labeled-field">
        <label>Número de equipos</label>
        <input type="number" min="2" id="torneo-${i}-num-equipos" value="${comp.numEquipos}" onchange="onNumEquiposChangeTorneo(${i}, this.value)" />
      </div>

      <div class="labeled-field">
        <label>Nombres de los equipos</label>
        ${equiposInputs}
      </div>

      <div style="display:flex; gap:10px;">
        <div class="labeled-field" style="flex:1;">
          <label>Nº de grupos</label>
          <select id="torneo-${i}-num-grupos" onchange="setTorneoNumGrupos(${i}, this.value)">
            ${opcionesNumGrupos(comp.numEquipos).map(n => `<option value="${n}" ${n === comp.numGrupos ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="labeled-field" style="flex:1;">
          <label>Clasifican por grupo</label>
          <select id="torneo-${i}-clasificados" onchange="setTorneoClasificados(${i}, this.value)">
            ${opcionesClasificados(comp.numEquipos, comp.numGrupos).map(n => `<option value="${n}" ${n === comp.clasificadosPorGrupo ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="labeled-field">
        <label>Partidos en fase de grupos (orientativo, siempre se juega todos contra todos)</label>
        <input type="number" min="0" id="torneo-${i}-num-partidos" value="${comp.numPartidosGrupo}" onchange="setTorneoNumPartidos(${i}, this.value)" />
      </div>
    </div>
  `;
}

function renderNewTorneoModal() {
  if (!showNewTorneoModal) return '';
  const d = newTorneoData;
  const validacion = validarTorneoModal(d);
  const dos = d.modo === 'dos';
  const tipoActual = dos ? 'dos' : d.competiciones[0].categoria;

  const camposCompeticiones = competicionesActivas(d)
    .map((comp, i) => renderCompeticionCampos(d, comp, i))
    .join('');

  return `
    <div class="modal-overlay" onclick="if(event.target===this) closeNewTorneoModal()">
      <div class="modal-box" style="max-width: 420px; max-height: 88vh; overflow-y: auto;">
        <h3 class="modal-title">${dos ? 'Dos torneos a la vez' : 'Nuevo torneo'}</h3>

        <div class="labeled-field">
          <label>Nombre del torneo</label>
          <input type="text" id="torneo-nombre" placeholder="Torneo de verano" maxlength="60" value="${esc(d.nombre)}" oninput="setTorneoField('nombre', this.value)" />
        </div>

        <div class="labeled-field">
          <label>Categoría</label>
          <select id="torneo-categoria" onchange="setTorneoTipo(this.value)">
            ${CATEGORIAS_TORNEO.map(c => `<option value="${c}" ${!dos && c === tipoActual ? 'selected' : ''}>${capitalizar(c)}</option>`).join('')}
            <option value="dos" ${dos ? 'selected' : ''}>Dos torneos a la vez</option>
          </select>
        </div>

        ${dos ? `<div class="competicion-nota">Los dos torneos comparten fechas y campos. Se juegan por turnos: mientras uno ocupa las pistas, el otro descansa.</div>` : ''}

        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Inicio</label>
            <input type="datetime-local" id="torneo-fecha-inicio" value="${esc(d.fechaInicio)}" oninput="setTorneoField('fechaInicio', this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Fin</label>
            <input type="datetime-local" id="torneo-fecha-fin" value="${esc(d.fechaFin)}" oninput="setTorneoField('fechaFin', this.value)" />
          </div>
        </div>

        ${camposCompeticiones}

        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Puntos por set</label>
            <input type="number" min="1" id="torneo-puntos-set" value="${d.puntosPorSet}" onchange="setTorneoPuntosPorSet(this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Puntos máximo (tope)</label>
            <input type="number" min="1" id="torneo-puntos-maximo" value="${d.puntosMaximo}" onchange="setTorneoPuntosMaximo(this.value)" />
          </div>
        </div>
        <div class="competicion-nota">Cada set se gana con 2 puntos de ventaja a partir de los puntos por set; para que no se alargue, al llegar al tope se gana aunque sea por 1 (p.ej. a 15 con tope 21: gana 15-13, 18-16 o 21-20).</div>

        <div class="labeled-field">
          <label>Número de sets por partido (eliminatorias; en fase de grupos se juega un único set)</label>
          <input type="number" min="1" step="2" id="torneo-num-sets" value="${d.numSets}" onchange="setTorneoNumSets(this.value)" />
        </div>

        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Nº de campos disponibles</label>
            <input type="number" min="1" id="torneo-num-campos" value="${d.numCampos}" onchange="setTorneoNumCampos(this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Duración por partido (min)</label>
            <input type="number" min="1" id="torneo-duracion-partido" value="${d.duracionPartidoMin}" onchange="setTorneoDuracionPartido(this.value)" />
          </div>
        </div>

        <div class="labeled-field">
          <label>🍽️ Pausa para comer (opcional)</label>
        </div>
        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Inicio de la comida</label>
            <input type="time" id="torneo-comida-inicio" value="${esc(d.comidaInicio)}" oninput="setTorneoField('comidaInicio', this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Fin de la comida</label>
            <input type="time" id="torneo-comida-fin" value="${esc(d.comidaFin)}" oninput="setTorneoField('comidaFin', this.value)" />
          </div>
        </div>

        ${validacion.valid ? '' : `<div class="modal-error">${validacion.error}</div>`}

        <div class="modal-actions">
          <button class="modal-btn cancel" onclick="closeNewTorneoModal()">Cancelar</button>
          <button class="modal-btn confirm" ${validacion.valid ? '' : 'disabled'} onclick="confirmNewTorneo()">${dos ? 'Crear los dos' : 'Crear torneo'}</button>
        </div>
      </div>
    </div>
  `;
}

function renderEditarTorneoModal() {
  if (!showEditarTorneoModal) return '';
  const d = editTorneoData;
  const torneo = getTorneo(d.torneoId);
  if (!torneo) return '';

  const errorComp = validarCompeticion({ numGrupos: d.numGrupos, clasificadosPorGrupo: d.clasificadosPorGrupo, numEquipos: d.equipos.length })
    || validarComida(d.comidaInicio, d.comidaFin)
    || validarFormatoPartido(d);
  const hayBloque = !!torneo.bloqueId;
  const hayGrupos = !!torneo.grupos;

  const equiposInputs = d.equipos.map((e, idx) => `
    <div class="equipo-editable-row">
      <input type="text" class="equipo-input-row" placeholder="Equipo ${idx + 1}" maxlength="30" value="${esc(e.nombre)}" oninput="setEditTorneoEquipoNombre(${idx}, this.value)" style="flex:1; margin-bottom:0;" />
      ${d.equipos.length > 2 ? `<button class="delete-torneo" type="button" onclick="removeEditTorneoEquipo(${idx})" title="Quitar equipo">✕</button>` : ''}
    </div>
  `).join('');

  return `
    <div class="modal-overlay" onclick="if(event.target===this) closeEditarTorneoModal()">
      <div class="modal-box" style="max-width: 420px; max-height: 88vh; overflow-y: auto;">
        <h3 class="modal-title">Editar torneo</h3>

        ${hayBloque ? `<div class="competicion-nota">Nombre, fechas, campos y duración se aplican a los dos torneos que se juegan a la vez.</div>` : ''}
        ${hayGrupos ? `<div class="competicion-nota" style="color:var(--coral); background:rgba(232,105,74,0.08);">⚠️ Los grupos ya están sorteados. Cambiar los equipos, el número de grupos o los clasificados por grupo forzará un nuevo sorteo y se perderán los resultados actuales. Renombrar un equipo sin añadir ni quitar ninguno no afecta al sorteo.</div>` : ''}

        <div class="labeled-field">
          <label>Nombre del torneo</label>
          <input type="text" maxlength="60" value="${esc(d.nombre)}" oninput="setEditTorneoField('nombre', this.value)" />
        </div>

        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Inicio</label>
            <input type="datetime-local" value="${esc(d.fechaInicio)}" oninput="setEditTorneoField('fechaInicio', this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Fin</label>
            <input type="datetime-local" value="${esc(d.fechaFin)}" oninput="setEditTorneoField('fechaFin', this.value)" />
          </div>
        </div>

        <div class="labeled-field">
          <label>Equipos</label>
          ${equiposInputs}
          <button class="add-equipo-btn" type="button" onclick="addEditTorneoEquipo()">+ Añadir equipo</button>
        </div>

        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Nº de grupos</label>
            <select onchange="setEditTorneoNumGrupos(this.value)">
              ${opcionesNumGrupos(d.equipos.length).map(n => `<option value="${n}" ${n === d.numGrupos ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Clasifican por grupo</label>
            <select onchange="setEditTorneoClasificados(this.value)">
              ${opcionesClasificados(d.equipos.length, d.numGrupos).map(n => `<option value="${n}" ${n === d.clasificadosPorGrupo ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="labeled-field">
          <label>Partidos en fase de grupos (orientativo, siempre se juega todos contra todos)</label>
          <input type="number" min="0" value="${d.numPartidosGrupo}" onchange="setEditTorneoNumPartidos(this.value)" />
        </div>

        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Puntos por set</label>
            <input type="number" min="1" value="${d.puntosPorSet}" onchange="setEditTorneoPuntosPorSet(this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Puntos máximo (tope)</label>
            <input type="number" min="1" value="${d.puntosMaximo}" onchange="setEditTorneoPuntosMaximo(this.value)" />
          </div>
        </div>
        <div class="competicion-nota">Cada set se gana con 2 puntos de ventaja a partir de los puntos por set; para que no se alargue, al llegar al tope se gana aunque sea por 1 (p.ej. a 15 con tope 21: gana 15-13, 18-16 o 21-20).</div>

        <div class="labeled-field">
          <label>Número de sets por partido (eliminatorias; en fase de grupos se juega un único set)</label>
          <input type="number" min="1" step="2" value="${d.numSets}" onchange="setEditTorneoNumSets(this.value)" />
        </div>

        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Nº de campos disponibles</label>
            <input type="number" min="1" value="${d.numCampos}" onchange="setEditTorneoNumCampos(this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Duración por partido (min)</label>
            <input type="number" min="1" value="${d.duracionPartidoMin}" onchange="setEditTorneoDuracionPartido(this.value)" />
          </div>
        </div>

        <div class="labeled-field">
          <label>🍽️ Pausa para comer (opcional)</label>
        </div>
        <div style="display:flex; gap:10px;">
          <div class="labeled-field" style="flex:1;">
            <label>Inicio de la comida</label>
            <input type="time" value="${esc(d.comidaInicio)}" oninput="setEditTorneoField('comidaInicio', this.value)" />
          </div>
          <div class="labeled-field" style="flex:1;">
            <label>Fin de la comida</label>
            <input type="time" value="${esc(d.comidaFin)}" oninput="setEditTorneoField('comidaFin', this.value)" />
          </div>
        </div>

        ${errorComp ? `<div class="modal-error">⚠️ ${errorComp}</div>` : ''}

        <div class="modal-actions">
          <button class="modal-btn cancel" onclick="closeEditarTorneoModal()">Cancelar</button>
          <button class="modal-btn confirm" ${errorComp ? 'disabled' : ''} onclick="confirmEditarTorneo()">Guardar cambios</button>
        </div>
      </div>
    </div>
  `;
}

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
  return `
    ${meta}
    <div class="player-row${filaClase}">
      <span class="player-name">${esc(partido.equipoA.nombre)}</span>
      <input type="text" inputmode="numeric" pattern="[0-9]*" id="${idA}" class="player-time-input score-input" style="width:56px; text-align:center;" value="${partido.puntosA != null ? partido.puntosA : ''}" onchange="setResultadoPartidoGrupo('${torneo.id}','${partido.id}', this.value, document.getElementById('${idB}').value)" />
      <span>–</span>
      <input type="text" inputmode="numeric" pattern="[0-9]*" id="${idB}" class="player-time-input score-input" style="width:56px; text-align:center;" value="${partido.puntosB != null ? partido.puntosB : ''}" onchange="setResultadoPartidoGrupo('${torneo.id}','${partido.id}', document.getElementById('${idA}').value, this.value)" />
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
      setsHtml += `
        <div class="bracket-set-row">
          <span>Set ${s + 1}</span>
          <input type="text" inputmode="numeric" pattern="[0-9]*" class="score-input" id="${idA}" value="${set.puntosA != null ? set.puntosA : ''}" onchange="setResultadoSetEliminatoria('${torneo.id}','${partido.id}',${s}, this.value, document.getElementById('${idB}').value)" />
          <input type="text" inputmode="numeric" pattern="[0-9]*" class="score-input" id="${idB}" value="${set.puntosB != null ? set.puntosB : ''}" onchange="setResultadoSetEliminatoria('${torneo.id}','${partido.id}',${s}, document.getElementById('${idA}').value, this.value)" />
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

