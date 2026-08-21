import { describe, expect, it } from "vitest";
import { createPairingConfirmationCode, MeshRuntime, parseManualSignal } from "./runtime";

describe("manual device-pairing payloads", () => {
  const validOffer = {
    protocol: "TAC-MESH-SIGNAL/1",
    sessionId: "session-1",
    type: "offer",
    from: { nodeId: "ALPHA001", callsign: "ALPHA", status: "ONLINE", updatedAt: 1 },
    confirmationCode: createPairingConfirmationCode("session-1", "ALPHA001"),
    sdp: { type: "offer", sdp: "v=0\r\n" },
    createdAt: 1,
  };

  it("accepts a valid manual offer envelope", () => {
    expect(parseManualSignal(JSON.stringify(validOffer))).toMatchObject({
      protocol: "TAC-MESH-SIGNAL/1",
      type: "offer",
      from: { nodeId: "ALPHA001" },
      confirmationCode: validOffer.confirmationCode,
    });
  });

  it("rejects a non-pairing payload before it reaches WebRTC", () => {
    expect(() => parseManualSignal(JSON.stringify({ protocol: "OTHER", type: "offer" }))).toThrow("Unsupported pairing payload");
  });

  it("creates a stable six-character operator confirmation code and rejects malformed codes", () => {
    expect(createPairingConfirmationCode("session-1", "ALPHA001")).toBe(validOffer.confirmationCode);
    expect(validOffer.confirmationCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(() => parseManualSignal(JSON.stringify({ ...validOffer, confirmationCode: "bad" }))).toThrow("Unsupported pairing payload");
  });

  it("keeps gathered host ICE candidates and confirmation codes in offer and answer payloads", async () => {
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
    const runtime = new MeshRuntime({ identity: validOffer.from, lowBandwidth: () => false, getSnapshotPackets: () => [], onPacket: () => undefined, onPeers: () => undefined });
    const offer = parseManualSignal(await runtime.createManualOffer());
    expect(offer.sdp.sdp).toContain("a=candidate:");
    expect(offer.confirmationCode).toBe(createPairingConfirmationCode(offer.sessionId, "ALPHA001"));
    const remoteOffer = { ...validOffer, sessionId: "remote-offer-1", from: { nodeId: "BRAVO001", callsign: "BRAVO", status: "ONLINE" as const, updatedAt: 1 }, confirmationCode: createPairingConfirmationCode("remote-offer-1", "BRAVO001") };
    const response = await runtime.acceptManualSignal(JSON.stringify(remoteOffer));
    const answer = parseManualSignal(response as string);
    expect(answer.sdp.sdp).toContain("a=candidate:");
    expect(answer.confirmationCode).toBe(remoteOffer.confirmationCode);
    Object.defineProperty(globalThis, "RTCPeerConnection", { value: original, configurable: true });
  });
});
