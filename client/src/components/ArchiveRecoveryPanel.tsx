import { decryptMeshArchive, parseEncryptedArchive, rotateArchiveKey, type EncryptedMeshArchive } from "@/lib/mesh/crypto";
import { inspectArchiveConflict, mergeArchiveState, type ArchiveConflictSummary, type MeshState } from "@/lib/mesh/types";
import { FileKey2, KeyRound, Replace, RotateCw, ShieldQuestion, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ArchiveRecoveryPanel({ currentMesh, onImport }: { currentMesh: MeshState; onImport: (mesh: MeshState) => void }) {
  const [archive, setArchive] = useState<EncryptedMeshArchive | null>(null);
  const [archiveName, setArchiveName] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [replacementPassphrase, setReplacementPassphrase] = useState("");
  const [recovered, setRecovered] = useState<MeshState | null>(null);
  const [conflicts, setConflicts] = useState<ArchiveConflictSummary | null>(null);

  const loadArchive = async (file: File | undefined) => {
    if (!file) return;
    try {
      const loaded = parseEncryptedArchive(await file.text());
      setArchive(loaded);
      setArchiveName(file.name);
      setRecovered(null);
      setConflicts(null);
      toast.success(`Archive staged: ${loaded.records.messages} alerts / ${loaded.records.resources} resources.`);
    } catch (error) {
      setArchive(null);
      setArchiveName("");
      setRecovered(null);
      setConflicts(null);
      toast.error(error instanceof Error ? error.message : "Archive could not be read.");
    }
  };

  const reviewArchive = async () => {
    if (!archive) return toast.error("Select an encrypted archive first.");
    try {
      const next = await decryptMeshArchive(archive, importPassphrase);
      setRecovered(next);
      setConflicts(inspectArchiveConflict(currentMesh, next));
      toast.success("Archive decrypted locally. Review record overlap before committing changes.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archive recovery failed.");
    }
  };

  const resolveImport = (resolution: "MERGE" | "REPLACE") => {
    if (!recovered) return;
    onImport(resolution === "MERGE" ? mergeArchiveState(currentMesh, recovered) : recovered);
    setRecovered(null);
    setConflicts(null);
    setImportPassphrase("");
    toast.success(resolution === "MERGE" ? "Archive records merged using the newest duplicate records." : "Local mesh state replaced with the recovered archive.");
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
        <button className="tac-button w-full justify-center" onClick={() => void reviewArchive()}><ShieldQuestion size={13} /> DECRYPT + REVIEW</button>
        {recovered && conflicts ? <div className="border border-amber-300/30 bg-amber-300/5 p-2.5">
          <p className="text-[9px] tracking-[.13em] text-amber-100">LOCAL / ARCHIVE REVIEW</p>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[8px] tracking-[.08em]"><span className="bg-black/20 p-1 text-slate-400">ALERTS<br /><b className="text-amber-100">{conflicts.overlappingMessages}</b></span><span className="bg-black/20 p-1 text-slate-400">RESOURCES<br /><b className="text-amber-100">{conflicts.conflictingResources}</b></span><span className="bg-black/20 p-1 text-slate-400">ZONES<br /><b className="text-amber-100">{conflicts.conflictingZones}</b></span></div>
          <p className="mt-2 text-[8px] leading-relaxed tracking-[.06em] text-slate-400">MERGE KEEPS THIS NODE’S IDENTITY AND CONNECTION STATE, then selects the newest duplicate resource or zone. REPLACE adopts the recovered archive in full.</p>
          <div className="mt-2 grid grid-cols-2 gap-2"><button className="tac-toggle justify-center" onClick={() => resolveImport("MERGE")}><RotateCw size={12} /> MERGE</button><button className="tac-button justify-center" onClick={() => resolveImport("REPLACE")}><Replace size={12} /> REPLACE</button></div>
        </div> : null}
        <div className="mt-3 border-t border-orange-400/15 pt-3">
          <label className="tac-field-label flex items-center gap-2"><KeyRound size={12} /> REPLACEMENT PASSPHRASE</label>
          <input className="tac-input mt-2" type="password" value={replacementPassphrase} onChange={event => setReplacementPassphrase(event.target.value)} placeholder="8+ CHARACTERS" />
          <button className="tac-toggle mt-2 w-full justify-center" onClick={() => void rotateKey()}><RotateCw size={13} /> ROTATE + DOWNLOAD</button>
        </div>
      </div>
    </section>
  );
}
