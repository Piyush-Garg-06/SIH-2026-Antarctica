# POLARIS — Findings & Fixes (from the real codebase, not screenshots)

This replaces the earlier "reference patch" files — those were educated guesses from photos; everything below is diagnosed from and applied directly to your actual code, and the project builds clean (`tsc && vite build` succeeds, all edited `.js` files pass `node --check`).

## What this codebase actually is, first — because it changes the diagnosis

This is a genuinely faithful implementation of the v3 hybrid-MQTT spec. `station-agent/agent.js` runs a real embedded Aedes broker with the exact topic map, drain loop, and Day-11 anomaly detection we designed. `relay/relay.js` is the hand-rolled two-connection bridge with the impairment injector. `backend/server.js` runs its own embedded mainland broker, subscribes to everything correctly, and even has the upsert-by-recordId idempotency fix already in place. This is not a toy — the MQTT layer is real and was built carefully.

The bugs below aren't "the MQTT thing doesn't work." They're in the seams between three independently-minded processes that don't always agree on who owns what.

---

## Bug 1 (the big one): health score snaps back to critical within ~3 seconds of dismissing/restoring

**Root cause:** `backend/server.js` and `station-agent/agent.js` **both** compute `healthScore`, and they disagree about what "current alerts" means. Station-agent has no idea an operator dismissed something on the mainland side — dismissal only exists in `backend/server.js`'s in-memory `dismissedAlertIds`/`dismissedAlertTypes` Sets, which never get communicated back over MQTT.

Sequence that was happening:
1. Operator dismisses an alert → `backend/server.js` correctly filters it out and recomputes a fresh, lower score → broadcasts it → dashboard briefly shows the fix.
2. ~3 seconds later, station-agent's telemetry loop fires again, still counting that alert (it was never told), and publishes its own healthScore.
3. `backend/server.js`'s MQTT handler did `activeStates[stationId] = telemetry` — a blind overwrite that discarded its own correction and put the stale score right back.

**Fix (`backend/server.js`):** after filtering alerts on every incoming telemetry message, recompute `healthScore`/`riskLevel` locally using the filtered list, instead of trusting whatever station-agent included in the payload. Mainland's dismissed-state is now always applied on top of raw station telemetry, not overwritten by it.

**Verify:** dismiss an alert, watch the score — it should stay fixed, not revert a few seconds later.

## Bug 2: anomaly alerts pile up forever and survive Restore Baseline

Two compounding issues in `station-agent/agent.js`:

**2a — dedup was comparing the full alert message, which embeds the live Z-score** (`Z: 5.9`, `Z: 3.2`, etc.) — a number that's essentially never identical twice. So the "prevent duplicate" check never matched, and the same recurring condition kept generating a brand new alert entry every cycle. This is exactly why your report showed 20+ near-identical "Generator thermal anomaly" entries with slightly different Z-values each time.

**2b — a related numerical bug**: when the rolling window has near-zero (but not exactly zero) variance, `(val - mean) / stdDev` blows up to an enormous, meaningless number — this is where entries like `Z: 469124961185.3` came from.

**2c — Restore Baseline only ever cleared `sim_`-prefixed alerts**, never `anomaly_`-prefixed ones. Anomaly alerts are `severity: 'warning'`, worth -3 each to the score — with 20 phantom anomalies never cleared, that's -60 points sitting on the score permanently, regardless of whether weather/generators genuinely reset.

**Fixes (`station-agent/agent.js`):**
- Anomaly dedup now keys on `(stationId, anomalySource type)`, updating the existing alert in place instead of creating a new one each cycle.
- Z-score calculation now treats stdDev below a small epsilon as "insufficient variance," same as the existing zero-check.
- Restore Baseline now clears anomaly-type alerts too, and resets the rolling detection windows (otherwise storm-skewed history makes freshly-normal readings look anomalous relative to it).

**Verify:** run the blizzard scenario, let a few anomalies accumulate, hit Restore Baseline — alert count and score should both return to nominal, and the report shouldn't show a wall of near-duplicate anomaly entries next time.

## Bug 3: 3D Power House doesn't visibly react to backup power engaging

This wasn't a stale-data bug — the data was flowing into the 3D component correctly the whole time (worth knowing, since it means the underlying architecture is sound). The real issue: `GeneratorUnit` in `DigitalTwin3D.tsx` only ever had four visual states — selected, hovered, critical, or default — and "critical" only triggers on `status === 'critical'`, `temp > 85`, or global emergency mode. `powerGrid.backupActive` is a real field, genuinely set `true` by the physics simulation, but it was never wired to anything visual at all.

**Fix:** added a `backupActive` prop to `GeneratorUnit`, wired it through from `telemetry.powerGrid.backupActive` at the call site, and added a distinct pulsing blue emissive (separate from the critical-red state) so backup engaging is visible ambiently without being mistaken for a fault.

**Verify:** trigger a scenario that drains battery enough to engage backup (generator_failure is the most direct path), watch the Power House model in the 3D Twin tab without clicking anything — it should pulse blue.

**Known limitation, not fixed:** there's still no visual for "power gradually lowering" specifically, since that needs a trend (previous vs. current value), and no component currently tracks that. `backupActive` is a real boolean the physics already computes, so it was the cheap, honest fix; a true declining-trend visual would need new state and is a separate, larger task if you want it.

## Bug 4: nearest-station panel — wrong distances, no way to act on it

`App.tsx` had two copies of this panel (Overview and Alerts pages), both showing Novolazarevskaya at 5 km and Progress II at 9 km — verified real figures are ~3.5 km and ~3 km. Also, no button or contact info existed at all, just descriptive text.

**Fix:** corrected both distance figures in both locations, and added a clearly-labeled "Request Mutual Aid (Simulated)" button plus a one-line honest note about how this would really work (HF/VHF radio, COMNAP procedures) — consistent with how the AI copilot and weather panel are already labeled real-vs-simulated elsewhere in the app. The button logs to the existing Live Console Output panel via `addSystemLog`, reusing what's already there rather than inventing a new backend endpoint.

## Bug 5 (minor): relay's LWT only ever covers Maitri, never Bharati

`relay/relay.js` had `station/maitri/heartbeat` hardcoded as the Last Will topic — but one relay connection serves both stations, so a real disconnect means both go offline simultaneously, not just Maitri.

**Fix:** the will now publishes to a relay-level `relay/status` topic instead of impersonating one station, and `backend/server.js` subscribes to it and marks both stations offline when it fires — which is what's actually true architecturally.

---

## What I did NOT touch

Everything else — the MQTT topic design, the drain loop, the command queue, the impairment injector, the audit log, the weather scraper — was already correct and matched the v3 spec closely. I only changed what was demonstrably broken.

## Verification performed

- `node --check` passed on all three edited `.js` files.
- `npx tsc --noEmit` — zero errors in either edited `.tsx` file.
- `npm run build` — full production build succeeded clean.

None of this was run live end-to-end (I don't have your MongoDB/relay/station-agent processes running here), so the Day-1-style checkpoint still applies: have your teammate run the actual multi-process stack and rehearse the dismiss → restore → 3D-twin → nearest-station sequence before treating this as demo-ready.
