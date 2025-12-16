---
description: how to deploy to staging or production
---

# Deployment Workflow

## Prerequisites
- Firebase CLI installed and logged in: `firebase login`
- Project linked: Project ID is `tng-systems`

## Deploy to Staging
Deploys to: `https://tng-systems-staging.web.app`
Uses database: `(default)`

```powershell
// turbo
npm run deploy:staging
```

## Deploy to Production
Deploys to: `https://tng-systems.web.app`
Uses database: `tng-systems`

```powershell
npm run deploy:production
```

## Clone Production Data to Staging
Copies all documents from `tng-systems` database to `(default)` database:

```powershell
npm run clone-db
```

## Environment Summary
| Environment | URL | Database |
|-------------|-----|----------|
| Production | tng-systems.web.app | tng-systems |
| Staging | tng-systems-staging.web.app | (default) |
