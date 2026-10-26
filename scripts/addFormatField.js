/**
 * Migration Script: Add format field to existing score documents
 * 
 * This script adds a 'format' field with value 'individual' to all existing
 * score documents that don't already have this field.
 * 
 * Usage:
 *   node scripts/addFormatField.js
 * 
 * Prerequisites:
 *   1. Install firebase-admin: npm install firebase-admin
 *   2. Download your Firebase service account key JSON file
 *   3. Place it in the scripts folder as 'serviceAccountKey.json'
 * 
 * Safety:
 *   - Only updates documents that don't have a format field
 *   - Uses batched writes (500 per batch) for efficiency
 *   - Can be run multiple times safely (idempotent)
 */

const admin = require('firebase-admin');
const path = require('path');

// Try to load service account key
try {
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('ERROR: Could not load serviceAccountKey.json');
  console.error('Please download your Firebase service account key and save it as:');
  console.error('  scripts/serviceAccountKey.json');
  console.error('\nTo get your service account key:');
  console.error('  1. Go to Firebase Console > Project Settings > Service Accounts');
  console.error('  2. Click "Generate New Private Key"');
  console.error('  3. Save the downloaded file as serviceAccountKey.json in the scripts folder');
  process.exit(1);
}

const db = admin.firestore();

/**
 * Main migration function
 */
async function migrateFormatField() {
  console.log('='.repeat(60));
  console.log('Format Field Migration Script');
  console.log('='.repeat(60));
  console.log('');
  console.log('This script will add format: "individual" to all score');
  console.log('documents that do not already have a format field.');
  console.log('');
  
  try {
    // Get all trips
    console.log('Step 1: Fetching all trips...');
    const tripsSnapshot = await db.collection('trips').get();
    console.log(`Found ${tripsSnapshot.size} trip(s)`);
    console.log('');
    
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalScanned = 0;
    
    // Process each trip
    for (const tripDoc of tripsSnapshot.docs) {
      const tripId = tripDoc.id;
      const tripData = tripDoc.data();
      const tripName = tripData.name || tripId;
      
      console.log(`Processing trip: "${tripName}" (${tripId})`);
      
      // Get all scores for this trip
      const scoresSnapshot = await db
        .collection('trips')
        .doc(tripId)
        .collection('scores')
        .get();
      
      totalScanned += scoresSnapshot.size;
      console.log(`  Found ${scoresSnapshot.size} score document(s)`);
      
      if (scoresSnapshot.size === 0) {
        console.log('  No scores to process');
        console.log('');
        continue;
      }
      
      let batch = db.batch();
      let batchCount = 0;
      let updatedInTrip = 0;
      let skippedInTrip = 0;
      
      for (const scoreDoc of scoresSnapshot.docs) {
        const data = scoreDoc.data();
        
        // Only update if format field doesn't exist
        if (!data.format) {
          batch.update(scoreDoc.ref, { 
            format: 'individual'
          });
          batchCount++;
          updatedInTrip++;
          
          // Commit batch every 500 documents (Firestore limit)
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`  Committed batch of ${batchCount} updates...`);
            batch = db.batch();
            batchCount = 0;
          }
        } else {
          skippedInTrip++;
        }
      }
      
      // Commit remaining updates in batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  Committed final batch of ${batchCount} updates`);
      }
      
      totalUpdated += updatedInTrip;
      totalSkipped += skippedInTrip;
      
      console.log(`  Updated: ${updatedInTrip}, Skipped: ${skippedInTrip}`);
      console.log('');
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log('Migration Complete!');
    console.log('='.repeat(60));
    console.log(`Total documents scanned: ${totalScanned}`);
    console.log(`Documents updated:       ${totalUpdated}`);
    console.log(`Documents skipped:       ${totalSkipped} (already had format field)`);
    console.log('');
    
    if (totalUpdated > 0) {
      console.log('✅ Successfully added format field to all eligible documents');
    } else if (totalScanned === 0) {
      console.log('ℹ️  No score documents found in any trip');
    } else {
      console.log('ℹ️  All documents already have format field');
    }
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Migration Failed');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    throw error;
  }
}

/**
 * Dry run mode - shows what would be updated without making changes
 */
async function dryRun() {
  console.log('='.repeat(60));
  console.log('DRY RUN MODE - No changes will be made');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    const tripsSnapshot = await db.collection('trips').get();
    console.log(`Found ${tripsSnapshot.size} trip(s)`);
    console.log('');
    
    let totalNeedUpdate = 0;
    let totalHaveFormat = 0;
    
    for (const tripDoc of tripsSnapshot.docs) {
      const tripId = tripDoc.id;
      const tripData = tripDoc.data();
      const tripName = tripData.name || tripId;
      
      const scoresSnapshot = await db
        .collection('trips')
        .doc(tripId)
        .collection('scores')
        .get();
      
      let needUpdate = 0;
      let haveFormat = 0;
      
      scoresSnapshot.docs.forEach(doc => {
        if (!doc.data().format) {
          needUpdate++;
        } else {
          haveFormat++;
        }
      });
      
      totalNeedUpdate += needUpdate;
      totalHaveFormat += haveFormat;
      
      if (needUpdate > 0 || haveFormat > 0) {
        console.log(`Trip: "${tripName}"`);
        console.log(`  Would update: ${needUpdate}`);
        console.log(`  Already have format: ${haveFormat}`);
        console.log('');
      }
    }
    
    console.log('='.repeat(60));
    console.log('Dry Run Summary');
    console.log('='.repeat(60));
    console.log(`Documents that would be updated: ${totalNeedUpdate}`);
    console.log(`Documents that already have format: ${totalHaveFormat}`);
    console.log('');
    console.log('To perform the actual migration, run:');
    console.log('  node scripts/addFormatField.js --execute');
    
  } catch (error) {
    console.error('Dry run failed:', error);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');
  
  if (isDryRun) {
    console.log('ℹ️  Running in DRY RUN mode');
    console.log('   Use --execute flag to perform actual migration');
    console.log('');
    dryRun()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else {
    console.log('⚠️  Running in EXECUTE mode');
    console.log('   This will modify your database');
    console.log('');
    
    // Add a 3-second delay to allow user to cancel
    console.log('Starting in 3 seconds... (Press Ctrl+C to cancel)');
    setTimeout(() => {
      migrateFormatField()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Error:', error);
          process.exit(1);
        });
    }, 3000);
  }
}

module.exports = { migrateFormatField, dryRun };
