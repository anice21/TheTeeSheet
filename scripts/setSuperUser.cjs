/**
 * Grant or revoke the superUser custom claim for a Firebase Auth user.
 *
 * Prerequisites:
 *   npm install firebase-admin
 *   scripts/serviceAccountKey.json
 *
 * Usage:
 *   node scripts/setSuperUser.cjs --uid USER_UID
 *   node scripts/setSuperUser.cjs --email user@example.com
 *   node scripts/setSuperUser.cjs --uid USER_UID --remove
 *
 * The script is safe to rerun. Existing custom claims are preserved.
 */

const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({ credential: admin.cert(serviceAccount) });
} catch (error) {
  console.error('ERROR: Could not load scripts/serviceAccountKey.json');
  process.exit(1);
}

function getArgument(name) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

async function main() {
  const auth = getAuth();
  const uid = getArgument('--uid');
  const email = getArgument('--email');
  const shouldRemove = process.argv.includes('--remove');

  if ((!uid && !email) || (uid && email)) {
    throw new Error('Provide exactly one of --uid USER_UID or --email USER_EMAIL.');
  }

  const user = uid
    ? await auth.getUser(uid)
    : await auth.getUserByEmail(email);
  const currentClaims = user.customClaims || {};
  const nextClaims = { ...currentClaims };

  if (shouldRemove) {
    delete nextClaims.superUser;
  } else {
    nextClaims.superUser = true;
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);

  console.log(`${shouldRemove ? 'Removed' : 'Granted'} superUser claim for ${user.email || user.uid}.`);
  console.log('The user must sign out and back in, or refresh their ID token, before the change appears in the app.');
}

main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
