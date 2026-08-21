export type OperationalStatus = "ONLINE" | "MOBILE" | "DEGRADED" | "SILENT";
export type AlertPriority = "CRITICAL" | "HIGH" | "ROUTINE";
export type ResourceCategory = "SUPPLIES" | "PERSONNEL" | "EQUIPMENT";
export type ResourceStatus = "AVAILABLE" | "ALLOCATED" | "LOW" | "UNAVAILABLE";
export type IncidentZoneType = "HAZARD" | "STAGING" | "SEARCH" | "RESTRICTED";

export type TacticalCoordinate = {
  x: number;
  y: number;
};

export type IncidentZone = {
  id: string;
  label: string;
  type: IncidentZoneType;
  coordinate: TacticalCoordinate;
  radius: number;
  updatedAt: number;
};

export type NodeIdentity = {
  nodeId: string;
  callsign: string;
  status: OperationalStatus;
  updatedAt: number;
};

export type EmergencyMessage = {
  id: string;
  originNodeId: string;
  originCallsign: string;
  priority: AlertPriority;
  body: string;
  createdAt: number;
  receivedAt: number;
  hopCount: number;
  delivery: "QUEUED" | "FORWARDED" | "RECEIVED";
};

export type ResourceEntry = {
  id: string;
  originNodeId: string;
  category: ResourceCategory;
  label: string;
  quantity: number;
  unit: string;
  status: ResourceStatus;
  coordinate?: TacticalCoordinate;
  updatedAt: number;
};

export type PeerSnapshot = {
  nodeId: string;
  callsign: string;
  status: OperationalStatus;
  connected: boolean;
  transport: "WEBRTC" | "SIMULATED" | "DISCOVERED";
  latencyMs: number | null;
  packetsSent: number;
  packetsDropped: number;
  packetLoss: number;
  lastSeen: number;
};

export type MeshState = {
  version: 1;
  identity: NodeIdentity;
  messages: EmergencyMessage[];
  resources: ResourceEntry[];
  zones: IncidentZone[];
  peerSnapshots: PeerSnapshot[];
  lowBandwidth: boolean;
  updatedAt: number;
};

export type PacketKind = "message" | "resource" | "sync-request" | "ping" | "pong";

export type MeshPacket = {
  id: string;
  kind: PacketKind;
  origin: string;
  createdAt: number;
  hop: number;
  maxHops: number;
  payload: unknown;
};

export type ArchiveConflictSummary = {
  overlappingMessages: number;
  conflictingResources: number;
  conflictingZones: number;
  importedMessages: number;
  importedResources: number;
  importedZones: number;
};

export const createIdentity = (): NodeIdentity => {
  const nodeId = crypto.randomUUID().slice(0, 8).toUpperCase();
  return {
    nodeId,
    callsign: `NODE-${nodeId.slice(0, 4)}`,
    status: "ONLINE",
    updatedAt: Date.now(),
  };
};

export const createEmptyMeshState = (): MeshState => ({
  version: 1,
  identity: createIdentity(),
  messages: [],
  resources: [],
  zones: [],
  peerSnapshots: [],
  lowBandwidth: false,
  updatedAt: Date.now(),
});

export function normalizeMeshState(value: Partial<MeshState> | null | undefined): MeshState {
  const fallback = createEmptyMeshState();
  if (!value || value.version !== 1 || !value.identity?.nodeId) return fallback;

  return {
    version: 1,
    identity: {
      nodeId: value.identity.nodeId,
      callsign: value.identity.callsign || fallback.identity.callsign,
      status: value.identity.status || "ONLINE",
      updatedAt: value.identity.updatedAt || Date.now(),
    },
    messages: Array.isArray(value.messages) ? value.messages : [],
    resources: Array.isArray(value.resources) ? value.resources : [],
    zones: Array.isArray(value.zones) ? value.zones : [],
    peerSnapshots: Array.isArray(value.peerSnapshots) ? value.peerSnapshots : [],
    lowBandwidth: Boolean(value.lowBandwidth),
    updatedAt: value.updatedAt || Date.now(),
  };
}

export function mergePacketIntoState(state: MeshState, packet: MeshPacket): MeshState {
  if (packet.kind === "message") {
    const message = packet.payload as EmergencyMessage;
    if (!message?.id || state.messages.some(item => item.id === message.id)) return state;
    return {
      ...state,
      messages: [{ ...message, receivedAt: Date.now(), hopCount: packet.hop, delivery: "RECEIVED" }, ...state.messages],
      updatedAt: Date.now(),
    };
  }

  if (packet.kind === "resource") {
    const resource = packet.payload as ResourceEntry;
    if (!resource?.id) return state;
    const existing = state.resources.findIndex(item => item.id === resource.id);
    const resources = [...state.resources];
    if (existing >= 0) resources[existing] = resource;
    else resources.unshift(resource);
    return { ...state, resources, updatedAt: Date.now() };
  }

  return state;
}

export function inspectArchiveConflict(local: MeshState, imported: MeshState): ArchiveConflictSummary {
  const countOverlap = <T extends { id: string }>(first: T[], second: T[]) => {
    const localIds = new Set(first.map(item => item.id));
    return second.filter(item => localIds.has(item.id)).length;
  };

  return {
    overlappingMessages: countOverlap(local.messages, imported.messages),
    conflictingResources: countOverlap(local.resources, imported.resources),
    conflictingZones: countOverlap(local.zones, imported.zones),
    importedMessages: imported.messages.length,
    importedResources: imported.resources.length,
    importedZones: imported.zones.length,
  };
}

function mergeByNewest<T extends { id: string }>(local: T[], imported: T[], getTimestamp: (item: T) => number): T[] {
  const byId = new Map(local.map(item => [item.id, item]));
  imported.forEach(item => {
    const existing = byId.get(item.id);
    if (!existing || getTimestamp(item) >= getTimestamp(existing)) byId.set(item.id, item);
  });
  return Array.from(byId.values()).sort((left, right) => getTimestamp(right) - getTimestamp(left));
}

export function mergeArchiveState(local: MeshState, imported: MeshState): MeshState {
  return {
    ...local,
    messages: mergeByNewest(local.messages, imported.messages, item => item.createdAt),
    resources: mergeByNewest(local.resources, imported.resources, item => item.updatedAt),
    zones: mergeByNewest(local.zones, imported.zones, item => item.updatedAt),
    updatedAt: Date.now(),
  };
}
