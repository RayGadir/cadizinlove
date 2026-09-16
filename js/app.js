import {
  watchAuthState,
  login,
  logout,
  requestAccess,
  getMember,
  listMembers,
  approveMember,
  rejectMember,
  assignVoice,
  promoteToDirector,
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
const VOICE_OPTIONS = ['Tenor', 'Segunda', 'Bajo', 'Tercera'];

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
  drawerMyVoice: document.getElementById('drawer-my-voice'),
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

  adminView: document.getElementById('admin-view'),
  adminStatMembers: document.getElementById('admin-stat-members'),
  adminStatDirectors: document.getElementById('admin-stat-directors'),
  adminStatPending: document.getElementById('admin-stat-pending'),
  adminRequests: document.getElementById('admin-requests'),
  adminMembers: document.getElementById('admin-members'),
  adminActivity: document.getElementById('admin-activity'),
  adminNombrarDirector: document.getElementById('admin-nombrar-director'),

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
  playerTitle: document.getElementById('player-title'),
  playerSeek: document.getElementById('player-seek'),
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
  el.drawerMyVoice.textContent = member.voice || 'Sin asignar';
  el.drawerDirectorItem.classList.toggle('hidden', member.role !== 'director' && member.role !== 'admin');
  el.drawerAdminItem.classList.toggle('hidden', member.role !== 'admin');
}

// Punto central de enrutado según el estado real de sesión de Firebase Auth:
// sin sesión -> login; con sesión pero sin aprobar -> pantalla de espera;
// aprobado -> la app, con el panel de director/admin visible según el rol.
async function handleAuthChange(user) {
  state.currentUser = user;
  if (!user) {
    state.currentMember = null;
    state.members = [];
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
  if (member.role === 'director' || member.role === 'admin') {
    await refreshMembers();
  }
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

async function loadData() {
  const [songsRes, avisosRes] = await Promise.all([
    fetch('data/songs.json'),
    fetch('data/avisos.json'),
  ]);
  const data = await songsRes.json();
  el.groupName.textContent = data.group?.name || 'Cádiz in Love';
  state.songs = data.songs || [];
  state.avisos = await avisosRes.json();

  const typesPresent = new Set();
  state.songs.forEach((song) => (song.audios || []).forEach((a) => typesPresent.add(a.type)));
  [...typesPresent].forEach((type) => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = audioTypeLabel(type);
    el.audioTypeSelect.appendChild(opt);
  });
  state.audioType = el.audioTypeSelect.value || 'grupo';

  render();
}

function render() {
  renderInicio();
  renderSectioned(el.libretoView, 'libreto');
  renderSectioned(el.audiosList, 'audios');
  renderDirector();
  renderAdmin();
}

/* ══════════════════════════ Navegación entre pantallas ══════════════════════════ */

const SCREEN_ELS = {
  inicio: el.inicioView,
  libreto: el.libretoView,
  audios: el.audiosView,
  letra: el.letraView,
  director: el.directorView,
  admin: el.adminView,
};
// Estas pantallas usan la cabecera compartida (#topbar); director y admin
// llevan su propia cabecera incrustada.
const CHROME_SCREENS = new Set(['inicio', 'libreto', 'audios', 'letra']);
const SEARCH_SCREENS = new Set(['libreto', 'audios']);

function goScreen(screen) {
  state.screen = screen;
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
el.drawerBackdrop.addEventListener('click', closeDrawer);
el.drawerNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.drawer-item');
  if (!btn || !btn.dataset.screen) return;
  goScreen(btn.dataset.screen);
});
el.drawerLogout.addEventListener('click', () => logout());

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

function renderAvisos() {
  el.avisosList.innerHTML = '';
  if (state.avisos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Todavía no hay avisos. Cuando la dirección publique alguno, aparecerá aquí.';
    el.avisosList.appendChild(empty);
    return;
  }
  state.avisos.forEach((aviso) => {
    const card = document.createElement('article');
    card.className = 'aviso-card';
    card.innerHTML = `
      <div class="aviso-card-top">
        <span class="tag-pill">${aviso.tag || ''}</span>
        <time>${aviso.date || ''}</time>
      </div>
      <h3 class="aviso-title">${aviso.title || ''}</h3>
      <p class="aviso-body">${aviso.body || ''}</p>
      ${aviso.signoff ? `<div class="aviso-signoff">${aviso.signoff}</div>` : ''}
    `;
    el.avisosList.appendChild(card);
  });
}

function renderRepertoireSummary() {
  el.repertoireList.innerHTML = '';
  const written = SECTIONS.filter((section) =>
    state.songs.some((s) => section.kinds.includes(s.kind))
  ).length;
  el.repertoireCount.textContent = `${written} de ${SECTIONS.length} con letras`;

  SECTIONS.forEach((section, i) => {
    const hasSongs = state.songs.some((s) => section.kinds.includes(s.kind));
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'repertoire-row' + (hasSongs ? '' : ' is-empty');
    row.style.setProperty('--card-color', `var(--kind-${section.kinds[0]})`);
    row.innerHTML = `
      <span class="repertoire-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="repertoire-title">${section.title.replace(' (con Estribillo)', '')}</span>
      <span class="repertoire-status">${hasSongs ? 'Disponible' : 'Sin letras todavía'}</span>
    `;
    row.addEventListener('click', () => goScreen('libreto'));
    el.repertoireList.appendChild(row);
  });
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
  card.addEventListener('click', () => openLetra(song));
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

function openLetra(song) {
  state.letraSongId = song.id;
  el.letraTitle.textContent = song.title;
  renderLetraVoiceRow(song);
  renderLetraLines(song);
  goScreen('letra');
}

function renderLetraVoiceRow(song) {
  const hasAudio = (song.audios || []).length > 0;
  const isCurrent = song.id === state.currentSongId;
  el.letraVoiceRow.innerHTML = `
    <span class="letra-voice-tag">${KIND_LABELS[song.kind] || song.kind}</span>
    ${hasAudio
      ? `<button class="song-card-play btn-icon" id="letra-play-btn" style="width:36px;height:36px;">${isCurrent && !el.audioEl.paused ? '⏸' : '▶'}</button>
         <span class="letra-voice-note">Toca para escuchar mientras sigues la letra.</span>`
      : '<span class="letra-voice-note">Todavía no hay audio para esta letra.</span>'}
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
  el.letraLines.innerHTML = lines
    .map((l) => `<p class="letra-line${l.gap ? ' gap' : ''}">${l.text}</p>`)
    .join('');
  el.letraFootnote.classList.add('hidden');
  updateKaraokeHighlight();
}

// Mientras suena el audio de la canción que se está leyendo, resalta la
// línea correspondiente según la posición real de reproducción (no hay
// datos de tiempo por verso, así que se reparte el texto a partes iguales
// sobre la duración total — una aproximación razonable, no exacta).
function updateKaraokeHighlight() {
  if (state.screen !== 'letra' || !state.letraLines.length) return;
  const children = [...el.letraLines.children];
  const isCurrent = state.letraSongId === state.currentSongId;
  if (!isCurrent || !el.audioEl.duration) {
    children.forEach((p) => p.classList.remove('current', 'near'));
    return;
  }
  const idx = Math.min(children.length - 1, Math.floor((el.audioEl.currentTime / el.audioEl.duration) * children.length));
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
    const items = state.songs.filter((s) => section.kinds.includes(s.kind));
    const hasAny = items.length > 0;
    const hasAudio = items.some((s) => (s.audios || []).length > 0);
    const card = document.createElement('div');
    card.className = 'piece-card' + (hasAny ? '' : ' is-empty');
    card.innerHTML = `
      <div class="piece-card-top">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <span class="name">${section.title.replace(' (con Estribillo)', '')}</span>
        <span class="status">${hasAny ? (hasAudio ? 'Letra y audio' : 'Solo letra') : 'Sin letra'}</span>
      </div>
      <div class="piece-card-actions">
        <button class="btn btn-gold" style="min-height:38px;font-size:12px;">${hasAny ? 'Editar letra' : 'Escribir letra'}</button>
        <button class="btn btn-ghost" style="min-height:38px;font-size:12px;">Subir audio</button>
        ${hasAny ? '<button class="btn btn-ghost" style="min-height:38px;font-size:12px;">Avisar del cambio</button>' : ''}
      </div>
      ${hasAny ? `<div class="piece-card-meta">${items.length} pieza${items.length === 1 ? '' : 's'} escrita${items.length === 1 ? '' : 's'}</div>` : ''}
    `;
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
}

function buildRequestCard(member) {
  const myRole = state.currentMember?.role;
  const myField = myRole === 'director' ? 'approvedByDirector' : 'approvedByAdmin';
  const alreadySigned = member[myField] === true;
  const card = document.createElement('div');
  card.className = 'request-card';
  card.innerHTML = `
    <div class="who">
      <span class="name">${member.name}</span>
      <span class="meta">${member.email || 'Sin correo registrado'}</span>
    </div>
    <div class="signatures">${alreadySigned ? 'Ya has firmado' : 'Falta tu firma'}</div>
    <div class="actions">
      <button class="btn btn-primary approve" ${alreadySigned ? 'disabled' : ''}>Aprobar</button>
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

  el.adminMembers.innerHTML = '';
  const roster = state.members.filter((m) => m.role !== 'rechazado' && m.role !== 'pendiente');
  if (roster.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Todavía no hay componentes aprobados.';
    el.adminMembers.appendChild(empty);
  } else {
    roster.forEach((m) => {
      const meta = ROLE_META[m.role] || ROLE_META.pendiente;
      const row = document.createElement('div');
      row.className = 'member-row';
      row.innerHTML = `
        <span class="info">
          <span class="name">${m.name}</span>
          <span class="voice">${m.voice || 'Sin voz asignada'}</span>
        </span>
        <select class="voice-select">
          <option value="">Sin voz</option>
          ${VOICE_OPTIONS.map((v) => `<option value="${v}" ${m.voice === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <span class="role" style="color:${meta.color};border:1px solid ${meta.border};">${meta.label}</span>
      `;
      row.querySelector('.voice-select').addEventListener('change', async (e) => {
        try {
          await assignVoice(m.id, e.target.value || null);
          await refreshMembers();
          render();
        } catch (err) { /* deja el valor anterior si falla */ }
      });
      el.adminMembers.appendChild(row);
    });
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
  el.playerPlayPause.textContent = '⏸';
  refreshNowPlayingUI();
});
el.audioEl.addEventListener('pause', () => {
  el.playerPlayPause.textContent = '▶';
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
  updateKaraokeHighlight();
});

syncBottomPadding();
goAuthScreen('login');
loadData();
watchAuthState(handleAuthChange);
