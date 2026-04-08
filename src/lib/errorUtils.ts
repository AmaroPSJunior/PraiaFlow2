import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface SystemError {
  id?: string;
  message: string;
  stack?: string;
  userId?: string;
  userEmail?: string;
  role?: string;
  path: string;
  timestamp: any;
  userAgent: string;
  metadata?: Record<string, any>;
}

export const logSystemError = async (error: any, context?: string, metadata?: Record<string, any>) => {
  try {
    const user = auth.currentUser;
    const mockUserStr = localStorage.getItem('mock_user');
    const mockProfileStr = localStorage.getItem('mock_profile');
    
    let userId = user?.uid || '';
    let userEmail = user?.email || '';
    let role = '';

    if (mockUserStr && mockProfileStr) {
      const mockUser = JSON.parse(mockUserStr);
      const mockProfile = JSON.parse(mockProfileStr);
      userId = mockUser.uid;
      userEmail = mockUser.email;
      role = mockProfile.role;
    }

    const errorData: Omit<SystemError, 'id'> = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      userEmail,
      role,
      path: window.location.pathname,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      metadata: {
        ...metadata,
        context,
        url: window.location.href,
        screen: window.screen.width + 'x' + window.screen.height
      }
    };

    console.error(`[SystemError] ${context || 'Error'}:`, error);
    await addDoc(collection(db, 'system_errors'), errorData);
  } catch (err) {
    // Fail silently to avoid infinite loops if logging itself fails
    console.error('Failed to log system error:', err);
  }
};
