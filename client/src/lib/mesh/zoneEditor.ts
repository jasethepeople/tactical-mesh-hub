import type { IncidentZone, IncidentZoneType, TacticalCoordinate } from "./types";

export type ZoneEditorSelection = { selectedId: string; label: string; type: IncidentZoneType; x: string; y: string; radius: string };

export function selectZoneForEditing(zone: IncidentZone): ZoneEditorSelection {
  return { selectedId: zone.id, label: zone.label, type: zone.type, x: String(zone.coordinate.x), y: String(zone.coordinate.y), radius: String(zone.radius) };
}

export function clampCoordinate(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
export function clampRadius(value: number): number { return Math.max(3, Math.min(30, Math.round(value))); }

export function coordinateFromPointer(clientX: number, clientY: number, bounds: Pick<DOMRect, "left" | "top" | "width" | "height">): TacticalCoordinate {
  return { x: clampCoordinate(((clientX - bounds.left) / bounds.width) * 100), y: clampCoordinate(((clientY - bounds.top) / bounds.height) * 100) };
}

export function createIncidentZone(input: { label: string; type: IncidentZoneType; coordinate: TacticalCoordinate; radius: number; id?: string; now?: number }): IncidentZone {
  return { id: input.id ?? crypto.randomUUID(), label: input.label.trim().toUpperCase() || `${input.type} ZONE`, type: input.type, coordinate: { x: clampCoordinate(input.coordinate.x), y: clampCoordinate(input.coordinate.y) }, radius: clampRadius(input.radius), updatedAt: input.now ?? Date.now() };
}

export function updateIncidentZone(zone: IncidentZone, patch: Partial<Pick<IncidentZone, "label" | "type" | "coordinate" | "radius">>, now = Date.now()): IncidentZone {
  return createIncidentZone({ id: zone.id, label: patch.label ?? zone.label, type: patch.type ?? zone.type, coordinate: patch.coordinate ?? zone.coordinate, radius: patch.radius ?? zone.radius, now });
}
