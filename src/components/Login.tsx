import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { LogIn, ShieldCheck, User, LogOut, Bell, Code, ChefHat, ArrowLeft, ExternalLink, Phone, CreditCard, MapPin, UserPlus, Loader2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { UserProfile, SystemAccess } from '../types';
import { globalSignOut } from '../lib/authUtils';
import { logSystemError } from '../lib/errorUtils';
import { useLanguage } from '../lib/LanguageContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface LoginProps {
  isAdmin?: boolean;
  isWaiter?: boolean;
  isStaff?: boolean;
  isRoot?: boolean;
  user?: any;
  profile?: UserProfile | null;
  systemAccess?: SystemAccess | null;
}

export default function Login({ isAdmin = false, isWaiter = false, isStaff = false, isRoot = false, user, profile, systemAccess }: LoginProps) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const { t } = useLanguage();

  // Check if in iframe
  React.useEffect(() => {
    setIsInIframe(window.self !== window.top);
    
    // Check for redirect result on mount
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('Redirect login successful:', result.user.email);
        }
      } catch (err: any) {
        console.error('Redirect result error:', err);
      }
    };
    checkRedirect();
  }, []);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user && profile) {
      // Only redirect if profile is complete (handled by App.tsx showing CompleteProfile)
      if (profile.phone && profile.cpf && profile.address) {
        if (isRoot) {
          if (profile.role === 'root') navigate('/root');
        } else if (isAdmin) {
          if (profile.role === 'admin') navigate('/admin');
        } else if (isWaiter) {
          if (profile.role === 'waiter') navigate('/waiter');
        } else if (isStaff) {
          if (profile.role === 'staff') navigate('/staff');
        } else if (profile.role === 'root') {
          navigate('/root');
        } else if (profile.role === 'waiter') {
          navigate('/waiter');
        } else if (profile.role === 'staff') {
          navigate('/staff');
        } else if (profile.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    }
  }, [user, profile, isAdmin, isWaiter, isStaff, isRoot, navigate]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError('');
    
    // Safety timeout for login
    const loginTimeout = setTimeout(() => {
      if (isLoggingIn) {
        setIsLoggingIn(false);
        setError('O login está demorando mais que o esperado. Tente usar o botão "Entrar via Redirecionamento" ou abra o app em uma nova aba.');
      }
    }, 15000);

    try {
      // Store intended role for App.tsx to pick up
      const role = isAdmin ? 'admin' : isWaiter ? 'waiter' : isStaff ? 'staff' : isRoot ? 'root' : 'client';
      sessionStorage.setItem('intendedRole', role);
      
      const provider = new GoogleAuthProvider();
      console.log('Starting Google login...');
      await signInWithPopup(auth, provider);
      clearTimeout(loginTimeout);
      console.log('Login successful');
    } catch (err: any) {
      clearTimeout(loginTimeout);
      console.error('Login error:', err);
      await logSystemError(err, 'Google Login', { isAdmin, isWaiter, isStaff, isRoot });
      if (err.code === 'auth/popup-blocked') {
        setError('O navegador bloqueou o popup de login. Por favor, habilite popups ou use o botão "Entrar via Redirecionamento" abaixo.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError(t('popupCancelled'));
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('A janela de login foi fechada antes da conclusão. Tente o botão "Entrar via Redirecionamento" para maior estabilidade.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase. Adicione ' + window.location.hostname + ' aos domínios autorizados no Console do Firebase (Authentication > Settings > Authorized Domains).');
      } else {
        setError(t('loginError') + ': ' + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email e senha são obrigatórios.');
      return;
    }

    setIsLoggingIn(true);
    setError('');
    try {
      // Store intended role for App.tsx to pick up
      const role = isAdmin ? 'admin' : isWaiter ? 'waiter' : isStaff ? 'staff' : isRoot ? 'root' : 'client';
      sessionStorage.setItem('intendedRole', role);

      await signInWithEmailAndPassword(auth, email, password);
      console.log('Email login successful');
    } catch (err: any) {
      console.error('Email login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email ou senha incorretos.');
      } else {
        setError('Erro ao fazer login: ' + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLoginRedirect = async () => {
    setIsLoggingIn(true);
    setError('');
    try {
      const role = isAdmin ? 'admin' : isWaiter ? 'waiter' : isStaff ? 'staff' : isRoot ? 'root' : 'client';
      sessionStorage.setItem('intendedRole', role);
      
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Redirect login error:', err);
      setError('Erro ao iniciar redirecionamento: ' + err.message);
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await globalSignOut();
  };

  const handleDevLogin = async (role: 'admin' | 'waiter' | 'staff' | 'client' | 'root') => {
    setIsLoggingIn(true);
    setError('');
    try {
      const mockUid = `dev_${role}_${Math.random().toString(36).substr(2, 9)}`;
      const devProfile: UserProfile = {
        uid: mockUid,
        email: `${role}_dev@restaurante.com`,
        role: role,
        displayName: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        phone: '(00) 00000-0000',
        cpf: '000.000.000-00',
        address: 'Endereço de Teste',
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem('mock_user', JSON.stringify({
        uid: mockUid,
        email: devProfile.email,
        isAnonymous: true,
        displayName: devProfile.displayName
      }));
      localStorage.setItem('mock_profile', JSON.stringify(devProfile));
      
      window.location.reload();
    } catch (err: any) {
      console.error('Dev Login error:', err);
      setError('Erro no login de desenvolvimento: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateRoleProfile = async () => {
    if (!user) return;
    setIsLoggingIn(true);
    setError('');
    try {
      const role = isAdmin ? 'admin' : isWaiter ? 'waiter' : isStaff ? 'staff' : isRoot ? 'root' : 'client';
      const profileId = `${user.uid}_${role}`;
      
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        role: role as any,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', profileId), newProfile);
      window.location.reload();
    } catch (err: any) {
      console.error('Error creating role profile:', err);
      setError('Erro ao criar perfil: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isAccessDenied = (isAdmin && user && profile && profile.role !== 'admin') || 
                         (isWaiter && user && profile && profile.role !== 'waiter') ||
                         (isStaff && user && profile && profile.role !== 'staff') ||
                         (isRoot && user && profile && profile.role !== 'root');

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors">
      <div className="absolute top-4 left-4">
        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all active:scale-95"
        >
          <ArrowLeft size={20} />
          <span>{t('back')}</span>
        </button>
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-xl p-8 text-center space-y-6 border border-transparent dark:border-slate-700 overflow-hidden">
        <div className="space-y-2">
          <div className="bg-sky-100 dark:bg-sky-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
            {isRoot ? <Code size={32} /> : isAdmin ? <ShieldCheck size={32} /> : isWaiter ? <Bell size={32} /> : isStaff ? <ChefHat size={32} /> : <User size={32} />}
          </div>
          <h1 className="text-4xl font-black text-sky-600 dark:text-sky-400 tracking-tight italic">Praia<span className="text-slate-900 dark:text-white">Flow</span></h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium text-sm uppercase tracking-widest">
            {isRoot ? 'Painel Root (Dev)' : isAdmin ? t('adminPanel') : isWaiter ? 'Painel do Atendente' : isStaff ? 'Painel da Cozinha' : t('welcome')}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-2xl text-sm font-bold border border-green-100 dark:border-green-900/30">
            {success}
          </div>
        )}

        {user && !profile && !isLoggingIn && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-2xl border border-sky-100 dark:border-sky-900/30">
              <p className="text-sm text-sky-700 dark:text-sky-300 font-medium">
                Você está logado como <strong>{user.email}</strong>, mas ainda não possui um perfil de <strong>{isAdmin ? 'Administrador' : isWaiter ? 'Atendente' : isStaff ? 'Cozinha' : isRoot ? 'Root' : 'Cliente'}</strong>.
              </p>
            </div>
            <button
              onClick={handleCreateRoleProfile}
              className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none active:scale-95 flex items-center justify-center gap-2"
            >
              <UserPlus size={20} /> Criar Perfil de {isAdmin ? 'Admin' : isWaiter ? 'Atendente' : isStaff ? 'Cozinha' : isRoot ? 'Root' : 'Cliente'}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-slate-700"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-800 px-2 text-gray-400 font-bold">Ou</span></div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut size={20} /> Sair e Usar Outra Conta
            </button>
          </div>
        )}

        {isAccessDenied && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                Você está logado como <strong>{user.email}</strong>, mas esta conta possui perfil de <strong>{profile?.role}</strong> e não tem acesso a esta área.
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut size={20} /> {t('tryAnotherAccount')}
            </button>
          </div>
        )}

        {!user && (
          <div className="space-y-6">
            {!showPasswordForm ? (
              <div className="space-y-4">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full bg-sky-600 dark:bg-sky-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-sky-700 dark:hover:bg-sky-600 transition-all shadow-lg shadow-sky-200 dark:shadow-none active:scale-95 disabled:opacity-50"
                >
                  {isLoggingIn ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
                  {isLoggingIn ? t('loading') : 'Entrar com Google'}
                </button>
                
                <button 
                  onClick={handleGoogleLoginRedirect}
                  disabled={isLoggingIn}
                  className="w-full bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-sky-100 dark:border-sky-900/30 hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all active:scale-95 disabled:opacity-50"
                >
                  <ExternalLink size={16} />
                  Entrar via Redirecionamento
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white dark:bg-slate-800 px-4 text-gray-400 font-black tracking-widest">Ou use sua conta</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <LogIn size={20} /> Entrar com Email e Senha
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-2">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-2">Senha</label>
                  <input
                    type="password"
                    required
                    placeholder="******"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white font-medium"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(false)}
                    className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-200 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-slate-600 transition-all active:scale-95"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex-[2] bg-sky-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none active:scale-95 disabled:opacity-50"
                  >
                    {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                    Entrar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
          {isAdmin 
            ? t('restrictedAccess') 
            : t('termsAgreement')}
        </p>

        {/* Development Access Section */}
        {(isAdmin || isWaiter || isStaff || isRoot) && systemAccess && (
          <div className="pt-6 border-t border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-slate-500">
              <Code size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Acesso de Desenvolvimento</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {isRoot && systemAccess.devLogin?.root === true && (
                <button 
                  onClick={() => handleDevLogin('root')}
                  className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/30"
                >
                  Root
                </button>
              )}
              {isAdmin && systemAccess.devLogin?.admin === true && (
                <button 
                  onClick={() => handleDevLogin('admin')}
                  className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-all border border-purple-100 dark:border-purple-900/30"
                >
                  Admin
                </button>
              )}
              {isWaiter && systemAccess.devLogin?.waiter === true && (
                <button 
                  onClick={() => handleDevLogin('waiter')}
                  className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100 dark:border-amber-900/30"
                >
                  Atendente
                </button>
              )}
              {isStaff && systemAccess.devLogin?.staff === true && (
                <button 
                  onClick={() => handleDevLogin('staff')}
                  className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100 dark:border-blue-900/30"
                >
                  Cozinha
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
