const { Aedes } = require('aedes');
const aedes = new Aedes();
const server = require('net').createServer(aedes.handle);
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const {
  baselineMaitri,
  baselineBharati,
  simulateNextState,
  calculateHealthScore,
  determineRiskLevel
} = require('./simulation');

const PORT = 1883;

// Start embedded Station Broker
aedes.listen().then(() => {
  server.listen(PORT, function () {
    console.log(`📡 Station embedded broker listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize Station MQTT Broker:', err);
});

// Create Local SQLite-like JSON store
const DB_PATH = path.join(__dirname, 'durable_store.json');
let db = { queuedLogs: [] };
try {
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } else {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }
} catch (e) {
  console.error("Failed to load durable JSON store:", e);
}

function saveDb() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Failed to write to durable JSON store:", e);
  }
}

// Connect local MQTT Client
const client = mqtt.connect(`mqtt://127.0.0.1:${PORT}`);

const activeStates = {
  maitri: JSON.parse(JSON.stringify(baselineMaitri)),
  bharati: JSON.parse(JSON.stringify(baselineBharati))
};

const activeAlerts = {
  maitri: [],
  bharati: []
};

const activeScenarios = {
  maitri: 'none',
  bharati: 'none'
};

// Manual operator overrides from the mainland's Interactive Environment
// Controls sliders (wind velocity limit / generator load baseline). Cleared
// back to {} when an operator releases a control back to automatic.
const envOverrides = {
  maitri: {},
  bharati: {}
};

// Rolling window for anomaly detection (Day 11)
const rollingWindows = {
  maitri: { genTemp: [], batteryTemp: [], fuelRate: [] },
  bharati: { genTemp: [], batteryTemp: [], fuelRate: [] }
};

// Link Quality Status Tracker (Day 5)
let currentTier = 'full';
let lastHeartbeatAckReceived = Date.now();
let rttHistory = [];

client.on('connect', () => {
  console.log('Connected to local Station Broker');

  // Subscribe to backend responses and commands
  client.subscribe('mainland/+/telemetry/ack', { qos: 1 });
  client.subscribe('mainland/+/heartbeat/ack', { qos: 0 });
  client.subscribe('mainland/+/commands', { qos: 2 });
});

client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    const parts = topic.split('/');

    // 1. Telemetry Ack
    if (topic.includes('/telemetry/ack')) {
      const { recordId } = payload;
      const index = db.queuedLogs.findIndex(l => l.recordId === recordId);
      if (index !== -1) {
        db.queuedLogs[index].synced = true;
        // Keep DB file small by purging synced logs
        db.queuedLogs.splice(index, 1);
        saveDb();
        console.log(`Synced & cleared record: ${recordId}`);
      }
    }

    // 2. Heartbeat Ack
    else if (topic.includes('/heartbeat/ack')) {
      const { publishedAt } = payload;
      const rtt = Date.now() - publishedAt;
      lastHeartbeatAckReceived = Date.now();

      rttHistory.push(rtt);
      if (rttHistory.length > 10) rttHistory.shift();

      console.log(`Heartbeat Ack. RTT: ${rtt}ms`);
    }

    // 3. Command Execution
    else if (topic.includes('/commands')) {
      const stationId = parts[1];
      const { cmdId, type, payload: cmdPayload } = payload;

      console.log(`Received command [${type}] for ${stationId}`);

      if (type === 'trigger_scenario') {
        const { scenario } = cmdPayload;
        activeScenarios[stationId] = scenario;

        if (scenario === 'none') {
          // A true restore must clear all active alerts (scenario + anomaly-based)
          // and reset the telemetry baseline. Clearing only a subset of the alert
          // list lets the health score stay artificially suppressed or recover too
          // aggressively depending on which stale values remain in memory.
          activeAlerts[stationId] = [];

          // Reset rolling anomaly baselines too — otherwise the rolling
          // window still reflects storm-period readings, and freshly-normal
          // values look like a fresh anomaly relative to that skewed history.
          rollingWindows[stationId] = { genTemp: [], batteryTemp: [], fuelRate: [] };

          // Return state parameters to baseline
          const baseline = stationId === 'maitri' ? baselineMaitri : baselineBharati;
          activeStates[stationId] = JSON.parse(JSON.stringify(baseline));
          activeStates[stationId].healthScore = calculateHealthScore(activeStates[stationId], []);
          activeStates[stationId].riskLevel = determineRiskLevel(activeStates[stationId].healthScore);
        } else {
          // Push initial scenario alert
          const scenarioAlertMessages = {
            generator_failure: { msg: 'Primary Generator failure simulated', imp: 'Power output capability reduced by 40%. Backup batteries and standby generator taking load.', act: 'Activate backup generator G3; load-shed non-critical sectors.' },
            battery_failure: { msg: 'Station Battery Array hardware faults', imp: 'Zero electrical buffering. High power fluctuation susceptibility.', act: 'Maintain generators at constant RPM. Schedule battery bus repair.' },
            fuel_shortage: { msg: 'Critical diesel fuel drop simulated', imp: 'Heating & power plant fuel exhaustion imminent. Station cold safety threat.', act: 'Engage eco heating mode; reduce lighting; call for aerial fuel drops.' },
            water_shortage: { msg: 'Utility intake line ice blockage', imp: 'Fresh water production dropped to 0. Life-support reserves dropping.', act: 'Dispatch maintenance teams to clear heating tape blockage on lake intake.' },
            snowstorm: { msg: 'Severe Category 5 Blizzard warning', imp: 'Buildings structural heating load +120%. High equipment fatigue.', act: 'Lockdown station; secure loose machinery; restrict outdoor researcher movement.' },
            comms_outage: { msg: 'SATCOM link satellite tracking alignment loss', imp: 'Total satellite telemetry transmission drop. Operations offline.', act: 'Queue station telemetry logs on local gateway SSD; align satellite tracking dish.' },
            supply_delay: { msg: 'Resupply ship delay due to pack ice', imp: 'Food, medicine, and critical generator filters depleted past safety buffers.', act: 'Implement ration schedules; maximize lab inventory recycling.' },
            equipment_overload: { msg: 'Geomagnetic research arrays drawing peak loads', imp: 'Substation power grid overload risk. Thermal trips active.', act: 'Shed modular living quarters heating loops temporarily to stabilize grid.' }
          };

          const details = scenarioAlertMessages[scenario];
          if (details) {
            // Remove duplicate
            activeAlerts[stationId] = activeAlerts[stationId].filter(a => a.id !== `sim_${scenario}`);
            activeAlerts[stationId].push({
              id: `sim_${scenario}`,
              stationId,
              timestamp: new Date().toISOString(),
              type: scenario,
              severity: 'critical',
              message: details.msg,
              impact: details.imp,
              action: details.act,
              active: true
            });
          }
        }

        // Recalculate
        activeStates[stationId].healthScore = calculateHealthScore(activeStates[stationId], activeAlerts[stationId]);
        activeStates[stationId].riskLevel = determineRiskLevel(activeStates[stationId].healthScore);
      }

      else if (type === 'env_override') {
        // { windSpeed?: number, generatorLoadBaseline?: number, clear?: boolean }
        if (cmdPayload && cmdPayload.clear) {
          envOverrides[stationId] = {};
          console.log(`Environment override cleared for ${stationId}`);
        } else {
          envOverrides[stationId] = {
            ...envOverrides[stationId],
            ...(typeof cmdPayload.windSpeed === 'number' ? { windSpeed: cmdPayload.windSpeed } : {}),
            ...(typeof cmdPayload.generatorLoadBaseline === 'number' ? { generatorLoadBaseline: cmdPayload.generatorLoadBaseline } : {}),
          };
          console.log(`Environment override updated for ${stationId}:`, envOverrides[stationId]);
        }
      }

      // Publish Ack
      client.publish(`station/${stationId}/commands/ack`, JSON.stringify({ cmdId, status: 'executed' }), { qos: 2 });
    }
  } catch (e) {
    console.error("Error processing topic message:", e);
  }
});

// Helper for rolling stats (Z-Score calculation for Anomaly Detection)
function getZScore(val, arr) {
  if (arr.length < 15) return 0; // Need baseline data
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / arr.length;
  const sqDiffs = arr.map(x => Math.pow(x - mean, 2));
  const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / sqDiffs.length;
  const stdDev = Math.sqrt(avgSqDiff);
  // BUGFIX: a near-zero (but not exactly zero) stdDev — e.g. the rolling
  // window hasn't seen real variance yet — blows up (val-mean)/stdDev to
  // an enormous, meaningless number (this produced entries like
  // "Z: 469124961185.3" in the logged report). Treat anything below a
  // small epsilon as "insufficient variance to judge," same as the
  // stdDev===0 case, rather than dividing by a near-zero denominator.
  if (stdDev < 0.05) return 0;
  return (val - mean) / stdDev;
}

// Heartbeat & Link Quality evaluation loop (every 2 seconds)
setInterval(() => {
  const now = Date.now();
  const timeSinceLastAck = now - lastHeartbeatAckReceived;

  // 1. Evaluate current tier
  if (timeSinceLastAck > 6000) {
    currentTier = 'offline';
  } else {
    // Check rolling average RTT
    const avgRtt = rttHistory.reduce((a, b) => a + b, 0) / (rttHistory.length || 1);
    if (avgRtt > 150) {
      currentTier = 'critical-only';
    } else {
      currentTier = 'full';
    }
  }

  // 2. Publish heartbeat pulses
  ['maitri', 'bharati'].forEach(id => {
    const queuedCount = db.queuedLogs.filter(l => !l.synced && l.stationId === id).length;
    client.publish(`station/${id}/heartbeat`, JSON.stringify({ publishedAt: now }), { qos: 1, retain: true });
    client.publish(`station/${id}/status`, JSON.stringify({ tier: currentTier, lastRtt: rttHistory[rttHistory.length - 1] || 0, ts: now, queuedCount }), { qos: 1, retain: true });
  });

}, 2000);

// Telemetry Physics Simulation Loop (every 3 seconds)
setInterval(() => {
  ['maitri', 'bharati'].forEach(id => {
    const scenario = activeScenarios[id];

    // Simulate step
    const nextState = simulateNextState(activeStates[id], scenario, 0.02, activeAlerts[id], envOverrides[id]);
    activeStates[id] = nextState;

    // Z-Score Anomaly detection (Day 11)
    const rolling = rollingWindows[id];
    const mainGen = nextState.generators.find(g => g.id === 'gen_1');
    const genTemp = mainGen ? mainGen.temp : 60;
    const battTemp = nextState.powerGrid.batteryTemp;
    const fuelRate = mainGen ? mainGen.fuelRate : 15;

    // Compute Z-Scores before appending
    const zGenTemp = getZScore(genTemp, rolling.genTemp);
    const zBattTemp = getZScore(battTemp, rolling.batteryTemp);
    const zFuelRate = getZScore(fuelRate, rolling.fuelRate);

    // Append to rolling lists
    rolling.genTemp.push(genTemp);
    rolling.batteryTemp.push(battTemp);
    rolling.fuelRate.push(fuelRate);
    if (rolling.genTemp.length > 30) {
      rolling.genTemp.shift();
      rolling.batteryTemp.shift();
      rolling.fuelRate.shift();
    }

    // Check if anomalous
    if (Math.abs(zGenTemp) > 3 && genTemp <= 90) {
      pushAnomalyAlert(id, 'generator', `Generator thermal anomaly detected (Z: ${zGenTemp.toFixed(1)})`, 'Vibration check recommended.');
    }
    if (Math.abs(zBattTemp) > 3 && battTemp <= 40) {
      pushAnomalyAlert(id, 'battery', `Battery cell temperature anomaly detected (Z: ${zBattTemp.toFixed(1)})`, 'Balance cell charging rates.');
    }
    if (Math.abs(zFuelRate) > 3 && fuelRate <= 25) {
      pushAnomalyAlert(id, 'fuel', `Fuel rate usage anomaly (Z: ${zFuelRate.toFixed(1)})`, 'Check line for micro-leakage.');
    }

    // Update score
    nextState.healthScore = calculateHealthScore(nextState, activeAlerts[id]);
    nextState.riskLevel = determineRiskLevel(nextState.healthScore);

    // Check if critical state needs local durability storage (Day 3)
    const isCriticalRecord = activeAlerts[id].length > 0 || nextState.healthScore < 95;

    let recordId = null;
    if (isCriticalRecord || currentTier === 'offline') {
      recordId = `${id}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      const logEntry = {
        recordId,
        stationId: id,
        timestamp: new Date().toISOString(),
        telemetry: nextState,
        alerts: activeAlerts[id].filter(a => a.active),
        synced: false
      };

      db.queuedLogs.push(logEntry);
      saveDb();
    }

    // Publish updates according to bandwidth tier
    if (currentTier !== 'offline') {
      const payload = {
        stationId: id,
        telemetry: nextState,
        alerts: activeAlerts[id].filter(a => a.active),
        activeScenario: scenario
      };

      // Under full tier, publish routine telemetry (QoS 0)
      if (currentTier === 'full') {
        client.publish(`station/${id}/telemetry/routine`, JSON.stringify(payload), { qos: 0 });
      }

      // Publish critical log entries
      if (isCriticalRecord && recordId) {
        const criticalPayload = {
          recordId,
          publishedAt: Date.now(),
          ...payload
        };
        client.publish(`station/${id}/telemetry/critical`, JSON.stringify(criticalPayload), { qos: 1 });

        // Publish discrete alerts
        payload.alerts.forEach(alert => {
          client.publish(`station/${id}/alerts`, JSON.stringify({
            recordId,
            publishedAt: Date.now(),
            alert
          }), { qos: 2 });
        });
      }
    }
  });
}, 3000);

// Auxiliary function to push anomaly alerts
function pushAnomalyAlert(stationId, type, message, action) {
  // BUGFIX: dedup was comparing full message text, which embeds the live
  // Z-score value (e.g. "Z: 5.9") — a number that's virtually never
  // identical twice. That made the dedup check always fail, so the same
  // recurring condition kept generating new alert entries indefinitely
  // (this is what produced 20+ near-identical "Generator thermal anomaly"
  // entries in the logged report). Dedup on (stationId, type) instead —
  // one active anomaly alert per condition, refreshed in place.
  const existing = activeAlerts[stationId].find(a => a.type === 'anomaly' && a.anomalySource === type);
  if (existing) {
    existing.message = message;
    existing.timestamp = new Date().toISOString();
  } else {
    const id = `anomaly_${type}_${Date.now()}`;
    activeAlerts[stationId].push({
      id,
      stationId,
      timestamp: new Date().toISOString(),
      type: 'anomaly',
      anomalySource: type,
      severity: 'warning',
      message,
      impact: 'Unusual operating conditions detected outside normal rolling standard deviations.',
      action,
      active: true,
      source: 'anomaly'
    });
  }
}

// Drain Loop for Store-and-Forward (every 5 seconds)
setInterval(() => {
  if (currentTier === 'offline') return;

  // Find unsynced logs
  const unsynced = db.queuedLogs.filter(l => !l.synced);
  if (unsynced.length === 0) return;

  console.log(`Draining ${unsynced.length} unsynced records...`);

  unsynced.forEach(log => {
    const payload = {
      recordId: log.recordId,
      publishedAt: Date.now(),
      stationId: log.stationId,
      telemetry: log.telemetry,
      alerts: log.alerts,
      activeScenario: activeScenarios[log.stationId]
    };

    // Republish to critical telemetry
    client.publish(`station/${log.stationId}/telemetry/critical`, JSON.stringify(payload), { qos: 1 });

    // Republish discrete alerts
    log.alerts.forEach(alert => {
      client.publish(`station/${log.stationId}/alerts`, JSON.stringify({
        recordId: log.recordId,
        publishedAt: Date.now(),
        alert
      }), { qos: 2 });
    });
  });
}, 5000);
