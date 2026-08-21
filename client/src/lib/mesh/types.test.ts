import { describe, expect, it } from "vitest";
import { buildArchiveDiff, createEmptyMeshState, mergePacketIntoState, mergeSelectedArchiveRecords, normalizeMeshState } from "./types";

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

  it("classifies imported records as new, changed, or unchanged for archive review", () => {
    const local = createEmptyMeshState();
    local.resources = [{ id: "water", originNodeId: "NODE", category: "SUPPLIES", label: "WATER", quantity: 10, unit: "L", status: "AVAILABLE", updatedAt: 1 }];
    const imported = { ...local, resources: [{ ...local.resources[0]!, quantity: 8, updatedAt: 2 }, { id: "med", originNodeId: "NODE", category: "SUPPLIES" as const, label: "MED KIT", quantity: 2, unit: "KITS", status: "AVAILABLE" as const, updatedAt: 2 }] };
    expect(buildArchiveDiff(local, imported).map(item => [item.id, item.status])).toEqual([["water", "CHANGED"], ["med", "NEW"]]);
  });

  it("merges only operator-selected archive records", () => {
    const local = createEmptyMeshState();
    local.resources = [{ id: "water", originNodeId: "NODE", category: "SUPPLIES", label: "WATER", quantity: 10, unit: "L", status: "AVAILABLE", updatedAt: 1 }];
    const imported = { ...local, resources: [{ ...local.resources[0]!, quantity: 8, updatedAt: 2 }, { id: "med", originNodeId: "NODE", category: "SUPPLIES" as const, label: "MED KIT", quantity: 2, unit: "KITS", status: "AVAILABLE" as const, updatedAt: 2 }] };
    const merged = mergeSelectedArchiveRecords(local, imported, { messages: [], resources: ["med"], zones: [] });
    expect(merged.resources.find(item => item.id === "water")?.quantity).toBe(10);
    expect(merged.resources.find(item => item.id === "med")?.quantity).toBe(2);
  });
});
