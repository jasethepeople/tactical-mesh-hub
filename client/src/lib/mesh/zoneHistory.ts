import type { IncidentZone } from "./types";

const MAX_ZONE_HISTORY = 12;

export type ZoneHistoryState = {
  undo: IncidentZone[][];
  redo: IncidentZone[][];
};

export function cloneZones(zones: IncidentZone[]): IncidentZone[] {
  return zones.map(zone => ({ ...zone, coordinate: { ...zone.coordinate } }));
}

export function createZoneHistory(): ZoneHistoryState {
  return { undo: [], redo: [] };
}

export function pushZoneHistory(history: ZoneHistoryState, zones: IncidentZone[]): ZoneHistoryState {
  return { undo: [...history.undo, cloneZones(zones)].slice(-MAX_ZONE_HISTORY), redo: [] };
}

export function takeZoneUndo(history: ZoneHistoryState, current: IncidentZone[]): { history: ZoneHistoryState; snapshot: IncidentZone[] | null } {
  const snapshot = history.undo.at(-1) ?? null;
  if (!snapshot) return { history, snapshot: null };
  return {
    history: { undo: history.undo.slice(0, -1), redo: [...history.redo, cloneZones(current)].slice(-MAX_ZONE_HISTORY) },
    snapshot: cloneZones(snapshot),
  };
}

export function takeZoneRedo(history: ZoneHistoryState, current: IncidentZone[]): { history: ZoneHistoryState; snapshot: IncidentZone[] | null } {
  const snapshot = history.redo.at(-1) ?? null;
  if (!snapshot) return { history, snapshot: null };
  return {
    history: { undo: [...history.undo, cloneZones(current)].slice(-MAX_ZONE_HISTORY), redo: history.redo.slice(0, -1) },
    snapshot: cloneZones(snapshot),
  };
}
