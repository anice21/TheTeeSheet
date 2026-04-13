import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc, deleteDoc } from "firebase/firestore";

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
 * Move documents from one collection to another
 * @param {string} sourceCollection - Name of the source collection
 * @param {string} destinationCollection - Name of the destination collection
 * @param {boolean} deleteSource - Whether to delete documents from source after copying (default: false)
 */
async function moveDocuments(sourceCollection, destinationCollection, deleteSource = false) {
  try {
    console.log(`\n📋 Starting migration from "${sourceCollection}" to "${destinationCollection}"`);
    console.log(`Delete source documents: ${deleteSource ? 'YES' : 'NO'}\n`);

    // Get all documents from source collection
    const sourceRef = collection(db, sourceCollection);
    const snapshot = await getDocs(sourceRef);

    if (snapshot.empty) {
      console.log(`⚠️  No documents found in "${sourceCollection}"`);
      return;
    }

    console.log(`✓ Found ${snapshot.size} document(s) to migrate\n`);

    // Firestore batch limit is 500 operations
    const batchSize = 500;
    let processedCount = 0;
    let currentBatch = writeBatch(db);
    let batchOperations = 0;

    const documentsToDelete = [];

    // Process each document
    for (const docSnapshot of snapshot.docs) {
      const docData = docSnapshot.data();
      const docId = docSnapshot.id;

      // Add to destination collection with same ID
      const destinationDocRef = doc(db, destinationCollection, docId);
      currentBatch.set(destinationDocRef, docData);
      batchOperations++;

      if (deleteSource) {
        documentsToDelete.push(docId);
      }

      // Commit batch when reaching limit
      if (batchOperations >= batchSize) {
        await currentBatch.commit();
        processedCount += batchOperations;
        console.log(`✓ Migrated ${processedCount} document(s)...`);
        
        // Start new batch
        currentBatch = writeBatch(db);
        batchOperations = 0;
      }
    }

    // Commit remaining documents
    if (batchOperations > 0) {
      await currentBatch.commit();
      processedCount += batchOperations;
      console.log(`✓ Migrated ${processedCount} document(s)`);
    }

    // Delete from source if requested
    if (deleteSource && documentsToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${documentsToDelete.length} document(s) from source collection...`);
      
      let deletedCount = 0;
      for (const docId of documentsToDelete) {
        const sourceDocRef = doc(db, sourceCollection, docId);
        await deleteDoc(sourceDocRef);
        deletedCount++;
        
        if (deletedCount % 50 === 0) {
          console.log(`✓ Deleted ${deletedCount} document(s)...`);
        }
      }
      console.log(`✓ Deleted all ${deletedCount} document(s) from source`);
    }

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   Documents migrated: ${processedCount}`);
    if (deleteSource) {
      console.log(`   Documents deleted from source: ${documentsToDelete.length}`);
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Usage: node scripts/moveDocuments.js <source-collection> <destination-collection> [--delete-source]

Arguments:
  source-collection       Name of the source collection
  destination-collection  Name of the destination collection
  --delete-source        Optional: Delete documents from source after copying

Examples:
  node scripts/moveDocuments.js oldTrips newTrips
  node scripts/moveDocuments.js oldTrips newTrips --delete-source
  `);
  process.exit(1);
}

const sourceCollection = args[0];
const destinationCollection = args[1];
const deleteSource = args.includes('--delete-source');

// Run the migration
moveDocuments(sourceCollection, destinationCollection, deleteSource)
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
