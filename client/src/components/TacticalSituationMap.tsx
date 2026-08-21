import type { IncidentZone, IncidentZoneType, ResourceEntry } from "@/lib/mesh/types";
import { Crosshair, MapPinned, Minus, Plus, RadioTower } from "lucide-react";
import { useState } from "react";

const zoneColors: Record<IncidentZoneType, string> = {
  HAZARD: "#ef5b5b",
  STAGING: "#39d98a",
  SEARCH: "#f2bd4f",
  RESTRICTED: "#a998ff",
};

export function TacticalSituationMap({ resources, zones, onAddZone, onRemoveZone }: {
  resources: ResourceEntry[];
  zones: IncidentZone[];
  onAddZone: (zone: IncidentZone) => void;
  onRemoveZone: (zoneId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<IncidentZoneType>("STAGING");
  const [x, setX] = useState("50");
  const [y, setY] = useState("50");
  const [radius, setRadius] = useState("12");

  const addZone = () => {
    const coordinate = { x: clamp(x), y: clamp(y) };
    onAddZone({
      id: crypto.randomUUID(),
      label: label.trim().toUpperCase() || `${type} ZONE`,
      type,
      coordinate,
      radius: Math.max(3, Math.min(30, Number(radius) || 12)),
      updatedAt: Date.now(),
    });
    setLabel("");
  };

  return (
    <section className="tac-panel">
      <div className="tac-panel-heading"><div className="flex items-center gap-2"><span className="h-2 w-2 rotate-45 bg-orange-400" /><h2>TACTICAL SITUATION MAP</h2></div><span className="tac-panel-label">LOCAL GRID // 00–100</span></div>
      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative min-h-[310px] overflow-hidden border border-orange-400/20 bg-[#101510]">
          <svg viewBox="0 0 100 100" role="img" aria-label="Tactical map showing local incident zones and resource locations" className="absolute inset-0 h-full w-full">
            <defs>
              <pattern id="situation-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,142,37,.16)" strokeWidth=".28" /></pattern>
              <pattern id="situation-fine" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M 2 0 L 0 0 0 2" fill="none" stroke="rgba(255,142,37,.035)" strokeWidth=".1" /></pattern>
            </defs>
            <rect width="100" height="100" fill="url(#situation-fine)" />
            <rect width="100" height="100" fill="url(#situation-grid)" />
            {[20, 40, 60, 80].map(value => <g key={value}><text x={value} y="4" textAnchor="middle" fill="#7d887d" fontSize="2.5" fontFamily="monospace">{value}</text><text x="2" y={value} fill="#7d887d" fontSize="2.5" fontFamily="monospace">{value}</text></g>)}
            {zones.map(zone => <g key={zone.id}><circle cx={zone.coordinate.x} cy={zone.coordinate.y} r={zone.radius} fill={zoneColors[zone.type]} fillOpacity=".12" stroke={zoneColors[zone.type]} strokeOpacity=".8" strokeWidth=".5" strokeDasharray="1.4 1" /><text x={zone.coordinate.x} y={zone.coordinate.y - zone.radius - 2} textAnchor="middle" fill={zoneColors[zone.type]} fontSize="3" fontFamily="monospace">{zone.label.slice(0, 16)}</text></g>)}
            {resources.filter(resource => resource.coordinate).map(resource => <g key={resource.id}><circle cx={resource.coordinate?.x} cy={resource.coordinate?.y} r="2.7" fill="#131913" stroke="#ffb15e" strokeWidth=".65" /><path d={`M ${resource.coordinate?.x} ${Number(resource.coordinate?.y) - 1.5} v 3 M ${Number(resource.coordinate?.x) - 1.5} ${resource.coordinate?.y} h 3`} stroke="#ff8e25" strokeWidth=".55" /><text x={resource.coordinate?.x} y={Number(resource.coordinate?.y) + 5.5} textAnchor="middle" fill="#ffe0ba" fontSize="2.8" fontFamily="monospace">{resource.label.slice(0, 13)}</text></g>)}
            <g><circle cx="50" cy="50" r="3.8" fill="#ff8e25" opacity=".12" /><circle cx="50" cy="50" r="1.4" fill="#ff8e25" /><path d="M50 44 v12 M44 50 h12" stroke="#ff8e25" strokeWidth=".35" /></g>
          </svg>
          <div className="absolute left-3 top-3 flex items-center gap-2"><span className="tac-chip"><Crosshair size={10} /> INCIDENT OVERLAY</span><span className="tac-chip text-slate-400">{zones.length} ZONES</span></div>
          <div className="absolute bottom-3 left-3 text-[9px] tracking-[.11em] text-slate-500">ORIGIN / LOCAL COMMAND // {resources.filter(resource => resource.coordinate).length} GEO-TAGGED ASSETS</div>
        </div>
        <div className="space-y-3">
          <div className="border border-orange-400/15 bg-[#111611] p-2.5">
            <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[.13em] text-orange-200"><MapPinned size={13} /> DEFINE INCIDENT ZONE</div>
            <div className="grid grid-cols-2 gap-2">
              <input className="tac-input col-span-2" value={label} onChange={event => setLabel(event.target.value)} placeholder="ZONE LABEL" />
              <select className="tac-select" value={type} onChange={event => setType(event.target.value as IncidentZoneType)}><option value="STAGING">STAGING</option><option value="HAZARD">HAZARD</option><option value="SEARCH">SEARCH</option><option value="RESTRICTED">RESTRICTED</option></select>
              <input className="tac-input" type="number" min="3" max="30" value={radius} onChange={event => setRadius(event.target.value)} placeholder="RADIUS" />
              <input className="tac-input" type="number" min="0" max="100" value={x} onChange={event => setX(event.target.value)} placeholder="GRID X" />
              <input className="tac-input" type="number" min="0" max="100" value={y} onChange={event => setY(event.target.value)} placeholder="GRID Y" />
              <button className="tac-button col-span-2 justify-center" onClick={addZone}><Plus size={13} /> ADD ZONE</button>
            </div>
          </div>
          <div className="max-h-[164px] overflow-auto border border-orange-400/15">
            {zones.length ? zones.map(zone => <div key={zone.id} className="flex items-center gap-2 border-b border-orange-400/10 px-2.5 py-2 last:border-b-0"><span className="h-2 w-2 rounded-full" style={{ background: zoneColors[zone.type] }} /><div className="min-w-0 flex-1"><p className="truncate text-[10px] tracking-[.1em] text-slate-200">{zone.label}</p><p className="mt-0.5 text-[8px] tracking-[.08em] text-slate-500">{zone.type} // {zone.coordinate.x}:{zone.coordinate.y} // R{zone.radius}</p></div><button className="tac-square-button h-7 w-7 text-red-300" onClick={() => onRemoveZone(zone.id)} aria-label={`Remove ${zone.label}`}><Minus size={13} /></button></div>) : <div className="px-4 py-8 text-center text-[9px] tracking-[.1em] text-slate-500"><RadioTower size={16} className="mx-auto mb-2 text-orange-400/70" />NO INCIDENT ZONES DEFINED</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function clamp(value: string): number {
  return Math.max(0, Math.min(100, Number(value) || 0));
}
