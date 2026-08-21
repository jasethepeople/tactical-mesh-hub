import { decryptMeshArchive, parseEncryptedArchive, rotateArchiveKey, type EncryptedMeshArchive } from "@/lib/mesh/crypto";
import type { MeshState } from "@/lib/mesh/types";
import { FileKey2, KeyRound, RotateCw, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ArchiveRecoveryPanel({ onImport }: { onImport: (mesh: MeshState) => void }) {
  const [archive, setArchive] = useState<EncryptedMeshArchive | null>(null);
  const [archiveName, setArchiveName] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [replacementPassphrase, setReplacementPassphrase] = useState("");

  const loadArchive = async (file: File | undefined) => {
    if (!file) return;
    try {
      const loaded = parseEncryptedArchive(await file.text());
      setArchive(loaded);
      setArchiveName(file.name);
      toast.success(`Archive staged: ${loaded.records.messages} alerts / ${loaded.records.resources} resources.`);
    } catch (error) {
      setArchive(null);
      setArchiveName("");
      toast.error(error instanceof Error ? error.message : "Archive could not be read.");
    }
  };

  const restoreArchive = async () => {
    if (!archive) return toast.error("Select an encrypted archive first.");
    try {
      const recovered = await decryptMeshArchive(archive, importPassphrase);
      onImport(recovered);
      setImportPassphrase("");
      toast.success("Archive recovered into this browser’s local mesh store.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archive recovery failed.");
    }
  };

  const rotateKey = async () => {
    if (!archive) return toast.error("Select an encrypted archive first.");
    try {
      const rotated = await rotateArchiveKey(archive, importPassphrase, replacementPassphrase);
      const blob = new Blob([JSON.stringify(rotated, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tac-mesh-rotated-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setReplacementPassphrase("");
      toast.success("Replacement-key archive downloaded. Retire the original archive securely.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Key rotation failed.");
    }
  };

  return (
    <section className="tac-panel">
      <div className="tac-panel-heading"><div className="flex items-center gap-2"><span className="h-2 w-2 rotate-45 bg-orange-400" /><h2>RECOVER / ROTATE</h2></div><span className="tac-panel-label">LOCAL FILE</span></div>
      <div className="space-y-2 p-3">
        <label className="tac-file-input"><Upload size={13} /><span>{archiveName || "SELECT ENCRYPTED ARCHIVE"}</span><input type="file" accept="application/json,.json" onChange={event => void loadArchive(event.target.files?.[0])} /></label>
        {archive ? <div className="border-l-2 border-emerald-400 bg-emerald-400/5 px-2 py-1.5 text-[9px] tracking-[.08em] text-emerald-200">VALIDATED // {archive.records.messages} ALERTS // {archive.records.resources} RESOURCES</div> : null}
        <label className="tac-field-label flex items-center gap-2"><FileKey2 size={12} /> CURRENT ARCHIVE PASSPHRASE</label>
        <input className="tac-input" type="password" value={importPassphrase} onChange={event => setImportPassphrase(event.target.value)} placeholder="NOT RETAINED" />
        <button className="tac-button w-full justify-center" onClick={() => void restoreArchive()}><Upload size={13} /> DECRYPT + RESTORE</button>
        <div className="mt-3 border-t border-orange-400/15 pt-3">
          <label className="tac-field-label flex items-center gap-2"><KeyRound size={12} /> REPLACEMENT PASSPHRASE</label>
          <input className="tac-input mt-2" type="password" value={replacementPassphrase} onChange={event => setReplacementPassphrase(event.target.value)} placeholder="8+ CHARACTERS" />
          <button className="tac-toggle mt-2 w-full justify-center" onClick={() => void rotateKey()}><RotateCw size={13} /> ROTATE + DOWNLOAD</button>
        </div>
      </div>
    </section>
  );
}
