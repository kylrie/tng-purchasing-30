const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('eslint_report.json', 'utf8'));
  const ruleCounts = {};
  let totalErrors = 0;
  
  data.forEach(file => {
    file.messages.forEach(msg => {
      if (msg.severity === 2) { // Error
        totalErrors++;
        ruleCounts[msg.ruleId] = (ruleCounts[msg.ruleId] || 0) + 1;
      }
    });
  });
  
  console.log(`Total Errors: ${totalErrors}`);
  console.log('Errors by Rule:');
  console.log(JSON.stringify(ruleCounts, null, 2));
} catch (e) {
  console.error('Error parsing eslint_report.json', e);
}
