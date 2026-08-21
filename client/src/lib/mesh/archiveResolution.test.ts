import { describe, expect, it } from "vitest";
import { createEmptyMeshState, inspectArchiveConflict, mergeArchiveState, type MeshState } from "./types";

function mesh(overrides: Partial<MeshState>): MeshState {
  return { ...createEmptyMeshState(), identity: { nodeId: "LOCAL001", callsign: "LOCAL", status: "ONLINE", updatedAt: 1 }, ...overrides };
}

describe("archive conflict resolution", () => {
  it("reports overlapping identifiers before import is committed", () => {
    const local = mesh({ messages: [{ id: "m-1", originNodeId: "LOCAL001", originCallsign: "LOCAL", priority: "HIGH", body: "old", createdAt: 1, receivedAt: 1, hopCount: 0, delivery: "QUEUED" }] });
    const imported = mesh({ messages: [{ id: "m-1", originNodeId: "REMOTE01", originCallsign: "REMOTE", priority: "CRITICAL", body: "new", createdAt: 2, receivedAt: 2, hopCount: 0, delivery: "RECEIVED" }], resources: [{ id: "r-1", originNodeId: "REMOTE01", category: "SUPPLIES", label: "WATER", quantity: 6, unit: "L", status: "AVAILABLE", updatedAt: 2 }] });

    expect(inspectArchiveConflict(local, imported)).toMatchObject({ overlappingMessages: 1, conflictingResources: 0, importedMessages: 1, importedResources: 1 });
  });

  it("merges by newest resource and zone while preserving local identity and transport settings", () => {
    const local = mesh({
      lowBandwidth: true,
      resources: [{ id: "r-1", originNodeId: "LOCAL001", category: "SUPPLIES", label: "WATER", quantity: 1, unit: "L", status: "LOW", updatedAt: 1 }],
      zones: [{ id: "z-1", label: "OLD STAGING", type: "STAGING", coordinate: { x: 10, y: 10 }, radius: 8, updatedAt: 1 }],
    });
    const imported = mesh({
      identity: { nodeId: "REMOTE01", callsign: "REMOTE", status: "MOBILE", updatedAt: 2 },
      resources: [{ id: "r-1", originNodeId: "REMOTE01", category: "SUPPLIES", label: "WATER", quantity: 8, unit: "L", status: "AVAILABLE", updatedAt: 2 }],
      zones: [{ id: "z-1", label: "NEW STAGING", type: "STAGING", coordinate: { x: 55, y: 42 }, radius: 12, updatedAt: 2 }],
    });

    const merged = mergeArchiveState(local, imported);
    expect(merged.identity).toMatchObject({ nodeId: "LOCAL001" });
    expect(merged.lowBandwidth).toBe(true);
    expect(merged.resources[0]).toMatchObject({ quantity: 8, status: "AVAILABLE" });
    expect(merged.zones[0]).toMatchObject({ label: "NEW STAGING", coordinate: { x: 55, y: 42 } });
  });
});
