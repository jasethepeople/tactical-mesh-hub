import { getOrCreateLocalAuditKey } from "./store";
import type { PairingAuditDraft, PairingAuditTranscript } from "./types";

const encoder = new TextEncoder();

function canonicalize(draft: PairingAuditDraft): string {
  return JSON.stringify({
    id: draft.id,
    sessionId: draft.sessionId,
    event: draft.event,
    actor: draft.actor,
    peer: draft.peer,
    confirmationCode: draft.confirmationCode,
    timestamp: draft.timestamp,
  });
}

function toBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) text += String.fromCharCode(bytes[index] ?? 0);
  return btoa(text);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

export async function signPairingAudit(draft: PairingAuditDraft): Promise<PairingAuditTranscript> {
  const key = await getOrCreateLocalAuditKey();
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, toArrayBuffer(encoder.encode(canonicalize(draft))));
  return { ...draft, algorithm: "ECDSA-P256-SHA256", signature: toBase64(signature), publicKey: key.publicKey };
}

export async function verifyPairingAudit(transcript: PairingAuditTranscript): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey("jwk", transcript.publicKey, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
  const { signature, algorithm: _algorithm, publicKey: _publicKey, ...draft } = transcript;
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, toArrayBuffer(fromBase64(signature)), toArrayBuffer(encoder.encode(canonicalize(draft))));
}
