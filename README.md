# ProcureFlow Enhanced

This is a refactored and enhanced version of the ProcureFlow system, built with React, TypeScript, Vite, and Tailwind CSS v4.

## Directory Structure

The project follows a feature-based modular architecture:

```
src/
├── config/             # Global configuration (Firebase, constants)
├── features/           # Feature-specific modules
│   ├── admin/          # Admin-specific features
│   ├── auth/           # Authentication (Login, User management)
│   ├── dashboard/      # Dashboard views and widgets
│   ├── inventory/      # Inventory management
│   └── procurement/    # Core procurement logic (Requisitions, BURF, PRF)
├── shared/             # Shared resources
│   ├── components/     # Reusable UI components (Layout, Buttons, Inputs)
│   ├── services/       # Shared services (Business logic, API calls)
│   ├── utils/          # Helper functions
│   └── types.ts        # Shared TypeScript interfaces
├── App.tsx             # Main application component with Routing
└── main.tsx            # Entry point
```

## Key Features

- **Modular Architecture**: Each feature is self-contained with its own components, services, and types.
- **Tailwind CSS v4**: Using the latest utility-first CSS framework for styling.
- **Firebase Integration**: Firestore and Auth services are modularized.
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
