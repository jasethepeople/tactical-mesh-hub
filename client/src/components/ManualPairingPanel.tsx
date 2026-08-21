import type { MeshRuntime } from "@/lib/mesh/runtime";
import { decodeQrFrame, requestCameraStream, stopCameraStream } from "@/lib/mesh/qrScan";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { Camera, CameraOff, Clipboard, FileScan, Link2, QrCode, RadioTower, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function ManualPairingPanel({ getRuntime }: { getRuntime: () => MeshRuntime | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const [outbound, setOutbound] = useState("");
  const [inbound, setInbound] = useState("");
  const [mode, setMode] = useState<"OFFER" | "ANSWER" | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (!outbound || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, outbound, { width: 190, margin: 1, errorCorrectionLevel: "M", color: { dark: "#ff8e25", light: "#101510" } });
  }, [outbound]);

  const stopCamera = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const scanCameraFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      animationRef.current = requestAnimationFrame(scanCameraFrame);
      return;
    }
    const canvas = scanCanvasRef.current || document.createElement("canvas");
    scanCanvasRef.current = canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return stopCamera();
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const payload = decodeQrFrame(image, (data, width, height) => jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null);
    if (payload) {
      setInbound(payload);
      stopCamera();
      toast.success("Live camera decoded a Tactical Mesh pairing payload.");
      return;
    }
    animationRef.current = requestAnimationFrame(scanCameraFrame);
  }, [stopCamera]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return toast.error("Live camera scanning is unavailable in this browser context.");
    try {
      const stream = await requestCameraStream(navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices));
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      animationRef.current = requestAnimationFrame(scanCameraFrame);
    } catch {
      toast.error("Camera permission was denied or no camera is available. Use image scan or clipboard instead.");
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

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
        {outbound ? <div className="border border-orange-400/20 bg-[#101510] p-2"><div className="flex items-center justify-between gap-2"><span className="text-[9px] tracking-[.12em] text-orange-200">{mode} PAYLOAD READY</span><button className="tac-square-button h-7 w-7" onClick={() => void copyOutbound()} aria-label="Copy pairing payload"><Clipboard size={13} /></button></div><div className="mt-2 flex items-center justify-center border border-orange-400/10 bg-[#0d110d] py-2"><canvas ref={canvasRef} className="max-w-full" aria-label="Manual pairing QR code" /></div><textarea className="tac-textarea mt-2 h-16" readOnly value={outbound} aria-label="Outgoing manual pairing payload" /></div> : null}
        <div className="border-t border-orange-400/15 pt-3">
          <label className="tac-field-label flex items-center gap-2"><RadioTower size={12} /> 2. PASTE OR SCAN REMOTE PAYLOAD</label>
          <textarea className="tac-textarea mt-2 h-20" value={inbound} onChange={event => setInbound(event.target.value)} placeholder="PASTE OFFER OR ANSWER JSON HERE" />
          <div className="mt-2 grid grid-cols-3 gap-2"><button className="tac-toggle justify-center" onClick={() => void startCamera()} disabled={cameraActive}><Camera size={13} /> LIVE CAMERA</button><label className="tac-file-input justify-center"><ScanLine size={13} /><span>QR IMAGE</span><input type="file" accept="image/*" onChange={event => decodeQrImage(event.target.files?.[0])} /></label><button className="tac-toggle justify-center" onClick={() => void processInbound()}><QrCode size={13} /> 3. PROCESS</button></div>
          {cameraActive ? <div className="mt-2 overflow-hidden border border-emerald-400/35 bg-black"><video ref={videoRef} className="max-h-48 w-full object-cover" muted playsInline /><button className="tac-toggle m-2 w-[calc(100%-1rem)] justify-center" onClick={stopCamera}><CameraOff size={13} /> STOP CAMERA SCAN</button></div> : <video ref={videoRef} className="hidden" muted playsInline />}
        </div>
        <div className="flex items-start gap-2 border-l-2 border-orange-400/50 bg-orange-400/5 p-2 text-[8px] leading-relaxed tracking-[.07em] text-slate-400"><FileScan size={13} className="mt-0.5 shrink-0 text-orange-300" />INITIATOR: CREATE OFFER → REMOTE DEVICE PROCESSES → INITIATOR PROCESSES RETURNED ANSWER. EACH EXCHANGE BUNDLES GATHERED HOST ICE CANDIDATES IN ITS SDP; KEEP PAYLOADS PRIVATE UNTIL THE DATA CHANNEL IS ESTABLISHED.</div>
      </div>
    </section>
  );
}
