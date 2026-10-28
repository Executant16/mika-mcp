const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceHealthState } = require('../electron/services/serviceHealthState');
test('missing service data remains unknown instead of reporting two failures', () => {
  for (const status of [null, undefined, {}, { mcpRunning: 'false', tunnelRunning: 0 }]) {
    assert.deepEqual(serviceHealthState(status), { mcpRunning: null, tunnelRunning: null });
  }
});
test('explicit false wins over old alias true and existing aliases remain supported', () => {
  assert.deepEqual(serviceHealthState({ mcpRunning: false, runtimeRunning: true, tunnelRunning: false, connectionRunning: true }), { mcpRunning: false, tunnelRunning: false });
  assert.deepEqual(serviceHealthState({ runtimeRunning: true, connectionRunning: false }), { mcpRunning: true, tunnelRunning: false });
});
