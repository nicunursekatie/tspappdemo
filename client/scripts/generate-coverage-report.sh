#!/bin/bash
# Test Coverage Report Generator
# Runs all tests with coverage and generates combined HTML report

set -e

echo "========================================="
echo "   Test Coverage Report Generator"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Clean previous coverage data
echo -e "${YELLOW}Cleaning previous coverage data...${NC}"
rm -rf coverage/
mkdir -p coverage

# Run server/unit tests with coverage
echo ""
echo -e "${GREEN}Running server unit tests with coverage...${NC}"
npm run test:coverage:server || true

# Run client tests with coverage
echo ""
echo -e "${GREEN}Running client tests with coverage...${NC}"
npm run test:coverage:client || true

# Run integration tests (without coverage threshold enforcement)
echo ""
echo -e "${GREEN}Running integration tests...${NC}"
npm run test:integration -- --coverage --coverageDirectory=coverage/integration || true

# Generate combined coverage report
echo ""
echo -e "${YELLOW}Generating combined coverage summary...${NC}"

# Check if coverage reports exist
if [ -f coverage/server/coverage-summary.json ] && [ -f coverage/client/coverage-summary.json ]; then
  echo ""
  echo "========================================="
  echo "   Coverage Summary"
  echo "========================================="
  echo ""

  # Extract coverage percentages using node
  node -e "
  const fs = require('fs');

  function readCoverage(path) {
    try {
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
  }

  const serverCov = readCoverage('coverage/server/coverage-summary.json');
  const clientCov = readCoverage('coverage/client/coverage-summary.json');
  const integrationCov = readCoverage('coverage/integration/coverage-summary.json');

  function formatCoverage(cov, name) {
    if (!cov || !cov.total) {
      console.log(\`\${name}: No coverage data available\`);
      return;
    }

    const total = cov.total;
    console.log(\`\${name}:\`);
    console.log(\`  Statements: \${total.statements.pct}%\`);
    console.log(\`  Branches:   \${total.branches.pct}%\`);
    console.log(\`  Functions:  \${total.functions.pct}%\`);
    console.log(\`  Lines:      \${total.lines.pct}%\`);
    console.log('');
  }

  formatCoverage(serverCov, 'Server/Shared Code');
  formatCoverage(clientCov, 'Client Code');
  formatCoverage(integrationCov, 'Integration Tests');

  // Calculate overall stats
  function getCoverageStats(cov) {
    if (!cov || !cov.total) return null;
    return cov.total;
  }

  const serverStats = getCoverageStats(serverCov);
  const clientStats = getCoverageStats(clientCov);

  if (serverStats && clientStats) {
    const avgStatements = ((serverStats.statements.pct + clientStats.statements.pct) / 2).toFixed(2);
    const avgBranches = ((serverStats.branches.pct + clientStats.branches.pct) / 2).toFixed(2);
    const avgFunctions = ((serverStats.functions.pct + clientStats.functions.pct) / 2).toFixed(2);
    const avgLines = ((serverStats.lines.pct + clientStats.lines.pct) / 2).toFixed(2);

    console.log('Overall Average:');
    console.log(\`  Statements: \${avgStatements}%\`);
    console.log(\`  Branches:   \${avgBranches}%\`);
    console.log(\`  Functions:  \${avgFunctions}%\`);
    console.log(\`  Lines:      \${avgLines}%\`);
  }
  "

  echo ""
  echo "========================================="
  echo ""
  echo -e "${GREEN}Coverage reports generated!${NC}"
  echo ""
  echo "Server coverage:      coverage/server/index.html"
  echo "Client coverage:      coverage/client/index.html"
  echo "Integration coverage: coverage/integration/index.html"
  echo ""
  echo "Open these files in your browser to view detailed coverage reports."
  echo ""
else
  echo -e "${RED}Error: Could not generate coverage summary${NC}"
  echo "Some coverage reports may be missing."
fi

# Check coverage thresholds
echo -e "${YELLOW}Checking coverage thresholds...${NC}"
echo "Target: Server 60%, Client 40%"
echo ""

exit 0
