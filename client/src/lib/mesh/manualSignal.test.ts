import { describe, expect, it } from "vitest";
import { MeshRuntime, parseManualSignal } from "./runtime";

describe("manual device-pairing payloads", () => {
  const validOffer = {
    protocol: "TAC-MESH-SIGNAL/1",
    sessionId: "session-1",
    type: "offer",
    from: { nodeId: "ALPHA001", callsign: "ALPHA", status: "ONLINE", updatedAt: 1 },
    sdp: { type: "offer", sdp: "v=0\r\n" },
    createdAt: 1,
  };

  it("accepts a valid manual offer envelope", () => {
    expect(parseManualSignal(JSON.stringify(validOffer))).toMatchObject({
      protocol: "TAC-MESH-SIGNAL/1",
      type: "offer",
      from: { nodeId: "ALPHA001" },
    });
  });

  it("rejects a non-pairing payload before it reaches WebRTC", () => {
    expect(() => parseManualSignal(JSON.stringify({ protocol: "OTHER", type: "offer" }))).toThrow("Unsupported pairing payload");
  });

  it("keeps gathered host ICE candidates in the manual offer SDP", async () => {
    class StubConnection {
      iceGatheringState: RTCIceGatheringState = "complete";
      localDescription: RTCSessionDescription | null = null;
      onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;
      ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;
      createDataChannel() { return { close() {}, readyState: "connecting" } as RTCDataChannel; }
      async createOffer() { return { type: "offer" as RTCSdpType, sdp: "v=0\r\na=candidate:1 1 udp 1 192.168.1.10 5000 typ host\r\n" }; }
      async createAnswer() { return { type: "answer" as RTCSdpType, sdp: "v=0\r\na=candidate:2 1 udp 1 192.168.1.11 5001 typ host\r\n" }; }
      async setLocalDescription(description: RTCSessionDescriptionInit) { this.localDescription = { ...description, toJSON: () => description } as RTCSessionDescription; }
      async setRemoteDescription() {}
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }

    const original = globalThis.RTCPeerConnection;
    Object.defineProperty(globalThis, "RTCPeerConnection", { value: StubConnection, configurable: true });
    const runtime = new MeshRuntime({
      identity: validOffer.from,
      lowBandwidth: () => false,
      getSnapshotPackets: () => [],
      onPacket: () => undefined,
      onPeers: () => undefined,
    });
    const offer = parseManualSignal(await runtime.createManualOffer());
    expect(offer.sdp.sdp).toContain("a=candidate:");
    const response = await runtime.acceptManualSignal(JSON.stringify({
      ...validOffer,
      sessionId: "remote-offer-1",
      from: { nodeId: "BRAVO001", callsign: "BRAVO", status: "ONLINE", updatedAt: 1 },
    }));
    expect(response).not.toBeNull();
    expect(parseManualSignal(response as string).sdp.sdp).toContain("a=candidate:");
    Object.defineProperty(globalThis, "RTCPeerConnection", { value: original, configurable: true });
  });
});
