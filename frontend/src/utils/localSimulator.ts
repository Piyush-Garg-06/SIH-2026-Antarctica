// Local Telemetry Simulator for Offline-First Edge Operations
// Replicates the physics engine in the frontend when satellite link is offline.

export function simulateOfflineStep(currentState: any, scenario: string, timeDeltaHours: number = 0.05, alertsQueue: any[] = []) {
  // Deep clone
  const next = JSON.parse(JSON.stringify(currentState));
  next.timestamp = new Date().toISOString();

  // 1. Weather Simulation
  const tempDelta = (Math.random() - 0.5) * 1.5;
  const windDelta = (Math.random() - 0.5) * 3;

  if (scenario === 'snowstorm') {
    next.weather.temp = Math.max(-65, next.weather.temp - 0.8 * timeDeltaHours * 20);
    next.weather.windSpeed = Math.min(130, next.weather.windSpeed + 2.5 * timeDeltaHours * 20);
    next.weather.risk = Math.min(100, Math.round(next.weather.windSpeed * 0.75 + Math.abs(next.weather.temp) * 0.5));
    next.weather.forecast = 'OFFLINE ALERT: MAJOR BLIZZARD CURRENTLY ACTIVE';
    next.weather.pressure = Math.max(940, next.weather.pressure - 1.2 * timeDeltaHours * 20);
  } else {
    next.weather.temp = Math.max(-45, Math.min(-10, next.weather.temp + tempDelta * timeDeltaHours));
    next.weather.windSpeed = Math.max(5, Math.min(65, next.weather.windSpeed + windDelta * timeDeltaHours));
    next.weather.risk = Math.round(next.weather.windSpeed * 0.4 + Math.abs(next.weather.temp) * 0.3);
    next.weather.pressure = Math.max(965, Math.min(1015, next.weather.pressure + (Math.random() - 0.5) * timeDeltaHours));
    next.weather.forecast = next.weather.windSpeed > 45 ? 'Increasing winds, cold temperatures (Local Cache)' : 'Stable polar conditions (Local Cache)';
  }

  // 2. Weather Impact -> Heating & Power Load
  const baseHeatingLoad = next.stationId === 'maitri' ? 40 : 50;
  const tempFactor = Math.max(0, -15 - next.weather.temp) * 1.2;
  const windFactor = Math.max(0, next.weather.windSpeed - 30) * 0.3;
  const weatherHeatingDemand = baseHeatingLoad + tempFactor + windFactor;
  const baseStaticLoad = next.stationId === 'maitri' ? 70 : 85;

  let scientificLoad = next.stationId === 'maitri' ? 20 : 25;
  if (scenario === 'equipment_overload') {
    scientificLoad = 90;
  }

  const freezeLoadPenalty = scenario === 'water_shortage' ? 25 : 0;
  next.powerGrid.load = Math.round(baseStaticLoad + weatherHeatingDemand + scientificLoad + freezeLoadPenalty);

  // Buildings temp
  next.buildings.forEach((b: any) => {
    if (b.id === 'bld_admin') b.load = Math.round(next.powerGrid.load * 0.25);
    else if (b.id === 'bld_living') b.load = Math.round(next.powerGrid.load * 0.35 + (scenario === 'snowstorm' ? 15 : 0));
    else if (b.id === 'bld_labs') b.load = Math.round(scientificLoad + 10);
    else if (b.id === 'bld_utility') b.load = Math.round(next.powerGrid.load * 0.15 + (scenario === 'water_shortage' ? 18 : 0));

    const heatSufficiency = (scenario === 'generator_failure' && next.powerGrid.batterySoc < 10) ? 0.3 : 1.0;
    const coolingRate = Math.max(0, -10 - next.weather.temp) * 0.05 * (1 - heatSufficiency);
    b.temp = Math.max(5, Math.min(23, b.temp - coolingRate * timeDeltaHours * 5 + (Math.random() - 0.5) * 0.1));
    b.status = b.temp < 15 ? 'cooling_issue' : b.load > 70 ? 'high_load' : 'normal';
  });

  // 3. Generator Status and capacity
  if (scenario === 'generator_failure') {
    next.generators[0].status = 'offline';
    next.generators[0].load = 0;
    next.generators[0].temp = Math.max(20, next.generators[0].temp - 10 * timeDeltaHours * 10);
    next.generators[0].health = Math.max(10, next.generators[0].health - 5);
    next.generators[0].failureProb = 100;
  }

  next.generators.forEach((gen: any) => {
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

  const runningGens = next.generators.filter((g: any) => g.status === 'running');
  const availableCapacity = runningGens.length * (next.stationId === 'maitri' ? 100 : 120);
  next.powerGrid.capacity = availableCapacity;

  if (runningGens.length > 0) {
    const loadPerGen = Math.min(110, (next.powerGrid.load / availableCapacity) * 100);
    runningGens.forEach((gen: any) => {
      gen.load = Math.round((loadPerGen / 100) * (next.stationId === 'maitri' ? 100 : 120));
      const targetTemp = 60 + (gen.load / (next.stationId === 'maitri' ? 100 : 120)) * 30;
      gen.temp += (targetTemp - gen.temp) * 0.2 * timeDeltaHours * 20;
      gen.fuelRate = gen.load * 0.22;

      const wearRate = (gen.load > 85 ? 0.8 : 0.1) * timeDeltaHours;
      gen.health = Math.max(10, gen.health - wearRate * 2);
      gen.failureProb = Math.min(100, Math.round((100 - gen.health) * 0.5 + (gen.temp > 90 ? 20 : 0)));

      if (gen.temp > 90) {
        pushLocalAlert(alertsQueue, next.stationId, 'generator', 'critical',
          `[LOCAL] ${gen.name} overheating detected (${Math.round(gen.temp)}°C)`,
          'High thermal stress can lead to sudden mechanical seize.',
          'Throttle non-essential station loads locally.'
        );
      }
    });
  }

  // 4. Battery SoC
  const actualGeneration = Math.min(next.powerGrid.load, availableCapacity);
  const powerDeficit = next.powerGrid.load - actualGeneration;

  if (scenario === 'battery_failure') {
    next.powerGrid.batterySoc = 0;
    next.powerGrid.batteryHealth = 10;
    next.powerGrid.batteryTemp = 48;
  } else {
    if (powerDeficit > 0) {
      const dischargeRate = (powerDeficit / 200) * 100;
      next.powerGrid.batterySoc = Math.max(0, next.powerGrid.batterySoc - dischargeRate * timeDeltaHours);
      next.powerGrid.batteryTemp = Math.min(50, next.powerGrid.batteryTemp + 4 * timeDeltaHours * 5);
      if (next.powerGrid.batterySoc < 20) {
        pushLocalAlert(alertsQueue, next.stationId, 'battery', 'critical',
          '[LOCAL] Critical battery state of charge (SoC < 20%)',
          'Station will experience complete power grid collapse.',
          'Start Emergency Generator G3 immediately.'
        );
      }
    } else {
      const surplus = availableCapacity - next.powerGrid.load;
      if (surplus > 10 && next.powerGrid.batterySoc < 98) {
        const chargeRate = (surplus / 200) * 80;
        next.powerGrid.batterySoc = Math.min(100, next.powerGrid.batterySoc + chargeRate * timeDeltaHours);
        next.powerGrid.batteryTemp = Math.max(15, next.powerGrid.batteryTemp - 1 * timeDeltaHours * 5);
      }
    }
  }

  // 5. Resources
  const totalFuelBurnRate = next.generators.reduce((sum: number, g: any) => sum + (g.status === 'running' ? g.fuelRate : 0), 0);
  if (scenario === 'fuel_shortage') {
    next.resources.fuel = Math.max(1000, next.resources.fuel - 2000 * timeDeltaHours * 20);
  } else {
    next.resources.fuel = Math.max(0, next.resources.fuel - totalFuelBurnRate * timeDeltaHours);
  }
  next.resources.fuelDays = totalFuelBurnRate > 0 ? Math.round(next.resources.fuel / (totalFuelBurnRate * 24)) : 999;

  // Water
  const waterConsumptionPerCapita = 15;
  const dailyWaterUsage = next.population * waterConsumptionPerCapita;
  const hourlyWaterUsage = dailyWaterUsage / 24;

  if (scenario === 'water_shortage') {
    next.resources.water = Math.max(100, next.resources.water - 500 * timeDeltaHours * 20);
  } else {
    const waterRefillRate = scenario === 'snowstorm' ? 5 : 22;
    next.resources.water = Math.max(0, Math.min(next.resources.waterCapacity, next.resources.water + (waterRefillRate - hourlyWaterUsage) * timeDeltaHours));
  }
  next.resources.waterDays = hourlyWaterUsage > 0 ? Math.round(next.resources.water / (hourlyWaterUsage * 24)) : 999;

  // Food
  const hourlyFoodUsage = next.population / 24;
  if (scenario === 'supply_delay') {
    next.resources.food = Math.max(10, next.resources.food - hourlyFoodUsage * timeDeltaHours * 3);
  } else {
    next.resources.food = Math.max(0, next.resources.food - hourlyFoodUsage * timeDeltaHours);
  }
  next.resources.foodDays = hourlyFoodUsage > 0 ? Math.round(next.resources.food / (hourlyFoodUsage * 24)) : 999;

  // Equipment updating
  next.equipment.forEach((eq: any) => {
    if (eq.id === 'eq_hvac' && scenario === 'snowstorm') {
      eq.health = Math.max(30, eq.health - 0.5 * timeDeltaHours * 5);
    }
    if (eq.id === 'eq_water_pump') {
      if (scenario === 'water_shortage' || next.weather.temp < -40) {
        eq.health = Math.max(20, eq.health - (scenario === 'water_shortage' ? 1.8 : 0.3) * timeDeltaHours * 5);
      }
      if (scenario === 'water_shortage') {
        eq.status = 'critical';
      }
    }
    eq.failureProb = Math.round((100 - eq.health) * 0.6);
    if (eq.id !== 'eq_water_pump' || scenario !== 'water_shortage') {
      eq.status = eq.health < 40 ? 'critical' : eq.health < 75 ? 'degraded' : 'nominal';
    }
  });

  // Calculate local health score
  next.healthScore = calculateLocalHealthScore(next, alertsQueue);
  next.riskLevel = next.healthScore >= 85 ? 'Low' : next.healthScore >= 65 ? 'Medium' : next.healthScore >= 45 ? 'High' : 'Critical';

  return next;
}

function pushLocalAlert(queue: any[], stationId: string, type: string, severity: string, message: string, impact: string, action: string) {
  const duplicate = queue.find(a => a.stationId === stationId && a.type === type && a.message === message && a.active);
  if (!duplicate) {
    queue.push({
      id: `${type}_local_${Date.now()}`,
      stationId,
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      impact,
      action,
      active: true
    });
  }
}

function calculateLocalHealthScore(telemetry: any, activeAlerts: any[]) {
  let score = 100;
  const fuelDays = Number(telemetry.resources?.fuelDays ?? 0);
  const waterDays = Number(telemetry.resources?.waterDays ?? 0);
  const batterySoc = Number(telemetry.powerGrid?.batterySoc ?? 0);
  const offlineGens = telemetry.generators.filter((g: any) => g.status === 'offline').length;

  if (telemetry.powerGrid.batterySoc < 20) score -= 15;
  else if (telemetry.powerGrid.batterySoc < 40) score -= 8;

  if (fuelDays <= 1) score -= 35;
  else if (fuelDays <= 3) score -= 25;
  else if (fuelDays <= 7) score -= 18;
  else if (fuelDays <= 15) score -= 10;
  else if (fuelDays <= 30) score -= 5;

  if (waterDays <= 2) score -= 20;
  else if (waterDays <= 5) score -= 14;
  else if (waterDays <= 10) score -= 8;

  score -= offlineGens * 8;
  if (telemetry.weather.risk > 80) score -= 15;
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical' && a.active).length;
  score -= (criticalAlerts * 8);

  if (fuelDays <= 3 || waterDays <= 5 || batterySoc < 20 || offlineGens > 0) {
    score = Math.min(score, 35);
  } else if (fuelDays <= 7 || waterDays <= 10 || batterySoc < 35) {
    score = Math.min(score, 55);
  } else if (fuelDays <= 15 || waterDays <= 15 || batterySoc < 50 || telemetry.weather.risk > 60) {
    score = Math.min(score, 70);
  } else if (fuelDays <= 30 || waterDays <= 30 || batterySoc < 65) {
    score = Math.min(score, 82);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
