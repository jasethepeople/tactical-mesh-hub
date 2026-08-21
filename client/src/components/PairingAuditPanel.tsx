import type { PairingAuditTranscript } from "@/lib/mesh/types";
import { Download, FileSignature, ShieldCheck } from "lucide-react";

const eventLabel: Record<PairingAuditTranscript["event"], string> = {
  OFFER_CREATED: "OFFER CREATED",
  OFFER_ACCEPTED: "OFFER ACCEPTED",
  ANSWER_CREATED: "ANSWER CREATED",
  ANSWER_VERIFIED: "ANSWER VERIFIED",
};

export function PairingAuditPanel({ audits }: { audits: PairingAuditTranscript[] }) {
  const exportAudits = () => {
    const blob = new Blob([JSON.stringify({ format: "tac-mesh-pairing-audit/1", exportedAt: Date.now(), transcripts: audits }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tac-mesh-pairing-audit-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <section className="tac-panel">
    <div className="tac-panel-heading"><div className="flex items-center gap-2"><span className="h-2 w-2 rotate-45 bg-orange-400" /><h2>PAIRING AUDIT</h2></div><span className="tac-panel-label">SIGNED / LOCAL</span></div>
    <div className="p-3">
      <div className="flex items-center gap-2 border-l-2 border-emerald-400/50 bg-emerald-400/5 p-2 text-[8px] leading-relaxed tracking-[.07em] text-slate-400"><ShieldCheck size={13} className="shrink-0 text-emerald-300" />ECDSA P-256 SIGNATURES USE A NON-EXPORTABLE BROWSER-LOCAL KEY. EXPORT ONLY WHEN OPERATOR DIRECTS IT.</div>
      <div className="mt-2 max-h-32 overflow-auto border border-orange-400/15">{audits.length ? audits.slice(0, 20).map(audit => <div key={audit.id} className="border-b border-orange-400/10 px-2 py-2 last:border-0"><div className="flex items-center gap-2"><FileSignature size={11} className="text-orange-300" /><span className="flex-1 text-[9px] tracking-[.1em] text-slate-200">{eventLabel[audit.event]}</span><span className="text-[8px] text-emerald-300">SIGNED</span></div><p className="mt-1 truncate text-[8px] tracking-[.07em] text-slate-500">{audit.peer.callsign} // {audit.confirmationCode} // {new Date(audit.timestamp).toLocaleTimeString()}</p></div>) : <div className="px-3 py-5 text-center text-[8px] tracking-[.1em] text-slate-500">NO LOCAL PAIRING TRANSCRIPTS</div>}</div>
      <button className="tac-toggle mt-2 w-full justify-center" disabled={!audits.length} onClick={exportAudits}><Download size={12} /> EXPORT SIGNED AUDIT ({audits.length})</button>
    </div>
  </section>;
}
