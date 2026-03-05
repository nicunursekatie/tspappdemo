# Security Fixes Testing Guide
**Date:** 2025-11-06
**Fixes Applied:** BUG-010 (Prototype Pollution) & BUG-008 (JSON.parse Crashes)

This guide provides step-by-step instructions to test and verify the security fixes are working correctly.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Test BUG-010: Prototype Pollution Protection](#test-bug-010-prototype-pollution-protection)
3. [Test BUG-008: Safe JSON Parsing](#test-bug-008-safe-json-parsing)
4. [Verify Logs](#verify-logs)
5. [Load Testing](#load-testing)
6. [Success Criteria](#success-criteria)

---

## Prerequisites

### Setup
```bash
# 1. Start the server in development mode
npm run dev

# 2. Get a valid session cookie (login first)
# Save your session cookie for testing
```

### Get Session Cookie
```bash
# Login to get session cookie
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}' \
  -c cookies.txt -v

# Extract session cookie from cookies.txt
# Look for: tsp.session=<cookie-value>
```

---

## Test BUG-010: Prototype Pollution Protection

### Test 1: Normal Request Should Work ✅

**Purpose:** Verify legitimate requests still function correctly

```bash
# Test normal meeting update
curl -X PATCH http://localhost:5000/api/meetings/notes/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{
    "content": "Updated meeting notes",
    "type": "action_item"
  }' \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 200
# Response: Updated meeting note object
```

### Test 2: Prototype Pollution Attempt Should Be Blocked ❌

**Purpose:** Verify __proto__ attacks are detected and blocked

```bash
# Test 1: Direct __proto__ injection
curl -X PATCH http://localhost:5000/api/meetings/notes/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{
    "__proto__": {"isAdmin": true},
    "content": "Trying to hack"
  }' \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 400
# Response: {"error":"Invalid request: prohibited property names detected"}
```

```bash
# Test 2: Nested __proto__ injection
curl -X PATCH http://localhost:5000/api/meetings/notes/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{
    "content": "Normal content",
    "metadata": {
      "__proto__": {"role": "admin"}
    }
  }' \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 400
# Response: {"error":"Invalid request: prohibited property names detected"}
```

### Test 3: Constructor Pollution Should Be Blocked ❌

**Purpose:** Verify constructor pollution is detected

```bash
curl -X PATCH http://localhost:5000/api/meetings/notes/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{
    "constructor": {
      "prototype": {"isAdmin": true}
    },
    "content": "Attack attempt"
  }' \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 400
# Response: {"error":"Invalid request: prohibited property names detected"}
```

### Test 4: Query Parameter Pollution Should Be Blocked ❌

**Purpose:** Verify query params are also protected

```bash
curl "http://localhost:5000/api/smart-search/query?q=test&__proto__[isAdmin]=true" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 400
# Response: {"error":"Invalid request: prohibited property names detected"}
```

---

## Test BUG-008: Safe JSON Parsing

### Test 5: Valid JSON Should Work ✅

**Purpose:** Verify valid JSON still parses correctly

```bash
# Test event request with valid sandwichTypes
curl -X PATCH http://localhost:5000/api/event-requests/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{
    "status": "scheduled",
    "sandwichTypes": "[\"turkey\", \"ham\", \"veggie\"]"
  }' \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 200
# Response: Updated event request
# Server stays running
```

### Test 6: Malformed JSON in Request Body Should Not Crash Server ❌

**Purpose:** Verify server doesn't crash on malformed request JSON

```bash
# Send completely invalid JSON
curl -X PATCH http://localhost:5000/api/meetings/notes/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{this is not valid json}' \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 400
# Response: {"error":"Invalid JSON in request body"}
# Server stays running ✅
```

```bash
# Verify server is still running
curl http://localhost:5000/healthz

# Expected Result:
# Status: 200
# Server is alive ✅
```

### Test 7: Malformed JSON in Field Should Not Crash Server ❌

**Purpose:** Verify safe parsing of JSON string fields

```bash
# Send malformed JSON in sandwichTypes field
curl -X PATCH http://localhost:5000/api/event-requests/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{
    "status": "scheduled",
    "sandwichTypes": "}{this is invalid JSON"
  }' \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 200 (request succeeds)
# sandwichTypes defaults to empty array []
# Error logged but server continues ✅
```

```bash
# Verify server is still running
curl http://localhost:5000/healthz

# Expected Result:
# Status: 200
```

### Test 8: Audit Logs with Malformed Data Should Work ✅

**Purpose:** Verify audit log parsing doesn't crash on bad data

```bash
# View audit logs (some may have malformed JSON)
curl http://localhost:5000/api/audit-logs \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -w "\nStatus: %{http_code}\n"

# Expected Result:
# Status: 200
# Logs returned (malformed data shown with _parseError flag)
# Server doesn't crash ✅
```

---

## Verify Logs

### Check for Security Events

```bash
# Check for prototype pollution attempts
grep "Prototype pollution attempt" logs/error.log

# Expected: Should see logged attempts from Test 2, 3, 4
# Example:
# [ERROR] Prototype pollution attempt blocked by middleware
#   path: /api/meetings/notes/1
#   method: PATCH
#   ip: 127.0.0.1
```

```bash
# Check for JSON parse errors
grep "JSON parse error" logs/error.log

# Expected: Should see errors from Test 7
# Example:
# [ERROR] JSON parse error
#   context: sandwichTypes field
#   error: Unexpected token } in JSON
```

### Check Application Logs

```bash
# Verify middleware is loaded
grep "prototype.*guard\|json.*error" logs/combined.log

# Should see server startup messages about middleware being loaded
```

---

## Load Testing

### Test Under Load (Optional)

**Purpose:** Verify protections work under concurrent requests

```bash
# Install Apache Bench (if not installed)
# Ubuntu/Debian: sudo apt-get install apache2-utils
# macOS: brew install ab

# Test 1: Normal traffic
ab -n 1000 -c 10 -H "Cookie: tsp.session=YOUR_SESSION" \
  http://localhost:5000/api/meetings

# Expected:
# All requests complete successfully
# 0% failed requests

# Test 2: Malicious traffic
# Create attack payload file
echo '{"__proto__":{"isAdmin":true}}' > attack.json

ab -n 100 -c 5 -p attack.json -T 'application/json' \
  -H "Cookie: tsp.session=YOUR_SESSION" \
  http://localhost:5000/api/meetings/notes/1

# Expected:
# All requests return 400
# Server remains stable
# 0% server errors (5xx)
```

---

## Success Criteria

### ✅ Prototype Pollution Protection Working

- [ ] Normal requests (Test 1) return 200 OK
- [ ] `__proto__` attacks (Test 2) return 400 Bad Request
- [ ] Nested `__proto__` attacks (Test 2) return 400
- [ ] `constructor` attacks (Test 3) return 400
- [ ] Query parameter attacks (Test 4) return 400
- [ ] Security events logged in error.log
- [ ] No server crashes during any test

### ✅ Safe JSON Parsing Working

- [ ] Valid JSON (Test 5) parses successfully
- [ ] Malformed request JSON (Test 6) returns 400
- [ ] Server stays running after Test 6
- [ ] Malformed field JSON (Test 7) handled gracefully
- [ ] Defaults used when parse fails (Test 7)
- [ ] Audit logs work despite malformed data (Test 8)
- [ ] Parse errors logged with context
- [ ] No server crashes during any test

### ✅ General Stability

- [ ] `/healthz` endpoint responds after all tests
- [ ] No uncaught exceptions in logs
- [ ] All middleware loaded successfully
- [ ] Error logs contain helpful debugging info
- [ ] No memory leaks observed

---

## Troubleshooting

### Issue: Getting 401 Unauthorized

**Solution:** Your session cookie expired. Re-login and get a fresh cookie.

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email", "password": "your-password"}' \
  -c cookies.txt
```

### Issue: Getting 404 Not Found

**Solution:** Check the endpoint exists and your server is running on the correct port.

```bash
# Verify server is running
curl http://localhost:5000/healthz

# Check which routes are registered
grep "router.*use\|app.*use" server/index.ts
```

### Issue: Tests pass but no logs

**Solution:** Check log level and log file location.

```bash
# Check if logs directory exists
ls -la logs/

# Check log level
grep LOG_LEVEL .env

# Tail logs in real-time
tail -f logs/combined.log
tail -f logs/error.log
```

### Issue: Server crashes during tests

**Solution:** This means the fix isn't working. Check:

```bash
# 1. Verify middleware is imported
grep "prototypePollutionGuard\|jsonErrorHandler" server/index.ts

# 2. Verify middleware is used
grep "app.use.*prototypePollutionGuard\|app.use.*jsonErrorHandler" server/index.ts

# 3. Check for TypeScript compilation errors
npm run build

# 4. Restart server in dev mode with verbose logging
DEBUG=* npm run dev
```

---

## Automated Test Script

Save this as `test-security-fixes.sh`:

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:5000"
SESSION_COOKIE="$1"

if [ -z "$SESSION_COOKIE" ]; then
  echo -e "${RED}Usage: $0 <session-cookie>${NC}"
  echo "Get session cookie by logging in first"
  exit 1
fi

echo "=== Testing Security Fixes ==="
echo

# Test 1: Normal request
echo -n "Test 1: Normal request... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH "$BASE_URL/api/meetings/notes/1" \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=$SESSION_COOKIE" \
  -d '{"content":"Test"}')

if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}PASS${NC} (Status: $STATUS)"
else
  echo -e "${RED}FAIL${NC} (Status: $STATUS, expected 200)"
fi

# Test 2: Prototype pollution
echo -n "Test 2: Prototype pollution blocked... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH "$BASE_URL/api/meetings/notes/1" \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=$SESSION_COOKIE" \
  -d '{"__proto__":{"isAdmin":true}}')

if [ "$STATUS" = "400" ]; then
  echo -e "${GREEN}PASS${NC} (Status: $STATUS)"
else
  echo -e "${RED}FAIL${NC} (Status: $STATUS, expected 400)"
fi

# Test 3: Server still alive
echo -n "Test 3: Server still alive... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/healthz")

if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}PASS${NC} (Status: $STATUS)"
else
  echo -e "${RED}FAIL${NC} (Status: $STATUS, expected 200)"
fi

echo
echo "=== Tests Complete ==="
```

**Usage:**
```bash
chmod +x test-security-fixes.sh
./test-security-fixes.sh "your-session-cookie-value"
```

---

## Next Steps

After all tests pass:

1. ✅ Deploy to staging environment
2. ✅ Run tests against staging
3. ✅ Monitor error logs for 24 hours
4. ✅ Review security metrics
5. ✅ Deploy to production
6. ✅ Monitor production logs

**Security Metrics to Track:**
- Prototype pollution attempts per day
- JSON parse errors per day
- 400 error rate (should increase initially)
- 500 error rate (should decrease)
- Server uptime (should improve)

---

## Questions?

If tests fail or you encounter unexpected behavior:

1. Check server logs: `logs/error.log` and `logs/combined.log`
2. Verify all files were committed: `git status`
3. Rebuild the project: `npm run build`
4. Restart the server: `npm run dev`
5. Review the implementation guide: `BUG_FIXES_IMPLEMENTATION_GUIDE.md`

For additional help, reference:
- `CODE_AUDIT_BUGS_REPORT.md` - Original bug descriptions
- `BUG_FIXES_IMPLEMENTATION_GUIDE.md` - Implementation details
