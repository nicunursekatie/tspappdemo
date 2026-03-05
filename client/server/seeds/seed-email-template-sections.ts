import { db } from '../db';
import { emailTemplateSections } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function seedEmailTemplateSections() {
  console.log('🌱 Seeding email template sections...');

  const sections = [
    {
      templateType: 'follow_up_email',
      sectionKey: 'greeting',
      sectionLabel: 'Email Greeting',
      defaultContent: 'Hi {{firstName}},',
      description: 'The opening greeting at the start of the email',
      placeholderHints: '{{firstName}} - Contact\'s first name'
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'intro',
      sectionLabel: 'Introduction Paragraph',
      defaultContent: 'Thank you for reaching out! We\'re excited to help you plan a sandwich-making event.',
      description: 'The introduction paragraph that follows the greeting',
      placeholderHints: '{{firstName}} - Contact\'s first name, {{organizationName}} - Organization name'
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'call_to_action',
      sectionLabel: 'CTA Heading',
      defaultContent: '📞 Next Step: Share Your Phone Number',
      description: 'The CTA heading/title that appears in the highlighted box (e.g., "Next Step: Share Your Phone Number")',
      placeholderHints: '{{firstName}} - Contact\'s first name, {{organizationName}} - Organization name'
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'cta_subtitle',
      sectionLabel: 'CTA Body Text',
      defaultContent: 'Please reply to this email with your phone number and a few times that work for you this week, and we\'ll give you a call!',
      description: 'The CTA body text with instructions for the recipient',
      placeholderHints: '{{firstName}} - Contact\'s first name, {{organizationName}} - Organization name'
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'cta_subtitle_general',
      sectionLabel: 'CTA Body Text (General)',
      defaultContent: "I'd love to discuss your event and answer any questions you may have.",
      description: 'The CTA body text for general follow-up emails (non-scheduling, no phone request)',
      placeholderHints: '{{firstName}} - Contact\'s first name, {{organizationName}} - Organization name'
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'closing',
      sectionLabel: 'Email Closing',
      defaultContent: 'We look forward to working with you!\n\nWarmly,',
      description: 'The closing paragraph before the signature',
      placeholderHints: null
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'scheduling_info',
      sectionLabel: 'Scheduling Information',
      defaultContent: 'We host group events if you are going to make over 200 sandwiches on days other than our normal Wednesday collections. Flexible on dates? We can suggest high-need times. We appreciate 2+ weeks notice when possible.',
      description: 'Key scheduling information shown in the email',
      placeholderHints: null
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'transportation_info',
      sectionLabel: 'Transportation Information',
      defaultContent: 'You just need refrigeration at your sandwich-making location, our drivers will bring coolers for transportation. Outside our area? We\'ll try to work with you on finding a recipient in your area.',
      description: 'Key transportation information shown in the email',
      placeholderHints: null
    },
    {
      templateType: 'follow_up_email',
      sectionKey: 'food_safety_info',
      sectionLabel: 'Food Safety Information',
      defaultContent: 'Refrigerator required for deli sandwiches. Food-safe gloves & hair restraints must be worn. Indoor preparation only.',
      description: 'Key food safety requirements shown in the email',
      placeholderHints: null
    }
  ];

  for (const section of sections) {
    await db.execute(sql`
      INSERT INTO email_template_sections 
        (template_type, section_key, section_label, default_content, description, placeholder_hints)
      VALUES 
        (${section.templateType}, ${section.sectionKey}, ${section.sectionLabel}, 
         ${section.defaultContent}, ${section.description}, ${section.placeholderHints})
      ON CONFLICT (template_type, section_key) 
      DO UPDATE SET 
        section_label = EXCLUDED.section_label,
        default_content = EXCLUDED.default_content,
        description = EXCLUDED.description,
        placeholder_hints = EXCLUDED.placeholder_hints
    `);
  }

  console.log('✅ Email template sections seeded successfully');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedEmailTemplateSections()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed email template sections:', err);
      process.exit(1);
    });
}
