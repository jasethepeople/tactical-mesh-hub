import { createEmptyMeshState, normalizeMeshState, type MeshState } from "./types";

const DATABASE_NAME = "tactical-mesh-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "mesh-state";
const STATE_KEY = "primary";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
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
