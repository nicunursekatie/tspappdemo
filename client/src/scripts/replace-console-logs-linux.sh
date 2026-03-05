#!/bin/bash

# Script to replace console.log statements with logger in all TypeScript/JavaScript files
# Linux-compatible version
# Run from the client directory

echo "🔧 Replacing console statements with logger utility..."
echo ""

# Counter for files processed
count=0

# Find all .ts and .tsx files, excluding node_modules, build directories, and the logger file itself
find ./src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/lib/logger.ts" | while read file; do

  # Check if file has console statements
  if grep -q "console\." "$file"; then
    # Create backup
    cp "$file" "$file.bak"

    # Replace console statements (Linux sed syntax)
    sed -i 's/console\.log/logger.log/g; s/console\.error/logger.error/g; s/console\.warn/logger.warn/g; s/console\.info/logger.info/g; s/console\.debug/logger.log/g; s/console\.table/logger.table/g; s/console\.group/logger.group/g; s/console\.groupEnd/logger.groupEnd/g' "$file"

    # Check if logger import already exists
    if ! grep -q "import.*logger.*from.*@/lib/logger" "$file" && ! grep -q "import.*logger.*from.*'@/lib/logger'" "$file" && ! grep -q 'import.*logger.*from.*"@/lib/logger"' "$file"; then
      # Add logger import at the top of the file (after any existing imports or at the very top)
      # Find the last import line and add our import after it
      if grep -q "^import" "$file"; then
        # Get line number of last import
        last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
        # Insert after last import
        sed -i "${last_import_line}a import { logger } from '@/lib/logger';" "$file"
      else
        # No imports, add at the top
        sed -i "1i import { logger } from '@/lib/logger';\n" "$file"
      fi
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
