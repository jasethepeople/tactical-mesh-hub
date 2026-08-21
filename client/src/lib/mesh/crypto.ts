import { normalizeMeshState, type MeshState } from "./types";

export type EncryptedMeshArchive = {
  format: "TAC-MESH/1";
  encrypted: true;
  algorithm: "AES-GCM-256";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  exportedAt: string;
  records: { messages: number; resources: number };
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isArchive(value: unknown): value is EncryptedMeshArchive {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EncryptedMeshArchive>;
  return candidate.format === "TAC-MESH/1"
    && candidate.encrypted === true
    && candidate.algorithm === "AES-GCM-256"
    && candidate.kdf === "PBKDF2-SHA-256"
    && typeof candidate.iterations === "number"
    && typeof candidate.salt === "string"
    && typeof candidate.iv === "string"
    && typeof candidate.ciphertext === "string";
}

async function deriveArchiveKey(passphrase: string, salt: Uint8Array, iterations: number, usages: KeyUsage[]): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function encryptMeshState(state: MeshState, passphrase: string): Promise<EncryptedMeshArchive> {
  if (passphrase.trim().length < 8) {
    throw new Error("Use an export passphrase of at least 8 characters.");
  }

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveArchiveKey(passphrase, salt, 180000, ["encrypt"]);
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), mesh: state });
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, encoder.encode(payload));

  return {
    format: "TAC-MESH/1",
    encrypted: true,
    algorithm: "AES-GCM-256",
    kdf: "PBKDF2-SHA-256",
    iterations: 180000,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
    exportedAt: new Date().toISOString(),
    records: { messages: state.messages.length, resources: state.resources.length },
  };
}

export function parseEncryptedArchive(raw: string): EncryptedMeshArchive {
  try {
    const parsed = JSON.parse(raw);
    if (!isArchive(parsed)) throw new Error("Unsupported archive envelope.");
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === "Unsupported archive envelope.") throw error;
    throw new Error("The selected file is not a valid Tactical Mesh encrypted archive.");
  }
}

export async function decryptMeshArchive(archive: EncryptedMeshArchive, passphrase: string): Promise<MeshState> {
  if (passphrase.trim().length < 8) throw new Error("Enter the archive passphrase to continue.");
  try {
    const salt = fromBase64(archive.salt);
    const iv = fromBase64(archive.iv);
    const ciphertext = fromBase64(archive.ciphertext);
    const key = await deriveArchiveKey(passphrase, salt, archive.iterations, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext));
    const payload = JSON.parse(new TextDecoder().decode(decrypted)) as { mesh?: Partial<MeshState> };
    if (!payload.mesh) throw new Error("Archive payload has no mesh state.");
    return normalizeMeshState(payload.mesh);
  } catch (error) {
    if (error instanceof Error && error.message === "Archive payload has no mesh state.") throw error;
    throw new Error("Archive decryption failed. Check the passphrase and archive integrity.");
  }
}

export async function rotateArchiveKey(archive: EncryptedMeshArchive, currentPassphrase: string, replacementPassphrase: string): Promise<EncryptedMeshArchive> {
  const mesh = await decryptMeshArchive(archive, currentPassphrase);
  return encryptMeshState(mesh, replacementPassphrase);
}
