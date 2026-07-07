# TNG ERP (ProcureFlow Enhanced)

Built with React 19, TypeScript, Vite, Tailwind CSS v4, Firebase (Auth + Firestore + Functions), and Capacitor.

> **History:** This system began as **ProcureFlow Enhanced**, a refactored procurement tool. It has since grown into a multi-module **ERP**. The procurement heritage is preserved; the module list below reflects the current, broader scope.

## Modules

| Module | Purpose |
|---|---|
| Procurement | Requisitions, BURF, PRF, liquidation & approval workflow |
| Inventory | Multi-unit stock, BOM recipes, stock transactions & deduction |
| Menu | Menu items, recipe costing, inventory linkage |
| POS | Order entry, sales import & costing |
| Finance | Budgets, liquidations, financial dashboards |
| Dashboard | Aggregated metrics & reporting |
| Notifications | In-app, real-time notifications |
| Auth | Firebase Auth + dynamic role/permission matrix |
| **QR Ordering** | **NEW — in planning.** Customer QR ordering, Xendit payment, kitchen/bar workflow. See the master plan linked below. |

## QR Ordering initiative

QR Ordering is being added as a **new module inside this repository** (not a separate app). The **single authoritative source of truth** for its architecture, roadmap, payment design, ownership, and MVP boundaries is:

- **[`docs/QR_ORDERING_MASTER_PLAN.md`](docs/QR_ORDERING_MASTER_PLAN.md)** — approved in principle (2026-07-02).

Key boundary: in MVP, **TNG does not issue official BIR invoices/receipts** — the existing registered invoicing/POS system remains the official issuer, and the cashier reconciles the official invoice number back into TNG.

## Directory Structure

The project follows a feature-based modular architecture:

```
src/
├── config/             # Global configuration (Firebase, constants)
├── contexts/           # React contexts (permissions, data)
├── features/           # Feature-specific modules
│   ├── admin/          # Admin-specific features
│   ├── auth/           # Authentication (Login, User management)
│   ├── dashboard/      # Dashboard views and widgets
│   ├── finance/        # Finance (budgets, liquidations, dashboards)
│   ├── inventory/      # Inventory management
│   ├── menu/           # Menu & recipe costing
│   ├── notifications/  # In-app notifications
│   ├── pos/            # Point of sale & sales import
│   └── procurement/    # Core procurement logic (Requisitions, BURF, PRF)
├── shared/             # Shared resources
│   ├── components/     # Reusable UI components (Layout, Buttons, Inputs)
│   ├── services/       # Shared services (Business logic, API calls)
│   ├── utils/          # Helper functions
│   └── types/          # Shared TypeScript interfaces
├── App.tsx             # Main application component with Routing
└── main.tsx            # Entry point

functions/              # Firebase Cloud Functions (currently onCall only)
```

## Key Features

- **Modular Architecture**: Each feature is self-contained with its own components, services, and types.
- **Tailwind CSS v4**: Using the latest utility-first CSS framework for styling.
- **Firebase Integration**: Firestore, Auth, and Cloud Functions are modularized.
- **Gemini AI**: AI integration services are isolated in `shared/services`.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## Environment Variables

Ensure you have `.env` file with the following keys:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- ... (and other Firebase config)
- `VITE_GEMINI_API_KEY`
