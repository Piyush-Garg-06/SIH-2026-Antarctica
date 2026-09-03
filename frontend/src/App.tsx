import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ShieldAlert, Activity, Droplet, Wifi, WifiOff,
  Sparkles, FileText, CheckCircle, RefreshCw, AlertTriangle,
  Cpu, HardDrive, Compass, User, Play,
  Wind, ChevronRight, Download,
  Volume2, VolumeX, Globe, Wrench, Database
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, Line, Legend
} from 'recharts';

import { StationMap } from './components/StationMap';
import { DigitalTwin3D } from './components/DigitalTwin3D';
// Establish backend connection details
const BACKEND_URL = `http://${window.location.hostname}:5000`;

// Real-time Energy Flow Schematic Component
const EnergyFlowSchematic: React.FC<{ telemetry: any; activeStation: string }> = ({ telemetry, activeStation }) => {
  if (!telemetry) return null;

  // Retrieve state of generators
  const gen1 = telemetry.generators.find((g: any) => g.id === 'gen_1');
  const gen2 = telemetry.generators.find((g: any) => g.id === 'gen_2');
  const gen3 = telemetry.generators.find((g: any) => g.id === 'gen_3');

  // Active status of generators
  const isGen1Running = gen1?.status === 'running';
  const isGen2Running = gen2?.status === 'running';
  const isGen3Running = gen3?.status === 'running';

  // Battery status
  const batterySoc = telemetry.powerGrid.batterySoc;
  const waterShortageActive = telemetry.activeScenario === 'water_shortage' || (telemetry.resources?.waterDays ?? 99) <= 5;
  const isBatteryDraining = telemetry.powerGrid.load > telemetry.powerGrid.capacity && batterySoc > 0;
  const isBatteryCharging = telemetry.powerGrid.capacity > telemetry.powerGrid.load && batterySoc < 98;
  const batteryStress = waterShortageActive || isBatteryDraining;

  // Load of buildings
  const adminLoad = telemetry.buildings.find((b: any) => b.id === 'bld_admin')?.load || 0;
  const livingLoad = telemetry.buildings.find((b: any) => b.id === 'bld_living')?.load || 0;
  const labsLoad = telemetry.buildings.find((b: any) => b.id === 'bld_labs')?.load || 0;
  const utilityLoad = telemetry.buildings.find((b: any) => b.id === 'bld_utility')?.load || 0;
  const highlightedUtilityLoad = utilityLoad + (waterShortageActive ? 18 : 0);

  // Total grid load
  const totalLoad = telemetry.powerGrid.load + (waterShortageActive ? 18 : 0);

  return (
    <div className="glass-panel p-6 glow-blue-premium flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Dynamic Grid Schematic
          </span>
          <h4 className="text-sm font-bold font-outfit text-white uppercase tracking-wide">
            {activeStation} Power Distribution Flow
          </h4>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-900/60 px-2.5 py-1 rounded-md border border-white/5">
          Real-time telemetry
        </span>
      </div>

      <div className="relative w-full h-72 bg-slate-950/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 540 230" xmlns="http://www.w3.org/2000/svg">
          {/* Main Bus Line (Vertical Center) */}
          <line x1="270" y1="20" x2="270" y2="210" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <line x1="270" y1="20" x2="270" y2="210" stroke="#6366f1" strokeWidth="2" opacity="0.6" />

          {/* CONNECTIONS FROM GENERATORS TO BUS */}
          <path d="M 110 35 L 200 35 L 200 115 L 270 115" fill="none" stroke={isGen1Running ? "#f59e0b" : "rgba(255,255,255,0.1)"} strokeWidth="2.5"
            className={isGen1Running ? "animate-flow-dash-premium" : ""} />

          <path d="M 110 115 L 270 115" fill="none" stroke={isGen2Running ? "#f59e0b" : "rgba(255,255,255,0.1)"} strokeWidth="2.5"
            className={isGen2Running ? "animate-flow-dash-premium" : ""} />

          <path d="M 110 195 L 200 195 L 200 115 L 270 115" fill="none" stroke={isGen3Running ? "#ef4444" : "rgba(255,255,255,0.1)"} strokeWidth="2.5"
            className={isGen3Running ? "animate-flow-dash-premium" : ""} />

          {/* CONNECTION FROM BATTERY TO BUS */}
          <path d="M 270 210 L 270 115" fill="none" stroke={batteryStress ? "#f59e0b" : isBatteryDraining ? "#ef4444" : isBatteryCharging ? "#10b981" : "rgba(255,255,255,0.1)"} strokeWidth="3"
            className={batteryStress || isBatteryDraining || isBatteryCharging ? "animate-flow-dash-premium" : ""} />

          {/* CONNECTIONS FROM BUS TO BUILDINGS */}
          <path d="M 270 115 L 340 115 L 340 35 L 430 35" fill="none" stroke={adminLoad > 0 ? "#06b6d4" : "rgba(255,255,255,0.1)"} strokeWidth="2"
            className={adminLoad > 0 ? "animate-flow-dash-premium" : ""} />

          <path d="M 270 115 L 350 115 L 350 85 L 430 85" fill="none" stroke={livingLoad > 0 ? "#06b6d4" : "rgba(255,255,255,0.1)"} strokeWidth="2"
            className={livingLoad > 0 ? "animate-flow-dash-premium" : ""} />

          <path d="M 270 115 L 350 115 L 350 145 L 430 145" fill="none" stroke={labsLoad > 0 ? "#06b6d4" : "rgba(255,255,255,0.1)"} strokeWidth="2"
            className={labsLoad > 0 ? "animate-flow-dash-premium" : ""} />

          <path d="M 270 115 L 340 115 L 340 195 L 430 195" fill="none" stroke={waterShortageActive ? "#f59e0b" : utilityLoad > 0 ? "#06b6d4" : "rgba(255,255,255,0.1)"} strokeWidth="2"
            className={utilityLoad > 0 || waterShortageActive ? "animate-flow-dash-premium" : ""} />
        </svg>

        <div className="absolute inset-0 p-4 flex justify-between z-10 pointer-events-none">
          {/* Left Column: Power Sources */}
          <div className="flex flex-col justify-between h-full w-32">
            {/* Gen 1 */}
            <div className={`p-2 border rounded-lg bg-slate-950/90 text-xs flex flex-col justify-center ${isGen1Running ? 'border-amber-500/50 text-amber-400 glow-amber-premium' : 'border-white/5 text-slate-500'
              }`}>
              <div className="font-semibold truncate uppercase">Gen 1 (Main)</div>
              <div className="font-mono text-[11px] mt-0.5">{isGen1Running ? `${gen1.load} kW` : 'OFFLINE'}</div>
            </div>

            {/* Gen 2 */}
            <div className={`p-2 border rounded-lg bg-slate-950/90 text-xs flex flex-col justify-center ${isGen2Running ? 'border-amber-500/50 text-amber-400 glow-amber-premium' : 'border-white/5 text-slate-500'
              }`}>
              <div className="font-semibold truncate uppercase">Gen 2 (Aux)</div>
              <div className="font-mono text-[11px] mt-0.5">{isGen2Running ? `${gen2.load} kW` : 'STANDBY'}</div>
            </div>

            {/* Gen 3 */}
            <div className={`p-2 border rounded-lg bg-slate-950/90 text-xs flex flex-col justify-center ${isGen3Running ? 'border-red-500 text-red-400 glow-red-premium animate-glow-pulse-red' : 'border-white/5 text-slate-500'
              }`}>
              <div className="font-semibold truncate uppercase">Gen 3 (Emerg)</div>
              <div className="font-mono text-[11px] mt-0.5">{isGen3Running ? `${gen3.load} kW` : 'STANDBY'}</div>
            </div>
          </div>

          {/* Center Bottom Column: Battery Bank */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-36 flex flex-col items-center">
            <div className={`p-2 border rounded-lg bg-slate-950/95 text-xs text-center w-full ${waterShortageActive ? 'border-amber-500/60 text-amber-300 glow-amber-premium' : isBatteryDraining ? 'border-red-500/50 text-red-400 glow-red-premium' : isBatteryCharging ? 'border-emerald-500/50 text-emerald-400 glow-emerald-premium' : 'border-white/5 text-slate-350'
              }`}>
              <div className="font-semibold uppercase tracking-wider text-[10px]">Battery Bank</div>
              <div className="font-mono font-bold mt-0.5 text-slate-100">SoC: {Math.round(batterySoc)}%</div>
              <div className="text-[9px] uppercase tracking-widest mt-0.5 font-bold">
                {waterShortageActive ? 'LOAD RISING' : isBatteryDraining ? 'DRAINING' : isBatteryCharging ? 'CHARGING' : 'STABLE'}
              </div>
            </div>
          </div>

          {/* Right Column: Buildings / Consumers */}
          <div className="flex flex-col justify-between h-full w-32 ml-auto">
            {/* Admin */}
            <div className="p-2 border border-white/5 rounded-lg bg-slate-950/90 text-xs flex justify-between items-center">
              <span className="text-slate-400 truncate">Admin Core</span>
              <span className="font-mono font-bold text-cyan-400 shrink-0 ml-1">{adminLoad} kW</span>
            </div>

            {/* Living */}
            <div className="p-2 border border-white/5 rounded-lg bg-slate-950/90 text-xs flex justify-between items-center">
              <span className="text-slate-400 truncate">Living Mod</span>
              <span className="font-mono font-bold text-cyan-400 shrink-0 ml-1">{livingLoad} kW</span>
            </div>

            {/* Labs */}
            <div className="p-2 border border-white/5 rounded-lg bg-slate-950/90 text-xs flex justify-between items-center">
              <span className="text-slate-400 truncate">Sci Labs</span>
              <span className="font-mono font-bold text-cyan-400 shrink-0 ml-1">{labsLoad} kW</span>
            </div>

            {/* Utility */}
            <div className={`p-2 border rounded-lg bg-slate-950/90 text-xs flex justify-between items-center ${waterShortageActive ? 'border-amber-500/50 text-amber-300' : 'border-white/5 text-slate-400'}`}>
              <span className="truncate">Utility Annex</span>
              <span className="font-mono font-bold shrink-0 ml-1 text-cyan-400">{highlightedUtilityLoad} kW</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-white/5 font-mono">
        <span>TOTAL POWER CAPACITY: <strong className="text-slate-100">{telemetry.powerGrid.capacity} kW</strong></span>
        <span className={waterShortageActive ? 'text-amber-400' : 'text-slate-400'}>GRID LOAD DEMAND: <strong className={waterShortageActive ? 'text-amber-300' : 'text-amber-400'}>{totalLoad} kW</strong></span>
      </div>
    </div>
  );
};


export default function App() {
  // Navigation & Role states
  const [activeStation, setActiveStation] = useState<'maitri' | 'bharati'>('maitri');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [role, setRole] = useState<string>('Operations Manager');
  const [emergencyMode, setEmergencyMode] = useState<boolean>(false);
  const [linkStatus, setLinkStatus] = useState<'online' | 'offline'>('online');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isNight, setIsNight] = useState<boolean>(false);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  // Live Telemetry states
  const [telemetry, setTelemetry] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeScenario, setActiveScenario] = useState<string>('none');
  const [systemEvents, setSystemEvents] = useState<string[]>([]);
  const [mutualAidRequest, setMutualAidRequest] = useState<{ station: string; time: string } | null>(null);
  const [emergencyRouteActive, setEmergencyRouteActive] = useState<boolean>(false);

  // Historical & Forecast states
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [forecastTimeline, setForecastTimeline] = useState<any[]>([]);

  // Selected Asset details (from 3D twin or lists)
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  // Offline Store-and-Forward state
  const [queuedLogs, setQueuedLogs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [linkTier, setLinkTier] = useState<string>('full');
  const [rtt, setRtt] = useState<number>(0);
  const [lastSyncedTime, setLastSyncedTime] = useState<number>(Date.now());
  const [secondsSinceSync, setSecondsSinceSync] = useState<number>(0);

  // AI Copilot Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'copilot'; text: string; time: string }>>([
    { sender: 'copilot', text: "Systems online. I am POLARIS, your Antarctic Mission Commander. Ask me anything about current telemetry, power loads, or resource levels.", time: new Date().toLocaleTimeString() }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);

  // Daily Report state
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);

  // Demo Wizard state
  const [demoStep, setDemoStep] = useState<number>(0);
  // Subsystems Diagnostic Health & Self-Test State
  const [activeSelfTestId, setActiveSelfTestId] = useState<string | null>(null);
  const [selfTestProgress, setSelfTestProgress] = useState<number>(0);
  const [lastCompletedTest, setLastCompletedTest] = useState<{ id: string; name: string; health: number; timestamp: string } | null>(null);
  const [subsystemStates, setSubsystemStates] = useState<Record<string, { id: string; name: string; location: string; temp: number; health: number; status: string; vibration: string; calibration: string }>>({
    'hvac_1': { id: 'hvac_1', name: 'Main Quarters HVAC Air Handler', location: 'Living Quarters', temp: 22, health: 89, status: 'operational', vibration: '0.014g', calibration: '99%' },
    'water_pump_1': { id: 'water_pump_1', name: 'Lake Priyadarshini Intake Heater & Pump', location: 'Utility Annex', temp: 4, health: 94, status: 'operational', vibration: '0.008g', calibration: '100%' },
    'sat_dish_1': { id: 'sat_dish_1', name: 'High-Gain Satcom Actuator Mount', location: 'Comms Platform', temp: -12, health: 76, status: 'nominal_degradation', vibration: '0.042g', calibration: '84%' },
    'fire_cylinder_1': { id: 'fire_cylinder_1', name: 'Halon Suppression Pressure Matrix', location: 'Power House', temp: 15, health: 99, status: 'operational', vibration: '0.002g', calibration: '100%' }
  });

  // Reference for socket connection
  const socketRef = useRef<Socket | null>(null);

  // 1. WebSocket connection and message routing
  useEffect(() => {
    // Always connect to mainland backend Socket.io
    socketRef.current = io(BACKEND_URL);

    socketRef.current.on('connect', () => {
      addSystemLog("Established satellite telemetry stream from mainland gateway.");
    });

    socketRef.current.on('telemetryUpdate', (data: any) => {
      if (data.stationId === activeStation) {
        setTelemetry(data.telemetry);
        setAlerts(data.alerts);
        setActiveScenario(data.activeScenario);
        setLastSyncedTime(Date.now());
      }
    });

    socketRef.current.on('scenarioChange', (data: any) => {
      if (data.stationId === activeStation) {
        setActiveScenario(data.scenario);
        setForecastTimeline(data.timeline);
        addSystemLog(`What-If Simulation scenario updated to: ${data.scenario.toUpperCase()}`);
      }
    });

    socketRef.current.on('linkStatus', (data: any) => {
      if (data.stationId === activeStation) {
        setLinkTier(data.tier);
        setRtt(data.lastRtt);
        setQueuedLogs(new Array(data.queuedCount || 0).fill({}));

        const nextStatus = data.tier === 'offline' ? 'offline' : 'online';
        setLinkStatus(nextStatus);
      }
    });

    if (socketRef.current) {
      socketRef.current.on('disconnect', () => {
        addSystemLog("Satellite telemetry stream disconnected.");
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [activeStation]);

  // Automated Emergency Mode sync based on Station Health Score <= 40%
  useEffect(() => {
    if (!telemetry) return;
    const health = telemetry.healthScore ?? 100;
    const isCriticalHealth = health <= 40 || telemetry.activeScenario === 'fuel_shortage' || telemetry.activeScenario === 'water_shortage';

    if (isCriticalHealth && !emergencyMode) {
      setEmergencyMode(true);
      addSystemLog(`AUTOMATED EMERGENCY PROTOCOL ENGAGED: Station Health dropped to ${health}%. Non-essential auxiliary loads shed.`);
    } else if (!isCriticalHealth && emergencyMode && health > 40 && (telemetry.activeScenario === 'none' || !telemetry.activeScenario)) {
      setEmergencyMode(false);
      addSystemLog(`AUTOMATED EMERGENCY STAND-DOWN: Station Health restored to ${health}%. Normal operations resumed.`);
    }
  }, [telemetry?.healthScore, telemetry?.activeScenario]);

  // Fetch initial telemetry and history when station changes
  useEffect(() => {
    // Fetch live data
    fetch(`${BACKEND_URL}/api/stations/${activeStation}/telemetry`)
      .then(res => res.json())
      .then(data => {
        setTelemetry(data.telemetry);
        setAlerts(data.alerts);
        setActiveScenario(data.activeScenario);
        setLastSyncedTime(Date.now());
        if (data.timeline) {
          setForecastTimeline(data.timeline);
        } else {
          setForecastTimeline([]);
        }
      })
      .catch(err => console.error("Error fetching live telemetry:", err));

    // Fetch 30-day historical chart data
    fetch(`${BACKEND_URL}/api/stations/${activeStation}/history`)
      .then(res => res.json())
      .then(data => setHistoryData(data))
      .catch(err => console.error("Error fetching station history:", err));

    // Fetch link status
    fetch(`${BACKEND_URL}/api/link/status`)
      .then(res => res.json())
      .then(data => {
        const nextStatus = data.isConnected ? 'online' : 'offline';
        setLinkStatus(nextStatus);
        setQueuedLogs(new Array(data.queuedCount || 0).fill({}));
      })
      .catch(err => console.error("Error fetching link status:", err));
  }, [activeStation]);

  // Track elapsed seconds since last sync
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceSync(Math.round((Date.now() - lastSyncedTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSyncedTime]);

  // Persistent alarm sound during critical health / active scenario / emergency mode (independent of UI alert dismissal)
  useEffect(() => {
    if (!soundEnabled) return;

    const isScenarioActive = telemetry && telemetry.activeScenario && telemetry.activeScenario !== 'none';
    const isHealthDegraded = telemetry && (telemetry.healthScore ?? 100) < 85;
    const hasCriticalAlerts = alerts && alerts.some(a => a.severity === 'critical');
    const isStationCritical = emergencyMode || isHealthDegraded || isScenarioActive || hasCriticalAlerts;

    if (isStationCritical) {
      playBeepSound();
      const alarmInterval = setInterval(() => {
        playBeepSound();
      }, 2500);

      return () => clearInterval(alarmInterval);
    }
  }, [emergencyMode, telemetry?.healthScore, telemetry?.activeScenario, alerts, soundEnabled]);

  // Helper to trigger system event log
  const addSystemLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setSystemEvents(prev => [`[${time}] ${message}`, ...prev.slice(0, 19)]);
  };

  const runSubsystemSelfTest = (eqId: string, eqName: string) => {
    if (activeSelfTestId) return;

    setActiveSelfTestId(eqId);
    setSelfTestProgress(10);
    addSystemLog(`Initiated 12-point hardware self-test diagnostic sequence on: ${eqName}`);
    if (soundEnabled) playBeepSound();

    let step = 10;
    const interval = setInterval(() => {
      step += 18;
      if (step >= 100) {
        step = 100;
        setSelfTestProgress(100);
        clearInterval(interval);

        setTimeout(() => {
          setSubsystemStates(prev => ({
            ...prev,
            [eqId]: {
              ...prev[eqId],
              health: Math.min(100, (prev[eqId]?.health || 80) + 18),
              status: 'operational',
              vibration: '0.004g (Optimal)',
              calibration: '100% (Calibrated)'
            }
          }));

          const time = new Date().toLocaleTimeString();
          setLastCompletedTest({ id: eqId, name: eqName, health: 98, timestamp: time });
          setActiveSelfTestId(null);
          setSelfTestProgress(0);

          addSystemLog(`[DIAGNOSTIC PASSED] ${eqName} completed 12-point self-test. Actuators re-calibrated. Status: 100% OPERATIONAL.`);
          if (soundEnabled) playBeepSound();
        }, 400);
      } else {
        setSelfTestProgress(step);
        if (soundEnabled) playBeepSound();
      }
    }, 300);
  };

  const handleMutualAidRequest = () => {
    const targetStation = activeStation === 'maitri' ? 'Novolazarevskaya' : 'Progress II';
    const time = new Date().toLocaleTimeString();
    setMutualAidRequest({ station: targetStation, time });
    setEmergencyRouteActive(true);
    addSystemLog(`[SIMULATED] Mutual aid request logged for ${targetStation}.`);
  };

  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(350, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      // Audio context might be blocked by browser
    }
  };

  // 3. Offline Sync logic (Store-and-Forward transmission)
  const handleSyncData = async () => {
    if (queuedLogs.length === 0) return;
    setSyncing(true);
    addSystemLog(`Transmitting stored data: Uplinking ${queuedLogs.length} buffered blocks...`);

    if (linkStatus === 'online') {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stationId: activeStation, queuedData: queuedLogs })
        });
        const result = await response.json();

        if (result.success) {
          addSystemLog(`Data sync complete. Sent ${result.syncedRecordsCount} blocks. Clearing buffer.`);
          setQueuedLogs([]);
        } else {
          addSystemLog("Satellite synchronization gateway returned error.");
        }
      } catch (err) {
        addSystemLog("Link sync failed. Connection timeout.");
      } finally {
        setSyncing(false);
      }
    } else {
      setTimeout(() => {
        addSystemLog("[OFFLINE Sync Error] Can't sync: Satellite link remains offline.");
        setSyncing(false);
      }, 1000);
    }
  };

  // Execute What-if Scenario
  const runScenario = (scenarioName: string) => {
    addSystemLog(`Activating Simulation: ${scenarioName.toUpperCase()}`);
    if (linkStatus === 'online') {
      fetch(`${BACKEND_URL}/api/simulations/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: activeStation, scenario: scenarioName })
      })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            throw new Error(data.error || 'Simulation request failed');
          }
          setActiveScenario(data.scenario || scenarioName);
          setForecastTimeline(data.timeline || []);
        })
        .catch(err => console.error(err));
    } else {
      // Local client simulation trigger
      setActiveScenario(scenarioName);
      // Generate mock 7 day forecast data
      const mockTimeline = Array.from({ length: 7 }, (_, i) => ({
        day: i,
        fuel: Math.round((telemetry?.resources.fuel || 40000) - i * 1500 * (scenarioName === 'fuel_shortage' ? 3 : 1)),
        water: Math.round((telemetry?.resources.water || 12000) - i * 400 * (scenarioName === 'water_shortage' ? 4 : 1)),
        battery: Math.max(0, 90 - i * (scenarioName === 'generator_failure' ? 15 : scenarioName === 'battery_failure' ? 30 : 2)),
        power: (telemetry?.powerGrid.load || 120) + (scenarioName === 'snowstorm' ? i * 12 : 0),
        healthScore: Math.max(10, 95 - i * (scenarioName === 'generator_failure' ? 8 : 1)),
        risk: scenarioName === 'snowstorm' ? 'High' : 'Medium'
      }));
      setForecastTimeline(mockTimeline);
    }
  };

  // Reset scenario back to baseline
  const resetScenario = () => {
    if (linkStatus === 'online') {
      fetch(`${BACKEND_URL}/api/simulations/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: activeStation })
      })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            throw new Error(data.error || 'Simulation reset failed');
          }
          setActiveScenario('none');
          setForecastTimeline([]);
        })
        .catch(err => console.error(err));
    } else {
      setActiveScenario('none');
      setForecastTimeline([]);
      addSystemLog("[OFFLINE] Cleared simulation. Returning telemetry to baseline.");
    }
  };

  // 4. AI Copilot chat submissions
  const handleSendChatMessage = async (presetText?: string) => {
    const text = presetText || chatInput;
    if (!text.trim()) return;

    const userMsg = { sender: 'user' as const, text, time: new Date().toLocaleTimeString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setCopilotLoading(true);

    if (linkStatus === 'online') {
      try {
        const res = await fetch(`${BACKEND_URL}/api/copilot/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stationId: activeStation, question: text })
        });
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: 'copilot', text: data.answer, time: new Date().toLocaleTimeString() }]);
      } catch (err) {
        setChatMessages(prev => [...prev, { sender: 'copilot', text: "Error transmitting question. Switching to offline copilot reasoning...", time: new Date().toLocaleTimeString() }]);
        handleLocalCopilotReply(text);
      } finally {
        setCopilotLoading(false);
      }
    } else {
      // Local Client-side Copilot reasoning
      setTimeout(() => {
        handleLocalCopilotReply(text);
        setCopilotLoading(false);
      }, 500);
    }
  };

  // Offline client-side AI parsing fallback
  const handleLocalCopilotReply = (question: string) => {
    const query = question.toLowerCase();
    let reply = "";

    if (query.includes('status') || query.includes('health') || query.includes('how is')) {
      reply = `### **[OFFLINE INTERRUPT] Copilot Local Cache Response**\n\n**Station Status:** \`${telemetry?.healthScore}/100\` (${telemetry?.riskLevel} Risk)\n* **Power Load:** \`${telemetry?.powerGrid.load} kW\`\n* **Resources Remaining:** Fuel: \`${telemetry?.resources.fuelDays} days\`, Water: \`${telemetry?.resources.waterDays} days\`.\n\n*Connection is currently offline. Showing local memory values.*`;
    } else if (query.includes('power') || query.includes('generator') || query.includes('energy')) {
      reply = `### **[OFFLINE INTERRUPT] Copilot Power Report**\n\nActive generators: \`${telemetry?.generators.filter((g: any) => g.status === 'running').length} running\`.\n* Total grid demand: \`${telemetry?.powerGrid.load} kW\`\n* Battery charge: \`${Math.round(telemetry?.powerGrid.batterySoc)}%\` SoC.\n\nPrimary warning checks: HVAC system drawing standard loading.`;
    } else if (query.includes('fuel') || query.includes('deplet') || query.includes('water')) {
      reply = `### **[OFFLINE INTERRUPT] Copilot Resource Logistics**\n\n* SAB Fuel: \`${Math.round(telemetry?.resources.fuel)} Liters\` (~${telemetry?.resources.fuelDays} days)\n* Water: \`${Math.round(telemetry?.resources.water)} Liters\` (~${telemetry?.resources.waterDays} days).\n\nForecast models remain stored locally.`;
    } else if (query.includes('recommend') || query.includes('do now') || query.includes('action')) {
      reply = `### **[OFFLINE INTERRUPT] Action Recommendations**\n\nSatellite telemetry is disconnected. I recommend:\n1. Maintain visual watch over generator temperature indices.\n2. In case of blizzard, restrict movements of scientists.\n3. Keep local log files in buffer (currently \`${queuedLogs.length}\` logs queued).`;
    } else {
      reply = `### **[OFFLINE INTERRUPT] Copilot Response**\n\nI received: "${question}".\n\nSince we are operating **offline**, I can only parse key inquiries about: status, power, fuel, and actions. Please rephrase your query.`;
    }

    setChatMessages(prev => [...prev, { sender: 'copilot', text: reply, time: new Date().toLocaleTimeString() }]);
  };

  // 5. Daily operations report generator
  const handleGenerateReport = async () => {
    setReportLoading(true);
    if (linkStatus === 'online') {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reports/daily?stationId=${activeStation}`);
        const data = await res.json();
        setDailyReport(data.report);
      } catch (e) {
        generateLocalReport();
      } finally {
        setReportLoading(false);
      }
    } else {
      setTimeout(() => {
        generateLocalReport();
        setReportLoading(false);
      }, 600);
    }
  };

  const generateLocalReport = () => {
    if (!telemetry) return;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    setDailyReport({
      stationName: activeStation === 'maitri' ? 'Maitri' : 'Bharati',
      date: dateStr + " (Offline Cache)",
      healthScore: telemetry.healthScore,
      riskLevel: telemetry.riskLevel,
      fuelDays: telemetry.resources.fuelDays,
      waterDays: telemetry.resources.waterDays,
      alertsCount: alerts.length,
      generatorsRunning: telemetry.generators.filter((g: any) => g.status === 'running').length,
      weather: telemetry.weather,
      criticalIssues: alerts.map(a => a.message),
      recommendations: [
        "[OFFLINE WARNING] Sync satellite terminal to upload final logs.",
        "Ensure diesel fuel tanks remain sealed against extreme weather conditions."
      ]
    });
  };

  // Print report
  const printReport = () => {
    window.print();
  };

  // Resolve alert directly (Dismissing UI notification card)
  const resolveAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    addSystemLog(`Operator dismissed UI alert card [${alertId}]. Station physical emergency status remains active.`);

    if (linkStatus === 'online') {
      fetch(`${BACKEND_URL}/api/alerts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: activeStation, alertId })
      }).catch(err => console.error(err));
    }
  };

  // 6. 2-3 Minute Hackathon Demo Flow Wizard
  const advanceDemoWizard = () => {
    const nextStep = demoStep + 1;
    setDemoStep(nextStep);

    if (nextStep === 1) {
      // Step 1: Normal state overview
      setActiveStation('maitri');
      setActiveTab('overview');
      setLinkStatus('online');
      addSystemLog("Demo Step 1: Standard telemetry inspection active.");
    } else if (nextStep === 2) {
      // Step 2: Open 3D digital twin
      setActiveTab('3d-twin');
      // Auto select generator
      setSelectedAsset({
        id: 'gen_1',
        name: 'Power House (Generators G1-G3)',
        type: 'box',
        position: [0, 1.2, 3],
        size: [4, 2.4, 2.5],
        color: '#f97316',
        telemetryField: 'gen_1',
        liveStatus: telemetry?.generators[0]
      });
      addSystemLog("Demo Step 2: Inspection of Primary Generator assets in 3D.");
    } else if (nextStep === 3) {
      // Step 3: Run Snowstorm Simulation
      setActiveTab('simulation');
      runScenario('snowstorm');
      addSystemLog("Demo Step 3: Activating Blizzard category 5 scenario in Simulation Center.");
    } else if (nextStep === 4) {
      // Step 4: AI advice check
      setActiveTab('ai-commander');
      handleSendChatMessage("What should we do?");
      addSystemLog("Demo Step 4: Consult Polaris Command AI advisor.");
    } else if (nextStep === 5) {
      // Step 5: Simulate Link failure
      setActiveTab('overview');
      setLinkStatus('offline');
      addSystemLog("Demo Step 5: Comm link severed. Initializing local log queue.");
    } else if (nextStep === 6) {
      // Step 6: Restore link and sync
      setActiveTab('overview');
      setLinkStatus('online');
      addSystemLog("Demo Step 6: Satellite connection restored.");
      setTimeout(() => {
        handleSyncData();
      }, 1000);
    } else if (nextStep === 7) {
      // Step 7: Print report
      setActiveTab('reports');
      handleGenerateReport();
      addSystemLog("Demo Step 7: Generating Daily Operations Report.");
    } else {
      // Reset demo
      setDemoStep(0);
      setShowDemoWizard(false);
      resetScenario();
    }
  };

  const skipDemo = () => {
    setDemoStep(0);
    setShowDemoWizard(false);
  };

  // ==========================================
  // MODULAR TAB VIEW RENDERERS (SKELETONS)
  // ==========================================
  const renderOverview = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-h-0 bg-grid-premium">
        {/* Left Stats Column */}
        <aside className={`w-full xl:w-[380px] shrink-0 border-r p-6 flex flex-col gap-6 overflow-y-auto scrollbar-thin transition-colors duration-500 ${emergencyMode ? 'border-red-900/35 bg-[#1a0606]/35' : 'border-white/5 bg-slate-950/20'
          }`}>
          {/* Station Health Integrity */}
          <div className={`p-5 rounded-2xl glass-panel relative flex items-center justify-between transition-all duration-300 ${telemetry.healthScore < 50 ? 'glow-red-premium animate-glow-pulse-red' : telemetry.healthScore < 80 ? 'glow-amber-premium' : 'glow-blue-premium'
            }`}>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">System Integrity</span>
              <span className="text-4xl font-extrabold tracking-tight text-white font-outfit">{telemetry.healthScore ?? 100}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${(telemetry.healthScore ?? 100) >= 80 ? 'text-emerald-400' : (telemetry.healthScore ?? 100) >= 50 ? 'text-amber-450' : 'text-red-500'
                }`}>
                {(telemetry.healthScore ?? 100) >= 80 ? '● Nominal Status' : (telemetry.healthScore ?? 100) >= 50 ? '▲ Degraded Status' : '✖ Critical Status'}
              </span>
            </div>
            {/* circular health indicator */}
            <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-slate-200 font-outfit">{telemetry.healthScore ?? 100}%</span>
              <svg className="absolute h-full w-full transform -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.03)" strokeWidth="5" fill="transparent" />
                <circle cx="40" cy="40" r="34"
                  stroke={(telemetry.healthScore ?? 100) >= 80 ? '#10b981' : (telemetry.healthScore ?? 100) >= 50 ? '#fbbf24' : '#ef4444'}
                  strokeWidth="5" fill="transparent"
                  strokeDasharray={213}
                  strokeDashoffset={213 - (213 * (telemetry.healthScore ?? 100)) / 100}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Operational Risk Index & Satellite Status */}
          <div className="p-5 glass-panel flex flex-col gap-4">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider border-b border-white/5 pb-2.5">
              Communications &amp; Operations
            </span>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Risk Profile:</span>
              <span className={`font-bold uppercase tracking-wider px-2.5 py-0.5 rounded text-[10px] border ${telemetry.riskLevel?.toLowerCase() === 'critical' || telemetry.riskLevel?.toLowerCase() === 'high'
                ? 'bg-red-950/40 text-red-400 border-red-900/60 glow-red-premium animate-pulse'
                : telemetry.riskLevel?.toLowerCase() === 'medium' || telemetry.riskLevel?.toLowerCase() === 'moderate'
                  ? 'bg-amber-950/40 text-amber-400 border-amber-900/60'
                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60'
                }`}>{telemetry.riskLevel}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Satcom Relay:</span>
              <span className={`font-bold flex items-center gap-1.5 text-xs ${linkStatus === 'online' ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`}>
                {linkStatus === 'online' ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {linkStatus === 'online' ? 'CONNECTED' : 'SEVERED'}
              </span>
            </div>
            {queuedLogs.length > 0 && (
              <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-1 text-xs text-amber-400">
                <span className="uppercase text-[10px] font-bold">Buffered Blocks:</span>
                <span className="font-bold flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5 animate-pulse" />
                  {queuedLogs.length} PLOCKS PENDING
                </span>
              </div>
            )}
          </div>

          {/* Active Alerts List */}
          <div className="p-5 glass-panel flex-none flex flex-col min-h-[320px] h-[360px] overflow-hidden">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider border-b border-white/5 pb-2.5 mb-3 shrink-0">
              Active Warnings ({alerts.length})
            </span>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 scrollbar-thin">
              {telemetry && telemetry.healthScore < 80 && (
                <div className="p-3.5 rounded-xl border border-orange-500/30 bg-orange-950/20 text-orange-200 text-[11px] flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-orange-450 text-[10px] tracking-wider uppercase">
                    <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
                    <span>EMERGENCY NEIGHBOR TRANSIT ACTIVE</span>
                  </div>
                  {/* BUGFIX: distances corrected to verified real figures —
                      was showing 5km/9km, actual is ~3.5km/~3km. See master
                      doc §12.2 for sourcing. */}
                  <p className="font-semibold text-white">Nearest: {activeStation === 'maitri' ? 'Novolazarevskaya (Russia, 3.5 km)' : 'Progress II (Russia, 3 km)'}</p>
                  <p className="text-slate-350 leading-normal text-[10px]">RECOMMENDED ACTION: Coordinate emergency snow-cat transit to {activeStation === 'maitri' ? 'Novolazarevskaya' : 'Progress II'}.</p>
                  {/* BUGFIX: previously no way to act on this panel at all —
                      just descriptive text. This is necessarily a simulated
                      workflow (no real inter-agency API exists to integrate
                      with), but it needs a visible, honestly-labeled
                      affordance rather than nothing. */}
                  <p className="text-slate-500 text-[9px] leading-normal border-t border-orange-500/10 pt-1.5 mt-0.5">
                    Contact protocol (simulated — no live channel integrated): real Antarctic emergency coordination runs via HF/VHF radio and COMNAP mutual-aid procedures between national programs, not through this dashboard.
                  </p>
                  <button
                    onClick={handleMutualAidRequest}
                    className="mt-1 py-1.5 rounded-lg bg-orange-600/70 hover:bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    Request Mutual Aid (Simulated)
                  </button>
                  {mutualAidRequest && (
                    <div className="mt-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 px-2 py-1 text-[9px] text-emerald-300">
                      Request transmitted to {mutualAidRequest.station} at {mutualAidRequest.time}.
                    </div>
                  )}
                </div>
              )}
              {alerts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs py-8 text-center">
                  <CheckCircle className="h-7 w-7 text-emerald-500 mb-2.5 opacity-80" />
                  <span className="font-medium text-slate-350">All systems operating within nominal boundaries.</span>
                </div>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 transition-all ${a.severity === 'critical' ? 'border-red-900 bg-red-950/15 text-red-200' : 'border-amber-900 bg-amber-950/15 text-amber-200'
                    }`}>
                    <div className="flex justify-between items-center font-semibold">
                      <span className={`uppercase text-[10px] tracking-wider font-bold ${a.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                        {a.type.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] text-slate-500">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">{a.message}</p>
                    <button
                      onClick={() => resolveAlert(a.id)}
                      className="self-end text-[10px] font-bold bg-slate-900 hover:bg-slate-800 hover:text-indigo-400 border border-white/5 rounded-lg px-3 py-1 text-slate-400 transition-colors"
                    >
                      Dismiss Alert
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Event Logs ticker */}
          <div className="p-5 glass-panel h-[170px] flex flex-col overflow-hidden shrink-0">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider border-b border-white/5 pb-2.5 mb-2.5">
              Live Console Output
            </span>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-emerald-500/90 scrollbar-thin flex flex-col gap-1.5 pr-1 leading-relaxed">
              {systemEvents.length === 0 ? (
                <span className="text-slate-650 italic">&gt; Awaiting connection telemetry...</span>
              ) : (
                systemEvents.map((log, idx) => (
                  <div key={idx} className="truncate hover:text-indigo-400 transition-colors select-all">&gt; {log}</div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Center / Right Main Dashboard View */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 scrollbar-thin">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GIS Overview Map container */}
            <div className="glass-panel p-5 flex flex-col gap-4 h-80">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Geospatial Array Map
                </span>
                <button
                  onClick={() => setActiveTab('gis-map')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors uppercase tracking-wider flex items-center gap-1"
                >
                  Full Map <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 relative rounded-xl overflow-hidden border border-white/5 shadow-inner">
                <StationMap
                  activeStation={activeStation}
                  onStationSelect={(s) => {
                    setActiveStation(s);
                    addSystemLog(`Overview Focus Station switched to: ${s}`);
                  }}
                  maitriHealth={activeStation === 'maitri' ? telemetry.healthScore : 94}
                  bharatiHealth={activeStation === 'bharati' ? telemetry.healthScore : 92}
                  emergencyRouteActive={emergencyRouteActive || telemetry.healthScore < 80}
                />
              </div>
            </div>

            {/* Quick Climate Summary */}
            <div className={`glass-panel p-5 flex flex-col gap-4 h-80 transition-all duration-300 ${linkStatus === 'offline' ? 'opacity-65 saturate-[30%]' : ''}`}>
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Meteorological Overview
                </span>
                {linkStatus === 'offline' && (
                  <span className="text-[9px] text-amber-500 font-mono animate-pulse">
                    OFFLINE (Synced {secondsSinceSync}s ago)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/20 flex flex-col justify-center gap-1">
                  <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Outside Temp</span>
                  <span className="text-2xl font-extrabold text-white font-outfit">{telemetry.weather.temp.toFixed(2)}°C</span>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/20 flex flex-col justify-center gap-1">
                  <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Wind Speed ({telemetry.weather.windDir})</span>
                  <span className="text-2xl font-extrabold text-white font-outfit">{telemetry.weather.windSpeed.toFixed(2)} km/h</span>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/20 flex flex-col justify-center gap-1">
                  <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Solar Radiation</span>
                  <span className="text-2xl font-extrabold text-white font-outfit">{isNight ? '0' : '285'} W/m²</span>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/20 flex flex-col justify-center gap-1">
                  <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Blizzard Storm Risk</span>
                  <span className={`text-2xl font-extrabold font-outfit ${telemetry.weather.risk > 50 ? 'text-red-400' : 'text-white'}`}>{telemetry.weather.risk}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Matrix Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Power grid box */}
            <div className={`p-5 glass-panel flex flex-col gap-4 transition-all duration-300 ${linkStatus === 'offline' ? 'opacity-65 saturate-[30%]' : ''}`}>
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Power Grid</span>
                <Cpu className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Demand:</span>
                  <span className="font-bold text-slate-200">{telemetry.powerGrid.load} kW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Generation:</span>
                  <span className="font-bold text-emerald-400">{telemetry.powerGrid.capacity} kW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Battery Buffer:</span>
                  <span className="font-bold text-slate-200">{Math.round(telemetry.powerGrid.batterySoc)}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(telemetry.powerGrid.load / telemetry.powerGrid.capacity) * 100}%` }}></div>
                </div>
              </div>
            </div>

            {/* Sab Fuel reserves */}
            <div className={`p-5 glass-panel flex flex-col gap-4 transition-all duration-300 ${linkStatus === 'offline' ? 'opacity-65 saturate-[30%]' : ''}`}>
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SAB Fuel Depot</span>
                <Droplet className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume:</span>
                  <span className="font-bold text-slate-200">{Math.round(telemetry.resources.fuel)} L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Capacity:</span>
                  <span className="font-bold text-slate-200">{activeStation === 'maitri' ? '50,000 L' : '60,000 L'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Autonomy Autarky:</span>
                  <span className={`font-bold ${telemetry.resources.fuelDays < 15 ? 'text-red-400' : 'text-slate-200'}`}>{telemetry.resources.fuelDays} Days</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(telemetry.resources.fuel / (activeStation === 'maitri' ? 50000 : 60000)) * 100}%` }}></div>
                </div>
              </div>
            </div>

            {/* Life support resources */}
            <div className={`p-5 glass-panel flex flex-col gap-4 transition-all duration-300 ${linkStatus === 'offline' ? 'opacity-65 saturate-[30%]' : ''}`}>
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Potable Water</span>
                <Droplet className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume:</span>
                  <span className="font-bold text-slate-200">{Math.round(telemetry.resources.water)} L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Capacity:</span>
                  <span className="font-bold text-slate-200">{activeStation === 'maitri' ? '15,000 L' : '18,000 L'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Autonomy Autarky:</span>
                  <span className="font-bold text-slate-200">{telemetry.resources.waterDays} Days</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(telemetry.resources.water / (activeStation === 'maitri' ? 15000 : 18000)) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGisMap = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 min-h-0 w-full bg-[#050811] p-4 md:p-6 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-4 md:gap-6 min-h-full">
          <section className="glass-panel rounded-2xl p-5 text-slate-200 shadow-2xl flex flex-col gap-4 self-start">
            <div className="border-b border-white/5 pb-3">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-2">
                <Globe className="h-4 w-4 animate-pulse" />
                GIS Coordinates
              </span>
              <h4 className="text-sm font-bold font-outfit text-white uppercase mt-0.5">Antarctic Stations</h4>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Maitri Station</span>
                <div className="text-slate-200 text-xs mt-0.5">Coordinates: <strong className="text-slate-100 font-mono">70.767° S, 11.733° E</strong></div>
                <div className="text-slate-400 text-[11px] mt-0.5">Elevation: 117m above sea level</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Bharati Station</span>
                <div className="text-slate-200 text-xs mt-0.5">Coordinates: <strong className="text-slate-100 font-mono">69.412° S, 76.195° E</strong></div>
                <div className="text-slate-400 text-[11px] mt-0.5">Elevation: 35m above sea level</div>
              </div>

              <div className="text-xs text-slate-400 border-t border-white/5 pt-3 mt-1 leading-relaxed">
                <strong>Relay Distance:</strong> ~3,000 km across ice shelf. High-frequency line-of-sight propagation unavailable; routing telemetry links through satellite relay loops.
              </div>
            </div>
          </section>

          <section className="min-h-[420px] h-[65vh] xl:h-auto xl:min-h-[620px] min-w-0">
            <StationMap
              activeStation={activeStation}
              onStationSelect={(s) => {
                setActiveStation(s);
                addSystemLog(`Map Focus Switch: ${s}`);
              }}
              maitriHealth={activeStation === 'maitri' ? telemetry.healthScore : 94}
              bharatiHealth={activeStation === 'bharati' ? telemetry.healthScore : 92}
            />
          </section>
        </div>
      </div>
    );
  };

  const render3DTwin = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-h-0 relative">
        {/* WebGL 3D Twin Viewport */}
        <div className="flex-1 relative overflow-hidden bg-slate-950/15 flex flex-col min-h-[300px]">
          {emergencyMode && (
            <div className="bg-red-950/50 border-b border-red-900/50 p-2.5 px-4 text-red-400 font-medium text-xs flex items-center justify-between animate-pulse z-10 absolute top-0 left-0 right-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-bold uppercase tracking-wider text-[11px]">Emergency Load Shedding Active</span>
              </div>
            </div>
          )}
          <div className="flex-1 w-full h-full">
            <DigitalTwin3D
              telemetry={telemetry}
              selectedAssetId={selectedAsset ? selectedAsset.id : null}
              onAssetSelect={(asset) => {
                setSelectedAsset(asset);
                addSystemLog(`Inspected building node: ${asset.name}`);
              }}
              activeScenario={activeScenario}
              emergencyMode={emergencyMode}
              isNight={isNight}
            />
          </div>
        </div>

        {/* 3D Model HUD Sidebar Controls & Inspector */}
        <aside className="w-full xl:w-[360px] shrink-0 border-l border-white/5 bg-slate-950/40 p-6 flex flex-col h-full gap-5 overflow-y-auto scrollbar-thin">
          <div className="border-b border-white/5 pb-3">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Camera Control Override</span>
            <h4 className="text-sm font-bold font-outfit text-white uppercase mt-0.5">Focus Sector Glide</h4>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'gen_1', name: 'Power House G1', type: 'box', position: [0, 1.2, 3], size: [4, 2.4, 2.5], color: '#f97316', telemetryField: 'gen_1', liveStatus: telemetry.generators[0] },
              { id: 'fuel_storage', name: 'Fuel Depots', type: 'cylinder', position: [-8, 1.5, -4], size: [2.5, 3, 2.5], color: '#0ea5e9' },
              { id: 'bld_labs', name: 'Science Pods', type: 'cylinder', position: [6, 1.2, -6], size: [3.5, 2.4, 3.5], color: '#a855f7', liveStatus: telemetry.buildings.find((b: any) => b.id === 'bld_labs') },
              { id: 'bld_weather', name: 'Meteo Tower', type: 'cylinder', position: [-10, 2, 8], size: [1, 4, 1], color: '#10b981' }
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  setSelectedAsset(preset);
                  addSystemLog(`3D Camera focused on: ${preset.name}`);
                }}
                className={`p-3 border rounded-xl text-left transition-all ${selectedAsset?.id === preset.id
                  ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 glow-blue-premium'
                  : 'border-white/5 bg-slate-900/10 hover:bg-slate-900/30 text-slate-400'
                  }`}
              >
                <span className="font-bold text-[10px] block uppercase truncate">{preset.name}</span>
                <span className="text-[9px] text-slate-500 block uppercase mt-0.5">Focus Camera</span>
              </button>
            ))}
          </div>

          {/* Selected Asset details (from 3D twin or lists) */}
          {selectedAsset ? (
            <div className="p-5 border border-indigo-500/25 bg-indigo-950/10 rounded-2xl flex flex-col gap-4 glow-blue-premium mt-2">
              <div className="flex justify-between items-center border-b border-indigo-900/30 pb-2.5">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Asset Details</span>
                <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase">[Clear]</button>
              </div>
              <div>
                <h3 className="text-sm font-bold font-outfit text-white uppercase">{selectedAsset.name}</h3>
                <span className="text-[9px] text-slate-500 block uppercase mt-0.5">Asset Link Nominal</span>
              </div>
              <div className="p-3.5 bg-slate-950/90 border border-white/5 rounded-xl flex flex-col gap-2 text-xs">
                {selectedAsset.liveStatus ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-slate-450">Bus Status:</span>
                      <span className={`font-bold uppercase ${selectedAsset.liveStatus.status === 'nominal' || selectedAsset.liveStatus.status === 'running'
                        ? 'text-emerald-400'
                        : 'text-amber-500 animate-pulse'
                        }`}>{selectedAsset.liveStatus.status}</span>
                    </div>
                    {selectedAsset.liveStatus.load !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-slate-455">Power demand:</span>
                        <span className="font-bold text-slate-100">{selectedAsset.liveStatus.load} kW</span>
                      </div>
                    )}
                    {selectedAsset.liveStatus.temp !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-slate-455">Core Temp:</span>
                        <span className="font-bold text-slate-100">{Math.round(selectedAsset.liveStatus.temp)}°C</span>
                      </div>
                    )}
                    {selectedAsset.liveStatus.health !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-slate-455">Structure Health:</span>
                        <span className="font-bold text-emerald-405">{Math.round(selectedAsset.liveStatus.health)}%</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedAsset.id === 'fuel_storage' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-450">SAB Volume:</span>
                          <span className="font-bold text-slate-100">{Math.round(telemetry.resources.fuel)} L</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-450">Autonomy:</span>
                          <span className="font-bold text-emerald-400">{telemetry.resources.fuelDays} Days</span>
                        </div>
                      </>
                    )}
                    {selectedAsset.id === 'bld_weather' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-450">Wind Velocity:</span>
                          <span className="font-bold text-slate-100">{telemetry.weather.windSpeed} km/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-450">Direction:</span>
                          <span className="font-bold text-slate-100">{telemetry.weather.windDir}</span>
                        </div>
                      </>
                    )}
                    {selectedAsset.id === 'bld_warehouse' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-450">Spares Health:</span>
                          <span className="font-bold text-slate-100">{telemetry.resources.spareParts}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-450">Medical Stocks:</span>
                          <span className="font-bold text-slate-100">{telemetry.resources.medicalSupplies}%</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl border border-white/5 bg-slate-900/10 flex flex-col gap-2.5 text-center py-8 mt-2">
              <Activity className="h-6 w-6 text-slate-600 mx-auto mb-1.5 animate-pulse" />
              <span className="text-xs text-slate-400 font-medium">Select an asset from the 3D twin or preset controls to inspect detailed diagnostics.</span>
            </div>
          )}
        </aside>
      </div>
    );
  };

  const renderPower = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left 2 Cols: Schematic and Generators */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <EnergyFlowSchematic telemetry={telemetry} activeStation={activeStation} />

            {/* Generators Details */}
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                Generator Subsystem Status
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {telemetry.generators.map((gen: any) => {
                  const loadPercent = Math.round((gen.load / (activeStation === 'maitri' ? 100 : 120)) * 100);
                  return (
                    <div
                      key={gen.id}
                      className={`p-4 rounded-xl border flex flex-col gap-3.5 transition-all ${gen.status === 'offline'
                        ? 'border-red-900/40 bg-red-950/5 text-slate-500'
                        : gen.temp > 85
                          ? 'border-amber-500/50 bg-amber-950/10 glow-amber-premium'
                          : 'border-white/5 bg-slate-900/10'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-100 text-xs">{gen.name}</h4>
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono block mt-0.5">{gen.id}</span>
                        </div>
                        <span className={`p-0.5 px-2 rounded-full text-[9px] uppercase font-bold tracking-wider border ${gen.status === 'running'
                          ? 'bg-emerald-950/65 text-emerald-450 border-emerald-900/50'
                          : gen.status === 'standby'
                            ? 'bg-slate-900 text-slate-400 border-white/5'
                            : 'bg-red-955/65 text-red-400 border-red-900/50 animate-pulse'
                          }`}>
                          {gen.status}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 border-t border-white/5 pt-2.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Output Load:</span>
                          <span className="font-bold text-slate-200">{gen.load} kW ({loadPercent}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Thermal:</span>
                          <span className={`font-bold ${gen.temp > 85 ? 'text-amber-400' : 'text-slate-200'}`}>
                            {Math.round(gen.temp)}°C
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Diesel Burn:</span>
                          <span className="text-slate-350">{gen.fuelRate.toFixed(1)} L/h</span>
                        </div>
                      </div>

                      {/* progress load */}
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${loadPercent > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                          style={{ width: `${loadPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Col: Battery Buffer & ML Risk Analysis */}
          <div className="flex flex-col gap-6">
            {/* Battery storage details */}
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2.5">
                UPS Buffer Batteries
              </h3>

              <div className="flex flex-col items-center justify-center p-4 border border-white/5 rounded-xl bg-slate-900/10">
                <span className="text-[10px] text-slate-450 font-bold uppercase mb-4 tracking-wider">State of Charge (SoC)</span>
                <div className="relative flex items-center justify-center h-32 w-32">
                  <span className="text-3xl font-extrabold text-emerald-400 font-outfit">{Math.round(telemetry.powerGrid?.batterySoc ?? 100)}%</span>
                  <svg className="absolute h-full w-full transform -rotate-90">
                    <circle cx="64" cy="64" r="54" stroke="rgba(255,255,255,0.03)" strokeWidth="6" fill="transparent" />
                    <circle cx="64" cy="64" r="54" stroke="#10b981" strokeWidth="6" fill="transparent" strokeDasharray={339.3} strokeDashoffset={339.3 - (339.3 * (telemetry.powerGrid?.batterySoc ?? 100)) / 100} strokeLinecap="round" />
                  </svg>
                </div>
                {activeScenario === 'water_shortage' && (
                  <span className="text-[9px] text-amber-400 font-bold mt-3 animate-pulse tracking-wider text-center">
                    ⚡ DISCHARGING: DEFROST TRACE ACTIVE
                  </span>
                )}
                {activeScenario === 'generator_failure' && (
                  <span className="text-[9px] text-red-500 font-bold mt-3 animate-pulse tracking-wider text-center">
                    ⚠️ DISCHARGING: GEN OFFLINE BUFFER
                  </span>
                )}
                {activeScenario !== 'water_shortage' && activeScenario !== 'generator_failure' && (telemetry.powerGrid?.load > telemetry.powerGrid?.capacity) && (
                  <span className="text-[9px] text-red-400 font-bold mt-3 animate-pulse tracking-wider text-center">
                    ⚠️ DISCHARGING: GRID OVERLOAD
                  </span>
                )}
                {activeScenario === 'none' && (telemetry.powerGrid?.capacity > telemetry.powerGrid?.load) && (telemetry.powerGrid?.batterySoc < 98) && (
                  <span className="text-[9px] text-emerald-400 font-bold mt-3 tracking-wider text-center animate-pulse">
                    ▲ CHARGING SURPLUS POWER
                  </span>
                )}
                {activeScenario === 'none' && (telemetry.powerGrid?.batterySoc >= 98) && (
                  <span className="text-[9px] text-slate-500 font-bold mt-3 tracking-wider text-center">
                    ● NOMINAL FLOATING BUFFER
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 border border-white/5 rounded-xl bg-slate-900/10">
                  <span className="text-slate-450 block uppercase text-[10px] font-bold">Battery Temp</span>
                  <span className="text-sm font-bold text-slate-100 mt-0.5 block">{Math.round(telemetry.powerGrid.batteryTemp)}°C</span>
                </div>
                <div className="p-3 border border-white/5 rounded-xl bg-slate-900/10">
                  <span className="text-slate-455 block uppercase text-[10px] font-bold">Health Index</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{telemetry.powerGrid.batteryHealth}% SOH</span>
                </div>
              </div>
            </div>

            {/* Predictive wear ML */}
            <div className="glass-panel p-6 flex-1 flex flex-col gap-4">
              <div className="border-b border-white/5 pb-2.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  ML Wear Anomaly Forecast
                </span>
                <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
              </div>
              <div className="flex-1 flex flex-col gap-3 mt-1 max-h-[350px] overflow-y-auto scrollbar-thin pr-1">
                {telemetry.equipment.map((eq: any) => {
                  const barColor = eq.failureProb > 40 ? 'bg-amber-500' : 'bg-indigo-500';
                  return (
                    <div key={eq.id} className="p-3.5 border border-white/5 rounded-xl bg-slate-900/10 text-xs flex flex-col gap-2.5">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-200">{eq.name}</span>
                        <span className={eq.failureProb > 30 ? 'text-amber-400' : 'text-slate-400'}>
                          {eq.failureProb}% Risk
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-450">
                        <span>Vibration Health: {Math.round(eq.health)}%</span>
                        <span>Maint: {eq.nextMaintenance}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${eq.failureProb}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResources = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Resource levels columns */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                Station Reserve Stocks
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                {/* Diesel Storage */}
                <div className="p-4 border border-white/5 bg-slate-900/10 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200">POLAR GRADE A DIESEL</span>
                    <span className="font-bold text-indigo-400">{Math.round(telemetry.resources.fuel)} L</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(telemetry.resources.fuel / (activeStation === 'maitri' ? 50000 : 60000)) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-450 mt-1">
                    <span>Capacity: {activeStation === 'maitri' ? '50,000 L' : '60,000 L'}</span>
                    <span className={`font-semibold ${telemetry.resources.fuelDays < 15 ? 'text-red-400 font-bold animate-pulse' : 'text-slate-350'}`}>{telemetry.resources.fuelDays} Days Autonomy</span>
                  </div>
                </div>

                {/* Water Storage */}
                <div className="p-4 border border-white/5 bg-slate-900/10 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200">POTABLE GLACIAL WATER</span>
                    <span className="font-bold text-indigo-400">{Math.round(telemetry.resources.water)} L</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(telemetry.resources.water / (activeStation === 'maitri' ? 15000 : 18000)) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-450 mt-1">
                    <span>Capacity: {activeStation === 'maitri' ? '15,000 L' : '18,000 L'}</span>
                    <span>{telemetry.resources.waterDays} Days Autonomy</span>
                  </div>
                </div>

                {/* Food Rations */}
                <div className="p-4 border border-white/5 bg-slate-900/10 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200">FOOD RATIONS BUFFER</span>
                    <span className="font-bold text-indigo-400">{telemetry.resources.foodDays} Days</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(telemetry.resources.foodDays / 120) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-455 mt-1">
                    <span>Capacity: 120 Days</span>
                  </div>
                </div>

                {/* Medical stocks */}
                <div className="p-4 border border-white/5 bg-slate-900/10 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-200">MEDICAL STOCKS INTEGRITY</span>
                    <span className="font-bold text-indigo-400">{telemetry.resources.medicalSupplies}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${telemetry.resources.medicalSupplies}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-455 mt-1">
                    <span>Target Index: 90%+</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Consumption Trend */}
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                Reserves Depletion Log (30-Day History)
              </h3>

              <div className="h-64 w-full bg-slate-900/10 rounded-xl p-3 border border-white/5">
                {historyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'Outfit' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'Outfit' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(255,255,255,0.08)' }} labelStyle={{ color: '#cbd5e1' }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
                      <Area type="monotone" dataKey="fuel" name="Fuel Reserves (L)" stroke="#6366f1" fillOpacity={1} fill="url(#colorFuel)" strokeWidth={2} />
                      <Area type="monotone" dataKey="water" name="Water Reserves (L)" stroke="#10b981" fillOpacity={1} fill="url(#colorWater)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    Loading historical logistics metrics...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Spares Inventory */}
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2.5">
                Technical Spares &amp; Logistics
              </h3>

              <div className="flex flex-col gap-3.5 mt-2">
                {[
                  { name: 'Backup Batteries (LiFePO4)', val: 8, total: 10, color: 'bg-emerald-500' },
                  { name: 'Water Intake heating cables', val: 3, total: 5, color: 'bg-emerald-500' },
                  { name: 'Spare Cummins cylinder gaskets', val: 12, total: 15, color: 'bg-emerald-500' },
                  { name: 'HVAC Servo Actuators', val: 2, total: 6, color: 'bg-amber-500' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-semibold">{item.name}</span>
                      <span className="text-slate-200 font-bold">{item.val} / {item.total}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${(item.val / item.total) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEquipment = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Equipment list */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                Subsystems Diagnostic Health
              </h3>

              <div className="flex flex-col gap-3 mt-2">

                {Object.values(subsystemStates).map(eq => {
                  const isTesting = activeSelfTestId === eq.id;
                  const isJustCompleted = lastCompletedTest?.id === eq.id;

                  return (
                    <div key={eq.id} className={`p-4 border rounded-xl flex flex-col gap-3 transition-all ${isTesting ? 'border-indigo-500/80 bg-indigo-950/20 shadow-lg shadow-indigo-950/40 glow-blue-premium' : 'border-white/5 bg-slate-900/10 hover:border-indigo-500/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-3.5 w-3.5 text-indigo-400" />
                            <span className="font-semibold text-slate-100">{eq.name}</span>
                          </div>
                          <div className="flex gap-4 text-[11px] text-slate-450 mt-0.5">
                            <span>Location: <strong className="text-slate-300">{eq.location}</strong></span>
                            <span>Temp: <strong className="text-slate-300">{eq.temp}°C</strong></span>
                            <span>Vibration: <strong className="text-slate-300">{eq.vibration}</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-200">{eq.health}% Health</span>
                            <span className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 ${eq.status === 'operational' ? 'text-emerald-400' : 'text-amber-500 animate-pulse'}`}>
                              {eq.status.replace('_', ' ')}
                            </span>
                          </div>
                          <button
                            disabled={!!activeSelfTestId}
                            onClick={() => runSubsystemSelfTest(eq.id, eq.name)}
                            className={`p-2 px-4 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isTesting
                              ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse cursor-not-allowed shadow-md shadow-indigo-900/40'
                              : 'border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-600/20 text-indigo-300 bg-slate-950/80 hover:shadow-md hover:shadow-indigo-500/20'
                              }`}
                          >
                            {isTesting ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                                <span>TESTING {selfTestProgress}%</span>
                              </>
                            ) : (
                              <>
                                <Activity className="h-3.5 w-3.5 text-indigo-400" />
                                <span>Self-Test</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Active Self-Test Real-Time Diagnostic Bar */}
                      {isTesting && (
                        <div className="pt-2 border-t border-indigo-500/20 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-indigo-300">
                            <span className="flex items-center gap-1.5">
                              <Cpu className="h-3 w-3 animate-spin text-indigo-400" />
                              Running 12-Point Hardware & Sensor Sweep...
                            </span>
                            <span>{selfTestProgress}% COMPLETE</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-indigo-500/30 p-0.5">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-300 shadow-md shadow-indigo-500/50"
                              style={{ width: `${selfTestProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Completed Diagnostic Badge */}
                      {isJustCompleted && !isTesting && (
                        <div className="p-2 px-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-[10px] text-emerald-300 flex items-center justify-between font-bold animate-fadeIn">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                            DIAGNOSTIC PASSED ({lastCompletedTest.timestamp}): ACTUATORS RE-CALIBRATED TO {lastCompletedTest.health}% HEALTH
                          </span>
                          <span className="uppercase text-[9px] bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200 border border-emerald-700/50">OPERATIONAL</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Spare parts Inventory */}
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2.5">
                Critical Spare Inventory
              </h3>

              <div className="flex flex-col gap-3.5 mt-2">
                <div className="p-3.5 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Cummins Engine Gaskets</span>
                    <span className="text-slate-100 font-bold">12 units</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '80%' }}></div>
                  </div>
                </div>

                <div className="p-3.5 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">HVAC Actuator Servos</span>
                    <span className="text-slate-100 font-bold">2 units</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: '33%' }}></div>
                  </div>
                </div>

                <div className="p-3.5 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Fiber Optic Transceivers</span>
                    <span className="text-slate-100 font-bold">24 units</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '95%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEnvironment = () => {
    if (!telemetry) return null;

    // Wind chill formula
    const temp = telemetry.weather.temp;
    const wind = telemetry.weather.windSpeed;
    const windChill = (
      35.74 + 0.6215 * temp - 35.75 * Math.pow(wind, 0.16) + 0.4275 * temp * Math.pow(wind, 0.16)
    ).toFixed(2);

    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Climate Indicators */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                Meteorological Telemetry Sensor Nodes
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div className="p-4 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Outside Temp</span>
                  <span className="text-2xl font-extrabold text-white font-outfit">{temp.toFixed(2)}°C</span>
                  <span className="text-[10px] text-slate-500 uppercase mt-0.5">Chill: {windChill}°C</span>
                </div>

                <div className="p-4 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Wind Velocity</span>
                  <span className="text-2xl font-extrabold text-white font-outfit">{wind.toFixed(2)} km/h</span>
                  <span className="text-[10px] text-slate-500 uppercase mt-0.5">Heading: {telemetry.weather.windDir}</span>
                </div>

                <div className="p-4 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Solar Radiation</span>
                  <span className="text-2xl font-extrabold text-white font-outfit">{isNight ? '0' : '285'} W/m²</span>
                  <span className="text-[10px] text-slate-500 uppercase mt-0.5">{isNight ? 'POLAR NIGHT' : 'NOMINAL'}</span>
                </div>

                <div className="p-4 border border-white/5 rounded-xl bg-slate-900/10 flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Ice Shelf Drift</span>
                  <span className="text-2xl font-extrabold text-white font-outfit">0.04 mm/h</span>
                  <span className="text-[10px] text-slate-500 uppercase mt-0.5">Offset: NNE</span>
                </div>
              </div>
            </div>

            {/* Microclimate logs */}
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                Log entries &amp; Environmental Observations
              </h3>

              <div className="flex flex-col gap-3 max-h-80 overflow-y-auto scrollbar-thin pr-1">
                {[
                  { id: 1, time: '14:22:05', type: 'Wind Gust', val: 'Wind gust clocked at 104 km/h; heating elements on Comms dish verified working.' },
                  { id: 2, time: '10:15:00', type: 'Glacial Shift', val: 'Seismic drift sensor #4 triggers minor GPS adjustment. Drift rate remains nominal.' },
                  { id: 3, time: '06:00:12', type: 'Intake Melt', val: 'Priyadarshini lake ice thickness measured at 2.4 meters. Heating line current stable.' }
                ].map(item => (
                  <div key={item.id} className="p-3.5 border border-white/5 rounded-xl bg-slate-900/10 text-xs">
                    <div className="flex justify-between font-semibold text-slate-350 border-b border-white/5 pb-2 mb-2">
                      <span>[{item.time}] {item.type}</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Sensor log</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Directional Compass display */}
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col items-center justify-center gap-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2.5 w-full text-center">
                Wind Direction Vector
              </h3>

              <div className="relative h-44 w-44 rounded-full border border-white/10 flex items-center justify-center bg-slate-900/20 shadow-inner">
                <span className="absolute top-2 text-[10px] text-slate-500 font-bold">N</span>
                <span className="absolute bottom-2 text-[10px] text-slate-500 font-bold">S</span>
                <span className="absolute left-2 text-[10px] text-slate-500 font-bold">W</span>
                <span className="absolute right-2 text-[10px] text-slate-500 font-bold">E</span>

                {/* Needle indicator */}
                <div
                  className="h-full w-1 relative flex items-center justify-center transition-transform duration-1000"
                  style={{
                    transform: `rotate(${telemetry.weather.windDir === 'N' ? 0 :
                      telemetry.weather.windDir === 'NE' ? 45 :
                        telemetry.weather.windDir === 'E' ? 90 :
                          telemetry.weather.windDir === 'SE' ? 135 :
                            telemetry.weather.windDir === 'S' ? 180 :
                              telemetry.weather.windDir === 'SW' ? 225 :
                                telemetry.weather.windDir === 'W' ? 270 : 315
                      }deg)`
                  }}
                >
                  <div className="h-20 w-1 bg-red-500 absolute top-2 rounded-full glow-red-premium shadow-red-500/50"></div>
                  <div className="h-20 w-1 bg-slate-650 absolute bottom-2 rounded-full"></div>
                </div>
              </div>

              <div className="text-xs text-slate-350 mt-1 font-semibold text-center leading-relaxed">
                Heading: <strong className="text-indigo-400 font-outfit text-sm font-bold">{telemetry.weather.windDir}</strong><br />
                Velocity: {telemetry.weather.windSpeed} km/h
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSimulation = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Simulation controls */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                Antarctic Stress Simulation Deck
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {[
                  { id: 'snowstorm', label: 'Category 5 Blizzard' },
                  { id: 'generator_failure', label: 'Generator G1 Trip' },
                  { id: 'water_shortage', label: 'Water Line Freeze' },
                  { id: 'fuel_shortage', label: 'Fuel Depot Leak' }
                ].map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => runScenario(sc.id)}
                    className={`p-3.5 py-4 border rounded-xl text-center transition-all ${activeScenario === sc.id
                      ? 'border-red-500 bg-red-950/20 text-red-400 glow-red-premium animate-pulse'
                      : 'border-white/5 bg-slate-900/10 hover:bg-slate-900/30 text-slate-400'
                      }`}
                  >
                    <span className="font-bold text-xs uppercase block truncate">{sc.label}</span>
                  </button>
                ))}
              </div>

              {activeScenario !== 'none' && (
                <div className="mt-3 flex justify-between items-center p-3.5 border border-red-900/40 bg-red-950/15 rounded-xl">
                  <span className="text-red-400 font-bold uppercase text-xs">Active Scenario: {activeScenario.replace('_', ' ')}</span>
                  <button
                    onClick={resetScenario}
                    className="p-1 px-3 border border-red-900/30 hover:border-red-500 hover:text-red-400 bg-slate-950 rounded-lg text-xs uppercase font-bold transition-all"
                  >
                    Restore Baseline
                  </button>
                </div>
              )}
            </div>

            {/* Simulation Prognosis curves */}
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
                7-Day Prognosis Projected Forecast
              </h3>

              <div className="h-64 w-full bg-slate-900/10 rounded-xl p-3 border border-white/5">
                {forecastTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="day" tickFormatter={(v) => `Day ${v + 1}`} stroke="#64748b" style={{ fontSize: 10, fontFamily: 'Outfit' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'Outfit' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(255,255,255,0.08)' }} labelStyle={{ color: '#cbd5e1' }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
                      <Line type="monotone" dataKey="healthScore" name="Station Health" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="battery" name="UPS Battery SoC" stroke="#6366f1" strokeWidth={2} />
                      <Line type="monotone" dataKey="power" name="Grid Load (kW)" stroke="#f59e0b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center px-6 leading-relaxed font-semibold">
                    Select and deploy one of the What-If simulation scenarios above to generate predictive operations forecast timelines.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Custom Configuration */}
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2.5">
                Interactive Environment Controls
              </h3>

              <div className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Wind Velocity Limit</span>
                    <span className="text-indigo-400">{telemetry.weather.windSpeed} km/h</span>
                  </div>
                  <input type="range" min="0" max="150" value={telemetry.weather.windSpeed} disabled className="accent-indigo-500 w-full" />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Generator load baseline</span>
                    <span className="text-indigo-400">{telemetry.powerGrid.load} kW</span>
                  </div>
                  <input type="range" min="40" max="300" value={telemetry.powerGrid.load} disabled className="accent-indigo-500 w-full" />
                </div>

                <div className="text-xs text-slate-400 border-t border-white/5 pt-3 leading-relaxed mt-1">
                  Manual environmental parameter sliders are locked under administrative operations mode. Deploy What-If cards to simulate load responses.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAiCommander = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium flex flex-col min-h-0">
        <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0">

          {/* Main Chat Interface */}
          <div className="flex-1 glass-panel flex flex-col min-h-[350px] overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-slate-900/20 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider font-outfit">
                  Polaris AI Copilot Command advisor
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                Local telemetry reasoning
              </span>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 scrollbar-thin text-xs leading-relaxed">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex flex-col gap-1 max-w-[85%] ${m.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
                  }`}>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">{m.sender === 'user' ? 'You' : 'Polaris Copilot'} • {m.time}</span>
                  <div className={`p-3.5 rounded-2xl text-slate-200 border ${m.sender === 'user'
                    ? 'border-indigo-500/20 bg-indigo-600/10'
                    : 'border-white/5 bg-slate-900/30'
                    }`}>
                    {m.text.split('\n').map((line, i) => (
                      <p key={i} className="mb-1.5">{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              {copilotLoading && (
                <div className="self-start flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Copilot - Analyzing parameters</span>
                  <div className="p-3.5 rounded-2xl border border-white/5 bg-slate-900/10 text-slate-450 animate-pulse">
                    Aggregating micro-grid indexes. Evaluating generator temperatures...
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-white/5 bg-slate-950/80 shrink-0 flex gap-2.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Query copilot about reserve capacities, cooling loop temperatures, or diagnostic recommendations..."
                className="flex-1 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={() => handleSendChatMessage()}
                className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white rounded-xl px-5 py-2.5 transition-colors uppercase shrink-0 font-outfit"
              >
                Query
              </button>
            </div>
          </div>

          {/* Right Column: preset questions */}
          <div className="w-full xl:w-80 shrink-0 flex flex-col gap-4 text-xs">
            <div className="glass-panel p-5 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2.5">
                Logistics &amp; Status Presets
              </h3>

              <div className="flex flex-col gap-2 mt-1">
                {[
                  "What is our current station status?",
                  "Recommend emergency actions",
                  "What is the backup battery level?",
                  "Show details on generator core temp"
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendChatMessage(q)}
                    className="p-3 border border-white/5 rounded-xl text-left bg-slate-900/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 text-slate-350 text-[11px] hover:text-indigo-400 transition-all font-semibold"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium">
        {telemetry.healthScore < 80 && (
          <div className="p-4 rounded-xl border border-orange-500/50 bg-orange-950/20 text-orange-200 text-xs flex flex-col gap-1.5 mb-6 animate-pulse">
            <div className="flex items-center gap-1.5 font-bold text-orange-400 text-[10px] tracking-wider uppercase">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              <span>CRITICAL ADVISORY: EMERGENCY NEIGHBOR RESCUE COORDINATION ACTIVE</span>
            </div>
            <p className="font-semibold text-white">Nearest Station: {activeStation === 'maitri' ? 'Novolazarevskaya (Russia, 3.5 km away)' : 'Progress II (Russia, 3 km away)'}</p>
            <p className="text-slate-350 leading-normal text-[11px]">RECOMMENDED ACTION: Coordinate emergency snow-cat transit to {activeStation === 'maitri' ? 'Novolazarevskaya' : 'Progress II'}.</p>
            <p className="text-slate-500 text-[10px] leading-normal border-t border-orange-500/10 pt-1.5 mt-0.5">
              Contact protocol (simulated — no live channel integrated): real Antarctic emergency coordination runs via HF/VHF radio and COMNAP mutual-aid procedures between national programs, not through this dashboard.
            </p>
            <button
              onClick={handleMutualAidRequest}
              className="mt-1 py-1.5 rounded-lg bg-orange-600/70 hover:bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider transition-colors self-start px-4"
            >
              Request Mutual Aid (Simulated)
            </button>
            {mutualAidRequest && (
              <div className="mt-1 rounded-md border border-emerald-500/30 bg-emerald-950/20 px-2 py-1 text-[9px] text-emerald-300">
                Request transmitted to {mutualAidRequest.station} at {mutualAidRequest.time}.
              </div>
            )}
          </div>
        )}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white border-b border-white/5 pb-3">
            Active Anomaly Logs &amp; Alarms
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs leading-relaxed">
              <thead>
                <tr className="border-b border-white/5 text-slate-450 uppercase text-[10px] font-bold">
                  <th className="pb-3.5 pr-4">Anomaly ID</th>
                  <th className="pb-3.5 pr-4">Type</th>
                  <th className="pb-3.5 pr-4">Severity</th>
                  <th className="pb-3.5 pr-4">Message</th>
                  <th className="pb-3.5 pr-4">Timestamp</th>
                  <th className="pb-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-semibold">
                      No active alarm alerts logged. Uplink connection status normal.
                    </td>
                  </tr>
                ) : (
                  alerts.map((a) => (
                    <tr key={a.id} className="hover:bg-white/3 transition-colors">
                      <td className="py-4 pr-4 font-mono text-[11px] text-slate-400">{a.id}</td>
                      <td className="py-4 pr-4 uppercase text-slate-200 font-semibold">{a.type.replace('_', ' ')}</td>
                      <td className="py-4 pr-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${a.severity === 'critical'
                          ? 'bg-red-950/50 text-red-400 border-red-900/50 glow-red-premium'
                          : 'bg-amber-950/50 text-amber-400 border-amber-900/50 glow-amber-premium'
                          }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-slate-300 max-w-xs truncate" title={a.message}>{a.message}</td>
                      <td className="py-4 pr-4 text-slate-450">{new Date(a.timestamp).toLocaleTimeString()}</td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => resolveAlert(a.id)}
                          className="bg-slate-900 hover:bg-slate-800 hover:text-indigo-400 border border-white/10 rounded-lg px-3 py-1 text-xs text-slate-400 font-bold transition-all uppercase"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    if (!telemetry) return null;
    return (
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin bg-grid-premium">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold font-outfit uppercase tracking-wider text-white">
              Operations Archive reports
            </h3>

            <button
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 font-bold text-xs text-white rounded-xl px-4 py-2.5 transition-all uppercase flex items-center gap-1.5 font-outfit"
            >
              {reportLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {reportLoading ? 'COMPILING REPORT...' : 'COMPILE DAILY MEMO'}
            </button>
          </div>

          {dailyReport ? (
            <div className="glass-panel p-8 flex flex-col gap-6 shadow-2xl relative text-slate-350 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">

              {/* Report Header */}
              <div className="border-b border-white/10 pb-5 flex justify-between items-start print:border-black">
                <div>
                  <h1 className="text-base font-extrabold tracking-widest text-white uppercase font-outfit print:text-black">
                    POLARIS LOGISTICS SUMMARY MEMO
                  </h1>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 block print:text-slate-600">
                    Station: {dailyReport.stationName} Base System
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-indigo-400 print:text-black">{dailyReport.date}</span>
                  <div className="text-[8px] text-slate-550 uppercase tracking-widest mt-1">ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
                </div>
              </div>

              {/* Status matrix */}
              <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-5 print:border-black text-xs">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Integrity Score</span>
                  <div className="text-base font-bold text-slate-200 mt-1 print:text-black">{dailyReport.healthScore}/100</div>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Operations Risk</span>
                  <div className="text-base font-bold text-slate-200 mt-1 uppercase print:text-black">{dailyReport.riskLevel}</div>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Active Warnings</span>
                  <div className="text-base font-bold text-slate-200 mt-1 print:text-black">{dailyReport.alertsCount} alerts</div>
                </div>
              </div>

              {/* Fuel and water Autonomy */}
              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-5 print:border-black text-xs">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Diesel Reserve Autonomy</span>
                  <div className="text-xs font-bold text-slate-200 mt-1 print:text-black">{dailyReport.fuelDays} Days</div>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Potable Water Autonomy</span>
                  <div className="text-xs font-bold text-slate-200 mt-1 print:text-black">{dailyReport.waterDays} Days</div>
                </div>
              </div>

              {/* Critical issues */}
              <div className="text-xs">
                <span className="text-[9px] text-slate-500 uppercase font-bold block mb-2 tracking-wider">Logged Critical Incidents</span>
                {dailyReport.criticalIssues && dailyReport.criticalIssues.length > 0 ? (
                  <ul className="list-disc pl-4 text-slate-400 flex flex-col gap-1 print:text-slate-800">
                    {dailyReport.criticalIssues.map((issue: string, idx: number) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-500 italic">No anomalies detected during report cycle.</div>
                )}
              </div>

              {/* AI advisor recommendations */}
              <div className="text-xs">
                <span className="text-[9px] text-slate-500 uppercase font-bold block mb-2 tracking-wider">Copilot Advisory Directives</span>
                {dailyReport.recommendations && dailyReport.recommendations.length > 0 ? (
                  <ul className="list-decimal pl-4 text-slate-400 flex flex-col gap-1.5 print:text-slate-850">
                    {dailyReport.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="italic">&ldquo;{rec}&rdquo;</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-500 italic">Awaiting AI log synthesis.</div>
                )}
              </div>

              {/* print footer */}
              <div className="border-t border-white/5 pt-5 mt-4 flex justify-between items-center print:border-black text-[10px]">
                <span className="text-slate-600 print:text-slate-500">POLARIS CONTROL SYSTEMS GROUP • HASH SHA-256</span>
                <span className="text-slate-400 border-b border-white/10 pb-1 w-36 text-center print:text-black">Officer Signature</span>
              </div>

              {/* Control triggers */}
              <div className="mt-4 flex justify-end gap-3 print:hidden">
                <button
                  onClick={printReport}
                  className="bg-slate-900 hover:bg-slate-800 hover:text-indigo-400 border border-white/10 rounded-xl px-4 py-2 font-bold transition-all uppercase text-xs flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Print Memo
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 border border-white/5 bg-slate-900/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-center text-slate-500 py-16">
              <FileText className="h-9 w-9 text-slate-700 mb-1.5 animate-pulse" />
              <span className="font-semibold text-slate-450 text-sm">No operational reports generated for current rotation cycle.</span>
              <span className="text-xs text-slate-500 max-w-sm">Click Compile above to aggregate station metrics into formal memo format.</span>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex font-jakarta select-none transition-colors duration-500 relative ${emergencyMode ? 'bg-[#0f0404]' : 'bg-[#050811]'
      }`}>
      {/* App-Wide Emergency Hazard Vignette & Pulsing Border */}
      {emergencyMode && (
        <div className="fixed inset-0 border-4 border-red-600/50 pointer-events-none z-50 animate-pulse shadow-[inset_0_0_90px_rgba(239,68,68,0.3)]"></div>
      )}

      {/* 1. LEFT SIDEBAR NAVIGATION */}
      <aside className="w-72 shrink-0 border-r border-white/5 bg-[#060914] flex flex-col h-screen select-none z-30">
        {/* Logo / Title Area */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="relative flex items-center justify-center p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/15 glow-blue-premium">
            <Compass className="h-6 w-6 animate-spin text-indigo-400" style={{ animationDuration: '10s' }} />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wider text-white font-outfit flex items-center gap-1.5 uppercase">
              Polaris
            </h1>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-semibold">Command Center</span>
          </div>
        </div>

        {/* Main Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 scrollbar-thin">
          {[
            { id: 'overview', label: 'Mission Control', icon: Compass },
            { id: 'gis-map', label: 'Antarctic GIS Map', icon: Globe },
            { id: '3d-twin', label: '3D Digital Twin', icon: Activity },
            { id: 'power', label: 'Power Grid', icon: Cpu },
            { id: 'resources', label: 'Resources Inventory', icon: Database },
            { id: 'equipment', label: 'Mechanical Subsystems', icon: Wrench },
            { id: 'environment', label: 'Environment Logs', icon: Wind },
            { id: 'simulation', label: 'Simulation Deck', icon: Play },
            { id: 'ai-commander', label: 'AI Copilot Advisor', icon: Sparkles },
            { id: 'alerts', label: 'Anomaly Warnings', icon: ShieldAlert },
            { id: 'reports', label: 'Reports & Memo', icon: FileText }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  addSystemLog(`Navigated to: ${tab.label}`);
                }}
                className={`w-full flex items-center gap-3.5 p-3 px-4 rounded-xl border transition-all text-xs font-semibold text-left ${isActive
                  ? 'border-indigo-500/20 bg-indigo-950/20 text-indigo-400 glow-blue-premium border-l-2 border-l-indigo-500'
                  : 'border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.id === 'alerts' && alerts.length > 0 && (
                  <span className="ml-auto bg-red-650 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse shrink-0">
                    {alerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-white/5 bg-[#04060d]/65 flex flex-col gap-3.5">
          {/* Satellite Link */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1 border-b border-white/5 pb-2 mb-0.5">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <span>Relay Link Override</span>
                <span className={syncing ? 'text-amber-400 font-bold animate-pulse' : linkStatus === 'online' ? 'text-emerald-400' : 'text-red-500'}>
                  {syncing ? 'SYNCING...' : linkStatus === 'online' ? 'CONNECTED' : 'OFFLINE'}
                </span>
              </div>
              {linkStatus === 'online' && (
                <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                  <span>Bandwidth: <span className="text-sky-400 uppercase font-bold">{linkTier}</span></span>
                  <span>Latency: <span className="text-sky-400 font-bold">{rtt}ms</span></span>
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`${BACKEND_URL}/api/link/toggle`, { method: 'POST' });
                  const data = await res.json();
                  addSystemLog(`Manual Link Override: Satellite connection ${data.isConnected ? 'restored' : 'severed'}.`);
                  if (data.isConnected) {
                    setTimeout(() => {
                      addSystemLog("Uplink restored: Initiating automated MQTT drain sequence.");
                    }, 800);
                  }
                } catch (err) {
                  addSystemLog("Failed to contact satellite link controller.");
                }
              }}
              className={`w-full py-2 border rounded-xl flex items-center justify-center gap-1.5 transition-all text-[11px] font-bold ${linkStatus === 'online'
                ? 'border-emerald-950 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40'
                : 'border-red-900/60 bg-red-955/20 text-red-500 hover:bg-red-955/40 animate-glow-pulse-red'
                }`}
            >
              {linkStatus === 'online' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span>{linkStatus === 'online' ? 'DISCONNECT UPLINK' : 'ESTABLISH UPLINK'}</span>
            </button>
            {queuedLogs.length > 0 && (
              <div className="text-[10px] text-amber-500 flex items-center justify-between border-t border-white/5 pt-2 mt-0.5">
                <span>Buffered log blocks:</span>
                <span className="font-bold">{queuedLogs.length} logs</span>
              </div>
            )}
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-2 gap-2 mt-1 border-t border-white/5 pt-3">
            <button
              onClick={() => {
                const nextNight = !isNight;
                setIsNight(nextNight);
                addSystemLog(`Environment lighting set to: ${nextNight ? 'POLAR NIGHT' : 'POLAR DAY'}`);
              }}
              className={`py-2 border rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${isNight
                ? 'border-indigo-950 bg-indigo-950/20 text-indigo-400 hover:bg-indigo-950/40'
                : 'border-amber-950 bg-amber-955/20 text-amber-500 hover:bg-amber-955/40'
                }`}
              title="Toggle Polar Day / Polar Night"
            >
              <span>{isNight ? '☾ Night' : '☼ Day'}</span>
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`py-2 border rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${soundEnabled
                ? 'border-indigo-950 bg-indigo-950/20 text-indigo-400 hover:bg-indigo-950/40'
                : 'border-white/5 bg-slate-900/10 text-slate-500 hover:bg-slate-900/30'
                }`}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span>{soundEnabled ? 'Mute' : 'Audio'}</span>
            </button>
          </div>

          {/* Time Sync Clock */}
          <div className="text-center border-t border-white/5 pt-3 mt-1">
            <span className="text-sm font-bold text-indigo-400 block tracking-wider font-outfit">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
            </span>
            <span className="text-[8px] text-slate-500 uppercase tracking-widest block mt-1">Polar Sync clock</span>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN PANEL */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Status Bar */}
        <header className={`border-b px-8 py-4 flex items-center justify-between gap-4 backdrop-blur-md z-20 shrink-0 ${emergencyMode ? 'border-red-950/60 bg-[#150606]/85' : 'border-white/5 bg-[#060a14]/85'
          }`}>
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-bold text-white uppercase tracking-wider text-sm font-outfit">
                {activeTab.replace('-', ' ').toUpperCase()}
              </h2>
              <span className="text-[10px] text-slate-500 tracking-wider block mt-0.5 uppercase">
                Station: {activeStation} | Location: {activeStation === 'maitri' ? '70.767° S, 11.733° E' : '69.412° S, 76.195° E'}
              </span>
            </div>

            {/* Station Selector */}
            <div className="flex items-center gap-1 bg-slate-900/60 border border-white/5 rounded-full p-1 ml-4">
              <button
                onClick={() => { setActiveStation('maitri'); addSystemLog("Focus changed to Maitri Station."); }}
                className={`p-1 px-4 rounded-full uppercase text-[10px] tracking-wider font-bold transition-all ${activeStation === 'maitri'
                  ? (emergencyMode ? 'bg-red-700 text-white' : 'bg-indigo-600 text-white')
                  : 'text-slate-450 hover:text-slate-200'
                  }`}
              >
                Maitri
              </button>
              <button
                onClick={() => { setActiveStation('bharati'); addSystemLog("Focus changed to Bharati Station."); }}
                className={`p-1 px-4 rounded-full uppercase text-[10px] tracking-wider font-bold transition-all ${activeStation === 'bharati'
                  ? (emergencyMode ? 'bg-red-700 text-white' : 'bg-indigo-600 text-white')
                  : 'text-slate-450 hover:text-slate-200'
                  }`}
              >
                Bharati
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User Role */}
            <div className="flex items-center gap-2.5 text-slate-400">
              <User className="h-4.5 w-4.5 text-slate-500" />
              <select
                value={role}
                onChange={(e) => { setRole(e.target.value); addSystemLog(`Role set to ${e.target.value}`); }}
                className="bg-slate-900/60 border border-white/5 rounded-xl p-1 px-3 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs font-semibold"
              >
                <option>Operations Manager</option>
                <option>Maintenance Engineer</option>
                <option>Scientist</option>
                <option>Administrator</option>
              </select>
            </div>

            {/* Automated Emergency Mode Status Banner */}
            <div
              className={`p-2 px-4 border rounded-xl font-bold transition-all uppercase tracking-wider text-[10px] flex items-center gap-2 ${emergencyMode
                ? 'bg-red-950/80 text-red-300 border-red-500/80 glow-red-premium animate-pulse shadow-lg shadow-red-900/40'
                : 'border-emerald-950/60 bg-emerald-950/20 text-emerald-400'
                }`}
            >
              <span className={`h-2 w-2 rounded-full ${emergencyMode ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`}></span>
              <ShieldAlert className={`h-4 w-4 ${emergencyMode ? 'text-red-500 animate-bounce' : 'text-emerald-400'}`} />
              <span>{emergencyMode ? 'EMERGENCY PROTOCOL ENGAGED (AUTO)' : 'SYSTEM STATUS: NOMINAL'}</span>
            </div>
          </div>
        </header>

        {/* Global Emergency Status Hazard Bar */}
        {emergencyMode && (
          <div className="bg-red-950/90 border-b border-red-900/80 p-2.5 px-6 text-red-300 font-medium text-xs flex items-center justify-between animate-pulse z-30 shrink-0 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-red-500 animate-bounce shrink-0" />
              <span className="font-extrabold font-outfit uppercase tracking-widest text-[11px] text-white">
                CRITICAL EMERGENCY LOCKDOWN: AUTOMATIC AUXILIARY LOAD SHEDDING ACTIVE
              </span>
              <span className="text-[10px] bg-red-900/60 px-2.5 py-0.5 rounded-full text-red-200 border border-red-700/50 font-mono font-bold">
                BASE HEALTH: {telemetry ? telemetry.healthScore : 35}/100
              </span>
            </div>
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-bold hidden sm:block">
              [SAFEGUARD ENGAGED: NON-ESSENTIAL AUXILIARY LOADS SHED]
            </span>
          </div>
        )}

        {/* Dynamic Screen Viewport */}
        <main className="flex-1 overflow-hidden min-h-0 relative bg-slate-950/5 flex flex-col">
          {!telemetry ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="text-base font-semibold">LOADING STATIONS TELEMETRY SYSTEMS...</p>
              <p className="text-xs text-slate-500 mt-1.5">Confirming backend satellite connection loop on port 5000</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'gis-map' && renderGisMap()}
              <div className={activeTab === '3d-twin' ? 'flex-1 flex min-h-0 w-full h-full' : 'hidden'}>
                {render3DTwin()}
              </div>
              {activeTab === 'power' && renderPower()}
              {activeTab === 'resources' && renderResources()}
              {activeTab === 'equipment' && renderEquipment()}
              {activeTab === 'environment' && renderEnvironment()}
              {activeTab === 'simulation' && renderSimulation()}
              {activeTab === 'ai-commander' && renderAiCommander()}
              {activeTab === 'alerts' && renderAlerts()}
              {activeTab === 'reports' && renderReports()}
            </>
          )}
        </main>

        {/* Footer Status Bar */}
        <footer className={`border-t px-8 py-3 text-[10px] text-slate-550 flex items-center justify-between shrink-0 ${emergencyMode ? 'border-red-950/60 bg-[#120505]/85' : 'border-white/5 bg-[#060a14]/85'
          }`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Gateway status: nominal link
            </span>
            <span className="text-slate-700">|</span>
            <span>UHF/VHF array status: operational loop</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Ping latency: 420ms (Sat Relay)</span>
            <span className="text-slate-700">|</span>
            <span className="text-indigo-400 font-bold">Polaris Control Systems</span>
          </div>
        </footer>
      </div>

      {/* 3. FLOATING DEMO GUIDE */}
      {showDemoWizard && (
        <div className="fixed bottom-16 right-6 z-50 w-80 p-5 border border-indigo-500/30 bg-[#060a13]/95 text-slate-200 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-4 glow-blue-premium">
          <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Polaris Demo Guide</span>
            <button onClick={skipDemo} className="text-slate-500 hover:text-slate-350 text-[10px] font-bold uppercase">[Dismiss]</button>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Step {demoStep} of 7</div>
            <div className="font-semibold text-xs text-slate-100 mt-1.5 leading-relaxed">
              {demoStep === 0 && "Welcome to POLARIS Mission Control. This walkthrough demonstrates full integration of the Antarctic Digital Twin."}
              {demoStep === 1 && "The telemetry feed is now active. Verify the overall station integrity scorecard, satcom link, and active warnings."}
              {demoStep === 2 && "Examine assets using the 3D twin tab. Watch the camera smoothly focus on the Power House module."}
              {demoStep === 3 && "Run a Category 5 Blizzard weather simulation. Notice drop in structural health indicators and peak power grid demand."}
              {demoStep === 4 && "Check Polaris AI Copilot. The assistant advises actionable mitigation directives based on telemetry."}
              {demoStep === 5 && "Simulate Satcom transmission failure. Watch edge log buffers queue up data points locally on the station gateway."}
              {demoStep === 6 && "Restore communication stream. Watch the system upload local logs back to the central database."}
              {demoStep === 7 && "Compile daily operations memo. Review the formatted summary report for export or hardcopy printing."}
            </div>
          </div>
          <div className="flex gap-2 border-t border-white/5 pt-3">
            <button
              onClick={advanceDemoWizard}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase text-[10px] py-2.5 rounded-xl flex items-center justify-center gap-1 transition-all font-outfit"
            >
              <span>{demoStep === 0 ? 'Start Walkthrough' : demoStep === 7 ? 'Finish & Reset' : 'Next Step'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            {demoStep > 0 && (
              <button
                onClick={skipDemo}
                className="border border-white/10 hover:border-white/20 text-slate-450 hover:text-slate-200 px-4 py-2.5 rounded-xl uppercase text-[10px] transition-all font-bold"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
