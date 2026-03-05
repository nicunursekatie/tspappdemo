#!/bin/bash

# Script to migrate console.* statements to production-safe logger
# This ensures console noise is eliminated in production environments

set -e

echo "🔍 Migrating console statements to production-safe logger..."

# Count initial console statements
INITIAL_COUNT=$(find ../.. -name "*.ts" -path "*/server/*" -type f -exec grep -h "console\." {} \; 2>/dev/null | wc -l)
echo "📊 Found $INITIAL_COUNT console statements in server files"

# Function to update a file
update_file() {
    local file=$1
    local has_console=$(grep -c "console\." "$file" 2>/dev/null || echo "0")

    if [ "$has_console" -gt 0 ]; then
        echo "  📝 Updating $file ($has_console statements)..."

        # Create backup
        cp "$file" "$file.backup"

        # Check if file already has logger import
        if ! grep -q "from './utils/production-safe-logger'" "$file" 2>/dev/null && \
           ! grep -q 'from "../utils/production-safe-logger"' "$file" 2>/dev/null && \
           ! grep -q 'from "../../utils/production-safe-logger"' "$file" 2>/dev/null; then

            # Determine relative path based on file location
            if [[ "$file" == *"/routes/"* ]]; then
                LOGGER_PATH="../utils/production-safe-logger"
            elif [[ "$file" == *"/services/"* ]]; then
                LOGGER_PATH="../utils/production-safe-logger"
            elif [[  "$file" == *"/middleware/"* ]]; then
                LOGGER_PATH="../utils/production-safe-logger"
            else
                LOGGER_PATH="./utils/production-safe-logger"
            fi

            # Add import after the last import statement
            # Find the last line with 'import' at the start
            LAST_IMPORT_LINE=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

            if [ ! -z "$LAST_IMPORT_LINE" ]; then
                # Insert after last import
                sed -i "${LAST_IMPORT_LINE}a import { logger } from '$LOGGER_PATH';" "$file"
            else
                # No imports found, add at top after any comments
                sed -i "1i import { logger } from '$LOGGER_PATH';" "$file"
            fi
        fi

        # Replace console statements
        sed -i 's/console\.log(/logger.log(/g' "$file"
        sed -i 's/console\.error(/logger.error(/g' "$file"
        sed -i 's/console\.warn(/logger.warn(/g' "$file"
        sed -i 's/console\.info(/logger.info(/g' "$file"
        sed -i 's/console\.debug(/logger.debug(/g' "$file"
        sed -i 's/console\.table(/logger.table(/g' "$file"

        echo "  ✅ Updated $file"
    fi
}

# Export the function for use in subshells
export -f update_file

# Process server root files
echo ""
echo "📂 Processing server root files..."
for file in ../*.ts; do
    if [ -f "$file" ]; then
        update_file "$file"
    fi
done

# Process routes
echo ""
echo "📂 Processing routes..."
for file in ../routes/*.ts ../routes/**/*.ts; do
    if [ -f "$file" ]; then
        update_file "$file"
    fi
done

# Process services
echo ""
echo "📂 Processing services..."
for file in ../services/*.ts ../services/**/*.ts; do
    if [ -f "$file" ]; then
        update_file "$file"
    fi
done

# Process middleware
echo ""
echo "📂 Processing middleware..."
for file in ../middleware/*.ts; do
    if [ -f "$file" ]; then
        update_file "$file"
    fi
done

# Count remaining console statements
FINAL_COUNT=$(find ../.. -name "*.ts" -path "*/server/*" -type f -exec grep -h "console\." {} \; 2>/dev/null | wc -l)
MIGRATED=$((INITIAL_COUNT - FINAL_COUNT))

echo ""
echo "✨ Migration complete!"
echo "📊 Migrated: $MIGRATED statements"
echo "📊 Remaining: $FINAL_COUNT statements (may be in utility scripts or non-production code)"
echo ""
echo "💡 To rollback changes, use the .backup files created for each modified file"
