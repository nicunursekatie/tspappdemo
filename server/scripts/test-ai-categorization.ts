import OpenAI from 'openai';

/**
 * Quick test of AI categorization for edge cases
 * Run with: OPENAI_API_KEY=your_key npx tsx server/scripts/test-ai-categorization.ts
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function categorizeWithAI(organizationName: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an organization categorization expert. Categorize organizations into these categories:
- school (with optional schoolClassification: public, private, or charter)
- church_faith (religious organizations)
- club (service clubs, scouts, youth groups)
- neighborhood (HOAs, community groups)
- large_corp (corporations, large businesses)
- small_medium_corp (small/medium businesses)
- other (doesn't fit above categories)

Also determine if the organization has religious affiliation (isReligious: true/false).

Respond ONLY with valid JSON in this exact format:
{"category": "school", "schoolClassification": "private", "isReligious": true}

Do not include any explanation or additional text.`,
        },
        {
          role: 'user',
          content: `Categorize this organization: "${organizationName}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) return null;

    return JSON.parse(response);
  } catch (error) {
    console.error(`❌ Failed: ${organizationName}`, error);
    return null;
  }
}

async function testAICategorization() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    console.log('\n💡 Set it with: export OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  console.log('🤖 Testing AI Categorization\n');
  console.log('='.repeat(80));

  // Test cases that patterns might miss
  const testOrgs = [
    'Fleetcor', // No corporate indicators
    'Detroit Lions', // Sports team (should NOT be club)
    'Discovery Museum', // Museum (should NOT be large corp)
    'First Wesleyan Church', // Church (should NOT be school)
    'Talent Scouts Inc.', // Company with "Scouts"
    'Random Organization Name', // Unknown
    'Atlanta Neighborhood Charter School', // Charter school in Atlanta
  ];

  for (const orgName of testOrgs) {
    console.log(`\n🔍 "${orgName}"`);
    const result = await categorizeWithAI(orgName);

    if (result) {
      console.log(`   ✅ Category: ${result.category}`);
      if (result.schoolClassification) {
        console.log(`      School Classification: ${result.schoolClassification}`);
      }
      console.log(`      Religious: ${result.isReligious ? 'Yes' : 'No'}`);
    } else {
      console.log(`   ❌ No result`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n✨ Test complete!`);
  console.log(`💰 Approximate cost: $${(testOrgs.length * 0.0001).toFixed(4)}`);
}

testAICategorization();
