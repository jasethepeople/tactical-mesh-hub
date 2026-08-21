import { describe, expect, it } from "vitest";
import { createPacket, decodePacket, encodePacket, estimatePacketBytes } from "./packet";

describe("mesh packet encoding", () => {
  it("round-trips an emergency packet through compact mode", () => {
    const packet = createPacket("message", "NODE-A", { id: "alert-1", body: "Bridge access denied", priority: "HIGH" });
    const decoded = decodePacket(encodePacket(packet, true));
    expect(decoded).toEqual(packet);
  });

  it("uses fewer bytes in compact mode", () => {
    const packet = createPacket("resource", "NODE-A", { id: "resource-1", label: "Water", quantity: 40, status: "AVAILABLE" });
    expect(estimatePacketBytes(packet, true)).toBeLessThan(estimatePacketBytes(packet, false));
  });
});
