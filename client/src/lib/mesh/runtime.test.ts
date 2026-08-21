import { afterEach, describe, expect, it, vi } from "vitest";
import { MeshRuntime } from "./runtime";
import type { MeshPacket, NodeIdentity, PeerSnapshot } from "./types";

class MockBroadcastChannel {
  static instances = new Set<MockBroadcastChannel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.add(this);
  }

  postMessage(data: unknown) {
    MockBroadcastChannel.instances.forEach(instance => {
      if (instance !== this && instance.name === this.name) instance.onmessage?.({ data } as MessageEvent);
    });
  }

  close() {
    MockBroadcastChannel.instances.delete(this);
  }
}

function identity(nodeId: string, callsign: string): NodeIdentity {
  return { nodeId, callsign, status: "ONLINE", updatedAt: 1 };
}

describe("simulated mesh runtime", () => {
  afterEach(() => {
    MockBroadcastChannel.instances.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("discovers a local peer and delivers a gossip packet through the serverless fallback", () => {
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    vi.stubGlobal("RTCPeerConnection", undefined);
    vi.stubGlobal("window", globalThis);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const alphaPeers: PeerSnapshot[][] = [];
    const bravoReceived: MeshPacket[] = [];
    const alpha = new MeshRuntime({
      identity: identity("ALPHA001", "ALPHA"),
      lowBandwidth: () => false,
      getSnapshotPackets: () => [],
      onPeers: peers => alphaPeers.push(peers),
      onPacket: () => undefined,
    });
    const bravo = new MeshRuntime({
      identity: identity("BRAVO001", "BRAVO"),
      lowBandwidth: () => false,
      getSnapshotPackets: () => [],
      onPeers: () => undefined,
      onPacket: packet => bravoReceived.push(packet),
    });

    alpha.start();
    bravo.start();
    alpha.publish("message", { id: "alert-1", body: "Evacuate sector 4" });

    expect(alphaPeers.at(-1)?.[0]).toMatchObject({ nodeId: "BRAVO001", connected: true, transport: "SIMULATED" });
    expect(bravoReceived).toHaveLength(1);
    expect(bravoReceived[0]).toMatchObject({ kind: "message", origin: "ALPHA001", hop: 0 });

    alpha.stop();
    bravo.stop();
  });
});
