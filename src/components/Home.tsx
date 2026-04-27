import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, getDoc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { globalSignOut } from '../lib/authUtils';
import { logSystemError, handleFirestoreError, OperationType } from '../lib/errorUtils';
import { Table, ReservationSettings, SystemAccess } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { QrCode, LayoutGrid, ShieldCheck, User, ArrowLeft, Camera, Waves, Sun, UtensilsCrossed, Calendar, XCircle, CheckCircle2, Clock, List, Check, AlertCircle, RefreshCw, Bell, ChefHat, LogOut, Code } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';
import CountdownTimer from './CountdownTimer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onBack: () => void;
  t: (key: string) => string;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onBack, t }) => {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const startPromiseRef = React.useRef<Promise<void> | null>(null);

  useEffect(() => {
    let isMounted = true;
    const scanner = new Html5Qrcode("reader");

    const startScanner = async () => {
      try {
        // Small delay to ensure DOM is ready and previous instances are cleared
        await new Promise(resolve => setTimeout(resolve, 150));
        
        if (!isMounted) return;
        
        // Ensure the reader element exists before starting
        const readerElement = document.getElementById("reader");
        if (!readerElement) return;

        startPromiseRef.current = scanner.start(
          { facingMode: facingMode },
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (isMounted) onScan(decodedText);
          },
          () => {} // Silently ignore scanner errors
        );

        await startPromiseRef.current;

        // If component unmounted while starting, stop it immediately
        if (!isMounted && scanner.getState() >= 2) {
          scanner.stop().catch(() => {});
        }
      } catch (err) {
        // Ignore the "interrupted" error which is common during rapid unmounting
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isInterrupted = errorMessage.includes("interrupted") || 
                            errorMessage.includes("removed from the document") ||
                            errorMessage.includes("play()");
        
        if (isMounted && !isInterrupted) {
          console.error("Failed to start scanner", err);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      const cleanup = async () => {
        // Wait for any pending start to finish before stopping
        if (startPromiseRef.current) {
          try {
            await startPromiseRef.current;
          } catch (e) {
            // ignore start errors during cleanup
          }
        }
        
        if (scanner.getState() >= 2) {
          scanner.stop().catch(err => {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg && !msg.includes("not running") && !msg.includes("interrupted")) {
              console.error("Failed to stop scanner on cleanup", err);
            }
          });
        }
      };
      cleanup();
    };
  }, [onScan, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <motion.div 
      key="scanner"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
    >
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest z-50 border border-white/10"
      >
        <ArrowLeft size={20} /> {t('back')}
      </button>

      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-sky-500/20 rounded-2xl flex items-center justify-center mx-auto text-sky-400 animate-pulse border border-sky-500/30">
            <Camera size={32} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">{t('scanQrCode')}</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Posicione o código no centro</p>
        </div>

        <div className="relative mx-auto w-full aspect-square max-w-[320px] sm:max-w-md bg-slate-900 rounded-[3rem] p-2 shadow-2xl shadow-sky-500/10 border-4 border-white/5 overflow-hidden">
          <div id="reader" className="w-full h-full rounded-[2.5rem] overflow-hidden bg-black"></div>
          
          {/* Flip Camera Button */}
          <button 
            onClick={toggleCamera}
            className="absolute bottom-8 right-8 p-5 bg-sky-500 text-white rounded-3xl shadow-2xl hover:bg-sky-600 transition-all active:scale-95 z-20 flex items-center justify-center border-4 border-white/20"
            title="Inverter Câmera"
          >
            <RefreshCw size={28} className={cn("transition-transform duration-500", facingMode === 'user' && "rotate-180")} />
          </button>

          {/* Scanner Frame Overlay */}
          <div className="absolute inset-12 border-2 border-sky-500/30 rounded-3xl pointer-events-none">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-sky-500 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-sky-500 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-sky-500 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-sky-500 rounded-br-2xl" />
            
            {/* Scanning Line Animation */}
            <motion.div 
              animate={{ top: ['10%', '90%', '10%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-1 bg-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.5)] z-10"
            />
          </div>
        </div>

        <p className="text-slate-500 font-medium text-sm italic">
          A identificação da mesa é automática
        </p>
      </div>
    </motion.div>
  );
};

interface HomeProps {
  user: any;
  systemAccess: SystemAccess | null;
}

export default function Home({ user, systemAccess: propSystemAccess }: HomeProps) {
  const [view, setView] = useState<'main' | 'client' | 'scanner' | 'table-list' | 'booking'>('main');
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservationSettings, setReservationSettings] = useState<ReservationSettings>({
    cost: 10,
    durationMinutes: 60,
    enabled: true
  });
  const [systemAccess, setSystemAccess] = useState<SystemAccess>({
    client: true,
    waiter: true,
    staff: true,
    admin: true,
    root: true
  });
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [paymentStep, setPaymentStep] = useState<'none' | 'pix' | 'processing' | 'success'>('none');
  const [pixData, setPixData] = useState<{ qrCode: string, copyPaste: string } | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);
  
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    await globalSignOut();
  };

  useEffect(() => {
    // Check if we are in a development environment or if test mode is explicitly enabled
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/v1/config');
        if (res.ok) {
          const data = await res.json();
          if (data.isTestMode !== undefined) {
            setIsTestMode(data.isTestMode);
          }
        }
      } catch (err) {
        // Default to true for this prototype environment
        setIsTestMode(true);
      }
    };
    checkConfig();
  }, []);

  useEffect(() => {
    if (propSystemAccess) {
      setSystemAccess(propSystemAccess);
    }
  }, [propSystemAccess]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'reservation'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setReservationSettings(prev => ({
          ...prev,
          ...data,
          cost: data.cost !== undefined ? Number(data.cost) : prev.cost,
          durationMinutes: data.durationMinutes !== undefined ? Number(data.durationMinutes) : prev.durationMinutes,
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/reservation');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'system_access'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemAccess(snapshot.data() as SystemAccess);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/system_access');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log("Home: Starting tables listener. User:", user?.uid);
    // Safety timeout
    const timeoutId = setTimeout(() => {
      console.log("Home: Tables safety timeout reached.");
      setLoading(false);
    }, 5000);

    const q = query(collection(db, 'tables')); // Fetch all tables to see if any exist
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Home: Tables snapshot received. Count:", snapshot.size);
      clearTimeout(timeoutId);
      const now = new Date();
      
      // Filter active tables in memory to be more robust
      const tablesData = snapshot.docs
        .map(doc => {
          const data = doc.data();
          const reservedUntil = data.reservedUntil?.toDate();
          
          // Defensive check: if reservation expired, treat as not reserved
          if (reservedUntil && reservedUntil < now && !data.currentUserId) {
            return { id: doc.id, ...data, reservedUntil: null, reservedBy: null, reservedByName: null } as Table;
          }
          
          return { id: doc.id, ...data } as Table;
        })
        .filter(t => t.active !== false); // Default to true if active is missing
        
      setTables(tablesData);
      setLoading(false);
    }, (err) => {
      console.error("Home: Error fetching tables:", err);
      handleFirestoreError(err, OperationType.LIST, 'tables');
      setLoading(false);
    });
    return () => {
      console.log("Home: Cleaning up tables listener.");
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [user?.uid]);

  // Remove automatic redirect to always show the selection screen
  // useEffect(() => {
  //   if (user && tables.length > 0) {
  //     const userTable = tables.find(t => t.currentUserId === user.uid);
  //     if (userTable) {
  //       navigate(`/mesa/${userTable.number}`);
  //     }
  //   }
  // }, [user, tables, navigate]);

  const handleClientClick = () => {
    // Remove automatic redirect to table to always show client options
    // if (user) {
    //   const userTable = tables.find(t => t.currentUserId === user.uid);
    //   if (userTable) {
    //     navigate(`/mesa/${userTable.number}`);
    //     return;
    //   }
    // }
    setView('client');
  };

  const handleConfirmReservation = async () => {
    try {
      console.log("Confirming reservation...", { user, selectedTable, reservationSettings });
      
      if (!user) {
        logSystemError('User not logged in for reservation', 'Reservation - Auth Check');
        alert("Você precisa estar logado para reservar uma mesa. Por favor, faça login primeiro.");
        navigate('/login');
        return;
      }
      
      if (!selectedTable) {
        logSystemError('No table selected for reservation', 'Reservation - Table Check');
        alert("Por favor, selecione uma mesa no mapa primeiro.");
        return;
      }

      const cost = Number(reservationSettings.cost || 0);

      // Start payment flow
      setPaymentStep('pix');
      setPixData({
        qrCode: `00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865405${cost.toFixed(2)}5802BR5913PRAIAFLOW6008SAOPAULO62070503***6304E2CA`,
        copyPaste: `00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865405${cost.toFixed(2)}5802BR5913PRAIAFLOW6008SAOPAULO62070503***6304E2CA`
      });
    } catch (error) {
      console.error("Error in handleConfirmReservation:", error);
      logSystemError(error, 'Reservation Confirmation');
      alert("Ocorreu um erro ao iniciar a reserva. Por favor, tente novamente.");
    }
  };

  const simulatePayment = async (success: boolean) => {
    if (!success) {
      setPaymentStep('none');
      logSystemError('Payment refused by user/system', 'Simulated Payment');
      alert("Pagamento recusado.");
      return;
    }

    setPaymentStep('processing');
    
    try {
      if (selectedTable && user) {
        const reservedUntil = new Date();
        reservedUntil.setMinutes(reservedUntil.getMinutes() + reservationSettings.durationMinutes);
        
        await updateDoc(doc(db, 'tables', selectedTable.id), {
          reservedUntil: reservedUntil,
          reservedBy: user.uid,
          reservedByName: user.displayName || user.email,
          currentUserId: user.uid,
          currentUserName: user.displayName || user.email,
          active: true
        });

        setPaymentStep('success');
        setTimeout(() => {
          navigate(`/mesa/${selectedTable.number}`);
        }, 2000);
      }
    } catch (error) {
      console.error("Error reserving table:", error);
      logSystemError(error, 'Table Reservation Process');
      setPaymentStep('none');
      alert("Erro ao processar reserva.");
    }
  };

  const copyPixCode = () => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.copyPaste);
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
    }
  };

  const handleScan = React.useCallback((decodedText: string) => {
    const tableIdMatch = decodedText.match(/\/mesa\/(\d+)/);
    const tableId = tableIdMatch ? tableIdMatch[1] : decodedText;
    
    if (tableId && !isNaN(Number(tableId))) {
      navigate(`/mesa/${tableId}`);
    }
  }, [navigate]);


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors relative overflow-hidden font-sans">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-sky-200/40 dark:bg-sky-900/10 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, -8, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-orange-100/40 dark:bg-orange-900/5 rounded-full blur-3xl" 
        />
      </div>

      <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
        <LanguageToggle />
        <ThemeToggle />
        {user && (
          <>
            <button 
              onClick={() => navigate('/profile')}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
              title="Meu Perfil"
            >
              <User size={20} />
            </button>
            <button 
              onClick={handleSignOut}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={t('logout')}
            >
              <LogOut size={20} />
            </button>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === 'main' && (
            <motion.div 
              key="main"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="w-full max-w-6xl space-y-12 text-center z-10 px-4"
            >
            <motion.div variants={itemVariants} className="space-y-4">
              <div className="flex justify-center gap-2 text-sky-500 dark:text-sky-400 mb-2">
                <Waves size={32} className="animate-bounce" />
                <Sun size={32} className="animate-spin-slow" />
              </div>
              <h1 className="text-7xl font-black text-slate-900 dark:text-white tracking-tighter italic leading-none">
                Praia<span className="text-sky-500">Flow</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xl max-w-xs mx-auto leading-tight">
                {t('welcome')}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {systemAccess.client && (
                <button 
                  onClick={handleClientClick}
                  className="group bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] shadow-2xl shadow-sky-200/20 dark:shadow-none border-2 border-transparent hover:border-sky-500 transition-all flex flex-col items-center gap-6 active:scale-95 text-center"
                >
                  <div className="w-20 h-20 lg:w-24 lg:h-24 bg-sky-50 dark:bg-sky-900/20 rounded-3xl flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                    <User size={48} className="lg:w-14 lg:h-14" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('client')}</h2>
                    <p className="text-[10px] lg:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Fazer Pedido</p>
                  </div>
                </button>
              )}

              {systemAccess.waiter && (
                <button 
                  onClick={() => navigate('/waiter')}
                  className="group bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] shadow-2xl shadow-amber-200/20 dark:shadow-none border-2 border-transparent hover:border-amber-500 transition-all flex flex-col items-center gap-6 active:scale-95 text-center"
                >
                  <div className="w-20 h-20 lg:w-24 lg:h-24 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                    <Bell size={48} className="lg:w-14 lg:h-14" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('waiter')}</h2>
                    <p className="text-[10px] lg:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Atendimento</p>
                  </div>
                </button>
              )}

              {systemAccess.staff && (
                <button 
                  onClick={() => navigate('/staff')}
                  className="group bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] shadow-2xl shadow-orange-200/20 dark:shadow-none border-2 border-transparent hover:border-orange-500 transition-all flex flex-col items-center gap-6 active:scale-95 text-center"
                >
                  <div className="w-20 h-20 lg:w-24 lg:h-24 bg-orange-50 dark:bg-orange-900/20 rounded-3xl flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                    <ChefHat size={48} className="lg:w-14 lg:h-14" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Cozinha</h2>
                    <p className="text-[10px] lg:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Produção</p>
                  </div>
                </button>
              )}

              {systemAccess.admin && (
                <button 
                  onClick={() => navigate('/admin')}
                  className="group bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/20 dark:shadow-none border-2 border-transparent hover:border-slate-900 dark:hover:border-white transition-all flex flex-col items-center gap-6 active:scale-95 text-center"
                >
                  <div className="w-20 h-20 lg:w-24 lg:h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-900 dark:text-slate-200 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                    <ShieldCheck size={48} className="lg:w-14 lg:h-14" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('admin')}</h2>
                    <p className="text-[10px] lg:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Gerenciar Quiosque</p>
                  </div>
                </button>
              )}

              {systemAccess.root && (
                <button 
                  onClick={() => navigate('/root')}
                  className="group bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] shadow-2xl shadow-red-200/20 dark:shadow-none border-2 border-transparent hover:border-red-600 transition-all flex flex-col items-center gap-6 active:scale-95 text-center"
                >
                  <div className="w-20 h-20 lg:w-24 lg:h-24 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                    <Code size={48} className="lg:w-14 lg:h-14" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Root</h2>
                    <p className="text-[10px] lg:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Desenvolvimento</p>
                  </div>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}

        {view === 'client' && (
          <motion.div 
            key="client"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg space-y-10 text-center z-10"
          >
            <button 
              onClick={() => setView('main')}
              className="absolute top-6 left-6 p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-slate-400 hover:text-sky-600 transition-colors flex items-center gap-2 font-black text-xs uppercase tracking-widest"
            >
              <ArrowLeft size={18} /> {t('back')}
            </button>

            <div className="space-y-4">
              <div className="w-20 h-20 bg-sky-500 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl shadow-sky-500/20">
                <UtensilsCrossed size={40} />
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                {t('client')}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-[0.2em]">
                Selecione sua entrada
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <button 
                onClick={() => setView('scanner')}
                className="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-sky-500 transition-all flex items-center gap-8 active:scale-95 text-left"
              >
                <div className="w-20 h-20 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                  <QrCode size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('scanQrCode')}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Apontar Câmera</p>
                </div>
              </button>

              <button 
                onClick={() => setView('table-list')}
                className="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-sky-500 transition-all flex items-center gap-8 active:scale-95 text-left"
              >
                <div className="w-20 h-20 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                  <LayoutGrid size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('chooseTable')}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Lista de Mesas</p>
                </div>
              </button>

              {reservationSettings.enabled && (
                <button 
                  onClick={() => setView('booking')}
                  className="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border-2 border-transparent hover:border-amber-500 transition-all flex items-center gap-8 active:scale-95 text-left"
                >
                  <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                    <Calendar size={40} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Reservar Mesa</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Mapa do Salão</p>
                  </div>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {view === 'scanner' && (
          <QRScanner 
            onScan={handleScan} 
            onBack={() => setView('client')} 
            t={t} 
          />
        )}

        {view === 'table-list' && (
          <motion.div 
            key="table-list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-2xl space-y-8 text-center z-10"
          >
            <button 
              onClick={() => setView('client')}
              className="absolute top-6 left-6 p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-slate-400 hover:text-sky-600 transition-colors flex items-center gap-2 font-black text-xs uppercase tracking-widest"
            >
              <ArrowLeft size={18} /> {t('back')}
            </button>

            <div className="space-y-4">
              <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('selectYourTable')}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">Toque em uma mesa livre para começar</p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-[60vh] overflow-y-auto p-4 scrollbar-hide">
              {loading && tables.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Carregando mesas...</p>
                  <button 
                    onClick={() => setLoading(true)}
                    className="mt-4 px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Tentar Recarregar
                  </button>
                </div>
              ) : tables.length > 0 ? (
                tables.sort((a, b) => a.number - b.number).map((table) => {
                  const isOccupied = table.currentUserId && table.currentUserId !== user?.uid;
                  return (
                    <button
                      key={table.id}
                      onClick={() => navigate(`/mesa/${table.number}`)}
                      className={`aspect-square rounded-3xl shadow-lg border-2 transition-all active:scale-95 flex flex-col items-center justify-center group ${
                        isOccupied 
                          ? 'bg-slate-100 dark:bg-slate-800 border-transparent opacity-60' 
                          : 'bg-white dark:bg-slate-900 border-transparent hover:border-sky-500 hover:scale-105'
                      }`}
                    >
                      <span className={`text-3xl font-black transition-colors ${
                        isOccupied ? 'text-slate-400' : 'text-slate-900 dark:text-white group-hover:text-sky-600'
                      }`}>
                        {table.number}
                      </span>
                      <div className={`w-2 h-2 rounded-full mt-1 ${isOccupied ? 'bg-slate-300' : 'bg-green-500 animate-pulse'}`} />
                      {isOccupied && <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Ocupada</span>}
                    </button>
                  );
                })
              ) : (
                <div className="col-span-full py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-inner border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
                  <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest italic">
                    Nenhuma mesa cadastrada no sistema
                  </p>
                  <button 
                    onClick={() => setLoading(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    <RefreshCw size={14} /> Atualizar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'booking' && (
          <motion.div 
            key="booking"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-4xl space-y-8 text-center z-10"
          >
            <button 
              onClick={() => { setView('client'); setSelectedTable(null); }}
              className="absolute top-6 left-6 p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-slate-400 hover:text-sky-600 transition-colors flex items-center gap-2 font-black text-xs uppercase tracking-widest"
            >
              <ArrowLeft size={18} /> {t('back')}
            </button>

            <div className="space-y-4">
              <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Reservar Mesa</h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">Selecione a mesa desejada no mapa</p>
            </div>

            <div className="relative bg-white dark:bg-slate-900 rounded-[3rem] aspect-video shadow-2xl border-4 border-sky-500/10 overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : tables.length > 0 ? (
                tables.map((table, index) => {
                  const isReserved = table.reservedUntil && table.reservedUntil.toDate() > new Date();
                  const isOccupied = table.currentUserId;
                  const isAvailable = !isReserved && !isOccupied && table.active;

                  // Default position if not set (grid layout)
                  const defaultX = (index % 5) * 20 + 10;
                  const defaultY = Math.floor(index / 5) * 20 + 10;

                    return (
                      <div
                        key={table.id}
                        className="absolute"
                        style={{ 
                          left: `${table.x !== undefined ? table.x : defaultX}%`, 
                          top: `${table.y !== undefined ? table.y : defaultY}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <button
                          disabled={!isAvailable}
                          onClick={() => setSelectedTable(table)}
                          className={cn(
                            "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold shadow-lg transition-all active:scale-90",
                            isAvailable 
                              ? (selectedTable?.id === table.id ? "bg-amber-500 text-white scale-125 ring-4 ring-amber-200" : "bg-sky-500 text-white hover:scale-110 hover:bg-sky-600") 
                              : "bg-gray-200 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
                          )}
                        >
                          {table.number}
                        </button>
                        {isReserved && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 shadow-sm z-10">
                            <CountdownTimer 
                              targetDate={table.reservedUntil} 
                              className="text-amber-600 dark:text-amber-400 text-[8px] whitespace-nowrap"
                            />
                          </div>
                        )}
                      </div>
                    );
                })
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest italic text-center">
                    Nenhuma mesa disponível para reserva no momento.
                  </p>
                </div>
              )}
            </div>
            
            {selectedTable && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border-2 border-sky-500 flex flex-col sm:flex-row items-center justify-between gap-6"
              >
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold dark:text-white">Mesa {selectedTable.number}</h3>
                  <p className="text-sm text-gray-500">Custo da Reserva: <span className="font-bold text-sky-600">R$ {Number(reservationSettings.cost || 0).toFixed(2)}</span></p>
                  <p className="text-xs text-gray-400 italic mb-3">Válido por {reservationSettings.durationMinutes} minutos</p>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl space-y-2">
                    <div className="flex gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <p className="text-[10px] font-medium leading-tight">
                        O valor do sinal será reembolsado ou debitado do consumo total da mesa. 
                        Caso o horário não seja cumprido, o valor será retido como compensação pelo tempo de indisponibilidade da mesa.
                      </p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleConfirmReservation}
                  className="bg-sky-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-sky-700 transition-all shadow-lg shadow-sky-500/20 w-full sm:w-auto"
                >
                  Confirmar e Pagar
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentStep !== 'none' && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-8 text-center space-y-6"
            >
              {paymentStep === 'pix' ? (
                <>
                  <div className="bg-sky-100 dark:bg-sky-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-sky-600 dark:text-sky-400">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="text-2xl font-bold dark:text-white">Pagamento da Reserva</h2>
                  
                  <div className="bg-white p-4 rounded-2xl aspect-square flex items-center justify-center shadow-inner border-4 border-gray-50 mx-auto">
                    {pixData?.qrCode ? (
                      <QRCodeSVG value={pixData.qrCode} size={200} />
                    ) : (
                      <div className="animate-pulse bg-gray-200 dark:bg-slate-700 w-full h-full rounded-xl"></div>
                    )}
                  </div>

                  {isTestMode && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button 
                        onClick={() => simulatePayment(true)}
                        className="bg-green-500 text-white py-2 rounded-xl text-sm font-bold hover:bg-green-600"
                      >
                        Simular Pago
                      </button>
                      <button 
                        onClick={() => simulatePayment(false)}
                        className="bg-red-500 text-white py-2 rounded-xl text-sm font-bold hover:bg-red-600"
                      >
                        Simular Recusa
                      </button>
                    </div>
                  )}

                  <div className="w-full space-y-3">
                    <p className="text-gray-500 dark:text-slate-400 text-sm text-center">
                      Escaneie o QR Code para pagar a reserva de <span className="font-bold text-gray-900 dark:text-white">R$ {Number(reservationSettings.cost || 0).toFixed(2)}</span>
                    </p>
                    
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                        Ao pagar, você concorda que o valor será debitado do consumo ou reembolsado. Em caso de não comparecimento, o valor não será devolvido.
                      </p>
                    </div>
                    
                    <button 
                      onClick={copyPixCode}
                      className="w-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                    >
                      {isCopying ? <Check size={18} className="text-green-500" /> : <List size={18} />}
                      {isCopying ? 'Copiado!' : 'Copiar Código PIX'}
                    </button>
                  </div>

                  <button 
                    onClick={() => setPaymentStep('none')}
                    className="text-gray-400 text-sm font-bold hover:text-gray-600"
                  >
                    Cancelar
                  </button>
                </>
              ) : paymentStep === 'processing' ? (
                <div className="py-12 space-y-6">
                  <div className="w-20 h-20 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <h2 className="text-2xl font-bold dark:text-white">Processando Reserva...</h2>
                </div>
              ) : (
                <div className="py-12 space-y-6">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <CheckCircle2 size={48} />
                  </div>
                  <h2 className="text-2xl font-bold dark:text-white">Reserva Confirmada!</h2>
                  <p className="text-gray-500">Sua mesa está garantida. Redirecionando...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="mt-12 text-center space-y-2 z-10">
        <div className="flex items-center justify-center gap-2 text-sky-600/30 dark:text-sky-400/20">
          <div className="h-[1px] w-8 bg-current" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em]">PraiaFlow Experience</p>
          <div className="h-[1px] w-8 bg-current" />
        </div>
        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">Intelligent Kiosk Management System</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        #reader__dashboard_section_csr button {
          background-color: #0ea5e9 !important;
          color: white !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 12px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          margin-top: 10px !important;
        }
        #reader__status_span {
          display: none !important;
        }
        #reader video {
          border-radius: 20px !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}} />
    </div>
  );
}
