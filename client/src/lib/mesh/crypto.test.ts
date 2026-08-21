import { describe, expect, it } from "vitest";
import { encryptMeshState } from "./crypto";
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
});

