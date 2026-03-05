#!/usr/bin/env node

/**
 * Script to find all uses of /api/users endpoint and identify which ones
 * might need to be changed to /api/users/for-assignments or /api/users/basic
 * 
 * Usage: node scripts/find-users-endpoint-issues.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientSrcPath = path.join(__dirname, '../client/src');

// Find all files using /api/users
function findUsersEndpointUsage() {
  try {
    const result = execSync(
      `grep -r "queryKey.*\\['/api/users'\\]\\|queryKey.*\\[\"/api/users\"\\]\\|apiRequest.*'/api/users'\\|apiRequest.*\"/api/users\"\\|fetch.*'/api/users'\\|fetch.*\"/api/users\"" ${clientSrcPath} --include="*.tsx" --include="*.ts" -l`,
      { encoding: 'utf-8' }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

// Analyze each file
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const issues = [];
  const context = [];
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check if this line uses /api/users
    if (line.match(/\/api\/users['"]/) && !line.match(/\/api\/users\/(for-assignments|basic|online)/)) {
      // Check if it's in a useQuery or similar
      if (line.match(/queryKey|apiRequest|fetch/)) {
        // Get context (5 lines before and after)
        const start = Math.max(0, index - 5);
        const end = Math.min(lines.length, index + 6);
        const fileContext = lines.slice(start, end).map((l, i) => ({
          line: start + i + 1,
          content: l,
          isMatch: start + i === index
        }));
        
        // Determine if this is likely an admin-only component
        const isAdminComponent = 
          filePath.includes('user-management') ||
          filePath.includes('bulk-permissions') ||
          content.includes('USERS_EDIT') ||
          content.includes('canManageUsers') ||
          content.includes('requirePermission') ||
          content.match(/enabled.*USERS_EDIT|enabled.*canManage/);
        
        // Determine if it's just for display/selection
        const isDisplayOnly = 
          line.match(/displayName|firstName|lastName|email/) ||
          content.includes('recipient') ||
          content.includes('assignee') ||
          content.includes('mention') ||
          content.includes('select') ||
          content.includes('dropdown');
        
        issues.push({
          file: filePath.replace(clientSrcPath + '/', ''),
          line: lineNum,
          code: line.trim(),
          isAdminComponent,
          isDisplayOnly,
          context: fileContext,
          recommendation: isAdminComponent 
            ? 'KEEP (admin component)' 
            : isDisplayOnly 
              ? 'CHANGE to /api/users/for-assignments or /api/users/basic'
              : 'REVIEW (might need change)'
        });
      }
    }
  });
  
  return issues;
}

// Main execution
console.log('🔍 Searching for /api/users endpoint usage...\n');

const files = findUsersEndpointUsage();
console.log(`Found ${files.length} files using /api/users endpoint\n`);

const allIssues = [];
files.forEach(file => {
  const issues = analyzeFile(file);
  allIssues.push(...issues);
});

// Categorize issues
const needsChange = allIssues.filter(i => i.recommendation.includes('CHANGE'));
const needsReview = allIssues.filter(i => i.recommendation.includes('REVIEW'));
const keepAsIs = allIssues.filter(i => i.recommendation.includes('KEEP'));

console.log('📊 SUMMARY:\n');
console.log(`✅ Keep as-is (admin components): ${keepAsIs.length}`);
console.log(`⚠️  Needs review: ${needsReview.length}`);
console.log(`🔧 Needs change: ${needsChange.length}\n`);

if (needsChange.length > 0) {
  console.log('🔧 COMPONENTS THAT NEED CHANGES:\n');
  needsChange.forEach((issue, idx) => {
    console.log(`${idx + 1}. ${issue.file}:${issue.line}`);
    console.log(`   Code: ${issue.code.substring(0, 80)}...`);
    console.log(`   Recommendation: ${issue.recommendation}\n`);
  });
}

if (needsReview.length > 0) {
  console.log('\n⚠️  COMPONENTS THAT NEED REVIEW:\n');
  needsReview.forEach((issue, idx) => {
    console.log(`${idx + 1}. ${issue.file}:${issue.line}`);
    console.log(`   Code: ${issue.code.substring(0, 80)}...`);
    console.log(`   Recommendation: ${issue.recommendation}\n`);
  });
}

// Generate a report file
const report = {
  generated: new Date().toISOString(),
  summary: {
    total: allIssues.length,
    needsChange: needsChange.length,
    needsReview: needsReview.length,
    keepAsIs: keepAsIs.length
  },
  needsChange: needsChange.map(i => ({
    file: i.file,
    line: i.line,
    code: i.code,
    recommendation: i.recommendation
  })),
  needsReview: needsReview.map(i => ({
    file: i.file,
    line: i.line,
    code: i.code,
    recommendation: i.recommendation
  }))
};

fs.writeFileSync(
  path.join(__dirname, '../users-endpoint-audit.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📄 Detailed report saved to: users-endpoint-audit.json\n');

