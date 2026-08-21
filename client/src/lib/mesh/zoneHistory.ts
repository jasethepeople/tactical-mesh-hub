import type { IncidentZone } from "./types";

const MAX_ZONE_HISTORY = 12;

export function cloneZones(zones: IncidentZone[]): IncidentZone[] {
  return zones.map(zone => ({ ...zone, coordinate: { ...zone.coordinate } }));
}

export function pushZoneHistory(history: IncidentZone[][], zones: IncidentZone[]): IncidentZone[][] {
  return [...history, cloneZones(zones)].slice(-MAX_ZONE_HISTORY);
}

export function takeZoneUndo(history: IncidentZone[][]): { history: IncidentZone[][]; snapshot: IncidentZone[] | null } {
  const next = [...history];
  const snapshot = next.pop() ?? null;
  return { history: next, snapshot: snapshot ? cloneZones(snapshot) : null };
}
