# Deploy to PRODUCTION (tng-systems.web.app)
# Uses tng-systems database

Write-Host "Deploying to PRODUCTION..." -ForegroundColor Magenta

# Clear Firebase cache to avoid upload issues
if (Test-Path .firebase) {
    Remove-Item -Recurse -Force .firebase
}

# Build with production environment
Write-Host "Building with production config..." -ForegroundColor Yellow
$env:VITE_FIREBASE_DATABASE_ID = "tng-systems"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Ensure firebase.json is set to production
$config = Get-Content firebase.json | ConvertFrom-Json
$config.hosting.site = "tng-systems"
$config | ConvertTo-Json -Depth 10 | Set-Content firebase.json

# Deploy
Write-Host "Deploying to tng-systems.web.app..." -ForegroundColor Yellow
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "Production deployed successfully!" -ForegroundColor Green
    Write-Host "URL: https://tng-systems.web.app" -ForegroundColor Cyan
}
else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
