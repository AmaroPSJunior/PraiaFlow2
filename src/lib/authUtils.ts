import { auth, db } from './firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { logSystemError } from './errorUtils';

export const globalSignOut = async () => {
  const mockUserStr = localStorage.getItem('mock_user');
  const mockUser = mockUserStr ? JSON.parse(mockUserStr) : null;
  const currentUid = auth.currentUser?.uid || mockUser?.uid;

  if (currentUid) {
    try {
      const q = query(collection(db, 'tables'), where('currentUserId', '==', currentUid));
      const snapshot = await getDocs(q);
      
      // Parallelize table updates for speed
      const updatePromises = snapshot.docs.map(docSnap => 
        updateDoc(doc(db, 'tables', docSnap.id), {
          currentUserId: null,
          currentUserName: null,
          currentCart: null,
          lastOrderId: null
        })
      );
      await Promise.all(updatePromises);
    } catch (err) {
      console.error("Error unlinking table on global logout:", err);
      logSystemError(err, 'Sign Out - Table Unlink');
    }
  }

  try {
    // Clear all local storage items related to the app
    localStorage.removeItem('mock_user');
    localStorage.removeItem('mock_profile');
    
    // Remove all cart data
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cart_mesa_') || key.startsWith('firebase:'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    sessionStorage.clear();

    // Sign out
    // We don't await signOut indefinitely to prevent hanging the UI
    await Promise.race([
      auth.signOut(),
      new Promise(resolve => setTimeout(resolve, 2000)) // 2s timeout
    ]);
    
  } catch (err) {
    console.error("Error during global sign out:", err);
    logSystemError(err, 'Sign Out - Final Process');
  }
};
