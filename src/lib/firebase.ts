import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export async function logAction(action: 'create' | 'update' | 'delete', entityType: string, entityName: string) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'audit_logs'), {
      action,
      entityType,
      entityName,
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || 'anonymous',
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Error logging action:", err);
  }
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
