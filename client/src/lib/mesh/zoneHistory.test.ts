import { describe, expect, it } from "vitest";
import { pushZoneHistory, takeZoneUndo } from "./zoneHistory";
import type { IncidentZone } from "./types";

const zone: IncidentZone = { id: "zone-1", label: "STAGING", type: "STAGING", coordinate: { x: 50, y: 50 }, radius: 12, updatedAt: 1 };

describe("incident-zone history", () => {
  it("returns the previous zone snapshot without retaining mutable coordinates", () => {
    const history = pushZoneHistory([], [zone]);
    zone.coordinate.x = 99;
    const undo = takeZoneUndo(history);
    expect(undo.snapshot?.[0]?.coordinate.x).toBe(50);
    expect(undo.history).toEqual([]);
  });
});
