import { describe, expect, it } from "vitest";
import { createZoneHistory, pushZoneHistory, takeZoneRedo, takeZoneUndo } from "./zoneHistory";
import type { IncidentZone } from "./types";

const zone: IncidentZone = { id: "zone-1", label: "STAGING", type: "STAGING", coordinate: { x: 50, y: 50 }, radius: 12, updatedAt: 1 };

describe("incident-zone history", () => {
  it("returns cloned prior snapshots and supports multi-step undo then redo", () => {
    let history = pushZoneHistory(createZoneHistory(), [zone]);
    zone.coordinate.x = 99;
    history = pushZoneHistory(history, [{ ...zone, coordinate: { x: 60, y: 50 } }]);
    const undo = takeZoneUndo(history, [{ ...zone, coordinate: { x: 80, y: 50 } }]);
    expect(undo.snapshot?.[0]?.coordinate.x).toBe(60);
    const redo = takeZoneRedo(undo.history, undo.snapshot ?? []);
    expect(redo.snapshot?.[0]?.coordinate.x).toBe(80);
    expect(redo.history.redo).toHaveLength(0);
  });
});
