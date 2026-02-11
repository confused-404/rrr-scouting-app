// Run the following command in the backend folder
// node --env-file=.env.local src/promoteUser.js

import { auth } from "../src/config/firebase.js";

async function promoteToAdmin(uid) {
  try {
    // 1. Set the claim directly using the UID
    await auth.setCustomUserClaims(uid, { admin: true });
    
    // 2. Fetch the user to verify the change
    const updatedUser = await auth.getUser(uid);
    
    console.log(`Success! Claims for UID ${uid}:`, updatedUser.customClaims);
    
    if (updatedUser.customClaims?.admin) {
      console.log("Verification passed: User is confirmed as admin in Firebase.");
    }
  } catch (error) {
    // This will catch issues like "User not found" or "Network error"
    console.error('Error promoting user:', error);
  }
}

// Usage:
promoteToAdmin('PASTE_USER_ID_HERE');