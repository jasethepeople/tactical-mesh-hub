import { describe, expect, it } from "vitest";
import { decryptMeshArchive, encryptMeshState, parseEncryptedArchive, rotateArchiveKey } from "./crypto";
import { createEmptyMeshState } from "./types";

describe("encrypted mesh export", () => {
  it("produces a password-protected AES-GCM archive envelope", async () => {
    const archive = await encryptMeshState(createEmptyMeshState(), "field-safe-key");
    expect(archive).toMatchObject({
      format: "TAC-MESH/1",
      encrypted: true,
      algorithm: "AES-GCM-256",
      kdf: "PBKDF2-SHA-256",
    });
    expect(archive.ciphertext).not.toContain("NODE-");
  });

  it("decrypts a validated archive and carries forward spatial state", async () => {
    const mesh = createEmptyMeshState();
    mesh.identity.callsign = "ECHO-7";
    mesh.zones = [{ id: "zone-1", label: "STAGING WEST", type: "STAGING", coordinate: { x: 22, y: 64 }, radius: 12, updatedAt: 1 }];
    const archive = await encryptMeshState(mesh, "field-safe-key");
    const restored = await decryptMeshArchive(parseEncryptedArchive(JSON.stringify(archive)), "field-safe-key");
    expect(restored.identity.callsign).toBe("ECHO-7");
    expect(restored.zones).toMatchObject([{ label: "STAGING WEST", coordinate: { x: 22, y: 64 } }]);
  });

  it("re-encrypts recovered state under a replacement passphrase", async () => {
    const archive = await encryptMeshState(createEmptyMeshState(), "original-key-01");
    const rotated = await rotateArchiveKey(archive, "original-key-01", "replacement-key-02");
    await expect(decryptMeshArchive(rotated, "original-key-01")).rejects.toThrow("Archive decryption failed");
    await expect(decryptMeshArchive(rotated, "replacement-key-02")).resolves.toMatchObject({ version: 1 });
  });
});
