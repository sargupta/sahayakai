#!/bin/bash

# ==========================================
# SAHAYAK AI - MANUAL SHADOW DEPLOYMENT SCRIPT
# ==========================================
# Use this script if Firebase App Hosting deployment fails.
# It deploys the current source code directly to Cloud Run
# as a SEPARATE service ("shadow"), ensuring NO IMPACT on production.

SERVICE_NAME="sahayakai-hotfix-resilience"
REGION="asia-southeast1" # Matching your existing region
PROJECT_ID="sahayakai-b4248"

echo "🚀 Starting Manual Hotfix Deployment to Cloud Run..."
echo "Service: $SERVICE_NAME"
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "---------------------------------------------------"

# 1. Deploy directly from source (uses Google Cloud Buildpacks)
# We map the secrets from Secret Manager to Environment Variables
/Users/sargupta/google-cloud-sdk/bin/gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets="GOOGLE_GENAI_API_KEY=GOOGLE_GENAI_API_KEY:latest" \
  --set-secrets="FIREBASE_SERVICE_ACCOUNT_KEY=FIREBASE_SERVICE_ACCOUNT_KEY:latest" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sahayakai-b4248.firebasestorage.app,NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth.sahayakai.com,NODE_ENV=production" \
  --memory 2Gi \
  --cpu 2

echo "---------------------------------------------------"
if [ $? -eq 0 ]; then
  echo "✅ Deployment Successful!"
  echo "Your Shadow App is live at the URL printed above."
else
  echo "❌ Deployment Failed."
fi
