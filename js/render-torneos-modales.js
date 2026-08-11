// Render: listado de torneos y modales de creación/edición.

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
