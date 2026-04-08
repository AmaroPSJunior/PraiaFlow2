import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Table, UserProfile } from '../types';
import { globalSignOut } from '../lib/authUtils';
import { logAction } from '../lib/firebase';
import { LayoutGrid, ArrowLeft, LogOut, User, Bell, Receipt, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../lib/LanguageContext';


interface WaiterViewProps {
  user: any;
  profile: UserProfile | null;
}

export default function WaiterView({ user, profile }: WaiterViewProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [tables, setTables] = useState<Table[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'tables'), orderBy('number', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tables:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'waiter_calls'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    let isFirstLoad = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hasNewCall = snapshot.docChanges().some(change => change.type === 'added');
      
      if (hasNewCall && !isFirstLoad) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio play blocked:', e));
      }
      isFirstLoad = false;

      const rawCalls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Group calls by tableId and type
      const grouped = rawCalls.reduce((acc: any[], call: any) => {
        const existing = acc.find(c => c.tableId === call.tableId && c.type === call.type);
        if (existing) {
          existing.count = (existing.count || 1) + 1;
          existing.ids.push(call.id);
          // Keep the most recent timestamp
          if (call.createdAt?.toMillis() > existing.createdAt?.toMillis()) {
            existing.createdAt = call.createdAt;
          }
        } else {
          acc.push({ ...call, count: 1, ids: [call.id] });
        }
        return acc;
      }, []);

      setWaiterCalls(grouped);
    }, (error) => {
      console.error("Error fetching waiter calls:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await globalSignOut();
  };

  const filteredTables = tables.filter(t => 
    t.number.toString().includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-6 transition-colors relative overflow-hidden font-sans">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-200/20 dark:bg-sky-900/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-orange-100/20 dark:bg-orange-900/5 rounded-full blur-3xl" />
      </div>

      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 z-10 relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.location.href = '/'}
            className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-slate-400 hover:text-sky-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Painel do Atendente</h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">Olá, {user?.displayName || user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <button 
            onClick={handleSignOut}
            className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto z-10 relative space-y-12">
        {/* Pending Calls Section */}
        {waiterCalls.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Bell size={20} className="animate-bounce" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Chamadas Pendentes</h2>
              <span className="px-3 py-1 bg-amber-500 text-white text-xs font-black rounded-full">{waiterCalls.length}</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {waiterCalls.map((call) => (
                  <motion.div
                    key={call.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border-2 border-amber-100 dark:border-amber-900/20 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/10 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xl">
                        {call.tableId.replace('table_', '')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 dark:text-white uppercase text-sm">
                            {call.type === 'waiter' ? 'Chamar Garçom' : 'Pedir Conta'}
                          </p>
                          {call.count > 1 && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-lg border border-amber-200 dark:border-amber-800">
                              {call.count}x
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {call.createdAt ? new Date(call.createdAt.toDate()).toLocaleTimeString() : '...'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          const updatePromises = call.ids.map((id: string) => 
                            updateDoc(doc(db, 'waiter_calls', id), {
                              status: 'completed',
                              updatedAt: serverTimestamp(),
                              attendantId: user.uid,
                              attendantName: user.displayName || user.email?.split('@')[0] || 'Atendente'
                            })
                          );
                          await Promise.all(updatePromises);
                          await logAction('update', 'waiter_calls', `Mesa ${call.tableId.replace('table_', '')} - ${call.type}`);
                          navigate(`/mesa/${call.tableId.replace('table_', '')}`);
                        } catch (error) {
                          console.error("Error updating call status:", error);
                          navigate(`/mesa/${call.tableId.replace('table_', '')}`);
                        }
                      }}
                      className="p-3 bg-sky-500 text-white rounded-2xl shadow-lg hover:bg-sky-600 transition-all active:scale-95"
                    >
                      Atender
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Tables Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400">
                <LayoutGrid size={20} />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Mapa de Mesas</h2>
            </div>
            
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Buscar mesa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 rounded-xl shadow-lg border-2 border-transparent focus:border-sky-500 outline-none transition-all dark:text-white font-bold text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredTables.map((table) => {
                const isOccupied = !!table.currentUserId;
                return (
                  <motion.button
                    key={table.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => navigate(`/mesa/${table.number}`)}
                    className={`group aspect-square p-6 rounded-[2.5rem] shadow-xl border-2 transition-all flex flex-col items-center justify-center gap-3 active:scale-95 text-center ${
                      isOccupied 
                        ? 'bg-sky-500 border-sky-400 text-white' 
                        : 'bg-white dark:bg-slate-900 border-transparent hover:border-sky-500'
                    }`}
                  >
                    <span className={`text-4xl font-black ${isOccupied ? 'text-white' : 'text-slate-900 dark:text-white group-hover:text-sky-600'}`}>
                      {table.number}
                    </span>
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isOccupied ? 'text-sky-100' : 'text-slate-400'}`}>
                        {isOccupied ? 'Ocupada' : 'Livre'}
                      </span>
                      {isOccupied && (
                        <span className="text-[9px] font-bold opacity-80 truncate max-w-[100px]">
                          {table.currentUserName || 'Cliente'}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredTables.length === 0 && (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] shadow-inner border-2 border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest italic">
                Nenhuma mesa encontrada
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
