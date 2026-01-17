#!/bin/bash

# Vercel Ignore Build Step Script
# This script tells Vercel when to skip building the web app
# Returns 0 (build) or 1 (skip build)

echo "🔍 Checking if web app needs to be rebuilt..."

# Get the list of changed files in this commit
if [ "$VERCEL_GIT_PREVIOUS_SHA" = "" ]; then
  echo "✅ Initial deployment - building"
  exit 0  # Build on first deploy
fi

# Check if any files in apps/web or shared files changed
git diff --name-only $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA | grep -qE '^(apps/web/|package\.json|package-lock\.json)'

# $? is the exit code of the last command (grep)
# 0 means files found (should build), 1 means no files found (skip build)
if [ $? -eq 0 ]; then
  echo "✅ Web app files changed - building"
  exit 0  # Build
else
  echo "⏭️  No web app changes detected - skipping build"
  exit 1  # Skip build
fi
