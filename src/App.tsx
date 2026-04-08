import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemAccess, setSystemAccess] = useState<SystemAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const isProfileIncomplete = profile && (!profile.phone || !profile.cpf || !profile.address);

  const handleProfileComplete = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  useEffect(() => {
    // Fetch system access settings with a listener
    const unsubscribeAccess = onSnapshot(doc(db, 'settings', 'system_access'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemAccess(snapshot.data() as SystemAccess);
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
    });

    // Check for mock user first
    const mockUserStr = localStorage.getItem('mock_user');
    const mockProfileStr = localStorage.getItem('mock_profile');
    
    if (mockUserStr && mockProfileStr) {
      setUser(JSON.parse(mockUserStr));
      setProfile(JSON.parse(mockProfileStr));
      setLoading(false);
      return () => unsubscribeAccess();
    }

    // Safety timeout to ensure loading is set to false
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeoutId);
      try {
        setUser(u);
        
        if (u) {
          // Determine requested role based on path
          const path = window.location.pathname;
          let requestedRole: UserProfile['role'] = 'client';
          if (path.startsWith('/admin')) requestedRole = 'admin';
          else if (path.startsWith('/waiter')) requestedRole = 'waiter';
          else if (path.startsWith('/staff')) requestedRole = 'staff';
          else if (path.startsWith('/root')) requestedRole = 'root';
          
          // Use composite ID for multi-profile support
          const profileId = `${u.uid}_${requestedRole}`;
          const docRef = doc(db, 'users', profileId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Check for legacy profile (without role suffix)
            const legacyRef = doc(db, 'users', u.uid);
            const legacySnap = await getDoc(legacyRef);
            
            if (legacySnap.exists() && legacySnap.data().role === requestedRole) {
              // Use legacy profile if role matches
              setProfile(legacySnap.data() as UserProfile);
            } else if (u.email === 'arcamos.j@gmail.com' && requestedRole === 'admin') {
              // Auto-create admin profile for master email if at /admin
              const adminProfile: UserProfile = { 
                uid: u.uid, 
                email: u.email || '', 
                role: 'admin',
                displayName: u.displayName || 'Admin'
              };
              await setDoc(docRef, adminProfile);
              setProfile(adminProfile);
            } else {
              // No profile for this role yet
              setProfile(null);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error in auth state change:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      unsubscribeAccess();
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
          element={systemAccess?.admin === false ? <Navigate to="/" /> : (user && profile?.role === 'admin' ? <AdminView user={user} profile={profile} /> : <Login isAdmin user={user} profile={profile} systemAccess={systemAccess} />)} 
        />

        {/* Waiter Routes */}
        <Route 
          path="/waiter" 
          element={systemAccess?.waiter === false ? <Navigate to="/" /> : (user && profile?.role === 'waiter' ? <WaiterView user={user} profile={profile} /> : <Login isWaiter user={user} profile={profile} systemAccess={systemAccess} />)} 
        />

        {/* Staff Routes */}
        <Route 
          path="/staff" 
          element={systemAccess?.staff === false ? <Navigate to="/" /> : (user && profile?.role === 'staff' ? <StaffView user={user} profile={profile} /> : <Login isStaff user={user} profile={profile} systemAccess={systemAccess} />)} 
        />

        {/* Root Routes */}
        <Route 
          path="/root" 
          element={systemAccess?.root === false ? <Navigate to="/" /> : (user && profile?.role === 'root' ? <RootView /> : <Login isRoot user={user} profile={profile} systemAccess={systemAccess} />)} 
        />
        <Route path="/login" element={<Login user={user} profile={profile} systemAccess={systemAccess} />} />
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
