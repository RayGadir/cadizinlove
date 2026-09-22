// Inicialización de Firebase (Auth + Firestore) para Cádiz in Love.
//
// El "firebaseConfig" de abajo NO es secreto — son identificadores públicos
// del proyecto, pensados para ir en el código del cliente (así funciona
// Firebase: la seguridad real la ponen las reglas de Firestore, no ocultar
// esto). Lo que protege los datos es firestore.rules, no esta config.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAvoo_3ssFHm1gtYlaKioiawb6SWIkJ3fs',
  authDomain: 'coro-cadiz-in-love.firebaseapp.com',
  projectId: 'coro-cadiz-in-love',
  storageBucket: 'coro-cadiz-in-love.firebasestorage.app',
  messagingSenderId: '874739206290',
  appId: '1:874739206290:web:fbe57b022e01ca483a7e4b',
  measurementId: 'G-DSR95P07NM',
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Fuerza persistencia local explícita: en algunos navegadores móviles (modo
// ahorro de datos, almacenamiento particionado, ciertos webviews) la
// persistencia por defecto no sobrevive a un refresco de página y obligaba a
// volver a iniciar sesión cada vez. Con esto la sesión se guarda en
// IndexedDB/localStorage y aguanta recargas y cierres del navegador.
setPersistence(auth, browserLocalPersistence).catch(() => {});

const MEMBERS_COLLECTION = 'members';
const SONGS_COLLECTION = 'songs';
const AVISOS_COLLECTION = 'avisos';
const ENSAYO_COLLECTION = 'ensayo';
const ORQUESTA_COLLECTION = 'orquesta';

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

// El administrador no puede escribir la contraseña de otra persona
// directamente (el SDK de cliente de Firebase no lo permite sin un servidor
// propio con clave de administrador). En su lugar le manda este correo con
// un enlace para que el propio componente elija una contraseña nueva.
export function resetMemberPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

// Cambio de contraseña por el propio usuario desde "Mi perfil": Firebase
// exige haber iniciado sesión "recientemente" para tocar la contraseña, así
// que primero se reautentica con la contraseña actual.
export async function changeOwnPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('no-user');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

// Crea la cuenta y, junto a ella, su ficha de socio en Firestore con
// role: "pendiente" — nadie puede auto-asignarse un rol distinto: las
// reglas de Firestore solo dejan crear la ficha propia con ese rol fijo.
export async function requestAccess({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, MEMBERS_COLLECTION, credential.user.uid), {
    name,
    email,
    role: 'pendiente',
    voices: [],
    approvedByDirector: false,
    approvedByAdmin: false,
    createdAt: serverTimestamp(),
  });
  return credential.user;
}

export async function getMember(uid) {
  const snap = await getDoc(doc(db, MEMBERS_COLLECTION, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Solo la puede llamar con éxito un director/administrador — lo hacen
// cumplir las reglas de Firestore, no este código.
export async function listMembers() {
  const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function setMemberFields(uid, fields) {
  return updateDoc(doc(db, MEMBERS_COLLECTION, uid), fields);
}

// Aprobar: con la firma de un director O del administrador ya basta — no
// hace falta esperar a la otra (antes se pedían las dos, pero eso dejaba a
// todo el mundo bloqueado en "pendiente" si aún no había ningún director
// nombrado, ya que nadie podía firmar la segunda).
export async function approveMember(member, approverRole) {
  const field = approverRole === 'director' ? 'approvedByDirector' : 'approvedByAdmin';
  await setMemberFields(member.id, { [field]: true, role: 'corista' });
}

export function rejectMember(uid) {
  return setMemberFields(uid, { role: 'rechazado' });
}

// Un componente puede llevar varias voces a la vez (p. ej. varias mujeres
// llevan tanto Tenor como Tenor contraalto). "voices" es el array real;
// "voice" (singular) se limpia a null para no dejar datos contradictorios,
// pero se sigue leyendo como fallback en fichas antiguas sin migrar — ver
// memberVoices() más abajo y su gemela en app.js.
export function assignVoices(uid, voices) {
  return setMemberFields(uid, { voices, voice: null });
}

function memberVoices(member) {
  if (Array.isArray(member.voices)) return member.voices;
  return member.voice ? [member.voice] : [];
}

export function renameMember(uid, name) {
  return setMemberFields(uid, { name });
}

export function promoteToDirector(uid) {
  return setMemberFields(uid, { role: 'director' });
}

export function setMemberRole(uid, role) {
  return setMemberFields(uid, { role });
}

export function deleteMember(uid) {
  return deleteDoc(doc(db, MEMBERS_COLLECTION, uid));
}

/* ══════════════════════════ Repertorio (letras y audios) ══════════════════════════ */
// Solo puede escribir aquí un director/administrador — lo hacen cumplir las
// reglas de Firestore y de Storage, no este código.

export async function listSongs() {
  const snap = await getDocs(collection(db, SONGS_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSong({ title, kind, letter }) {
  const docRef = await addDoc(collection(db, SONGS_COLLECTION), {
    title,
    kind,
    letter: letter || '',
    audios: [],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function updateSong(id, fields) {
  return updateDoc(doc(db, SONGS_COLLECTION, id), fields);
}

export async function deleteSong(song) {
  await Promise.all(
    (song.audios || []).map((a) => (a.path ? deleteObject(ref(storage, a.path)).catch(() => {}) : null))
  );
  await deleteDoc(doc(db, SONGS_COLLECTION, song.id));
}

// Sube el audio a Storage y actualiza la lista de audios de la canción,
// sustituyendo el que hubiera para ese mismo tipo de voz si ya existía.
export async function uploadSongAudio(song, type, file) {
  const path = `songs/${song.id}/${type}-${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const previous = (song.audios || []).find((a) => a.type === type);
  const audios = (song.audios || []).filter((a) => a.type !== type);
  audios.push({ type, url, path });
  await updateSong(song.id, { audios });

  if (previous?.path) {
    deleteObject(ref(storage, previous.path)).catch(() => {});
  }
  return audios;
}

/* ══════════════════════════ Novedades (notificaciones y avisos) ══════════════════════════ */
// Solo puede escribir aquí un director/administrador — lo hacen cumplir las
// reglas de Firestore. "notificacion" avisa de una letra nueva/actualizada
// (lleva al Repertorio al pulsarla); "aviso" es un mensaje urgente suelto.

export async function listAvisos() {
  const snap = await getDocs(query(collection(db, AVISOS_COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function createAviso({ type, title, body, authorName }) {
  return addDoc(collection(db, AVISOS_COLLECTION), {
    type,
    title,
    body: body || '',
    authorName: authorName || '',
    createdAt: serverTimestamp(),
  });
}

export function updateAviso(id, { title, body }) {
  return updateDoc(doc(db, AVISOS_COLLECTION, id), { title, body: body || '' });
}

export function deleteAviso(id) {
  return deleteDoc(doc(db, AVISOS_COLLECTION, id));
}

/* ══════════════════════════ Local del Ensayo (audios por voz) ══════════════════════════ */
// Cada documento es un audio de una pieza (presentacion, tango, cuple,
// estribillo, popurri) asignado a UNA voz. Los directores/admin lo ven todo;
// un corista solo recibe los de su voz (lo hacen cumplir las reglas de
// Firestore: la consulta ha de filtrar por su voz o Firestore la rechaza).

export async function listEnsayoAudios(member) {
  const col = collection(db, ENSAYO_COLLECTION);
  if (member.role === 'director' || member.role === 'admin') {
    const snap = await getDocs(col);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const voices = memberVoices(member).filter((v) => v !== 'Orquesta');
  if (!voices.length) return [];
  const snap = await getDocs(query(col, where('voice', 'in', voices)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function uploadEnsayoAudio({ piece, voice, title, number, file }) {
  const path = `ensayo/${piece}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return addDoc(collection(db, ENSAYO_COLLECTION), {
    piece,
    voice,
    title: title || '',
    number: number || null,
    url,
    path,
    createdAt: serverTimestamp(),
  });
}

export function updateEnsayoAudio(id, fields) {
  return updateDoc(doc(db, ENSAYO_COLLECTION, id), fields);
}

export async function deleteEnsayoAudio(item) {
  if (item.path) await deleteObject(ref(storage, item.path)).catch(() => {});
  await deleteDoc(doc(db, ENSAYO_COLLECTION, item.id));
}

/* ══════════════════════════ Orquesta (audios y vídeos) ══════════════════════════ */
// Solo director/admin y quien tenga la voz "Orquesta" pueden leer esta
// colección (lo hacen cumplir las reglas de Firestore).

export async function listOrquestaItems(member) {
  const isStaff = member.role === 'director' || member.role === 'admin';
  if (!isStaff && !memberVoices(member).includes('Orquesta')) return [];
  const snap = await getDocs(collection(db, ORQUESTA_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function uploadOrquestaItem({ piece, title, number, file }) {
  const path = `orquesta/${piece}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return addDoc(collection(db, ORQUESTA_COLLECTION), {
    piece,
    media: file.type.startsWith('video') ? 'video' : 'audio',
    title: title || '',
    number: number || null,
    url,
    path,
    createdAt: serverTimestamp(),
  });
}

export function updateOrquestaItem(id, fields) {
  return updateDoc(doc(db, ORQUESTA_COLLECTION, id), fields);
}

export async function deleteOrquestaItem(item) {
  if (item.path) await deleteObject(ref(storage, item.path)).catch(() => {});
  await deleteDoc(doc(db, ORQUESTA_COLLECTION, item.id));
}
