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

const MEMBERS_COLLECTION = 'members';
const SONGS_COLLECTION = 'songs';

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
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
    voice: null,
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

// Aprobar: marca la firma de quien aprueba: si con esta ya están las dos
// (director + administrador), el rol pasa de "pendiente" a "corista" en la
// misma escritura.
export async function approveMember(member, approverRole) {
  const field = approverRole === 'director' ? 'approvedByDirector' : 'approvedByAdmin';
  const otherField = approverRole === 'director' ? 'approvedByAdmin' : 'approvedByDirector';
  const bothApproved = member[otherField] === true;
  const fields = { [field]: true };
  if (bothApproved) fields.role = 'corista';
  await setMemberFields(member.id, fields);
}

export function rejectMember(uid) {
  return setMemberFields(uid, { role: 'rechazado' });
}

export function assignVoice(uid, voice) {
  return setMemberFields(uid, { voice });
}

export function promoteToDirector(uid) {
  return setMemberFields(uid, { role: 'director' });
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
