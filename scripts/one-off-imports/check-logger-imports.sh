#!/bin/bash

# Check for files using logger without importing it

cd /home/user/Sandwich-Project-Platform-Final/client/src

echo "Checking for files using logger without importing it..."
echo ""

missing_count=0

while IFS= read -r file; do
  if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
    echo "❌ Missing logger import: $file"
    missing_count=$((missing_count + 1))
  fi
done < <(grep -rl "logger\." --include="*.ts" --include="*.tsx" . | grep -v "logger.ts")

echo ""
if [ $missing_count -eq 0 ]; then
  echo "✅ All files that use logger have the correct import!"
else
  echo "⚠️  Found $missing_count files missing logger import"
fi
