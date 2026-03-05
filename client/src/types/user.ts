// Shared User type for user management components
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  preferredEmail?: string | null;
  address?: string | null;
  role: string;
  permissions: string[];
  permissionsModifiedAt?: string | null;
  permissionsModifiedBy?: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  metadata?: {
    smsConsent?: {
      enabled: boolean;
      phoneNumber?: string;
      displayPhone?: string;
      optInDate?: string;
      optOutDate?: string;
    };
  };
}

// Form data for adding/editing users
export interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  preferredEmail?: string;
  address?: string;
  role: string;
  isActive: boolean;
  password?: string;
}
