import type { MeshState } from "./types";

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

export async function encryptMeshState(state: MeshState, passphrase: string): Promise<EncryptedMeshArchive> {
  if (passphrase.trim().length < 8) {
    throw new Error("Use an export passphrase of at least 8 characters.");
  }

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 180000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    mesh: state,
  });
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(payload));

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
