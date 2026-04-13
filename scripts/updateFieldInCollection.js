import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBc-YiFWYqxWxn1p-RmT42Si2oI391J3ZI",
  authDomain: "golfleaderboard-8e6e7.firebaseapp.com",
  databaseURL: "https://golfleaderboard-8e6e7-default-rtdb.firebaseio.com",
  projectId: "golfleaderboard-8e6e7",
  storageBucket: "golfleaderboard-8e6e7.firebasestorage.app",
  messagingSenderId: "615429660316",
  appId: "1:615429660316:web:553307aaa6de2faf021759",
  measurementId: "G-JE4QKZ7P01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Parse value from string to appropriate type
 */
function parseValue(value) {
  // Check for boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Check for null
  if (value === 'null') return null;
  
  // Check for number
  if (!isNaN(value) && value.trim() !== '') {
    return Number(value);
  }
  
  // Try to parse as JSON (for objects and arrays)
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch (e) {
      // If JSON parse fails, return as string
      return value;
    }
  }
  
  // Return as string
  return value;
}

/**
 * Update a field value for all documents in a collection
 * @param {string} collectionName - Name of the collection
 * @param {string} fieldName - Name of the field to update
 * @param {any} newValue - New value for the field
 */
async function updateFieldInCollection(collectionName, fieldName, newValue) {
  try {
    console.log(`\n📋 Updating field "${fieldName}" in all documents in "${collectionName}"`);
    console.log(`New value: ${JSON.stringify(newValue)}\n`);

    // Get all documents from collection
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);

    if (snapshot.empty) {
      console.log(`⚠️  No documents found in "${collectionName}"`);
      return;
    }

    console.log(`✓ Found ${snapshot.size} document(s) to update\n`);

    // Firestore batch limit is 500 operations
    const batchSize = 500;
    let processedCount = 0;
    let currentBatch = writeBatch(db);
    let batchOperations = 0;

    // Process each document
    for (const docSnapshot of snapshot.docs) {
      const docId = docSnapshot.id;
      const docData = docSnapshot.data();
      const docRef = doc(db, collectionName, docId);
      
      // Check if field exists in document (optional - will update or add if doesn't exist)
      const oldValue = docData[fieldName];
      
      // Update document with new field value
      currentBatch.update(docRef, {
        [fieldName]: newValue
      });
      batchOperations++;

      // Log first few updates for verification
      if (processedCount + batchOperations <= 3) {
        console.log(`  Doc ID: ${docId}`);
        console.log(`    Old value: ${JSON.stringify(oldValue)}`);
        console.log(`    New value: ${JSON.stringify(newValue)}\n`);
      }

      // Commit batch when reaching limit
      if (batchOperations >= batchSize) {
        await currentBatch.commit();
        processedCount += batchOperations;
        console.log(`✓ Updated ${processedCount} document(s)...`);
        
        // Start new batch
        currentBatch = writeBatch(db);
        batchOperations = 0;
      }
    }

    // Commit remaining documents
    if (batchOperations > 0) {
      await currentBatch.commit();
      processedCount += batchOperations;
      console.log(`✓ Updated ${processedCount} document(s)`);
    }

    console.log(`\n✅ Field update completed successfully!`);
    console.log(`   Collection: ${collectionName}`);
    console.log(`   Field: ${fieldName}`);
    console.log(`   New value: ${JSON.stringify(newValue)}`);
    console.log(`   Documents updated: ${processedCount}`);

  } catch (error) {
    console.error('❌ Error during field update:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log(`
Usage: node scripts/updateFieldInCollection.js <collection> <field-name> <new-value>

Arguments:
  collection    Name of the collection to update
  field-name    Name of the field to update
  new-value     New value for the field (can be string, number, boolean, JSON object/array)

Value Types:
  String:   "hello"  or  hello
  Number:   42  or  3.14
  Boolean:  true  or  false
  Null:     null
  Object:   '{"key":"value"}'
  Array:    '[1,2,3]'

Examples:
  node scripts/updateFieldInCollection.js trips status completed
  node scripts/updateFieldInCollection.js users isActive false
  node scripts/updateFieldInCollection.js products stock 0
  node scripts/updateFieldInCollection.js rounds roundType fullRound
  node scripts/updateFieldInCollection.js settings theme '{"mode":"dark"}'
  `);
  process.exit(1);
}

const collectionName = args[0];
const fieldName = args[1];
const newValueRaw = args[2];
const newValue = parseValue(newValueRaw);

// Confirm with user
console.log(`\n⚠️  WARNING: You are about to update the field "${fieldName}" in ALL documents in "${collectionName}"!`);
console.log(`   New value: ${JSON.stringify(newValue)} (${typeof newValue})`);
console.log(`\nThis will OVERWRITE existing values!`);
console.log(`\nStarting in 5 seconds... (Press Ctrl+C to cancel)\n`);

// Wait 5 seconds before executing
await new Promise(resolve => setTimeout(resolve, 5000));

// Run the update
updateFieldInCollection(collectionName, fieldName, newValue)
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
