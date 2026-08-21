import { describe, expect, it } from "vitest";
import { createEmptyMeshState, mergePacketIntoState, normalizeMeshState } from "./types";

describe("mesh state normalization", () => {
  it("recovers a valid local state from incomplete persisted data", () => {
    const state = normalizeMeshState({ version: 1, identity: { nodeId: "NODE-1", callsign: "ECHO", status: "ONLINE", updatedAt: 1 } });
    expect(state.identity.callsign).toBe("ECHO");
    expect(state.messages).toEqual([]);
    expect(state.resources).toEqual([]);
  });

  it("adds a received alert exactly once", () => {
    const initial = createEmptyMeshState();
    const packet = { id: "packet-1", kind: "message" as const, origin: "REMOTE", createdAt: 1, hop: 2, maxHops: 6, payload: { id: "alert-1", originNodeId: "REMOTE", originCallsign: "FOX", priority: "HIGH" as const, body: "Need medical support", createdAt: 1, receivedAt: 1, hopCount: 0, delivery: "FORWARDED" as const } };
    const merged = mergePacketIntoState(initial, packet);
    expect(merged.messages).toHaveLength(1);
    expect(mergePacketIntoState(merged, packet).messages).toHaveLength(1);
  });
});
