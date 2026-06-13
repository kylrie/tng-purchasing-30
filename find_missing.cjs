const fs = require('fs');
const text = fs.readFileSync('src/config/permissions.ts', 'utf8');

// Get all permission strings from ALL_PERMISSIONS array
const allMatch = text.match(/export const ALL_PERMISSIONS = \[([\s\S]+?)\];/)[1];
const all = allMatch.split('\n')
  .map(line => line.trim())
  .filter(line => line.startsWith("'"))
  .map(line => line.replace(/['",]/g, ''));

// Get all permission keys defined in PERMISSION_REGISTRY
const regMatch = text.match(/export const PERMISSION_REGISTRY: Record<Permission, [^>]+> = \{([\s\S]+?)\n};/)[1];
const missing = [];
for (const p of all) {
  if (!regMatch.includes(`'${p}':`)) {
    missing.push(p);
  }
}

console.log('Missing in REGISTRY:', missing);

// Also check PERMISSION_GROUPS
const groupsMatch = text.match(/export const PERMISSION_GROUPS: ResourceGroup\[\] = \[([\s\S]+?)\n\];/)[1];
const missingGroups = [];
for (const p of all) {
  // If a permission is not in PERMISSION_GROUPS and doesn't start with ui: 
  if (!p.startsWith('ui:') && !groupsMatch.includes(`'${p}'`)) {
    missingGroups.push(p);
  }
}
console.log('Missing in GROUPS:', missingGroups);

