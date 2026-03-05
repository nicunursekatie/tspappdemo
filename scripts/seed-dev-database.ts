/**
 * Development Database Seeding Script
 *
 * This script populates the development database with realistic sample data
 * for testing and development purposes.
 *
 * Usage:
 *   npm run db:seed
 *
 * To reset and reseed:
 *   npm run db:reset
 */

import { db } from '../server/db.js';
import * as schema from '../shared/schema.js';
import bcrypt from 'bcrypt';

/**
 * Generate sample users with different roles
 */
async function seedUsers() {
  console.log('🌱 Seeding users...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = [
    {
      id: 'admin-user',
      email: 'admin@sandwich.dev',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Admin',
      role: 'admin',
      isActive: true,
      phoneNumber: '555-0100',
      preferredEmail: 'admin@sandwich.dev',
    },
    {
      id: 'jane-coordinator',
      email: 'coordinator@sandwich.dev',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Coordinator',
      displayName: 'Jane C',
      role: 'admin_coordinator',
      isActive: true,
      phoneNumber: '555-0101',
      preferredEmail: 'coordinator@sandwich.dev',
    },
    {
      id: 'john-volunteer',
      email: 'volunteer1@sandwich.dev',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Volunteer',
      displayName: 'John V',
      role: 'volunteer',
      isActive: true,
      phoneNumber: '555-0102',
      preferredEmail: 'volunteer1@sandwich.dev',
    },
    {
      id: 'sarah-helper',
      email: 'volunteer2@sandwich.dev',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Helper',
      displayName: 'Sarah H',
      role: 'volunteer',
      isActive: true,
      phoneNumber: '555-0103',
      preferredEmail: 'volunteer2@sandwich.dev',
    },
    {
      id: 'mike-driver',
      email: 'driver@sandwich.dev',
      password: hashedPassword,
      firstName: 'Mike',
      lastName: 'Driver',
      displayName: 'Mike D',
      role: 'volunteer',
      isActive: true,
      phoneNumber: '555-0104',
      preferredEmail: 'driver@sandwich.dev',
    },
  ];

  await db.insert(schema.users).values(users).onConflictDoNothing();
  console.log(`✅ Created ${users.length} users`);
}

/**
 * Generate sample projects
 */
async function seedProjects() {
  console.log('🌱 Seeding projects...');

  const projects = [
    {
      title: 'Thanksgiving Meal Drive 2025',
      description: 'Annual Thanksgiving meal distribution to families in need',
      status: 'in-progress',
      priority: 'high',
      category: 'events',
      startDate: '2025-11-01',
      dueDate: '2025-11-28',
      createdBy: 'admin-user',
      createdByName: 'Admin User',
      progressPercentage: 25,
    },
    {
      title: 'Winter Coat Collection',
      description: 'Collecting and distributing winter coats to homeless shelters',
      status: 'waiting',
      priority: 'medium',
      category: 'outreach',
      startDate: '2025-11-15',
      dueDate: '2025-12-20',
      createdBy: 'jane-coordinator',
      createdByName: 'Jane Coordinator',
      progressPercentage: 0,
    },
    {
      title: 'Weekly Sandwich Distribution - Route A',
      description: 'Regular sandwich distribution for downtown area',
      status: 'in-progress',
      priority: 'high',
      category: 'events',
      startDate: '2025-10-01',
      dueDate: '2025-12-31',
      createdBy: 'admin-user',
      createdByName: 'Admin User',
      progressPercentage: 60,
    },
  ];

  await db.insert(schema.projects).values(projects).onConflictDoNothing();
  console.log(`✅ Created ${projects.length} projects`);
}

/**
 * Generate sample hosts
 */
async function seedHosts() {
  console.log('🌱 Seeding hosts...');

  const hosts = [
    {
      name: 'Community Center North',
      address: '123 Main St, Cityville',
      email: 'contact@ccnorth.org',
      phone: '555-0300',
      latitude: '40.7128',
      longitude: '-74.0060',
      status: 'active',
    },
    {
      name: 'Shelter House South',
      address: '456 Oak Ave, Cityville',
      email: 'info@sheltersouth.org',
      phone: '555-0301',
      latitude: '40.7589',
      longitude: '-73.9851',
      status: 'active',
    },
    {
      name: 'Faith Community Church',
      address: '789 Elm St, Cityville',
      email: 'office@faithcommunity.org',
      phone: '555-0302',
      latitude: '40.7614',
      longitude: '-73.9776',
      status: 'active',
    },
  ];

  const insertedHosts = await db.insert(schema.hosts).values(hosts).returning();
  console.log(`✅ Created ${insertedHosts.length} hosts`);
  return insertedHosts;
}

/**
 * Generate sample drivers
 */
async function seedDrivers() {
  console.log('🌱 Seeding drivers...');

  const drivers = [
    {
      name: 'Mike Driver',
      email: 'driver@sandwich.dev',
      phone: '555-0104',
      isActive: true,
      vehicleType: 'Honda Civic - Blue',
      availability: 'available',
      notes: 'Available weekdays',
    },
    {
      name: 'Lisa Transport',
      email: 'lisa@sandwich.dev',
      phone: '555-0105',
      isActive: true,
      vehicleType: 'Toyota Camry - Silver',
      availability: 'available',
      notes: 'Prefers weekend deliveries',
    },
  ];

  const insertedDrivers = await db.insert(schema.drivers).values(drivers).returning();
  console.log(`✅ Created ${insertedDrivers.length} drivers`);
  return insertedDrivers;
}

/**
 * Generate sample recipients
 */
async function seedRecipients() {
  console.log('🌱 Seeding recipients...');

  const recipients = [
    {
      name: 'Hope Community Center',
      contactPersonName: 'Maria Garcia',
      contactPersonPhone: '555-0200',
      contactPersonEmail: 'maria.g@hopecenter.org',
      contactPersonRole: 'Program Director',
      phone: '555-0200',
      email: 'info@hopecenter.org',
      address: '100 First St, Apt 2B, Cityville',
      region: 'Downtown',
      weeklyEstimate: 50,
      sandwichType: 'Mixed',
      focusArea: 'families',
      status: 'active',
      collectionDay: 'Monday',
      collectionTime: '10:00 AM',
      feedingDay: 'Monday',
      feedingTime: '12:00 PM',
    },
    {
      name: 'Veterans Support Services',
      contactPersonName: 'Robert Johnson',
      contactPersonPhone: '555-0201',
      contactPersonEmail: 'robert.j@vetssupport.org',
      contactPersonRole: 'Volunteer Coordinator',
      phone: '555-0201',
      email: 'contact@vetssupport.org',
      address: '200 Second Ave, Cityville',
      region: 'North Side',
      weeklyEstimate: 30,
      sandwichType: 'Vegetarian',
      focusArea: 'veterans',
      status: 'active',
      collectionDay: 'Wednesday',
      collectionTime: '2:00 PM',
      feedingDay: 'Thursday',
      feedingTime: '6:00 PM',
    },
    {
      name: 'Youth Outreach Program',
      contactPersonName: 'Chen Wei',
      contactPersonPhone: '555-0202',
      contactPersonEmail: 'chen.w@youthreach.org',
      contactPersonRole: 'Director',
      phone: '555-0202',
      address: '300 Third Blvd, Unit 5, Cityville',
      region: 'East Side',
      weeklyEstimate: 40,
      sandwichType: 'Halal',
      focusArea: 'youth',
      status: 'active',
      collectionDay: 'Friday',
      collectionTime: '11:00 AM',
      feedingDay: 'Friday',
      feedingTime: '5:00 PM',
    },
  ];

  const insertedRecipients = await db.insert(schema.recipients).values(recipients).returning();
  console.log(`✅ Created ${insertedRecipients.length} recipients`);
  return insertedRecipients;
}

/**
 * Generate sample sandwich distributions
 */
async function seedSandwichDistributions(hosts: any[], recipients: any[]) {
  console.log('🌱 Seeding sandwich distributions...');

  const distributions = [
    {
      distributionDate: '2025-10-20',
      weekEnding: '2025-10-26',
      hostId: hosts[0].id,
      hostName: hosts[0].name,
      recipientId: recipients[0].id,
      recipientName: recipients[0].name,
      sandwichCount: 50,
      notes: 'Great turnout, ran out early',
      createdBy: 'admin-user',
      createdByName: 'Admin User',
    },
    {
      distributionDate: '2025-10-21',
      weekEnding: '2025-10-26',
      hostId: hosts[1].id,
      hostName: hosts[1].name,
      recipientId: recipients[1].id,
      recipientName: recipients[1].name,
      sandwichCount: 40,
      notes: 'Smooth distribution',
      createdBy: 'jane-coordinator',
      createdByName: 'Jane Coordinator',
    },
    {
      distributionDate: '2025-10-22',
      weekEnding: '2025-10-26',
      hostId: hosts[2].id,
      hostName: hosts[2].name,
      recipientId: recipients[2].id,
      recipientName: recipients[2].name,
      sandwichCount: 40,
      notes: 'Regular weekly distribution',
      createdBy: 'john-volunteer',
      createdByName: 'John Volunteer',
    },
  ];

  await db.insert(schema.sandwichDistributions).values(distributions).onConflictDoNothing();
  console.log(`✅ Created ${distributions.length} sandwich distributions`);
}

/**
 * Generate sample chat messages
 */
async function seedChatMessages() {
  console.log('🌱 Seeding chat messages...');

  const messages = [
    {
      channel: 'general',
      userId: 'admin-user',
      userName: 'Admin User',
      content: 'Welcome to the Sandwich Project Platform! 🥪',
    },
    {
      channel: 'general',
      userId: 'john-volunteer',
      userName: 'John V',
      content: 'Happy to be here! Looking forward to helping out.',
    },
    {
      channel: 'core-team',
      userId: 'jane-coordinator',
      userName: 'Jane C',
      content: 'Team meeting scheduled for next Tuesday at 2 PM',
    },
    {
      channel: 'driver',
      userId: 'mike-driver',
      userName: 'Mike D',
      content: 'Available for deliveries this weekend',
    },
  ];

  await db.insert(schema.chatMessages).values(messages).onConflictDoNothing();
  console.log(`✅ Created ${messages.length} chat messages`);
}

/**
 * Generate holding zone categories
 */
async function seedHoldingZoneCategories() {
  console.log('🌱 Seeding holding zone categories...');

  const categories = [
    {
      name: 'Group Events',
      color: '#236383', // Primary blue
      createdBy: 'admin-user',
      isActive: true,
    },
    {
      name: 'Hosts',
      color: '#007E8C', // Teal
      createdBy: 'admin-user',
      isActive: true,
    },
    {
      name: 'Weekly Collections',
      color: '#47B3CB', // Light blue
      createdBy: 'admin-user',
      isActive: true,
    },
    {
      name: 'Volunteers',
      color: '#FBAD3F', // Orange/gold
      createdBy: 'admin-user',
      isActive: true,
    },
    {
      name: 'Tech',
      color: '#A31C41', // Red
      createdBy: 'admin-user',
      isActive: true,
    },
    {
      name: 'Fundraising',
      color: '#2E7D32', // Green
      createdBy: 'admin-user',
      isActive: true,
    },
  ];

  await db.insert(schema.holdingZoneCategories).values(categories).onConflictDoNothing();
  console.log(`✅ Created ${categories.length} holding zone categories`);
}

/**
 * Generate sample team board items
 */
async function seedTeamBoardItems() {
  console.log('🌱 Seeding team board items...');

  const items = [
    {
      content: 'Need volunteers for Saturday distribution - Looking for 5 volunteers to help with sandwich prep and distribution',
      type: 'task',
      status: 'open',
      createdBy: 'jane-coordinator',
      createdByName: 'Jane Coordinator',
    },
    {
      content: 'Extra coolers available - We have 3 extra coolers in storage if anyone needs them',
      type: 'note',
      status: 'open',
      createdBy: 'john-volunteer',
      createdByName: 'John Volunteer',
    },
    {
      content: 'Transportation needed for next week - Need a driver for the downtown route next Wednesday',
      type: 'task',
      status: 'open',
      createdBy: 'admin-user',
      createdByName: 'Admin User',
    },
  ];

  await db.insert(schema.teamBoardItems).values(items).onConflictDoNothing();
  console.log(`✅ Created ${items.length} team board items`);
}

/**
 * Generate sample announcements
 */
async function seedAnnouncements() {
  console.log('🌱 Seeding announcements...');

  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const announcements = [
    {
      title: 'Holiday Schedule Updated',
      message: 'Please check the updated holiday distribution schedule in the calendar',
      type: 'alert',
      priority: 'high',
      startDate: now,
      endDate: oneWeekFromNow,
      isActive: true,
    },
    {
      title: 'New Safety Guidelines',
      message: 'Updated COVID-19 safety protocols are now available in the documents section',
      type: 'general',
      priority: 'medium',
      startDate: now,
      endDate: twoWeeksFromNow,
      isActive: true,
    },
  ];

  await db.insert(schema.announcements).values(announcements).onConflictDoNothing();
  console.log(`✅ Created ${announcements.length} announcements`);
}

/**
 * Main seeding function
 */
async function main() {
  try {
    console.log('🚀 Starting database seeding...\n');

    await seedUsers();
    await seedProjects();
    const hosts = await seedHosts();
    await seedDrivers();
    const recipients = await seedRecipients();
    await seedSandwichDistributions(hosts, recipients);
    await seedChatMessages();
    await seedHoldingZoneCategories();
    await seedTeamBoardItems();
    await seedAnnouncements();

    console.log('\n✨ Database seeding completed successfully!');
    console.log('\n📝 Test credentials:');
    console.log('   Admin:       admin@sandwich.dev / password123');
    console.log('   Coordinator: coordinator@sandwich.dev / password123');
    console.log('   Volunteer:   volunteer1@sandwich.dev / password123');
    console.log('   Driver:      driver@sandwich.dev / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

main();
