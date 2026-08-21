export type OperationalStatus = "ONLINE" | "MOBILE" | "DEGRADED" | "SILENT";
export type AlertPriority = "CRITICAL" | "HIGH" | "ROUTINE";
export type ResourceCategory = "SUPPLIES" | "PERSONNEL" | "EQUIPMENT";
export type ResourceStatus = "AVAILABLE" | "ALLOCATED" | "LOW" | "UNAVAILABLE";

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
