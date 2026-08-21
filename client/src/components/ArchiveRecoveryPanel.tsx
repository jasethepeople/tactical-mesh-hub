import { decryptMeshArchive, parseEncryptedArchive, rotateArchiveKey, type EncryptedMeshArchive } from "@/lib/mesh/crypto";
import { buildArchiveDiff, createArchiveRecordSelection, inspectArchiveConflict, mergeArchiveState, mergeSelectedArchiveRecords, type ArchiveConflictSummary, type ArchiveDiffRecord, type ArchiveRecordSelection, type MeshState } from "@/lib/mesh/types";
import { CheckSquare, FileKey2, KeyRound, Replace, RotateCw, ShieldQuestion, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const diffTone: Record<ArchiveDiffRecord["status"], string> = { NEW: "text-emerald-300", CHANGED: "text-amber-200", UNCHANGED: "text-slate-500" };

export function ArchiveRecoveryPanel({ currentMesh, onImport }: { currentMesh: MeshState; onImport: (mesh: MeshState) => void }) {
  const [archive, setArchive] = useState<EncryptedMeshArchive | null>(null);
  const [archiveName, setArchiveName] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [replacementPassphrase, setReplacementPassphrase] = useState("");
  const [recovered, setRecovered] = useState<MeshState | null>(null);
  const [conflicts, setConflicts] = useState<ArchiveConflictSummary | null>(null);
  const [diffs, setDiffs] = useState<ArchiveDiffRecord[]>([]);
  const [selection, setSelection] = useState<ArchiveRecordSelection>({ messages: [], resources: [], zones: [] });

  const clearReview = () => { setRecovered(null); setConflicts(null); setDiffs([]); setSelection({ messages: [], resources: [], zones: [] }); };

  const loadArchive = async (file: File | undefined) => {
    if (!file) return;
    try {
      const loaded = parseEncryptedArchive(await file.text());
      setArchive(loaded);
      setArchiveName(file.name);
      clearReview();
      toast.success(`Archive staged: ${loaded.records.messages} alerts / ${loaded.records.resources} resources.`);
    } catch (error) {
      setArchive(null);
      setArchiveName("");
      clearReview();
      toast.error(error instanceof Error ? error.message : "Archive could not be read.");
    }
  };

  const reviewArchive = async () => {
    if (!archive) return toast.error("Select an encrypted archive first.");
    try {
      const next = await decryptMeshArchive(archive, importPassphrase);
      const nextDiffs = buildArchiveDiff(currentMesh, next);
      setRecovered(next);
      setConflicts(inspectArchiveConflict(currentMesh, next));
      setDiffs(nextDiffs);
      setSelection(createArchiveRecordSelection(nextDiffs));
      toast.success("Archive decrypted locally. Review record overlap before committing changes.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archive recovery failed.");
    }
  };

  const resolveImport = (resolution: "SELECTED" | "MERGE" | "REPLACE") => {
    if (!recovered) return;
    const next = resolution === "REPLACE"
      ? recovered
      : resolution === "SELECTED"
        ? mergeSelectedArchiveRecords(currentMesh, recovered, selection)
        : mergeArchiveState(currentMesh, recovered);
    onImport(next);
    clearReview();
    setImportPassphrase("");
    toast.success(resolution === "SELECTED" ? "Selected archive records merged with local state." : resolution === "MERGE" ? "All archive records merged using the newest duplicate records." : "Local mesh state replaced with the recovered archive.");
  };

  const isSelected = (diff: ArchiveDiffRecord) => (diff.category === "ALERT" ? selection.messages : diff.category === "RESOURCE" ? selection.resources : selection.zones).includes(diff.id);
  const toggleSelection = (diff: ArchiveDiffRecord) => {
    const key = diff.category === "ALERT" ? "messages" : diff.category === "RESOURCE" ? "resources" : "zones";
    setSelection(current => ({ ...current, [key]: current[key].includes(diff.id) ? current[key].filter(id => id !== diff.id) : [...current[key], diff.id] }));
  };
  const selectedCount = selection.messages.length + selection.resources.length + selection.zones.length;

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
          <div className="mt-2 max-h-36 overflow-auto border border-amber-300/15 bg-black/20">{diffs.map(diff => <label key={`${diff.category}-${diff.id}`} className="flex cursor-pointer items-center gap-1.5 border-b border-amber-300/10 px-2 py-1.5 last:border-0 text-[8px] tracking-[.06em]"><input className="accent-orange-400" type="checkbox" checked={isSelected(diff)} onChange={() => toggleSelection(diff)} /><span className="w-12 text-slate-500">{diff.category}</span><span className={`w-16 ${diffTone[diff.status]}`}>{diff.status}</span><span className="min-w-0 flex-1 truncate text-slate-200">{diff.label}</span></label>)}</div>
          <p className="mt-2 text-[8px] leading-relaxed tracking-[.06em] text-slate-400">SELECT INDIVIDUAL ARCHIVE RECORDS BEFORE MERGING. MERGE ALL KEEPS THIS NODE’S IDENTITY AND CONNECTION STATE, while REPLACE adopts the recovered archive in full.</p>
          <div className="mt-2 grid grid-cols-2 gap-2"><button className="tac-toggle justify-center" disabled={!selectedCount} onClick={() => resolveImport("SELECTED")}><CheckSquare size={12} /> APPLY {selectedCount}</button><button className="tac-toggle justify-center" onClick={() => resolveImport("MERGE")}><RotateCw size={12} /> MERGE ALL</button><button className="tac-button col-span-2 justify-center" onClick={() => resolveImport("REPLACE")}><Replace size={12} /> REPLACE ALL</button></div>
        </div> : null}
        <div className="mt-3 border-t border-orange-400/15 pt-3"><label className="tac-field-label flex items-center gap-2"><KeyRound size={12} /> REPLACEMENT PASSPHRASE</label><input className="tac-input mt-2" type="password" value={replacementPassphrase} onChange={event => setReplacementPassphrase(event.target.value)} placeholder="8+ CHARACTERS" /><button className="tac-toggle mt-2 w-full justify-center" onClick={() => void rotateKey()}><RotateCw size={13} /> ROTATE + DOWNLOAD</button></div>
      </div>
    </section>
  );
}
