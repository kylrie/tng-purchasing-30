#!/bin/bash

# --- Configuration ---
PROJECT_ID="tng-systems"
SOURCE_DATABASE="tng-systems"
TARGET_DATABASE="(default)"

# We need TWO buckets because Firestore requires the export bucket to be geographically close to the source db,
# and the import bucket to be geographically close to the target db.
BUCKET_ASIA="tng-systems-migration-asia-$(date +%s)"
BUCKET_US="tng-systems-migration-us-$(date +%s)"

# --- Script Start ---
gcloud config set project "${PROJECT_ID}"

echo "1. Creating buckets..."
gsutil mb -p "${PROJECT_ID}" -l "asia-southeast1" "gs://${BUCKET_ASIA}"
gsutil mb -p "${PROJECT_ID}" -l "us" "gs://${BUCKET_US}"

echo "2. Exporting source database to Asia bucket..."
gcloud firestore export "gs://${BUCKET_ASIA}/cross-region-export" --database="${SOURCE_DATABASE}" --project="${PROJECT_ID}"

echo "3. Transferring data from Asia bucket to US bucket..."
# Copy the entire export folder across regions
gsutil -m cp -r "gs://${BUCKET_ASIA}/cross-region-export" "gs://${BUCKET_US}/"

echo "4. Importing data from US bucket into target database..."
gcloud firestore import "gs://${BUCKET_US}/cross-region-export" --database="${TARGET_DATABASE}" --project="${PROJECT_ID}"

echo "Migration complete!"
echo "If you want to clean up costs, run:"
echo "gsutil rm -r gs://${BUCKET_ASIA}"
echo "gsutil rm -r gs://${BUCKET_US}"
