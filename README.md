# POLARIS – Antarctic Digital Twin & Mission Control

**POLARIS** is a high-fidelity, hackathon-ready Digital Twin, Mission Control, and AI decision-support system designed for the remote management of India's Antarctic Research Stations (**Maitri** and **Bharati**).

The system integrates a real-time causal physics simulation engine, interactive 3D WebGL digital twin, geographic information system (GIS) maps, and an AI commander copilot to manage energy grids, resources, weather risks, and life support systems in extreme polar environments.

---

## 🚀 Key Features

1. **Mission Control Center**:
   - **Interactive Leaflet GIS Map**: Live positions and status monitoring of Maitri and Bharati stations.
   - **Station Integrity Indicators**: Overall safety scores based on power grid state, thermal safety, and resource reserve levels.
   - **Real-Time Event Logs**: Dynamic terminal output showing real-time system adjustments.

2. **3D Digital Twin & Inspector (R3F)**:
   - High-fidelity visual modules representing Admin, Living, Science, Logistics, Comms, and Generators.
   - Grounded stilt structures, rotatable Satcom antennas, and animated wind anemometers.
   - **Asset Inspector**: Click components (e.g., G1 Generator, Fuel Storage) to check localized diagnostic state vectors.
   - **Polar Day/Night Lighting Controls**: Simulate day/night cycles with reactive lighting changes.

3. **Power Grid & Infrastructure Management**:
   - Live generator status (Standby, Running, Offline), thermal indicators, and load-shedding systems.
   - UPS Battery Buffer Storage diagnostics (SoC, Cell Temperature, health trends).
   - **Predictive Maintenance**: Failure probability predictions for critical telemetry assets.

4. **Resource Logistics & Timelines**:
   - Dynamic tracking of SAB Diesel Fuel, Lake Water, and Food Rations.
   - Historical inventory depletion rates rendered using area charts.
   - Resupply vessel tracking schedule (MV Vasiliy Golovnin).

5. **Causal Simulation Engine (What-If Scenarios)**:
   - Physics-linked simulation linking weather conditions directly to heating demand, fuel consumption, and battery drainage.
   - Interactive scenarios: Category 5 Blizzard, Generator Failure, Fuel Leaks, and Comms Outages.
   - 7-Day forecast graphs showing predicted health scores and grid load curves.

6. **AI Commander Copilot**:
   - An intelligent operations assistant providing cognitive diagnostics.
   - Preset commands and text query system for quick answers to station queries.

---

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Three Fiber / Three.js + Leaflet Maps + Recharts
- **Backend**: Node.js + Express + Socket.IO + MongoDB
- **Telemetry Ingestion**: Simulated Prototype Telemetry (Edge-capable with local queue fallback for offline operations)

---

## ⚙️ Project Structure

```
d:/SIH 2026/
├── backend/
│   ├── server.js          # Core Express & Socket.IO server
│   ├── simulation.js      # Causal physics simulation rules
│   ├── copilot.js         # AI command processing logic
│   └── models.js          # MongoDB schemas
└── frontend/
    ├── src/
    │   ├── App.tsx        # Dashboard Shell & State Controller
    │   ├── components/
    │   │   ├── DigitalTwin3D.tsx   # Three.js 3D WebGL base model
    │   │   └── StationMap.tsx      # Leaflet 2D GIS station map
    │   └── utils/
    │       └── localSimulator.ts   # Client-side backup simulation
    └── tsconfig.json
```

---

## ⚡ Setup & Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB](https://www.mongodb.com/) (running locally on default port 27017 or configured via backend `.env`)

### 2. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```
2. Start the backend server:
   ```bash
   npm start
   ```
   *The server will start listening on port `5000` and socket connection will initialize.*

### 3. Frontend Setup
1. Open another terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🎯 Hackathon Presentation Script (WOW-Factor Demo Journey)

When presenting to the judges, follow this sequence:

1. **Introduce the Base Screen (Mission Control)**:
   - Point out the Antarctic GIS Network Map showing Maitri and Bharati stations.
   - Demonstrate the global station integrity score (currently nominal, above 80%).

2. **Examine the 3D Digital Twin**:
   - Navigate to the **3D Twin** tab.
   - Toggle the **☾ NIGHT / ☼ DAY** modes to show how lighting shifts and warning beacons light up.
   - Click on the **SATCOM** dish or the **G1 Generator** to show the live asset data inspector.

3. **Simulate a Category 5 Blizzard**:
   - Go to the **Causal Engine** tab.
   - Select the **Category 5 Arctic Blizzard** scenario.
   - Point out how the outdoor temperature drops to `-55°C` and winds pick up.
   - Show how the heating demand surges, which automatically ramps up fuel consumption rates on the power grid.

4. **Simulate a Primary Generator Failure (Crisis Management)**:
   - Select **Primary Generator G1 Breakout**.
   - Show how the station integrity drops, alerts start flashing red, and the system switches load to batteries and standby generators.
   - Ask the **AI Copilot** tab: *"What should we do?"* to show the AI recommendation.

5. **Resolve the Crisis**:
   - Reset the scenario, show system recovering back to nominal status.
   - Generate and print/download the **Operations Memo** in the **Ops Reports** tab to show a completed, formal PDF printout of the day's event log.
