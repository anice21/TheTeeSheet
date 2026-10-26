/**
 * Update per-hole handicap rankings on existing course documents.
 *
 * The script is dry-run by default. Use --execute to write changes.
 *
 * Prerequisites:
 *   npm install firebase-admin
 *   Place scripts/serviceAccountKey.json in this folder.
 *
 * Examples:
 *   node scripts/updateCourseHandicaps.cjs --list
 *   node scripts/updateCourseHandicaps.cjs --course COURSE_ID --handicaps 7,15,3,1,11,5,17,9,13,2,8,16,4,14,6,18,10,12
 *   node scripts/updateCourseHandicaps.cjs --file scripts/courseHandicaps.json
 *   node scripts/updateCourseHandicaps.cjs --file scripts/courseHandicaps.json --execute
 *
 * Mapping file format:
 * {
 *   "courseDocumentId": {
 *     "name": "Example Golf Course",
 *     "handicaps": [7, 15, 3, 1, 11, 5, 17, 9, 13, 2, 8, 16, 4, 14, 6, 18, 10, 12]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

let admin;
try {
  admin = require('firebase-admin');
} catch (error) {
  console.error('ERROR: firebase-admin is not installed.');
  console.error('Run: npm install firebase-admin');
  process.exit(1);
}

try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.cert(serviceAccount)
  });
} catch (error) {
  console.error('ERROR: Could not load scripts/serviceAccountKey.json');
  console.error('Download a Firebase service account key and place it at:');
  console.error('  scripts/serviceAccountKey.json');
  process.exit(1);
}

const db = getFirestore();
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const isList = args.includes('--list');

function getArgument(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function parseHandicaps(value) {
  if (!value) return null;

  const handicaps = value.split(',').map(value => Number(value.trim()));
  if (!isValidHandicaps(handicaps)) {
    throw new Error('Handicaps must contain each integer from 1 through 18 exactly once.');
  }
  return handicaps;
}

function isValidHandicaps(handicaps) {
  if (!Array.isArray(handicaps) || handicaps.length !== 18) return false;

  const normalized = handicaps.map(Number);
  return normalized.every(value => Number.isInteger(value) && value >= 1 && value <= 18)
    && new Set(normalized).size === 18;
}

function readMappingFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  const fileContents = fs.readFileSync(resolvedPath, 'utf8');
  const mapping = JSON.parse(fileContents);

  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new Error('The mapping file must contain an object keyed by course document ID.');
  }

  return Object.entries(mapping).map(([courseId, course]) => {
    const handicaps = Array.isArray(course) ? course : course?.handicaps;
    if (!isValidHandicaps(handicaps)) {
      throw new Error(`Invalid handicap rankings for course ${courseId}.`);
    }
    return { courseId, handicaps: handicaps.map(Number) };
  });
}

async function fetchCourseUpdates() {
  const courseId = getArgument('--course');
  const handicapsArgument = getArgument('--handicaps');
  const filePath = getArgument('--file');

  if (courseId || handicapsArgument) {
    if (!courseId || !handicapsArgument) {
      throw new Error('Use --course and --handicaps together.');
    }
    return [{ courseId, handicaps: parseHandicaps(handicapsArgument) }];
  }

  if (filePath) {
    return readMappingFile(filePath);
  }

  return [];
}

async function listCourses() {
  const snapshot = await db.collection('courses').get();
  console.log(`Found ${snapshot.size} course(s).`);
  console.log('');

  snapshot.docs.forEach(courseDoc => {
    const data = courseDoc.data();
    const status = isValidHandicaps(data.holeHandicaps) ? 'valid' : 'missing/invalid';
    console.log(`${courseDoc.id} | ${data.name || '(unnamed)'} | ${status}`);
  });
}

async function updateCourses(updates) {
  if (updates.length === 0) {
    throw new Error('No updates supplied. Use --file or --course with --handicaps. Use --list to inspect courses.');
  }

  const batch = db.batch();
  let updateCount = 0;

  for (const update of updates) {
    const courseRef = db.collection('courses').doc(update.courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      console.log(`SKIP ${update.courseId}: course document not found`);
      continue;
    }

    const courseData = courseDoc.data();
    const unchanged = JSON.stringify(courseData.holeHandicaps || []) === JSON.stringify(update.handicaps);
    if (unchanged) {
      console.log(`SKIP ${update.courseId}: rankings already match`);
      continue;
    }

    console.log(`${isExecute ? 'UPDATE' : 'WOULD UPDATE'} ${update.courseId} (${courseData.name || 'unnamed course'})`);
    console.log(`  holeHandicaps: [${update.handicaps.join(', ')}]`);

    if (isExecute) {
      batch.update(courseRef, {
        holeHandicaps: update.handicaps,
        holeHandicapsUpdatedAt: FieldValue.serverTimestamp()
      });
    }
    updateCount += 1;
  }

  if (isExecute && updateCount > 0) {
    await batch.commit();
  }

  console.log('');
  console.log(isExecute ? `Updated ${updateCount} course(s).` : `Would update ${updateCount} course(s).`);
  if (!isExecute) {
    console.log('No changes were made. Add --execute to write the updates.');
  }
}

async function main() {
  console.log('Course Hole Handicap Update');
  console.log('============================');

  if (isList) {
    await listCourses();
    return;
  }

  const updates = await fetchCourseUpdates();
  await updateCourses(updates);
}

main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
