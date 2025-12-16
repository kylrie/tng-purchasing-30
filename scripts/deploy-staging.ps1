# Deploy to STAGING (tng-systems-staging.web.app)
# Uses (default) database

Write-Host "Deploying to STAGING..." -ForegroundColor Cyan

# Clear Firebase cache to avoid upload issues
if (Test-Path .firebase) {
    Remove-Item -Recurse -Force .firebase
}

# Build with staging environment - Using PRODUCTION database for data consistency
Write-Host "Building with staging config..." -ForegroundColor Yellow
$env:VITE_FIREBASE_DATABASE_ID = "tng-systems"
npm run build

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
