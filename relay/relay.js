const express = require('express');
const mqtt = require('mqtt');
const app = express();

app.use(express.json());

const PORT = 4000;
const STATION_BROKER = 'mqtt://127.0.0.1:1883';
const MAINLAND_BROKER = 'mqtt://127.0.0.1:1884';

let isConnected = true;
let delayMs = 0;
let dropPct = 0;

let stationClient = null;
let mainlandClient = null;

function connectClients() {
  console.log('🔗 Connecting MQTT Clients for bridge...');
  
  // Connect to Station Broker
  stationClient = mqtt.connect(STATION_BROKER, {
    clientId: 'polaris-relay-station-side',
    clean: false
  });
  
  // Connect to Mainland Broker with Last Will (LWT)
  // BUGFIX: this was hardcoded to 'station/maitri/heartbeat' only — since
  // one relay connection serves BOTH stations, a real disconnect here means
  // both stations lose their link simultaneously, not just maitri's. MQTT
  // only supports one will topic per client, so rather than fake per-station
  // coverage, publish to a relay-level topic and let the mainland subscriber
  // treat it as "both stations offline" — which is what's actually true.
  mainlandClient = mqtt.connect(MAINLAND_BROKER, {
    clientId: 'polaris-relay-mainland-side',
    clean: false,
    will: {
      topic: 'relay/status',
      payload: JSON.stringify({ status: 'unexpected_disconnect', ts: Date.now() }),
      qos: 1,
      retain: true
    }
  });

  setupForwarding();
}

function disconnectClients() {
  console.log('🔌 Disconnecting MQTT Clients (outage)...');
  if (stationClient) {
    stationClient.end();
    stationClient = null;
  }
  if (mainlandClient) {
    mainlandClient.end();
    mainlandClient = null;
  }
}

function setupForwarding() {
  if (!stationClient || !mainlandClient) return;

  // Station -> Mainland
  stationClient.on('connect', () => {
    console.log('Relay connected to Station Broker');
    stationClient.subscribe('station/+/telemetry/routine');
    stationClient.subscribe('station/+/telemetry/critical');
    stationClient.subscribe('station/+/alerts');
    stationClient.subscribe('station/+/status');
    stationClient.subscribe('station/+/heartbeat');
    stationClient.subscribe('station/+/commands/ack');
  });

  stationClient.on('message', (topic, message, packet) => {
    if (!isConnected || !mainlandClient || !mainlandClient.connected) return;
    
    // Check impairment (Day 5)
    if (dropPct > 0 && Math.random() * 100 < dropPct) {
      console.log(`[IMPAIR] Dropped packet from Station: ${topic}`);
      return;
    }
    
    const options = { qos: packet.qos, retain: packet.retain };
    
    if (delayMs > 0) {
      setTimeout(() => {
        if (mainlandClient && mainlandClient.connected) {
          mainlandClient.publish(topic, message, options);
        }
      }, delayMs);
    } else {
      mainlandClient.publish(topic, message, options);
    }
  });

  // Mainland -> Station
  mainlandClient.on('connect', () => {
    console.log('Relay connected to Mainland Broker');
    mainlandClient.subscribe('mainland/+/telemetry/ack');
    mainlandClient.subscribe('mainland/+/heartbeat/ack');
    mainlandClient.subscribe('mainland/+/commands');
  });

  mainlandClient.on('message', (topic, message, packet) => {
    if (!isConnected || !stationClient || !stationClient.connected) return;
    
    // Check impairment (Day 5)
    if (dropPct > 0 && Math.random() * 100 < dropPct) {
      console.log(`[IMPAIR] Dropped packet from Mainland: ${topic}`);
      return;
    }
    
    const options = { qos: packet.qos, retain: packet.retain };
    
    if (delayMs > 0) {
      setTimeout(() => {
        if (stationClient && stationClient.connected) {
          stationClient.publish(topic, message, options);
        }
      }, delayMs);
    } else {
      stationClient.publish(topic, message, options);
    }
  });
}

// Initial connections
connectClients();

// API Endpoints for testing & controls (Day 5)
app.post('/impair', (req, res) => {
  const { delay, drop } = req.body;
  delayMs = delay !== undefined ? Number(delay) : delayMs;
  dropPct = drop !== undefined ? Number(drop) : dropPct;
  
  console.log(`🚨 Link Impairment injected: Delay: ${delayMs}ms, Drop: ${dropPct}%`);
  res.json({ status: 'ok', delayMs, dropPct });
});

app.post('/impair/clear', (req, res) => {
  delayMs = 0;
  dropPct = 0;
  console.log('✅ Link Impairments cleared');
  res.json({ status: 'ok', delayMs, dropPct });
});

app.post('/toggle', (req, res) => {
  isConnected = !isConnected;
  console.log(`📶 Satellite Link Relay toggled. Connected: ${isConnected}`);
  
  if (isConnected) {
    connectClients();
  } else {
    disconnectClients();
  }
  
  res.json({ status: 'ok', isConnected });
});

app.get('/status', (req, res) => {
  res.json({ isConnected, delayMs, dropPct });
});

app.listen(PORT, () => {
  console.log(`⚙️ Relay Control Service running on port ${PORT}`);
});
