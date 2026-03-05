import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { storage } from '../storage-wrapper';
import { db } from '../db';
import { users } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import { getDefaultPermissionsForRole, PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../middleware/auth';
import { generateVerificationCode, sendConfirmationSMS } from '../sms-service';

const router = Router();

// In-memory store for signup SMS verification (temporary until user is created)
const signupSmsVerifications = new Map<string, {
  code: string;
  phone: string;
  expiry: Date;
  verified: boolean;
}>();

// Clean up expired verifications every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [key, value] of signupSmsVerifications.entries()) {
    if (value.expiry < now) {
      signupSmsVerifications.delete(key);
    }
  }
}, 5 * 60 * 1000);

const signupSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone: z.string().min(10),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  optInTextAlerts: z.boolean().optional(),
  smsVerified: z.boolean().optional(),
  agreeToTerms: z.boolean().refine((val) => val === true),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Send SMS verification for signup (no auth required)
router.post('/auth/signup/send-sms-verification', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Clean and format phone number
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone;

    // Validate phone number format (basic US phone number validation)
    if (!/^\+1\d{10}$/.test(formattedPhone)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Please enter a valid US phone number.' 
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Send confirmation SMS
    const result = await sendConfirmationSMS(formattedPhone, verificationCode);
    
    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to send verification SMS',
        message: result.message,
      });
    }

    // Store verification info (keyed by phone number)
    signupSmsVerifications.set(formattedPhone, {
      code: verificationCode,
      phone: formattedPhone,
      expiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      verified: false,
    });

    logger.log(`📱 SMS verification code sent to ${formattedPhone} for signup`);

    res.json({
      success: true,
      message: 'Verification code sent! Please enter the code to confirm your phone number.',
      phone: formattedPhone,
    });
  } catch (error) {
    logger.error('Error sending signup SMS verification:', error);
    res.status(500).json({
      error: 'Failed to send verification SMS',
      message: (error as Error).message,
    });
  }
});

// Verify SMS code for signup (no auth required)
router.post('/auth/signup/verify-sms-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    // Clean and format phone number
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone;

    // Get stored verification
    const verification = signupSmsVerifications.get(formattedPhone);
    
    if (!verification) {
      return res.status(400).json({ 
        error: 'No verification pending for this phone number. Please request a new code.' 
      });
    }

    // Check if expired
    if (verification.expiry < new Date()) {
      signupSmsVerifications.delete(formattedPhone);
      return res.status(400).json({ 
        error: 'Verification code has expired. Please request a new code.' 
      });
    }

    // Check code
    if (verification.code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }

    // Mark as verified and clear the code to prevent reuse
    verification.verified = true;
    verification.code = ''; // Clear code after successful verification
    signupSmsVerifications.set(formattedPhone, verification);

    logger.log(`✅ SMS verification successful for ${formattedPhone} during signup`);

    res.json({
      success: true,
      message: 'Phone number verified successfully!',
      verified: true,
    });
  } catch (error) {
    logger.error('Error verifying signup SMS code:', error);
    res.status(500).json({
      error: 'Failed to verify code',
      message: (error as Error).message,
    });
  }
});

router.post('/auth/signup', async (req, res) => {
  logger.log('=== SIGNUP ROUTE HIT ===');
  logger.log('Request method:', req.method);
  logger.log('Request URL:', req.url);
  logger.log('Request body:', req.body);
  try {
    // Validate request body
    const validatedData = signupSchema.parse(req.body);

    // Check if user already exists first
    const existingUser = await storage.getUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email already exists',
      });
    }

    // Check if SMS was verified (if they opted in)
    let smsConsentData: any = null;
    if (validatedData.optInTextAlerts) {
      // Clean and format phone number
      const cleanPhone = validatedData.phone.replace(/[^\d+]/g, '');
      const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone;
      
      // Verify the SMS was actually verified - REQUIRE verification if opting in
      const verification = signupSmsVerifications.get(formattedPhone);
      if (!verification?.verified) {
        return res.status(400).json({
          message: 'Phone verification required. Please verify your phone number to opt in to text alerts.',
        });
      }
      
      smsConsentData = {
        status: 'confirmed',
        phoneNumber: formattedPhone,
        enabled: true,
        confirmedAt: new Date().toISOString(),
        confirmationMethod: 'verification_code',
        campaignTypes: ['hosts', 'events'], // Opt into both campaign types
        consentTimestamp: new Date().toISOString(),
        consentVersion: '1.0',
      };
      // Clean up the verification
      signupSmsVerifications.delete(formattedPhone);
    }

    // Create user account with registration data using direct database insert
    const userId =
      'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(validatedData.password, saltRounds);

    // Use direct database insert with explicit casting
    logger.log('Creating user with ID:', userId);
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phoneNumber: validatedData.phone,
        role: 'volunteer', // Default role for new signups
        permissions: [] as any, // Cast to any to avoid type issues
        isActive: false, // Requires approval
        wantsTextAlerts: validatedData.optInTextAlerts && validatedData.smsVerified,
        metadata: {
          registrationData: {
            ...validatedData,
            password: undefined, // Don't store plaintext password in metadata
            confirmPassword: undefined,
          },
          status: 'pending_approval',
          registrationDate: new Date().toISOString(),
          ...(smsConsentData && { smsConsent: smsConsentData }),
        } as any, // Cast to any for metadata
      } as any)
      .returning();
    logger.log('User created successfully:', newUser);

    // Store registration details in a simple format for admin review
    const addressParts = [validatedData.address, validatedData.city, validatedData.state, validatedData.zipCode]
      .filter(Boolean)
      .join(', ');
    logger.log(`
=== NEW USER REGISTRATION ===
Name: ${validatedData.firstName} ${validatedData.lastName}
Email: ${validatedData.email}
Phone: ${validatedData.phone}
Address: ${addressParts || 'Not provided'}
SMS Alerts: ${smsConsentData ? 'Opted in and verified' : 'Not opted in'}
Terms Agreed: ${validatedData.agreeToTerms}
Registration Date: ${new Date().toISOString()}
=============================
    `);

    res.status(201).json({
      message:
        "Registration successful. Your application will be reviewed and you'll be contacted soon.",
      userId: newUser.id,
    });
  } catch (error) {
    logger.error('Signup error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid registration data',
        errors: error.errors,
      });
    }

    res.status(500).json({
      message: 'Registration failed. Please try again later.',
    });
  }
});

// Get pending registrations (admin only)
router.get('/auth/pending-registrations', requirePermission(PERMISSIONS.ADMIN_ACCESS), async (req, res) => {
  try {
    // In a real implementation, check admin permissions here
    const users = await storage.getAllUsers();
    const pendingUsers = users.filter(
      (user) => user.metadata?.status === 'pending_approval' && !user.isActive
    );

    res.json(pendingUsers);
  } catch (error) {
    logger.error('Error fetching pending registrations:', error);
    res.status(500).json({ message: 'Failed to fetch pending registrations' });
  }
});

// Approve user registration (admin only)
router.patch('/auth/approve-user/:userId', requirePermission(PERMISSIONS.ADMIN_ACCESS), async (req, res) => {
  try {
    const { userId } = req.params;
    const { approved } = req.body;

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build updates object
    const updates: any = {
      isActive: approved,
      metadata: {
        ...user.metadata,
        status: approved ? 'approved' : 'rejected',
        approvedDate: approved ? new Date().toISOString() : undefined,
      },
    };

    // When approving, assign default permissions for user's role
    if (approved) {
      const defaultPermissions = getDefaultPermissionsForRole(user.role);
      updates.permissions = defaultPermissions;
      
      logger.log(`Approving user ${userId} with role ${user.role}`);
      logger.log(`Assigning ${defaultPermissions.length} default permissions`);
    }

    await storage.updateUser(userId, updates);

    logger.log(`User ${userId} ${approved ? 'approved' : 'rejected'} successfully`);

    res.json({
      message: `User ${approved ? 'approved' : 'rejected'} successfully`,
      permissions: approved ? updates.permissions.length : 0,
    });
  } catch (error) {
    logger.error('Error updating user approval:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
});

export { router as signupRoutes };
