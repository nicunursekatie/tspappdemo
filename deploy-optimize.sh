#!/bin/bash
# Deployment optimization script to reduce disk usage

echo "🧹 Starting deployment optimization..."

# 1. Remove development files and directories
echo "Removing development files..."
rm -rf __tests__ __checks__ test tests
rm -rf docs logs/*.log
rm -f test-*.js test-*.cjs test-*.html test-*.sh
rm -f *.pdf *.sql *.png temp_file cookies.txt database.db

# 2. Clear caches (except Replit system caches)
echo "Clearing caches..."
rm -rf .cache/typescript

# 3. Remove existing node_modules and reinstall with production flag
echo "Installing production dependencies only..."
rm -rf node_modules
npm ci --omit=dev --prefer-offline --no-audit

# 4. Build the application
echo "Building application..."
npm run build

# 5. Show final disk usage
echo "✅ Optimization complete!"
echo "Final disk usage:"
du -sh .
df -h . | awk 'NR==2 {print "Disk: " $3 " / " $2 " (" $5 " full)"}'