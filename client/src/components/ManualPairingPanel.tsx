import type { MeshRuntime } from "@/lib/mesh/runtime";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { Clipboard, FileScan, Link2, QrCode, RadioTower, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function ManualPairingPanel({ getRuntime }: { getRuntime: () => MeshRuntime | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [outbound, setOutbound] = useState("");
  const [inbound, setInbound] = useState("");
  const [mode, setMode] = useState<"OFFER" | "ANSWER" | null>(null);

  useEffect(() => {
    if (!outbound || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, outbound, { width: 190, margin: 1, errorCorrectionLevel: "M", color: { dark: "#ff8e25", light: "#101510" } });
  }, [outbound]);

  const createOffer = async () => {
    const runtime = getRuntime();
    if (!runtime) return toast.error("Mesh runtime is still initializing.");
    try {
      setOutbound(await runtime.createManualOffer());
      setMode("OFFER");
      toast.success("Offer generated. Scan its QR code or copy the payload to the remote operator.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manual offer generation failed.");
    }
  };

  const processInbound = async () => {
    const runtime = getRuntime();
    if (!runtime) return toast.error("Mesh runtime is still initializing.");
    try {
      const response = await runtime.acceptManualSignal(inbound.trim());
      setInbound("");
      if (response) {
        setOutbound(response);
        setMode("ANSWER");
        toast.success("Answer generated. Return this QR code or clipboard payload to the offering device.");
      } else {
        setOutbound("");
        setMode(null);
        toast.success("Answer accepted. Awaiting encrypted data-channel establishment.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pairing payload could not be accepted.");
    }
  };

  const copyOutbound = async () => {
    if (!outbound) return;
    try {
      await navigator.clipboard.writeText(outbound);
      toast.success("Pairing payload copied to the device clipboard.");
    } catch {
      toast.error("Clipboard access was denied. Select and copy the payload manually.");
    }
  };

  const decodeQrImage = (file: File | undefined) => {
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return toast.error("QR image could not be read.");
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
      URL.revokeObjectURL(image.src);
      if (!code?.data) return toast.error("No supported Tactical Mesh QR payload was detected in that image.");
      setInbound(code.data);
      toast.success("QR pairing payload decoded. Inspect or process it below.");
    };
    image.onerror = () => toast.error("QR image could not be loaded.");
    image.src = URL.createObjectURL(file);
  };

  return (
    <section className="tac-panel">
      <div className="tac-panel-heading"><div className="flex items-center gap-2"><span className="h-2 w-2 rotate-45 bg-orange-400" /><h2>MANUAL DEVICE PAIRING</h2></div><span className="tac-panel-label">QR / CLIPBOARD</span></div>
      <div className="space-y-3 p-3">
        <p className="text-[9px] leading-relaxed tracking-[.08em] text-slate-500">EXCHANGE A THREE-STEP OFFER / ANSWER PAYLOAD WHEN DEVICES CANNOT SHARE A LOCAL SIGNALING CHANNEL. NO PAYLOAD IS SENT TO A SERVER.</p>
        <button className="tac-button w-full justify-center" onClick={() => void createOffer()}><Link2 size={13} /> 1. GENERATE OFFER</button>
        {outbound ? <div className="border border-orange-400/20 bg-[#101510] p-2">
          <div className="flex items-center justify-between gap-2"><span className="text-[9px] tracking-[.12em] text-orange-200">{mode} PAYLOAD READY</span><button className="tac-square-button h-7 w-7" onClick={() => void copyOutbound()} aria-label="Copy pairing payload"><Clipboard size={13} /></button></div>
          <div className="mt-2 flex items-center justify-center border border-orange-400/10 bg-[#0d110d] py-2"><canvas ref={canvasRef} className="max-w-full" aria-label="Manual pairing QR code" /></div>
          <textarea className="tac-textarea mt-2 h-16" readOnly value={outbound} aria-label="Outgoing manual pairing payload" />
        </div> : null}
        <div className="border-t border-orange-400/15 pt-3">
          <label className="tac-field-label flex items-center gap-2"><RadioTower size={12} /> 2. PASTE OR SCAN REMOTE PAYLOAD</label>
          <textarea className="tac-textarea mt-2 h-20" value={inbound} onChange={event => setInbound(event.target.value)} placeholder="PASTE OFFER OR ANSWER JSON HERE" />
          <div className="mt-2 grid grid-cols-2 gap-2"><label className="tac-file-input justify-center"><ScanLine size={13} /><span>SCAN QR IMAGE</span><input type="file" accept="image/*" onChange={event => decodeQrImage(event.target.files?.[0])} /></label><button className="tac-toggle justify-center" onClick={() => void processInbound()}><QrCode size={13} /> 3. PROCESS</button></div>
        </div>
        <div className="flex items-start gap-2 border-l-2 border-orange-400/50 bg-orange-400/5 p-2 text-[8px] leading-relaxed tracking-[.07em] text-slate-400"><FileScan size={13} className="mt-0.5 shrink-0 text-orange-300" />INITIATOR: CREATE OFFER → REMOTE DEVICE PROCESSES → INITIATOR PROCESSES RETURNED ANSWER. EACH EXCHANGE BUNDLES GATHERED HOST ICE CANDIDATES IN ITS SDP; KEEP PAYLOADS PRIVATE UNTIL THE DATA CHANNEL IS ESTABLISHED.</div>
      </div>
    </section>
  );
}
