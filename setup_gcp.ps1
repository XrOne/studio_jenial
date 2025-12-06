# PowerShell Script to Setup Google Cloud Project for Studio Jenial Beta
# Run this in PowerShell

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   Studio Jenial - Google Cloud Setup Assistant" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Check for gcloud
if (-not (Get-Command "gcloud" -ErrorAction SilentlyContinue)) {
    Write-Error "gcloud CLI is not installed. Please install it from https://cloud.google.com/sdk/docs/install"
    exit 1
}

# 2. Login
Write-Host "`n[1/5] Authenticating with Google Cloud..." -ForegroundColor Yellow
gcloud auth login
if ($LASTEXITCODE -ne 0) { exit 1 }

# 3. Create Project
$projectId = Read-Host "`nEnter a new Project ID (e.g. studio-jenial-beta)"
Write-Host "Creating project $projectId..." -ForegroundColor Yellow
gcloud projects create $projectId --name="Studio Jenial Beta"
if ($LASTEXITCODE -ne 0) { 
    Write-Warning "Project creation failed. It might already exist. Trying to select it..." 
}
gcloud config set project $projectId

# 4. Enable APIs
Write-Host "`n[2/5] Enabling Vertex AI API..." -ForegroundColor Yellow
gcloud services enable aiplatform.googleapis.com
gcloud services enable iam.googleapis.com

# 5. Configure OAuth Consent Screen (Manual Step)
Write-Host "`n[3/5] Configuring OAuth Consent Screen..." -ForegroundColor Yellow
Write-Host "IMPORTANT: This step must be done manually in the console." -ForegroundColor White
Write-Host "1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=$projectId"
Write-Host "2. Select 'External' and 'Create'."
Write-Host "3. App Name: 'Studio Jenial Beta'"
Write-Host "4. Support Email: Your email"
Write-Host "5. Add Test Users: Add your email and any beta testers."
Write-Host "6. Save and Continue."
Write-Host "Press Enter once you have configured the Consent Screen..."
Read-Host

# 6. Create Credentials (Manual Step)
Write-Host "`n[4/5] Creating OAuth Credentials..." -ForegroundColor Yellow
Write-Host "1. Go to: https://console.cloud.google.com/apis/credentials?project=$projectId"
Write-Host "2. Click 'Create Credentials' -> 'OAuth client ID'."
Write-Host "3. Application type: 'Web application'."
Write-Host "4. Name: 'Studio Jenial Web'"
Write-Host "5. Authorized JavaScript origins: 'http://localhost:5173' AND 'https://your-vercel-app.vercel.app'"
Write-Host "6. Click 'Create'."
Write-Host "7. Copy the 'Client ID'."

$clientId = Read-Host "`nEnter the Client ID you just copied"

# 7. Output Configuration
Write-Host "`n[5/5] Configuration Complete!" -ForegroundColor Green
Write-Host "Please update your .env.local file with:" -ForegroundColor White
Write-Host "VITE_GOOGLE_CLIENT_ID=$clientId" -ForegroundColor Cyan
Write-Host "VITE_VERTEX_PROJECT_ID=$projectId" -ForegroundColor Cyan

Write-Host "`nDone."
