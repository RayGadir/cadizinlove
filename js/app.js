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
  activeTab: 'inicio',
  searchQuery: '',
  playlist: [],
  playlistIndex: -1,
  rehearsalMode: false,
  audioType: 'grupo',
  currentSongId: null,
  loopEnabled: false,
  isAdmin: false,
};

const el = {
  groupName: document.getElementById('group-name'),
  adminAvatar: document.getElementById('admin-avatar'),
  tabs: document.getElementById('tabs'),
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
  songDetail: document.getElementById('song-detail'),
  detailKind: document.getElementById('detail-kind'),
  detailTitle: document.getElementById('detail-title'),
  detailLetter: document.getElementById('detail-letter'),
  backBtn: document.getElementById('back-btn'),
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

// No hay backend, así que no hay cuentas ni contraseñas reales: el rol de
// administrador es solo un ajuste guardado en este navegador. Sirve para
// distinguir, en este dispositivo, a quien gestiona el tablón/repertorio de
// quien solo lo consulta — no es seguridad real ni funciona en otro
// dispositivo o navegador.
const ADMIN_STORAGE_KEY = 'cadizInLove.isAdmin';
function initAdmin() {
  localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
  state.isAdmin = localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  el.adminAvatar.textContent = state.isAdmin ? 'AD' : '·';
  el.adminAvatar.title = state.isAdmin
    ? 'Administrador en este navegador (ajuste local, no es una cuenta real)'
    : 'Miembro';
  el.inicioGreeting.textContent = state.isAdmin ? 'Bienvenido, administrador' : 'Bienvenido';
}

// El contenido de #bottom-bars cambia de altura (aparece el reproductor,
// la barra de ensayo hace wrap en pantallas estrechas...), así que el hueco
// que le dejamos al final de la página se recalcula cada vez que cambia algo
// que puede afectar a esa altura, para que nunca tape el final de una letra.
function syncBottomPadding() {
  document.body.style.paddingBottom = `${el.bottomBars.offsetHeight + 16}px`;
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
}

function renderInicio() {
  renderAvisos();
  renderRepertoireSummary();
}

function renderAvisos() {
  el.avisosList.innerHTML = '';
  if (state.avisos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Todavía no hay avisos. Cuando el director publique alguno, aparecerá aquí.';
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
    row.addEventListener('click', () => switchTab('libreto'));
    el.repertoireList.appendChild(row);
  });
}

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
  card.addEventListener('click', () => showDetail(song));
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

function showDetail(song) {
  el.songDetail.classList.remove('hidden');
  el.libretoView.classList.add('hidden');
  el.audiosView.classList.add('hidden');
  el.detailKind.textContent = KIND_LABELS[song.kind] || song.kind;
  el.detailKind.style.setProperty('--card-color', `var(--kind-${song.kind})`);
  el.detailTitle.textContent = song.title;
  el.detailLetter.textContent = normalizeLetter(song.letter);
}

function hideDetail() {
  el.songDetail.classList.add('hidden');
  el.inicioView.classList.toggle('hidden', state.activeTab !== 'inicio');
  el.libretoView.classList.toggle('hidden', state.activeTab !== 'libreto');
  el.audiosView.classList.toggle('hidden', state.activeTab !== 'audios');
  el.searchRow.classList.toggle('hidden', state.activeTab === 'inicio');
}

function switchTab(tab) {
  state.activeTab = tab;
  [...el.tabs.querySelectorAll('.tab-btn')].forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  hideDetail();
}

el.backBtn.addEventListener('click', hideDetail);

el.tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

el.searchInput.addEventListener('input', () => {
  state.searchQuery = el.searchInput.value;
  render();
});

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
  hideDetail();
  renderAudios();
  syncBottomPadding();
}

function renderAudios() {
  renderSectioned(el.audiosList, 'audios');
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
    showDetail(song);
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
// que suena en la lista de Audios: los eventos del propio <audio>, no cada
// sitio que llama a play()/pause() (así se mantiene sincronizado también si
// el audio se pausa desde los controles del sistema operativo).
el.audioEl.addEventListener('play', () => {
  el.playerPlayPause.textContent = '⏸';
  renderAudios();
});
el.audioEl.addEventListener('pause', () => {
  el.playerPlayPause.textContent = '▶';
  renderAudios();
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
  if (isSeeking || !el.audioEl.duration) return;
  el.playerSeek.value = (el.audioEl.currentTime / el.audioEl.duration) * SEEK_RESOLUTION;
});

syncBottomPadding();
initAdmin();
loadData();
