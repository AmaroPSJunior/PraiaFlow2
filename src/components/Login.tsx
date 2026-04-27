import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { 
  LogIn, 
  ShieldCheck, 
  User, 
  LogOut, 
  Bell, 
  Code, 
  ChefHat, 
  ArrowLeft, 
  ExternalLink, 
  Phone, 
  CreditCard, 
  MapPin, 
  UserPlus, 
  Loader2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
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
  profileLoading?: boolean;
  systemAccess?: SystemAccess | null;
}

export default function Login({ isAdmin = false, isWaiter = false, isStaff = false, isRoot = false, user, profile, profileLoading = false, systemAccess }: LoginProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isInIframe, setIsInIframe] = useState(false);
  const { t } = useLanguage();

  const isClient = !isAdmin && !isWaiter && !isStaff && !isRoot;
  const currentRole = isAdmin ? 'admin' : isWaiter ? 'waiter' : isStaff ? 'staff' : isRoot ? 'root' : 'client';

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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email e senha são obrigatórios.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');
    try {
      sessionStorage.setItem('intendedRole', currentRole);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Email login successful');
    } catch (err: any) {
      const isAuthError = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential';
      
      if (isAuthError) {
        console.warn('Email login failed (user error):', err.code);
      } else {
        console.error('Email login error:', err);
        logSystemError(err, 'Email Login', { email, role: currentRole });
      }

      if (isAuthError) {
        setError('Email ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de rede: Não foi possível conectar aos servidores do Firebase. Verifique sua conexão ou se algum ad-blocker está bloqueando o domínio identitytoolkit.googleapis.com.');
      } else {
        setError('Erro ao fazer login: ' + err.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      setError('Todos os campos são obrigatórios.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');
    try {
      sessionStorage.setItem('intendedRole', currentRole);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update Auth Profile
      await updateProfile(userCredential.user, { displayName });
      
      // Send Verification Email
      await sendEmailVerification(userCredential.user);
      
      // Create Firestore Profile
      const profileId = `${userCredential.user.uid}_${currentRole}`;
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: email,
        role: currentRole as any,
        displayName: displayName,
        createdAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', profileId), newProfile);
      
      setSuccess('Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.');
      setMode('login');
    } catch (err: any) {
      console.error('Registration error:', err);
      logSystemError(err, 'User Registration', { email, role: currentRole, displayName });
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso. Se você já possui uma conta para outro cargo (ex: Cliente), faça login primeiro para adicionar este novo perfil.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de rede: Não foi possível conectar aos servidores do Firebase. Verifique sua conexão ou se algum ad-blocker está bloqueando o domínio identitytoolkit.googleapis.com.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O cadastro via Email/Senha não está ativado no Console do Firebase. Para corrigir: Acesse o Console do Firebase > Authentication > Sign-in method > Ative "E-mail/senha".');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha é muito fraca. Use pelo menos 6 caracteres.');
      } else {
        setError('Erro ao criar conta: ' + err.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Informe seu e-mail para recuperação.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setMode('login');
    } catch (err: any) {
      console.error('Password reset error:', err);
      logSystemError(err, 'Password Reset Request', { email });
      setError('Erro ao enviar e-mail: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsProcessing(true);
    setError('');
    
    // Safety timeout for login
    const loginTimeout = setTimeout(() => {
      if (isProcessing) {
        setIsProcessing(false);
        setError('O login está demorando mais que o esperado. Tente usar o botão "Entrar via Redirecionamento" ou abra o app em uma nova aba.');
      }
    }, 15000);

    try {
      sessionStorage.setItem('intendedRole', currentRole);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      clearTimeout(loginTimeout);
    } catch (err: any) {
      clearTimeout(loginTimeout);
      console.error('Login error:', err);
      await logSystemError(err, 'Google Login', { isAdmin, isWaiter, isStaff, isRoot });
      if (err.code === 'auth/popup-blocked') {
        setError('O navegador bloqueou o popup de login. Por favor, habilite popups.');
      } else {
        setError(t('loginError') + ': ' + err.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLoginRedirect = async () => {
    setIsProcessing(true);
    setError('');
    try {
      sessionStorage.setItem('intendedRole', currentRole);
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Redirect login error:', err);
      logSystemError(err, 'Google Login Redirect', { role: currentRole });
      setError('Erro ao iniciar redirecionamento: ' + err.message);
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    await globalSignOut();
  };

  const handleDevLogin = async (role: 'admin' | 'waiter' | 'staff' | 'client' | 'root') => {
    setIsProcessing(true);
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
      
      navigate('/');
    } catch (err: any) {
      console.error('Dev Login error:', err);
      logSystemError(err, 'Dev Login', { role });
      setError('Erro no login de desenvolvimento: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateRoleProfile = async () => {
    if (!user) return;
    setIsProcessing(true);
    setError('');
    try {
      const profileId = `${user.uid}_${currentRole}`;
      
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        role: currentRole as any,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', profileId), newProfile);
      navigate('/');
    } catch (err: any) {
      console.error('Error creating role profile:', err);
      logSystemError(err, 'Create Role Profile', { userId: user.uid, role: currentRole });
      setError('Erro ao criar perfil: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isAccessDenied = (isAdmin && user && profile && profile.role !== 'admin') || 
                         (isWaiter && user && profile && profile.role !== 'waiter') ||
                         (isStaff && user && profile && profile.role !== 'staff') ||
                         (isRoot && user && profile && profile.role !== 'root');

  // Modern E-commerce UI for Non-Client Roles
  if (!isClient) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors font-sans">
        <div className="w-full max-w-[440px] space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-600 text-white shadow-xl shadow-sky-200 dark:shadow-none transform -rotate-6 hover:rotate-0 transition-transform duration-300">
              {isRoot ? <Code size={32} /> : isAdmin ? <ShieldCheck size={32} /> : isWaiter ? <Bell size={32} /> : <ChefHat size={32} />}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Praia<span className="text-sky-600">Flow</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {mode === 'login' ? `Acesse o Painel de ${currentRole === 'root' ? 'Root' : currentRole === 'admin' ? 'Administrador' : currentRole === 'waiter' ? 'Atendente' : 'Cozinha'}` : 
                 mode === 'register' ? `Cadastro de ${currentRole === 'root' ? 'Root' : currentRole === 'admin' ? 'Administrador' : currentRole === 'waiter' ? 'Atendente' : 'Cozinha'}` : 'Recupere seu acesso'}
              </p>
            </div>
          </div>

          {/* Auth Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-8 relative overflow-hidden">
            {/* Feedback Messages */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Forms */}
            {mode === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">E-mail Profissional</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors" size={20} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@empresa.com"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-sky-600 dark:focus:border-sky-500 rounded-2xl pl-12 pr-4 py-4 outline-none transition-all dark:text-white font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Senha</label>
                      <button 
                        type="button"
                        onClick={() => setMode('forgot-password')}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors" size={20} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-sky-600 dark:focus:border-sky-500 rounded-2xl pl-12 pr-12 py-4 outline-none transition-all dark:text-white font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-sky-100 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                  Entrar no Painel
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white dark:bg-slate-900 px-4 text-slate-400 font-black tracking-widest">Ou continue com</span></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isProcessing}
                  className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
                  Google Workspace
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Perfil de Acesso</span>
                    <span className="px-3 py-1 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-sky-200 dark:border-sky-800">
                      {currentRole === 'root' ? 'ROOT' : currentRole === 'admin' ? 'ADMINISTRADOR' : currentRole === 'waiter' ? 'ATENDENTE' : currentRole === 'staff' ? 'COZINHA' : 'CLIENTE'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors" size={20} />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Como deseja ser chamado"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-sky-600 dark:focus:border-sky-500 rounded-2xl pl-12 pr-4 py-4 outline-none transition-all dark:text-white font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">E-mail Profissional</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors" size={20} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nome@empresa.com"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-sky-600 dark:focus:border-sky-500 rounded-2xl pl-12 pr-4 py-4 outline-none transition-all dark:text-white font-medium"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-sky-600 dark:focus:border-sky-500 rounded-2xl px-4 py-4 outline-none transition-all dark:text-white font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Confirmar</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-sky-600 dark:focus:border-sky-500 rounded-2xl px-4 py-4 outline-none transition-all dark:text-white font-medium"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-sky-100 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  Criar minha conta
                </button>
              </form>
            )}

            {mode === 'forgot-password' && (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">E-mail de Recuperação</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors" size={20} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@empresa.com"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-sky-600 dark:focus:border-sky-500 rounded-2xl pl-12 pr-4 py-4 outline-none transition-all dark:text-white font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-sky-100 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Mail size={20} />}
                  Enviar link de recuperação
                </button>

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full text-slate-500 dark:text-slate-400 font-bold text-sm hover:text-sky-600 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={16} /> Voltar para o login
                </button>
              </form>
            )}

            {/* Footer Links */}
            {mode !== 'forgot-password' && (
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {mode === 'login' ? 'Não tem uma conta?' : 'Já possui uma conta?'}
                  <button
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    className="ml-2 text-sky-600 font-bold hover:text-sky-700 transition-colors underline underline-offset-4"
                  >
                    {mode === 'login' ? 'Cadastre-se agora' : 'Faça login'}
                  </button>
                </p>
              </div>
            )}

            {/* Development Access Section */}
            {systemAccess && (
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                  <Code size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Acesso de Desenvolvimento</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {systemAccess.devLogin?.root === true && (
                    <button 
                      onClick={() => handleDevLogin('root')}
                      className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/30"
                    >
                      Entrar como Root
                    </button>
                  )}
                  {systemAccess.devLogin?.admin === true && (
                    <button 
                      onClick={() => handleDevLogin('admin')}
                      className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-all border border-purple-100 dark:border-purple-900/30"
                    >
                      Entrar como Admin
                    </button>
                  )}
                  {systemAccess.devLogin?.waiter === true && (
                    <button 
                      onClick={() => handleDevLogin('waiter')}
                      className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100 dark:border-amber-900/30"
                    >
                      Entrar como Atendente
                    </button>
                  )}
                  {systemAccess.devLogin?.staff === true && (
                    <button 
                      onClick={() => handleDevLogin('staff')}
                      className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100 dark:border-blue-900/30"
                    >
                      Entrar como Cozinha
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Links */}
          <div className="flex items-center justify-between px-4">
            <button 
              onClick={() => navigate('/')}
              className="text-xs font-bold text-slate-400 hover:text-sky-600 transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={14} /> Voltar ao Início
            </button>
            <div className="flex items-center gap-4">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original Client Login UI (Unchanged as requested)
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
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-900/30">
              {error}
            </div>
            {error.includes('já está em uso') && mode === 'register' && (
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="text-xs font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest hover:underline"
              >
                Ir para Login
              </button>
            )}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-2xl text-sm font-bold border border-green-100 dark:border-green-900/30">
            {success}
          </div>
        )}

        {user && profileLoading && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-sky-600" size={40} />
            <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
              Carregando Perfil...
            </p>
          </div>
        )}

        {user && profile && !isAccessDenied && (
          <div className="py-12 flex flex-col items-center gap-4 animate-pulse">
            <Loader2 className="animate-spin text-sky-600" size={40} />
            <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
              Redirecionando para o Painel...
            </p>
          </div>
        )}

        {user && !profile && !profileLoading && !isProcessing && (
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
            {mode === 'login' ? (
              <div className="space-y-4">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={isProcessing}
                  className="w-full bg-sky-600 dark:bg-sky-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-sky-700 dark:hover:bg-sky-600 transition-all shadow-lg shadow-sky-200 dark:shadow-none active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
                  {isProcessing ? t('loading') : 'Entrar com Google'}
                </button>
                
                <button 
                  onClick={handleGoogleLoginRedirect}
                  disabled={isProcessing}
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
                  onClick={() => setMode('register')}
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
                    onClick={() => setMode('login')}
                    className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-200 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-slate-600 transition-all active:scale-95"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-[2] bg-sky-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none active:scale-95 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
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
        {systemAccess && systemAccess.devLogin && (
          <div className="pt-6 border-t border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-slate-500">
              <Code size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Acesso de Desenvolvimento</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {systemAccess.devLogin.root === true && (
                <button 
                  onClick={() => handleDevLogin('root')}
                  className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/30"
                >
                  Root
                </button>
              )}
              {systemAccess.devLogin.admin === true && (
                <button 
                  onClick={() => handleDevLogin('admin')}
                  className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-all border border-purple-100 dark:border-purple-900/30"
                >
                  Admin
                </button>
              )}
              {systemAccess.devLogin.waiter === true && (
                <button 
                  onClick={() => handleDevLogin('waiter')}
                  className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100 dark:border-amber-900/30"
                >
                  Atendente
                </button>
              )}
              {systemAccess.devLogin.staff === true && (
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
