// Render: chips/redes, calendario y vista de lista de un día.

/* ---------- Render: chips, redes ---------- */

function renderMaterialChip(fecha, redId, icon, label, tipo, value, options) {
  const opts = ['<option value="">—</option>']
    .concat(options.map(name => `<option value="${esc(name)}" ${name === value ? 'selected' : ''}>${esc(name)}</option>`));
  if (value && !options.includes(value)) {
    opts.push(`<option value="${esc(value)}" selected>${esc(value)}</option>`);
  }
  return `
    <div class="material-chip">
      <span>${icon}</span>
      <span class="label">${label}:</span>
      <select onchange="setMaterial('${fecha}','${redId}','${tipo}', this.value)">
        ${opts.join('')}
      </select>
    </div>
  `;
}

function renderRed(fecha, red, allMembers, hayHuecoEnOtraRed) {
  // En las sedes de red fija (Echevarri) la red ya está puesta: solo se apunta
  // quién trae balón y líneas, y la red ni se nombra como "1ª" ni se borra.
  const redFija = infoSede(fecha).redFija;
  const capacidad = capacityForRed(red);
  const isClosed = red.jugadores.length >= capacidad;
  const slotsLeft = capacidad - red.jugadores.length;
  const bloqueadaPorHuecos = isClosed && hayHuecoEnOtraRed;

  let playersHtml = '';
  for (let i = 0; i < capacidad; i++) {
    const p = red.jugadores[i];
    if (p) {
      const removeBtn = puedeGestionarRed(red, p)
        ? `<button class="player-remove" onclick="removeFromRed('${fecha}','${red.id}','${p.id}')" title="Quitar">✕</button>`
        : '';
      playersHtml += `
        <div class="player-row">
          <span class="player-slot-num">${i + 1}</span>
          <span class="player-name">${esc(p.nombre)}</span>
          <input type="time" lang="es" class="player-time-input" value="${esc(p.hora === '—' ? '' : p.hora)}" onchange="updateHora('${fecha}','${red.id}','${p.id}', this.value)" />
          ${removeBtn}
        </div>`;
    } else {
      playersHtml += `<div class="empty-slot">${i + 1}. libre</div>`;
    }
  }

  const nameInputId = `name-${red.id}`;
  const timeInputId = `time-${red.id}`;
  const placeholder = bloqueadaPorHuecos
    ? 'Red llena, únete a una red con hueco'
    : (isClosed ? 'Tu nombre (lista de espera)' : 'Tu nombre');
  const btnLabel = isClosed ? 'A la espera' : 'Apuntarme';

  return `
    <div class="red-card ${isClosed ? 'closed' : ''}">
      <div class="red-head">
        <div class="red-name-row">
          <span class="red-number">${redFija ? 'Red del parque' : `${red.numero}ª red`}</span>
          <span class="red-status ${isClosed ? 'closed-tag' : 'open'}">
            ${isClosed ? 'Cerrada' : `${slotsLeft} libre${slotsLeft !== 1 ? 's' : ''}`}
          </span>
        </div>
        ${redFija ? '' : `<button class="delete-red" onclick="deleteRed('${fecha}','${red.id}')" title="Borrar red">✕</button>`}
      </div>

      <div class="materials-row">
        ${renderMaterialChip(fecha, red.id, '🏐', 'Balón', 'balon', red.materiales.balon, allMembers)}
        ${redFija ? '' : renderMaterialChip(fecha, red.id, '🥅', 'Red', 'red', red.materiales.red, allMembers)}
        ${renderMaterialChip(fecha, red.id, '〜', 'Líneas', 'lineas', red.materiales.lineas, allMembers)}
      </div>

      <div class="players-list">
        ${playersHtml}
      </div>

      <div class="join-form">
        <input type="text" id="${nameInputId}" placeholder="${placeholder}" maxlength="30" ${bloqueadaPorHuecos ? 'disabled' : ''} onkeydown="if(event.key==='Enter'){event.preventDefault(); handleJoinClick('${fecha}','${red.id}','${nameInputId}','${timeInputId}');}" />
        <input type="time" lang="es" id="${timeInputId}" ${bloqueadaPorHuecos ? 'disabled' : ''} />
        <button class="join-btn" type="button" ${bloqueadaPorHuecos ? 'disabled' : ''} onclick="handleJoinClick('${fecha}','${red.id}','${nameInputId}','${timeInputId}')">${bloqueadaPorHuecos ? 'Red llena' : btnLabel}</button>
      </div>
    </div>
  `;
}

function renderEsperaGlobal(fecha, lista) {
  const espera = (lista.espera || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (espera.length === 0) return '';
  return `
    <div class="waitlist-global">
      <div class="waitlist-title">⏳ Lista de espera general (${espera.length})</div>
      ${espera.map((p, i) => `
        <div class="waitlist-row">
          <span class="player-slot-num">${i + 1}</span>
          <span class="player-name">${esc(p.nombre)}</span>
          <input type="time" lang="es" class="player-time-input" value="${esc(p.hora === '—' ? '' : p.hora)}" onchange="updateHoraEspera('${fecha}','${p.id}', this.value)" />
          ${puedeGestionarEspera(lista, p) ? `<button class="player-remove" onclick="removeFromEspera('${fecha}','${p.id}')" title="Quitar">✕</button>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderHistorial(lista) {
  const historial = lista.historial || [];
  if (historial.length === 0) return '';
  const ordenado = [...historial].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const filas = ordenado.map(h => `
    <div class="historial-row">
      <span class="historial-hora">${new Date(h.ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
      <span class="historial-texto">${esc(h.texto)}</span>
    </div>
  `).join('');
  return `
    <div class="historial-section">
      <button class="historial-toggle" onclick="toggleHistorial()">
        📜 Historial (${historial.length}) ${showHistorial ? '▲' : '▼'}
      </button>
      ${showHistorial ? `<div class="historial-list">${filas}</div>` : ''}
    </div>
  `;
}

function handleJoinClick(fecha, redId, nameInputId, timeInputId) {
  const nameInput = document.getElementById(nameInputId);
  const timeInput = document.getElementById(timeInputId);
  if (!nameInput) {
    console.error('No se encontro el input de nombre', nameInputId);
    return;
  }
  const nombre = nameInput.value.trim();
  if (!nombre) {
    nameInput.focus();
    return;
  }
  const hora = (timeInput && timeInput.value) || '—';
  joinRed(fecha, redId, nombre, hora);
  nameInput.value = '';
  if (timeInput) timeInput.value = '';
}

function handleJoinEspera(fecha, nameInputId, timeInputId) {
  const nameInput = document.getElementById(nameInputId);
  const timeInput = document.getElementById(timeInputId);
  if (!nameInput) return;
  const nombre = nameInput.value.trim();
  if (!nombre) {
    nameInput.focus();
    return;
  }
  const hora = (timeInput && timeInput.value) || '—';
  updateLista(fecha, prev => ({
    ...prev,
    espera: [...(prev.espera || []), { id: uid(), nombre, hora, ts: Date.now(), owner: DEVICE_ID }]
  }));
  nameInput.value = '';
  if (timeInput) timeInput.value = '';
  showNotify(`✅ ${nombre} se ha apuntado a la lista de espera del ${descripcionLista(fecha)}.`);
}

/* ---------- Render: calendario ---------- */

// Una bolita por red: 🔴 llena, 🟢 con hueco.
function indicadoresRedes(lista) {
  return (lista.redes || []).map(red => red.jugadores.length >= capacityForRed(red) ? '🔴' : '🟢');
}

function renderCalendar() {
  const { calYear, calMonth } = view;
  const today = todayStr();

  const firstOfMonth = new Date(calYear, calMonth, 1);
  let startWeekday = firstOfMonth.getDay(); // 0=domingo
  startWeekday = (startWeekday + 6) % 7; // convertir a 0=lunes

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    const dayNum = daysInPrevMonth - startWeekday + i + 1;
    cells.push({ dayNum, inMonth: false, key: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = formatDateKey(new Date(calYear, calMonth, d));
    cells.push({ dayNum: d, inMonth: true, key });
  }
  while (cells.length % 7 !== 0) {
    const idx = cells.length - (startWeekday + daysInMonth);
    cells.push({ dayNum: idx + 1, inMonth: false, key: null });
  }

  const daysHtml = cells.map(cell => {
    // Listas de este día, una por sede (en el orden de SEDES_ORDEN).
    const listasDia = cell.key
      ? SEDES_ORDEN
          .map(sede => ({ sede, clave: claveLista(cell.key, sede), lista: state.listas[claveLista(cell.key, sede)] }))
          .filter(x => x.lista)
      : [];
    const hasList = listasDia.length > 0;
    const ambas = listasDia.length > 1;
    const torneosDia = cell.key ? torneosEnFecha(cell.key) : [];
    const hasTorneo = torneosDia.length > 0;
    const isToday = cell.key === today;
    const classes = ['cal-day'];
    if (cell.inMonth) classes.push('in-month');
    if (hasList) classes.push('has-list', ambas ? 'sede-ambas' : `sede-${listasDia[0].sede}`);
    if (hasTorneo) classes.push('has-torneo');
    if (isToday) classes.push('is-today');

    let onclick = '';
    if (ambas) onclick = `onclick="openListaDia('${cell.key}', event)"`;
    else if (hasList) onclick = `onclick="openLista('${listasDia[0].clave}')"`;

    const torneoMarca = hasTorneo ? `<span class="cal-day-torneo" title="${esc(torneosDia.map(nombreTorneo).join(', '))}">🏆</span>` : '';

    // Día con las dos sedes: celda partida en diagonal. El número queda en el
    // centro y las bolitas de cada sede en su mitad (playa arriba a la
    // izquierda, la otra abajo a la derecha); sin textos para que quepa.
    if (ambas) {
      const mitades = listasDia.map((x, i) => {
        const espera = (x.lista.espera || []).length;
        return `<div class="cal-split ${i === 0 ? 'cal-split-a' : 'cal-split-b'}" title="${esc(SEDES[x.sede].nombre)}">${indicadoresRedes(x.lista).join('')}${espera > 0 ? `<span class="cal-split-espera">+${espera}</span>` : ''}</div>`;
      }).join('');
      return `<div class="${classes.join(' ')}" ${onclick}><span class="cal-day-num">${cell.dayNum}</span>${torneoMarca}${mitades}</div>`;
    }

    let sedeMarca = '';
    let indicadores = '';
    let esperaCount = '';
    if (hasList) {
      const { sede, lista } = listasDia[0];
      sedeMarca = `<span class="cal-day-sede" title="${esc(SEDES[sede].nombre)}">${SEDES[sede].icono}</span>`;
      const ind = indicadoresRedes(lista);
      indicadores = ind.length > 0 ? `<div class="cal-day-indicators">${ind.join(' ')}</div>` : '';

      if (lista.espera && lista.espera.length > 0) {
        esperaCount = `<div class="cal-day-espera">${lista.espera.length} en espera</div>`;
      }
    }

    return `<div class="${classes.join(' ')}" ${onclick}>${cell.dayNum}${sedeMarca}${torneoMarca}${indicadores}${esperaCount}</div>`;
  }).join('');

  const weekdaysHtml = DIAS_SEMANA.map(d => `<div class="cal-weekday">${d}</div>`).join('');

  return `
    <div class="main">
      <div class="cal-toolbar">
        <button class="cal-nav-btn" onclick="calPrevMonth()">‹</button>
        <span class="cal-month-label">${MESES[calMonth]} ${calYear}</span>
        <button class="cal-nav-btn" onclick="calNextMonth()">›</button>
      </div>
      <div class="calendar-grid">
        <div class="cal-weekdays">${weekdaysHtml}</div>
        <div class="cal-days">${daysHtml}</div>
      </div>
      <button class="add-list-btn" onclick="openNewListModal()">+ Nueva lista</button>
      ${isAdmin ? `<button class="add-list-btn" style="margin-top: 10px;" onclick="openNewTorneoModal()">+ Nuevo torneo</button>` : ''}
      ${isAdmin
        ? `<button class="admin-toggle active" onclick="logoutAdmin()">🔓 Admin activo · salir</button>`
        : `<button class="admin-toggle" onclick="loginAdmin()">🔑 Modo admin</button>`}
    </div>
  `;
}

function renderNewListModal() {
  if (!showNewListModal) return '';
  const fecha = newListData.fecha || todayStr();
  const sedesHtml = SEDES_ORDEN.map(id => `
    <button type="button" class="sede-choice sede-${id} ${newListData.sede === id ? 'active' : ''}" onclick="setNewListSede('${id}')">
      <span class="sede-choice-icon">${SEDES[id].icono}</span>${SEDES[id].nombre}
    </button>`).join('');
  return `
    <div class="modal-overlay" onclick="if(event.target===this) closeNewListModal()">
      <div class="modal-box">
        <h3 class="modal-title">Nueva lista</h3>
        <div class="sede-choices">${sedesHtml}</div>
        <input type="date" id="new-list-date" value="${esc(fecha)}" onchange="newListData.fecha = this.value" />
        <div class="modal-actions">
          <button class="modal-btn cancel" onclick="closeNewListModal()">Cancelar</button>
          <button class="modal-btn confirm" onclick="confirmNewList()">Crear</button>
        </div>
      </div>
    </div>
  `;
}

function renderNewRedModal() {
  if (!showNewRedModal) return '';
  return `
    <div class="modal-overlay" onclick="if(event.target===this) closeNewRedModal()">
      <div class="modal-box">
        <h3 class="modal-title">Nueva red</h3>
        <p style="font-size:12px; color:var(--sea); margin:-6px 0 14px;">Puedes poner una persona distinta para cada cosa; las tres se añaden a la lista.</p>
        <div style="margin-bottom: 12px;">
          <label style="font-size:12px; font-weight:600; color:var(--sea); display:block; margin-bottom:4px;">Red (quien la lleva)</label>
          <input type="text" id="red-nombre" placeholder="Tu nombre" maxlength="30" style="width:100%; border:1px solid var(--line); border-radius:10px; padding:9px 12px; font-family:'Sora',sans-serif; font-size:14px; outline:none; background:var(--sand);" />
        </div>
        <div style="margin-bottom: 12px;">
          <label style="font-size:12px; font-weight:600; color:var(--sea); display:block; margin-bottom:4px;">Balón (quien lo lleva)</label>
          <input type="text" id="red-balon" placeholder="Nombre de quien trae el balón" maxlength="30" style="width:100%; border:1px solid var(--line); border-radius:10px; padding:9px 12px; font-family:'Sora',sans-serif; font-size:14px; outline:none; background:var(--sand);" />
        </div>
        <div style="margin-bottom: 18px;">
          <label style="font-size:12px; font-weight:600; color:var(--sea); display:block; margin-bottom:4px;">Líneas (quien las lleva)</label>
          <input type="text" id="red-lineas" placeholder="Nombre de quien trae las líneas" maxlength="30" style="width:100%; border:1px solid var(--line); border-radius:10px; padding:9px 12px; font-family:'Sora',sans-serif; font-size:14px; outline:none; background:var(--sand);" />
        </div>
        <div class="modal-actions">
          <button class="modal-btn cancel" onclick="closeNewRedModal()">Cancelar</button>
          <button class="modal-btn confirm" onclick="newRedData.nombre = document.getElementById('red-nombre').value; newRedData.balon = document.getElementById('red-balon').value; newRedData.lineas = document.getElementById('red-lineas').value; confirmNewRed();">Crear red</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Render: vista de lista de un dia ---------- */

// Pestañas 🏖️ Playa | 🌳 Echevarri: solo cuando ese día hay lista en las dos
// sedes. Cada pestaña lleva el color de su sede y cuántas personas hay
// apuntadas; la activa va rellena.
function renderSedeTabs(clave) {
  const dia = fechaDeClave(clave);
  const existentes = SEDES_ORDEN.filter(sede => state.listas[claveLista(dia, sede)]);
  if (existentes.length < 2) return '';
  const tabs = existentes.map(sede => {
    const c = claveLista(dia, sede);
    const apuntados = state.listas[c].redes.reduce((n, r) => n + r.jugadores.length, 0);
    return `
      <button type="button" role="tab" aria-selected="${c === clave}" class="sede-tab sede-${sede} ${c === clave ? 'active' : ''}" onclick="openLista('${c}')">
        <span class="sede-tab-icon">${SEDES[sede].icono}</span>
        <span class="sede-tab-name">${SEDES[sede].nombre}</span>
        <span class="sede-tab-count">${apuntados}</span>
      </button>`;
  }).join('');
  return `<div class="sede-tabs" role="tablist">${tabs}</div>`;
}

// `view.fecha` es la clave de la lista (fecha + sede, ver claveLista).
function renderListView() {
  const fecha = view.fecha;
  const sedeInfo = infoSede(fecha);
  const lista = getLista(fecha);

  if (!lista) {
    return `
      <div class="main">
        <button class="back-btn" onclick="goToCalendar()">‹ Calendario</button>
        <div class="empty-state">
          <div class="big">Esta lista ya no existe</div>
        </div>
      </div>
    `;
  }

  const allMembers = getAllMembers(lista);

  let redesHtml = '';
  if (lista.redes.length === 0 && sedeInfo.redFija) {
    // No debería ocurrir (la lista nace con su red y no se borra), pero si
    // pasa, que no se quede sin forma de apuntar a nadie.
    redesHtml = `
      <div class="empty-state">
        <div class="big">Esta lista no tiene red</div>
        <button class="add-red-btn" onclick="crearRedFija('${fecha}')">Crear la red</button>
      </div>`;
  } else if (lista.redes.length === 0) {
    redesHtml = `
      <div class="empty-state">
        <div class="big">Todavía no hay redes</div>
        <div>Crea la primera para empezar a apuntar gente</div>
      </div>
      <div style="margin-top: 24px; padding: 16px; background: rgba(27,94,99,0.06); border-radius: 14px; border: 2px dashed rgba(27,94,99,0.3);">
        <div style="font-size: 13px; font-weight: 600; color: var(--sea); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">O apúntate a la lista de espera</div>
        <div class="join-form" style="padding: 0;">
          <input type="text" id="espera-nombre" placeholder="Tu nombre" maxlength="30" style="flex: 1; border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-family:'Sora',sans-serif; font-size: 14px; outline: none; background: var(--sand);" onkeydown="if(event.key==='Enter'){event.preventDefault(); handleJoinEspera('${fecha}','espera-nombre','espera-hora');}" />
          <input type="time" lang="es" id="espera-hora" style="border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; font-family:'Sora',sans-serif; font-size: 14px; outline: none; background: var(--sand); width: 100px;" />
          <button class="join-btn" type="button" onclick="handleJoinEspera('${fecha}','espera-nombre','espera-hora')" style="flex-shrink: 0;">Apuntarme</button>
        </div>
      </div>`;
  } else {
    const hayHuecos = hayRedConHueco(lista.redes);
    redesHtml = lista.redes.map(red => renderRed(fecha, red, allMembers, hayHuecos)).join('');
  }

  return `
    <div class="header">
      <div class="header-inner">
        <button class="back-btn" onclick="goToCalendar()">‹ Calendario</button>
        <div class="eyebrow">Volea Beach Forever 🏝️</div>
        <div class="list-date-label">${formatFechaLarga(fecha)} <span class="sede-pill sede-${sedeInfo.id}">${sedeInfo.icono} ${sedeInfo.nombre}</span></div>
        <div class="title-row">
          <h1 class="title">Lista del día</h1>
        </div>
        <div class="subtitle-row">
          <div class="field-pill">
            <span class="icon">📍</span>
            <input type="text" id="lugar-input" placeholder="${esc(sedeInfo.placeholderLugar)}" value="${esc(lista.lugar)}" oninput="setLugar('${fecha}', this.value)" />
          </div>
        </div>
      </div>
    </div>

    <div class="main">
      ${renderSedeTabs(fecha)}
      ${sedeInfo.redFija ? '' : `<button class="add-red-btn" onclick="openNewRedModal('${fecha}')">+ Nueva red</button>`}
      <button class="add-red-btn" style="border-color: var(--coral); color: var(--coral); margin-top: 10px;" onclick="sendConvocatoria('${fecha}')">📣 Enviar convocatoria a WhatsApp</button>
      ${redesHtml}
      ${renderEsperaGlobal(fecha, lista)}
      ${renderHistorial(lista)}
      <button class="back-btn" style="background:rgba(232,105,74,0.1); border-color:rgba(232,105,74,0.3); color:var(--coral); margin-top:8px;" onclick="deleteLista('${fecha}')">🗑 Borrar esta lista</button>
    </div>
  `;
}

