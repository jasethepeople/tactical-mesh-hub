import { indexedDB as fakeIndexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readMeshState, writeMeshState } from "./store";
import { createEmptyMeshState } from "./types";

function deleteTestDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase("tactical-mesh-local");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

describe("local mesh IndexedDB state", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", fakeIndexedDB);
    await deleteTestDatabase();
  });

  afterEach(async () => {
    await deleteTestDatabase();
    vi.unstubAllGlobals();
  });

  it("restores identity, alerts, resources, and peer snapshots after a simulated reload", async () => {
    const state = createEmptyMeshState();
    state.identity = { ...state.identity, nodeId: "ALPHA001", callsign: "ALPHA", status: "MOBILE", updatedAt: 100 };
    state.messages = [{ id: "alert-1", originNodeId: "ALPHA001", originCallsign: "ALPHA", priority: "HIGH", body: "Road access restricted", createdAt: 100, receivedAt: 101, hopCount: 1, delivery: "FORWARDED" }];
    state.resources = [{ id: "water-1", originNodeId: "ALPHA001", category: "SUPPLIES", label: "WATER", quantity: 48, unit: "L", status: "AVAILABLE", updatedAt: 102 }];
    state.peerSnapshots = [{ nodeId: "BRAVO001", callsign: "BRAVO", status: "ONLINE", connected: true, transport: "SIMULATED", latencyMs: 18, packetsSent: 4, packetsDropped: 0, packetLoss: 0, lastSeen: 103 }];

    await writeMeshState(state);
    const restored = await readMeshState();

    expect(restored.identity).toMatchObject({ nodeId: "ALPHA001", callsign: "ALPHA", status: "MOBILE" });
    expect(restored.messages).toHaveLength(1);
    expect(restored.resources).toHaveLength(1);
    expect(restored.peerSnapshots).toMatchObject([{ nodeId: "BRAVO001", latencyMs: 18, transport: "SIMULATED" }]);
  });
});
