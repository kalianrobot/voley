// Listas del día: acciones sobre redes/jugadores/espera y permisos de gestión.

/* ---------- Acciones sobre una lista concreta ---------- */

function getLista(fecha) {
  return state.listas[fecha];
}

function updateLista(fecha, updater, opts) {
  return update(prev => {
    const actual = prev.listas[fecha] || emptyLista();
    const nueva = typeof updater === 'function' ? updater(actual) : updater;
    return { ...prev, listas: { ...prev.listas, [fecha]: nueva } };
  }, opts);
}

function openNewRedModal(fecha) {
  newRedData = { fecha, nombre: '', balon: '', lineas: '' };
  showNewRedModal = true;
  render();
}

function closeNewRedModal() {
  showNewRedModal = false;
  render();
}

async function confirmNewRed() {
  const { fecha, nombre, balon, lineas } = newRedData;
  if (!nombre.trim() || !balon.trim() || !lineas.trim()) {
    alert('Debe rellenar el nombre del creador, balón y líneas');
    return;
  }

  let nuevoNumero = 0;
  await updateLista(fecha, prev => {
    nuevoNumero = prev.redes.length + 1;
    const nuevaRed = newRed(nuevoNumero);
    nuevaRed.materiales.balon = balon;
    nuevaRed.materiales.lineas = lineas;
    nuevaRed.materiales.red = nombre;
    const capacidad = capacityForRed(nuevaRed);

    const esperaOrdenada = [...(prev.espera || [])].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const aPromover = esperaOrdenada.slice(0, capacidad - 1);
    const idsPromovidos = new Set(aPromover.map(p => p.id));

    nuevaRed.jugadores = aPromover.slice();

    const creador = { id: uid(), nombre, hora: '—', ts: Date.now(), owner: DEVICE_ID };
    nuevaRed.jugadores.unshift(creador);

    if (balon.trim() !== nombre && nuevaRed.jugadores.length < capacidad) {
      nuevaRed.jugadores.push({ id: uid(), nombre: balon, hora: '—', ts: Date.now(), owner: DEVICE_ID });
    }

    if (lineas.trim() !== nombre && lineas.trim() !== balon && nuevaRed.jugadores.length < capacidad) {
      nuevaRed.jugadores.push({ id: uid(), nombre: lineas, hora: '—', ts: Date.now(), owner: DEVICE_ID });
    }

    return {
      ...prev,
      espera: (prev.espera || []).filter(p => !idsPromovidos.has(p.id)),
      redes: [...prev.redes, nuevaRed],
      historial: agregarHistorial(prev.historial, `🏐 ${nombre} creó la ${nuevoNumero}ª red`)
    };
  });

  showNewRedModal = false;
  showNotify(`🏐 Nueva ${nuevoNumero}ª red abierta por ${nombre}. ¡Apuntaos aquí! ${urlParaFecha(fecha)}`);
}

function sendConvocatoria(fecha) {
  showNotify(`📣 Lista abierta ${formatFechaLarga(fecha)}. ¡Apúntate aquí! ${urlParaFecha(fecha)}`);
}
function deleteRed(fecha, id) {
  const lista = getLista(fecha);
  const red = lista.redes.find(r => r.id === id);
  const etiqueta = red ? `la ${red.numero}ª red` : 'esta red';
  if (!confirm(`¿Seguro que quieres borrar ${etiqueta}? Se perderán todos sus jugadores y lista de espera.`)) return;
  updateLista(fecha, prev => ({
    ...prev,
    redes: prev.redes.filter(r => r.id !== id).map((r, i) => ({ ...r, numero: i + 1 }))
  }));
  showNotify(`⚠️ Se ha borrado ${etiqueta} del ${formatFechaLarga(fecha)}.`);
}

function deleteLista(fecha) {
  if (!confirm(`¿Borrar toda la lista del ${formatFechaLarga(fecha)}? Se perderá todo lo apuntado.`)) return;
  update(prev => {
    const listas = { ...prev.listas };
    delete listas[fecha];
    return { ...prev, listas };
  });
  goToCalendar();
  showNotify(`🗑️ Se ha borrado la lista completa del ${formatFechaLarga(fecha)}.`);
}

function setLugar(fecha, val) {
  updateLista(fecha, prev => ({ ...prev, lugar: val }), { render: false });
}

function setMaterial(fecha, redId, tipo, nombre) {
  updateLista(fecha, prev => ({
    ...prev,
    redes: prev.redes.map(r => r.id === redId
      ? { ...r, materiales: { ...r.materiales, [tipo]: nombre } }
      : r)
  }));
}

function joinRed(fecha, redId, nombre, hora) {
  updateLista(fecha, prev => {
    const entry = { id: uid(), nombre, hora, ts: Date.now(), owner: DEVICE_ID };
    const red = prev.redes.find(r => r.id === redId);
    if (red && red.jugadores.length < capacityForRed(red)) {
      return {
        ...prev,
        redes: prev.redes.map(r => r.id === redId
          ? { ...r, jugadores: [...r.jugadores, entry] }
          : r)
      };
    }
    // Red llena: solo se admite pasar a la espera si NINGUNA red tiene hueco.
    if (hayRedConHueco(prev.redes)) return prev;
    return { ...prev, espera: [...(prev.espera || []), entry] };
  });
}

function updateHora(fecha, redId, entryId, nuevaHora) {
  const hora = nuevaHora || '—';
  updateLista(fecha, prev => ({
    ...prev,
    redes: prev.redes.map(r => r.id !== redId ? r : {
      ...r,
      jugadores: r.jugadores.map(p => p.id === entryId ? { ...p, hora } : p)
    })
  }));
}

function updateHoraEspera(fecha, entryId, nuevaHora) {
  const hora = nuevaHora || '—';
  updateLista(fecha, prev => ({
    ...prev,
    espera: (prev.espera || []).map(p => p.id === entryId ? { ...p, hora } : p)
  }));
}

async function removeFromRed(fecha, redId, entryId) {
  const lista = getLista(fecha);
  const red = lista.redes.find(r => r.id === redId);
  const persona = red?.jugadores.find(p => p.id === entryId);
  const nombre = persona ? persona.nombre : 'esta persona';

  if (!red || !puedeGestionarRed(red, persona)) {
    alert('Solo esa persona, el creador de la red o un admin pueden quitar a alguien.');
    return;
  }

  const esPropia = persona && persona.owner === DEVICE_ID;
  const aviso = esPropia
    ? `Para quitarte de la ${red.numero}ª red, escribe tu nombre exacto:`
    : `Para quitar a ${nombre} de la ${red.numero}ª red, escribe su nombre exacto:`;
  const escrito = prompt(aviso);
  if (escrito === null) return;
  if (escrito.trim() !== nombre.trim()) {
    alert('El nombre no coincide. No se ha quitado a nadie.');
    return;
  }

  const textoHistorial = esPropia
    ? `➖ ${nombre} se quitó de la ${red.numero}ª red`
    : `➖ Se quitó a ${nombre} de la ${red.numero}ª red`;

  let nombrePromovido = null;
  await updateLista(fecha, prev => {
    const esperaOrdenada = [...(prev.espera || [])].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (esperaOrdenada.length > 0) nombrePromovido = esperaOrdenada[0].nombre;
    return {
      ...prev,
      espera: esperaOrdenada.slice(1),
      redes: prev.redes.map(r => {
        if (r.id !== redId) return r;
        const jugadores = r.jugadores.filter(e => e.id !== entryId);
        if (esperaOrdenada.length > 0) jugadores.push(esperaOrdenada[0]);
        return { ...r, jugadores };
      }),
      historial: agregarHistorial(prev.historial, textoHistorial)
    };
  });

  let mensaje = `❌ ${nombre} se ha quitado de la ${red?.numero}ª red del ${formatFechaLarga(fecha)}.`;
  if (nombrePromovido) {
    mensaje += ` ✅ ${nombrePromovido} subió automáticamente de la lista de espera.`;
  }
  showNotify(mensaje);
}

function removeFromEspera(fecha, entryId) {
  const lista = getLista(fecha);
  const persona = (lista.espera || []).find(p => p.id === entryId);
  const nombre = persona ? persona.nombre : 'esta persona';

  if (!puedeGestionarEspera(lista, persona)) {
    alert('Solo esa persona, el creador de una red o un admin pueden quitar a alguien.');
    return;
  }

  const esPropia = persona && persona.owner === DEVICE_ID;
  const aviso = esPropia
    ? 'Para quitarte de la lista de espera, escribe tu nombre exacto:'
    : `Para quitar a ${nombre} de la lista de espera, escribe su nombre exacto:`;
  const escrito = prompt(aviso);
  if (escrito === null) return;
  if (escrito.trim() !== nombre.trim()) {
    alert('El nombre no coincide. No se ha quitado a nadie.');
    return;
  }

  const textoHistorial = esPropia
    ? `➖ ${nombre} se quitó de la lista de espera`
    : `➖ Se quitó a ${nombre} de la lista de espera`;

  updateLista(fecha, prev => ({
    ...prev,
    espera: (prev.espera || []).filter(p => p.id !== entryId),
    historial: agregarHistorial(prev.historial, textoHistorial)
  }));
}

function getAllMembers(lista) {
  const set = new Set();
  const redes = (lista && Array.isArray(lista.redes)) ? lista.redes : [];
  redes.forEach(r => (r.jugadores || []).forEach(j => set.add(j.nombre)));
  (lista && lista.espera || []).forEach(j => set.add(j.nombre));
  return [...set].sort();
}


/* ---------- Permisos: quién puede quitar a quién ---------- */

// Redes sin creatorOwner son de antes de esta funcionalidad: se mantiene
// el comportamiento anterior (cualquiera puede gestionarlas) para no
// bloquear listas ya existentes.
function puedeGestionarRed(red, persona) {
  if (isAdmin) return true;
  if (persona && persona.owner === DEVICE_ID) return true;
  if (!red.creatorOwner) return true;
  return red.creatorOwner === DEVICE_ID;
}

function puedeGestionarEspera(lista, persona) {
  if (isAdmin) return true;
  if (persona && persona.owner === DEVICE_ID) return true;
  const redesConCreador = (lista.redes || []).filter(r => r.creatorOwner);
  if (redesConCreador.length === 0) return true;
  return redesConCreador.some(r => r.creatorOwner === DEVICE_ID);
}

