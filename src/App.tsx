import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, query, collection, where, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import ClientView from './components/ClientView';
import AdminView from './components/AdminView';
import WaiterView from './components/WaiterView';
import StaffView from './components/StaffView';
import RootView from './components/RootView';
import Login from './components/Login';
import Home from './components/Home';
import CompleteProfile from './components/CompleteProfile';
import ProfileView from './components/ProfileView';
import { ThemeProvider } from './lib/ThemeContext';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';
import { UserProfile, SystemAccess } from './types';
import { logSystemError, handleFirestoreError, OperationType, initErrorMonitoring } from './lib/errorUtils';

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [systemAccess, setSystemAccess] = useState<SystemAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    return initErrorMonitoring();
  }, []);

  const isProfileIncomplete = profile && (!profile.phone || !profile.cpf || !profile.address);

  const handleProfileComplete = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // Fetch system access settings with a listener
    const unsubscribeAccess = onSnapshot(doc(db, 'settings', 'system_access'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SystemAccess;
        setSystemAccess({
          client: data.client ?? true,
          waiter: data.waiter ?? true,
          staff: data.staff ?? true,
          admin: data.admin ?? true,
          root: data.root ?? true,
          devLogin: {
            admin: data.devLogin?.admin ?? true,
            waiter: data.devLogin?.waiter ?? true,
            staff: data.devLogin?.staff ?? true,
            root: data.devLogin?.root ?? true,
          }
        });
      } else {
        setSystemAccess({ 
          client: true, 
          waiter: true, 
          staff: true, 
          admin: true, 
          root: true,
          devLogin: { admin: true, waiter: true, staff: true, root: true }
        });
      }
    }, (error) => {
      console.error("Error listening to system access:", error);
      handleFirestoreError(error, OperationType.GET, 'settings/system_access');
    });

    // Check for mock user first
    const mockUserStr = localStorage.getItem('mock_user');
    const mockProfileStr = localStorage.getItem('mock_profile');
    
    if (mockUserStr && mockProfileStr) {
      setUser(JSON.parse(mockUserStr));
      setProfile(JSON.parse(mockProfileStr));
      setLoading(false);
      return () => {
        unsubscribeAccess();
        if (unsubscribeProfile) unsubscribeProfile();
      };
    }

    // Safety timeout to ensure loading is set to false
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 8000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeoutId);
      console.log("Auth state changed:", u?.email, u?.uid);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(u);
      if (u) {
        setProfileLoading(true);
        
        // Determine requested role based on path OR session storage
        const path = window.location.pathname;
        const intendedRole = sessionStorage.getItem('intendedRole') as UserProfile['role'];
        
        let requestedRole: UserProfile['role'] = 'client';
        if (path.startsWith('/admin')) requestedRole = 'admin';
        else if (path.startsWith('/waiter')) requestedRole = 'waiter';
        else if (path.startsWith('/staff')) requestedRole = 'staff';
        else if (path.startsWith('/root')) requestedRole = 'root';
        else if (intendedRole) requestedRole = intendedRole;
        
        console.log("Requested role:", requestedRole, "Path:", path, "Intended:", intendedRole);

        // Use composite ID for multi-profile support
        const profileId = `${u.uid}_${requestedRole}`;
        
        // Use onSnapshot for real-time profile updates and better reliability
        unsubscribeProfile = onSnapshot(doc(db, 'users', profileId), async (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            console.log("Profile found (composite):", profileData);
            setProfile(profileData);
            setProfileLoading(false);
            setLoading(false);
          } else {
            console.log("Profile not found for composite ID:", profileId, "Checking legacy...");
            
            // Check for legacy profile (without role suffix)
            const legacyRef = doc(db, 'users', u.uid);
            const legacySnap = await getDoc(legacyRef);
            
            if (legacySnap.exists()) {
              const legacyData = legacySnap.data() as UserProfile;
              console.log("Legacy profile found:", legacyData);
              if (legacyData.role === requestedRole) {
                setProfile(legacyData);
              } else {
                setProfile(null);
              }
            } else if (u.email === 'arcamos.j@gmail.com' || u.email === 'arcamos.j@hotmail.com') {
              // Auto-create admin or root profile for master emails
              if (requestedRole === 'admin' || requestedRole === 'root') {
                console.log(`Auto-creating ${requestedRole} profile for master email.`);
                const masterProfile: UserProfile = { 
                  uid: u.uid, 
                  email: u.email || '', 
                  role: requestedRole,
                  displayName: u.displayName || (requestedRole === 'root' ? 'Root' : 'Admin'),
                  createdAt: serverTimestamp()
                };
                await setDoc(doc(db, 'users', profileId), masterProfile);
                // onSnapshot will pick this up
              } else {
                setProfile(null);
              }
            } else {
              setProfile(null);
            }
            setProfileLoading(false);
            setLoading(false);
          }
        }, (err) => {
          console.error("Error listening to profile:", err);
          handleFirestoreError(err, OperationType.GET, `users/${profileId}`);
          setProfileLoading(false);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setProfileLoading(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAccess();
      if (unsubscribeProfile) unsubscribeProfile();
      clearTimeout(timeoutId);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
          <p className="text-sky-600 dark:text-sky-400 font-medium">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {isProfileIncomplete && profile && (
        <CompleteProfile profile={profile} onComplete={handleProfileComplete} />
      )}
      <Routes>
        {/* Home / Choice Screen */}
        <Route path="/" element={<Home user={user} systemAccess={systemAccess} />} />

        {/* Client Routes */}
        <Route path="/mesa/:tableId" element={systemAccess?.client === false ? <Navigate to="/" /> : <ClientView user={user} profile={profile} />} />

        {/* Admin Routes */}
        <Route 
          path="/admin" 
          element={systemAccess?.admin === false ? <Navigate to="/" /> : (user && profile?.role === 'admin' ? <AdminView user={user} profile={profile} /> : <Login isAdmin user={user} profile={profile} profileLoading={profileLoading} systemAccess={systemAccess} />)} 
        />

        {/* Waiter Routes */}
        <Route 
          path="/waiter" 
          element={systemAccess?.waiter === false ? <Navigate to="/" /> : (user && profile?.role === 'waiter' ? <WaiterView user={user} profile={profile} /> : <Login isWaiter user={user} profile={profile} profileLoading={profileLoading} systemAccess={systemAccess} />)} 
        />

        {/* Staff Routes */}
        <Route 
          path="/staff" 
          element={systemAccess?.staff === false ? <Navigate to="/" /> : (user && profile?.role === 'staff' ? <StaffView user={user} profile={profile} /> : <Login isStaff user={user} profile={profile} profileLoading={profileLoading} systemAccess={systemAccess} />)} 
        />

        {/* Root Routes */}
        <Route 
          path="/root" 
          element={(user && profile?.role === 'root' ? <RootView /> : <Login isRoot user={user} profile={profile} profileLoading={profileLoading} systemAccess={systemAccess} />)} 
        />
        <Route path="/login" element={<Login user={user} profile={profile} profileLoading={profileLoading} systemAccess={systemAccess} />} />
        <Route 
          path="/profile" 
          element={user && profile ? <ProfileView profile={profile} onUpdate={handleProfileComplete} /> : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}
