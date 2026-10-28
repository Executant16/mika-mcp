// All health-popup producers preserve unknown values and prefer explicit current fields.
function serviceHealthState(status) {
  const value = (current, legacy) => typeof current === 'boolean' ? current
    : typeof legacy === 'boolean' ? legacy : null;
  return {
    mcpRunning: value(status?.mcpRunning, status?.runtimeRunning),
    tunnelRunning: value(status?.tunnelRunning, status?.connectionRunning)
  };
}
module.exports = { serviceHealthState };
