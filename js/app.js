import {
  watchAuthState,
  login,
  logout,
  requestAccess,
  getMember,
  listMembers,
  approveMember,
  rejectMember,
  assignVoices,
  renameMember,
  promoteToDirector,
  setMemberRole,
  deleteMember,
  listSongs,
  createSong,
  updateSong,
  deleteSong,
  uploadSongAudio,
  listAvisos,
  createAviso,
  updateAviso,
  deleteAviso,
  listEnsayoAudios,
  uploadEnsayoAudio,
  updateEnsayoAudio,
  deleteEnsayoAudio,
  listOrquestaItems,
  uploadOrquestaItem,
  updateOrquestaItem,
  deleteOrquestaItem,
  resetMemberPassword,
  changeOwnPassword,
} from './firebase.js';

// Repertorio de un coro de Carnaval de Cádiz. Los cuplés y los estribillos se
// agrupan en un mismo apartado porque en el libreto van juntos.
const KIND_ORDER = ['presentacion', 'tango', 'cuple', 'estribillo', 'popurri'];
const KIND_LABELS = {
  presentacion: 'Presentación',
  tango: 'Tango',
  cuple: 'Cuplé',
  estribillo: 'Estribillo',
  popurri: 'Popurrí',
  falseta: 'Falseta',
};
const SECTIONS = [
  { title: 'Presentación', kinds: ['presentacion'] },
  { title: 'Tangos', kinds: ['tango'] },
  { title: 'Cuplés (con Estribillo)', kinds: ['cuple', 'estribillo'] },
  { title: 'Popurrí', kinds: ['popurri'] },
];
// Etiquetas conocidas para tipos de audio habituales; cualquier otro tipo que
// aparezca en los datos se muestra igualmente (capitalizado) aunque no esté
// en esta lista.
const AUDIO_TYPE_LABELS = {
  grupo: 'Grupo',
  tenor: 'Tenor',
  segunda: 'Segunda',
  guitarra: 'Guitarra',
  voces: 'Voces',
};
const ROLE_META = {
  admin: { label: 'Administrador', color: 'var(--gold-2)', border: 'rgba(200,165,91,0.5)' },
  director: { label: 'Director', color: 'var(--gold-2)', border: 'rgba(200,165,91,0.5)' },
  corista: { label: 'Corista', color: 'var(--accent-300)', border: 'var(--accent-700)' },
  pendiente: { label: 'Pendiente', color: 'var(--neutral-500)', border: 'var(--neutral-700)' },
  rechazado: { label: 'Rechazado', color: '#ff8a80', border: 'rgba(176,0,32,0.4)' },
};
const VOICE_OPTIONS = ['Tenor mujer', 'Tenor contraalto mujer', 'Segunda mujer', 'Tenor hombre', 'Segunda hombre', 'Bajos', 'Orquesta'];
// Voces de coro: las que tienen audios en el Local del Ensayo (Orquesta no).
const ENSAYO_VOICES = VOICE_OPTIONS.filter((v) => v !== 'Orquesta');
const ORQUESTA_VOICE = 'Orquesta';
const ORQUESTA_MSG = '¿Tu tienes Puas o las uñas largas? Pues aquí no es, vuelve a estudiar las letras que te coge el toro!! 🤣';

// Un componente puede llevar varias voces a la vez (p. ej. Tenor + Tenor
// contraalto). "voices" es el array real; "voice" (singular) es el campo
// antiguo, leído como respaldo en fichas que aún no se han vuelto a guardar
// desde que existe la asignación múltiple — ver su gemela en firebase.js.
function memberVoices(member) {
  if (!member) return [];
  if (Array.isArray(member.voices)) return member.voices;
  return member.voice ? [member.voice] : [];
}
const ROLE_OPTIONS = ['corista', 'director', 'admin'];

function kindIndex(kind) {
  const i = KIND_ORDER.indexOf(kind);
  return i === -1 ? KIND_ORDER.length : i;
}

function audioTypeLabel(type) {
  return AUDIO_TYPE_LABELS[type] || (type.charAt(0).toUpperCase() + type.slice(1));
}

const state = {
  songs: [],
  avisos: [],
  ensayo: [],
  ensayoFolder: null,
  orquesta: [],
  orquestaFolder: null,
  members: [],
  screen: 'login',
  searchQuery: '',
  playlist: [],
  playlistIndex: -1,
  rehearsalMode: false,
  audioType: 'grupo',
  currentSongId: null,
  loopEnabled: false,
  letraSongId: null,
  letraLines: [],
  letraAllowAudio: true,
  currentUser: null,
  currentMember: null,
};

const el = {
  groupName: document.getElementById('group-name'),
  adminAvatar: document.getElementById('admin-avatar'),
  appFrame: document.getElementById('app-frame'),

  screenLogin: document.getElementById('screen-login'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginSubmit: document.getElementById('login-submit'),
  loginForgot: document.getElementById('login-forgot'),
  loginPedir: document.getElementById('login-pedir'),
  loginError: document.getElementById('login-error'),

  screenPendiente: document.getElementById('screen-pendiente'),
  pendienteForm: document.getElementById('pendiente-form'),
  pendienteStatus: document.getElementById('pendiente-status'),
  pendienteFormVolver: document.getElementById('pendiente-form-volver'),
  signupName: document.getElementById('signup-name'),
  signupEmail: document.getElementById('signup-email'),
  signupPassword: document.getElementById('signup-password'),
  signupSubmit: document.getElementById('signup-submit'),
  signupError: document.getElementById('signup-error'),
  pendienteStatusKicker: document.getElementById('pendiente-status-kicker'),
  pendienteStatusTitle: document.getElementById('pendiente-status-title'),
  pendienteDirectorStatus: document.getElementById('pendiente-director-status'),
  pendienteAdminStatus: document.getElementById('pendiente-admin-status'),
  pendienteVolver: document.getElementById('pendiente-volver'),

  topbar: document.getElementById('topbar'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  drawerPanel: document.getElementById('drawer-panel'),
  drawerSub: document.getElementById('drawer-sub'),
  drawerNav: document.getElementById('drawer-nav'),
  drawerLogout: document.getElementById('drawer-logout'),
  drawerAdminCount: document.getElementById('drawer-admin-count'),
  drawerDirectorItem: document.getElementById('drawer-director-item'),
  drawerAdminItem: document.getElementById('drawer-admin-item'),

  searchRow: document.getElementById('search-row'),
  searchInput: document.getElementById('search-input'),

  inicioView: document.getElementById('inicio-view'),
  inicioGreeting: document.getElementById('inicio-greeting'),
  avisosList: document.getElementById('avisos-list'),
  repertoireCount: document.getElementById('repertoire-count'),
  repertoireList: document.getElementById('repertoire-list'),

  libretoView: document.getElementById('libreto-view'),
  audiosView: document.getElementById('audios-view'),
  ensayoView: document.getElementById('ensayo-view'),
  orquestaView: document.getElementById('orquesta-view'),
  perfilView: document.getElementById('perfil-view'),
  drawerEnsayoItem: document.getElementById('drawer-ensayo-item'),
  audiosList: document.getElementById('audios-list'),

  letraView: document.getElementById('letra-view'),
  letraBack: document.getElementById('letra-back'),
  letraTitle: document.getElementById('letra-title'),
  letraVoiceRow: document.getElementById('letra-voice-row'),
  letraLines: document.getElementById('letra-lines'),
  letraFootnote: document.getElementById('letra-footnote'),

  directorView: document.getElementById('director-view'),
  directorPieces: document.getElementById('director-pieces'),
  directorRequests: document.getElementById('director-requests'),
  directorRequestsCount: document.getElementById('director-requests-count'),
  directorAvisosHistory: document.getElementById('director-avisos-history'),
  directorMembers: document.getElementById('director-members'),
  directorRemoved: document.getElementById('director-removed'),
  directorRemovedCount: document.getElementById('director-removed-count'),
  directorInvitar: document.getElementById('director-invitar'),

  adminView: document.getElementById('admin-view'),
  adminStatMembers: document.getElementById('admin-stat-members'),
  adminStatDirectors: document.getElementById('admin-stat-directors'),
  adminStatPending: document.getElementById('admin-stat-pending'),
  adminRequests: document.getElementById('admin-requests'),
  adminActivity: document.getElementById('admin-activity'),
  adminNombrarDirector: document.getElementById('admin-nombrar-director'),

  songModalBackdrop: document.getElementById('song-modal-backdrop'),
  songModal: document.getElementById('song-modal'),
  songModalTitle: document.getElementById('song-modal-title'),
  songFormTitle: document.getElementById('song-form-title'),
  songFormFile: document.getElementById('song-form-file'),
  songFileError: document.getElementById('song-file-error'),
  songFormLetter: document.getElementById('song-form-letter'),
  songFormError: document.getElementById('song-form-error'),
  songModalCancel: document.getElementById('song-modal-cancel'),
  songModalSave: document.getElementById('song-modal-save'),

  avisoModalBackdrop: document.getElementById('aviso-modal-backdrop'),
  avisoModal: document.getElementById('aviso-modal'),
  avisoModalTitle: document.getElementById('aviso-modal-title'),
  avisoFormTitle: document.getElementById('aviso-form-title'),
  avisoFormBody: document.getElementById('aviso-form-body'),
  avisoFormError: document.getElementById('aviso-form-error'),
  avisoModalCancel: document.getElementById('aviso-modal-cancel'),
  avisoModalSave: document.getElementById('aviso-modal-save'),
  directorCrearTimbrazo: document.getElementById('director-crear-timbrazo'),
  adminInvitar: document.getElementById('admin-invitar'),

  rehearsalToggle: document.getElementById('rehearsal-toggle'),
  rehearsalBar: document.getElementById('rehearsal-bar'),
  rehearsalClose: document.getElementById('rehearsal-close'),
  rehearsalCurrentTitle: document.getElementById('rehearsal-current-title'),
  rehearsalPosition: document.getElementById('rehearsal-position'),
  audioTypeSelect: document.getElementById('audio-type'),
  shuffleCuples: document.getElementById('shuffle-cuples'),
  playerBar: document.getElementById('player-bar'),
  playerPrev: document.getElementById('player-prev'),
  playerPlayPause: document.getElementById('player-playpause'),
  playerNext: document.getElementById('player-next'),
  playerLoop: document.getElementById('player-loop'),
  playerClose: document.getElementById('player-close'),
  playerTitle: document.getElementById('player-title'),
  playerSeek: document.getElementById('player-seek'),
  playerCurrentTime: document.getElementById('player-current-time'),
  playerDuration: document.getElementById('player-duration'),
  audioEl: document.getElementById('audio-el'),
  bottomBars: document.getElementById('bottom-bars'),
};

function initials(name) {
  return (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '·';
}

// Refleja en la interfaz (avatar, cajón lateral, saludo) el rol real del
// componente que ha iniciado sesión, leído de su ficha en Firestore.
function applyMemberChrome(member) {
  el.adminAvatar.textContent = initials(member.name);
  el.adminAvatar.title = member.name || '';
  el.drawerSub.textContent = (ROLE_META[member.role] || ROLE_META.pendiente).label;
  el.inicioGreeting.textContent = member.name ? `Bienvenido, ${member.name}` : 'Bienvenido';
  el.drawerDirectorItem.classList.toggle('hidden', member.role !== 'director' && member.role !== 'admin');
  el.drawerAdminItem.classList.toggle('hidden', member.role !== 'admin');
  el.drawerEnsayoItem.classList.toggle('hidden', isOrquestaMember() && !hasEnsayoVoice());
}

// Punto central de enrutado según el estado real de sesión de Firebase Auth:
// sin sesión -> login; con sesión pero sin aprobar -> pantalla de espera;
// aprobado -> la app, con el panel de director/admin visible según el rol.
async function handleAuthChange(user) {
  state.currentUser = user;
  if (!user) {
    state.currentMember = null;
    state.members = [];
    stopRehearsal();
    goAuthScreen('login');
    return;
  }

  const member = await getMember(user.uid);
  state.currentMember = member;

  if (!member || member.role === 'pendiente' || member.role === 'rechazado') {
    showPendienteStatus(member);
    goAuthScreen('pendiente');
    return;
  }

  applyMemberChrome(member);
  state.ensayoFolder = null;
  state.orquestaFolder = null;
  const tasks = [refreshSongs(), refreshAvisos(), refreshEnsayo(), refreshOrquesta()];
  if (member.role === 'director' || member.role === 'admin') {
    tasks.push(refreshMembers());
  }
  await Promise.all(tasks);
  render();
  goScreen('inicio');
}

function showPendienteStatus(member) {
  el.pendienteForm.classList.add('hidden');
  el.pendienteStatus.classList.remove('hidden');
  const rejected = member && member.role === 'rechazado';
  el.pendienteStatusKicker.textContent = rejected ? 'Solicitud rechazada' : 'Solicitud enviada';
  el.pendienteStatusTitle.innerHTML = rejected
    ? 'Tu solicitud no ha<br>sido aceptada'
    : 'Te falta que te abran<br>la puerta';
  el.pendienteDirectorStatus.textContent = member?.approvedByDirector ? 'Firmado' : 'Pendiente';
  el.pendienteAdminStatus.textContent = member?.approvedByAdmin ? 'Firmado' : 'Pendiente';
}

async function refreshMembers() {
  try {
    state.members = await listMembers();
  } catch (err) {
    state.members = [];
  }
}

// El contenido de #bottom-bars cambia de altura (aparece el reproductor,
// la barra de ensayo hace wrap en pantallas estrechas...), así que el hueco
// que le dejamos al final de la página se recalcula cada vez que cambia algo
// que puede afectar a esa altura, para que nunca tape el final de una letra.
function syncBottomPadding() {
  const h = el.bottomBars.offsetHeight;
  el.appFrame.style.paddingBottom = h ? `${h + 16}px` : '0px';
}
window.addEventListener('resize', syncBottomPadding);

function normalizeLetter(text) {
  return (text || '').replace(/_/g, ' ');
}

// Quita acentos para que buscar "cadiz" encuentre "Cádiz".
function normalizeForSearch(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function matchesSearch(song, normalizedQuery) {
  return !normalizedQuery || normalizeForSearch(song.title).includes(normalizedQuery);
}

function compareSongs(a, b) {
  const kindDiff = kindIndex(a.kind) - kindIndex(b.kind);
  if (kindDiff !== 0) return kindDiff;
  return a.title.toUpperCase().localeCompare(b.title.toUpperCase());
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAudioUrl(song, type) {
  const audios = song.audios || [];
  return (audios.find((a) => a.type === type) || audios[0] || {}).url || null;
}

function loadData() {
  Object.keys(AUDIO_TYPE_LABELS).forEach((type) => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = audioTypeLabel(type);
    el.audioTypeSelect.appendChild(opt);
  });
  state.audioType = el.audioTypeSelect.value || 'grupo';
}

async function refreshSongs() {
  try {
    state.songs = await listSongs();
  } catch (err) {
    state.songs = [];
  }
}

async function refreshEnsayo() {
  try {
    state.ensayo = await listEnsayoAudios(state.currentMember);
  } catch (err) {
    console.error(err);
    state.ensayo = [];
  }
}

async function refreshOrquesta() {
  try {
    state.orquesta = await listOrquestaItems(state.currentMember);
  } catch (err) {
    console.error(err);
    state.orquesta = [];
  }
}

async function refreshAvisos() {
  try {
    state.avisos = await listAvisos();
  } catch (err) {
    state.avisos = [];
  }
}

function render() {
  renderInicio();
  renderSectioned(el.libretoView, 'libreto');
  renderSectioned(el.audiosList, 'audios');
  renderEnsayo();
  renderOrquesta();
  renderPerfil();
  renderDirector();
  renderAdmin();
}

/* ══════════════════════════ Local del Ensayo ══════════════════════════ */
// Una carpeta por pieza; dentro, los audios agrupados por voz. Un corista solo
// recibe (y por tanto solo ve) los de su voz; director/admin ven y gestionan todos.

const ENSAYO_PIECES = ['presentacion', 'tango', 'cuple', 'estribillo', 'popurri'];

// Corista con la voz Orquesta entre las suyas (director/admin ven ambos
// apartados siempre, sin necesidad de tener la voz asignada).
function isOrquestaMember() {
  const m = state.currentMember;
  return !!m && m.role === 'corista' && memberVoices(m).includes(ORQUESTA_VOICE);
}

// Un corista que SOLO lleva Orquesta no tiene nada que hacer en el Local del
// Ensayo; si además lleva alguna voz de coro, sigue viendo ambos apartados.
function hasEnsayoVoice() {
  return memberVoices(state.currentMember).some((v) => v !== ORQUESTA_VOICE);
}

function canSeeOrquesta() {
  return isDirectorRole() || isOrquestaMember();
}

function isDirectorRole() {
  const role = state.currentMember?.role;
  return role === 'director' || role === 'admin';
}

function isAdminRole() {
  return state.currentMember?.role === 'admin';
}

function pauseEnsayoAudios(except) {
  [...el.ensayoView.querySelectorAll('audio'), ...el.orquestaView.querySelectorAll('audio, video')].forEach((a) => {
    if (a !== except) a.pause();
  });
}

function compareEnsayo(a, b) {
  const va = VOICE_OPTIONS.indexOf(a.voice);
  const vb = VOICE_OPTIONS.indexOf(b.voice);
  if (va !== vb) return va - vb;
  if ((a.number || 0) !== (b.number || 0)) return (a.number || 0) - (b.number || 0);
  return (a.title || '').localeCompare(b.title || '', 'es');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderEnsayo() {
  const view = el.ensayoView;
  view.innerHTML = '';
  const member = state.currentMember;
  if (!member) return;
  const director = isDirectorRole();

  const head = document.createElement('div');
  head.className = 'panel-head';
  view.appendChild(head);

  const myEnsayoVoices = memberVoices(member).filter((v) => v !== ORQUESTA_VOICE);
  if (!state.ensayoFolder) {
    const sub = director
      ? 'Audios de ensayo por pieza y por voz.'
      : myEnsayoVoices.length
        ? `Tus audios de ensayo · ${escapeHtml(myEnsayoVoices.join(', '))}`
        : 'Aún no tienes voz asignada: pídesela a dirección para ver tus audios.';
    head.innerHTML = `<h1>Local del Ensayo</h1><p>${sub}</p>`;
    const list = document.createElement('div');
    list.className = 'ensayo-folders';
    ENSAYO_PIECES.forEach((piece) => {
      const count = state.ensayo.filter((a) => a.piece === piece).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ensayo-folder';
      btn.innerHTML = `<i class="fa-solid fa-folder"></i><span class="name">${KIND_LABELS[piece]}</span><span class="count">${count}</span>`;
      btn.addEventListener('click', () => {
        state.ensayoFolder = piece;
        renderEnsayo();
        window.scrollTo(0, 0);
      });
      list.appendChild(btn);
    });
    view.appendChild(list);
    return;
  }

  const piece = state.ensayoFolder;
  head.innerHTML = `<button class="btn btn-ghost" id="ensayo-back">&larr; Carpetas</button>
    <h1 style="margin-top:var(--space-4)">${KIND_LABELS[piece]}</h1>`;
  head.querySelector('#ensayo-back').addEventListener('click', () => {
    pauseEnsayoAudios();
    state.ensayoFolder = null;
    renderEnsayo();
  });

  if (director) view.appendChild(buildEnsayoUpload(piece));

  const items = state.ensayo.filter((a) => a.piece === piece).sort(compareEnsayo);
  const body = document.createElement('div');
  body.className = 'ensayo-list';
  if (!items.length) {
    const msg = director || myEnsayoVoices.length ? 'Todavía no hay audios en esta carpeta.' : 'Aún no tienes voz asignada.';
    body.innerHTML = `<div class="empty-state">${msg}</div>`;
  }
  let lastVoice = null;
  items.forEach((item) => {
    if (item.voice !== lastVoice) {
      lastVoice = item.voice;
      const h = document.createElement('h2');
      h.className = 'kind-section-title';
      h.textContent = item.voice;
      body.appendChild(h);
    }
    body.appendChild(buildEnsayoRow(item, director));
  });
  view.appendChild(body);
}

function buildEnsayoUpload(piece) {
  const isPopurri = piece === 'popurri';
  const box = document.createElement('div');
  box.className = 'ensayo-upload';
  box.innerHTML = `
    <div class="field"><span>Voz</span>
      <select class="ensayo-voice">${ENSAYO_VOICES.map((v) => `<option value="${v}">${v}</option>`).join('')}</select></div>
    ${isPopurri ? '' : '<div class="field"><span>Nombre (opcional)</span><input type="text" class="ensayo-title" placeholder="Ej. Toda la pieza" /></div>'}
    <button type="button" class="btn btn-gold ensayo-upload-btn">${isPopurri ? 'Subir cuarteta' : 'Subir audio'}</button>
    <input type="file" class="audio-file-input" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" />`;
  const file = box.querySelector('input[type=file]');
  const btn = box.querySelector('.ensayo-upload-btn');
  btn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    const voice = box.querySelector('.ensayo-voice').value;
    const titleInput = box.querySelector('.ensayo-title');
    let title = titleInput ? titleInput.value.trim() : '';
    let number = null;
    if (isPopurri) {
      number = state.ensayo
        .filter((a) => a.piece === 'popurri' && a.voice === voice)
        .reduce((max, a) => Math.max(max, a.number || 0), 0) + 1;
      title = `Cuarteta ${number}`;
    }
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Subiendo…';
    try {
      await uploadEnsayoAudio({ piece, voice, title, number, file: f });
      await refreshEnsayo();
      renderEnsayo();
    } catch (err) {
      console.error(err);
      window.alert(`No se ha podido subir el audio (${err.code || err.message || 'error desconocido'}).`);
      btn.disabled = false;
      btn.textContent = label;
    }
    file.value = '';
  });
  return box;
}

function buildEnsayoRow(item, director) {
  const row = document.createElement('div');
  row.className = 'ensayo-row';
  const voiceOptions = ENSAYO_VOICES.map((v) => `<option value="${v}" ${item.voice === v ? 'selected' : ''}>${v}</option>`).join('');
  row.innerHTML = `
    <div class="ensayo-row-title">${escapeHtml(item.title || KIND_LABELS[item.piece])}</div>
    <audio controls preload="none" src="${escapeHtml(item.url)}"></audio>
    ${director ? `<div class="ensayo-row-actions">
      <select class="ensayo-voice-edit">${voiceOptions}</select>
      <button class="btn btn-ghost rename" style="min-height:32px;font-size:11px;">Renombrar</button>
      <button class="btn btn-ghost delete" style="min-height:32px;font-size:11px;">Eliminar</button>
    </div>` : ''}`;
  row.querySelector('audio').addEventListener('play', (e) => {
    pauseEnsayoAudios(e.target);
    if (!el.audioEl.paused) el.audioEl.pause();
  });
  if (director) {
    const act = async (fn, msg) => {
      try {
        await fn();
        await refreshEnsayo();
        renderEnsayo();
      } catch (err) {
        console.error(err);
        window.alert(msg);
      }
    };
    row.querySelector('.ensayo-voice-edit').addEventListener('change', (e) =>
      act(() => updateEnsayoAudio(item.id, { voice: e.target.value }), 'No se ha podido cambiar la voz.'));
    row.querySelector('.rename').addEventListener('click', () => {
      const title = window.prompt('Nuevo nombre:', item.title || '');
      if (title === null) return;
      act(() => updateEnsayoAudio(item.id, { title: title.trim() }), 'No se ha podido renombrar.');
    });
    row.querySelector('.delete').addEventListener('click', () => {
      if (!window.confirm(`¿Eliminar «${item.title || 'este audio'}»?`)) return;
      act(() => deleteEnsayoAudio(item), 'No se ha podido eliminar.');
    });
  }
  return row;
}

/* ══════════════════════════ Orquesta ══════════════════════════ */
// Audios y vídeos solo de la orquesta, en carpetas por pieza. Los coristas no
// entran: al pulsar les sale el mensaje de ORQUESTA_MSG.

const ORQUESTA_PIECES = ['presentacion', 'falseta', 'tango', 'cuple', 'estribillo', 'popurri'];

function compareOrquesta(a, b) {
  if ((a.number || 0) !== (b.number || 0)) return (a.number || 0) - (b.number || 0);
  return (a.title || '').localeCompare(b.title || '', 'es');
}

function renderOrquesta() {
  const view = el.orquestaView;
  view.innerHTML = '';
  const member = state.currentMember;
  if (!member || !canSeeOrquesta()) return;
  const director = isDirectorRole();

  const head = document.createElement('div');
  head.className = 'panel-head';
  view.appendChild(head);

  if (!state.orquestaFolder) {
    head.innerHTML = '<h1>Orquesta</h1><p>Audios y vídeos de la orquesta por pieza.</p>';
    const list = document.createElement('div');
    list.className = 'ensayo-folders';
    ORQUESTA_PIECES.forEach((piece) => {
      const count = state.orquesta.filter((a) => a.piece === piece).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ensayo-folder';
      btn.innerHTML = `<i class="fa-solid fa-folder"></i><span class="name">${KIND_LABELS[piece]}</span><span class="count">${count}</span>`;
      btn.addEventListener('click', () => {
        state.orquestaFolder = piece;
        renderOrquesta();
        window.scrollTo(0, 0);
      });
      list.appendChild(btn);
    });
    view.appendChild(list);
    return;
  }

  const piece = state.orquestaFolder;
  head.innerHTML = `<button class="btn btn-ghost" id="orquesta-back">&larr; Carpetas</button>
    <h1 style="margin-top:var(--space-4)">${KIND_LABELS[piece]}</h1>`;
  head.querySelector('#orquesta-back').addEventListener('click', () => {
    pauseEnsayoAudios();
    state.orquestaFolder = null;
    renderOrquesta();
  });

  if (director) view.appendChild(buildOrquestaUpload(piece));

  const items = state.orquesta.filter((a) => a.piece === piece).sort(compareOrquesta);
  const body = document.createElement('div');
  body.className = 'ensayo-list';
  if (!items.length) body.innerHTML = '<div class="empty-state">Todavía no hay nada en esta carpeta.</div>';
  items.forEach((item) => body.appendChild(buildOrquestaRow(item, director)));
  view.appendChild(body);
}

function buildOrquestaUpload(piece) {
  const isPopurri = piece === 'popurri';
  const box = document.createElement('div');
  box.className = 'ensayo-upload';
  box.innerHTML = `
    ${isPopurri ? '' : '<div class="field"><span>Nombre (opcional)</span><input type="text" class="ensayo-title" placeholder="Ej. Toda la pieza" /></div>'}
    <button type="button" class="btn btn-gold ensayo-upload-btn">${isPopurri ? 'Subir cuarteta' : 'Subir audio o vídeo'}</button>
    <input type="file" class="audio-file-input" accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm" />`;
  const file = box.querySelector('input[type=file]');
  const btn = box.querySelector('.ensayo-upload-btn');
  btn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    const titleInput = box.querySelector('.ensayo-title');
    let title = titleInput ? titleInput.value.trim() : '';
    let number = null;
    if (isPopurri) {
      number = state.orquesta
        .filter((a) => a.piece === 'popurri')
        .reduce((max, a) => Math.max(max, a.number || 0), 0) + 1;
      title = `Cuarteta ${number}`;
    }
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Subiendo…';
    try {
      await uploadOrquestaItem({ piece, title, number, file: f });
      await refreshOrquesta();
      renderOrquesta();
    } catch (err) {
      console.error(err);
      window.alert(`No se ha podido subir el archivo (${err.code || err.message || 'error desconocido'}).`);
      btn.disabled = false;
      btn.textContent = label;
    }
    file.value = '';
  });
  return box;
}

function buildOrquestaRow(item, director) {
  const row = document.createElement('div');
  row.className = 'ensayo-row';
  const media = item.media === 'video'
    ? `<video controls playsinline preload="metadata" src="${escapeHtml(item.url)}"></video>`
    : `<audio controls preload="none" src="${escapeHtml(item.url)}"></audio>`;
  row.innerHTML = `
    <div class="ensayo-row-title">${escapeHtml(item.title || KIND_LABELS[item.piece])}</div>
    ${media}
    ${director ? `<div class="ensayo-row-actions">
      <button class="btn btn-ghost rename" style="min-height:32px;font-size:11px;">Renombrar</button>
      <button class="btn btn-ghost delete" style="min-height:32px;font-size:11px;">Eliminar</button>
    </div>` : ''}`;
  row.querySelector('audio, video').addEventListener('play', (e) => {
    pauseEnsayoAudios(e.target);
    if (!el.audioEl.paused) el.audioEl.pause();
  });
  if (director) {
    const act = async (fn, msg) => {
      try {
        await fn();
        await refreshOrquesta();
        renderOrquesta();
      } catch (err) {
        console.error(err);
        window.alert(msg);
      }
    };
    row.querySelector('.rename').addEventListener('click', () => {
      const title = window.prompt('Nuevo nombre:', item.title || '');
      if (title === null) return;
      act(() => updateOrquestaItem(item.id, { title: title.trim() }), 'No se ha podido renombrar.');
    });
    row.querySelector('.delete').addEventListener('click', () => {
      if (!window.confirm(`¿Eliminar «${item.title || 'este archivo'}»?`)) return;
      act(() => deleteOrquestaItem(item), 'No se ha podido eliminar.');
    });
  }
  return row;
}

/* ══════════════════════════ Mi perfil ══════════════════════════ */
// Datos propios + cambio de contraseña (con reautenticación). El admin no ve
// aquí las contraseñas de nadie más — eso vive en Componentes, como un
// correo de restablecimiento (ver buildMemberRow).

function renderPerfil() {
  const view = el.perfilView;
  view.innerHTML = '';
  const m = state.currentMember;
  if (!m) return;

  const head = document.createElement('div');
  head.className = 'panel-head';
  head.innerHTML = '<h1>Mi perfil</h1><p>Tus datos y tu contraseña.</p>';
  view.appendChild(head);

  const info = document.createElement('div');
  info.className = 'ensayo-upload profile-info';
  info.innerHTML = `
    <div class="profile-row"><span>Nombre</span><strong>${escapeHtml(m.name || '')}</strong></div>
    <div class="profile-row"><span>Email</span><strong>${escapeHtml(m.email || '')}</strong></div>
    <div class="profile-row"><span>Rol</span><strong>${(ROLE_META[m.role] || ROLE_META.pendiente).label}</strong></div>
    <div class="profile-row"><span>Voz</span><strong>${escapeHtml(memberVoices(m).join(', ') || 'Sin voz asignada')}</strong></div>
  `;
  view.appendChild(info);

  const form = document.createElement('div');
  form.className = 'ensayo-upload';
  form.innerHTML = `
    <h2 style="margin:0;font-family:var(--font-heading);font-weight:500;font-size:16px;">Cambiar contraseña</h2>
    <label class="field">
      <span>Contraseña actual</span>
      <div class="password-field">
        <input type="password" class="profile-current-pw" autocomplete="current-password" />
        <button type="button" class="password-toggle" data-target-ref="current" aria-label="Mostrar contraseña"><i class="fa-solid fa-eye"></i></button>
      </div>
    </label>
    <label class="field">
      <span>Contraseña nueva</span>
      <div class="password-field">
        <input type="password" class="profile-new-pw" autocomplete="new-password" placeholder="Mínimo 6 caracteres" />
        <button type="button" class="password-toggle" data-target-ref="new" aria-label="Mostrar contraseña"><i class="fa-solid fa-eye"></i></button>
      </div>
    </label>
    <label class="field">
      <span>Repite la contraseña nueva</span>
      <div class="password-field">
        <input type="password" class="profile-new-pw2" autocomplete="new-password" />
        <button type="button" class="password-toggle" data-target-ref="new2" aria-label="Mostrar contraseña"><i class="fa-solid fa-eye"></i></button>
      </div>
    </label>
    <div class="auth-error hidden profile-pw-msg"></div>
    <button type="button" class="btn btn-gold profile-pw-save">Guardar contraseña</button>
  `;
  view.appendChild(form);

  const currentInput = form.querySelector('.profile-current-pw');
  const newInput = form.querySelector('.profile-new-pw');
  const new2Input = form.querySelector('.profile-new-pw2');
  const msg = form.querySelector('.profile-pw-msg');
  form.querySelectorAll('.password-toggle').forEach((btn) => {
    const input = { current: currentInput, new: newInput, new2: new2Input }[btn.dataset.targetRef];
    btn.addEventListener('click', () => togglePasswordVisibility(btn, input));
  });

  form.querySelector('.profile-pw-save').addEventListener('click', async (e) => {
    msg.classList.add('hidden');
    const current = currentInput.value;
    const next = newInput.value;
    const next2 = new2Input.value;
    if (!current || !next) {
      msg.textContent = 'Rellena la contraseña actual y la nueva.';
      msg.classList.remove('hidden');
      return;
    }
    if (next.length < 6) {
      msg.textContent = 'La contraseña nueva necesita al menos 6 caracteres.';
      msg.classList.remove('hidden');
      return;
    }
    if (next !== next2) {
      msg.textContent = 'Las dos contraseñas nuevas no coinciden.';
      msg.classList.remove('hidden');
      return;
    }
    e.target.disabled = true;
    try {
      await changeOwnPassword(current, next);
      currentInput.value = '';
      newInput.value = '';
      new2Input.value = '';
      window.alert('Contraseña actualizada.');
    } catch (err) {
      const code = err?.code || '';
      msg.textContent = code === 'auth/wrong-password' || code === 'auth/invalid-credential'
        ? 'La contraseña actual no es correcta.'
        : 'No se ha podido cambiar la contraseña. Inténtalo de nuevo.';
      msg.classList.remove('hidden');
    } finally {
      e.target.disabled = false;
    }
  });
}

/* ══════════════════════════ Navegación entre pantallas ══════════════════════════ */

const SCREEN_ELS = {
  inicio: el.inicioView,
  libreto: el.libretoView,
  audios: el.audiosView,
  ensayo: el.ensayoView,
  orquesta: el.orquestaView,
  perfil: el.perfilView,
  letra: el.letraView,
  director: el.directorView,
  admin: el.adminView,
};
// Estas pantallas usan la cabecera compartida (#topbar); director y admin
// llevan su propia cabecera incrustada.
const CHROME_SCREENS = new Set(['inicio', 'libreto', 'audios', 'ensayo', 'orquesta', 'perfil', 'letra']);
const SEARCH_SCREENS = new Set(['libreto', 'audios']);

function showOrquestaMsg() {
  const box = document.getElementById('orquesta-msg');
  const back = document.getElementById('orquesta-msg-backdrop');
  const close = () => {
    box.classList.add('hidden');
    back.classList.add('hidden');
  };
  document.getElementById('orquesta-msg-text').textContent = ORQUESTA_MSG;
  document.getElementById('orquesta-msg-ok').onclick = close;
  back.onclick = close;
  box.classList.remove('hidden');
  back.classList.remove('hidden');
}

function goScreen(screen) {
  // Orquesta y Local del Ensayo son excluyentes para coristas.
  if (screen === 'orquesta' && !canSeeOrquesta()) {
    closeDrawer();
    showOrquestaMsg();
    return;
  }
  if (screen === 'ensayo' && isOrquestaMember() && !hasEnsayoVoice()) {
    closeDrawer();
    return;
  }
  state.screen = screen;
  pauseEnsayoAudios();
  if (screen === 'inicio') renderRepertoireSummary();
  if (screen === 'ensayo') {
    state.ensayoFolder = null;
    renderEnsayo();
  }
  if (screen === 'orquesta') {
    state.orquestaFolder = null;
    renderOrquesta();
  }
  el.screenLogin.classList.add('hidden');
  el.screenPendiente.classList.add('hidden');
  Object.entries(SCREEN_ELS).forEach(([name, elm]) => elm.classList.toggle('hidden', name !== screen));
  el.topbar.classList.toggle('hidden', !CHROME_SCREENS.has(screen));
  el.searchRow.classList.toggle('hidden', !SEARCH_SCREENS.has(screen));
  closeDrawer();
  [...el.drawerNav.querySelectorAll('.drawer-item')].forEach((b) => b.classList.toggle('active', b.dataset.screen === screen));
  window.scrollTo(0, 0);
  syncBottomPadding();
}

function goAuthScreen(screen) {
  state.screen = screen;
  el.topbar.classList.add('hidden');
  el.searchRow.classList.add('hidden');
  Object.values(SCREEN_ELS).forEach((elm) => elm.classList.add('hidden'));
  el.screenLogin.classList.toggle('hidden', screen !== 'login');
  el.screenPendiente.classList.toggle('hidden', screen !== 'pendiente');
  closeDrawer();
  window.scrollTo(0, 0);
  syncBottomPadding();
}

function openDrawer() {
  el.drawerBackdrop.classList.remove('hidden');
  el.drawerPanel.classList.remove('hidden');
}
function closeDrawer() {
  el.drawerBackdrop.classList.add('hidden');
  el.drawerPanel.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.menu-btn')) openDrawer();
});
el.adminAvatar.addEventListener('click', () => goScreen('perfil'));
el.drawerBackdrop.addEventListener('click', closeDrawer);
el.drawerNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.drawer-item');
  if (!btn || !btn.dataset.screen) return;
  goScreen(btn.dataset.screen);
});
el.drawerLogout.addEventListener('click', () => logout());

// Ojo de "mostrar contraseña", reutilizado en login, alta y Mi perfil.
function togglePasswordVisibility(btn, input) {
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = `<i class="fa-solid fa-eye${show ? '-slash' : ''}"></i>`;
  btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.password-toggle[data-target]');
  if (!btn) return;
  togglePasswordVisibility(btn, document.getElementById(btn.dataset.target));
});

function showAuthError(elm, err) {
  elm.textContent = authErrorMessage(err);
  elm.classList.remove('hidden');
}

function authErrorMessage(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-email') return 'Ese correo no es válido.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Correo o contraseña incorrectos.';
  if (code === 'auth/email-already-in-use') return 'Ya hay una cuenta con ese correo. Entra desde la pantalla anterior.';
  if (code === 'auth/weak-password') return 'La contraseña necesita al menos 6 caracteres.';
  if (code === 'auth/missing-password' || code === 'auth/missing-email') return 'Rellena correo y contraseña.';
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}

el.loginSubmit.addEventListener('click', async () => {
  el.loginError.classList.add('hidden');
  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value;
  if (!email || !password) return showAuthError(el.loginError, { code: 'auth/missing-password' });
  el.loginSubmit.disabled = true;
  try {
    await login(email, password);
  } catch (err) {
    showAuthError(el.loginError, err);
  } finally {
    el.loginSubmit.disabled = false;
  }
});

el.loginPedir.addEventListener('click', (e) => {
  e.preventDefault();
  el.pendienteForm.classList.remove('hidden');
  el.pendienteStatus.classList.add('hidden');
  goAuthScreen('pendiente');
});
el.loginForgot.addEventListener('click', async (e) => {
  e.preventDefault();
  el.loginError.classList.add('hidden');
  const email = el.loginEmail.value.trim() || window.prompt('¿Cuál es tu correo?', '') || '';
  if (!email.trim()) return;
  try {
    await resetMemberPassword(email.trim());
    window.alert(`Te hemos mandado un correo a ${email.trim()} para que elijas una contraseña nueva.`);
  } catch (err) {
    showAuthError(el.loginError, err);
  }
});
el.pendienteFormVolver.addEventListener('click', () => goAuthScreen('login'));
el.pendienteVolver.addEventListener('click', () => logout());

el.signupSubmit.addEventListener('click', async () => {
  el.signupError.classList.add('hidden');
  const name = el.signupName.value.trim();
  const email = el.signupEmail.value.trim();
  const password = el.signupPassword.value;
  if (!name || !email || !password) return showAuthError(el.signupError, { code: 'auth/missing-password' });
  el.signupSubmit.disabled = true;
  try {
    await requestAccess({ name, email, password });
  } catch (err) {
    showAuthError(el.signupError, err);
  } finally {
    el.signupSubmit.disabled = false;
  }
});

el.searchInput.addEventListener('input', () => {
  state.searchQuery = el.searchInput.value;
  render();
});

/* ══════════════════════════ Inicio (tablón) ══════════════════════════ */

function renderInicio() {
  renderAvisos();
  renderRepertoireSummary();
}

const AVISO_TYPE_LABELS = { notificacion: 'Nueva letra', aviso: 'Timbrazo' };

function formatAvisoDate(aviso) {
  const millis = aviso.createdAt?.toMillis?.();
  if (!millis) return '';
  return new Date(millis).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// "Novedades" solo muestra dos tipos de publicación del director/admin:
// "notificacion" (avisa de una letra nueva/actualizada — lleva al
// Repertorio al pulsarla) y "aviso" (un mensaje urgente suelto, no
// navegable). No hay audios ni nada más aquí.
const NOVEDADES_LIMIT = 2;

function buildAvisoCard(aviso, { clickable = false, editable = false } = {}) {
  const isNotificacion = aviso.type === 'notificacion';
  const card = document.createElement('article');
  card.className = 'aviso-card' + (isNotificacion ? ' is-notificacion' : ' is-urgente');
  card.innerHTML = `
    <div class="aviso-card-top">
      <span class="tag-pill">${AVISO_TYPE_LABELS[aviso.type] || ''}</span>
      <time>${formatAvisoDate(aviso)}</time>
    </div>
    <h3 class="aviso-title">${aviso.title || ''}</h3>
    <p class="aviso-body">${aviso.body || ''}</p>
    ${aviso.authorName ? `<div class="aviso-signoff">${aviso.authorName}</div>` : ''}
  `;
  if (clickable && isNotificacion) {
    card.classList.add('clickable');
    card.addEventListener('click', () => goScreen('libreto'));
  }
  if (editable) {
    const actions = document.createElement('div');
    actions.className = 'aviso-card-actions';
    actions.innerHTML = `
      <button class="btn-icon-text aviso-edit-btn" title="Editar">Editar</button>
      <button class="btn-icon-text aviso-delete-btn" title="Eliminar">Eliminar</button>
    `;
    actions.querySelector('.aviso-edit-btn').addEventListener('click', (event) => {
      event.stopPropagation();
      openAvisoModal(aviso.type, aviso);
    });
    actions.querySelector('.aviso-delete-btn').addEventListener('click', (event) => {
      event.stopPropagation();
      handleDeleteAviso(aviso);
    });
    card.appendChild(actions);
  }
  return card;
}

// Solo las dos últimas notificaciones/avisos se muestran en Novedades; al
// publicar una nueva, la más antigua de las dos deja paso a la nueva (no se
// borra: sigue en el histórico del Panel del director).
function renderAvisos() {
  el.avisosList.innerHTML = '';
  const latest = state.avisos.slice(0, NOVEDADES_LIMIT);
  if (latest.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Todavía no hay avisos. Cuando la dirección publique alguno, aparecerá aquí.';
    el.avisosList.appendChild(empty);
    return;
  }
  const canManage = state.currentMember?.role === 'director' || state.currentMember?.role === 'admin';
  latest.forEach((aviso) => el.avisosList.appendChild(buildAvisoCard(aviso, { clickable: true, editable: canManage })));
}

// Histórico completo (todas las notificaciones y avisos publicados, no solo
// los dos últimos), visible en el Panel del director para poder consultarlos.
function renderAvisoHistory() {
  if (!el.directorAvisosHistory) return;
  el.directorAvisosHistory.innerHTML = '';
  if (state.avisos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Todavía no se ha publicado ningún timbrazo.';
    el.directorAvisosHistory.appendChild(empty);
    return;
  }
  state.avisos.forEach((aviso) => el.directorAvisosHistory.appendChild(buildAvisoCard(aviso, { editable: true })));
}

const LAST_LETRA_KEY = 'cil:lastLetra';

function renderRepertoireSummary() {
  el.repertoireList.innerHTML = '';
  const picked = state.songs.filter((s) => s.enEnsayo).sort(compareSongs);
  el.repertoireCount.textContent = picked.length ? `${picked.length} en ensayo` : '';

  if (picked.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Dirección aún no ha marcado canciones para esta semana.';
    el.repertoireList.appendChild(empty);
  }
  picked.forEach((song, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'repertoire-row';
    row.innerHTML = `
      <span class="repertoire-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="repertoire-title"></span>
      <span class="repertoire-status">Abrir letra</span>
    `;
    row.querySelector('.repertoire-title').textContent = song.title;
    row.addEventListener('click', () => openLetra(song, { allowAudio: false }));
    el.repertoireList.appendChild(row);
  });

  const slot = document.getElementById('continue-slot');
  slot.innerHTML = '';
  let lastId = null;
  try { lastId = localStorage.getItem(LAST_LETRA_KEY); } catch (e) { /* sin almacenamiento */ }
  const last = state.songs.find((s) => s.id === lastId);
  if (last) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'continue-link';
    btn.innerHTML = '<span>Continuar:</span> <strong></strong> <i class="fa-solid fa-arrow-right"></i>';
    btn.querySelector('strong').textContent = last.title;
    btn.addEventListener('click', () => openLetra(last, { allowAudio: false }));
    slot.appendChild(btn);
  }
}

/* ══════════════════════════ Libreto / Audios (listas) ══════════════════════════ */

function renderSectioned(container, mode) {
  const query = normalizeForSearch(state.searchQuery);
  container.innerHTML = '';
  let anyRendered = false;

  SECTIONS.forEach((section) => {
    const items = state.songs
      .filter((s) => section.kinds.includes(s.kind) && matchesSearch(s, query))
      .sort(compareSongs);
    if (items.length === 0) return;
    anyRendered = true;

    const sectionEl = document.createElement('div');
    sectionEl.className = 'kind-section';

    const heading = document.createElement('h2');
    heading.className = 'kind-section-title';
    heading.textContent = section.title;
    sectionEl.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'song-list';
    items.forEach((song) => {
      list.appendChild(mode === 'libreto' ? buildLibretoRow(song) : buildAudioRow(song));
    });
    sectionEl.appendChild(list);

    container.appendChild(sectionEl);
  });

  if (!anyRendered) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = state.searchQuery
      ? 'No hay canciones que coincidan con la búsqueda.'
      : 'Todavía no hay canciones aquí.';
    container.appendChild(empty);
  }
}

function buildLibretoRow(song) {
  const card = document.createElement('div');
  card.className = 'song-card';
  card.style.setProperty('--card-color', `var(--kind-${song.kind})`);
  card.innerHTML = `
    <div>
      <div class="song-card-kind">${KIND_LABELS[song.kind] || song.kind}</div>
      <div class="song-card-title">${song.title}</div>
    </div>
  `;
  card.addEventListener('click', () => openLetra(song, { allowAudio: false }));
  return card;
}

function buildAudioRow(song) {
  const hasAudio = (song.audios || []).length > 0;
  const isCurrent = song.id === state.currentSongId;
  const card = document.createElement('div');
  card.className = 'song-card' + (isCurrent ? ' is-playing' : '');
  card.style.setProperty('--card-color', `var(--kind-${song.kind})`);
  card.innerHTML = `
    <div>
      <div class="song-card-kind">${KIND_LABELS[song.kind] || song.kind}</div>
      <div class="song-card-title">${song.title}</div>
    </div>
    ${hasAudio
      ? `<span class="song-card-play btn-icon">${isCurrent && !el.audioEl.paused ? '⏸' : '▶'}</span>`
      : '<span class="song-card-no-audio" title="Todavía no hay audio para esta letra">Sin audio</span>'}
  `;
  if (hasAudio) {
    card.addEventListener('click', () => toggleAudioRow(song));
  }
  return card;
}

function toggleAudioRow(song) {
  if (state.currentSongId === song.id) {
    if (el.audioEl.paused) {
      el.audioEl.play();
    } else {
      el.audioEl.pause();
    }
    return;
  }
  playSingleSong(song);
}

/* ══════════════════════════ Letra (lectura + karaoke cuando hay audio) ══════════════════════════ */

// allowAudio: false cuando se entra desde Repertorio — ese apartado es solo
// para leer la letra, sin ninguna opción de audio (eso vive en Audios).
function openLetra(song, { allowAudio = true } = {}) {
  state.letraSongId = song.id;
  state.letraAllowAudio = allowAudio;
  try { localStorage.setItem(LAST_LETRA_KEY, song.id); } catch (e) { /* sin almacenamiento */ }
  el.letraTitle.textContent = song.title;
  renderLetraVoiceRow(song);
  renderLetraLines(song);
  goScreen('letra');
}

function renderLetraVoiceRow(song) {
  const hasAudio = state.letraAllowAudio && (song.audios || []).length > 0;
  const isCurrent = song.id === state.currentSongId;
  el.letraVoiceRow.innerHTML = `
    <span class="letra-voice-tag">${KIND_LABELS[song.kind] || song.kind}</span>
    ${hasAudio
      ? `<button class="song-card-play btn-icon" id="letra-play-btn" style="width:36px;height:36px;">${isCurrent && !el.audioEl.paused ? '⏸' : '▶'}</button>
         <span class="letra-voice-note">Toca para escuchar mientras sigues la letra.</span>`
      : ''}
  `;
  if (hasAudio) {
    document.getElementById('letra-play-btn').addEventListener('click', () => toggleAudioRow(song));
  }
}

function renderLetraLines(song) {
  const rawLines = normalizeLetter(song.letter).split('\n');
  const lines = [];
  let pendingGap = false;
  rawLines.forEach((raw) => {
    if (raw.trim() === '') { pendingGap = true; return; }
    lines.push({ text: raw, gap: pendingGap });
    pendingGap = false;
  });
  state.letraLines = lines;
  state.letraLineOffsets = computeLetraLineOffsets(lines);
  el.letraLines.innerHTML = lines
    .map((l) => `<p class="letra-line${l.gap ? ' gap' : ''}">${l.text}</p>`)
    .join('');
  el.letraFootnote.classList.add('hidden');
  updateKaraokeHighlight();
}

// No hay marcas de tiempo reales por verso, así que se aproxima el instante
// en que empieza cada línea repartiendo la duración según el peso de cada
// una (nº de caracteres) en vez de a partes iguales — una línea larga tarda
// más en cantarse que una corta. Los huecos en blanco del libreto (pausas
// instrumentales/coro) suman un peso extra fijo para no acortarlos a cero.
const GAP_PAUSE_WEIGHT = 40;
function computeLetraLineOffsets(lines) {
  const weights = lines.map((l) => Math.max(l.text.trim().length, 1) + (l.gap ? GAP_PAUSE_WEIGHT : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const starts = [];
  let acc = 0;
  weights.forEach((w) => {
    starts.push(acc / total);
    acc += w;
  });
  return starts; // proporción [0..1) en la que empieza cada línea
}

// Mientras suena el audio de la canción que se está leyendo, resalta la
// línea cuya proporción de inicio (ver computeLetraLineOffsets) es la más
// avanzada sin superar la posición real de reproducción.
function updateKaraokeHighlight() {
  if (state.screen !== 'letra' || !state.letraLines.length) return;
  const children = [...el.letraLines.children];
  const isCurrent = state.letraSongId === state.currentSongId;
  if (!isCurrent || !el.audioEl.duration) {
    children.forEach((p) => p.classList.remove('current', 'near'));
    return;
  }
  const progress = el.audioEl.currentTime / el.audioEl.duration;
  const offsets = state.letraLineOffsets || [];
  let idx = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] <= progress) idx = i;
    else break;
  }
  children.forEach((p, i) => {
    p.classList.toggle('current', i === idx);
    p.classList.toggle('near', Math.abs(i - idx) === 1);
  });
}

el.letraBack.addEventListener('click', () => goScreen('libreto'));

/* ══════════════════════════ Panel del Director ══════════════════════════ */

function renderDirector() {
  el.directorPieces.innerHTML = '';
  SECTIONS.forEach((section, i) => {
    const items = state.songs.filter((s) => section.kinds.includes(s.kind)).sort(compareSongs);
    const hasAudio = items.some((s) => (s.audios || []).length > 0);
    const card = document.createElement('div');
    card.className = 'piece-card' + (items.length ? '' : ' is-empty');
    card.innerHTML = `
      <div class="piece-card-top">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <span class="name">${section.title.replace(' (con Estribillo)', '')}</span>
        <span class="status">${items.length ? (hasAudio ? 'Letra y audio' : 'Solo letra') : 'Sin letra'}</span>
      </div>
      <div class="piece-card-actions">
        <button class="btn btn-gold add-song" style="min-height:38px;font-size:12px;">Añadir canción</button>
      </div>
      <div class="piece-song-list"></div>
    `;
    card.querySelector('.add-song').addEventListener('click', () => openSongModal({ kind: section.kinds[0] }));
    const list = card.querySelector('.piece-song-list');
    items.forEach((song) => list.appendChild(buildDirectorSongRow(song)));
    el.directorPieces.appendChild(card);
  });

  const pending = state.members.filter((m) => m.role === 'pendiente');
  el.directorRequestsCount.textContent = String(pending.length);
  el.directorRequests.innerHTML = '';
  if (pending.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Nadie está esperando entrada ahora mismo.';
    el.directorRequests.appendChild(empty);
  } else {
    pending.forEach((m) => el.directorRequests.appendChild(buildRequestCard(m)));
  }

  renderAvisoHistory();
  renderDirectorMembers();
  renderDirectorRemoved();
}

// Componentes del coro (antes vivía en Administración): nombre editable,
// y un botón "Opciones" por fila que despliega asignar rol, asignar voz o
// eliminar a la persona del coro.
function renderDirectorMembers() {
  if (!el.directorMembers) return;
  el.directorMembers.innerHTML = '';
  const roster = state.members.filter((m) => m.role !== 'rechazado' && m.role !== 'pendiente');
  if (roster.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Todavía no hay componentes aprobados.';
    el.directorMembers.appendChild(empty);
    return;
  }
  roster.forEach((m) => el.directorMembers.appendChild(buildMemberRow(m)));
}

// Eliminados = role 'rechazado' (no se borra el documento): se pueden
// volver a activar como coristas.
function renderDirectorRemoved() {
  if (!el.directorRemoved) return;
  el.directorRemoved.innerHTML = '';
  const removed = state.members.filter((m) => m.role === 'rechazado');
  el.directorRemovedCount.textContent = String(removed.length);
  if (removed.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No hay coristas eliminados.';
    el.directorRemoved.appendChild(empty);
    return;
  }
  removed.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'member-row-wrap';
    row.innerHTML = `
      <div class="member-row">
        <span class="info">
          <span class="name-input" style="display:block;"></span>
          <span class="voice"></span>
        </span>
        <button type="button" class="btn btn-primary member-reactivate" style="min-height:32px;font-size:11px;">Activar</button>
      </div>`;
    row.querySelector('.name-input').textContent = m.name || '';
    row.querySelector('.voice').textContent = m.email || memberVoices(m).join(', ') || '';
    row.querySelector('.member-reactivate').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        await setMemberRole(m.id, 'corista');
        await refreshMembers();
        render();
      } catch (err) {
        e.target.disabled = false;
        window.alert('No se ha podido activar.');
      }
    });
    el.directorRemoved.appendChild(row);
  });
}

function buildMemberRow(m) {
  const meta = ROLE_META[m.role] || ROLE_META.pendiente;
  const wrap = document.createElement('div');
  wrap.className = 'member-row-wrap';
  wrap.innerHTML = `
    <div class="member-row">
      <span class="info">
        <input type="text" class="name-input" value="${m.name || ''}" />
        <span class="voice">${memberVoices(m).join(', ') || 'Sin voz asignada'}</span>
      </span>
      <span class="role" style="color:${meta.color};border:1px solid ${meta.border};">${meta.label}</span>
      <button type="button" class="btn btn-ghost member-options-toggle" style="min-height:32px;font-size:11px;">Opciones</button>
    </div>
    <div class="member-options-panel hidden">
      <label class="field">
        <span>Asignar rol</span>
        <select class="role-select">
          ${ROLE_OPTIONS.map((r) => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${ROLE_META[r].label}</option>`).join('')}
        </select>
      </label>
      <div class="field">
        <span>Asignar voz (puede llevar varias)</span>
        <div class="voice-checks">
          ${VOICE_OPTIONS.map((v) => `<label class="voice-check">
            <input type="checkbox" class="voice-check-input" value="${v}" ${memberVoices(m).includes(v) ? 'checked' : ''} />
            <span>${v}</span>
          </label>`).join('')}
        </div>
      </div>
      ${isAdminRole() && m.email ? '<button type="button" class="btn btn-ghost member-reset-pw">Restablecer contraseña</button>' : ''}
      <button type="button" class="btn btn-ghost member-delete">Eliminar del coro</button>
    </div>
  `;

  const panel = wrap.querySelector('.member-options-panel');
  wrap.querySelector('.member-options-toggle').addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  wrap.querySelector('.role-select').addEventListener('change', async (e) => {
    try {
      await setMemberRole(m.id, e.target.value);
      await refreshMembers();
      render();
    } catch (err) { /* deja el valor anterior si falla */ }
  });

  wrap.querySelectorAll('.voice-check-input').forEach((input) => {
    input.addEventListener('change', async () => {
      const voices = [...wrap.querySelectorAll('.voice-check-input:checked')].map((i) => i.value);
      try {
        await assignVoices(m.id, voices);
        await refreshMembers();
        render();
      } catch (err) {
        input.checked = !input.checked; /* deja el valor anterior si falla */
      }
    });
  });

  wrap.querySelector('.member-reset-pw')?.addEventListener('click', async (e) => {
    if (!window.confirm(`¿Enviar a ${m.email} un correo para que «${m.name}» elija una contraseña nueva?`)) return;
    e.target.disabled = true;
    try {
      await resetMemberPassword(m.email);
      window.alert('Correo de restablecimiento enviado.');
    } catch (err) {
      window.alert('No se ha podido enviar el correo.');
    } finally {
      e.target.disabled = false;
    }
  });

  wrap.querySelector('.member-delete').addEventListener('click', async () => {
    if (!window.confirm(`¿Eliminar a «${m.name}» del coro? Perderá el acceso a la app y podrás activarlo de nuevo desde «Coristas eliminados».`)) return;
    try {
      await rejectMember(m.id);
      await refreshMembers();
      render();
    } catch (err) {
      window.alert('No se ha podido eliminar.');
    }
  });

  const nameInput = wrap.querySelector('.name-input');
  nameInput.addEventListener('change', async () => {
    const name = nameInput.value.trim();
    if (!name || name === m.name) { nameInput.value = m.name || ''; return; }
    try {
      await renameMember(m.id, name);
      await refreshMembers();
      render();
    } catch (err) {
      nameInput.value = m.name || '';
    }
  });

  return wrap;
}

function buildRequestCard(member) {
  const myRole = state.currentMember?.role;
  const card = document.createElement('div');
  card.className = 'request-card';
  card.innerHTML = `
    <div class="who">
      <span class="name">${member.name}</span>
      <span class="meta">${member.email || 'Sin correo registrado'}</span>
    </div>
    <div class="actions">
      <button class="btn btn-primary approve">Aprobar</button>
      <button class="reject">Rechazar</button>
    </div>
    <div class="hint">La voz se le asigna después, en la lista de componentes.</div>
  `;
  card.querySelector('.approve').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await approveMember(member, myRole);
      await refreshMembers();
      render();
    } catch (err) {
      e.target.disabled = false;
    }
  });
  card.querySelector('.reject').addEventListener('click', async () => {
    try {
      await rejectMember(member.id);
      await refreshMembers();
      render();
    } catch (err) { /* la fila se mantiene si falla */ }
  });
  return card;
}

function buildDirectorSongRow(song) {
  const row = document.createElement('div');
  row.className = 'piece-song-row';
  row.innerHTML = `
    <span class="title">${song.title}</span>
    <div class="audio-chips"></div>
    <button class="btn btn-ghost ensayo" style="min-height:32px;font-size:11px;">${song.enEnsayo ? '★ En ensayo' : '☆ Ensayo'}</button>
    <button class="btn btn-ghost edit" style="min-height:32px;font-size:11px;">Editar letra</button>
    <button class="btn btn-ghost delete" style="min-height:32px;font-size:11px;">Eliminar</button>
  `;

  // Por ahora solo se sube un audio por canción (el de grupo). Cuando haga
  // falta, se puede volver a ofrecer un audio por voz (tenor, segunda...):
  // uploadSongAudio() y AUDIO_TYPE_LABELS ya están listos para eso.
  const type = 'grupo';
  const chips = row.querySelector('.audio-chips');
  const has = (song.audios || []).some((a) => a.type === type);
  const wrap = document.createElement('span');
  wrap.className = 'audio-chip-wrap';

  if (has) {
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'audio-play-btn';
    playBtn.title = 'Escuchar audio';
    playBtn.textContent = '▶';
    playBtn.addEventListener('click', () => playSongAudio(song, type));
    wrap.appendChild(playBtn);
  }

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'audio-chip' + (has ? ' has-audio' : '');
  chip.textContent = has ? 'Audio ✓' : 'Subir audio';
  chip.title = has ? 'Sustituir audio' : 'Subir audio (mp3)';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac';
  fileInput.className = 'audio-file-input';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    chip.disabled = true;
    chip.textContent = 'Subiendo…';
    try {
      await uploadSongAudio(song, type, file);
      await refreshSongs();
      render();
    } catch (err) {
      console.error(err);
      window.alert(`No se ha podido subir el audio (${err.code || err.message || 'error desconocido'}).`);
      chip.disabled = false;
      chip.textContent = has ? 'Audio ✓' : 'Subir audio';
    }
  });

  chip.addEventListener('click', () => fileInput.click());
  wrap.appendChild(chip);
  wrap.appendChild(fileInput);
  chips.appendChild(wrap);

  row.querySelector('.ensayo').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await updateSong(song.id, { enEnsayo: !song.enEnsayo });
      await refreshSongs();
      render();
    } catch (err) {
      e.target.disabled = false;
      window.alert('No se ha podido actualizar.');
    }
  });
  row.querySelector('.edit').addEventListener('click', () => openSongModal(song));
  row.querySelector('.delete').addEventListener('click', async () => {
    if (!window.confirm(`¿Eliminar «${song.title}» y sus audios?`)) return;
    try {
      await deleteSong(song);
      await refreshSongs();
      render();
    } catch (err) {
      window.alert('No se ha podido eliminar.');
    }
  });
  return row;
}

/* ══════════════════════════ Modal: escribir/editar letra ══════════════════════════ */

let editingSong = null;

function openSongModal(song) {
  editingSong = song;
  el.songModalTitle.textContent = song.id ? 'Editar letra' : 'Nueva canción';
  el.songFormTitle.value = song.title || '';
  el.songFormLetter.value = song.letter || '';
  el.songFormError.classList.add('hidden');
  el.songFileError.classList.add('hidden');
  el.songFormFile.value = '';
  el.songModalBackdrop.classList.remove('hidden');
  el.songModal.classList.remove('hidden');
}

// Extrae el texto de un .docx (con mammoth.js) o un .pdf (con pdf.js) para
// no obligar a la dirección a copiar y pegar la letra a mano. El .doc
// antiguo (binario, no .docx) no se puede leer en el navegador — hay que
// guardarlo como .docx primero o pasarlo a mano.
async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (name.endsWith('.docx')) {
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (name.endsWith('.pdf')) {
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(' ') + '\n\n';
    }
    return text;
  }

  throw new Error('unsupported-format');
}

el.songFormFile.addEventListener('change', async () => {
  const file = el.songFormFile.files[0];
  if (!file) return;
  el.songFileError.classList.add('hidden');
  try {
    const text = (await extractTextFromFile(file)).trim();
    el.songFormLetter.value = text;
  } catch (err) {
    el.songFileError.textContent = err.message === 'unsupported-format'
      ? 'Solo se puede leer .docx o .pdf. Si es un .doc antiguo, guárdalo como .docx desde Word y vuelve a intentarlo.'
      : 'No se ha podido leer el archivo. Revisa que no esté dañado.';
    el.songFileError.classList.remove('hidden');
  } finally {
    el.songFormFile.value = '';
  }
});

function closeSongModal() {
  el.songModalBackdrop.classList.add('hidden');
  el.songModal.classList.add('hidden');
  editingSong = null;
}

el.songModalCancel.addEventListener('click', closeSongModal);
el.songModalBackdrop.addEventListener('click', closeSongModal);

el.songModalSave.addEventListener('click', async () => {
  const title = el.songFormTitle.value.trim();
  const letter = el.songFormLetter.value;
  if (!title) {
    el.songFormError.textContent = 'Ponle un título a la canción.';
    el.songFormError.classList.remove('hidden');
    return;
  }
  el.songModalSave.disabled = true;
  try {
    if (editingSong.id) {
      await updateSong(editingSong.id, { title, letter });
    } else {
      await createSong({ title, kind: editingSong.kind, letter });
    }
    await refreshSongs();
    render();
    closeSongModal();
  } catch (err) {
    console.error(err);
    el.songFormError.textContent = 'No se ha podido guardar. Inténtalo de nuevo.';
    el.songFormError.classList.remove('hidden');
  } finally {
    el.songModalSave.disabled = false;
  }
});

/* ══════════════════════════ Modal: crear timbrazo ══════════════════════════ */

let avisoModalType = 'notificacion';
let avisoModalEditingId = null;

function openAvisoModal(type, existingAviso = null) {
  avisoModalType = type;
  avisoModalEditingId = existingAviso ? existingAviso.id : null;
  const isEditing = !!existingAviso;
  el.avisoModalTitle.textContent = isEditing
    ? 'Editar timbrazo'
    : 'Nuevo timbrazo';
  el.avisoFormTitle.value = existingAviso ? existingAviso.title || '' : '';
  el.avisoFormBody.value = existingAviso ? existingAviso.body || '' : '';
  el.avisoModalSave.textContent = isEditing ? 'Guardar' : 'Publicar';
  el.avisoFormError.classList.add('hidden');
  el.avisoModalBackdrop.classList.remove('hidden');
  el.avisoModal.classList.remove('hidden');
}

function closeAvisoModal() {
  avisoModalEditingId = null;
  el.avisoModalBackdrop.classList.add('hidden');
  el.avisoModal.classList.add('hidden');
}

async function handleDeleteAviso(aviso) {
  const isNotificacion = aviso.type === 'notificacion';
  if (!window.confirm(`¿Eliminar ${isNotificacion ? 'esta notificación' : 'este timbrazo'}? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteAviso(aviso.id);
    await refreshAvisos();
    render();
  } catch (err) {
    console.error(err);
    window.alert('No se ha podido eliminar. Inténtalo de nuevo.');
  }
}

document.querySelectorAll('.director-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.director-tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.director-group').forEach((g) => g.classList.toggle('hidden', g.dataset.group !== tab.dataset.group));
  });
});

if (el.directorCrearTimbrazo) el.directorCrearTimbrazo.addEventListener('click', () => openAvisoModal('aviso'));
el.avisoModalCancel.addEventListener('click', closeAvisoModal);
el.avisoModalBackdrop.addEventListener('click', closeAvisoModal);

el.avisoModalSave.addEventListener('click', async () => {
  const title = el.avisoFormTitle.value.trim();
  const body = el.avisoFormBody.value.trim();
  if (!title) {
    el.avisoFormError.textContent = 'Ponle un título.';
    el.avisoFormError.classList.remove('hidden');
    return;
  }
  el.avisoModalSave.disabled = true;
  try {
    if (avisoModalEditingId) {
      await updateAviso(avisoModalEditingId, { title, body });
    } else {
      await createAviso({ type: avisoModalType, title, body, authorName: state.currentMember?.name });
    }
    await refreshAvisos();
    render();
    closeAvisoModal();
  } catch (err) {
    console.error(err);
    el.avisoFormError.textContent = 'No se ha podido guardar. Inténtalo de nuevo.';
    el.avisoFormError.classList.remove('hidden');
  } finally {
    el.avisoModalSave.disabled = false;
  }
});

/* ══════════════════════════ Panel de Administración ══════════════════════════ */

function renderAdmin() {
  const directors = state.members.filter((m) => m.role === 'director').length;
  const pending = state.members.filter((m) => m.role === 'pendiente');
  const active = state.members.filter((m) => m.role !== 'pendiente').length;

  el.adminStatMembers.textContent = String(active);
  el.adminStatDirectors.textContent = String(directors);
  el.adminStatPending.textContent = String(pending.length);
  el.drawerAdminCount.classList.toggle('hidden', pending.length === 0);
  el.drawerAdminCount.textContent = String(pending.length);

  el.adminRequests.innerHTML = '';
  if (pending.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No hay nada pendiente de tu firma.';
    el.adminRequests.appendChild(empty);
  } else {
    pending.forEach((m) => el.adminRequests.appendChild(buildRequestCard(m)));
  }

  el.adminActivity.innerHTML = '';
  const activityEmpty = document.createElement('div');
  activityEmpty.className = 'empty-state';
  activityEmpty.textContent = 'Todavía no hay actividad registrada.';
  el.adminActivity.appendChild(activityEmpty);
}

// Sin un selector de componentes en el diseño original, se pide el correo
// por un prompt sencillo: solo lo puede ejecutar quien ya es director o
// administrador (lo hacen cumplir las reglas de Firestore).
if (el.adminNombrarDirector) {
  el.adminNombrarDirector.addEventListener('click', async () => {
    const email = window.prompt('Correo del componente que quieres nombrar director:');
    if (!email) return;
    const member = state.members.find((m) => (m.email || '').toLowerCase() === email.trim().toLowerCase());
    if (!member) {
      window.alert('No hay ningún componente con ese correo en la lista.');
      return;
    }
    try {
      await promoteToDirector(member.id);
      await refreshMembers();
      render();
    } catch (err) {
      window.alert('No se ha podido nombrar director.');
    }
  });
}

// No hay un sistema de invitaciones con código: cualquiera puede pedir
// entrada desde la app y luego se aprueba desde aquí. "Invitar" copia el
// enlace del sitio al portapapeles para que sea fácil compartirlo.
for (const btn of [el.adminInvitar, el.directorInvitar]) if (btn) {
  btn.addEventListener('click', async () => {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
      window.alert(`Enlace copiado: ${url}\n\nCompártelo con quien quieras invitar — puede pedir su entrada desde ahí y luego la apruebas tú (o un director).`);
    } catch (err) {
      window.prompt('Copia este enlace para compartirlo:', url);
    }
  });
}

/* ══════════════════════════ Reproductor (audio real, compartido) ══════════════════════════ */

// Todas las canciones con audio que coinciden con la búsqueda activa, en el
// mismo orden en que aparecen en la pestaña Audios. Es la lista sobre la que
// se mueven ⏮/⏭ cuando se reproduce una canción suelta (fuera de Modo
// ensayo) — así los botones sirven para pasar de una canción a otra en vez
// de no tener a dónde ir por haber una sola canción cargada.
function getPlayableSongs() {
  const query = normalizeForSearch(state.searchQuery);
  return state.songs
    .filter((s) => (s.audios || []).length > 0 && matchesSearch(s, query))
    .sort(compareSongs);
}

// Reproduce el audio de un tipo de voz concreto de una canción (se usa desde
// el Panel del director, al pulsar ▶ junto a un audio ya subido) en el mismo
// reproductor compartido de la parte de abajo de la app.
function playSongAudio(song, type) {
  const url = getAudioUrl(song, type);
  if (!url) return;
  state.rehearsalMode = false;
  state.playlist = [song];
  state.playlistIndex = 0;
  state.audioType = type;
  state.currentSongId = song.id;
  el.playerBar.classList.remove('hidden');
  el.playerTitle.textContent = `${song.title} · ${audioTypeLabel(type)}`;
  el.audioEl.src = url;
  el.audioEl.loop = state.loopEnabled;
  el.audioEl.play();
  syncBottomPadding();
}

function playSingleSong(song) {
  state.rehearsalMode = false;
  state.playlist = getPlayableSongs();
  state.playlistIndex = state.playlist.findIndex((s) => s.id === song.id);
  if (state.playlistIndex === -1) {
    state.playlist = [song];
    state.playlistIndex = 0;
  }
  playCurrent();
}

function buildRehearsalPlaylist(songs, { shuffleCuples }) {
  const sorted = [...songs].sort(compareSongs);
  if (!shuffleCuples) return sorted;

  // Baraja el orden de los cuplés entre sí, manteniendo el resto de tipos
  // (presentación, tangos, estribillo, popurrí) en su posición habitual.
  let cuples = shuffle(sorted.filter((s) => s.kind === 'cuple'));
  let cupleIndex = 0;
  return sorted.map((song) => (song.kind === 'cuple' ? cuples[cupleIndex++] : song));
}

function startRehearsal() {
  const query = normalizeForSearch(state.searchQuery);
  const pool = state.songs.filter((s) => matchesSearch(s, query));
  const playlist = buildRehearsalPlaylist(pool, { shuffleCuples: el.shuffleCuples.checked });
  if (playlist.length === 0) return;

  state.rehearsalMode = true;
  state.audioType = el.audioTypeSelect.value;
  state.playlist = playlist;
  state.playlistIndex = 0;
  el.rehearsalBar.classList.remove('hidden');
  playCurrent();
}

function stopRehearsal() {
  state.rehearsalMode = false;
  state.currentSongId = null;
  el.rehearsalBar.classList.add('hidden');
  el.audioEl.pause();
  el.playerBar.classList.add('hidden');
  refreshNowPlayingUI();
  syncBottomPadding();
}

function refreshNowPlayingUI() {
  renderSectioned(el.audiosList, 'audios');
  if (state.screen === 'letra' && state.letraSongId) {
    const song = state.songs.find((s) => s.id === state.letraSongId);
    if (song) renderLetraVoiceRow(song);
  }
}

el.rehearsalToggle.addEventListener('click', startRehearsal);
el.rehearsalClose.addEventListener('click', stopRehearsal);
el.audioTypeSelect.addEventListener('change', () => {
  state.audioType = el.audioTypeSelect.value;
  if (state.rehearsalMode) playCurrent();
});

function playCurrent() {
  const song = state.playlist[state.playlistIndex];
  if (!song) return;

  const type = state.rehearsalMode ? state.audioType : 'grupo';
  const url = getAudioUrl(song, type);

  el.playerBar.classList.remove('hidden');
  el.playerTitle.textContent = song.title;

  if (state.rehearsalMode) {
    openLetra(song);
    el.rehearsalCurrentTitle.textContent = song.title;
    el.rehearsalPosition.textContent = `${state.playlistIndex + 1} / ${state.playlist.length}`;
  }

  if (!url) {
    // No hay audio de este tipo para esta canción: pasamos a la siguiente.
    playNext();
    return;
  }

  state.currentSongId = song.id;
  el.audioEl.src = url;
  el.audioEl.loop = state.loopEnabled;
  el.audioEl.play();
  syncBottomPadding();
}

function playNext() {
  if (state.playlistIndex < state.playlist.length - 1) {
    state.playlistIndex += 1;
    playCurrent();
  } else if (state.rehearsalMode) {
    stopRehearsal();
  }
}

function playPrev() {
  if (state.playlistIndex > 0) {
    state.playlistIndex -= 1;
    playCurrent();
  }
}

el.playerClose.addEventListener('click', stopRehearsal);
el.playerNext.addEventListener('click', playNext);
el.playerPrev.addEventListener('click', playPrev);

el.playerLoop.addEventListener('click', () => {
  state.loopEnabled = !state.loopEnabled;
  el.audioEl.loop = state.loopEnabled;
  el.playerLoop.classList.toggle('active', state.loopEnabled);
});

el.playerPlayPause.addEventListener('click', () => {
  if (el.audioEl.paused) {
    el.audioEl.play();
  } else {
    el.audioEl.pause();
  }
});

// Única fuente de verdad para el icono de play/pausa y para resaltar la fila
// que suena en la lista de Audios (y en Letra): los eventos del propio
// <audio>, no cada sitio que llama a play()/pause() (así se mantiene
// sincronizado también si el audio se pausa desde los controles del sistema
// operativo).
el.audioEl.addEventListener('play', () => {
  el.playerPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
  refreshNowPlayingUI();
});
el.audioEl.addEventListener('pause', () => {
  el.playerPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
  refreshNowPlayingUI();
});

el.audioEl.addEventListener('ended', playNext);

// Arrastre de la barra de progreso: mientras el usuario arrastra (evento
// "input", tanto con dedo como con ratón) se marca isSeeking para que el
// "timeupdate" del audio no le devuelva el valor y "pelee" con el dedo —
// eso era lo que impedía retroceder arrastrando. Al soltar ("change") se
// confirma la posición y se reanuda la sincronización automática.
const SEEK_RESOLUTION = 1000;
let isSeeking = false;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

el.playerSeek.addEventListener('input', () => {
  isSeeking = true;
  if (!el.audioEl.duration) return;
  el.audioEl.currentTime = (el.playerSeek.value / SEEK_RESOLUTION) * el.audioEl.duration;
});

el.playerSeek.addEventListener('change', () => {
  isSeeking = false;
});

el.audioEl.addEventListener('timeupdate', () => {
  if (!isSeeking && el.audioEl.duration) {
    el.playerSeek.value = (el.audioEl.currentTime / el.audioEl.duration) * SEEK_RESOLUTION;
  }
  el.playerCurrentTime.textContent = formatTime(el.audioEl.currentTime);
  el.playerDuration.textContent = formatTime(el.audioEl.duration);
  updateKaraokeHighlight();
});

syncBottomPadding();
goAuthScreen('login');
loadData();
watchAuthState(handleAuthChange);
