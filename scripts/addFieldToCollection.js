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
 * Add a field to all documents in a collection
 * @param {string} collectionName - Name of the collection
 * @param {string} fieldName - Name of the field to add
 * @param {any} fieldValue - Value of the field to add
 */
async function addFieldToCollection(collectionName, fieldName, fieldValue) {
  try {
    console.log(`\n📋 Adding field "${fieldName}" to all documents in "${collectionName}"`);
    console.log(`Field value: ${JSON.stringify(fieldValue)}\n`);

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
      const docRef = doc(db, collectionName, docId);
      
      // Update document with new field
      currentBatch.update(docRef, {
        [fieldName]: fieldValue
      });
      batchOperations++;

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

    console.log(`\n✅ Field addition completed successfully!`);
    console.log(`   Collection: ${collectionName}`);
    console.log(`   Field: ${fieldName}`);
    console.log(`   Value: ${JSON.stringify(fieldValue)}`);
    console.log(`   Documents updated: ${processedCount}`);

  } catch (error) {
    console.error('❌ Error during field addition:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log(`
Usage: node scripts/addFieldToCollection.js <collection> <field-name> <field-value>

Arguments:
  collection    Name of the collection to update
  field-name    Name of the field to add
  field-value   Value of the field (can be string, number, boolean, JSON object/array)

Value Types:
  String:   "hello"  or  hello
  Number:   42  or  3.14
  Boolean:  true  or  false
  Null:     null
  Object:   '{"key":"value"}'
  Array:    '[1,2,3]'

Examples:
  node scripts/addFieldToCollection.js trips status active
  node scripts/addFieldToCollection.js users isVerified true
  node scripts/addFieldToCollection.js products price 0
  node scripts/addFieldToCollection.js settings config '{"theme":"dark","lang":"en"}'
  node scripts/addFieldToCollection.js courses tags '["golf","public"]'
  `);
  process.exit(1);
}

const collectionName = args[0];
const fieldName = args[1];
const fieldValueRaw = args[2];
const fieldValue = parseValue(fieldValueRaw);

// Confirm with user
console.log(`\n⚠️  You are about to add the following field to ALL documents in "${collectionName}":`);
console.log(`   Field name: ${fieldName}`);
console.log(`   Field value: ${JSON.stringify(fieldValue)} (${typeof fieldValue})`);
console.log(`\nStarting in 3 seconds... (Press Ctrl+C to cancel)\n`);

// Wait 3 seconds before executing
await new Promise(resolve => setTimeout(resolve, 3000));

// Run the update
addFieldToCollection(collectionName, fieldName, fieldValue)
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
