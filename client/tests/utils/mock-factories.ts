/**
 * Mock data factories for testing
 */

export const mockUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'volunteer',
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockAdminUser = (overrides = {}) => ({
  ...mockUser(),
  id: 999,
  username: 'admin',
  email: 'admin@example.com',
  fullName: 'Admin User',
  role: 'admin',
  ...overrides,
});

export const mockDriver = (overrides = {}) => ({
  id: 1,
  name: 'Test Driver',
  email: 'driver@example.com',
  phone: '555-0100',
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockEventRequest = (overrides = {}) => ({
  id: 1,
  title: 'Test Event',
  description: 'Test event description',
  status: 'pending',
  requestedBy: 1,
  requestedDate: new Date().toISOString(),
  eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  location: 'Test Location',
  estimatedAttendees: 50,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockHost = (overrides = {}) => ({
  id: 1,
  name: 'Test Host',
  email: 'host@example.com',
  phone: '555-0200',
  organization: 'Test Organization',
  address: '123 Test St',
  city: 'Test City',
  state: 'TS',
  zip: '12345',
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockRecipient = (overrides = {}) => ({
  id: 1,
  name: 'Test Recipient',
  email: 'recipient@example.com',
  phone: '555-0300',
  organization: 'Recipient Organization',
  address: '456 Test Ave',
  city: 'Test City',
  state: 'TS',
  zip: '12345',
  dietaryRestrictions: [],
  allergies: [],
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockVolunteer = (overrides = {}) => ({
  id: 1,
  userId: 1,
  name: 'Test Volunteer',
  email: 'volunteer@example.com',
  phone: '555-0400',
  availability: ['Monday', 'Wednesday', 'Friday'],
  skills: ['driving', 'cooking'],
  hoursServed: 0,
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockMeeting = (overrides = {}) => ({
  id: 1,
  title: 'Test Meeting',
  description: 'Test meeting description',
  meetingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  startTime: '10:00',
  endTime: '11:00',
  location: 'Conference Room A',
  organizer: 1,
  attendees: [],
  status: 'scheduled',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockAnnouncement = (overrides = {}) => ({
  id: 1,
  title: 'Test Announcement',
  content: 'This is a test announcement',
  author: 1,
  priority: 'normal',
  isActive: true,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

export const mockSession = (user = mockUser()) => ({
  user,
  isAuthenticated: true,
});

export const mockAdminSession = () => mockSession(mockAdminUser());

/**
 * Create a mock fetch response
 */
export const mockFetchResponse = (data: any, ok = true, status = 200) => {
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
};

/**
 * Create a mock error response
 */
export const mockErrorResponse = (message = 'Error', status = 500) => {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message }),
  } as Response);
};
