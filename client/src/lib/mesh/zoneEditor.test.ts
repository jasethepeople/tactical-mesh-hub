import { describe, expect, it } from "vitest";
import { coordinateFromPointer, createIncidentZone, selectZoneForEditing, updateIncidentZone } from "./zoneEditor";

describe("tactical zone editor", () => {
  it("converts pointer positions into clamped tactical grid coordinates", () => {
    expect(coordinateFromPointer(150, 50, { left: 50, top: 0, width: 100, height: 100 })).toEqual({ x: 100, y: 50 });
  });

  it("creates and updates a selected zone with bounded coordinates and radius", () => {
    const zone = createIncidentZone({ id: "z-1", label: "medical", type: "STAGING", coordinate: { x: 10, y: 20 }, radius: 7, now: 1 });
    const updated = updateIncidentZone(zone, { coordinate: { x: 125, y: -4 }, radius: 99 }, 2);
    expect(updated).toMatchObject({ id: "z-1", label: "MEDICAL", coordinate: { x: 100, y: 0 }, radius: 30, updatedAt: 2 });
  });

  it("populates editor state when an operator selects a map zone", () => {
    const zone = createIncidentZone({ id: "z-2", label: "search corridor", type: "SEARCH", coordinate: { x: 24, y: 63 }, radius: 10, now: 1 });
    expect(selectZoneForEditing(zone)).toEqual({ selectedId: "z-2", label: "SEARCH CORRIDOR", type: "SEARCH", x: "24", y: "63", radius: "10" });
  });
});
