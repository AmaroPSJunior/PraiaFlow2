import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { SystemError } from '../types';

const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (obj instanceof Date) return obj;
  
  // Check if it's a Firestore FieldValue or similar special object
  // FieldValues usually don't have a simple 'Object' constructor or have special internal markers
  if (obj.constructor && obj.constructor.name !== 'Object') return obj;

  const sanitized: any = {};
  Object.keys(obj).forEach(key => {
    sanitized[key] = sanitizeForFirestore(obj[key]);
  });
  return sanitized;
};

export const logSystemError = async (error: any, context?: string, metadata?: Record<string, any>) => {
  // Extract message early to check validity
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    try {
      message = JSON.stringify(error);
    } catch (e) {
      message = String(error);
    }
  } else {
    message = String(error || '');
  }
  
  // If no message or just useless strings, it's a ghost error, ignore it
  const cleanMessage = message.trim();
  if (!cleanMessage || cleanMessage === '{}' || cleanMessage === '[]' || cleanMessage === '[object Object]') return;

  // Filter out common user errors and noisy system errors
  const ignoredErrors = [
    'auth/invalid-credential',
    'auth/user-not-found',
    'auth/wrong-password',
    'auth/email-already-in-use',
    'auth/invalid-email',
    'auth/weak-password',
    'auth/popup-closed-by-user',
    'auth/cancelled-by-user',
    'auth/internal-error',
    'identitytoolkit.googleapis.com',
    '[vite] failed to connect to websocket',
    'Script error.',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-error promise rejection captured'
  ];

  if (ignoredErrors.some(ie => cleanMessage.toLowerCase().includes(ie.toLowerCase()))) {
    // Still log to console as warning for debugging, but don't send to Firestore
    if (!cleanMessage.includes('[vite]')) {
      console.warn(`[FilteredError] ${context || 'Error'}:`, cleanMessage);
    }
    return;
  }

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

    const rawErrorData: any = {
      message: message,
      stack: (error instanceof Error && error.stack) ? error.stack : null,
      userId,
      userEmail,
      role,
      path: window.location.pathname,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      status: 'active',
      severity: 'error',
      metadata: {
        ...metadata,
        context,
        url: window.location.href,
        screen: window.screen.width + 'x' + window.screen.height
      }
    };

    const errorData = sanitizeForFirestore(rawErrorData);

    console.error(`[SystemError] ${context || 'Error'}:`, error);
    console.log(`[SystemError] Sending to Firestore:`, errorData);
    
    // Avoid logging the same error multiple times in a short period
    const errorKey = `${errorData.message}-${context}`;
    const lastLogged = lastLoggedErrors.get(errorKey);
    const now = Date.now();
    if (lastLogged && now - lastLogged < 2000) return;
    lastLoggedErrors.set(errorKey, now);

    await addDoc(collection(db, 'system_errors'), errorData);
  } catch (err) {
    // Fail silently to avoid infinite loops if logging itself fails
    console.error('Failed to log system error:', err);
  }
};

const lastLoggedErrors = new Map<string, number>();

export const initErrorMonitoring = () => {
  if (typeof window === 'undefined') return;

  // Global error listeners
  const handleError = (event: ErrorEvent) => {
    const error = event.error || event.message;
    if (error) {
      logSystemError(error, 'Global Window Error');
    }
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    if (event.reason) {
      logSystemError(event.reason, 'Unhandled Promise Rejection');
    }
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  // Intercept console.error
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Call original first
    originalConsoleError.apply(console, args);

    // Don't log our own internal logging errors
    if (args[0] && typeof args[0] === 'string' && args[0].includes('[SystemError]')) return;
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Failed to log system error')) return;

    // Log to Firestore
    const message = args.map(arg => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'object' && arg !== null) {
        try {
          const str = JSON.stringify(arg);
          if (str === '{}') return ''; // Ignore empty objects in console.error
          return str;
        } catch (e) {
          return '[Complex Object]';
        }
      }
      return String(arg);
    }).filter(msg => msg && msg.trim() !== '' && msg !== '{}' && msg !== '[object Object]').join(' ');

    if (message.trim()) {
      logSystemError(message, 'Console Error Interceptor');
    }
  };

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
    console.error = originalConsoleError;
  };
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  // Log to system errors collection
  logSystemError(error, `Firestore ${operationType.toUpperCase()} - ${path}`, errInfo);
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
