/**
 * Test the auto-categorization logic with sample organization names
 * Run this with: npx tsx server/scripts/test-categorization.ts
 */

interface CategoryPattern {
  category: string;
  schoolClassification?: string;
  patterns: RegExp[];
}

// Patterns that indicate religious affiliation (independent of category)
const religiousPatterns: RegExp[] = [
  /\bchurch\b/i,
  /\bchapel\b/i,
  /\bsynagogue\b/i,
  /\bmosque\b/i,
  /\btemple\b/i,
  /\bparish\b/i,
  /\bcathedral\b/i,
  /\bministry\b/i,
  /\bfellowship\b/i,
  /\bcongregation\b/i,
  /\breligious\b/i,
  /\bfaith\b/i,
  /\bbible\b/i,
  /\bchristian\b/i,
  /\bcatholic\b/i,
  /\bjewish\b/i,
  /\bislamic\b/i,
  /\bbuddhist\b/i,
  /\bhindu\b/i,
  /\bst\.?\s+[A-Z]/i, // St. as in Saint (followed by capital letter to avoid "1st Street")
  /\bsaint\s+[A-Z]/i, // Saint (followed by capital letter)
  /\bholy\b/i,
  /\bblessed\b/i,
  /\bdivine\b/i,
  /\bgospel\b/i,
];

const categoryPatterns: CategoryPattern[] = [
  // Schools - Private indicators (CHECK FIRST before generic patterns)
  {
    category: 'school',
    schoolClassification: 'private',
    patterns: [
      /\bprivate school\b/i,
      /\bprep school\b/i,
      /\bpreparatory\b/i,
      /\bmontessori\b/i,
      /\bchristian\s+(elementary|middle|high|school)\b/i,
      /\bcatholic\s+(elementary|middle|high|school)\b/i,
      /\bepiscopal\s+(elementary|middle|high|school)\b/i,
      /\blutheran\s+(elementary|middle|high|school)\b/i,
      /\bmethodist\s+(elementary|middle|high|school)\b/i,
      /\bpresbyterian\s+(elementary|middle|high|school)\b/i,
      /\bbaptist\s+(elementary|middle|high|school)\b/i,
      /\bst\.?\s+\w+'?s?\s+(elementary|middle|high|school)\b/i, // St. Mary's Elementary/Middle/High/School
      /\bsaint\s+\w+'?s?\s+(elementary|middle|high|school)\b/i,
      /\bparochial\b/i,
      /\bwesleyan\s+(school|university|college|academy)\b/i, // Wesleyan School/University, not "First Wesleyan Church"
    ],
  },
  // Schools - Charter (CHECK SECOND)
  {
    category: 'school',
    schoolClassification: 'charter',
    patterns: [
      /\bcharter\s+school\b/i,
      /\bcharter\s+(elementary|middle|high)\b/i,
      /\bcharter\b/i,
    ],
  },
  // Schools - Elementary (Public - checked AFTER private/charter)
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\belementary\s+school\b/i,
      /\belem\.?\s+school\b/i,
      /\bgrade school\b/i,
      /\bprimary school\b/i,
      /\belementary\b/i, // More generic, so check last
    ],
  },
  // Schools - Middle (Public)
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\bmiddle school\b/i,
      /\bjunior high\b/i,
      /\bintermediate school\b/i,
    ],
  },
  // Schools - High School (Public)
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\bhigh school\b/i,
      /\bsecondary school\b/i,
    ],
  },
  // Schools - University/College (Public by default, though many are private)
  {
    category: 'school',
    schoolClassification: 'public',
    patterns: [
      /\buniversity\b/i,
      /\bcollege\b/i,
      /\bacademy\b/i,
      /\binstitute\b/i,
    ],
  },
  // Churches and Faith Organizations
  {
    category: 'church_faith',
    patterns: [
      /\bchurch\b/i,
      /\bchapel\b/i,
      /\bsynagogue\b/i,
      /\bmosque\b/i,
      /\btemple\b/i,
      /\bparish\b/i,
      /\bcathedral\b/i,
      /\bministry\b/i,
      /\bfellowship\b/i,
      /\bcongregation\b/i,
      /\breligious\b/i,
      /\bfaith\b/i,
      /\bbible\b/i,
      /\bchristian\b/i,
      /\bcatholic\b/i,
      /\bjewish\b/i,
      /\bislamic\b/i,
      /\bst\.?\s+\w+\s+church\b/i,
      /\bsaint\s+\w+\s+church\b/i,
    ],
  },
  // Neighborhoods and Community Groups
  {
    category: 'neighborhood',
    patterns: [
      /\bneighborhood\b/i,
      /\bcommunity\s+group\b/i,
      /\bcommunity\s+center\b/i,
      /\bcommunity\s+association\b/i,
      /\bhomeowners\b/i,
      /\bhoa\b/i,
      /\bresidents\b/i,
      /\bneighbors\b/i,
      /\bblock\s+club\b/i,
      /\bcivic\s+association\b/i,
    ],
  },
  // Clubs
  {
    category: 'club',
    patterns: [
      /\bclub\b/i,
      /\brotary\b/i, // Rotary Club, Rotary of [City] - usually local chapters
      /\bkiwanis\b/i,
      /\blions\s+club\b/i, // Only "Lions Club", not just "Lions" (sports teams)
      /\bboy\s+scouts?\b/i, // Boy Scout or Boy Scouts
      /\bgirl\s+scouts?\b/i, // Girl Scout or Girl Scouts
      /\bcub\s+scouts?\b/i, // Cub Scouts
      /\beagle\s+scouts?\b/i,
      /\bventure\s+scouts?\b/i,
      /\b4-h\s+club\b/i,
      /\byouth\s+group\b/i,
      /\bsports\s+club\b/i,
      /\bathletic\s+club\b/i,
      /\bsocial\s+club\b/i,
      /\brecreation\s+center\b/i,
    ],
  },
  // Large Corporations
  {
    category: 'large_corp',
    patterns: [
      /\bcorporation\b/i,
      /\bcorp\.?\b/i,
      /\binc\.?\b/i,
      /\bllc\b/i,
      /\bltd\.?\b/i,
      /\benterprise\s+(corporation|corp|inc|llc)\b/i, // Enterprise + corp indicator
      /\benterprise\s+holdings\b/i,
      /\bglobal\b/i,
      /\binternational\b/i,
      /\bgroup\b/i,
      /\bholdings\b/i,
      /\bcompany\b/i,
      /\bindustries\b/i,
      /\bstudios?\b/i,
      /\bbroadcasting\s+(corporation|corp|company|network)\b/i,
      /\bproductions?\b/i,
      /\bpictures\b/i,
      /\bfilms?\b/i,
      /\bwarner\s+bros\.?\b/i, // Warner Bros. (specific company)
      /\bwarner\s+bros\.?\s+discovery\b/i, // Warner Bros. Discovery (specific)
      /\btechnologies\b/i,
      /\bsystems?\b/i,
      /\bnetworks?\b/i,
    ],
  },
  // Small/Medium Corporations
  {
    category: 'small_medium_corp',
    patterns: [
      /\bbusiness\b/i,
      /\bservices\b/i,
      /\bsolutions\b/i,
      /\bconsulting\b/i,
      /\bpartners\b/i,
      /\bassociates\b/i,
    ],
  },
];

function checkReligiousAffiliation(name: string): boolean {
  const nameLower = name.toLowerCase();
  return religiousPatterns.some((pattern) => pattern.test(nameLower));
}

function categorizeOrganization(
  name: string
): {
  category: string;
  schoolClassification?: string;
  isReligious: boolean;
} | null {
  const nameLower = name.toLowerCase();

  // First, check if organization has religious affiliation
  const isReligious = checkReligiousAffiliation(name);

  // Prioritize schools over church_faith category
  // This ensures "St. Mary's School" is categorized as a school, not a church
  for (const pattern of categoryPatterns.filter((p) => p.category === 'school')) {
    for (const regex of pattern.patterns) {
      if (regex.test(nameLower)) {
        return {
          category: pattern.category,
          schoolClassification: pattern.schoolClassification,
          isReligious,
        };
      }
    }
  }

  // Check for church/faith organizations (only if not already categorized as school)
  for (const pattern of categoryPatterns.filter(
    (p) => p.category === 'church_faith'
  )) {
    for (const regex of pattern.patterns) {
      if (regex.test(nameLower)) {
        return {
          category: pattern.category,
          schoolClassification: pattern.schoolClassification,
          isReligious: true, // Churches are always religious
        };
      }
    }
  }

  // Then check other categories
  for (const pattern of categoryPatterns.filter(
    (p) => p.category !== 'school' && p.category !== 'church_faith'
  )) {
    for (const regex of pattern.patterns) {
      if (regex.test(nameLower)) {
        return {
          category: pattern.category,
          schoolClassification: pattern.schoolClassification,
          isReligious,
        };
      }
    }
  }

  return null;
}

// Test cases
const testOrganizations = [
  // Schools - Public
  'Lincoln Elementary School',
  'Roosevelt Middle School',
  'Washington High School',
  'Harvard University',

  // Schools - Private/Religious (should NOT be marked as public)
  'St. Mary\'s School',
  'St. Mary\'s Elementary School',
  'Catholic Middle School',
  'Christian High School',
  'Holy Innocents Episcopal School',
  'Wesleyan',
  'Montessori Academy',

  // Schools - Charter
  'Summit Charter School',
  'Charter Elementary',

  // Churches
  'First Baptist Church',
  'First Wesleyan Church', // Should be church, NOT school
  'St. John\'s Cathedral',
  'Temple Beth Shalom',
  'Islamic Center',
  'Grace Fellowship',

  // Neighborhoods
  'Oak Park Neighborhood Association',
  'Riverside Community Center',
  'Homeowners Association',

  // Clubs
  'Rotary Club',
  'Boy Scouts Troop 123',
  'Boy Scouts',
  'Girl Scouts',
  'Lions Club',
  'Youth Sports Club',

  // Corporations
  'Acme Corporation',
  'Global Industries Inc.',
  'Warner Bros. Discovery',
  'Fleetcor',
  'Smith Consulting Services',
  'Local Business Partners',

  // Edge cases - would be misclassified by overly broad patterns
  'Detroit Lions', // Sports team, NOT a club (would match /\blions\b/i)
  'Talent Scouts Inc.', // Company, NOT a youth club (would match /\bscouts?\b/i)
  'Discovery Museum', // Museum/Educational, NOT a large corp (would match /\bdiscovery\b/i)
  'Social Media Marketing LLC', // Small business, NOT media corp (would match /\bmedia\b/i)
  'Random Organization Name',
  'The Community',
];

console.log('🧪 Testing Auto-Categorization Logic\n');
console.log('='.repeat(80));

let successCount = 0;
let failCount = 0;

for (const orgName of testOrganizations) {
  const result = categorizeOrganization(orgName);

  if (result) {
    console.log(`✅ "${orgName}"`);
    console.log(`   → Category: ${result.category}`);
    if (result.schoolClassification) {
      console.log(`   → School Classification: ${result.schoolClassification}`);
    }
    console.log(`   → Religious: ${result.isReligious ? 'Yes' : 'No'}`);
    successCount++;
  } else {
    console.log(`❌ "${orgName}"`);
    console.log(`   → No category found`);
    failCount++;
  }
  console.log('');
}

console.log('='.repeat(80));
console.log(`\n📊 Results: ${successCount} categorized, ${failCount} not categorized`);
console.log(`   Success rate: ${((successCount / testOrganizations.length) * 100).toFixed(1)}%\n`);
