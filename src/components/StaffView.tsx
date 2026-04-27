import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Order, UserProfile } from '../types';
import { globalSignOut } from '../lib/authUtils';
import { logAction } from '../lib/firebase';
import { ChefHat, ArrowLeft, LogOut, Clock, CheckCircle2, PlayCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../lib/LanguageContext';


interface StaffViewProps {
  user: any;
  profile: UserProfile | null;
}

export default function StaffView({ user, profile }: StaffViewProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for orders that are pending, preparing or ready
    // We filter out delivered and cancelled
    const q = query(
      collection(db, 'orders'), 
      where('status', 'in', ['pending', 'paid', 'preparing', 'ready']),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders for staff:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await globalSignOut();
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      const order = orders.find(o => o.id === orderId);
      await logAction('update', 'orders', `Pedido #${order?.orderNumber || orderId}`);
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'paid');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-6 transition-colors relative overflow-hidden font-sans">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-200/20 dark:bg-orange-900/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-sky-100/20 dark:bg-sky-900/5 rounded-full blur-3xl" />
      </div>

      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 z-10 relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-slate-400 hover:text-orange-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
              Cozinha <span className="text-orange-500">&</span> Copa
            </h1>
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

      <main className="max-w-7xl mx-auto z-10 relative grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Column 1: New/Pending Orders */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Clock size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Novos Pedidos</h2>
            <span className="px-3 py-1 bg-orange-500 text-white text-xs font-black rounded-full">{pendingOrders.length}</span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {pendingOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onAction={() => updateOrderStatus(order.id, 'preparing')}
                  actionLabel="Iniciar Preparo"
                  actionIcon={<PlayCircle size={18} />}
                  actionColor="bg-sky-500 hover:bg-sky-600"
                />
              ))}
            </AnimatePresence>
            {pendingOrders.length === 0 && <EmptyState message="Nenhum pedido novo" />}
          </div>
        </section>

        {/* Column 2: Preparing Orders */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400">
              <ChefHat size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Em Preparo</h2>
            <span className="px-3 py-1 bg-sky-500 text-white text-xs font-black rounded-full">{preparingOrders.length}</span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {preparingOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onAction={() => updateOrderStatus(order.id, 'ready')}
                  actionLabel="Marcar como Pronto"
                  actionIcon={<CheckCircle2 size={18} />}
                  actionColor="bg-green-500 hover:bg-green-600"
                />
              ))}
            </AnimatePresence>
            {preparingOrders.length === 0 && <EmptyState message="Nada sendo preparado agora" />}
          </div>
        </section>

        {/* Column 3: Ready Orders */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
              <CheckCircle2 size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Prontos</h2>
            <span className="px-3 py-1 bg-green-500 text-white text-xs font-black rounded-full">{readyOrders.length}</span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {readyOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onAction={() => updateOrderStatus(order.id, 'delivered')}
                  actionLabel="Entregue"
                  actionIcon={<CheckCircle2 size={18} />}
                  actionColor="bg-slate-500 hover:bg-slate-600"
                />
              ))}
            </AnimatePresence>
            {readyOrders.length === 0 && <EmptyState message="Nenhum pedido pronto aguardando" />}
          </div>
        </section>
      </main>
    </div>
  );
}

function OrderCard({ order, onAction, actionLabel, actionIcon, actionColor }: { 
  order: Order, 
  onAction: () => void, 
  actionLabel: string, 
  actionIcon: React.ReactNode,
  actionColor: string 
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all overflow-hidden"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-900 dark:text-white font-black">
              {order.tableId.replace('table_', '')}
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white uppercase text-xs">Pedido #{order.orderNumber}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {new Date(order.createdAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className={cn(
            "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
            order.status === 'paid' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
          )}>
            {order.status === 'paid' ? 'Pago' : 'Pendente'}
          </div>
        </div>

        <div className="space-y-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-400">
                    {item.quantity}x
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</p>
                </div>
                {item.observations && (
                  <div className="mt-1 ml-8 flex items-start gap-1.5 text-orange-600 dark:text-orange-400">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <p className="text-[10px] font-medium leading-tight italic">{item.observations}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={onAction}
          className={cn(
            "w-full py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
            actionColor
          )}
        >
          {actionIcon}
          {actionLabel}
        </button>
      </div>
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center px-6">
      <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-[10px] italic">
        {message}
      </p>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
