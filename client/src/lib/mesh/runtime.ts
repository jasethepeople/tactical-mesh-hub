import { createPacket, decodePacket, encodePacket } from "./packet";
import type { MeshPacket, NodeIdentity, PeerSnapshot } from "./types";

type SignalingMessage =
  | { kind: "presence"; source: string; identity: NodeIdentity; sentAt: number }
  | { kind: "offer"; source: string; target: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; source: string; target: string; sdp: RTCSessionDescriptionInit }
  | { kind: "candidate"; source: string; target: string; candidate: RTCIceCandidateInit }
  | { kind: "simulated-packet"; source: string; payload: string };

type PeerRecord = PeerSnapshot & { channel?: RTCDataChannel; connection?: RTCPeerConnection; pendingPings: Map<string, number> };

type MeshRuntimeOptions = {
  identity: NodeIdentity;
  onPacket: (packet: MeshPacket) => void;
  onPeers: (peers: PeerSnapshot[]) => void;
  getSnapshotPackets: () => MeshPacket[];
  lowBandwidth: () => boolean;
};

const CHANNEL_NAME = "tactical-mesh-signal-v1";

export class MeshRuntime {
  private readonly options: MeshRuntimeOptions;
  private channel: BroadcastChannel | null = null;
  private identity: NodeIdentity;
  private peers = new Map<string, PeerRecord>();
  private seen = new Set<string>();
  private forwardQueue: MeshPacket[] = [];
  private timers: number[] = [];

  constructor(options: MeshRuntimeOptions) {
    this.options = options;
    this.identity = options.identity;
  }

  start(): void {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = event => this.handleSignal(event.data as SignalingMessage);
    this.announce();
    this.timers = [
      window.setInterval(() => this.announce(), 4500),
      window.setInterval(() => this.flushQueue(), 2200),
      window.setInterval(() => this.pingPeers(), 4000),
    ];
  }

  stop(): void {
    this.timers.forEach(timer => window.clearInterval(timer));
    this.timers = [];
    this.peers.forEach(peer => {
      peer.channel?.close();
      peer.connection?.close();
    });
    this.peers.clear();
    this.channel?.close();
    this.channel = null;
  }

  setIdentity(identity: NodeIdentity): void {
    this.identity = identity;
    this.announce();
  }

  publish(kind: "message" | "resource", payload: unknown): void {
    const packet = createPacket(kind, this.identity.nodeId, payload);
    this.seen.add(packet.id);
    this.forward(packet);
  }

  private announce(): void {
    this.channel?.postMessage({ kind: "presence", source: this.identity.nodeId, identity: this.identity, sentAt: Date.now() } satisfies SignalingMessage);
  }

  private touchPeer(nodeId: string, identity?: NodeIdentity): PeerRecord {
    const current = this.peers.get(nodeId);
    if (current) {
      if (identity) {
        current.callsign = identity.callsign;
        current.status = identity.status;
      }
      current.lastSeen = Date.now();
      return current;
    }
    const peer: PeerRecord = {
      nodeId,
      callsign: identity?.callsign || `NODE-${nodeId.slice(0, 4)}`,
      status: identity?.status || "ONLINE",
      connected: false,
      transport: typeof RTCPeerConnection === "undefined" ? "SIMULATED" : "DISCOVERED",
      latencyMs: null,
      packetsSent: 0,
      packetsDropped: 0,
      packetLoss: 0,
      lastSeen: Date.now(),
      pendingPings: new Map(),
    };
    this.peers.set(nodeId, peer);
    return peer;
  }

  private emitPeers(): void {
    this.options.onPeers(Array.from(this.peers.values()).map(({ pendingPings: _pending, channel: _channel, connection: _connection, ...peer }) => ({ ...peer })));
  }

  private handleSignal(signal: SignalingMessage): void {
    if (!signal || signal.source === this.identity.nodeId) return;

    if (signal.kind === "presence") {
      const isNewPeer = !this.peers.has(signal.source);
      const peer = this.touchPeer(signal.source, signal.identity);
      peer.lastSeen = signal.sentAt;
      this.emitPeers();
      if (isNewPeer) this.announce();
      if (typeof RTCPeerConnection === "undefined") {
        peer.connected = true;
        peer.transport = "SIMULATED";
        this.emitPeers();
        return;
      }
      if (!peer.connection && this.identity.nodeId.localeCompare(signal.source) < 0) {
        void this.createOffer(signal.source, signal.identity);
      }
      return;
    }

    if (signal.kind === "simulated-packet") {
      this.receivePacket(signal.source, signal.payload, true);
      return;
    }

    if ("target" in signal && signal.target !== this.identity.nodeId) return;
    if (signal.kind === "offer") {
      void this.acceptOffer(signal.source, signal.sdp);
    } else if (signal.kind === "answer") {
      const peer = this.peers.get(signal.source);
      if (peer?.connection) void peer.connection.setRemoteDescription(signal.sdp);
    } else if (signal.kind === "candidate") {
      const peer = this.peers.get(signal.source);
      if (peer?.connection) void peer.connection.addIceCandidate(signal.candidate).catch(() => undefined);
    }
  }

  private buildConnection(remoteId: string): RTCPeerConnection {
    const peer = this.touchPeer(remoteId);
    const connection = new RTCPeerConnection({ iceServers: [] });
    peer.connection = connection;
    connection.onicecandidate = event => {
      if (event.candidate) {
        this.channel?.postMessage({ kind: "candidate", source: this.identity.nodeId, target: remoteId, candidate: event.candidate.toJSON() } satisfies SignalingMessage);
      }
    };
    connection.onconnectionstatechange = () => {
      peer.connected = connection.connectionState === "connected";
      if (peer.connected) peer.transport = "WEBRTC";
      this.emitPeers();
    };
    connection.ondatachannel = event => this.bindDataChannel(remoteId, event.channel);
    return connection;
  }

  private async createOffer(remoteId: string, identity: NodeIdentity): Promise<void> {
    const peer = this.touchPeer(remoteId, identity);
    if (peer.connection) return;
    const connection = this.buildConnection(remoteId);
    this.bindDataChannel(remoteId, connection.createDataChannel("mesh-ops"));
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    this.channel?.postMessage({ kind: "offer", source: this.identity.nodeId, target: remoteId, sdp: offer } satisfies SignalingMessage);
  }

  private async acceptOffer(remoteId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.touchPeer(remoteId);
    if (peer.connection) return;
    const connection = this.buildConnection(remoteId);
    await connection.setRemoteDescription(offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    this.channel?.postMessage({ kind: "answer", source: this.identity.nodeId, target: remoteId, sdp: answer } satisfies SignalingMessage);
  }

  private bindDataChannel(remoteId: string, channel: RTCDataChannel): void {
    const peer = this.touchPeer(remoteId);
    peer.channel = channel;
    channel.onopen = () => {
      peer.connected = true;
      peer.transport = "WEBRTC";
      this.emitPeers();
      this.sendDirect(remoteId, createPacket("sync-request", this.identity.nodeId, {}));
      this.flushQueue();
    };
    channel.onclose = () => {
      peer.connected = false;
      this.emitPeers();
    };
    channel.onerror = () => {
      peer.connected = false;
      this.emitPeers();
    };
    channel.onmessage = event => this.receivePacket(remoteId, String(event.data), false);
  }

  private receivePacket(remoteId: string, raw: string, simulated: boolean): void {
    const packet = decodePacket(raw);
    if (!packet || packet.origin === this.identity.nodeId) return;
    const peer = this.touchPeer(remoteId);
    peer.lastSeen = Date.now();
    if (simulated) {
      peer.connected = true;
      peer.transport = "SIMULATED";
    }

    if (packet.kind === "ping") {
      this.sendDirect(remoteId, createPacket("pong", this.identity.nodeId, { nonce: packet.payload }));
      this.emitPeers();
      return;
    }
    if (packet.kind === "pong") {
      const nonce = (packet.payload as { nonce?: string })?.nonce;
      const sent = nonce ? peer.pendingPings.get(nonce) : undefined;
      if (sent) {
        peer.latencyMs = Math.max(1, Date.now() - sent);
        peer.pendingPings.delete(nonce as string);
      }
      this.emitPeers();
      return;
    }
    if (packet.kind === "sync-request") {
      this.options.getSnapshotPackets().forEach(snapshot => this.sendDirect(remoteId, snapshot));
      return;
    }
    if (this.seen.has(packet.id)) return;
    this.seen.add(packet.id);
    this.options.onPacket(packet);
    this.emitPeers();

    if (packet.hop < packet.maxHops) {
      this.forward({ ...packet, hop: packet.hop + 1 }, remoteId);
    }
  }

  private forward(packet: MeshPacket, exceptPeer?: string): void {
    const targets = Array.from(this.peers.values()).filter(peer => peer.nodeId !== exceptPeer && peer.connected);
    if (targets.length === 0) {
      if (!this.forwardQueue.some(item => item.id === packet.id)) this.forwardQueue.push(packet);
      return;
    }
    targets.forEach(peer => this.sendDirect(peer.nodeId, packet));
  }

  private sendDirect(remoteId: string, packet: MeshPacket): void {
    const peer = this.peers.get(remoteId);
    if (!peer) return;
    const dropRate = this.options.lowBandwidth() ? 0.11 : 0.035;
    const shouldSimulateDrop = packet.kind !== "sync-request" && Math.random() < dropRate;
    if (shouldSimulateDrop) {
      peer.packetsDropped += 1;
      peer.packetLoss = Number(((peer.packetsDropped / Math.max(1, peer.packetsSent + peer.packetsDropped)) * 100).toFixed(1));
      this.emitPeers();
      return;
    }
    const encoded = encodePacket(packet, this.options.lowBandwidth());
    if (peer.channel?.readyState === "open") {
      peer.channel.send(encoded);
      peer.packetsSent += 1;
      peer.packetLoss = Number(((peer.packetsDropped / Math.max(1, peer.packetsSent + peer.packetsDropped)) * 100).toFixed(1));
      this.emitPeers();
      return;
    }
    if (typeof RTCPeerConnection === "undefined") {
      this.channel?.postMessage({ kind: "simulated-packet", source: this.identity.nodeId, payload: encoded } satisfies SignalingMessage);
      peer.packetsSent += 1;
      this.emitPeers();
    }
  }

  private flushQueue(): void {
    if (!this.forwardQueue.length || !Array.from(this.peers.values()).some(peer => peer.connected)) return;
    const queued = [...this.forwardQueue];
    this.forwardQueue = [];
    queued.forEach(packet => this.forward(packet));
  }

  private pingPeers(): void {
    this.peers.forEach(peer => {
      if (!peer.connected) return;
      const nonce = crypto.randomUUID();
      peer.pendingPings.set(nonce, Date.now());
      this.sendDirect(peer.nodeId, createPacket("ping", this.identity.nodeId, { nonce }));
    });
  }
}
