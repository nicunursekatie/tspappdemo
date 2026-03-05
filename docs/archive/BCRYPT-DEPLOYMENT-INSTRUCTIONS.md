# 🔐 Bcrypt Password Security Migration

## ⚠️ CRITICAL: READ BEFORE DEPLOYING

This migration converts all plaintext passwords to bcrypt hashes. **This is a breaking change** that requires careful coordination between database migration and code deployment.

---

## 📋 Pre-Deployment Checklist

- [ ] **Backup your database** - Create a snapshot/backup of your Neon database
- [ ] **Verify bcrypt is installed** - Check that `bcrypt` package is in `package.json`
- [ ] **Review the SQL migration** - Read through `BCRYPT-MIGRATION.sql`
- [ ] **Plan maintenance window** - Users will not be able to log in during migration

---

## 🚀 Deployment Steps

### Step 1: Backup Database (REQUIRED)

**In Neon Console:**
1. Go to your Neon dashboard
2. Navigate to your database
3. Create a backup/snapshot
4. Confirm backup completed successfully

### Step 2: Run SQL Migration on Neon Database

**Open Neon SQL Editor** and execute these queries in order:

#### 2a. Enable pgcrypto extension
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

#### 2b. Check current password status (REVIEW ONLY)
```sql
SELECT
  id,
  email,
  CASE
    WHEN password IS NULL THEN 'NO PASSWORD'
    WHEN password ~ '^\$2[aby]\$\d{2}\$' THEN 'ALREADY HASHED'
    ELSE 'PLAINTEXT (WILL BE HASHED)'
  END as password_status,
  LENGTH(password) as password_length
FROM users
WHERE is_active = true
ORDER BY password_status, email;
```

**REVIEW THE OUTPUT** - Verify the list of users whose passwords will be hashed.

#### 2c. Hash all plaintext passwords (DESTRUCTIVE)
```sql
UPDATE users
SET password = crypt(password, gen_salt('bf', 10))
WHERE
  is_active = true
  AND password IS NOT NULL
  AND NOT (password ~ '^\$2[aby]\$\d{2}\$')
  AND LENGTH(password) < 60;
```

**Expected output:** `UPDATE XX` where XX is the number of users with plaintext passwords.

#### 2d. Verify migration success (REVIEW ONLY)
```sql
SELECT
  id,
  email,
  CASE
    WHEN password IS NULL THEN 'NO PASSWORD'
    WHEN password ~ '^\$2[aby]\$\d{2}\$' THEN 'HASHED ✓'
    ELSE 'PLAINTEXT ⚠️'
  END as password_status,
  LENGTH(password) as password_length
FROM users
WHERE is_active = true
ORDER BY password_status, email;
```

**Expected result:** All active users should show "HASHED ✓" (or "NO PASSWORD" for users without passwords).

### Step 3: Deploy Updated Code

**IMMEDIATELY AFTER** the SQL migration succeeds:

1. **Commit changes to git:**
   ```bash
   git add .
   git commit -m "Add bcrypt password hashing for security"
   git push
   ```

2. **Deploy to Replit** (or your hosting platform):
   - If using Replit: Click "Publish" or push to production
   - Verify the deployment includes the updated code

### Step 4: Test Login

**Test with a known user account:**
1. Attempt to log in with correct credentials
2. Verify login succeeds
3. Try incorrect password - verify it fails with "Invalid email or password"
4. Test password change functionality
5. Test password reset flow (if applicable)

---

## 🔄 Rollback Procedure (If Something Goes Wrong)

If deployment fails or login breaks:

### Option 1: Revert to Plaintext (Not Recommended)
```sql
-- This will NOT work because the plaintext passwords are now hashed
-- YOU CANNOT REVERSE BCRYPT HASHING
```

### Option 2: Restore from Backup
1. Stop the application
2. Restore database from the backup you created in Step 1
3. Revert code changes: `git revert HEAD`
4. Redeploy old code
5. Debug the issue before attempting migration again

---

## ✅ Post-Deployment Verification

After successful deployment:

- [ ] All users can log in with their existing passwords
- [ ] Password change works correctly
- [ ] New user registration creates hashed passwords
- [ ] Admin password reset works correctly
- [ ] Password reset emails work correctly

---

## 📝 What Changed

### Database
- All passwords in `users.password` column are now bcrypt hashes (60 characters, starts with `$2a$`, `$2b$`, or `$2y$`)

### Code Files Updated
1. **server/routes/auth.ts** - Login route uses `bcrypt.compare()`
2. **server/auth.ts** - Login, registration, password change, and admin reset all use bcrypt
3. **server/routes/password-reset.ts** - Password reset uses bcrypt hashing
4. **package.json** - Added `bcrypt` and `@types/bcrypt` dependencies

### New Password Flow
```
User Registration:
password → bcrypt.hash(password, 10) → stored in DB

User Login:
entered password → bcrypt.compare(entered, stored) → true/false

Password Change/Reset:
new password → bcrypt.hash(newPassword, 10) → stored in DB
```

---

## 🆘 Troubleshooting

### "Invalid email or password" for all users after migration
- **Cause:** Code deployed before SQL migration, or SQL migration failed
- **Fix:** Check Step 2d verification query. If passwords aren't hashed, re-run Step 2c.

### "bcrypt not found" error
- **Cause:** bcrypt package not installed
- **Fix:** Run `npm install bcrypt @types/bcrypt` and redeploy

### Slow login performance
- **Cause:** Bcrypt is CPU-intensive (this is intentional for security)
- **Expected:** Login may take 100-300ms (this is normal and secure)

---

## 🔒 Security Improvements

After this migration:
- ✅ Passwords are hashed with bcrypt (industry standard)
- ✅ Database breach will NOT expose user passwords
- ✅ Each password has a unique salt
- ✅ Compliant with OWASP security guidelines
- ✅ Rainbow table attacks are ineffective

---

## ⏱️ Estimated Migration Time

- Database migration: ~5 seconds for 30 users
- Code deployment: 30-60 seconds
- Total downtime: **< 2 minutes**

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review console logs for specific error messages
3. Verify all steps were completed in order
4. Check that database backup exists before attempting fixes

---

**Generated on:** October 23, 2025
**Migration Type:** Plaintext → Bcrypt Password Hashing
**Breaking Change:** Yes (requires database + code deployment)
