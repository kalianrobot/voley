// Previsión del tiempo y del viento por sede, sacada de Open-Meteo
// (https://open-meteo.com, gratis para uso no comercial, sin clave; datos
// CC BY 4.0, por eso se cita la fuente en la tarjeta).
//
// Se pide desde el navegador, sin pasar por Firestore: una petición por sede
// con la previsión horaria y diaria de los próximos 16 días. La respuesta se
// guarda en memoria y en localStorage y se vuelve a pedir cuando tiene más de
// una hora (los modelos se actualizan varias veces al día), al volver a la
// pestaña y con un repaso cada 15 minutos.
//
// La "hora de la lista" es la hora a la que más gente dice que va (la hora que
// ponen al apuntarse); si nadie ha puesto hora se usa el resumen del día.

const TIEMPO_SEDES = {
  playa: { lat: 43.3405, lon: -3.0115, nombre: 'Ereaga' },
  echevarri: { lat: 43.2475, lon: -2.8900, nombre: 'Echevarri' }
};
const TIEMPO_MAX_EDAD = 60 * 60 * 1000;      // 1 h
const TIEMPO_REPASO = 15 * 60 * 1000;        // cada cuánto se comprueba si toca refrescar
const TIEMPO_STORAGE = 'volea-tiempo-v1';
const TIEMPO_HORAS_FRANJA = [9, 22];         // franja que se enseña en la vista del día
const VIENTO_FUERTE = 25;                    // km/h medios a partir de los que se avisa
const RACHAS_FUERTES = 40;                   // km/h de racha a partir de los que se avisa

// { [sede]: { ts, horas: { 'YYYY-MM-DDTHH:00': {...} }, dias: { 'YYYY-MM-DD': {...} } } }
let tiempoCache = cargarTiempoGuardado();
let tiempoPidiendo = false;
let tiempoError = false;   // la última petición falló y no hay nada guardado

function cargarTiempoGuardado() {
  try {
    const raw = localStorage.getItem(TIEMPO_STORAGE);
    return raw ? JSON.parse(raw) || {} : {};
  } catch (e) {
    return {};
  }
}

function guardarTiempo() {
  try { localStorage.setItem(TIEMPO_STORAGE, JSON.stringify(tiempoCache)); } catch (e) { /* sin storage: solo memoria */ }
}

function urlTiempo({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
    timezone: 'Europe/Madrid',
    wind_speed_unit: 'kmh',
    forecast_days: '16'
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

// Pasa las columnas de Open-Meteo (un array por variable) a objetos por hora/día.
function transformarTiempo(json) {
  const horas = {};
  const h = json.hourly || {};
  (h.time || []).forEach((t, i) => {
    horas[t] = {
      temp: h.temperature_2m?.[i],
      probLluvia: h.precipitation_probability?.[i],
      lluvia: h.precipitation?.[i],
      codigo: h.weather_code?.[i],
      viento: h.wind_speed_10m?.[i],
      rachas: h.wind_gusts_10m?.[i],
      dirViento: h.wind_direction_10m?.[i],
      esDia: h.is_day?.[i] !== 0
    };
  });
  const dias = {};
  const d = json.daily || {};
  (d.time || []).forEach((t, i) => {
    dias[t] = {
      codigo: d.weather_code?.[i],
      max: d.temperature_2m_max?.[i],
      min: d.temperature_2m_min?.[i],
      probLluvia: d.precipitation_probability_max?.[i],
      viento: d.wind_speed_10m_max?.[i],
      rachas: d.wind_gusts_10m_max?.[i],
      dirViento: d.wind_direction_10m_dominant?.[i],
      esDia: true
    };
  });
  return { ts: Date.now(), horas, dias };
}

function tiempoCaducado(sede) {
  const c = tiempoCache[sede];
  return !c || !c.ts || Date.now() - c.ts > TIEMPO_MAX_EDAD;
}

async function refrescarTiempo(forzar = false) {
  if (tiempoPidiendo) return;
  const pendientes = Object.keys(TIEMPO_SEDES).filter(s => forzar || tiempoCaducado(s));
  if (pendientes.length === 0) return;
  tiempoPidiendo = true;
  let cambio = false;
  await Promise.all(pendientes.map(async sede => {
    try {
      const res = await fetch(urlTiempo(TIEMPO_SEDES[sede]));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      tiempoCache[sede] = transformarTiempo(await res.json());
      cambio = true;
    } catch (e) {
      console.error('Error pidiendo el tiempo de', sede, e);
    }
  }));
  tiempoPidiendo = false;
  tiempoError = !cambio;
  if (cambio) guardarTiempo();
  // Igual que con Firestore: no repintar mientras alguien escribe (se perdería
  // el foco); lo nuevo saldrá en el siguiente render.
  const activo = document.activeElement;
  if (typeof loading !== 'undefined' && !loading && !(activo && activo.tagName === 'INPUT')) render();
}

function iniciarTiempo() {
  refrescarTiempo();
  setInterval(() => refrescarTiempo(), TIEMPO_REPASO);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refrescarTiempo();
  });
}

/* ---------- Consultas ---------- */

function tiempoHora(sede, fecha, hora) {
  const c = tiempoCache[sede];
  if (!c || !c.horas) return null;
  return c.horas[`${fecha}T${String(hora).padStart(2, '0')}:00`] || null;
}

function tiempoDia(sede, fecha) {
  const c = tiempoCache[sede];
  return (c && c.dias && c.dias[fecha]) || null;
}

// Hora (0-23) a la que más gente dice que va; empate → la más temprana.
function horaDeLista(lista) {
  if (!lista) return null;
  const cuenta = {};
  const todos = [...(lista.redes || []).flatMap(r => r.jugadores || []), ...(lista.espera || [])];
  todos.forEach(p => {
    const m = /^(\d{1,2}):\d{2}$/.exec(p.hora || '');
    if (!m) return;
    const h = Number(m[1]);
    if (h >= 0 && h <= 23) cuenta[h] = (cuenta[h] || 0) + 1;
  });
  const horas = Object.keys(cuenta).map(Number);
  if (horas.length === 0) return null;
  horas.sort((a, b) => (cuenta[b] - cuenta[a]) || (a - b));
  return horas[0];
}

/* ---------- Formato ---------- */

// Códigos WMO que devuelve Open-Meteo.
function iconoTiempo(codigo, esDia = true) {
  if (codigo == null) return '❔';
  if (codigo === 0) return esDia ? '☀️' : '🌙';
  if (codigo === 1) return esDia ? '🌤️' : '🌙';
  if (codigo === 2) return '⛅';
  if (codigo === 3) return '☁️';
  if (codigo === 45 || codigo === 48) return '🌫️';
  if (codigo >= 51 && codigo <= 57) return '🌦️';
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return '🌧️';
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return '🌨️';
  if (codigo >= 95) return '⛈️';
  return '🌡️';
}

function textoTiempo(codigo) {
  if (codigo == null) return '';
  if (codigo === 0) return 'Despejado';
  if (codigo === 1) return 'Casi despejado';
  if (codigo === 2) return 'Nubes y claros';
  if (codigo === 3) return 'Nublado';
  if (codigo === 45 || codigo === 48) return 'Niebla';
  if (codigo >= 51 && codigo <= 57) return 'Llovizna';
  if (codigo >= 61 && codigo <= 65) return 'Lluvia';
  if (codigo === 66 || codigo === 67) return 'Lluvia helada';
  if (codigo >= 71 && codigo <= 77) return 'Nieve';
  if (codigo >= 80 && codigo <= 82) return 'Chubascos';
  if (codigo === 85 || codigo === 86) return 'Chubascos de nieve';
  if (codigo >= 95) return 'Tormenta';
  return '';
}

// Dirección de la que viene el viento, en puntos cardinales.
function puntoCardinal(grados) {
  if (grados == null) return '';
  const puntos = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return puntos[Math.round(((grados % 360) + 360) % 360 / 45) % 8];
}

// Flecha hacia donde sopla (la dirección meteorológica es de dónde viene).
function flechaViento(grados) {
  if (grados == null) return '';
  return `<span class="viento-flecha" style="transform: rotate(${Math.round(grados)}deg)">↓</span>`;
}

function nivelViento(t) {
  if (!t) return '';
  if ((t.viento ?? 0) >= VIENTO_FUERTE || (t.rachas ?? 0) >= RACHAS_FUERTES) return 'fuerte';
  if ((t.viento ?? 0) >= 15 || (t.rachas ?? 0) >= 28) return 'medio';
  return 'flojo';
}

const r0 = v => (v == null ? '–' : Math.round(v));

function resumenTiempoTitle(t, hora) {
  if (!t) return '';
  const temp = t.temp != null ? `${r0(t.temp)}°` : `${r0(t.min)}°/${r0(t.max)}°`;
  const cuando = hora != null ? `${String(hora).padStart(2, '0')}:00 · ` : '';
  return `${cuando}${textoTiempo(t.codigo)} · ${temp} · lluvia ${r0(t.probLluvia)}% · viento ${r0(t.viento)} km/h ${puntoCardinal(t.dirViento)} (rachas ${r0(t.rachas)})`;
}

/* ---------- Render: calendario ---------- */

// Iconito para la celda del calendario: el tiempo a la hora de la lista (o el
// del día si nadie ha puesto hora), y 💨 si hace viento fuerte.
function renderTiempoCalendario(fecha, sede, lista) {
  const hora = horaDeLista(lista);
  const t = (hora != null && tiempoHora(sede, fecha, hora)) || tiempoDia(sede, fecha);
  if (!t) return '';
  const usaHora = t.temp != null;
  const viento = nivelViento(t) === 'fuerte' ? '<span class="cal-day-tiempo-viento">💨</span>' : '';
  return `<span class="cal-day-tiempo" title="${esc(resumenTiempoTitle(t, usaHora ? hora : null))}">${iconoTiempo(t.codigo, t.esDia)}${viento}</span>`;
}

/* ---------- Render: vista del día ---------- */

function renderTiempoLista(clave, lista) {
  const fecha = fechaDeClave(clave);
  const sede = sedeDeClave(clave);
  const lugar = TIEMPO_SEDES[sede];
  if (!lugar) return '';
  if (fecha < todayStr()) return '';

  const dia = tiempoDia(sede, fecha);
  if (!dia) {
    // Sin datos: o falta mucho (más de 16 días), o aún no ha llegado / no hay red.
    const sinCache = !tiempoCache[sede];
    return `
      <div class="tiempo-card tiempo-vacio">
        🌤️ ${sinCache ? (tiempoError ? 'No se ha podido cargar la previsión del tiempo.' : 'Cargando la previsión…') : `La previsión para ${esc(lugar.nombre)} sale unos 16 días antes.`}
      </div>`;
  }

  const hora = horaDeLista(lista);
  const tHora = hora != null ? tiempoHora(sede, fecha, hora) : null;
  const t = tHora || dia;
  const tempTxt = tHora ? `${r0(t.temp)}°` : `${r0(dia.min)}° / ${r0(dia.max)}°`;
  const cuando = tHora ? `a las ${String(hora).padStart(2, '0')}:00` : 'durante el día';

  // Con hora: unas horas antes y después; sin hora: toda la franja de juego.
  const [minH, maxH] = TIEMPO_HORAS_FRANJA;
  const desde = hora != null ? Math.max(minH, Math.min(hora - 2, maxH - 7)) : minH;
  const hasta = hora != null ? Math.min(maxH, desde + 7) : maxH;
  let franja = '';
  for (let h = desde; h <= hasta; h++) {
    const th = tiempoHora(sede, fecha, h);
    if (!th) continue;
    franja += `
      <div class="tiempo-hora ${h === hora ? 'actual' : ''} viento-${nivelViento(th)}">
        <span class="tiempo-hora-h">${String(h).padStart(2, '0')}h</span>
        <span class="tiempo-hora-icono">${iconoTiempo(th.codigo, th.esDia)}</span>
        <span class="tiempo-hora-temp">${r0(th.temp)}°</span>
        <span class="tiempo-hora-lluvia">💧${r0(th.probLluvia)}%</span>
        <span class="tiempo-hora-viento">${flechaViento(th.dirViento)}${r0(th.viento)}</span>
      </div>`;
  }

  const ts = tiempoCache[sede]?.ts;
  const actualizado = ts ? new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

  return `
    <div class="tiempo-card">
      <div class="tiempo-head">
        <span class="tiempo-titulo">Tiempo en ${esc(lugar.nombre)} ${cuando}</span>
      </div>
      <div class="tiempo-resumen">
        <span class="tiempo-icono">${iconoTiempo(t.codigo, t.esDia)}</span>
        <div class="tiempo-datos">
          <div class="tiempo-temp">${tempTxt} <span class="tiempo-desc">${esc(textoTiempo(t.codigo))}</span></div>
          <div class="tiempo-linea">💧 ${r0(t.probLluvia)}% lluvia${t.lluvia ? ` · ${t.lluvia.toLocaleString('es-ES', { maximumFractionDigits: 1 })} mm` : ''}</div>
          <div class="tiempo-linea viento-${nivelViento(t)}">${flechaViento(t.dirViento)} Viento ${r0(t.viento)} km/h ${puntoCardinal(t.dirViento)} · rachas ${r0(t.rachas)} km/h</div>
        </div>
      </div>
      ${franja ? `<div class="tiempo-franja">${franja}</div>` : ''}
      <div class="tiempo-fuente">Previsión de <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>${actualizado ? ` · actualizada a las ${actualizado}` : ''}${hora == null ? ' · poned la hora al apuntaros para ver el tiempo a esa hora' : ''}</div>
    </div>`;
}

/* ---------- Render: próximos días (debajo del calendario) ---------- */

const TIEMPO_DIAS_CALENDARIO = 10;
const DIAS_SEMANA_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
let tiempoSedeCalendario = 'playa';

function setTiempoSedeCalendario(sede) {
  if (!TIEMPO_SEDES[sede]) return;
  tiempoSedeCalendario = sede;
  render();
}

// Resumen de las horas en que se juega (franja TIEMPO_HORAS_FRANJA): lo que
// importa es el viento de la tarde, no el máximo de las 4 de la mañana.
function resumenDiurno(sede, fecha) {
  const dia = tiempoDia(sede, fecha);
  if (!dia) return null;
  const [desde, hasta] = TIEMPO_HORAS_FRANJA;
  const horas = [];
  for (let h = desde; h <= hasta; h++) {
    const t = tiempoHora(sede, fecha, h);
    if (t) horas.push(t);
  }
  if (horas.length === 0) return dia;
  const max = k => Math.max(...horas.map(t => t[k] ?? 0));
  // Dirección: la de la hora más ventosa.
  const masVentosa = horas.reduce((a, b) => ((b.viento ?? 0) > (a.viento ?? 0) ? b : a));
  return {
    ...dia,
    probLluvia: max('probLluvia'),
    viento: max('viento'),
    rachas: max('rachas'),
    dirViento: masVentosa.dirViento
  };
}

function renderTiempoProximosDias() {
  const sede = tiempoSedeCalendario;
  const lugar = TIEMPO_SEDES[sede];
  const hoy = new Date();
  const dias = [];
  for (let i = 0; i < TIEMPO_DIAS_CALENDARIO; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const fecha = formatDateKey(d);
    const t = resumenDiurno(sede, fecha);
    if (!t) continue;
    const clave = claveLista(fecha, sede);
    const hayLista = !!(state && state.listas && state.listas[clave]);
    const etiqueta = i === 0 ? 'hoy' : (i === 1 ? 'mañana' : DIAS_SEMANA_CORTOS[d.getDay()]);
    dias.push(`
      <div class="tiempo-dia ${hayLista ? `con-lista sede-${sede}` : ''} viento-${nivelViento(t)}" ${hayLista ? `onclick="openLista('${clave}')"` : ''} title="${esc(resumenTiempoTitle(t, null))}">
        <span class="tiempo-dia-nombre">${etiqueta}</span>
        <span class="tiempo-dia-num">${d.getDate()}</span>
        <span class="tiempo-dia-icono">${iconoTiempo(t.codigo)}</span>
        <span class="tiempo-dia-temp">${r0(t.max)}°<small>/${r0(t.min)}°</small></span>
        <span class="tiempo-dia-lluvia">💧${r0(t.probLluvia)}%</span>
        <span class="tiempo-dia-viento">${flechaViento(t.dirViento)}${r0(t.viento)}</span>
        <span class="tiempo-dia-rachas">rachas ${r0(t.rachas)}</span>
      </div>`);
  }

  const selector = Object.keys(TIEMPO_SEDES).map(s => `
    <button type="button" class="tiempo-sede-btn sede-${s} ${s === sede ? 'active' : ''}" onclick="setTiempoSedeCalendario('${s}')">${SEDES[s] ? SEDES[s].icono : ''} ${esc(TIEMPO_SEDES[s].nombre)}</button>`).join('');

  let cuerpo;
  if (dias.length > 0) cuerpo = `<div class="tiempo-dias">${dias.join('')}</div>`;
  else if (tiempoError) cuerpo = `<div class="tiempo-vacio">No se ha podido cargar la previsión del tiempo.</div>`;
  else cuerpo = `<div class="tiempo-vacio">Cargando la previsión…</div>`;

  const ts = tiempoCache[sede]?.ts;
  const actualizado = ts ? new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

  return `
    <div class="tiempo-card tiempo-proximos">
      <div class="tiempo-proximos-head">
        <span class="tiempo-titulo">Tiempo próximos días</span>
        <div class="tiempo-sedes">${selector}</div>
      </div>
      ${cuerpo}
      <div class="tiempo-fuente">Viento y lluvia: lo peor entre las ${TIEMPO_HORAS_FRANJA[0]}h y las ${TIEMPO_HORAS_FRANJA[1]}h en ${esc(lugar.nombre)} (km/h) · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>${actualizado ? ` · ${actualizado}` : ''}</div>
    </div>`;
}
