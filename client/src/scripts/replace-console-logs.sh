#!/bin/bash

# Script to replace console.log statements with logger in all TypeScript/JavaScript files
# Run from the client directory

echo "🔧 Replacing console statements with logger utility..."
echo ""

# Counter for files processed
count=0

# Find all .ts and .tsx files, excluding node_modules and build directories
find ./src -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" | while read file; do
  # Check if file has console statements
  if grep -q "console\." "$file"; then
    # Create backup
    cp "$file" "$file.bak"

    # Replace console statements
    sed -i '' 's/console\.log/logger.log/g; s/console\.error/logger.error/g; s/console\.warn/logger.warn/g; s/console\.info/logger.info/g; s/console\.debug/logger.log/g' "$file"

    # Check if logger import already exists
    if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
      # Add logger import after the first import statement
      sed -i '' "1,/^import/s/^\(import.*\)$/\1\nimport { logger } from '@\/lib\/logger';/" "$file"
    fi

    count=$((count + 1))
    echo "✅ Updated: $file"
  fi
done

echo ""
echo "🎉 Complete! Processed $count files"
echo ""
echo "📝 Backups saved with .bak extension"
echo "To remove backups: find ./src -name '*.bak' -delete"
