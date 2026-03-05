#!/bin/bash

# Quick migration script for Replit
# Usage: ./scripts/quick-migrate.sh "migration description"

if [ -z "$1" ]; then
  echo "❌ Error: Please provide a migration description"
  echo "Usage: ./scripts/quick-migrate.sh 'add notes field'"
  exit 1
fi

MIGRATION_NAME=$1
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="migrations/${TIMESTAMP}_${MIGRATION_NAME// /_}.sql"

echo "📝 Creating migration: $MIGRATION_FILE"

# Create empty migration file
touch "$MIGRATION_FILE"

echo "-- Migration: $MIGRATION_NAME" > "$MIGRATION_FILE"
echo "-- Created: $(date)" >> "$MIGRATION_FILE"
echo "" >> "$MIGRATION_FILE"
echo "-- Add your SQL here" >> "$MIGRATION_FILE"

echo "✅ Migration file created: $MIGRATION_FILE"
echo "📝 Edit the file and add your SQL. It will run automatically on next server start."
echo "   To run manually: npm run db:migrate"

