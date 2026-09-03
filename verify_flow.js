#!/usr/bin/env node

/**
 * Comprehensive Flow Verification Script
 * Tests:
 * 1. Water shortage scenario triggers health degradation
 * 2. Alert dismissal does NOT restore health
 * 3. Battery/Power load increases with water freeze
 * 4. Health stays degraded across all degradation ranges
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('\n🧪 COMPREHENSIVE FLOW VERIFICATION TEST\n');
    console.log('='.repeat(60));

    try {
        // Test 1: Get initial state
        console.log('\n✓ Test 1: Getting initial station state...');
        let res = await makeRequest('GET', '/api/stations/maitri/telemetry');
        if (res.status !== 200) throw new Error(`Failed to get telemetry: ${res.status}`);

        const initial = res.data.telemetry;
        console.log(`   Water Days: ${initial.resources.waterDays}`);
        console.log(`   Fuel Days: ${initial.resources.fuelDays}`);
        console.log(`   Battery SoC: ${initial.powerGrid.batterySoc}%`);
        console.log(`   Initial Health: ${initial.healthScore}/100`);
        console.log(`   Initial Risk: ${initial.riskLevel}`);
        console.log(`   Power Load: ${initial.powerGrid.load} kW`);

        const initialHealth = initial.healthScore;

        // Test 2: Trigger water shortage scenario
        console.log('\n✓ Test 2: Triggering WATER_SHORTAGE scenario...');
        res = await makeRequest('POST', '/api/simulations/run', {
            stationId: 'maitri',
            scenario: 'water_shortage'
        });
        if (res.status !== 200) throw new Error(`Failed to set scenario: ${res.status}`);
        console.log('   Water shortage scenario activated');

        // Test 3: Wait for degradation
        console.log('\n✓ Test 3: Waiting for degradation to critical threshold...');
        let waterDaysCurrent = initial.resources.waterDays;
        let attempts = 0;
        let resTemp;
        while (waterDaysCurrent > 5 && attempts < 15) {
            await sleep(2500);
            resTemp = await makeRequest('GET', '/api/stations/maitri/telemetry');
            waterDaysCurrent = resTemp.data.telemetry.resources.waterDays;
            attempts++;
            console.log(`   Progressive depletion: Water Days = ${waterDaysCurrent}`);
        }

        // Test 4: Get degraded state
        console.log('\n✓ Test 4: Getting degraded station state...');
        res = await makeRequest('GET', '/api/stations/maitri/telemetry');
        const degraded = res.data.telemetry;
        const degradedAlerts = res.data.alerts || [];

        console.log(`   Water Days: ${degraded.resources.waterDays}`);
        console.log(`   Battery SoC: ${degraded.powerGrid.batterySoc}%`);
        console.log(`   Degraded Health: ${degraded.healthScore}/100`);
        console.log(`   Degraded Risk: ${degraded.riskLevel}`);
        console.log(`   Power Load: ${degraded.powerGrid.load} kW (was ${initial.powerGrid.load} kW)`);
        console.log(`   Active Alerts: ${degradedAlerts.filter(a => a.active).length}`);

        if (degraded.resources.waterDays > initial.resources.waterDays) {
            console.log('   ⚠️  Water days should decrease!');
        }

        // Test 5: Record health before dismissal
        const healthBeforeDismissal = degraded.healthScore;
        console.log(`\n✓ Test 5: Recording health before dismissal: ${healthBeforeDismissal}/100`);

        // Test 6: Dismiss all alerts
        if (degradedAlerts.length > 0) {
            console.log('\n✓ Test 6: Dismissing all active alerts...');
            for (const alert of degradedAlerts) {
                if (alert.active) {
                    res = await makeRequest('POST', '/api/alerts/resolve', {
                        stationId: 'maitri',
                        alertId: alert.id
                    });
                    console.log(`   Dismissed: ${alert.severity.toUpperCase()} - ${alert.type}`);
                }
            }
        } else {
            console.log('\n✓ Test 6: No active alerts to dismiss');
        }

        // Test 7: Get state after dismissal
        console.log('\n✓ Test 7: Getting state after alert dismissal...');
        res = await makeRequest('GET', '/api/stations/maitri/telemetry');
        const afterDismissal = res.data.telemetry;
        const afterDismissalAlerts = res.data.alerts || [];

        console.log(`   Health After Dismissal: ${afterDismissal.healthScore}/100`);
        console.log(`   Risk After Dismissal: ${afterDismissal.riskLevel}`);
        console.log(`   Active Alerts After: ${afterDismissalAlerts.filter(a => a.active).length}`);

        // Test 8: Verify health lockdown
        console.log('\n✓ Test 8: CRITICAL VERIFICATION - Health Lockdown');
        const healthDiff = Math.abs(healthBeforeDismissal - afterDismissal.healthScore);

        if (healthDiff > 2) {
            console.log(`   ❌ FAIL: Health changed by ${healthDiff} points after dismissal!`);
            console.log(`      Before: ${healthBeforeDismissal}, After: ${afterDismissal.healthScore}`);
        } else {
            console.log(`   ✅ PASS: Health remained stable (diff: ${healthDiff} points)`);
            console.log(`      Before: ${healthBeforeDismissal}, After: ${afterDismissal.healthScore}`);
        }

        // Test 9: Verify health is degraded
        console.log('\n✓ Test 9: CRITICAL VERIFICATION - Degraded State Lock');
        const waterShortageThreshold = 5;
        if (degraded.resources.waterDays <= waterShortageThreshold) {
            if (afterDismissal.healthScore < 70) {
                console.log(`   ✅ PASS: Health is properly capped at ${afterDismissal.healthScore}/100`);
                console.log(`      Water critically low (${degraded.resources.waterDays} days ≤ ${waterShortageThreshold})`);
            } else {
                console.log(`   ⚠️  WARNING: Health ${afterDismissal.healthScore} may be too high for critical water`);
            }
        }

        // Test 10: Verify power load increase
        console.log('\n✓ Test 10: CRITICAL VERIFICATION - Power Load Increase');
        const loadIncrease = degraded.powerGrid.load - initial.powerGrid.load;
        if (loadIncrease >= 15) {
            console.log(`   ✅ PASS: Power load increased by ${loadIncrease} kW`);
            console.log(`      Initial: ${initial.powerGrid.load} kW → Degraded: ${degraded.powerGrid.load} kW`);
        } else {
            console.log(`   ⚠️  WARNING: Power load increase (${loadIncrease} kW) is less than expected`);
        }

        // Test 11: Restore to normal
        console.log('\n✓ Test 11: Restoring to NORMAL scenario...');
        res = await makeRequest('POST', '/api/simulations/run', {
            stationId: 'maitri',
            scenario: 'none'
        });
        await sleep(3000);

        res = await makeRequest('GET', '/api/stations/maitri/telemetry');
        const restored = res.data.telemetry;
        console.log(`   Restored Health: ${restored.healthScore}/100`);
        console.log(`   Restored Risk: ${restored.riskLevel}`);
        console.log(`   Power Load: ${restored.powerGrid.load} kW`);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY\n');

        const tests = [
            ['Initial State Retrieved', true],
            ['Scenario Trigger Works', degraded.resources.waterDays < initial.resources.waterDays],
            ['Health Degradation Occurs', degraded.healthScore < initialHealth],
            ['Alert Dismissal ≠ Recovery', healthDiff <= 2 && afterDismissal.healthScore < 70],
            ['Power Load Increases', degraded.powerGrid.load > initial.powerGrid.load],
            ['Health Stays Degraded', afterDismissal.healthScore < 70 && degraded.resources.waterDays <= 5],
            ['Normal Recovery Works', restored.healthScore >= 80]
        ];

        let passCount = 0;
        tests.forEach(([name, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${name}`);
            if (passed) passCount++;
        });

        console.log(`\n📈 Overall: ${passCount}/${tests.length} tests passed\n`);

        if (passCount === tests.length) {
            console.log('🎉 ALL TESTS PASSED! Flow is working correctly.\n');
        } else {
            console.log('⚠️  Some tests failed. Review the output above.\n');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

runTests();
