const fs = require('fs');

const path = 'src/config/permissions.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add to ALL_PERMISSIONS
const allPermsIndex = content.indexOf(`  // ─── ADMIN: USERS ─────────────────────────────────────────────────────`);
const auditPerms = `  // ─── AUDIT MODULE ─────────────────────────────────────────────────────
  'audit:price_change:view:own',
  'audit:price_change:view:bu',
  'audit:price_change:view:all',
  'audit:price_change:approve',
  'audit:price_change:reject',
  
  'audit:transfer:view:own',
  'audit:transfer:view:bu',
  'audit:transfer:view:all',
  'audit:transfer:approve',
  'audit:transfer:reject',
  
  'audit:requisition:view:own',
  'audit:requisition:view:bu',
  'audit:requisition:view:all',
  'audit:requisition:approve',
  'audit:requisition:reject',
  
  'audit:receiving:view:own',
  'audit:receiving:view:bu',
  'audit:receiving:view:all',
  'audit:receiving:approve',
  'audit:receiving:reject',
  
  'audit:bank_recon:view:own',
  'audit:bank_recon:view:bu',
  'audit:bank_recon:view:all',
  'audit:bank_recon:approve',
  'audit:bank_recon:reject',
  
  'audit:pcf:view:own',
  'audit:pcf:view:bu',
  'audit:pcf:view:all',
  'audit:pcf:approve',
  'audit:pcf:reject',
  
  'audit:invoice:view:own',
  'audit:invoice:view:bu',
  'audit:invoice:view:all',
  'audit:invoice:approve',
  'audit:invoice:reject',
  
  'audit:payment:view:own',
  'audit:payment:view:bu',
  'audit:payment:view:all',
  'audit:payment:approve',
  'audit:payment:reject',
`;
content = content.slice(0, allPermsIndex) + auditPerms + "\n" + content.slice(allPermsIndex);

// Add module access
const moduleAccessIndex = content.indexOf(`  'ui:module_access:view:activity_log',`);
content = content.slice(0, moduleAccessIndex) + `  'ui:module_access:view:audit',\n` + content.slice(moduleAccessIndex);


// 2. Add to PERMISSION_REGISTRY
const registryIndex = content.indexOf(`  // ─── ADMIN: USERS ─────────────────────────────────────────────────────`);
const registryAudit = `  // ─── AUDIT MODULE ─────────────────────────────────────────────────────
  'audit:price_change:view:own':        { label: 'View Own Price Change Audit', category: 'Audit', description: 'View own price change audit requests.' },
  'audit:price_change:view:bu':         { label: 'View BU Price Change Audit',  category: 'Audit', description: 'View BU price change audit requests.' },
  'audit:price_change:view:all':        { label: 'View All Price Change Audit', category: 'Audit', description: 'View all price change audit requests.' },
  'audit:price_change:approve':         { label: 'Approve Price Change',        category: 'Audit', description: 'Approve price change requests.' },
  'audit:price_change:reject':          { label: 'Reject Price Change',         category: 'Audit', description: 'Reject price change requests.' },

  'audit:transfer:view:own':            { label: 'View Own Transfer Audit',     category: 'Audit', description: 'View own transfer audit requests.' },
  'audit:transfer:view:bu':             { label: 'View BU Transfer Audit',      category: 'Audit', description: 'View BU transfer audit requests.' },
  'audit:transfer:view:all':            { label: 'View All Transfer Audit',     category: 'Audit', description: 'View all transfer audit requests.' },
  'audit:transfer:approve':             { label: 'Approve Transfer',            category: 'Audit', description: 'Approve transfer requests.' },
  'audit:transfer:reject':              { label: 'Reject Transfer',             category: 'Audit', description: 'Reject transfer requests.' },

  'audit:requisition:view:own':         { label: 'View Own Requisition Audit',  category: 'Audit', description: 'View own requisition audit requests.' },
  'audit:requisition:view:bu':          { label: 'View BU Requisition Audit',   category: 'Audit', description: 'View BU requisition audit requests.' },
  'audit:requisition:view:all':         { label: 'View All Requisition Audit',  category: 'Audit', description: 'View all requisition audit requests.' },
  'audit:requisition:approve':          { label: 'Approve Requisition',         category: 'Audit', description: 'Approve requisition requests.' },
  'audit:requisition:reject':           { label: 'Reject Requisition',          category: 'Audit', description: 'Reject requisition requests.' },

  'audit:receiving:view:own':           { label: 'View Own Receiving Audit',    category: 'Audit', description: 'View own receiving audit requests.' },
  'audit:receiving:view:bu':            { label: 'View BU Receiving Audit',     category: 'Audit', description: 'View BU receiving audit requests.' },
  'audit:receiving:view:all':           { label: 'View All Receiving Audit',    category: 'Audit', description: 'View all receiving audit requests.' },
  'audit:receiving:approve':            { label: 'Approve Receiving',           category: 'Audit', description: 'Approve receiving requests.' },
  'audit:receiving:reject':             { label: 'Reject Receiving',            category: 'Audit', description: 'Reject receiving requests.' },

  'audit:bank_recon:view:own':          { label: 'View Own Bank Recon Audit',   category: 'Audit', description: 'View own bank recon audit requests.' },
  'audit:bank_recon:view:bu':           { label: 'View BU Bank Recon Audit',    category: 'Audit', description: 'View BU bank recon audit requests.' },
  'audit:bank_recon:view:all':          { label: 'View All Bank Recon Audit',   category: 'Audit', description: 'View all bank recon audit requests.' },
  'audit:bank_recon:approve':           { label: 'Approve Bank Recon',          category: 'Audit', description: 'Approve bank recon requests.' },
  'audit:bank_recon:reject':            { label: 'Reject Bank Recon',           category: 'Audit', description: 'Reject bank recon requests.' },

  'audit:pcf:view:own':                 { label: 'View Own PCF Audit',          category: 'Audit', description: 'View own PCF audit requests.' },
  'audit:pcf:view:bu':                  { label: 'View BU PCF Audit',           category: 'Audit', description: 'View BU PCF audit requests.' },
  'audit:pcf:view:all':                 { label: 'View All PCF Audit',          category: 'Audit', description: 'View all PCF audit requests.' },
  'audit:pcf:approve':                  { label: 'Approve PCF',                 category: 'Audit', description: 'Approve PCF requests.' },
  'audit:pcf:reject':                   { label: 'Reject PCF',                  category: 'Audit', description: 'Reject PCF requests.' },

  'audit:invoice:view:own':             { label: 'View Own Invoice Audit',      category: 'Audit', description: 'View own invoice audit requests.' },
  'audit:invoice:view:bu':              { label: 'View BU Invoice Audit',       category: 'Audit', description: 'View BU invoice audit requests.' },
  'audit:invoice:view:all':             { label: 'View All Invoice Audit',      category: 'Audit', description: 'View all invoice audit requests.' },
  'audit:invoice:approve':              { label: 'Approve Invoice',             category: 'Audit', description: 'Approve invoice requests.' },
  'audit:invoice:reject':               { label: 'Reject Invoice',              category: 'Audit', description: 'Reject invoice requests.' },

  'audit:payment:view:own':             { label: 'View Own Payment Audit',      category: 'Audit', description: 'View own payment audit requests.' },
  'audit:payment:view:bu':              { label: 'View BU Payment Audit',       category: 'Audit', description: 'View BU payment audit requests.' },
  'audit:payment:view:all':             { label: 'View All Payment Audit',      category: 'Audit', description: 'View all payment audit requests.' },
  'audit:payment:approve':              { label: 'Approve Payment',             category: 'Audit', description: 'Approve payment requests.' },
  'audit:payment:reject':               { label: 'Reject Payment',              category: 'Audit', description: 'Reject payment requests.' },
`;

// It's the second occurrence of '  // ─── ADMIN: USERS ─────────────────────────────────────────────────────'
// Let's find it after ALL_PERMISSIONS ends
const registryStart = content.indexOf(`export const PERMISSION_REGISTRY`);
const registryAdminIndex = content.indexOf(`  // ─── ADMIN: USERS ─────────────────────────────────────────────────────`, registryStart);
content = content.slice(0, registryAdminIndex) + registryAudit + "\n" + content.slice(registryAdminIndex);

// Add module access registry
const registryModuleAccessIndex = content.indexOf(`  'ui:module_access:view:activity_log': { label: 'Activity Log Module',       category: 'Module Access' },`);
content = content.slice(0, registryModuleAccessIndex) + `  'ui:module_access:view:audit':        { label: 'Audit Module',              category: 'Module Access' },\n` + content.slice(registryModuleAccessIndex);


// 3. Add to PERMISSION_GROUPS
const groupsIndex = content.indexOf(`  // ─── ADMIN ────────────────────────────────────────────────────────────`);
const groupsAudit = `  // ─── AUDIT ────────────────────────────────────────────────────────────
  {
    id: 'audit_price_change',
    resource: 'Price Change Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:price_change:view:all' },
        { label: 'BU', permission: 'audit:price_change:view:bu' },
        { label: 'Own', permission: 'audit:price_change:view:own' },
      ],
    },
    actions: ['audit:price_change:approve', 'audit:price_change:reject'],
  },
  {
    id: 'audit_transfer',
    resource: 'Transfer Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:transfer:view:all' },
        { label: 'BU', permission: 'audit:transfer:view:bu' },
        { label: 'Own', permission: 'audit:transfer:view:own' },
      ],
    },
    actions: ['audit:transfer:approve', 'audit:transfer:reject'],
  },
  {
    id: 'audit_requisition',
    resource: 'Requisition Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:requisition:view:all' },
        { label: 'BU', permission: 'audit:requisition:view:bu' },
        { label: 'Own', permission: 'audit:requisition:view:own' },
      ],
    },
    actions: ['audit:requisition:approve', 'audit:requisition:reject'],
  },
  {
    id: 'audit_receiving',
    resource: 'Receiving Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:receiving:view:all' },
        { label: 'BU', permission: 'audit:receiving:view:bu' },
        { label: 'Own', permission: 'audit:receiving:view:own' },
      ],
    },
    actions: ['audit:receiving:approve', 'audit:receiving:reject'],
  },
  {
    id: 'audit_bank_recon',
    resource: 'Bank Recon Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:bank_recon:view:all' },
        { label: 'BU', permission: 'audit:bank_recon:view:bu' },
        { label: 'Own', permission: 'audit:bank_recon:view:own' },
      ],
    },
    actions: ['audit:bank_recon:approve', 'audit:bank_recon:reject'],
  },
  {
    id: 'audit_pcf',
    resource: 'PCF Audit',
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
    id: 'audit_invoice',
    resource: 'Invoice Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:invoice:view:all' },
        { label: 'BU', permission: 'audit:invoice:view:bu' },
        { label: 'Own', permission: 'audit:invoice:view:own' },
      ],
    },
    actions: ['audit:invoice:approve', 'audit:invoice:reject'],
  },
  {
    id: 'audit_payment',
    resource: 'Payment Audit',
    category: 'Audit',
    read: {
      variants: [
        { label: 'All', permission: 'audit:payment:view:all' },
        { label: 'BU', permission: 'audit:payment:view:bu' },
        { label: 'Own', permission: 'audit:payment:view:own' },
      ],
    },
    actions: ['audit:payment:approve', 'audit:payment:reject'],
  },
`;

const groupsStart = content.indexOf(`export const PERMISSION_GROUPS: ResourceGroup[]`);
const groupsAdminIndex = content.indexOf(`  // ─── ADMIN ────────────────────────────────────────────────────────────`, groupsStart);
content = content.slice(0, groupsAdminIndex) + groupsAudit + "\n" + content.slice(groupsAdminIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully patched Audit module!');
