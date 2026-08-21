import { createEmptyMeshState, normalizeMeshState, type MeshState } from "./types";

const DATABASE_NAME = "tactical-mesh-local";
const DATABASE_VERSION = 2;
const STORE_NAME = "mesh-state";
const STATE_KEY = "primary";
const AUDIT_KEY_STORE = "audit-signing-key";
const AUDIT_KEY_NAME = "primary";

export type LocalAuditKey = {
  privateKey: CryptoKey;
  publicKey: JsonWebKey;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains(AUDIT_KEY_STORE)) {
        request.result.createObjectStore(AUDIT_KEY_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function readMeshState(): Promise<MeshState> {
  const database = await openDatabase();
  try {
    const state = await new Promise<Partial<MeshState> | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as Partial<MeshState> | undefined);
    });
    return state ? normalizeMeshState(state) : createEmptyMeshState();
  } finally {
    database.close();
  }
}

export async function writeMeshState(state: MeshState): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ ...state, updatedAt: Date.now() }, STATE_KEY);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } finally {
    database.close();
  }
}

export async function getOrCreateLocalAuditKey(): Promise<LocalAuditKey> {
  const database = await openDatabase();
  try {
    const existing = await new Promise<LocalAuditKey | undefined>((resolve, reject) => {
      const request = database.transaction(AUDIT_KEY_STORE, "readonly").objectStore(AUDIT_KEY_STORE).get(AUDIT_KEY_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as LocalAuditKey | undefined);
    });
    if (existing?.privateKey && existing.publicKey) return existing;

    const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const record: LocalAuditKey = { privateKey: keyPair.privateKey, publicKey };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(AUDIT_KEY_STORE, "readwrite");
      transaction.objectStore(AUDIT_KEY_STORE).put(record, AUDIT_KEY_NAME);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
    return record;
  } finally {
    database.close();
  }
}
