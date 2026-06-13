const fs = require('fs');
const path = 'src/config/permissions.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. ALL_PERMISSIONS
const allStart = content.indexOf(`  // ─── AUDIT MODULE ─────────────────────────────────────────────────────`);
const allEnd = content.indexOf(`  // ─── ADMIN: USERS ─────────────────────────────────────────────────────`, allStart);
const newAll = `  // ─── AUDIT MODULE ─────────────────────────────────────────────────────
  'audit:income:view:own',
  'audit:income:view:bu',
  'audit:income:view:all',
  'audit:income:approve',
  'audit:income:reject',
  
  'audit:pcf:view:own',
  'audit:pcf:view:bu',
  'audit:pcf:view:all',
  'audit:pcf:approve',
  'audit:pcf:reject',
  
  'audit:liquidation:view:own',
  'audit:liquidation:view:bu',
  'audit:liquidation:view:all',
  'audit:liquidation:approve',
  'audit:liquidation:reject',
`;
content = content.slice(0, allStart) + newAll + content.slice(allEnd);

// 2. PERMISSION_REGISTRY
const regStart = content.indexOf(`  // ─── AUDIT MODULE ─────────────────────────────────────────────────────`, allEnd); // Find the second occurrence
const regEnd = content.indexOf(`  // ─── ADMIN: USERS ─────────────────────────────────────────────────────`, regStart);
const newReg = `  // ─── AUDIT MODULE ─────────────────────────────────────────────────────
  'audit:income:view:own':              { label: 'View Own Income Audit',       category: 'Audit', description: 'View own income audit records.' },
  'audit:income:view:bu':               { label: 'View BU Income Audit',        category: 'Audit', description: 'View BU income audit records.' },
  'audit:income:view:all':              { label: 'View All Income Audit',       category: 'Audit', description: 'View all income audit records.' },
  'audit:income:approve':               { label: 'Approve Income Audit',        category: 'Audit', description: 'Approve income audit records.' },
  'audit:income:reject':                { label: 'Reject Income Audit',         category: 'Audit', description: 'Reject income audit records.' },

  'audit:pcf:view:own':                 { label: 'View Own PCF Audit',          category: 'Audit', description: 'View own PCF audit requests.' },
  'audit:pcf:view:bu':                  { label: 'View BU PCF Audit',           category: 'Audit', description: 'View BU PCF audit requests.' },
  'audit:pcf:view:all':                 { label: 'View All PCF Audit',          category: 'Audit', description: 'View all PCF audit requests.' },
  'audit:pcf:approve':                  { label: 'Approve PCF',                 category: 'Audit', description: 'Approve PCF requests.' },
  'audit:pcf:reject':                   { label: 'Reject PCF',                  category: 'Audit', description: 'Reject PCF requests.' },

  'audit:liquidation:view:own':         { label: 'View Own Liquidation Audit',  category: 'Audit', description: 'View own liquidation audit requests.' },
  'audit:liquidation:view:bu':          { label: 'View BU Liquidation Audit',   category: 'Audit', description: 'View BU liquidation audit requests.' },
  'audit:liquidation:view:all':         { label: 'View All Liquidation Audit',  category: 'Audit', description: 'View all liquidation audit requests.' },
  'audit:liquidation:approve':          { label: 'Approve Liquidation',         category: 'Audit', description: 'Approve liquidation requests.' },
  'audit:liquidation:reject':           { label: 'Reject Liquidation',          category: 'Audit', description: 'Reject liquidation requests.' },
`;
content = content.slice(0, regStart) + newReg + content.slice(regEnd);

// 3. PERMISSION_GROUPS
const groupsStart = content.indexOf(`  // ─── AUDIT ────────────────────────────────────────────────────────────`);
const groupsEnd = content.indexOf(`  // ─── ADMIN ────────────────────────────────────────────────────────────`, groupsStart);
const newGroups = `  // ─── AUDIT ────────────────────────────────────────────────────────────
  {
    id: 'audit_income',
    resource: 'Income Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:income:view:all' },
        { label: 'BU', permission: 'audit:income:view:bu' },
        { label: 'Own', permission: 'audit:income:view:own' },
      ],
    },
    actions: ['audit:income:approve', 'audit:income:reject'],
  },
  {
    id: 'audit_pcf',
    resource: 'PCF Audit Review',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:pcf:view:all' },
        { label: 'BU', permission: 'audit:pcf:view:bu' },
        { label: 'Own', permission: 'audit:pcf:view:own' },
      ],
    },
    actions: ['audit:pcf:approve', 'audit:pcf:reject'],
  },
  {
    id: 'audit_liquidation',
    resource: 'Liquidation Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:liquidation:view:all' },
        { label: 'BU', permission: 'audit:liquidation:view:bu' },
        { label: 'Own', permission: 'audit:liquidation:view:own' },
      ],
    },
    actions: ['audit:liquidation:approve', 'audit:liquidation:reject'],
  },
`;
content = content.slice(0, groupsStart) + newGroups + content.slice(groupsEnd);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully patched Audit module again!');
