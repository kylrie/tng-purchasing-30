# --- Configuration ---
$PROJECT_ID = "tng-systems"
$SOURCE_DATABASE = "tng-systems"
$TARGET_DATABASE = "(default)" # The "(default)" database
$CLOUD_STORAGE_BUCKET = "tng-systems-firestore-migration-data-us" # CHANGE THIS TO A GLOBALLY UNIQUE NAME IF IT FAILS!
$BUCKET_LOCATION = "us" # Requires 'us' locations for target database (nam5)

# --- Script Start ---
Write-Host "Starting Firestore data migration for project: $PROJECT_ID"
Write-Host "Source Database: $SOURCE_DATABASE (asia-southeast1)"
Write-Host "Target Database: $TARGET_DATABASE (nam5)"
Write-Host "Temporary Cloud Storage Bucket: gs://$CLOUD_STORAGE_BUCKET in $BUCKET_LOCATION"
Write-Host "--------------------------------------------------------"

# --- Step 0: Ensure gcloud is configured ---
Write-Host "Checking gcloud configuration..."
gcloud auth print-access-token > $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: You are not logged in with gcloud. Please run 'gcloud auth login' and try again." -ForegroundColor Red
  exit 1
}
gcloud config set project "$PROJECT_ID"
Write-Host "gcloud configured for project: $PROJECT_ID"
Write-Host "--------------------------------------------------------"

# --- Step 1: Create the Cloud Storage bucket ---
Write-Host "Creating Cloud Storage bucket: gs://$CLOUD_STORAGE_BUCKET..."
gsutil mb -p "$PROJECT_ID" -l "$BUCKET_LOCATION" "gs://$CLOUD_STORAGE_BUCKET"
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Failed to create Cloud Storage bucket. It might already exist or the name is not unique." -ForegroundColor Red
  exit 1
}
Write-Host "Cloud Storage bucket created: gs://$CLOUD_STORAGE_BUCKET"
Write-Host "--------------------------------------------------------"

# --- Step 2: Export data from the source Firestore database ---
Write-Host "Exporting data from Firestore database '$SOURCE_DATABASE' to gs://$CLOUD_STORAGE_BUCKET..."
gcloud firestore export "gs://$CLOUD_STORAGE_BUCKET" --database="$SOURCE_DATABASE" --project="$PROJECT_ID"
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Firestore export failed. Check gcloud output for details." -ForegroundColor Red
  exit 1
}
Write-Host "Firestore export complete."
Write-Host "--------------------------------------------------------"

# --- Step 3: Import data into the target Firestore database ---
Write-Host "Importing data from gs://$CLOUD_STORAGE_BUCKET into Firestore database '$TARGET_DATABASE'..."
Write-Host "WARNING: This step will OVERWRITE any existing documents in '$TARGET_DATABASE' that have matching IDs with the imported data." -ForegroundColor Yellow
gcloud firestore import "gs://$CLOUD_STORAGE_BUCKET" --database="$TARGET_DATABASE" --project="$PROJECT_ID"
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Firestore import failed. Check gcloud output for details." -ForegroundColor Red
  exit 1
}
Write-Host "Firestore import complete."
Write-Host "--------------------------------------------------------"

# --- Step 4: Clean up (optional but recommended) ---
Write-Host "Migration complete. You may want to delete the Cloud Storage bucket to avoid ongoing costs."
Write-Host "To delete the bucket, run: gsutil rm -r gs://$CLOUD_STORAGE_BUCKET"
Write-Host "--------------------------------------------------------"
Write-Host "Script finished successfully!" -ForegroundColor Green
