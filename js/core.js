// Núcleo de la app: arranque de Firebase, constantes globales, estado reactivo,
// identidad de dispositivo/admin, aviso de WhatsApp y navegación.

const firebaseConfig = {
  apiKey: "AIzaSyArP-V_vPSaIPz_ulWbP07rvPKDJSPVp1s",
  authDomain: "volea-beach-forever.firebaseapp.com",
  projectId: "volea-beach-forever",
  storageBucket: "volea-beach-forever.firebasestorage.app",
  messagingSenderId: "362602975964",
  appId: "1:362602975964:web:d5674876d2e68d8c6f9a19"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Documento histórico: todo el estado en un único blob JSON. Se deja de
// escribir en cuanto arranca la migración a documentos por entidad (ver
// migrarSiHaceFalta en main.js), pero se conserva para siempre como copia
// de seguridad de todo lo anterior — nunca se borra ni se sobreescribe.
const DOC_REF = db.collection('volea').doc('lista-actual');

// A partir de aquí cada torneo y cada lista de un día vive en su propio
// documento dentro de la misma colección 'volea' (las reglas de seguridad
// de Firestore solo cubren volea/{docId}, un único segmento de ruta, así
// que no sirven colecciones nuevas ni subcolecciones). El prefijo 'dia-' se
// eligió para las listas, no 'lista-', porque 'lista-actual' también
// empieza por 'lista-' y colisionaría con la consulta de rango por prefijo
// que enumera todas las listas (ver PREFIJO_DIA en main.js).
const PREFIJO_TORNEO = 'torneo-';
const PREFIJO_DIA = 'dia-';
function torneoRef(id) { return DOC_REF.parent.doc(PREFIJO_TORNEO + id); }
function listaRef(fecha) { return DOC_REF.parent.doc(PREFIJO_DIA + fecha); }

const MAX_PER_RED = 6;
const MAX_PER_RED_EXTRA = 4;
const APP_URL = 'https://volea-beach-forever.web.app';

function capacityForRed(red) {
  return red.numero === 1 ? MAX_PER_RED : MAX_PER_RED_EXTRA;
}

function hayRedConHueco(redes) {
  return (redes || []).some(r => r.jugadores.length < capacityForRed(r));
}

function urlParaFecha(fecha) {
  return `${APP_URL}/?fecha=${fecha}`;
}
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_SEMANA = ['L','M','X','J','V','S','D'];
const CATEGORIAS_TORNEO = ['masculino', 'femenino', 'mixto', 'género libre'];
const PUNTOS_POR_SET_DEFAULT = 15;
// Tope de puntos: al llegarlo se gana el set aunque la ventaja sea de un solo punto,
// para que no se alargue indefinidamente esperando los 2 puntos de diferencia.
const PUNTOS_MAXIMO_DEFAULT = PUNTOS_POR_SET_DEFAULT + 6;
const NUM_SETS_DEFAULT = 3;
const NUM_CAMPOS_DEFAULT = 1;
const DURACION_PARTIDO_DEFAULT = 20;

let state = null;        // { listas: { 'YYYY-MM-DD': { lugar, redes } }, torneos: { id: Torneo } }
let loading = true;
// Un flag por tipo de entidad (en vez de uno global): al escribir solo se
// toca el documento de ese torneo o esa lista, así que un guardado en un
// torneo ya no tiene por qué bloquear la sincronización de las listas (ni
// viceversa).
let savingTorneos = false;
let savingListas = false;

// vista actual: { screen: 'calendar', calYear, calMonth } o { screen: 'list', fecha } o { screen: 'torneo', torneoId }
let view = { screen: 'calendar', calYear: null, calMonth: null };
let showNewListModal = false;
let showNewRedModal = false;
let newRedData = { fecha: null, nombre: '', balon: '', lineas: '' };
let notifyMessage = null;
let showHistorial = false;
let showNewTorneoModal = false;
let newTorneoData = null; // se inicializa en openNewTorneoModal()
let showEditarTorneoModal = false;
let editTorneoData = null; // se inicializa en openEditarTorneoModal()

// Estado efímero (solo en este navegador, no se guarda en Firestore): qué
// resultados se están editando ahora mismo. Un partido/set con resultado ya
// guardado se muestra cerrado (marcador + botón editar) salvo que su
// identificador esté aquí; uno sin resultado siempre se muestra editable.
let partidosGrupoEnEdicion = new Set();
let setsEliminatoriaEnEdicion = new Set(); // claves `${partidoId}:${setIndex}`

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getDeviceId() {
  try {
    let id = localStorage.getItem('voley_device_id');
    if (!id) {
      id = uid() + uid();
      localStorage.setItem('voley_device_id', id);
    }
    return id;
  } catch (e) {
    return uid() + uid(); // localStorage no disponible: identidad efímera
  }
}

const DEVICE_ID = getDeviceId();

// PIN de administrador. OJO: al ser una web estática pública, este PIN es
// visible en el código fuente. Solo evita borrados accidentales o de gente
// ajena al grupo; no es seguridad real. Cámbialo por el que quieras.
const ADMIN_PIN = '2222';

function isAdminStored() {
  try {
    return localStorage.getItem('voley_admin') === '1';
  } catch (e) {
    return false;
  }
}

let isAdmin = isAdminStored();

function loginAdmin() {
  const pin = prompt('Introduce el PIN de admin:');
  if (pin === null) return;
  if (pin.trim() !== ADMIN_PIN) {
    alert('PIN incorrecto.');
    return;
  }
  isAdmin = true;
  try { localStorage.setItem('voley_admin', '1'); } catch (e) {}
  render();
}

function logoutAdmin() {
  isAdmin = false;
  try { localStorage.removeItem('voley_admin'); } catch (e) {}
  render();
}

function emptyState() {
  return { listas: {}, torneos: {} };
}

function newEquipo(nombre) {
  return { id: uid(), nombre };
}

function emptyTorneo(datos) {
  return {
    id: uid(),
    nombre: datos.nombre,
    categoria: datos.categoria,
    fechaInicio: datos.fechaInicio,
    fechaFin: datos.fechaFin,
    puntosPorSet: datos.puntosPorSet || PUNTOS_POR_SET_DEFAULT,
    puntosMaximo: datos.puntosMaximo || PUNTOS_MAXIMO_DEFAULT,
    // Formato de las eliminatorias, independiente de la fase de grupos (p.ej.
    // grupos a 15 con tope 21, eliminatorias a 21 con tope 25).
    puntosPorSetEliminatoria: datos.puntosPorSetEliminatoria || PUNTOS_POR_SET_DEFAULT,
    puntosMaximoEliminatoria: datos.puntosMaximoEliminatoria || PUNTOS_MAXIMO_DEFAULT,
    numSets: datos.numSets || NUM_SETS_DEFAULT,
    numCampos: datos.numCampos || NUM_CAMPOS_DEFAULT,
    duracionPartidoMin: datos.duracionPartidoMin || DURACION_PARTIDO_DEFAULT,
    // Pausa para comer: hora del día ('HH:mm'), se aplica cada día que dure el torneo.
    // null = sin pausa configurada.
    comidaInicio: datos.comidaInicio || null,
    comidaFin: datos.comidaFin || null,
    equipos: datos.equipos,
    numGrupos: datos.numGrupos,
    numPartidosGrupo: datos.numPartidosGrupo,
    clasificadosPorGrupo: datos.clasificadosPorGrupo,
    // Torneos simultáneos: los que comparten bloqueId se juegan a la vez en los
    // mismos campos, alternando franjas. ordenBloque da un orden estable (las
    // claves de state.torneos son uid() y su orden de iteración no es fiable).
    bloqueId: datos.bloqueId || null,
    ordenBloque: datos.ordenBloque || 0,
    grupos: null,
    sorteoConfirmado: false,
    partidosGrupo: [],
    eliminatoria: null,
    creatorOwner: DEVICE_ID,
    historial: []
  };
}

function newRed(num) {
  return {
    id: uid(),
    numero: num,
    materiales: { balon: '', red: '', lineas: '' },
    jugadores: [],
    creatorOwner: DEVICE_ID
  };
}

function emptyLista() {
  return { lugar: '', espera: [], redes: [], historial: [] };
}

const HISTORIAL_MAX = 30;

function agregarHistorial(historial, texto) {
  const entradas = [...(historial || []), { ts: Date.now(), texto }];
  return entradas.slice(-HISTORIAL_MAX);
}

function todayStr() {
  const d = new Date();
  return formatDateKey(d);
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFechaLarga(key) {
  const d = parseDateKey(key);
  const diasSemana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  return `${diasSemana[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// fechaHora: 'YYYY-MM-DDTHH:mm' (valor de un <input type="datetime-local">)
function formatFechaHoraCorta(fechaHora) {
  if (!fechaHora) return '';
  const [fecha, hora] = fechaHora.split('T');
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${hora || ''}`.trim();
}

function formatRangoFechasTorneo(torneo) {
  return `${formatFechaHoraCorta(torneo.fechaInicio)} – ${formatFechaHoraCorta(torneo.fechaFin)}`;
}

function estadoTorneo(torneo) {
  const ahora = Date.now();
  const inicio = torneo.fechaInicio ? new Date(torneo.fechaInicio).getTime() : null;
  const fin = torneo.fechaFin ? new Date(torneo.fechaFin).getTime() : null;
  if (inicio != null && ahora < inicio) return 'Próximo';
  if (fin != null && ahora > fin) return 'Finalizado';
  return 'En curso';
}

function faseTorneo(torneo) {
  if (!torneo.grupos) return 'Sin sortear';
  if (!torneo.eliminatoria) return 'Fase de grupos';
  const final = torneo.eliminatoria.rondas[torneo.eliminatoria.rondas.length - 1];
  const acabado = final && final.partidos.every(p => p.ganadorId);
  return acabado ? 'Finalizado' : 'Eliminatorias';
}

// fecha: 'YYYY-MM-DD'. Compara solo la parte de fecha de fechaInicio/fechaFin
// ('YYYY-MM-DDTHH:mm'), así que la comparación lexicográfica de prefijos basta.
function torneosEnFecha(fecha) {
  return Object.values(state.torneos || {}).filter(t => {
    if (!t.fechaInicio || !t.fechaFin) return false;
    return fecha >= t.fechaInicio.slice(0, 10) && fecha <= t.fechaFin.slice(0, 10);
  });
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

// Torneos que se juegan simultáneamente con éste (incluido él), en orden estable.
// Un torneo sin bloqueId es un bloque de uno solo.
function torneosDelBloque(torneo, torneos) {
  const todos = torneos || Object.values(state.torneos || {});
  if (!torneo.bloqueId) return [torneo];
  return todos
    .filter(t => t.bloqueId === torneo.bloqueId)
    .sort((a, b) => (a.ordenBloque || 0) - (b.ordenBloque || 0));
}

// En un bloque los torneos comparten nombre, así que hay que distinguirlos por categoría.
function nombreTorneo(torneo) {
  return torneo.bloqueId ? `${torneo.nombre} · ${capitalizar(torneo.categoria)}` : torneo.nombre;
}

// Símbolo distinto de null/undefined para poder devolver "no había nada que
// actualizar" (p.ej. alguien más borró ese torneo) sin que se confunda con
// un fallo real de guardado.
const NO_ENCONTRADO = Symbol('no-encontrado');

// Envuelve cualquier operación contra Firestore para que, si falla, se
// avise al momento en vez de perder el cambio en silencio (ver PR #31: un
// torneo "desaparecía" un día después porque el guardado había fallado sin
// que nadie se enterara). Todos los helpers de más abajo pasan por aquí.
async function guardarConAviso(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error('Error guardando en Firestore', e);
    alert('⚠️ No se ha podido guardar el cambio (revisa la conexión). Vuelve a intentarlo; si se repite, avisa al admin.');
    return null;
  }
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* ---------- Aviso de WhatsApp ---------- */

function showNotify(mensaje) {
  notifyMessage = mensaje;
  render();
}

function closeNotify() {
  notifyMessage = null;
  render();
}

function copyAndOpenWhatsapp() {
  if (!notifyMessage) return;
  const texto = notifyMessage;
  const fallbackCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(textarea);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  notifyMessage = null;
  render();
}

/* ---------- Navegacion ---------- */

function goToCalendar() {
  const today = new Date();
  view = { screen: 'calendar', calYear: today.getFullYear(), calMonth: today.getMonth() };
  render();
}

function openLista(fecha) {
  view = { screen: 'list', fecha };
  showHistorial = false;
  render();
}

function openTorneo(torneoId) {
  view = { screen: 'torneo', torneoId };
  render();
}

function toggleHistorial() {
  showHistorial = !showHistorial;
  render();
}

function calPrevMonth() {
  let { calYear, calMonth } = view;
  calMonth -= 1;
  if (calMonth < 0) { calMonth = 11; calYear -= 1; }
  view = { ...view, calYear, calMonth };
  render();
}

function calNextMonth() {
  let { calYear, calMonth } = view;
  calMonth += 1;
  if (calMonth > 11) { calMonth = 0; calYear += 1; }
  view = { ...view, calYear, calMonth };
  render();
}

function openNewListModal() {
  showNewListModal = true;
  render();
}

function closeNewListModal() {
  showNewListModal = false;
  render();
}

async function confirmNewList() {
  const input = document.getElementById('new-list-date');
  if (!input || !input.value) return;
  const fecha = input.value;
  const yaExistia = !!state.listas[fecha];
  const resultado = await crearLista(fecha); // crearLista no pisa si ya existía
  if (!resultado) return; // el guardado falló (ya se ha avisado); no navegar a una lista que no se ha creado
  showNewListModal = false;
  openLista(fecha);
  if (!yaExistia) {
    showNotify(`📅 Nueva lista creada para el ${formatFechaLarga(fecha)}. ¡Apuntaos! ${urlParaFecha(fecha)}`);
  }
}

