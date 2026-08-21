import { encryptMeshState } from "@/lib/mesh/crypto";
import { ArchiveRecoveryPanel } from "@/components/ArchiveRecoveryPanel";
import { ManualPairingPanel } from "@/components/ManualPairingPanel";
import { TacticalSituationMap } from "@/components/TacticalSituationMap";
import { createPacket } from "@/lib/mesh/packet";
import { MeshRuntime } from "@/lib/mesh/runtime";
import { readMeshState, writeMeshState } from "@/lib/mesh/store";
import {
  mergePacketIntoState,
  type AlertPriority,
  type EmergencyMessage,
  type IncidentZone,
  type MeshState,
  type OperationalStatus,
  type PeerSnapshot,
  type ResourceCategory,
  type ResourceEntry,
  type ResourceStatus,
} from "@/lib/mesh/types";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Archive,
  Box,
  ChevronRight,
  CircleDot,
  Cpu,
  Download,
  Gauge,
  Globe2,
  LockKeyhole,
  Network,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Signal,
  UserRound,
  UsersRound,
  Wifi,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const priorityStyle: Record<AlertPriority, string> = {
  CRITICAL: "border-red-500/50 bg-red-500/10 text-red-300",
  HIGH: "border-orange-400/50 bg-orange-400/10 text-orange-200",
  ROUTINE: "border-sky-400/40 bg-sky-400/10 text-sky-200",
};

const resourceStyle: Record<ResourceStatus, string> = {
  AVAILABLE: "text-emerald-300",
  ALLOCATED: "text-orange-300",
  LOW: "text-amber-200",
  UNAVAILABLE: "text-red-300",
};

const statusStyle: Record<OperationalStatus, string> = {
  ONLINE: "bg-emerald-400",
  MOBILE: "bg-orange-400",
  DEGRADED: "bg-amber-300",
  SILENT: "bg-slate-500",
};

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds || 1}s AGO`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M AGO`;
  return `${Math.floor(seconds / 3600)}H AGO`;
}

function clampGrid(value: string): number {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function TacticalPanel({
  title,
  label,
  children,
  className = "",
}: {
  title: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`tac-panel ${className}`}>
      <div className="tac-panel-heading">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rotate-45 bg-orange-400 shrink-0" />
          <h2>{title}</h2>
        </div>
        {label ? <span className="tac-panel-label">{label}</span> : null}
      </div>
      {children}
    </section>
  );
}

function TopologyGraph({ identity, peers, lowBandwidth }: { identity: MeshState["identity"]; peers: PeerSnapshot[]; lowBandwidth: boolean }) {
  const nodes = useMemo(() => peers.slice(0, 6).map((peer, index) => {
    const angle = (-90 + index * (360 / Math.max(1, Math.min(peers.length, 6)))) * (Math.PI / 180);
    return { ...peer, x: 50 + Math.cos(angle) * 37, y: 50 + Math.sin(angle) * 34 };
  }), [peers]);

  return (
    <div className="relative min-h-[260px] overflow-hidden border border-orange-400/15 bg-[#111411]/70">
      <svg viewBox="0 0 100 100" role="img" aria-label="Active peer network topology" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="microgrid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,142,37,.11)" strokeWidth="0.22" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#microgrid)" />
        {[20, 35, 50, 65, 80].map(point => <line key={`v-${point}`} x1={point} x2={point} y1="0" y2="100" stroke="rgba(255,142,37,.09)" strokeWidth="0.15" />)}
        {[20, 35, 50, 65, 80].map(point => <line key={`h-${point}`} y1={point} y2={point} x1="0" x2="100" stroke="rgba(255,142,37,.09)" strokeWidth="0.15" />)}
        {nodes.map(peer => (
          <g key={`link-${peer.nodeId}`}>
            <line x1="50" y1="50" x2={peer.x} y2={peer.y} stroke={peer.connected ? "#ff8e25" : "#59615a"} strokeDasharray={peer.connected ? "0" : "2 2"} strokeWidth="0.62" opacity={peer.connected ? 0.9 : 0.42} />
            {peer.connected && <circle cx={(50 + peer.x) / 2} cy={(50 + peer.y) / 2} r="0.85" fill={lowBandwidth ? "#f1bf5a" : "#ff8e25"} />}
          </g>
        ))}
        <g>
          <circle cx="50" cy="50" r="7.2" fill="#151b17" stroke="#ff8e25" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="3.2" fill="#ff8e25" opacity="0.95" />
          <circle cx="50" cy="50" r="10.5" fill="none" stroke="rgba(255,142,37,.32)" strokeWidth="0.32" strokeDasharray="1 1.5" />
          <text x="50" y="64" textAnchor="middle" fill="#ffd5a5" fontSize="3.2" fontFamily="monospace">{identity.callsign}</text>
        </g>
        {nodes.map(peer => (
          <g key={peer.nodeId}>
            <circle cx={peer.x} cy={peer.y} r="5.2" fill="#121713" stroke={peer.connected ? "#f6b45e" : "#7b837d"} strokeWidth="0.55" />
            <circle cx={peer.x} cy={peer.y} r="1.7" fill={peer.connected ? "#ff8e25" : "#717a73"} />
            <text x={peer.x} y={peer.y + 9} textAnchor="middle" fill="#d0d6d1" fontSize="3.1" fontFamily="monospace">{peer.callsign.slice(0, 9)}</text>
          </g>
        ))}
      </svg>
      <div className="absolute left-3 top-3 flex gap-2">
        <span className="tac-chip"><span className="h-1.5 w-1.5 bg-orange-400 rounded-full" /> LIVE MESH</span>
        {lowBandwidth ? <span className="tac-chip text-amber-200">LOW-BW / COMPACT</span> : null}
      </div>
      <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.16em] text-slate-400">
        {nodes.length ? `${nodes.filter(node => node.connected).length}/${nodes.length} DIRECT LINKS` : "AWAITING PEER ADVERTISEMENTS"}
      </div>
    </div>
  );
}

export default function Home() {
  const [mesh, setMesh] = useState<MeshState | null>(null);
  const meshRef = useRef<MeshState | null>(null);
  const runtimeRef = useRef<MeshRuntime | null>(null);
  const peerBuffer = useRef<PeerSnapshot[]>([]);
  const [peers, setPeers] = useState<PeerSnapshot[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const [exportKey, setExportKey] = useState("");
  const [alertBody, setAlertBody] = useState("");
  const [alertPriority, setAlertPriority] = useState<AlertPriority>("HIGH");
  const [resourceLabel, setResourceLabel] = useState("");
  const [resourceQuantity, setResourceQuantity] = useState("1");
  const [resourceUnit, setResourceUnit] = useState("UNITS");
  const [resourceCategory, setResourceCategory] = useState<ResourceCategory>("SUPPLIES");
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus>("AVAILABLE");
  const [resourceX, setResourceX] = useState("50");
  const [resourceY, setResourceY] = useState("50");

  const updateMesh = useCallback((updater: (current: MeshState) => MeshState) => {
    setMesh(current => {
      if (!current) return current;
      const next = updater(current);
      meshRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    void readMeshState()
      .then(state => {
        if (!active) return;
        meshRef.current = state;
        setMesh(state);
      })
      .catch(() => {
        toast.error("Local state store could not be opened. Use a supported browser context.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!mesh) return;
    void writeMeshState(mesh).catch(() => toast.error("Mesh state could not be saved locally."));
  }, [mesh]);

  useEffect(() => {
    if (!mesh) return;
    const runtime = new MeshRuntime({
      identity: mesh.identity,
      lowBandwidth: () => Boolean(meshRef.current?.lowBandwidth),
      getSnapshotPackets: () => {
        const snapshot = meshRef.current;
        if (!snapshot) return [];
        return [
          ...snapshot.messages.slice(0, 50).map(message => createPacket("message", snapshot.identity.nodeId, message)),
          ...snapshot.resources.slice(0, 50).map(resource => createPacket("resource", snapshot.identity.nodeId, resource)),
        ];
      },
      onPeers: nextPeers => { peerBuffer.current = nextPeers; },
      onPacket: packet => updateMesh(current => mergePacketIntoState(current, packet)),
    });
    runtimeRef.current = runtime;
    runtime.start();
    return () => {
      runtime.stop();
      runtimeRef.current = null;
    };
  }, [mesh?.identity.nodeId, updateMesh]);

  useEffect(() => {
    if (!mesh) return;
    const cadence = mesh.lowBandwidth ? 5000 : 900;
    const tick = window.setInterval(() => {
      const nextPeers = [...peerBuffer.current];
      setPeers(nextPeers);
      updateMesh(current => ({
        ...current,
        peerSnapshots: nextPeers,
        messages: nextPeers.some(peer => peer.connected)
          ? current.messages.map(message => message.delivery === "QUEUED" ? { ...message, delivery: "FORWARDED" } : message)
          : current.messages,
        updatedAt: Date.now(),
      }));
      setClock(new Date());
    }, cadence);
    return () => window.clearInterval(tick);
  }, [mesh?.lowBandwidth, updateMesh]);

  const connectedPeers = peers.filter(peer => peer.connected);
  const averageLatency = connectedPeers.length
    ? Math.round(connectedPeers.reduce((sum, peer) => sum + (peer.latencyMs || 0), 0) / connectedPeers.length)
    : null;
  const packetLoss = peers.length
    ? (peers.reduce((sum, peer) => sum + peer.packetLoss, 0) / peers.length).toFixed(1)
    : "0.0";

  const sendAlert = () => {
    if (!mesh || !alertBody.trim()) return toast.error("Enter an emergency broadcast message first.");
    const message: EmergencyMessage = {
      id: crypto.randomUUID(),
      originNodeId: mesh.identity.nodeId,
      originCallsign: mesh.identity.callsign,
      priority: alertPriority,
      body: alertBody.trim(),
      createdAt: Date.now(),
      receivedAt: Date.now(),
      hopCount: 0,
      delivery: connectedPeers.length ? "FORWARDED" : "QUEUED",
    };
    updateMesh(current => ({ ...current, messages: [message, ...current.messages], updatedAt: Date.now() }));
    runtimeRef.current?.publish("message", message);
    setAlertBody("");
    toast.success(`Broadcast queued across ${connectedPeers.length} direct link${connectedPeers.length === 1 ? "" : "s"}.`);
  };

  const addResource = () => {
    if (!mesh || !resourceLabel.trim() || Number(resourceQuantity) <= 0) {
      return toast.error("Provide a resource label and positive quantity.");
    }
    const resource: ResourceEntry = {
      id: crypto.randomUUID(),
      originNodeId: mesh.identity.nodeId,
      category: resourceCategory,
      label: resourceLabel.trim().toUpperCase(),
      quantity: Number(resourceQuantity),
      unit: resourceUnit.trim().toUpperCase() || "UNITS",
      status: resourceStatus,
      coordinate: { x: clampGrid(resourceX), y: clampGrid(resourceY) },
      updatedAt: Date.now(),
    };
    updateMesh(current => ({ ...current, resources: [resource, ...current.resources.filter(item => item.id !== resource.id)], updatedAt: Date.now() }));
    runtimeRef.current?.publish("resource", resource);
    setResourceLabel("");
    setResourceQuantity("1");
    setResourceX("50");
    setResourceY("50");
    toast.success("Resource update queued for mesh propagation.");
  };

  const updateIdentity = (patch: Partial<MeshState["identity"]>) => {
    updateMesh(current => {
      const identity = { ...current.identity, ...patch, updatedAt: Date.now() };
      runtimeRef.current?.setIdentity(identity);
      return { ...current, identity, updatedAt: Date.now() };
    });
  };

  const exportArchive = async () => {
    if (!mesh) return;
    try {
      const archive = await encryptMeshState(mesh, exportKey);
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tac-mesh-${mesh.identity.nodeId.toLowerCase()}-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportKey("");
      toast.success("Encrypted state archive exported. Store its passphrase separately.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Encrypted export failed.");
    }
  };

  if (!mesh) {
    return <div className="tac-grid min-h-screen grid place-items-center"><div className="tac-loader"><Radio className="animate-pulse" /> INITIALIZING LOCAL MESH STORE…</div></div>;
  }

  return (
    <div className="tac-grid min-h-screen text-[#e7eee7] selection:bg-orange-400 selection:text-[#101310]">
      <header className="tac-header sticky top-0 z-30">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center border border-orange-400 bg-orange-400 text-[#121512] shadow-[0_0_22px_rgba(255,142,37,.22)]"><Radio size={22} strokeWidth={2.5} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="tac-kicker">EMERGENCY MESH COORDINATION</span><span className="hidden sm:inline tac-slash">//</span><span className="hidden sm:inline text-[10px] tracking-[.15em] text-orange-200">LOCAL-FIRST / NO UPLINK REQUIRED</span></div>
            <h1>TACTICAL MESH <span className="text-orange-400">HUB</span></h1>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-5 text-[10px] tracking-[.13em] text-slate-400">
          <span><span className="text-slate-500">UTC</span> {pad(clock.getUTCHours())}:{pad(clock.getUTCMinutes())}:{pad(clock.getUTCSeconds())}Z</span>
          <span><span className="text-slate-500">NODE</span> <span className="text-orange-200">{mesh.identity.nodeId}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button className={`tac-toggle ${mesh.lowBandwidth ? "active" : ""}`} onClick={() => updateMesh(current => ({ ...current, lowBandwidth: !current.lowBandwidth, updatedAt: Date.now() }))} aria-pressed={mesh.lowBandwidth}>
            <Zap size={13} /><span className="hidden sm:inline">LOW-BW</span><span className="sm:hidden">BW</span>
          </button>
          <button className="tac-square-button" onClick={() => setPeers([...peerBuffer.current])} aria-label="Refresh local display"><RefreshCw size={16} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-3 sm:p-5">
        <div className="grid gap-3 xl:grid-cols-[245px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <TacticalPanel title="NODE IDENTITY" label="LOCAL">
              <div className="p-3 space-y-3">
                <label className="tac-field-label">CALLSIGN</label>
                <div className="relative"><UserRound size={14} className="absolute left-3 top-3 text-orange-400" /><input className="tac-input pl-9" value={mesh.identity.callsign} maxLength={16} onChange={event => updateIdentity({ callsign: event.target.value.toUpperCase() })} /></div>
                <label className="tac-field-label">NODE IDENTIFIER</label>
                <div className="tac-readout">{mesh.identity.nodeId}</div>
                <label className="tac-field-label">OPERATIONAL STATUS</label>
                <div className="relative">
                  <span className={`absolute left-3 top-3 h-2 w-2 rounded-full ${statusStyle[mesh.identity.status]}`} />
                  <select className="tac-select pl-8" value={mesh.identity.status} onChange={event => updateIdentity({ status: event.target.value as OperationalStatus })}>
                    <option value="ONLINE">ONLINE / ACTIVE</option><option value="MOBILE">MOBILE / TRANSIT</option><option value="DEGRADED">DEGRADED / LIMITED</option><option value="SILENT">SILENT / LISTEN ONLY</option>
                  </select>
                </div>
              </div>
            </TacticalPanel>

            <TacticalPanel title="MESH STATUS" label="LINK">
              <div className="divide-y divide-orange-400/10 p-3">
                <MetricRow icon={<Network size={14} />} label="DIRECT PEERS" value={`${connectedPeers.length}/${peers.length}`} accent />
                <MetricRow icon={<Gauge size={14} />} label="AVG LATENCY" value={averageLatency === null ? "—" : `${averageLatency} MS`} />
                <MetricRow icon={<Activity size={14} />} label="PACKET LOSS" value={`${packetLoss}%`} warn={Number(packetLoss) > 5} />
                <MetricRow icon={<Cpu size={14} />} label="TRANSPORT" value={typeof RTCPeerConnection === "undefined" ? "SIMULATED" : "WEBRTC"} />
              </div>
              <div className="border-t border-orange-400/15 px-3 py-2 text-[9px] leading-relaxed tracking-[.11em] text-slate-500">BROWSER-TAB SIGNALING. NO REMOTE SERVER OR CLOUD STATE.</div>
            </TacticalPanel>

            <TacticalPanel title="EXPORT ARCHIVE" label="AES-256">
              <div className="p-3 space-y-2">
                <label className="tac-field-label flex items-center gap-2"><LockKeyhole size={12} /> PASSPHRASE (8+ CHARS)</label>
                <input className="tac-input" type="password" value={exportKey} onChange={event => setExportKey(event.target.value)} placeholder="NOT STORED" />
                <button className="tac-button w-full justify-center" onClick={exportArchive}><Download size={14} /> EXPORT ENCRYPTED JSON</button>
              </div>
            </TacticalPanel>
            <ArchiveRecoveryPanel currentMesh={mesh} onImport={recovered => {
              meshRef.current = recovered;
              setMesh(recovered);
            }} />
            <ManualPairingPanel getRuntime={() => runtimeRef.current} />
          </aside>

          <div className="space-y-3 min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatStrip label="NETWORK CONDITION" value={connectedPeers.length ? "OPERATIONAL" : "STANDBY"} icon={<Signal />} tone={connectedPeers.length ? "good" : "idle"} />
              <StatStrip label="GOSSIP QUEUE" value={`${mesh.messages.filter(message => message.delivery === "QUEUED").length} PENDING`} icon={<Globe2 />} tone="orange" />
              <StatStrip label="BROADCAST LOG" value={`${mesh.messages.length} ALERTS`} icon={<AlertTriangle />} tone="orange" />
              <StatStrip label="LOGISTICS BOARD" value={`${mesh.resources.length} RECORDS`} icon={<Box />} tone="orange" />
            </div>

            <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.8fr)]">
              <TacticalPanel title="LIVE TOPOLOGY / ROUTING MAP" label={mesh.lowBandwidth ? "REFRESH / 5.0S" : "REFRESH / 0.9S"}>
                <TopologyGraph identity={mesh.identity} peers={peers} lowBandwidth={mesh.lowBandwidth} />
                <div className="grid grid-cols-2 divide-x divide-orange-400/10 border-t border-orange-400/15 sm:grid-cols-4">
                  <TelemetryCell label="ROUTING" value="STORE + FWD" /><TelemetryCell label="PAYLOAD" value={mesh.lowBandwidth ? "COMPACT" : "STANDARD"} /><TelemetryCell label="HOP LIMIT" value="06" /><TelemetryCell label="NODE MODE" value={mesh.identity.status} />
                </div>
              </TacticalPanel>

              <TacticalPanel title="LINK TELEMETRY" label={`${peers.length} SEEN`}>
                <div className="max-h-[351px] overflow-auto">
                  {peers.length ? peers.map(peer => <PeerRow key={peer.nodeId} peer={peer} />) : <EmptyState icon={<Wifi size={25} />} text="No adjacent nodes detected. Open this app in another same-origin browser tab to establish a local mesh link." />}
                </div>
              </TacticalPanel>
            </div>

            <TacticalSituationMap
              resources={mesh.resources}
              zones={mesh.zones}
              onAddZone={(zone: IncidentZone) => updateMesh(current => ({ ...current, zones: [zone, ...current.zones], updatedAt: Date.now() }))}
              onUpdateZone={(zone: IncidentZone) => updateMesh(current => ({ ...current, zones: current.zones.map(item => item.id === zone.id ? zone : item), updatedAt: Date.now() }))}
              onRemoveZone={zoneId => updateMesh(current => ({ ...current, zones: current.zones.filter(zone => zone.id !== zoneId), updatedAt: Date.now() }))}
            />

            <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.2fr)_minmax(370px,.8fr)]">
              <TacticalPanel title="EMERGENCY BROADCAST" label="GOSSIP ROUTED">
                <div className="border-b border-orange-400/15 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select className="tac-select sm:w-36" value={alertPriority} onChange={event => setAlertPriority(event.target.value as AlertPriority)}><option value="CRITICAL">CRITICAL</option><option value="HIGH">HIGH</option><option value="ROUTINE">ROUTINE</option></select>
                    <input className="tac-input flex-1" value={alertBody} onChange={event => setAlertBody(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendAlert(); }} placeholder="ENTER EMERGENCY MESSAGE // CTRL+ENTER TO TRANSMIT" />
                    <button className="tac-button justify-center" onClick={sendAlert}><Send size={14} /> TRANSMIT</button>
                  </div>
                </div>
                <div className="max-h-[280px] overflow-auto">
                  {mesh.messages.length ? mesh.messages.map(message => <MessageRow key={message.id} message={message} />) : <EmptyState icon={<AlertTriangle size={25} />} text="No broadcasts recorded in local state. Compose an alert to begin store-and-forward distribution." />}
                </div>
              </TacticalPanel>

              <TacticalPanel title="RESOURCE ALLOCATION" label="SHARED BOARD">
                <div className="grid grid-cols-2 gap-2 border-b border-orange-400/15 p-3">
                  <input className="tac-input col-span-2" value={resourceLabel} onChange={event => setResourceLabel(event.target.value)} placeholder="RESOURCE LABEL" />
                  <select className="tac-select" value={resourceCategory} onChange={event => setResourceCategory(event.target.value as ResourceCategory)}><option value="SUPPLIES">SUPPLIES</option><option value="PERSONNEL">PERSONNEL</option><option value="EQUIPMENT">EQUIPMENT</option></select>
                  <select className="tac-select" value={resourceStatus} onChange={event => setResourceStatus(event.target.value as ResourceStatus)}><option value="AVAILABLE">AVAILABLE</option><option value="ALLOCATED">ALLOCATED</option><option value="LOW">LOW</option><option value="UNAVAILABLE">UNAVAILABLE</option></select>
                  <div className="flex gap-2"><input className="tac-input min-w-0" type="number" min="1" value={resourceQuantity} onChange={event => setResourceQuantity(event.target.value)} /><input className="tac-input min-w-0" value={resourceUnit} onChange={event => setResourceUnit(event.target.value)} /></div>
                  <button className="tac-button justify-center" onClick={addResource}><ChevronRight size={14} /> POST UPDATE</button>
                  <div className="col-span-2 flex gap-2"><input className="tac-input min-w-0" type="number" min="0" max="100" value={resourceX} onChange={event => setResourceX(event.target.value)} aria-label="Resource grid X coordinate" placeholder="GRID X" /><input className="tac-input min-w-0" type="number" min="0" max="100" value={resourceY} onChange={event => setResourceY(event.target.value)} aria-label="Resource grid Y coordinate" placeholder="GRID Y" /></div>
                </div>
                <div className="max-h-[280px] overflow-auto">
                  {mesh.resources.length ? mesh.resources.map(resource => <ResourceRow key={resource.id} resource={resource} />) : <EmptyState icon={<Archive size={25} />} text="No resources tracked. Post a local record to share it with connected peers." />}
                </div>
              </TacticalPanel>
            </div>

            <footer className="flex flex-col gap-2 border border-orange-400/15 bg-[#141914]/80 px-3 py-2 text-[9px] tracking-[.1em] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2"><ShieldCheck size={12} className="text-orange-300" /> LOCAL STATE: INDEXEDDB // EXPORT: AES-GCM-256 // NO BACKEND PERSISTENCE</span>
              <span>LAST LOCAL WRITE {relativeTime(mesh.updatedAt)}</span>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricRow({ icon, label, value, accent = false, warn = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; warn?: boolean }) {
  return <div className="flex items-center gap-2 py-2.5 text-[10px] tracking-[.11em]"><span className="text-slate-500">{icon}</span><span className="flex-1 text-slate-400">{label}</span><span className={warn ? "text-red-300" : accent ? "text-orange-300" : "text-slate-200"}>{value}</span></div>;
}

function StatStrip({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "good" | "idle" | "orange" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "idle" ? "text-slate-300" : "text-orange-300";
  return <div className="tac-stat"><span className="text-slate-500">{icon}</span><div><p>{label}</p><strong className={color}>{value}</strong></div></div>;
}

function TelemetryCell({ label, value }: { label: string; value: string }) {
  return <div className="p-3"><p className="tac-field-label">{label}</p><p className="mt-1 text-[11px] tracking-[.12em] text-orange-200">{value}</p></div>;
}

function PeerRow({ peer }: { peer: PeerSnapshot }) {
  return <div className="border-b border-orange-400/10 px-3 py-3 last:border-b-0">
    <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${peer.connected ? "bg-emerald-400" : "bg-slate-600"}`} /><span className="flex-1 text-[11px] tracking-[.12em] text-slate-100">{peer.callsign}</span><span className="text-[9px] tracking-[.1em] text-slate-500">{peer.transport}</span></div>
    <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] tracking-[.08em]"><span className="text-slate-500">ID <b className="ml-1 font-normal text-slate-300">{peer.nodeId.slice(0, 6)}</b></span><span className="text-slate-500">RTT <b className="ml-1 font-normal text-orange-200">{peer.latencyMs === null ? "—" : `${peer.latencyMs}MS`}</b></span><span className="text-slate-500">DROP <b className={peer.packetLoss > 5 ? "ml-1 font-normal text-red-300" : "ml-1 font-normal text-slate-300"}>{peer.packetLoss}%</b></span></div>
  </div>;
}

function MessageRow({ message }: { message: EmergencyMessage }) {
  return <article className="border-b border-orange-400/10 px-3 py-3 last:border-b-0">
    <div className="flex flex-wrap items-center gap-2"><span className={`border px-1.5 py-0.5 text-[9px] tracking-[.14em] ${priorityStyle[message.priority]}`}>{message.priority}</span><span className="text-[10px] tracking-[.12em] text-orange-200">{message.originCallsign}</span><span className="text-[9px] tracking-[.1em] text-slate-500">HOP {message.hopCount} // {relativeTime(message.createdAt)}</span><span className="ml-auto text-[9px] tracking-[.1em] text-slate-500">{message.delivery}</span></div>
    <p className="mt-2 text-sm leading-relaxed text-[#d9e1d9]">{message.body}</p>
  </article>;
}

function ResourceRow({ resource }: { resource: ResourceEntry }) {
  return <article className="border-b border-orange-400/10 px-3 py-2.5 last:border-b-0"><div className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center border border-orange-400/20 text-orange-300"><Box size={13} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] tracking-[.1em] text-slate-100">{resource.label}</p><p className="mt-1 text-[9px] tracking-[.1em] text-slate-500">{resource.category} // {resource.coordinate ? `GRID ${resource.coordinate.x}:${resource.coordinate.y}` : "NO GRID"} // UPDATED {relativeTime(resource.updatedAt)}</p></div><div className="text-right"><p className="text-[12px] tracking-[.12em] text-orange-200">{resource.quantity} {resource.unit}</p><p className={`mt-1 text-[9px] tracking-[.1em] ${resourceStyle[resource.status]}`}>{resource.status}</p></div></div></article>;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center px-7 py-7 text-center"><span className="mb-3 text-orange-400/70">{icon}</span><p className="max-w-md text-[10px] leading-relaxed tracking-[.1em] text-slate-500">{text}</p></div>;
}
