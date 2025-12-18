# Deploy to STAGING (tng-systems-staging.web.app)
# Uses (default) database

Write-Host "Deploying to STAGING..." -ForegroundColor Cyan

# Clear Firebase cache to avoid upload issues
if (Test-Path .firebase) {
    Remove-Item -Recurse -Force .firebase
}

# Create .env.staging to override database ID (empty = default database)
# This overrides any VITE_FIREBASE_DATABASE_ID in .env
Write-Host "Creating staging environment override..." -ForegroundColor Yellow
@"
# Staging environment - uses (default) database
VITE_FIREBASE_DATABASE_ID=
"@ | Set-Content .env.staging

# Build with staging environment using Vite's mode feature
# --mode staging will load .env.staging which overrides .env
Write-Host "Building with staging config..." -ForegroundColor Yellow
npm run build -- --mode staging

# Clean up the temporary file
Remove-Item .env.staging -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Temporarily update firebase.json for staging
$config = Get-Content firebase.json | ConvertFrom-Json
$originalSite = $config.hosting.site
$config.hosting.site = "tng-systems-staging"
$config | ConvertTo-Json -Depth 10 | Set-Content firebase.json

# Deploy
Write-Host "Deploying to tng-systems-staging.web.app..." -ForegroundColor Yellow
firebase deploy --only hosting

$deployResult = $LASTEXITCODE

# Restore firebase.json to production
$config.hosting.site = $originalSite
$config | ConvertTo-Json -Depth 10 | Set-Content firebase.json

if ($deployResult -eq 0) {
    Write-Host "Staging deployed successfully!" -ForegroundColor Green
    Write-Host "URL: https://tng-systems-staging.web.app" -ForegroundColor Cyan
}
else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
