// Telemetry Simulation Engine for POLARIS
// Simulates causal connections:
// Weather -> Heating Demand -> Power Load -> Generator Load & Fuel Consumption -> Battery SoC -> Equipment Failure Risk -> Station Health

const baselineMaitri = {
  stationId: 'maitri',
  population: 28,
  powerGrid: { load: 120, capacity: 250, batterySoc: 85, batteryTemp: 18, batteryHealth: 94, backupActive: false },
  resources: { fuel: 45000, fuelCapacity: 60000, fuelDays: 90, water: 12000, waterCapacity: 20000, waterDays: 42, food: 120, foodCapacity: 180, foodDays: 120, medicalSupplies: 88, spareParts: 75 },
  weather: { temp: -18, windSpeed: 25, windDir: 'SSE', pressure: 985, humidity: 65, risk: 15, forecast: 'Clear with light winds' },
  generators: [
    { id: 'gen_1', name: 'Main Generator G1', status: 'running', load: 65, temp: 82, runtime: 3450, fuelRate: 16.5, health: 91, failureProb: 1.5 },
    { id: 'gen_2', name: 'Auxiliary Generator G2', status: 'standby', load: 55, temp: 40, runtime: 1210, fuelRate: 14.2, health: 88, failureProb: 2.1 },
    { id: 'gen_3', name: 'Emergency Generator G3', status: 'standby', load: 0, temp: 22, runtime: 450, fuelRate: 15.0, health: 97, failureProb: 0.5 }
  ],
  buildings: [
    { id: 'bld_admin', name: 'Administration & Control', load: 30, temp: 21, status: 'normal' },
    { id: 'bld_living', name: 'Residential Quarters', load: 40, temp: 22, status: 'normal' },
    { id: 'bld_labs', name: 'Scientific Research Labs', load: 25, temp: 20, status: 'normal' },
    { id: 'bld_utility', name: 'Utility & Water Treatment', load: 25, temp: 18, status: 'normal' }
  ],
  equipment: [
    { id: 'eq_satellite', name: 'SATCOM Antenna Array', status: 'nominal', health: 92, failureProb: 1.2, nextMaintenance: '2026-09-10' },
    { id: 'eq_hvac', name: 'Central HVAC System', status: 'nominal', health: 89, failureProb: 2.5, nextMaintenance: '2026-09-05' },
    { id: 'eq_water_pump', name: 'Subglacial Lake Intake Pump', status: 'nominal', health: 85, failureProb: 3.8, nextMaintenance: '2026-09-01' }
  ]
};

const baselineBharati = {
  stationId: 'bharati',
  population: 32,
  powerGrid: { load: 145, capacity: 300, batterySoc: 78, batteryTemp: 19, batteryHealth: 92, backupActive: false },
  resources: { fuel: 58000, fuelCapacity: 80000, fuelDays: 110, water: 15000, waterCapacity: 25000, waterDays: 47, food: 140, foodCapacity: 200, foodDays: 140, medicalSupplies: 91, spareParts: 82 },
  weather: { temp: -22, windSpeed: 35, windDir: 'E', pressure: 978, humidity: 70, risk: 20, forecast: 'Partly cloudy, increasing winds' },
  generators: [
    { id: 'gen_1', name: 'Caterpillar 3406 G1', status: 'running', load: 80, temp: 85, runtime: 4120, fuelRate: 20.2, health: 86, failureProb: 3.2 },
    { id: 'gen_2', name: 'Caterpillar 3406 G2', status: 'running', load: 65, temp: 83, runtime: 3890, fuelRate: 17.8, health: 89, failureProb: 2.4 },
    { id: 'gen_3', name: 'Emergency Backup G3', status: 'standby', load: 0, temp: 18, runtime: 320, fuelRate: 18.5, health: 98, failureProb: 0.2 }
  ],
  buildings: [
    { id: 'bld_admin', name: 'Main Module (Command)', load: 45, temp: 22, status: 'normal' },
    { id: 'bld_living', name: 'Living Modules', load: 50, temp: 22, status: 'normal' },
    { id: 'bld_labs', name: 'Atmospheric & Ocean Labs', load: 30, temp: 20, status: 'normal' },
    { id: 'bld_utility', name: 'Water & Waste Module', load: 20, temp: 19, status: 'normal' }
  ],
  equipment: [
    { id: 'eq_satellite', name: 'Radome SATCOM Node', status: 'nominal', health: 95, failureProb: 0.8, nextMaintenance: '2026-09-15' },
    { id: 'eq_hvac', name: 'Integrated Air Handling Unit', status: 'nominal', health: 87, failureProb: 2.8, nextMaintenance: '2026-09-02' },
    { id: 'eq_water_pump', name: 'RO Desalination Pump', status: 'nominal', health: 91, failureProb: 1.5, nextMaintenance: '2026-09-20' }
  ]
};

// Calculate Station Health Score (0 - 100)
function calculateHealthScore(telemetry, activeAlerts) {
  let score = 100;
  const alerts = Array.isArray(activeAlerts) ? activeAlerts.filter(a => a && a.active !== false) : [];

  const batterySoc = Number(telemetry.powerGrid?.batterySoc ?? 0);
  const fuelDays = Number(telemetry.resources?.fuelDays ?? 0);
  const waterDays = Number(telemetry.resources?.waterDays ?? 0);
  const offlineGens = telemetry.generators.filter(g => g.status === 'offline').length;

  // Hard resource floor: these conditions are operationally critical and must
  // not be masked by simply dismissing visible alerts. A station with 1 day of
  // fuel left cannot be treated as healthy even if the warning banner is cleared.
  if (fuelDays <= 1) score -= 35;
  else if (fuelDays <= 3) score -= 25;
  else if (fuelDays <= 7) score -= 18;
  else if (fuelDays <= 15) score -= 10;
  else if (fuelDays <= 30) score -= 5;

  if (waterDays <= 2) score -= 20;
  else if (waterDays <= 5) score -= 14;
  else if (waterDays <= 10) score -= 8;

  if (batterySoc < 15) score -= 20;
  else if (batterySoc < 30) score -= 12;
  else if (batterySoc < 50) score -= 6;

  if (offlineGens > 0) score -= offlineGens * 8;

  // 1. Power stability (max deduction: 25)
  if (batterySoc < 20) score -= 15;
  else if (batterySoc < 40) score -= 8;

  // 2. Resources (max deduction: 25)
  if (fuelDays < 10) score -= 20;
  else if (fuelDays < 30) score -= 10;
  else if (fuelDays < 50) score -= 4;

  if (waterDays < 5) score -= 15;
  else if (waterDays < 15) score -= 7;

  // 3. Equipment & Generator Health (max deduction: 20)
  const avgGenHealth = telemetry.generators.reduce((sum, g) => sum + g.health, 0) / telemetry.generators.length;
  if (avgGenHealth < 70) score -= 12;
  else if (avgGenHealth < 85) score -= 5;

  const avgEqHealth = telemetry.equipment.reduce((sum, eq) => sum + eq.health, 0) / telemetry.equipment.length;
  if (avgEqHealth < 70) score -= 8;

  // 4. Weather Risk (max deduction: 15)
  if (telemetry.weather.risk > 80) score -= 15;
  else if (telemetry.weather.risk > 50) score -= 8;

  // 5. Active Alerts (max deduction: 15)
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.active).length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning' && a.active).length;
  score -= (criticalAlerts * 8 + warningAlerts * 3);

  // Final gating: a dismissed alert is never a real recovery. If the station is
  // still degraded in any safety-critical dimension, the score must stay below a
  // healthy operating band even when the warning banner is cleared.
  if (fuelDays <= 3 || waterDays <= 5 || batterySoc < 20 || offlineGens > 0) {
    score = Math.min(score, 35);
  } else if (fuelDays <= 7 || waterDays <= 10 || batterySoc < 35) {
    score = Math.min(score, 55);
  } else if (fuelDays <= 15 || waterDays <= 15 || batterySoc < 50 || avgGenHealth < 75 || avgEqHealth < 75) {
    score = Math.min(score, 70);
  } else if (fuelDays <= 30 || waterDays <= 20 || batterySoc < 65) {
    score = Math.min(score, 82);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// Generate Risk Level
function determineRiskLevel(healthScore) {
  if (healthScore >= 85) return 'Low';
  if (healthScore >= 65) return 'Medium';
  if (healthScore >= 45) return 'High';
  return 'Critical';
}

// Simulate one step of telemetry (timeDelta is in hours)
function simulateNextState(currentState, scenario = 'none', timeDeltaHours = 0.05, alertsQueue = []) {
  // Deep clone to prevent mutating input
  const next = JSON.parse(JSON.stringify(currentState));
  next.timestamp = new Date();

  // 1. Weather Simulation
  let tempDelta = (Math.random() - 0.5) * 1.5;
  let windDelta = (Math.random() - 0.5) * 3;

  if (scenario === 'snowstorm') {
    next.weather.temp = Math.max(-65, next.weather.temp - 1.5 * timeDeltaHours * 20); // Faster temperature drop
    next.weather.windSpeed = Math.min(130, next.weather.windSpeed + 5.5 * timeDeltaHours * 20); // Faster rising winds
    next.weather.risk = Math.min(100, Math.round(next.weather.windSpeed * 0.75 + Math.abs(next.weather.temp) * 0.5));
    next.weather.forecast = 'SEVERITY STORM IN PROGRESS: BLIZZARD CONDITIONS';
    next.weather.pressure = Math.max(940, next.weather.pressure - 2.5 * timeDeltaHours * 20);
  } else {
    // Normal fluctuations
    next.weather.temp = Math.max(-45, Math.min(-10, next.weather.temp + tempDelta * timeDeltaHours));
    next.weather.windSpeed = Math.max(5, Math.min(65, next.weather.windSpeed + windDelta * timeDeltaHours));
    next.weather.risk = Math.round(next.weather.windSpeed * 0.4 + Math.abs(next.weather.temp) * 0.3);
    next.weather.pressure = Math.max(965, Math.min(1015, next.weather.pressure + (Math.random() - 0.5) * timeDeltaHours));
    if (next.weather.windSpeed > 45) next.weather.forecast = 'Increasing winds, cold temperatures';
    else next.weather.forecast = 'Clear, stable polar conditions';
  }

  // 2. Weather Impact -> Heating & Power Load
  // Lower temperature and higher wind speed increase heating demand
  const baseHeatingLoad = next.stationId === 'maitri' ? 40 : 50;
  const tempFactor = Math.max(0, -15 - next.weather.temp) * 1.2; // Extra power per degree below -15C
  const windFactor = Math.max(0, next.weather.windSpeed - 30) * 0.3; // Extra power for wind draft

  const weatherHeatingDemand = baseHeatingLoad + tempFactor + windFactor;

  // Base non-heating load (appliances, research labs, utility pumps)
  const baseStaticLoad = next.stationId === 'maitri' ? 70 : 85;

  let scientificLoad = next.stationId === 'maitri' ? 20 : 25;
  if (scenario === 'equipment_overload') {
    scientificLoad = 90; // Large surge in lab instrumentation
  }

  const freezeLoadPenalty = scenario === 'water_shortage' ? 25 : 0;

  // Total Load
  next.powerGrid.load = Math.round(baseStaticLoad + weatherHeatingDemand + scientificLoad + freezeLoadPenalty);

  // Distribute Building Loads
  next.buildings.forEach(b => {
    if (b.id === 'bld_admin') b.load = Math.round(next.powerGrid.load * 0.25);
    else if (b.id === 'bld_living') b.load = Math.round(next.powerGrid.load * 0.35 + (scenario === 'snowstorm' ? 15 : 0));
    else if (b.id === 'bld_labs') b.load = Math.round(scientificLoad + 10);
    else if (b.id === 'bld_utility') b.load = Math.round(next.powerGrid.load * 0.15 + (scenario === 'water_shortage' ? 18 : 0));

    // Dynamic building temp based on heating power vs weather coldness
    const heatSufficiency = (scenario === 'generator_failure' && next.powerGrid.batterySoc < 10) ? 0.3 : 1.0;
    const coolingRate = Math.max(0, -10 - next.weather.temp) * 0.05 * (1 - heatSufficiency);
    b.temp = Math.max(5, Math.min(23, b.temp - coolingRate * timeDeltaHours * 5 + (Math.random() - 0.5) * 0.1));
    if (b.temp < 15) b.status = 'cooling_issue';
    else b.status = b.load > 70 ? 'high_load' : 'normal';
  });

  // 3. Generator Status and Power Generation
  let targetGeneration = next.powerGrid.load;
  let availableCapacity = 0;

  // Handle Generator Scenarios
  if (scenario === 'generator_failure') {
    // Force main generator offline
    next.generators[0].status = 'offline';
    next.generators[0].load = 0;
    next.generators[0].temp = Math.max(20, next.generators[0].temp - 10 * timeDeltaHours * 10);
    next.generators[0].health = Math.max(10, next.generators[0].health - 5);
    next.generators[0].failureProb = 100;
  }

  // Calculate available capacity from non-offline generators
  next.generators.forEach(gen => {
    if (gen.status !== 'offline') {
      if (gen.id === 'gen_1' && scenario !== 'generator_failure') {
        gen.status = 'running';
      } else if (gen.id === 'gen_2' && (scenario === 'generator_failure' || scenario === 'equipment_overload' || next.powerGrid.load > 120)) {
        gen.status = 'running';
      } else if (gen.id === 'gen_3' && (next.powerGrid.load > 200 || (scenario === 'generator_failure' && next.powerGrid.load > 100))) {
        gen.status = 'running';
        next.powerGrid.backupActive = true;
      } else {
        gen.status = 'standby';
        gen.load = 0;
        gen.temp = Math.max(20, gen.temp - 5 * timeDeltaHours * 10);
      }
    }
  });

  // Count active running generators
  const runningGens = next.generators.filter(g => g.status === 'running');
  availableCapacity = runningGens.length * (next.stationId === 'maitri' ? 100 : 120);
  next.powerGrid.capacity = availableCapacity;

  // Distribute load among running generators
  if (runningGens.length > 0) {
    const loadPerGen = Math.min(110, (targetGeneration / availableCapacity) * 100); // load %
    runningGens.forEach(gen => {
      gen.load = Math.round((loadPerGen / 100) * (next.stationId === 'maitri' ? 100 : 120));

      // Generator temp rises with load
      const targetTemp = 60 + (gen.load / (next.stationId === 'maitri' ? 100 : 120)) * 30;
      gen.temp += (targetTemp - gen.temp) * 0.2 * timeDeltaHours * 20;

      // Fuel consumption (causal: load affects fuel consumption)
      gen.fuelRate = gen.load * 0.22; // Liters per hour

      // Wear and tear (high temp/load increases failure probability)
      const wearRate = (gen.load > 85 ? 0.8 : 0.1) * timeDeltaHours;
      gen.health = Math.max(10, gen.health - wearRate * 2);
      gen.failureProb = Math.min(100, Math.round((100 - gen.health) * 0.5 + (gen.temp > 90 ? 20 : 0)));

      // If temperature is too high, it might trigger an alert
      if (gen.temp > 90 && alertsQueue) {
        pushAlert(alertsQueue, next.stationId, 'generator', 'critical',
          `${gen.name} overheating detected (${Math.round(gen.temp)}°C)`,
          'High thermal stress can lead to sudden mechanical seize and immediate power blackout.',
          'Throttle non-essential station loads and initiate backup generator prep.'
        );
      }
    });
  } else {
    next.powerGrid.capacity = 0;
  }

  // 4. Power Deficit -> Battery SoC
  const actualGeneration = Math.min(next.powerGrid.load, availableCapacity);
  const powerDeficit = next.powerGrid.load - actualGeneration;

  if (scenario === 'battery_failure') {
    next.powerGrid.batterySoc = 0;
    next.powerGrid.batteryHealth = 10;
    next.powerGrid.batteryTemp = 48;
  } else {
    const defrostDrain = scenario === 'water_shortage' ? 12 : 0;
    if (powerDeficit > 0 || scenario === 'water_shortage') {
      // Draining battery
      const dischargeRate = ((powerDeficit + defrostDrain) / 200) * 100; // Assuming 200kWh battery capacity
      next.powerGrid.batterySoc = Math.max(0, next.powerGrid.batterySoc - dischargeRate * timeDeltaHours);
      next.powerGrid.batteryTemp = Math.min(50, next.powerGrid.batteryTemp + (scenario === 'water_shortage' ? 6 : 4) * timeDeltaHours * 5);

      if (next.powerGrid.batterySoc < 20) {
        pushAlert(alertsQueue, next.stationId, 'battery', 'critical',
          'Critical battery state of charge (SoC < 20%)',
          'Station will experience complete power grid collapse if primary generation is not restored.',
          'Start Emergency Generator G3 immediately and shed research module loads.'
        );
      }
    } else {
      // Recharging battery if surplus capacity
      const surplus = availableCapacity - next.powerGrid.load;
      if (surplus > 10 && next.powerGrid.batterySoc < 98) {
        const chargeRate = (surplus / 200) * 80; // Charge slower
        next.powerGrid.batterySoc = Math.min(100, next.powerGrid.batterySoc + chargeRate * timeDeltaHours);
        next.powerGrid.batteryTemp = Math.max(15, next.powerGrid.batteryTemp - 1 * timeDeltaHours * 5);
      }
    }
    // Slowly decay battery health based on high temp
    if (next.powerGrid.batteryTemp > 40) {
      next.powerGrid.batteryHealth = Math.max(30, next.powerGrid.batteryHealth - 0.1 * timeDeltaHours);
    }
  }

  // 5. Resources Consumption (causal connection)
  // Fuel: Generators burn fuel
  const totalFuelBurnRate = next.generators.reduce((sum, g) => sum + (g.status === 'running' ? g.fuelRate : 0), 0);

  if (scenario === 'fuel_shortage') {
    // Deplete fuel by approx 2 days per tick (60000 liters per hour)
    next.resources.fuel = Math.max(1000, next.resources.fuel - 60000 * timeDeltaHours);
  } else {
    next.resources.fuel = Math.max(0, next.resources.fuel - totalFuelBurnRate * timeDeltaHours);
  }

  next.resources.fuelDays = totalFuelBurnRate > 0 ? Math.round(next.resources.fuel / (totalFuelBurnRate * 24)) : 999;

  if (next.resources.fuelDays < 15) {
    pushAlert(alertsQueue, next.stationId, 'fuel', 'critical',
      `Fuel reserves depleted below critical threshold (${next.resources.fuelDays} days left)`,
      'Station heating and electrical systems are at high risk of complete shutdown during next weather cell.',
      'Ration fuel, combine heating zones, and request emergency flight payload delivery.'
    );
  }

  // Water: Population eats/drinks/washes
  const waterConsumptionPerCapita = 15; // Liters per day per person
  const dailyWaterUsage = next.population * waterConsumptionPerCapita;
  const hourlyWaterUsage = dailyWaterUsage / 24;

  if (scenario === 'water_shortage') {
    // Deplete water by exactly 2 days per tick (42000 liters per hour)
    next.resources.water = Math.max(100, next.resources.water - 42000 * timeDeltaHours);
  } else {
    // Water pump refills subglacial water (pump health affects refilling)
    const pumpHealthFactor = (next.equipment.find(e => e.id === 'eq_water_pump')?.health || 90) / 100;
    const waterRefillRate = scenario === 'snowstorm' ? 5 : 25 * pumpHealthFactor; // Storm slows refill
    next.resources.water = Math.max(0, Math.min(next.resources.waterCapacity, next.resources.water + (waterRefillRate - hourlyWaterUsage) * timeDeltaHours));
  }

  next.resources.waterDays = hourlyWaterUsage > 0 ? Math.round(next.resources.water / (hourlyWaterUsage * 24)) : 999;
  if (next.resources.waterDays < 5) {
    pushAlert(alertsQueue, next.stationId, 'water', 'warning',
      'Water reserves depleting rapidly',
      'Intake line or desalination units may have ice blockage. Risk of life-support disruption.',
      'Check heating tape on subglacial water lines and limit laundry/showers.'
    );
  }

  // Food: Decreases based on population
  const foodConsumptionPerCapita = 1; // unit per day per person
  const dailyFoodUsage = next.population * foodConsumptionPerCapita;
  const hourlyFoodUsage = dailyFoodUsage / 24;

  if (scenario === 'supply_delay') {
    // Fast depletion, food is not replenished
    next.resources.food = Math.max(10, next.resources.food - hourlyFoodUsage * timeDeltaHours * 3);
  } else {
    next.resources.food = Math.max(0, next.resources.food - hourlyFoodUsage * timeDeltaHours);
  }
  next.resources.foodDays = hourlyFoodUsage > 0 ? Math.round(next.resources.food / (hourlyFoodUsage * 24)) : 999;

  // Equipment Status updating
  next.equipment.forEach(eq => {
    // HVac load increases in storms
    if (eq.id === 'eq_hvac' && scenario === 'snowstorm') {
      eq.health = Math.max(30, eq.health - 0.5 * timeDeltaHours * 5);
    }
    // Water pump health drops if frozen (extreme temp)
    if (eq.id === 'eq_water_pump') {
      if (scenario === 'water_shortage' || next.weather.temp < -40) {
        eq.health = Math.max(20, eq.health - (scenario === 'water_shortage' ? 1.8 : 0.3) * timeDeltaHours * 5);
      }
      if (scenario === 'water_shortage') {
        eq.status = 'critical';
      }
    }
    // Satellite dish affected by high winds
    if (eq.id === 'eq_satellite' && next.weather.windSpeed > 80) {
      eq.health = Math.max(15, eq.health - 0.6 * timeDeltaHours * 5);
    }

    eq.failureProb = Math.round((100 - eq.health) * 0.6);
    if (eq.id !== 'eq_water_pump' || scenario !== 'water_shortage') {
      eq.status = eq.health < 40 ? 'critical' : eq.health < 75 ? 'degraded' : 'nominal';
    }

    if (eq.health < 45 && alertsQueue) {
      pushAlert(alertsQueue, next.stationId, 'equipment', 'warning',
        `Equipment degradation: ${eq.name} at ${Math.round(eq.health)}% health`,
        'Higher probability of sudden component failure which will disrupt station logistics.',
        'Schedule maintenance team and dispatch replacement parts from warehouse.'
      );
    }
  });

  // Calculate scores
  next.healthScore = calculateHealthScore(next, alertsQueue);
  next.riskLevel = determineRiskLevel(next.healthScore);

  return next;
}

// Push alerts securely and avoid duplicates
function pushAlert(queue, stationId, type, severity, message, impact, action) {
  const duplicate = queue.find(a => a.stationId === stationId && a.type === type && a.message === message && a.active);
  if (!duplicate) {
    queue.push({
      id: `${type}_${Date.now()}_${Math.round(Math.random() * 100)}`,
      stationId,
      timestamp: new Date(),
      type,
      severity,
      message,
      impact,
      action,
      active: true
    });
  }
}

// Generate 30 days of historical time series data
function generateHistoricalData(stationId, daysCount = 30) {
  const history = [];
  let baseState = stationId === 'maitri' ? JSON.parse(JSON.stringify(baselineMaitri)) : JSON.parse(JSON.stringify(baselineBharati));

  // Set date back by daysCount
  let time = new Date();
  time.setDate(time.getDate() - daysCount);

  // We'll jump in steps of 6 hours to get 4 points per day -> 120 points total
  const steps = daysCount * 4;
  const timeDeltaHours = 6;

  for (let i = 0; i < steps; i++) {
    // Occasionally trigger high winds or minor failures in history to make charts look interesting
    let historyScenario = 'none';
    if (i % 25 === 0) historyScenario = 'snowstorm';
    else if (i % 40 === 0) historyScenario = 'generator_failure';

    // Simulate state
    const simulatedAlerts = [];
    baseState = simulateNextState(baseState, historyScenario, timeDeltaHours, simulatedAlerts);
    baseState.timestamp = new Date(time);

    // Save records
    history.push(JSON.parse(JSON.stringify(baseState)));

    // Advance time
    time.setHours(time.getHours() + timeDeltaHours);
  }

  return history;
}

// Run a what-if forecasting timeline (Day 0 to Day 7)
function runForecastTimeline(stationId, scenario) {
  let state = stationId === 'maitri' ? JSON.parse(JSON.stringify(baselineMaitri)) : JSON.parse(JSON.stringify(baselineBharati));
  const timeline = [];

  // Generate for Day 0 (Current state)
  state.timestamp = new Date();
  timeline.push({
    day: 0,
    timestamp: new Date(state.timestamp),
    fuel: Math.round(state.resources.fuel),
    water: Math.round(state.resources.water),
    battery: Math.round(state.powerGrid.batterySoc),
    power: Math.round(state.powerGrid.load),
    healthScore: state.healthScore,
    risk: state.riskLevel,
    windSpeed: state.weather.windSpeed,
    temp: state.weather.temp
  });

  // Simulate Day 1 to Day 7 (step size = 1 day / 24 hours)
  for (let day = 1; day <= 7; day++) {
    // Keep scenario active
    const simulatedAlerts = [];
    state = simulateNextState(state, scenario, 24, simulatedAlerts);

    // Advance timestamp
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() + day);

    timeline.push({
      day: day,
      timestamp: dayDate,
      fuel: Math.round(state.resources.fuel),
      water: Math.round(state.resources.water),
      battery: Math.round(state.powerGrid.batterySoc),
      power: Math.round(state.powerGrid.load),
      healthScore: state.healthScore,
      risk: state.riskLevel,
      windSpeed: state.weather.windSpeed,
      temp: state.weather.temp
    });
  }

  return timeline;
}

module.exports = {
  baselineMaitri,
  baselineBharati,
  simulateNextState,
  generateHistoricalData,
  runForecastTimeline,
  calculateHealthScore,
  determineRiskLevel
};
