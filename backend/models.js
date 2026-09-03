const mongoose = require('mongoose');

// Station Schema
const StationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  coordinates: { type: [Number], required: true }, // [lat, lng]
  population: { type: Number, default: 30 },
  established: { type: String }
});

// Telemetry Schema
const TelemetrySchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  stationId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  healthScore: { type: Number, default: 100 },
  riskLevel: { type: String, default: 'Low' },
  powerGrid: {
    load: Number, // kW
    capacity: Number, // kW
    batterySoc: Number, // %
    batteryTemp: Number, // C
    batteryHealth: Number, // %
    backupActive: Boolean
  },
  resources: {
    fuel: Number, // liters
    fuelCapacity: Number,
    fuelDays: Number,
    water: Number, // liters
    waterCapacity: Number,
    waterDays: Number,
    food: Number, // days
    foodCapacity: Number,
    foodDays: Number,
    medicalSupplies: Number, // % health
    spareParts: Number // % inventory
  },
  weather: {
    temp: Number, // C
    windSpeed: Number, // km/h
    windDir: String,
    pressure: Number, // hPa
    humidity: Number, // %
    risk: Number, // 0-100
    forecast: String
  },
  generators: [{
    id: String,
    name: String,
    status: String, // running, standby, offline, failing
    load: Number, // kW
    temp: Number, // C
    runtime: Number, // hours
    fuelRate: Number, // liters/hour
    health: Number, // %
    failureProb: Number // %
  }],
  buildings: [{
    id: String,
    name: String,
    load: Number, // kW
    temp: Number, // C
    status: String // normal, high_load, cooling_issue
  }],
  equipment: [{
    id: String,
    name: String,
    status: String,
    health: Number,
    failureProb: Number,
    nextMaintenance: String
  }]
});

// Alert Schema
const AlertSchema = new mongoose.Schema({
  id: { type: String, required: true },
  stationId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true }, // generator, fuel, water, weather, battery, connectivity, equipment
  severity: { type: String, required: true }, // info, warning, critical
  message: { type: String, required: true },
  impact: { type: String, required: true },
  action: { type: String, required: true },
  active: { type: Boolean, default: true }
});

// Daily Report Schema
const ReportSchema = new mongoose.Schema({
  stationId: { type: String, required: true },
  date: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  healthScore: Number,
  weatherSummary: String,
  fuelRemaining: Number,
  fuelDays: Number,
  waterRemaining: Number,
  waterDays: Number,
  activeAlertsCount: Number,
  summary: String,
  criticalIssues: [String],
  recommendations: [String]
});

// Command Schema
const CommandSchema = new mongoose.Schema({
  stationId: { type: String, required: true },
  type: { type: String, required: true },
  payload: mongoose.Schema.Types.Mixed,
  issuedBy: { type: String, default: 'Operations Manager' },
  issuedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' }, // pending, executed, superseded
  version: { type: Number, default: 1 }
});

// Compile Models
const Station = mongoose.model('Station', StationSchema);
const Telemetry = mongoose.model('Telemetry', TelemetrySchema);
const Alert = mongoose.model('Alert', AlertSchema);
const Report = mongoose.model('Report', ReportSchema);
const Command = mongoose.model('Command', CommandSchema);

module.exports = {
  Station,
  Telemetry,
  Alert,
  Report,
  Command
};

