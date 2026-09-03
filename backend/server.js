const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Aedes } = require('aedes');
const aedes = new Aedes();
const serverMqtt = require('net').createServer(aedes.handle);
const mqtt = require('mqtt');
const cheerio = require('cheerio');

// Load configurations
dotenv.config();

const {
  baselineMaitri,
  baselineBharati,
  runForecastTimeline,
  calculateHealthScore,
  determineRiskLevel
} = require('./simulation');

const { askCopilot } = require('./copilot');
const { Station, Telemetry, Alert, Report, Command } = require('./models');

// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected to mainland gateway socket');
  ['maitri', 'bharati'].forEach(stationId => {
    socket.emit('telemetryUpdate', {
      stationId,
      telemetry: activeStates[stationId],
      alerts: activeAlerts[stationId].filter(a => a.active),
      activeScenario: activeScenarios[stationId]
    });
  });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/polaris';

// Middleware
app.use(cors());
app.use(express.json());

// Start embedded Mainland Broker on port 1884
aedes.listen().then(() => {
  serverMqtt.listen(1884, () => {
    console.log('⚡ Embedded Mainland MQTT Broker listening on port 1884');
  });
}).catch(err => {
  console.error('Failed to initialize Mainland MQTT Broker:', err);
});

// In-Memory Data Store (MQTT will fill these, fallback on start)
let dbConnected = false;
const activeStates = {
  maitri: JSON.parse(JSON.stringify(baselineMaitri)),
  bharati: JSON.parse(JSON.stringify(baselineBharati))
};
activeStates.maitri.healthScore = calculateHealthScore(activeStates.maitri, []);
activeStates.maitri.riskLevel = determineRiskLevel(activeStates.maitri.healthScore);
activeStates.bharati.healthScore = calculateHealthScore(activeStates.bharati, []);
activeStates.bharati.riskLevel = determineRiskLevel(activeStates.bharati.healthScore);

const activeAlerts = {
  maitri: [],
  bharati: []
};

// Keep operator-dismissed alerts out of subsequent telemetry updates.
const dismissedAlertIds = {
  maitri: new Set(),
  bharati: new Set()
};
const dismissedAlertTypes = {
  maitri: new Set(),
  bharati: new Set()
};

const rawAlertsStore = {
  maitri: [],
  bharati: []
};

const activeScenarios = {
  maitri: 'none',
  bharati: 'none'
};

const historicalDataStore = {
  maitri: [],
  bharati: []
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('⚡ Connected to MongoDB successfully.');
    dbConnected = true;
    initializeDatabaseSeed();
  })
  .catch(err => {
    console.warn('⚠️ MongoDB connection failed. Operating in in-memory mode.');
    console.warn(`Reason: ${err.message}`);
  });

// Seed Initial Station metadata in MongoDB if connected
async function initializeDatabaseSeed() {
  try {
    const count = await Station.countDocuments();
    if (count === 0) {
      await Station.insertMany([
        { id: 'maitri', name: 'Maitri Station', coordinates: [-70.7667, 11.7333], population: 28, established: '1989' },
        { id: 'bharati', name: 'Bharati Station', coordinates: [-69.4082, 76.1963], population: 32, established: '2012' }
      ]);
      console.log('Seed: Created default station structures.');
    }
  } catch (err) {
    console.error('Failed to seed database:', err);
  }
}

// Connect Mainland MQTT Client to its own Broker
const mqttClient = mqtt.connect('mqtt://127.0.0.1:1884', {
  clientId: 'polaris-mainland-backend'
});

mqttClient.on('connect', () => {
  console.log('Connected to Mainland MQTT Broker');
  mqttClient.subscribe('station/+/telemetry/routine', { qos: 0 });
  mqttClient.subscribe('station/+/telemetry/critical', { qos: 1 });
  mqttClient.subscribe('station/+/alerts', { qos: 2 });
  mqttClient.subscribe('station/+/status', { qos: 1 });
  mqttClient.subscribe('station/+/heartbeat', { qos: 1 });
  mqttClient.subscribe('station/+/commands/ack', { qos: 2 });
  mqttClient.subscribe('relay/status', { qos: 1 }); // BUGFIX: relay-level LWT, see relay.js
});

mqttClient.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    const parts = topic.split('/');
    const stationId = parts[1];

    // 1. Status / Bandwidth Tier updates
    if (topic.includes('/status') && topic !== 'relay/status') {
      const { tier, lastRtt, queuedCount } = payload;
      io.emit('linkStatus', { stationId, tier, lastRtt, queuedCount });
    }

    // 1b. Relay-level LWT — one relay connection serves both stations, so
    // an unexpected disconnect here means both genuinely lost their link
    // at once, not just one. See relay.js for why this isn't per-station.
    else if (topic === 'relay/status') {
      if (payload.status === 'unexpected_disconnect') {
        console.log('⚠️ LWT: Unexpected relay disconnect — both stations offline');
        io.emit('linkStatus', { stationId: 'maitri', tier: 'offline', lastRtt: 99999 });
        io.emit('linkStatus', { stationId: 'bharati', tier: 'offline', lastRtt: 99999 });
      }
    }

    // 2. Heartbeats — station-agent's own periodic pulse, never carries
    // 'unexpected_disconnect' itself (that only ever came from the relay's
    // LWT, now handled separately above via 'relay/status').
    else if (topic.includes('/heartbeat')) {
      if (payload.status === 'unexpected_disconnect') {
        // Defensive fallback only — see note above, this path shouldn't
        // normally fire anymore.
        console.log(`⚠️ LWT: Unexpected Satellite link drop for ${stationId}`);
        io.emit('linkStatus', { stationId, tier: 'offline', lastRtt: 99999 });
      } else {
        // Immediately echo heartbeat ack back (QoS 0)
        mqttClient.publish(`mainland/${stationId}/heartbeat/ack`, JSON.stringify({
          publishedAt: payload.publishedAt
        }), { qos: 0 });
      }
    }

    // 3. Telemetry Updates (Routine and Critical)
    else if (topic.includes('/telemetry/routine') || topic.includes('/telemetry/critical')) {
      const { recordId, telemetry, alerts, activeScenario } = payload;

      // Update local in-memory representations
      activeStates[stationId] = telemetry;
      rawAlertsStore[stationId] = alerts || [];
      activeAlerts[stationId] = (alerts || []).filter(alert =>
        !dismissedAlertIds[stationId]?.has(alert.id) &&
        !dismissedAlertTypes[stationId]?.has(alert.type)
      );
      activeScenarios[stationId] = activeScenario || 'none';

      // BUGFIX: station-agent computes healthScore from its OWN unfiltered
      // alert list — it has no concept of mainland-side dismissals. Without
      // this recompute, any operator dismiss/restore-baseline action gets
      // silently overwritten by the very next telemetry tick (~3s later),
      // making the fix look like it "didn't work" when it actually did,
      // briefly. Mainland's dismissed-alert state must always be the
      // authoritative modifier applied on top of raw station telemetry.
      // Now using rawAlertsStore to prevent operator masking of degradation.
      activeStates[stationId].healthScore = calculateHealthScore(activeStates[stationId], rawAlertsStore[stationId]);
      activeStates[stationId].riskLevel = determineRiskLevel(activeStates[stationId].healthScore);

      // Save to MongoDB if connected
      if (dbConnected) {
        try {
          if (topic.includes('/telemetry/critical') && recordId) {
            // Upsert critical telemetry keyed by custom _id to avoid duplicates (Day 2)
            await Telemetry.updateOne(
              { _id: `${stationId}-${recordId}` },
              { ...telemetry, stationId, timestamp: telemetry.timestamp ? new Date(telemetry.timestamp) : new Date() },
              { upsert: true }
            );
          } else {
            // Save standard routine log
            const telemetryRecord = new Telemetry({
              ...telemetry,
              timestamp: telemetry.timestamp ? new Date(telemetry.timestamp) : new Date()
            });
            await telemetryRecord.save();
          }

          // Sync active alerts
          await Alert.deleteMany({ stationId });
          if (activeAlerts[stationId].length > 0) {
            await Alert.insertMany(activeAlerts[stationId]);
          }
        } catch (err) {
          console.error(`Database write error for telemetry [${stationId}]:`, err);
        }
      }

      // Update historical cache
      historicalDataStore[stationId].push(telemetry);
      if (historicalDataStore[stationId].length > 200) {
        historicalDataStore[stationId].shift();
      }

      // Broadcast to all frontend web pages
      io.emit('telemetryUpdate', {
        stationId,
        telemetry,
        alerts: activeAlerts[stationId].filter(a => a.active),
        activeScenario
      });

      // Send Ack back for critical logs (Day 2/3)
      if (topic.includes('/telemetry/critical') && recordId) {
        mqttClient.publish(`mainland/${stationId}/telemetry/ack`, JSON.stringify({
          recordId,
          writtenAt: Date.now()
        }), { qos: 1 });
      }
    }

    // 4. Discrete Alerts Upsert
    else if (topic.includes('/alerts')) {
      const { alert } = payload;
      if (dismissedAlertIds[stationId]?.has(alert.id)) {
        return;
      }
      if (dbConnected) {
        await Alert.updateOne({ id: alert.id }, alert, { upsert: true });
      }
    }

    // 5. Command Acks
    else if (topic.includes('/commands/ack')) {
      const { cmdId } = payload;
      if (dbConnected) {
        await Command.updateOne({ _id: cmdId }, { status: 'executed' });
      }
      io.emit('commandAck', { cmdId, status: 'executed' });
      console.log(`Command ${cmdId} acknowledged and executed by ${stationId}`);
    }

  } catch (err) {
    console.error('Mainland broker message handler error:', err);
  }
});

// NCPOR Live Weather Web Scraper (Day 9)
let weatherCache = {
  maitri: { temp: -18, windSpeed: 25, pressure: 985, humidity: 65 },
  bharati: { temp: -22, windSpeed: 35, pressure: 978, humidity: 70 }
};

async function scrapeLiveWeather() {
  try {
    const res = await fetch('https://data.ncpor.res.in/maitri/live');
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const text = $('body').text();

      const tempMatch = text.match(/Air Temperature[\s\S]*?(-?\d+\.?\d*)/i);
      const windMatch = text.match(/Wind Speed[\s\S]*?(\d+\.?\d*)/i);
      const pressureMatch = text.match(/Air Pressure[\s\S]*?(\d+\.?\d*)/i);
      const humidityMatch = text.match(/Relative Humidity[\s\S]*?(\d+\.?\d*)/i);

      if (tempMatch && tempMatch[1]) weatherCache.maitri.temp = parseFloat(tempMatch[1]);
      if (windMatch && windMatch[1]) weatherCache.maitri.windSpeed = parseFloat(windMatch[1]);
      if (pressureMatch && pressureMatch[1]) weatherCache.maitri.pressure = parseFloat(pressureMatch[1]);
      if (humidityMatch && humidityMatch[1]) weatherCache.maitri.humidity = parseFloat(humidityMatch[1]);
    }
  } catch (err) {
    console.warn("Could not scrape Maitri weather, using cache:", err.message);
  }

  try {
    const res = await fetch('https://data.ncpor.res.in/bharati/live');
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const text = $('body').text();

      const tempMatch = text.match(/Air Temperature[\s\S]*?(-?\d+\.?\d*)/i);
      const windMatch = text.match(/Wind Speed[\s\S]*?(\d+\.?\d*)/i);
      const pressureMatch = text.match(/Air Pressure[\s\S]*?(\d+\.?\d*)/i);
      const humidityMatch = text.match(/Relative Humidity[\s\S]*?(\d+\.?\d*)/i);

      if (tempMatch && tempMatch[1]) weatherCache.bharati.temp = parseFloat(tempMatch[1]);
      if (windMatch && windMatch[1]) weatherCache.bharati.windSpeed = parseFloat(windMatch[1]);
      if (pressureMatch && pressureMatch[1]) weatherCache.bharati.pressure = parseFloat(pressureMatch[1]);
      if (humidityMatch && humidityMatch[1]) weatherCache.bharati.humidity = parseFloat(humidityMatch[1]);
    }
  } catch (err) {
    console.warn("Could not scrape Bharati weather, using cache:", err.message);
  }
}

// Initial scrape and 30-minute interval
scrapeLiveWeather();
setInterval(scrapeLiveWeather, 30 * 60 * 1000);

// --- REST API ROUTES ---

// Get Stations List
app.get('/api/stations', async (req, res) => {
  if (dbConnected) {
    try {
      const stations = await Station.find();
      return res.json(stations);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    return res.json([
      { id: 'maitri', name: 'Maitri Station', coordinates: [-70.7667, 11.7333], population: 28, established: '1989' },
      { id: 'bharati', name: 'Bharati Station', coordinates: [-69.4082, 76.1963], population: 32, established: '2012' }
    ]);
  }
});

// Get Live Telemetry
app.get('/api/stations/:id/telemetry', (req, res) => {
  const stationId = req.params.id.toLowerCase();
  if (stationId !== 'maitri' && stationId !== 'bharati') {
    return res.status(404).json({ error: 'Station not found' });
  }

  const scenario = activeScenarios[stationId];
  const timeline = scenario !== 'none' ? runForecastTimeline(stationId, scenario) : [];

  res.json({
    telemetry: activeStates[stationId],
    alerts: activeAlerts[stationId].filter(a => a.active),
    activeScenario: scenario,
    timeline
  });
});

// Get 30-day Historical Data
app.get('/api/stations/:id/history', async (req, res) => {
  const stationId = req.params.id.toLowerCase();
  if (stationId !== 'maitri' && stationId !== 'bharati') {
    return res.status(404).json({ error: 'Station not found' });
  }

  if (dbConnected) {
    try {
      const data = await Telemetry.find({ stationId }).sort({ timestamp: -1 }).limit(120);
      if (data.length > 0) {
        return res.json(data.reverse());
      }
    } catch (err) {
      console.error('History query error, falling back:', err);
    }
  }

  // Fallback to pre-generated historical data
  res.json(historicalDataStore[stationId]);
});

// Run "What-If" Scenario Simulation (Day 4 MQTT Command flow)
app.post('/api/simulations/run', async (req, res) => {
  const { stationId, scenario } = req.body;
  const id = stationId ? stationId.toLowerCase() : null;

  if (id !== 'maitri' && id !== 'bharati') {
    return res.status(400).json({ error: 'Invalid stationId' });
  }

  dismissedAlertIds[id].clear();
  dismissedAlertTypes[id].clear();

  const validScenarios = ['none', 'generator_failure', 'battery_failure', 'fuel_shortage', 'water_shortage', 'snowstorm', 'comms_outage', 'supply_delay', 'equipment_overload'];
  if (!validScenarios.includes(scenario)) {
    return res.status(400).json({ error: 'Invalid scenario name' });
  }

  // Day 7: Command Conflict Resolution
  if (dbConnected) {
    try {
      await Command.updateMany(
        { stationId: id, type: 'trigger_scenario', status: 'pending' },
        { status: 'superseded' }
      );
    } catch (e) {
      console.error("Conflict resolution database error:", e);
    }
  }

  let version = 1;
  if (dbConnected) {
    try {
      const lastCmd = await Command.findOne({ stationId: id, type: 'trigger_scenario' }).sort({ version: -1 });
      if (lastCmd) {
        version = lastCmd.version + 1;
      }
    } catch (e) {
      console.error("Fetch command version error:", e);
    }
  }

  // Save command to MongoDB
  let cmdId = `cmd_${Date.now()}`;
  if (dbConnected) {
    try {
      const newCmd = new Command({
        stationId: id,
        type: 'trigger_scenario',
        payload: { scenario },
        status: 'pending',
        version
      });
      const saved = await newCmd.save();
      cmdId = saved._id.toString();
    } catch (e) {
      console.error("Failed to save command:", e);
    }
  }

  // Publish to mainland MQTT Broker for relay forwarding
  const mqttPayload = {
    cmdId,
    type: 'trigger_scenario',
    payload: { scenario },
    version
  };

  mqttClient.publish(`mainland/${id}/commands`, JSON.stringify(mqttPayload), { qos: 2 });

  // Immediately apply scenario locally to mainland simulation
  activeScenarios[id] = scenario;

  // Generate the 7-day forecast timeline deterministically
  const timeline = runForecastTimeline(id, scenario);

  res.json({
    success: true,
    scenario,
    timeline,
    cmdId,
    version
  });
});

// Stop Simulation (Day 4 MQTT Command flow)
app.post('/api/simulations/stop', async (req, res) => {
  const { stationId } = req.body;
  const id = stationId ? stationId.toLowerCase() : null;

  if (id !== 'maitri' && id !== 'bharati') {
    return res.status(400).json({ error: 'Invalid stationId' });
  }

  dismissedAlertIds[id].clear();
  dismissedAlertTypes[id].clear();

  // Conflict resolution
  if (dbConnected) {
    try {
      await Command.updateMany(
        { stationId: id, type: 'trigger_scenario', status: 'pending' },
        { status: 'superseded' }
      );
    } catch (e) {
      console.error("Conflict resolution error:", e);
    }
  }

  let version = 1;
  if (dbConnected) {
    try {
      const lastCmd = await Command.findOne({ stationId: id, type: 'trigger_scenario' }).sort({ version: -1 });
      if (lastCmd) {
        version = lastCmd.version + 1;
      }
    } catch (e) {
      console.error("Fetch version error:", e);
    }
  }

  let cmdId = `cmd_${Date.now()}`;
  if (dbConnected) {
    try {
      const newCmd = new Command({
        stationId: id,
        type: 'trigger_scenario',
        payload: { scenario: 'none' },
        status: 'pending',
        version
      });
      const saved = await newCmd.save();
      cmdId = saved._id.toString();
    } catch (e) {
      console.error("Failed to save command:", e);
    }
  }

  // Publish stop to MQTT
  const mqttPayload = {
    cmdId,
    type: 'trigger_scenario',
    payload: { scenario: 'none' },
    version
  };

  mqttClient.publish(`mainland/${id}/commands`, JSON.stringify(mqttPayload), { qos: 2 });

  // Immediately clear scenario locally from mainland simulation
  activeScenarios[id] = 'none';

  res.json({ success: true, cmdId, version });
});

// Dummy Sync Endpoint (Keep frontend compatible, real syncing is automated via MQTT)
app.post('/api/sync', (req, res) => {
  res.json({
    success: true,
    message: 'MQTT Bridge automated sync in progress.'
  });
});

// Get Audit Logs (Day 8 read-only immutable audit)
app.get('/api/audit', async (req, res) => {
  if (dbConnected) {
    try {
      const commands = await Command.find().sort({ issuedAt: -1 }).limit(100);
      const alerts = await Alert.find().sort({ timestamp: -1 }).limit(100);
      res.json({ commands, alerts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.json({ commands: [], alerts: [] });
  }
});

// Get real scraped NCPOR live weather (Day 9)
app.get('/api/weather/real', (req, res) => {
  res.json(weatherCache);
});

// AI Copilot Commander
app.post('/api/copilot/ask', (req, res) => {
  const { stationId, question } = req.body;
  const id = stationId ? stationId.toLowerCase() : 'maitri';

  const telemetry = activeStates[id];
  const alerts = activeAlerts[id];

  const answer = askCopilot(telemetry, alerts, question);
  res.json({ answer });
});

// Generate Daily Mission Report
app.get('/api/reports/daily', async (req, res) => {
  const stationId = req.query.stationId ? req.query.stationId.toLowerCase() : 'maitri';
  const id = stationId === 'bharati' ? 'bharati' : 'maitri';

  const telemetry = activeStates[id];
  const alerts = activeAlerts[id].filter(a => a.active);
  const stationName = id === 'maitri' ? 'Maitri' : 'Bharati';

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const reportContent = {
    stationName,
    date: dateStr,
    healthScore: telemetry.healthScore,
    riskLevel: telemetry.riskLevel,
    fuelDays: telemetry.resources.fuelDays,
    waterDays: telemetry.resources.waterDays,
    alertsCount: alerts.length,
    generatorsRunning: telemetry.generators.filter(g => g.status === 'running').length,
    weather: telemetry.weather,
    criticalIssues: alerts.map(a => a.message),
    recommendations: [
      telemetry.resources.fuelDays < 30 ? 'Prioritize SAB diesel fuel delivery via shipping schedules.' : 'Standard fuel watch.',
      telemetry.powerGrid.batterySoc < 50 ? 'Avoid using high-load scientific instruments during peak hours.' : 'Sufficient battery buffer maintained.',
      alerts.length > 0 ? 'Execute maintenance schedules on active warning components immediately.' : 'Perform daily routine walk-arounds on generator blocks.'
    ]
  };

  if (dbConnected) {
    try {
      const reportDb = new Report({
        stationId: id,
        date: dateStr,
        healthScore: telemetry.healthScore,
        weatherSummary: `${telemetry.weather.temp}°C, wind: ${telemetry.weather.windSpeed} km/h`,
        fuelRemaining: telemetry.resources.fuel,
        fuelDays: telemetry.resources.fuelDays,
        waterRemaining: telemetry.resources.water,
        waterDays: telemetry.resources.waterDays,
        activeAlertsCount: alerts.length,
        summary: `POLARIS Daily Operations Summary for ${stationName} Station. Current Risk Index is ${telemetry.riskLevel}.`,
        criticalIssues: reportContent.criticalIssues,
        recommendations: reportContent.recommendations
      });
      await reportDb.save();
    } catch (err) {
      console.error('Failed to save daily report in DB:', err);
    }
  }

  res.json({ report: reportContent });
});

// Acknowledging/Resolving alert
app.post('/api/alerts/resolve', (req, res) => {
  const { stationId, alertId } = req.body;
  const id = stationId ? stationId.toLowerCase() : null;

  if (id && activeAlerts[id]) {
    dismissedAlertIds[id].add(alertId);
    const dismissedAlert = activeAlerts[id].find(alert => alert.id === alertId);
    if (dismissedAlert?.type) {
      dismissedAlertTypes[id].add(dismissedAlert.type);
    }
    activeAlerts[id] = activeAlerts[id].filter(a => a.id !== alertId);
    // Recalculating health score using unfiltered raw alerts so acknowledging/dismissing alert does not mask health degradation
    activeStates[id].healthScore = calculateHealthScore(activeStates[id], rawAlertsStore[id] || []);
    activeStates[id].riskLevel = determineRiskLevel(activeStates[id].healthScore);

    io.emit('telemetryUpdate', {
      stationId: id,
      telemetry: activeStates[id],
      alerts: activeAlerts[id].filter(a => a.active),
      activeScenario: activeScenarios[id]
    });

    return res.json({ success: true, alerts: activeAlerts[id] });
  }

  res.status(400).json({ error: 'Invalid parameters' });
});

// Relay Control proxies (Day 5 Link Impairment controls)
app.post('/api/link/impair', async (req, res) => {
  try {
    const relayRes = await fetch('http://localhost:4000/impair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await relayRes.json();
    const tier = data.dropPct > 50 ? 'offline' : data.delayMs > 2000 ? 'critical-only' : 'full';
    io.emit('linkStatus', { stationId: 'maitri', tier, lastRtt: data.delayMs, queuedCount: 0 });
    io.emit('linkStatus', { stationId: 'bharati', tier, lastRtt: data.delayMs, queuedCount: 0 });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Relay unreachable: ' + err.message });
  }
});

app.post('/api/link/clear', async (req, res) => {
  try {
    const relayRes = await fetch('http://localhost:4000/impair/clear', { method: 'POST' });
    const data = await relayRes.json();
    io.emit('linkStatus', { stationId: 'maitri', tier: 'full', lastRtt: 55, queuedCount: 0 });
    io.emit('linkStatus', { stationId: 'bharati', tier: 'full', lastRtt: 55, queuedCount: 0 });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Relay unreachable: ' + err.message });
  }
});

app.post('/api/link/toggle', async (req, res) => {
  try {
    const relayRes = await fetch('http://localhost:4000/toggle', { method: 'POST' });
    const data = await relayRes.json();
    const tier = data.isConnected ? 'full' : 'offline';
    const lastRtt = data.isConnected ? 55 : 99999;
    io.emit('linkStatus', { stationId: 'maitri', tier, lastRtt, queuedCount: 0 });
    io.emit('linkStatus', { stationId: 'bharati', tier, lastRtt, queuedCount: 0 });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Relay unreachable: ' + err.message });
  }
});

app.get('/api/link/status', async (req, res) => {
  try {
    const relayRes = await fetch('http://localhost:4000/status');
    const data = await relayRes.json();
    return res.json(data);
  } catch (err) {
    return res.json({ isConnected: true, delayMs: 0, dropPct: 0 });
  }
});

// Manual Environment Override (Interactive Environment Controls sliders).
// Lightweight/ephemeral by design — unlike scenario triggers, this isn't
// persisted to MongoDB or versioned, since it's a live slider drag rather
// than a discrete operational event worth auditing. The station-agent
// blends toward the requested value over a few ticks rather than snapping,
// so the twin/telemetry read naturally instead of jumping.
app.post('/api/environment/override', (req, res) => {
  const { stationId, windSpeed, generatorLoadBaseline, clear } = req.body;
  const id = stationId ? stationId.toLowerCase() : null;

  if (id !== 'maitri' && id !== 'bharati') {
    return res.status(400).json({ error: 'Invalid stationId' });
  }

  if (!clear) {
    if (windSpeed !== undefined && (typeof windSpeed !== 'number' || windSpeed < 0 || windSpeed > 150)) {
      return res.status(400).json({ error: 'windSpeed must be a number between 0 and 150' });
    }
    if (generatorLoadBaseline !== undefined && (typeof generatorLoadBaseline !== 'number' || generatorLoadBaseline < 40 || generatorLoadBaseline > 300)) {
      return res.status(400).json({ error: 'generatorLoadBaseline must be a number between 40 and 300' });
    }
  }

  const cmdId = `env_${Date.now()}`;
  const mqttPayload = {
    cmdId,
    type: 'env_override',
    payload: clear ? { clear: true } : { windSpeed, generatorLoadBaseline },
  };

  mqttClient.publish(`mainland/${id}/commands`, JSON.stringify(mqttPayload), { qos: 1 });

  res.json({ success: true, cmdId, applied: clear ? { clear: true } : { windSpeed, generatorLoadBaseline } });
});

// Start Server
server.listen(PORT, () => {
  console.log(`📡 POLARIS Mainland Control Server running on port ${PORT}`);
});
