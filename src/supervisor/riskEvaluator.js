function evaluateRisk(data, intent) {
  const text = data.message.text.toLowerCase();
  const flags = [];
  let riskLevel = 'low';

  if (text.includes('legal')) flags.push('legal');
  if (text.includes('financial') || text.includes('payment') || text.includes('budget')) flags.push('financial');
  if (text.includes('boss') || text.includes('manager') || text.includes('vip')) flags.push('vip');

  if (flags.includes('legal') || flags.includes('financial') || intent.intent === 'executive_request' || data.case.priority === 'high') {
    riskLevel = 'high';
  } else if (intent.intent === 'policy' || intent.intent === 'support_case' || flags.includes('vip') || data.case.priority === 'medium') {
    riskLevel = 'medium';
  }

  return {
    risk_level: riskLevel,
    flags,
  };
}

module.exports = {
  evaluateRisk,
};