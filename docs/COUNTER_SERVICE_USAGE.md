# Counter Service Usage Guide

## Overview
The `CounterService` provides auto-incrementing ID generation for PRF, BURF, and Liquidation documents. It uses Firestore transactions to ensure atomic increments and prevent duplicate IDs.

## Location
`src/shared/services/counter.service.ts`

## Features
- **Atomic Increments**: Uses Firestore transactions to prevent race conditions
- **Multiple Counter Types**: Supports PRF, BURF, and Liquidation counters
- **Formatted IDs**: Generates IDs in the format "PRF-0001", "BURF-0001", etc.
- **Counter Management**: Get current value or reset counters when needed

## Usage Examples

### Generate PRF ID

```typescript
import { CounterService } from '../shared/services/counter.service';

// In PreparePRFModal.tsx, line 109, replace:
// id: `PRF-${Math.floor(10000 + Math.random() * 90000)}`,

// With:
const prfId = await CounterService.generatePRFId();
const newPrf: Requisition = {
  ...requisition,
  id: prfId, // Will be "PRF-0001", "PRF-0002", etc.
  // ... rest of the properties
};
```

### Generate BURF ID

```typescript
import { CounterService } from '../shared/services/counter.service';

// When creating a new BURF
const burfId = await CounterService.generateBURFId();
const newBurf: Requisition = {
  id: burfId, // Will be "BURF-0001", "BURF-0002", etc.
  // ... rest of the properties
};
```

### Generate Liquidation ID

```typescript
import { CounterService } from '../shared/services/counter.service';

// When creating a liquidation
const liqId = await CounterService.generateLiquidationId();
const newLiquidation = {
  id: liqId, // Will be "LIQ-0001", "LIQ-0002", etc.
  // ... rest of the properties
};
```

### Check Current Counter Value

```typescript
import { CounterService, CounterType } from '../shared/services/counter.service';

// Get current PRF counter value without incrementing
const currentValue = await CounterService.getCurrentValue(CounterType.PRF);
console.log(`Next PRF will be: PRF-${(currentValue + 1).toString().padStart(4, '0')}`);
```

### Reset Counter (Admin Only)

```typescript
import { CounterService, CounterType } from '../shared/services/counter.service';

// Reset PRF counter to 0 (use with caution!)
await CounterService.resetCounter(CounterType.PRF, 0);

// Reset to a specific value
await CounterService.resetCounter(CounterType.PRF, 100); // Next ID will be PRF-0101
```

## Integration Steps

### 1. Update PreparePRFModal.tsx

**File**: `src/features/procurement/components/PreparePRFModal.tsx`

**Line 109** - Replace the random ID generation:

```typescript
// Add import at the top
import { CounterService } from '../../../shared/services/counter.service';

// In handleSubmit function, make it async and replace line 109:
const handleSubmit = async () => {
  const selectedItems = items.filter(item => item.selected).map(({ selected, ...item }) => item);
  const unselectedItems = items.filter(item => !item.selected).map(({ selected, ...item }) => item);

  if (requisition.status === RequisitionStatus.READY_FOR_PRF && unselectedItems.length > 0) {
    // Generate PRF ID using counter service
    const prfId = await CounterService.generatePRFId();
    
    const newPrf: Requisition = {
      ...requisition,
      id: prfId, // Changed from random ID
      items: selectedItems,
      // ... rest of the properties
    };
    // ... rest of the logic
  }
};
```

### 2. Update RequisitionService (Optional)

**File**: `src/features/procurement/services/requisitions.service.ts`

Add a helper method:

```typescript
import { CounterService } from '../../../shared/services/counter.service';

export class RequisitionService {
  // ... existing methods

  /**
   * Generate a new PRF ID
   */
  static async generatePRFId(): Promise<string> {
    return CounterService.generatePRFId();
  }
}
```

### 3. Update Firebase Types (Optional)

**File**: `src/shared/types/firebase.types.ts`

Add COUNTERS to the COLLECTIONS constant:

```typescript
export const COLLECTIONS = {
  USERS: 'users',
  BUSINESSES: 'businesses',
  REQUISITIONS: 'requisitions',
  SUPPLIERS: 'suppliers',
  NOTIFICATIONS: 'notifications',
  COUNTERS: 'counters', // Add this line
} as const;
```

## Firestore Structure

The counter service creates documents in the `counters` collection:

```
counters/
  ├── prf/
  │   ├── value: 5
  │   └── lastUpdated: "2025-11-26T07:15:00.000Z"
  ├── burf/
  │   ├── value: 12
  │   └── lastUpdated: "2025-11-26T07:14:30.000Z"
  └── liquidation/
      ├── value: 3
      └── lastUpdated: "2025-11-26T07:13:00.000Z"
```

## Firestore Rules

Add these rules to `firestore.rules` to protect the counters collection:

```javascript
match /counters/{counterId} {
  // Only authenticated users can read counters
  allow read: if request.auth != null;
  
  // Only allow writes through the application (transactions)
  // In production, you might want to restrict this further
  allow write: if request.auth != null;
}
```

## Error Handling

The service includes built-in error handling:

```typescript
try {
  const prfId = await CounterService.generatePRFId();
  // Use the ID
} catch (error) {
  console.error('Failed to generate PRF ID:', error);
  // Handle error - maybe show user notification
  // or fall back to timestamp-based ID
}
```

## Testing

To test the counter service:

1. Create a PRF and verify it gets ID "PRF-0001"
2. Create another PRF and verify it gets ID "PRF-0002"
3. Check Firestore console to see the counter document
4. Verify concurrent requests don't create duplicate IDs

## Notes

- **Thread-Safe**: Uses Firestore transactions for atomic increments
- **No Duplicates**: Guaranteed unique IDs even with concurrent requests
- **Persistent**: Counter values survive app restarts
- **Scalable**: Can handle high-frequency ID generation
- **Format**: IDs are zero-padded to 4 digits (0001-9999), can be adjusted in the format methods
