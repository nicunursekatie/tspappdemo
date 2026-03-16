/**
 * Demo Seed Data
 *
 * Sample data for the isolated demo instance.
 * All data is fictional and loaded into in-memory storage on startup.
 */

export function seedDemoData(storage: {
  users: Map<string, any>;
  hosts: Map<number, any>;
  hostContacts: Map<number, any>;
  sandwichCollections: Map<number, any>;
  eventRequests: Map<number, any>;
  organizations: Map<number, any>;
  recipients: Map<number, any>;
  projects: Map<number, any>;
  projectTasks: Map<number, any>;
  messages: Map<number, any>;
  drivers: Map<number, any>;
  currentIds: Record<string, number>;
}) {
  // ── Users ──────────────────────────────────────────────
  const demoUsers = [
    {
      id: '1',
      email: 'demo-admin@thesandwichproject.org',
      password: null,
      firstName: 'Demo',
      lastName: 'Admin',
      displayName: 'Demo Admin',
      profileImageUrl: null,
      phoneNumber: null,
      preferredEmail: null,
      role: 'admin',
      permissions: ['*'],
      permissionsModifiedAt: null,
      permissionsModifiedBy: null,
      address: null,
      latitude: null,
      longitude: null,
      geocodedAt: null,
      metadata: {},
      isActive: true,
      needsPasswordSetup: false,
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date(),
      passwordBackup20241023: null,
      approvalStatus: null,
      approvedBy: null,
      approvedAt: null,
      platformUserId: null,
      smsAlertsEnabled: null,
      emailNotificationsEnabled: null,
      notifyOnNewIntake: null,
      notifyOnTaskDue: null,
      notifyOnStatusChange: null,
    },
    {
      id: '2',
      email: 'sarah.coordinator@example.com',
      password: null,
      firstName: 'Sarah',
      lastName: 'Martinez',
      displayName: 'Sarah M.',
      profileImageUrl: null,
      phoneNumber: null,
      preferredEmail: null,
      role: 'admin_coordinator',
      permissions: ['EVENT_REQUESTS_VIEW', 'EVENT_REQUESTS_EDIT', 'COLLECTIONS_VIEW', 'COLLECTIONS_EDIT'],
      permissionsModifiedAt: null,
      permissionsModifiedBy: null,
      address: null,
      latitude: null,
      longitude: null,
      geocodedAt: null,
      metadata: {},
      isActive: true,
      needsPasswordSetup: false,
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date(),
      passwordBackup20241023: null,
      approvalStatus: null,
      approvedBy: null,
      approvedAt: null,
      platformUserId: null,
      smsAlertsEnabled: null,
      emailNotificationsEnabled: null,
      notifyOnNewIntake: null,
      notifyOnTaskDue: null,
      notifyOnStatusChange: null,
    },
    {
      id: '3',
      email: 'mike.volunteer@example.com',
      password: null,
      firstName: 'Mike',
      lastName: 'Johnson',
      displayName: 'Mike J.',
      profileImageUrl: null,
      phoneNumber: null,
      preferredEmail: null,
      role: 'volunteer',
      permissions: ['COLLECTIONS_VIEW', 'COLLECTIONS_EDIT'],
      permissionsModifiedAt: null,
      permissionsModifiedBy: null,
      address: null,
      latitude: null,
      longitude: null,
      geocodedAt: null,
      metadata: {},
      isActive: true,
      needsPasswordSetup: false,
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      createdAt: new Date('2024-03-10'),
      updatedAt: new Date(),
      passwordBackup20241023: null,
      approvalStatus: null,
      approvedBy: null,
      approvedAt: null,
      platformUserId: null,
      smsAlertsEnabled: null,
      emailNotificationsEnabled: null,
      notifyOnNewIntake: null,
      notifyOnTaskDue: null,
      notifyOnStatusChange: null,
    },
  ];

  for (const user of demoUsers) {
    storage.users.set(user.id, user);
  }
  storage.currentIds.user = 4;

  // ── Hosts (collection locations) ───────────────────────
  const demoHosts = [
    { id: 1, name: 'Alpharetta Community Center', address: '175 Roswell St, Alpharetta, GA 30009', email: 'info@alpharettacc.example.com', phone: '(770) 555-0101', status: 'active', notes: 'Weekly Tuesday collections', latitude: '34.0754', longitude: '-84.2941', geocodedAt: new Date(), createdAt: new Date('2024-01-01'), updatedAt: new Date() },
    { id: 2, name: 'Roswell First United Methodist', address: '814 Mimosa Blvd, Roswell, GA 30075', email: 'outreach@rfumc.example.com', phone: '(770) 555-0102', status: 'active', notes: 'Wednesday morning collections', latitude: '34.0232', longitude: '-84.3616', geocodedAt: new Date(), createdAt: new Date('2024-01-01'), updatedAt: new Date() },
    { id: 3, name: 'Johns Creek High School', address: '5575 State Bridge Rd, Johns Creek, GA 30022', email: 'volunteer@jchs.example.com', phone: '(770) 555-0103', status: 'active', notes: 'Student-led Friday collections', latitude: '34.0290', longitude: '-84.1986', geocodedAt: new Date(), createdAt: new Date('2024-02-15'), updatedAt: new Date() },
    { id: 4, name: 'Milton Presbyterian Church', address: '16000 Old Freemanville Rd, Milton, GA 30004', email: null, phone: '(770) 555-0104', status: 'active', notes: null, latitude: '34.1346', longitude: '-84.3131', geocodedAt: new Date(), createdAt: new Date('2024-03-01'), updatedAt: new Date() },
    { id: 5, name: 'Cumming City Park Pavilion', address: '730 Tribble Gap Rd, Cumming, GA 30040', email: null, phone: '(770) 555-0105', status: 'active', notes: 'Monthly Saturday events', latitude: '34.2073', longitude: '-84.1402', geocodedAt: new Date(), createdAt: new Date('2024-04-01'), updatedAt: new Date() },
    { id: 6, name: 'Dunwoody Community Center', address: '1551 Dunwoody Village Pkwy, Dunwoody, GA 30338', email: 'events@dunwoodycc.example.com', phone: '(770) 555-0106', status: 'inactive', notes: 'On hiatus — resuming Fall 2026', latitude: '33.9462', longitude: '-84.3346', geocodedAt: new Date(), createdAt: new Date('2024-01-01'), updatedAt: new Date() },
  ];

  for (const host of demoHosts) {
    storage.hosts.set(host.id, host);
  }
  storage.currentIds.host = 7;

  // ── Host Contacts ──────────────────────────────────────
  const demoContacts = [
    { id: 1, hostId: 1, name: 'Linda Thompson', role: 'Lead', phone: '(770) 555-1001', email: 'linda.t@example.com', address: null, isPrimary: true, notes: null, hostLocation: 'Alpharetta Community Center', driverAgreementSigned: true, weeklyActive: true, lastScraped: null, latitude: null, longitude: null, geocodedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, hostId: 2, name: 'Pastor David Kim', role: 'host', phone: '(770) 555-1002', email: 'david.k@example.com', address: null, isPrimary: true, notes: null, hostLocation: 'Roswell First United Methodist', driverAgreementSigned: false, weeklyActive: true, lastScraped: null, latitude: null, longitude: null, geocodedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 3, hostId: 3, name: 'Ms. Chen', role: 'head of school', phone: '(770) 555-1003', email: 'chen@jchs.example.com', address: null, isPrimary: true, notes: 'Coordinate through student council', hostLocation: 'Johns Creek High School', driverAgreementSigned: false, weeklyActive: false, lastScraped: null, latitude: null, longitude: null, geocodedAt: null, createdAt: new Date(), updatedAt: new Date() },
  ];

  for (const contact of demoContacts) {
    storage.hostContacts.set(contact.id, contact);
  }
  storage.currentIds.hostContact = 4;

  // ── Sandwich Collections (recent weeks) ────────────────
  const now = new Date();
  const collections = [];
  let collectionId = 1;

  // Generate 8 weeks of sample collections
  for (let weeksAgo = 0; weeksAgo < 8; weeksAgo++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (weeksAgo * 7));
    const dateStr = date.toISOString().split('T')[0];

    // Alpharetta — consistent high volume
    collections.push({
      id: collectionId++,
      collectionDate: dateStr,
      hostName: 'Alpharetta Community Center',
      individualSandwiches: 45 + Math.floor(Math.random() * 30),
      individualDeli: null, individualTurkey: null, individualHam: null, individualPbj: null, individualGeneric: null,
      group1Name: null, group1Count: null, group2Name: null, group2Count: null,
      groupCollections: [
        { name: 'Youth Group', count: 60 + Math.floor(Math.random() * 20) },
        { name: 'Women\'s Ministry', count: 30 + Math.floor(Math.random() * 15) },
      ],
      createdBy: '1', createdByName: 'Demo Admin',
      submittedAt: date, submissionMethod: 'standard',
      deletedAt: null, deletedBy: null, eventRequestId: null,
    });

    // Roswell — medium volume
    collections.push({
      id: collectionId++,
      collectionDate: dateStr,
      hostName: 'Roswell First United Methodist',
      individualSandwiches: 25 + Math.floor(Math.random() * 20),
      individualDeli: null, individualTurkey: null, individualHam: null, individualPbj: null, individualGeneric: null,
      group1Name: null, group1Count: null, group2Name: null, group2Count: null,
      groupCollections: [
        { name: 'Sunday School', count: 40 + Math.floor(Math.random() * 10) },
      ],
      createdBy: '2', createdByName: 'Sarah Martinez',
      submittedAt: date, submissionMethod: 'standard',
      deletedAt: null, deletedBy: null, eventRequestId: null,
    });

    // Johns Creek — every other week
    if (weeksAgo % 2 === 0) {
      collections.push({
        id: collectionId++,
        collectionDate: dateStr,
        hostName: 'Johns Creek High School',
        individualSandwiches: 15 + Math.floor(Math.random() * 10),
        individualDeli: null, individualTurkey: null, individualHam: null, individualPbj: null, individualGeneric: null,
        group1Name: null, group1Count: null, group2Name: null, group2Count: null,
        groupCollections: [
          { name: 'Student Council', count: 80 + Math.floor(Math.random() * 40) },
        ],
        createdBy: '3', createdByName: 'Mike Johnson',
        submittedAt: date, submissionMethod: 'walkthrough',
        deletedAt: null, deletedBy: null, eventRequestId: null,
      });
    }
  }

  for (const c of collections) {
    storage.sandwichCollections.set(c.id, c);
  }
  storage.currentIds.sandwichCollection = collectionId;

  // ── Recipients ─────────────────────────────────────────
  const demoRecipients = [
    { id: 1, name: 'North Fulton Community Charities', address: '11270 Elkins Rd, Roswell, GA 30076', email: 'intake@nfcc.example.com', phone: '(770) 555-2001', contactName: 'Angela Davis', notes: 'Mon/Wed/Fri drop-off 9am-3pm', status: 'active', latitude: '34.0412', longitude: '-84.3285', geocodedAt: new Date(), assignedHostId: null, createdAt: new Date('2024-01-01'), updatedAt: new Date(), deletedAt: null, deletedBy: null },
    { id: 2, name: 'MUST Ministries', address: '1280 Field Pkwy, Marietta, GA 30066', email: null, phone: '(770) 555-2002', contactName: 'Tom Richards', notes: 'Large capacity — can receive 500+ per week', status: 'active', latitude: '34.0234', longitude: '-84.5553', geocodedAt: new Date(), assignedHostId: null, createdAt: new Date('2024-01-15'), updatedAt: new Date(), deletedAt: null, deletedBy: null },
    { id: 3, name: 'Salvation Army Roswell', address: '180 Dobbs Dr, Roswell, GA 30075', email: null, phone: '(770) 555-2003', contactName: null, notes: null, status: 'active', latitude: '34.0396', longitude: '-84.3467', geocodedAt: new Date(), assignedHostId: null, createdAt: new Date('2024-02-01'), updatedAt: new Date(), deletedAt: null, deletedBy: null },
  ];

  for (const r of demoRecipients) {
    storage.recipients.set(r.id, r);
  }
  storage.currentIds.recipient = 4;

  // ── Organizations ──────────────────────────────────────
  const demoOrgs = [
    { id: 1, name: 'Tech Corp Atlanta', category: 'large_corp', email: 'csr@techcorp.example.com', phone: '(404) 555-3001', address: '3500 Lenox Rd NE, Atlanta, GA 30326', contactName: 'Jennifer Walsh', notes: null, website: null, latitude: null, longitude: null, geocodedAt: null, createdAt: new Date('2024-06-01'), updatedAt: new Date(), deletedAt: null },
    { id: 2, name: 'Peachtree Road United Methodist Church', category: 'church_faith', email: 'missions@prumc.example.com', phone: '(404) 555-3002', address: '3180 Peachtree Rd NE, Atlanta, GA 30305', contactName: 'Rev. James Miller', notes: null, website: null, latitude: null, longitude: null, geocodedAt: null, createdAt: new Date('2024-07-15'), updatedAt: new Date(), deletedAt: null },
    { id: 3, name: 'Fulton County Schools', category: 'school', email: null, phone: '(404) 555-3003', address: '6201 Powers Ferry Rd NW, Atlanta, GA 30339', contactName: 'Community Liaison', notes: 'Multiple school sites', website: null, latitude: null, longitude: null, geocodedAt: null, createdAt: new Date('2024-09-01'), updatedAt: new Date(), deletedAt: null },
  ];

  for (const o of demoOrgs) {
    storage.organizations.set(o.id, o);
  }
  storage.currentIds.organization = 4;

  // ── Event Requests ─────────────────────────────────────
  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 14);
  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 30);
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);

  const demoEvents: any[] = [
    {
      id: 1,
      firstName: 'Jennifer', lastName: 'Walsh', email: 'jennifer.w@techcorp.example.com', phone: '(404) 555-4001',
      backupContactFirstName: null, backupContactLastName: null, backupContactEmail: null, backupContactPhone: null, backupContactRole: null,
      organizationName: 'Tech Corp Atlanta', department: 'Corporate Social Responsibility', organizationCategory: 'large_corp', schoolClassification: null,
      partnerOrganizations: null, autoCategories: null, categorizedAt: null, categorizedBy: null,
      desiredEventDate: futureDate1, backupDates: null, dateFlexible: true,
      scheduledEventDate: futureDate1, isConfirmed: true,
      addedToOfficialSheet: false,
      estimatedParticipants: 50, estimatedSandwiches: 200,
      eventType: 'corporate_team_building',
      status: 'scheduled',
      notes: 'Annual team building event — 50 employees expected. Need supplies for 200 sandwiches.',
      assignedTo: '2', assignedToName: 'Sarah Martinez',
      createdAt: new Date('2025-12-01'), updatedAt: new Date(),
      deletedAt: null, deletedBy: null,
    },
    {
      id: 2,
      firstName: 'Rev. James', lastName: 'Miller', email: 'missions@prumc.example.com', phone: '(404) 555-4002',
      backupContactFirstName: null, backupContactLastName: null, backupContactEmail: null, backupContactPhone: null, backupContactRole: null,
      organizationName: 'Peachtree Road UMC', department: 'Missions', organizationCategory: 'church_faith', schoolClassification: null,
      partnerOrganizations: null, autoCategories: null, categorizedAt: null, categorizedBy: null,
      desiredEventDate: futureDate2, backupDates: null, dateFlexible: false,
      scheduledEventDate: null, isConfirmed: false,
      addedToOfficialSheet: false,
      estimatedParticipants: 30, estimatedSandwiches: 120,
      eventType: 'community_outreach',
      status: 'new',
      notes: 'Monthly mission day — would like to make this recurring.',
      assignedTo: null, assignedToName: null,
      createdAt: new Date('2026-01-15'), updatedAt: new Date(),
      deletedAt: null, deletedBy: null,
    },
    {
      id: 3,
      firstName: 'Ms. Chen', lastName: '', email: 'chen@jchs.example.com', phone: '(770) 555-4003',
      backupContactFirstName: null, backupContactLastName: null, backupContactEmail: null, backupContactPhone: null, backupContactRole: null,
      organizationName: 'Johns Creek High School', department: 'Student Council', organizationCategory: 'school', schoolClassification: 'public',
      partnerOrganizations: null, autoCategories: null, categorizedAt: null, categorizedBy: null,
      desiredEventDate: pastDate, backupDates: null, dateFlexible: true,
      scheduledEventDate: pastDate, isConfirmed: true,
      addedToOfficialSheet: true,
      estimatedParticipants: 100, estimatedSandwiches: 400,
      eventType: 'school_event',
      status: 'completed',
      notes: 'Spring service day — huge success! Students made 420 sandwiches.',
      assignedTo: '2', assignedToName: 'Sarah Martinez',
      createdAt: new Date('2026-01-01'), updatedAt: new Date(),
      deletedAt: null, deletedBy: null,
    },
  ];

  for (const e of demoEvents) {
    storage.eventRequests.set(e.id, e);
  }
  storage.currentIds.eventRequest = 4;

  // ── Drivers ────────────────────────────────────────────
  const demoDrivers = [
    { id: 1, userId: '3', name: 'Mike Johnson', phone: '(770) 555-5001', email: 'mike.volunteer@example.com', vehicleType: 'SUV', isActive: true, notes: 'Available weekday mornings', address: '123 Oak St, Alpharetta, GA 30009', latitude: '34.0700', longitude: '-84.2900', geocodedAt: new Date(), createdAt: new Date('2024-04-01'), updatedAt: new Date(), deletedAt: null },
    { id: 2, userId: null, name: 'Rachel Green', phone: '(770) 555-5002', email: 'rachel.g@example.com', vehicleType: 'Minivan', isActive: true, notes: null, address: '456 Elm Ave, Roswell, GA 30075', latitude: '34.0250', longitude: '-84.3600', geocodedAt: new Date(), createdAt: new Date('2024-05-15'), updatedAt: new Date(), deletedAt: null },
  ];

  for (const d of demoDrivers) {
    storage.drivers.set(d.id, d);
  }
  storage.currentIds.driver = 3;

  // ── Projects ───────────────────────────────────────────
  const demoProjects = [
    { id: 1, name: 'Spring 2026 Outreach Campaign', description: 'Expand collections to 3 new locations in Forsyth County', status: 'active', priority: 'high', dueDate: '2026-05-01', createdBy: '1', createdByName: 'Demo Admin', assigneeIds: ['1', '2'], assigneeNames: ['Demo Admin', 'Sarah Martinez'], category: 'outreach', completionPercentage: 35, archivedAt: null, archivedBy: null, archivedByName: null, createdAt: new Date('2026-01-10'), updatedAt: new Date() },
    { id: 2, name: 'Volunteer Appreciation Event', description: 'Plan annual volunteer appreciation dinner for June', status: 'active', priority: 'medium', dueDate: '2026-06-15', createdBy: '2', createdByName: 'Sarah Martinez', assigneeIds: ['2'], assigneeNames: ['Sarah Martinez'], category: 'events', completionPercentage: 10, archivedAt: null, archivedBy: null, archivedByName: null, createdAt: new Date('2026-02-01'), updatedAt: new Date() },
  ];

  for (const p of demoProjects) {
    storage.projects.set(p.id, p);
  }
  storage.currentIds.project = 3;

  // ── Messages ───────────────────────────────────────────
  const demoMessages = [
    { id: 1, content: 'Great turnout at Alpharetta today! 135 sandwiches collected.', senderId: '3', senderName: 'Mike Johnson', recipientId: null, committee: 'general', parentId: null, replyCount: 1, readBy: ['1', '2'], createdAt: new Date(Date.now() - 86400000), updatedAt: new Date(Date.now() - 86400000), deletedAt: null },
    { id: 2, content: 'Amazing work everyone! Keep it up! 🥪', senderId: '1', senderName: 'Demo Admin', recipientId: null, committee: 'general', parentId: 1, replyCount: 0, readBy: ['3'], createdAt: new Date(Date.now() - 82800000), updatedAt: new Date(Date.now() - 82800000), deletedAt: null },
    { id: 3, content: 'Reminder: The Tech Corp event is in 2 weeks. I\'ll need 2 drivers for delivery.', senderId: '2', senderName: 'Sarah Martinez', recipientId: null, committee: 'general', parentId: null, replyCount: 0, readBy: ['1'], createdAt: new Date(Date.now() - 3600000), updatedAt: new Date(Date.now() - 3600000), deletedAt: null },
  ];

  for (const m of demoMessages) {
    storage.messages.set(m.id, m);
  }
  storage.currentIds.message = 4;

  console.log('✅ Demo seed data loaded: ' +
    `${demoUsers.length} users, ${demoHosts.length} hosts, ${collections.length} collections, ` +
    `${demoEvents.length} events, ${demoRecipients.length} recipients, ${demoDrivers.length} drivers`);
}
