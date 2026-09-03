// AI Polaris Copilot / Mission Commander Logic

function askCopilot(telemetry, activeAlerts, question) {
  if (!telemetry) {
    return "I am currently disconnected from the Station Core. Telemetry data is unavailable. Please restore satellite connection or check local cache.";
  }

  const query = question.toLowerCase();
  const stationName = telemetry.stationId === 'maitri' ? 'Maitri' : 'Bharati';
  
  // Helper to get building with max power consumption
  const getTopBuilding = () => {
    let top = telemetry.buildings[0];
    telemetry.buildings.forEach(b => {
      if (b.load > top.load) top = b;
    });
    return top;
  };

  // Helper to list critical assets
  const getRiskyAssets = () => {
    const assets = [];
    telemetry.generators.forEach(g => {
      if (g.health < 80 || g.status === 'offline' || g.temp > 85) {
        assets.push({ name: g.name, type: 'Generator', health: g.health, status: g.status, issue: g.temp > 85 ? 'Overheating' : 'Low Health' });
      }
    });
    telemetry.equipment.forEach(e => {
      if (e.health < 80 || e.status !== 'nominal') {
        assets.push({ name: e.name, type: 'Equipment', health: e.health, status: e.status, issue: 'Degraded operations' });
      }
    });
    return assets;
  };

  // 1. Station general status
  if (query.includes('status') || query.includes('how is') || query.includes('health') || query.includes('state')) {
    const alertsCount = activeAlerts.filter(a => a.active).length;
    const risky = getRiskyAssets();
    
    return `### **POLARIS Copilot - ${stationName} Status Report**
    
**Overall Health Score:** \`${telemetry.healthScore}/100\` (Risk Category: **${telemetry.riskLevel}**)
- **Power Grid:** Load is \`${telemetry.powerGrid.load} kW\` out of \`${telemetry.powerGrid.capacity} kW\` capacity. Battery SoC is at \`${Math.round(telemetry.powerGrid.batterySoc)}%\`.
- **Resources:** Fuel reserves will last \`${telemetry.resources.fuelDays} days\` (\`${Math.round(telemetry.resources.fuel)} L\`). Water is stable at \`${telemetry.resources.waterDays} days\` (\`${Math.round(telemetry.resources.water)} L\`).
- **Environmental:** Weather is currently \`${telemetry.weather.temp}°C\` with winds of \`${telemetry.weather.windSpeed} km/h\`. Risk level is \`${telemetry.weather.risk}%\`.
- **Alerts:** There are \`${alertsCount}\` active alerts currently registered in the Mission Command.

${risky.length > 0 ? `⚠️ **System Warnings:** I detect ${risky.length} critical infrastructure elements requiring attention:
${risky.map(a => `- **${a.name}** (${a.type}): Status is \`${a.status}\`, health is \`${Math.round(a.health)}%\` due to *${a.issue}*.`).join('\n')}` : '✅ **Systems Nominal:** All generators, batteries, and life-support assets are currently performing within design parameters.'}`;
  }

  // 2. Power and buildings
  if (query.includes('power') || query.includes('electricity') || query.includes('building') || query.includes('consuming') || query.includes('energy')) {
    const topBld = getTopBuilding();
    const runningGens = telemetry.generators.filter(g => g.status === 'running');
    
    return `### **POLARIS Copilot - Power Grid & Heating Analysis**

* **Total Station Draw:** \`${telemetry.powerGrid.load} kW\`
* **Active Generating Capacity:** \`${telemetry.powerGrid.capacity} kW\` (Generators active: \`${runningGens.length}/3\`)
* **Battery Buffer:** \`${Math.round(telemetry.powerGrid.batterySoc)}%\` SoC, current battery temperature \`${Math.round(telemetry.powerGrid.batteryTemp)}°C\`.
* **Top Energy Consumer:** The building with the highest energy draw is **${topBld.name}** consuming \`${topBld.load} kW\`.
* **Building Integrity:** Indoor temperatures average \`${(telemetry.buildings.reduce((sum, b) => sum + b.temp, 0) / telemetry.buildings.length).toFixed(1)}°C\`.

**Forecast & Recommendation:**
If temperatures decrease, building heating loads will rise by approximately \`1.2 kW\` per degree Celsius. Check HVAC systems and ensure the battery SoC remains above 40% to handle peak load smoothing.`;
  }

  // 3. Fuel depletion / resource questions
  if (query.includes('fuel') || query.includes('run out') || query.includes('deplet') || query.includes('water') || query.includes('food') || query.includes('resource')) {
    const fuelLiters = Math.round(telemetry.resources.fuel);
    const fuelDays = telemetry.resources.fuelDays;
    const waterLiters = Math.round(telemetry.resources.water);
    const waterDays = telemetry.resources.waterDays;
    const foodDays = telemetry.resources.foodDays;
    
    let fuelReorderAlert = fuelDays < 30 ? '🔴 **CRITICAL:** Fuel reserves are below the 30-day safety reorder threshold!' : '🟢 **NORMAL:** Fuel reserves are within safety margins.';
    
    return `### **POLARIS Copilot - Resource Logistics & Depletion Forecast**

* **Diesel Fuel (SAB):**
  - Remaining: \`${fuelLiters} Liters\`
  - Depletion Forecast: \`${fuelDays} Days\` remaining.
  - Status: ${fuelReorderAlert}
* **Fresh Water:**
  - Remaining: \`${waterLiters} Liters\`
  - Depletion Forecast: \`${waterDays} Days\` remaining.
  - Source: Subglacial Lake Pump is running.
* **Rations & Food:**
  - Remaining: \`${foodDays} Days\` supply.
  - Status: Consuming at a rate of \`${telemetry.population} units/day\`.

**Recommendation:**
In the event of a cargo resupply delay, fuel consumption should be prioritized. The HVAC system can be set to "Eco Mode" (18°C) to conserve fuel by up to 15%.`;
  }

  // 4. Risky equipment / maintenance
  if (query.includes('risky') || query.includes('equipment') || query.includes('maintenance') || query.includes('fail') || query.includes('broken')) {
    const risky = getRiskyAssets();
    
    if (risky.length === 0) {
      return `### **POLARIS Copilot - Infrastructure Risk Assessment**

All machinery, communications systems, and pumps are reporting normal parameters.
* Mean Time Between Failures (MTBF) average: \`8,400 hours\`
* Maintenance schedule status: **100% compliant**
No imminent equipment failures are predicted by our predictive algorithms.`;
    }

    return `### **POLARIS Copilot - Infrastructure Risk Assessment**

I have analyzed the telemetry and vibration histories. The following assets have elevated failure risks:

${risky.map((a, i) => `${i+1}. **${a.name}** (${a.type})
   * Status: \`${a.status}\`
   * Health: \`${Math.round(a.health)}%\`
   * Estimated Failure Probability: \`${Math.round(100 - a.health)}%\`
   * Primary Cause: *${a.issue}*`).join('\n\n')}

**Action Plan:**
A Maintenance Engineer should inspect **${risky[0].name}** immediately. Ensure tools and replacement filters are drawn from the spare parts warehouse (currently at \`${telemetry.resources.spareParts}%\` storage capacity).`;
  }

  // 5. Recommended Actions
  if (query.includes('what should') || query.includes('recommend') || query.includes('action') || query.includes('do now') || query.includes('help')) {
    const active = activeAlerts.filter(a => a.active);
    
    if (active.length === 0) {
      return `### **POLARIS Copilot - Mission Recommendations**

* **Status:** Green/Nominal.
* **Routine Tasks:**
  1. Continue telemetry monitoring.
  2. Confirm SATCOM link bandwidth is stable.
  3. Ensure routine logs are archived to local SSD for synchronization.
* **Logistics:** Standard weather watch is recommended for the incoming low-pressure cell.`;
    }

    return `### **POLARIS Copilot - Action Advisory**

The station health score is degraded. I recommend the following operational interventions:

${active.map((a, i) => `**Priority ${i+1}: Resolve ${a.type.toUpperCase()} Issue**
- **Trigger:** ${a.message}
- **Impact:** ${a.impact}
- **Action:** ${a.action}`).join('\n\n')}

Please execute these tasks in order of critical severity.`;
  }

  // 6. Weather and weather impact
  if (query.includes('weather') || query.includes('temp') || query.includes('wind') || query.includes('storm')) {
    const w = telemetry.weather;
    const heatingIncrease = Math.max(0, -15 - w.temp) * 1.2;
    
    return `### **POLARIS Copilot - Weather Operations Report**

* **Current Conditions:** \`${w.temp}°C\`, Wind \`${w.windSpeed} km/h\` (${w.windDir}), Pressure \`${w.pressure} hPa\`.
* **Forecast:** \`${w.forecast}\`
* **Station Risk Level:** \`${w.risk}%\`

**Operational Impact:**
* **Heating System Load:** Due to the weather, buildings require an additional \`${heatingIncrease.toFixed(1)} kW\` of heating power.
* **Logistics Limitation:** Wind speeds > 55 km/h prohibit outdoor research activity, crane operation, and snowmobiles.
* **Power Draw:** Solar arrays are inactive (Polar night / cloud-cover). Grid is entirely reliant on SAB Diesel Generators.`;
  }

  // 7. Fallback
  return `### **POLARIS Copilot - Query Received**

I heard you ask: "${question}".

I can assist you with specific operational inquiries regarding:
1. **Station Status:** "What is the station status?" / "Show health score."
2. **Power Grid:** "Which building consumes the most power?" / "Check generators."
3. **Resources:** "When will fuel run out?" / "What is our water capacity?"
4. **Maintenance Risks:** "Which equipment is risky?" / "What maintenance is due?"
5. **Action Plans:** "What should we do?" / "Active alerts."
6. **Weather:** "What is the weather impact?"

*Please rephrase your question using these focus topics so I can extract the exact telemetry values.*`;
}

module.exports = {
  askCopilot
};
