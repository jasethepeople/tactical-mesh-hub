import type { MeshPacket, PacketKind } from "./types";

type CompactPacket = {
  v: 1;
  k: string;
  i: string;
  o: string;
  t: number;
  h: number;
  x: number;
  d: unknown;
};

const compactKinds: Record<PacketKind, string> = {
  message: "m",
  resource: "r",
  "sync-request": "s",
  ping: "p",
  pong: "q",
};

const expandedKinds: Record<string, PacketKind> = {
  m: "message",
  r: "resource",
  s: "sync-request",
  p: "ping",
  q: "pong",
};

export function createPacket(kind: PacketKind, origin: string, payload: unknown, maxHops = 6): MeshPacket {
  return {
    id: crypto.randomUUID(),
    kind,
    origin,
    createdAt: Date.now(),
    hop: 0,
    maxHops,
    payload,
  };
}

export function encodePacket(packet: MeshPacket, compact = false): string {
  if (!compact) return JSON.stringify(packet);
  const output: CompactPacket = {
    v: 1,
    k: compactKinds[packet.kind],
    i: packet.id,
    o: packet.origin,
    t: packet.createdAt,
    h: packet.hop,
    x: packet.maxHops,
    d: packet.payload,
  };
  return JSON.stringify(output);
}

export function decodePacket(raw: string): MeshPacket | null {
  try {
    const parsed = JSON.parse(raw) as MeshPacket | CompactPacket;
    if ("v" in parsed && parsed.v === 1) {
      const kind = expandedKinds[parsed.k];
      if (!kind || !parsed.i || !parsed.o) return null;
      return {
        id: parsed.i,
        kind,
        origin: parsed.o,
        createdAt: parsed.t,
        hop: parsed.h,
        maxHops: parsed.x,
        payload: parsed.d,
      };
    }
    const candidate = parsed as MeshPacket;
    if (!candidate.id || !candidate.kind || !candidate.origin) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function estimatePacketBytes(packet: MeshPacket, compact: boolean): number {
  return new TextEncoder().encode(encodePacket(packet, compact)).byteLength;
}
