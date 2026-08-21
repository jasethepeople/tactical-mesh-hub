import { describe, expect, it, vi } from "vitest";
import { decodeQrFrame, requestCameraStream, stopCameraStream } from "./qrScan";

describe("camera QR scan helpers", () => {
  it("requests the environment-facing video stream and surfaces permission failure", async () => {
    const denied = vi.fn().mockRejectedValue(new Error("Permission denied"));
    await expect(requestCameraStream(denied)).rejects.toThrow("Permission denied");
    expect(denied).toHaveBeenCalledWith({ video: { facingMode: { ideal: "environment" } }, audio: false });
  });

  it("stops every active camera track", () => {
    const first = { stop: vi.fn() };
    const second = { stop: vi.fn() };
    stopCameraStream({ getTracks: () => [first, second] } as unknown as MediaStream);
    expect(first.stop).toHaveBeenCalledOnce();
    expect(second.stop).toHaveBeenCalledOnce();
  });

  it("returns a decoded pairing payload from a scanned frame", () => {
    const payload = decodeQrFrame({ data: new Uint8ClampedArray([0, 1, 2, 3]), width: 1, height: 1 }, () => "TAC-MESH-SIGNAL/1");
    expect(payload).toBe("TAC-MESH-SIGNAL/1");
  });
});
