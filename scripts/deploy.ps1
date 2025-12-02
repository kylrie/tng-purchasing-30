# Deploy Script for TNG Purchasing System

Write-Host "🚀 Starting Deployment Process..." -ForegroundColor Cyan

# 1. Build
Write-Host "`n📦 Building project for production..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✅ Build successful!" -ForegroundColor Green

# 2. Check Login Status (Optional check)
Write-Host "`n🔑 Checking Firebase login status..." -ForegroundColor Yellow
npx firebase-tools projects:list 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  You are not logged in to Firebase." -ForegroundColor Red
    Write-Host "   Please run: npx firebase-tools login" -ForegroundColor White
    Write-Host "   Then run this script again." -ForegroundColor White
    exit 1
}

# 3. Deploy
Write-Host "`n☁️  Deploying to Firebase..." -ForegroundColor Yellow
npx firebase-tools deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n✨ Deployment Complete! Live at https://tng-systems.web.app" -ForegroundColor Green
