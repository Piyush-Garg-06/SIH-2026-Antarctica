import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface StationMapProps {
    activeStation: 'maitri' | 'bharati';
    onStationSelect: (stationId: 'maitri' | 'bharati') => void;
    maitriHealth: number;
    bharatiHealth: number;
    emergencyRouteActive?: boolean;
}

type StationDefinition = {
    id: 'maitri' | 'bharati';
    name: string;
    coords: [number, number];
};

const stations: StationDefinition[] = [
    { id: 'maitri', name: 'Maitri Station (Schirmacher Oasis)', coords: [-70.7667, 11.7333] },
    { id: 'bharati', name: 'Bharati Station (Larsemann Hills)', coords: [-69.4082, 76.1963] },
];

function markerColor(health: number) {
    return health < 50 ? '#ef4444' : health < 85 ? '#eab308' : '#38bdf8';
}

function stationIcon(color: string) {
    return L.divIcon({
        className: 'custom-station-icon',
        html: `<div class="relative flex items-center justify-center"><span class="absolute inline-flex h-8 w-8 rounded-full opacity-25" style="background-color: ${color}"></span><span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white" style="background-color: ${color}"></span></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
}

function stationTooltip(station: StationDefinition, health: number, color: string) {
    return `<div class="bg-slate-900 border border-slate-700 text-slate-100 p-2 rounded shadow-lg font-sans"><p class="font-bold text-sm text-sky-400">${station.name}</p><p class="text-xs mt-1">Coordinates: ${station.coords[0].toFixed(4)}°S, ${station.coords[1].toFixed(4)}°E</p><p class="text-xs font-semibold mt-1">Health Status: <span style="color: ${color}">${health}%</span></p><p class="text-[10px] text-slate-400 mt-0.5">Click node to lock telemetry focus</p></div>`;
}

export const StationMap: React.FC<StationMapProps> = ({ activeStation, onStationSelect, maitriHealth, bharatiHealth, emergencyRouteActive = false }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const markers = useRef<Record<string, L.Marker>>({});
    const colors = useRef<Record<string, string>>({});
    const selectStation = useRef(onStationSelect);
    const emergencyLayers = useRef<L.Layer[]>([]);

    useEffect(() => {
        selectStation.current = onStationSelect;
    }, [onStationSelect]);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const map = L.map(mapRef.current, { center: [-75, 45], zoom: 3, minZoom: 2, maxZoom: 6, zoomControl: false, attributionControl: false });
        mapInstance.current = map;
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

        const healthValues = { maitri: maitriHealth, bharati: bharatiHealth };
        stations.forEach((station) => {
            const health = healthValues[station.id];
            const color = markerColor(health);
            colors.current[station.id] = color;
            const marker = L.marker(station.coords, { icon: stationIcon(color) }).addTo(map);
            marker.bindTooltip(stationTooltip(station, health, color), { direction: 'top', className: 'custom-leaflet-tooltip' });
            marker.on('click', () => {
                selectStation.current(station.id);
                map.setView(station.coords, 4, { animate: false });
            });
            markers.current[station.id] = marker;
        });

        L.polyline([[-33.9249, 18.4241], [-70.7667, 11.7333], [-69.4082, 76.1963]], { color: '#38bdf8', weight: 1.5, dashArray: '5, 10', opacity: 0.6 }).addTo(map).bindTooltip('Conceptual Sea Route (Cape Town Portal)', { sticky: true });

        return () => {
            map.remove();
            mapInstance.current = null;
            markers.current = {};
            colors.current = {};
            emergencyLayers.current = [];
        };
    }, []);

    useEffect(() => {
        stations.forEach((station) => {
            const marker = markers.current[station.id];
            if (!marker) return;
            const health = station.id === 'maitri' ? maitriHealth : bharatiHealth;
            const color = markerColor(health);
            if (colors.current[station.id] === color) return;
            colors.current[station.id] = color;
            marker.setIcon(stationIcon(color));
            marker.setTooltipContent(stationTooltip(station, health, color));
        });
    }, [maitriHealth, bharatiHealth]);

    useEffect(() => {
        const map = mapInstance.current;
        const station = stations.find((item) => item.id === activeStation);
        if (map && station) map.setView(station.coords, 4, { animate: false });
    }, [activeStation]);

    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;
        emergencyLayers.current.forEach((layer) => map.removeLayer(layer));
        emergencyLayers.current = [];

        const health = activeStation === 'maitri' ? maitriHealth : bharatiHealth;
        if (health >= 80 && !emergencyRouteActive) return;
        const stationCoords = activeStation === 'maitri' ? [-70.7667, 11.7333] as [number, number] : [-69.4082, 76.1963] as [number, number];
        const rescueCoords = activeStation === 'maitri' ? [-70.7833, 11.8333] as [number, number] : [-69.3750, 76.3800] as [number, number];
        const rescueName = activeStation === 'maitri' ? 'Novolazarevskaya (Russia)' : 'Progress II (Russia)';
        const rescueMarker = L.marker(rescueCoords, { icon: L.divIcon({ className: 'rescue-pulsing-icon', html: '<div class="relative flex items-center justify-center"><span class="absolute inline-flex h-12 w-12 rounded-full bg-orange-500 opacity-30 animate-ping"></span><span class="absolute inline-flex h-10 w-10 rounded-full bg-orange-500 opacity-20"></span><span class="relative inline-flex rounded-full h-5 w-5 bg-orange-600 border-2 border-white shadow-[0_0_12px_rgba(251,146,60,0.9)]"></span></div>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map);
        rescueMarker.bindTooltip(`<div class="bg-slate-900 border border-orange-500 text-orange-400 p-2.5 rounded shadow-lg font-sans text-xs"><p class="font-bold text-orange-500 uppercase tracking-wider text-[10px]">Rescue Coord Center</p><p class="font-bold text-white text-sm mt-0.5">${rescueName}</p><p class="text-slate-300 mt-1 font-semibold">Alert status: ${emergencyRouteActive ? 'Mutual aid request in transit' : 'Active standby'}</p></div>`, { permanent: true, direction: 'bottom', className: 'emergency-rescue-tooltip' });
        const line = L.polyline([stationCoords, rescueCoords], { color: '#f97316', weight: emergencyRouteActive ? 5 : 3.5, dashArray: emergencyRouteActive ? '2, 8' : '6, 8', opacity: 0.98 }).addTo(map);
        const glowLine = L.polyline([stationCoords, rescueCoords], { color: '#fdba74', weight: emergencyRouteActive ? 10 : 7, opacity: emergencyRouteActive ? 0.28 : 0.16, dashArray: emergencyRouteActive ? '2, 8' : '6, 8' }).addTo(map);
        emergencyLayers.current = [glowLine, line, rescueMarker];

        if (emergencyRouteActive) {
            map.setView([(-70.7667 + rescueCoords[0]) / 2, (11.7333 + rescueCoords[1]) / 2], 4.5, { animate: true });
        }
    }, [activeStation, maitriHealth, bharatiHealth, emergencyRouteActive]);

    return <div className="relative h-full w-full rounded-lg border border-slate-800 overflow-hidden glow-blue">
        <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 border border-slate-800 p-2 px-3 rounded flex items-center gap-2 backdrop-blur-sm"><span className="h-2 w-2 rounded-full bg-emerald-500"></span><span className="font-mono text-xs uppercase tracking-wider text-slate-300">GEO-LOGISTICS ORBITAL MONITOR</span></div>
        <div ref={mapRef} className="h-full w-full" />
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 border border-slate-800 p-2.5 rounded text-xs font-mono text-slate-400 backdrop-blur-sm flex flex-col gap-1"><div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]"></span><span>Nominal (Score &gt;= 85)</span></div><div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#eab308]"></span><span>Degraded (Score 50-84)</span></div><div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]"></span><span>Critical (Score &lt; 50)</span></div><div className="h-px bg-slate-800 my-1"></div><div className="text-[10px] text-slate-500">Route Cape Town &rarr; Stations</div></div>
    </div>;
};
