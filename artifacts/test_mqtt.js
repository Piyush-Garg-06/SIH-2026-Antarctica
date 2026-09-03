const mqtt = require('mqtt');

console.log('Connecting to Station Broker (1883)...');
const client1883 = mqtt.connect('mqtt://localhost:1883');

client1883.on('connect', () => {
  console.log('✅ Connected to Station Broker (1883)');
  client1883.subscribe('#', (err) => {
    if (err) console.error('Subscription error 1883:', err);
  });
});

client1883.on('message', (topic, message) => {
  console.log(`[1883] Topic: ${topic}, Payload Size: ${message.length} bytes`);
});

client1883.on('error', (err) => {
  console.error('❌ 1883 Error:', err.message);
});

console.log('Connecting to Mainland Broker (1884)...');
const client1884 = mqtt.connect('mqtt://localhost:1884');

client1884.on('connect', () => {
  console.log('✅ Connected to Mainland Broker (1884)');
  client1884.subscribe('#', (err) => {
    if (err) console.error('Subscription error 1884:', err);
  });
});

client1884.on('message', (topic, message) => {
  console.log(`[1884] Topic: ${topic}, Payload Size: ${message.length} bytes`);
  if (topic.includes('telemetry')) {
    try {
      const parsed = JSON.parse(message.toString());
      console.log('Telemetry payload properties:', Object.keys(parsed.telemetry || {}));
    } catch (e) {
      console.error('Failed to parse message on 1884:', e.message);
    }
  }
});

client1884.on('error', (err) => {
  console.error('❌ 1884 Error:', err.message);
});

setTimeout(() => {
  console.log('Closing connections after 10s...');
  client1883.end();
  client1884.end();
  process.exit(0);
}, 10000);
