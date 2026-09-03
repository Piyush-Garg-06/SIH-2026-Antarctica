# POLARIS – Project Overview & Key Features

POLARIS (Antarctic Digital Twin & Mission Control) is a high-fidelity command and monitoring system designed for the efficient management of India's research stations (Maitri and Bharati) in Antarctica.

---

## 🛠️ Technology Stack
* **Frontend**: React, TypeScript, Vite, Tailwind CSS, Three.js / React Three Fiber, Leaflet Maps, Recharts.
* **Backend**: Node.js, Express, Socket.IO, MongoDB.

---

## 🚀 Key Features & Interface Architecture

### 1. Unified Main Dashboard (Overview Tab)
A cohesive 3-column operations layout designed to give operators instant situational awareness:
* **LEFT PANEL**:
  * **Global Integrity Index**: Real-time circular health gauge tracking total station structural and functional status.
  * **Risk Matrix**: Live atmospheric and connectivity parameters (Satellite link strength, offline buffered log counters).
  * **Resource Quick-View**: Bar status tracking Diesel SAB volume, Water tank capacity, and battery charge levels.
  * **Asset Inspector**: Instant telemetry readout showing core diagnostics (thermal readings, electrical load, vibration health) of selected station assets.
* **CENTER HERO VIEWPORT**:
  * **Interactive 3D Digital Twin**: Centerpiece WebGL render of the station using realistic, engineered assets.
  * **Bottom Command Console Tray**: Space-efficient panel with five tabs:
    * `[DEMO WIZARD]`: A step-by-step walkthrough detailing 7 operational steps for judges.
    * `[WHAT-IF ENGINE]`: A physical simulation manager to trigger blizzards or generator trips with 7-day predictive projection curves.
    * `[AI COPILOT]`: A chat interface consulting a local/remote AI advisor on telemetry anomalies and guidelines.
    * `[OPS MEMO]`: A report generator compiling live metrics into a formal printable daily operations summary.
    * `[SYSTEM LOGS]`: A live event feed showing local store-and-forward edge logs.
* **RIGHT PANEL**:
  * **Meteorology Conditions**: Temperature, wind speed, direction, and storm risk gauges.
  * **Interactive 2D GIS Map**: Satellite Leaflet layout showing station location and secondary station health levels.
  * **Power overview**: Total active generator capacity vs actual grid consumption load.
  * **Anomaly Alert Feed**: A list of real-time alerts with direct "Clear Alert" action resolution.

---

### 2. Upgraded 3D Digital Twin Viewport
Upgraded from basic boxes to highly realistic industrial structures:
* **Engineered Geometries**:
  * **Raised Stilts & Diagonal Braces**: Structural supports configured to prevent snow accumulation, complete with engineering steel truss cross-bracing.
  * **Admin & Living Pods**: Insulated panels, skylight windows (which glow at night), entrance staircases, exhaust vents, and sloped rooftops layered with dark-blue photovoltaic solar cell arrays.
  * **Science Labs Module**: Octagonal module with a glass geodesic observatory dome on top and a vertical cyan scientific laser guide beam shining into the polar sky.
  * **Warehouse Depot**: A large curved metallic quonset hangar structure with rolling doors and surrounding cargo container boxes.
  * **Power House Generators**: Detailed generator cabins with rooftop radiator cowls, rotating fan blades, and dynamic exhaust muffler particle pipes emitting smoke when active.
  * **Fuel Storage Basin**: Vertical SAB diesel tanks with spiraling staircases and horizontal saddles, displaying orange liquid level indicators.
* **Environmental & Flow Shading**:
  * **Indian Tricolor Flag**: Procedural waving flag using a sin-wave vertex displacement shader.
  * **Antarctic Terrain**: Non-flat, irregular snow terrain with distant glacial peaks/glaciers and flattened vehicle paths.
  * **Procedural Blizzard**: Particles drift horizontally based on active wind velocities.
  * **Dynamic Pipelines**: Orange, blue, and grey conduits mapping fuel, water, and power flow lines, with animated glowing spheres moving along paths when active.

---

### 3. Dedicated Operational Sector Pages
* **Power Grid**: Large dynamic electrical flow schematics showing paths between generators, battery banks, and consuming building nodes. Includes predictive wear analysis cards.
* **Habitat**: Occupational counts, HVAC climate indices, and detailed food/medical/mechanical stocks.
* **Science**: MET sensor matrices (temperature, pressure, speed, direction) and scientific research observatory project readouts.
* **Comms**: Latency graphs, SATCOM dish parameters, active satellites, and offline edge log sync controls.
* **Logistics**: 30-day AreaChart tracking SAB fuel and water consumption, combined with supply vessel maritime scheduling.
