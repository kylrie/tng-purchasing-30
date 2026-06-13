const fs = require('fs');

const path = 'src/config/permissions.ts';
let content = fs.readFileSync(path, 'utf-8');

// Helper to replace precisely
function replaceAll(str, search, replacement) {
  return str.split(search).join(replacement);
}

// 1. ALL_PERMISSIONS Additions
content = replaceAll(content, 
`  // ─── INVENTORY: ITEMS ─────────────────────────────────────────────────
  'inventory:item:view:all',`, 
`  // ─── INVENTORY: ITEMS ─────────────────────────────────────────────────
  'inventory:item:view:all',
  'inventory:item:view:bu',`);

content = replaceAll(content,
`  // ─── INVENTORY: STOCK TAKE ────────────────────────────────────────────
  'inventory:stock_take:view:all',
  'inventory:stock_take:create',
  'inventory:stock_take:edit',
  'inventory:stock_take:delete',`,
`  // ─── INVENTORY: STOCK TAKE ────────────────────────────────────────────
  'inventory:stock_take:view:all',
  'inventory:stock_take:view:bu',
  'inventory:stock_take:create',
  'inventory:stock_take:edit',
  'inventory:stock_take:delete',
  'inventory:stock_take:approve_adjustment',
  'inventory:stock_take:freeze',`);

content = replaceAll(content,
`  // ─── INVENTORY: RECEIVING ─────────────────────────────────────────────
  'inventory:receiving:view:all',
  'inventory:receiving:create',
  'inventory:receiving:edit',
  'inventory:receiving:delete',`,
`  // ─── INVENTORY: RECEIVING ─────────────────────────────────────────────
  'inventory:receiving:view:all',
  'inventory:receiving:view:bu',
  'inventory:receiving:create',
  'inventory:receiving:edit',
  'inventory:receiving:delete',
  'inventory:receiving:reject',
  'inventory:receiving:print_barcode',`);

content = replaceAll(content,
`  // ─── INVENTORY: WASTAGE ───────────────────────────────────────────────
  'inventory:wastage:view:all',`,
`  // ─── INVENTORY: WASTAGE ───────────────────────────────────────────────
  'inventory:wastage:view:all',
  'inventory:wastage:view:bu',`);

content = replaceAll(content,
`  // ─── ADMIN: USERS ─────────────────────────────────────────────────────
  'admin:user:view:all',
  'admin:user:view:pending',
  'admin:user:create',
  'admin:user:edit',
  'admin:user:delete',`,
`  // ─── ADMIN: USERS ─────────────────────────────────────────────────────
  'admin:user:view:all',
  'admin:user:view:pending',
  'admin:user:create',
  'admin:user:edit',
  'admin:user:delete',
  'admin:user:reset_password',
  'admin:user:impersonate',
  'admin:user:deactivate',`);

// 2. PERMISSION_REGISTRY Additions
content = replaceAll(content,
`  'inventory:item:view:all': { category: 'Inventory', label: 'View All Items', description: 'View all inventory items.' },`,
`  'inventory:item:view:all': { category: 'Inventory', label: 'View All Items', description: 'View all inventory items across all BUs.' },
  'inventory:item:view:bu': { category: 'Inventory', label: 'View BU Items', description: 'View items scoped to assigned Business Units.' },`);

content = replaceAll(content,
`  'inventory:stock_take:delete': { category: 'Inventory', label: 'Delete Stock Take', description: 'Delete stock take records.' },`,
`  'inventory:stock_take:delete': { category: 'Inventory', label: 'Delete Stock Take', description: 'Delete stock take records.' },
  'inventory:stock_take:view:bu': { category: 'Inventory', label: 'View BU Stock Take', description: 'View stock takes for assigned BUs.' },
  'inventory:stock_take:approve_adjustment': { category: 'Inventory', label: 'Approve Adjustments', description: 'Approve variance adjustments after stock take.' },
  'inventory:stock_take:freeze': { category: 'Inventory', label: 'Freeze Stock', description: 'Lock inventory movements during stock take.' },`);

content = replaceAll(content,
`  'inventory:receiving:delete': { category: 'Inventory', label: 'Delete Receiving', description: 'Delete receiving records.' },`,
`  'inventory:receiving:delete': { category: 'Inventory', label: 'Delete Receiving', description: 'Delete receiving records.' },
  'inventory:receiving:view:bu': { category: 'Inventory', label: 'View BU Receiving', description: 'View receiving logs for assigned BUs.' },
  'inventory:receiving:reject': { category: 'Inventory', label: 'Reject Delivery', description: 'Reject incoming deliveries or specific items.' },
  'inventory:receiving:print_barcode': { category: 'Inventory', label: 'Print Barcodes', description: 'Print barcode labels for received items.' },`);

content = replaceAll(content,
`  'inventory:wastage:view:all': { category: 'Inventory', label: 'View All Wastage', description: 'View all wastage records.' },`,
`  'inventory:wastage:view:all': { category: 'Inventory', label: 'View All Wastage', description: 'View all wastage records.' },
  'inventory:wastage:view:bu': { category: 'Inventory', label: 'View BU Wastage', description: 'View wastage logs for assigned BUs.' },`);

content = replaceAll(content,
`  'admin:user:delete': { category: 'Admin', label: 'Delete User', description: 'Remove users from the system.' },`,
`  'admin:user:delete': { category: 'Admin', label: 'Delete User', description: 'Remove users from the system.' },
  'admin:user:reset_password': { category: 'Admin', label: 'Reset Password', description: 'Force a password reset for a user.' },
  'admin:user:impersonate': { category: 'Admin', label: 'Impersonate User', description: 'Log in as another user for troubleshooting.' },
  'admin:user:deactivate': { category: 'Admin', label: 'Deactivate User', description: 'Temporarily disable a user account.' },`);

// 3. PERMISSION_GROUPS Additions
content = replaceAll(content,
`  {
    id: 'inventory_item',
    resource: 'Items',
    category: 'Inventory',
    read: { permission: 'inventory:item:view:all' },
    create: { permission: 'inventory:item:create' },
    edit: { permission: 'inventory:item:edit' },
    delete: { permission: 'inventory:item:delete' },
  },`,
`  {
    id: 'inventory_item',
    resource: 'Items',
    category: 'Inventory',
    read: {
      variants: [
        { label: 'All', permission: 'inventory:item:view:all' },
        { label: 'BU', permission: 'inventory:item:view:bu' }
      ]
    },
    create: { permission: 'inventory:item:create' },
    edit: { permission: 'inventory:item:edit' },
    delete: { permission: 'inventory:item:delete' },
  },`);

content = replaceAll(content,
`  {
    id: 'inventory_stock_take',
    resource: 'Stock Take',
    category: 'Inventory',
    read: { permission: 'inventory:stock_take:view:all' },
    create: { permission: 'inventory:stock_take:create' },
    edit: { permission: 'inventory:stock_take:edit' },
    delete: { permission: 'inventory:stock_take:delete' },
  },`,
`  {
    id: 'inventory_stock_take',
    resource: 'Stock Take',
    category: 'Inventory',
    read: {
      variants: [
        { label: 'All', permission: 'inventory:stock_take:view:all' },
        { label: 'BU', permission: 'inventory:stock_take:view:bu' }
      ]
    },
    create: { permission: 'inventory:stock_take:create' },
    edit: { permission: 'inventory:stock_take:edit' },
    delete: { permission: 'inventory:stock_take:delete' },
    actions: ['inventory:stock_take:approve_adjustment', 'inventory:stock_take:freeze'],
  },`);

content = replaceAll(content,
`  {
    id: 'inventory_receiving',
    resource: 'Receiving',
    category: 'Inventory',
    read: { permission: 'inventory:receiving:view:all' },
    create: { permission: 'inventory:receiving:create' },
    edit: { permission: 'inventory:receiving:edit' },
    delete: { permission: 'inventory:receiving:delete' },
  },`,
`  {
    id: 'inventory_receiving',
    resource: 'Receiving',
    category: 'Inventory',
    read: {
      variants: [
        { label: 'All', permission: 'inventory:receiving:view:all' },
        { label: 'BU', permission: 'inventory:receiving:view:bu' }
      ]
    },
    create: { permission: 'inventory:receiving:create' },
    edit: { permission: 'inventory:receiving:edit' },
    delete: { permission: 'inventory:receiving:delete' },
    actions: ['inventory:receiving:reject', 'inventory:receiving:print_barcode'],
  },`);

content = replaceAll(content,
`  {
    id: 'admin_user',
    resource: 'Users',
    category: 'Admin',
    read: {
      variants: [
        { label: 'All', permission: 'admin:user:view:all' },
        { label: 'Pending', permission: 'admin:user:view:pending' },
      ],
    },
    create: { permission: 'admin:user:create' },
    edit: { permission: 'admin:user:edit' },
    delete: { permission: 'admin:user:delete' },
  },`,
`  {
    id: 'admin_user',
    resource: 'Users',
    category: 'Admin',
    read: {
      variants: [
        { label: 'All', permission: 'admin:user:view:all' },
        { label: 'Pending', permission: 'admin:user:view:pending' },
      ],
    },
    create: { permission: 'admin:user:create' },
    edit: { permission: 'admin:user:edit' },
    delete: { permission: 'admin:user:delete' },
    actions: ['admin:user:reset_password', 'admin:user:impersonate', 'admin:user:deactivate'],
  },`);

fs.writeFileSync(path, content, 'utf-8');
console.log('Successfully updated permissions.ts');
