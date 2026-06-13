import fs
import re

with open('src/config/permissions.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update ALL_PERMISSIONS
new_permissions = [
    "'inventory:item:view:bu',",
    "'inventory:item:view:own',",
    "'inventory:stock_take:view:bu',",
    "'inventory:stock_take:view:own',",
    "'inventory:stock_take:approve_adjustment',",
    "'inventory:stock_take:freeze',",
    "'inventory:receiving:view:bu',",
    "'inventory:receiving:view:own',",
    "'inventory:receiving:reject',",
    "'inventory:receiving:print_barcode',",
    "'inventory:wastage:view:bu',",
    "'inventory:wastage:view:own',",
    "'master_data:supplier:view:bu',",
    "'master_data:supplier:view:own',",
    "'master_data:budget:view:bu',",
    "'master_data:budget:view:own',",
    "'admin:user:reset_password',",
    "'admin:user:impersonate',",
    "'admin:user:deactivate',"
]

for p in new_permissions:
    if p not in content:
        # insert after 'inventory:item:delete', etc... this is a bit brittle.
        pass
