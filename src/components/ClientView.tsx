import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, orderBy, limit, getDocs, runTransaction, increment } from 'firebase/firestore';
import { MenuItem, Order, OrderItem, OrderStatus, Category, Table, Promotion, Coupon, UserProfile, AuditLog } from '../types';
import { globalSignOut } from '../lib/authUtils';
import { logAction } from '../lib/firebase';
import { ShoppingCart, Utensils, Beer, Coffee, Pizza, CheckCircle2, Clock, XCircle, ChevronRight, Repeat, LogOut, Plus, Minus, IceCream, Grape, Apple, Fish, Beef, List, Check, AlertCircle, Soup, Cake, Wine, GlassWater, Sandwich, Cookie, LayoutGrid, Menu as MenuIcon, Filter, Search, Tag, Ticket, Bell, Receipt, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import Login from './Login';
import CountdownTimer from './CountdownTimer';
import { useLanguage } from '../lib/LanguageContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ClientViewProps {
  user: any;
  profile?: UserProfile | null;
}

export default function ClientView({ user, profile }: ClientViewProps) {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<OrderItem[]>(() => {
    const savedCart = localStorage.getItem(`cart_mesa_${tableId}`);
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'menu' | 'orders' | 'cart'>('menu');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [itemQuantity, setItemQuantity] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        el.scrollTo({
          left: el.scrollLeft + e.deltaY,
          behavior: 'smooth'
        });
      };
      el.addEventListener('wheel', onWheel);
      return () => el.removeEventListener('wheel', onWheel);
    }
  }, []);
  const [itemObservations, setItemObservations] = useState('');
  const [paymentStep, setPaymentStep] = useState<'none' | 'pix' | 'processing' | 'success'>('none');
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string; paymentId: string } | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Table | null>(null);
  const [userTable, setUserTable] = useState<Table | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [isReleased, setIsReleased] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const createAuditLog = async (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, entityName: string, details?: string) => {
    if (!user) return;

    await addDoc(collection(db, 'audit_logs'), {
      action,
      entityType,
      entityId,
      entityName,
      userEmail: user.email || `${user.uid}@cliente.com`,
      userId: user.uid,
      timestamp: serverTimestamp(),
      details: details || null,
    });
  };

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  interface FirestoreErrorInfo {
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

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
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
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    return errInfo;
  };

  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const { t } = useLanguage();

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'promotions'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'tables'), where('currentUserId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const table = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Table;
          setUserTable(table);
        } else {
          setUserTable(null);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (tableId) {
      setIsTableLoading(true);
      const unsubscribe = onSnapshot(doc(db, 'tables', `table_${tableId}`), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const now = new Date();
          const reservedUntil = data.reservedUntil?.toDate();
          
          if (reservedUntil && reservedUntil < now && !data.currentUserId) {
            setTableData({ id: snapshot.id, ...data, reservedUntil: null, reservedBy: null, reservedByName: null } as Table);
          } else {
            setTableData({ id: snapshot.id, ...data } as Table);
          }
        } else {
          setTableData(null);
        }
        setIsTableLoading(false);
      }, (err) => {
        console.error("Error fetching table:", err);
        setIsTableLoading(false);
      });
      return () => unsubscribe();
    }
  }, [tableId]);

  useEffect(() => {
    fetch('/api/v1/config')
      .then(res => res.json())
      .then(data => setIsTestMode(data.isTestMode))
      .catch(err => console.error("Error fetching config:", err));
  }, []);

  // Detect if table was released by admin
  const prevUserTableRef = useRef<Table | null>(null);
  useEffect(() => {
    if (prevUserTableRef.current && !userTable && tableId && !isReleased) {
      setIsReleased(true);
      showFeedback('error', "Sua sessão nesta mesa foi encerrada pelo administrador.");
      localStorage.removeItem(`cart_mesa_${tableId}`);
      setTimeout(() => window.location.href = '/', 3000);
    }
    prevUserTableRef.current = userTable;
  }, [userTable, tableId, navigate, isReleased]);

  // Automatic redirect if user is at another table
  useEffect(() => {
    if (user && userTable && tableId && userTable.number.toString() !== tableId) {
      navigate(`/mesa/${userTable.number}`, { replace: true });
    }
  }, [user, userTable, tableId, navigate]);

  // Register user to table
  useEffect(() => {
    if (user && tableId && tableData && tableData.active && !isReleased && !isLoggingOut) {
      // Only register if the user is not at another table
      if (!userTable || userTable.number.toString() === tableId) {
        // Only register if the table is currently empty or occupied by us
        if (!tableData.currentUserId || tableData.currentUserId === user.uid) {
          const tableRef = doc(db, 'tables', `table_${tableId}`);
          updateDoc(tableRef, {
            currentUserId: user.uid,
            currentUserName: user.displayName || user.email?.split('@')[0] || 'Cliente',
          }).catch(err => console.error("Error registering user to table:", err));
        }
      }
    }
  }, [user, tableId, tableData, userTable, isReleased, isLoggingOut]);

  useEffect(() => {
    const q = query(collection(db, 'menu'), where('available', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenu(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'orders'), 
        where('userId', '==', user.uid),
        where('status', 'in', ['pending', 'paid', 'preparing', 'ready']),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const order = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Order;
          setActiveOrder(order);
          if (order.status === 'pending') {
            setCurrentOrderId(order.id);
          }
        } else {
          setActiveOrder(null);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });
    return () => unsubscribe();
  }, []);

  // Persist cart
  useEffect(() => {
    if (tableId && !isReleased && tableData && !isLoggingOut) {
      localStorage.setItem(`cart_mesa_${tableId}`, JSON.stringify(cart));
      
      // Sync cart to Firestore for admin visibility
      if (user) {
        const tableRef = doc(db, 'tables', `table_${tableId}`);
        updateDoc(tableRef, {
          currentCart: cart.length > 0 ? cart : null
        }).catch(err => {
          if (!isLoggingOut) console.error("Error syncing cart:", err);
        });
      }
    }
  }, [cart, tableId, user, isReleased, tableData, isLoggingOut]);

  const handleLogout = async (force = false) => {
    const mockUserStr = localStorage.getItem('mock_user');
    const mockUser = mockUserStr ? JSON.parse(mockUserStr) : null;
    const currentUid = user?.uid || auth.currentUser?.uid || mockUser?.uid;

    setIsLoggingOut(true);

    if (currentUid && tableId) {
      try {
        if (!force) {
          // Check for pending orders
          const q = query(
            collection(db, 'orders'),
            where('tableId', '==', tableId),
            where('userId', '==', currentUid)
          );
          const snapshot = await getDocs(q);
          const orders = snapshot.docs.map(doc => doc.data() as Order);
          
          const hasPending = orders.some(order => 
            order.status !== 'cancelled' && 
            (order.status !== 'delivered' || order.paymentStatus !== 'paid')
          );

          if (hasPending) {
            setLogoutError("Você possui pedidos pendentes ou não pagos. Por favor, finalize tudo antes de sair.");
            setIsLoggingOut(false);
            return;
          }
        }

        const tableRef = doc(db, 'tables', `table_${tableId}`);
        await updateDoc(tableRef, {
          currentUserId: null,
          currentUserName: null,
          currentCart: null,
          lastOrderId: null
        });
        
        await logAction('update', 'tables', `Mesa ${tableId} - Checkout`);
        
        await createAuditLog(
          'update', 
          'tables', 
          `table_${tableId}`, 
          `Mesa ${tableId}`, 
          force ? 'Saída Forçada pelo Cliente' : 'Saída Normal pelo Cliente'
        );
      } catch (err) {
        console.error("Error clearing table on logout:", err);
      }
    }

    await globalSignOut();
  };

  if (!user) {
    return <Login />;
  }

  const addToCart = (item: MenuItem) => {
    setSelectedItem(item);
    setItemQuantity(1);
    setItemObservations('');
  };

  const confirmAddToCart = () => {
    if (!selectedItem) return;
    
    const discountedPrice = getDiscountedPrice(selectedItem);
    
    setCart(prev => {
      const existing = prev.find(i => i.productId === selectedItem.id && i.observations === itemObservations);
      
      if (existing) {
        return prev.map(i => (i.productId === selectedItem.id && i.observations === itemObservations) 
          ? { ...i, quantity: i.quantity + itemQuantity } 
          : i
        );
      }
      
      return [...prev, { 
        productId: selectedItem.id, 
        name: selectedItem.name, 
        quantity: itemQuantity, 
        price: discountedPrice,
        originalPrice: selectedItem.price,
        observations: itemObservations 
      }];
    });
    
    showFeedback('success', `${selectedItem.name} adicionado ao carrinho!`);
    setSelectedItem(null);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const getDiscountedPrice = (item: MenuItem) => {
    let price = item.price;
    const activePromo = promotions.find(p => 
      p.active && 
      (p.targetType === 'all' || 
       (p.targetType === 'category' && p.targetId === item.category) || 
       (p.targetType === 'item' && p.targetId === item.id))
    );

    if (activePromo) {
      if (activePromo.discountType === 'percentage') {
        price = price * (1 - activePromo.discountValue / 100);
      } else {
        price = Math.max(0, price - activePromo.discountValue);
      }
    }
    return price;
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', couponCode.toUpperCase()), where('active', '==', true));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        showFeedback('error', "Cupom inválido ou expirado.");
        return;
      }
      const coupon = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Coupon;
      
      // Check limits
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        showFeedback('error', "Limite de uso do cupom atingido.");
        return;
      }

      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      if (coupon.minPurchase && subtotal < coupon.minPurchase) {
        showFeedback('error', `Compra mínima para este cupom: R$ ${coupon.minPurchase}`);
        return;
      }

      setActiveCoupon(coupon);
      showFeedback('success', "Cupom aplicado com sucesso!");
    } catch (error) {
      showFeedback('error', "Erro ao aplicar cupom.");
    }
  };

  const originalSubtotal = cart.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const promotionDiscount = originalSubtotal - subtotal;
  
  let total = subtotal;
  let couponDiscount = 0;
  if (activeCoupon) {
    if (activeCoupon.discountType === 'percentage') {
      couponDiscount = subtotal * (activeCoupon.discountValue / 100);
    } else {
      couponDiscount = Math.min(subtotal, activeCoupon.discountValue);
    }
    total = Math.max(0, subtotal - couponDiscount);
  }

  const placeOrder = async () => {
    console.log("placeOrder clicked, cart length:", cart.length);
    if (cart.length === 0 || total <= 0 || !user) return;

    // Check stock before placing order
    for (const item of cart) {
      const menuItem = menu.find(m => m.id === item.productId);
      if (menuItem && menuItem.stockQuantity !== undefined && menuItem.stockQuantity < item.quantity) {
        showFeedback('error', `Estoque insuficiente para ${item.name}. Disponível: ${menuItem.stockQuantity}`);
        return;
      }
    }

    setPaymentStep('processing');
    
    try {
      console.log("Generating sequential order number...");
      // 1. Get next order number using a transaction
      const counterRef = doc(db, 'metadata', 'orderCounter');
      const nextOrderNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNum = 1;
        if (counterDoc.exists()) {
          nextNum = (counterDoc.data().current || 0) + 1;
        }
        transaction.set(counterRef, { current: nextNum }, { merge: true });
        return nextNum;
      });

      console.log("Creating order in Firestore with number:", nextOrderNumber);
      // 2. Create pending order in Firestore
      const orderData: any = {
        orderNumber: nextOrderNumber,
        tableId,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Cliente',
        items: cart.map(item => {
          const menuItem = menu.find(m => m.id === item.productId);
          return {
            ...item,
            costPrice: menuItem?.costPrice || 0
          };
        }),
        originalSubtotal,
        promotionDiscount,
        subtotal,
        total,
        couponId: activeCoupon?.id || null,
        couponCode: activeCoupon?.code || null,
        couponDiscount,
        status: 'pending',
        paymentMethod: 'pix',
        paymentStatus: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isTest: isTestMode,
      };

      // Add attendant info if user is a waiter
      if (profile?.role === 'waiter') {
        orderData.attendantId = user.uid;
        orderData.attendantName = user.displayName || user.email?.split('@')[0] || 'Atendente';
        
        // If there's a user already at the table, keep their userId
        if (tableData?.currentUserId) {
          orderData.userId = tableData.currentUserId;
          orderData.userName = tableData.currentUserName || 'Cliente';
        }
      }
      
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = docRef.id;
      await logAction('create', 'orders', `Pedido #${nextOrderNumber}`);

      // Decrement stock for each item
      for (const item of cart) {
        const menuItem = menu.find(m => m.id === item.productId);
        if (menuItem && menuItem.stockQuantity !== undefined) {
          const itemRef = doc(db, 'menu', item.productId);
          await updateDoc(itemRef, {
            stockQuantity: increment(-item.quantity)
          });
        }
      }

      // Increment coupon usage if applicable
      if (activeCoupon) {
        await updateDoc(doc(db, 'coupons', activeCoupon.id), {
          usedCount: increment(1)
        });
      }
      setCurrentOrderId(orderId);
      console.log("Order created with ID:", orderId);

      // Update table with last order ID
      if (tableData) {
        await updateDoc(doc(db, 'tables', `table_${tableId}`), {
          lastOrderId: orderId
        });
      }

      // 3. Create payment in Mercado Pago via our backend
      if (total <= 0) {
        // 100% discount coupon, skip payment
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'paid',
          paymentStatus: 'paid',
          updatedAt: serverTimestamp(),
        });
        
        setCart([]);
        setActiveView('orders');
        setPaymentStep('success');
        showFeedback('success', "Pedido realizado com sucesso (Cupom de 100%)!");
        return;
      }

      console.log("Calling Mercado Pago API...");
      const response = await fetch('/api/v1/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: total,
          email: user?.email || 'cliente@praiaflow.com',
          description: `Pedido PraiaFlow #${nextOrderNumber}`
        }),
      });

      const data = await response.json();
      console.log("Mercado Pago response:", data);

      if (data.error) throw new Error(data.error);

      setPixData({
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
        paymentId: data.id
      });

      // 3. Listen for order updates (webhook will update status to 'paid')
      onSnapshot(doc(db, 'orders', orderId), async (snapshot) => {
        const updatedOrder = { id: snapshot.id, ...snapshot.data() } as Order;
        setActiveOrder(updatedOrder);
        
        if (updatedOrder.status === 'paid') {
          // Note: Table is now released manually by admin per user request
          setCart([]);
          setActiveView('orders');
          setPaymentStep('none');
          setPixData(null);
          setCurrentOrderId(null);
        }
      });

      setPaymentStep('pix');
    } catch (error) {
      console.error("Error placing order:", error);
      setPaymentStep('none');
      alert("Erro ao processar pedido: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    }
  };

  const simulatePayment = async (approved: boolean) => {
    if (!currentOrderId) return;
    
    try {
      if (approved) {
        await updateDoc(doc(db, 'orders', currentOrderId), {
          status: 'paid',
          paymentStatus: 'paid',
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'orders', currentOrderId), {
          status: 'cancelled',
          paymentStatus: 'failed',
          updatedAt: serverTimestamp(),
        });
        setPaymentStep('none');
        setPixData(null);
        setCurrentOrderId(null);
      }
    } catch (error) {
      console.error("Error simulating payment:", error);
    }
  };

  const copyPixCode = () => {
    if (pixData?.qrCode) {
      navigator.clipboard.writeText(pixData.qrCode);
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
    }
  };

  const callWaiter = async (type: 'waiter' | 'bill') => {
    if (!user || !tableId) {
      showFeedback('error', "Identificação da mesa não encontrada.");
      return;
    }
    try {
      await addDoc(collection(db, 'waiter_calls'), {
        tableId,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Cliente',
        type,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      showFeedback('success', type === 'waiter' ? "Garçom chamado! Em breve alguém virá até você." : "Pedido de conta enviado!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'waiter_calls');
      showFeedback('error', "Erro ao chamar garçom. Tente novamente.");
    }
  };

  const iconMap: Record<string, any> = {
    Beer, Pizza, Coffee, IceCream, Grape, Apple, Fish, Beef, Utensils,
    Soup, Cake, Wine, GlassWater, Sandwich, Cookie
  };

  const allCategories = [
    { id: 'all', name: t('all'), icon: Utensils },
    ...categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: iconMap[c.icon] || Utensils
    }))
  ];

  const filteredMenu = menu.filter(item => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (isTableLoading) {
    return (
      <div className="min-h-screen bg-sky-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (tableId && !tableData) {
    return (
      <div className="min-h-screen bg-sky-50 dark:bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-red-100 dark:border-red-900/20 space-y-6">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto">
            <AlertCircle size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mesa não encontrada</h1>
            <p className="text-gray-500 dark:text-slate-400">Esta mesa não existe em nosso sistema. Por favor, verifique o QR Code ou procure um funcionário.</p>
          </div>
          <button 
            onClick={() => handleLogout()}
            className="w-full py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} /> Sair
          </button>
        </div>
      </div>
    );
  }

  if (tableData && !tableData.active) {
    return (
      <div className="min-h-screen bg-sky-50 dark:bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-red-100 dark:border-red-900/20 space-y-6">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto">
            <XCircle size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mesa Inativa</h1>
            <p className="text-gray-500 dark:text-slate-400">Esta mesa não está disponível no momento. Por favor, procure um funcionário para assistência.</p>
          </div>
          <button 
            onClick={() => handleLogout()}
            className="w-full py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} /> Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-900 pb-24 font-sans transition-colors">
      {/* Header */}
      <header className="bg-sky-600 dark:bg-sky-700 text-white p-6 sticky top-0 z-30 shadow-lg">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-sky-400">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="User" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">{t('appName')}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sky-100 text-xs">{t('mesa')} {tableId} • {user.displayName?.split(' ')[0]}</p>
                {tableData?.reservedUntil && tableData.reservedUntil.toDate() > new Date() && (
                  <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                    <CountdownTimer 
                      targetDate={tableData.reservedUntil} 
                      className="text-amber-200 text-[10px]"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <button 
              onClick={() => navigate('/profile')}
              className="p-2 bg-sky-500/20 text-sky-100 rounded-full hover:bg-sky-500/40 transition-colors"
              title="Meu Perfil"
            >
              <User size={20} />
            </button>
            <button 
              onClick={() => handleLogout()}
              className="p-2 bg-red-500/20 text-red-100 rounded-full hover:bg-red-500/40 transition-colors"
              title={t('logout')}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {activeView === 'orders' ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('orderStatus')}</h2>
            
            {activeOrder ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border-2 border-sky-500/20 space-y-6"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg",
                    activeOrder.status === 'preparing' ? "bg-amber-500" : 
                    activeOrder.status === 'ready' ? "bg-green-500" : "bg-sky-500"
                  )}>
                    {activeOrder.status === 'preparing' ? <Clock size={40} className="animate-spin" /> : 
                     activeOrder.status === 'ready' ? <CheckCircle2 size={40} /> : <Clock size={40} />}
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Pedido #{activeOrder.orderNumber}</h3>
                    <p className="text-sky-600 dark:text-sky-400 font-bold uppercase tracking-widest text-sm mt-1">
                      {activeOrder.status === 'paid' ? t('paidWaiting') : 
                       activeOrder.status === 'preparing' ? t('preparing') : 
                       activeOrder.status === 'ready' ? t('ready') : 
                       activeOrder.status === 'delivered' ? t('delivered') : activeOrder.status}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t dark:border-slate-700">
                  {activeOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-slate-400">{item.quantity}x {item.name}</span>
                      <span className="font-bold text-gray-900 dark:text-white">R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-3 flex justify-between font-bold text-lg border-t dark:border-slate-700">
                    <span className="dark:text-white">{t('total')}</span>
                    <span className="text-sky-600 dark:text-sky-400">R$ {activeOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <Utensils size={32} />
                </div>
                <p className="text-gray-500 dark:text-slate-400 font-medium">Você não possui pedidos ativos no momento.</p>
                <button 
                  onClick={() => setActiveView('menu')}
                  className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                >
                  Ver Cardápio
                </button>
              </div>
            )}
          </div>
        ) : activeView === 'cart' ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('cart')}</h2>
            
            {cart.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <ShoppingCart size={32} />
                </div>
                <p className="text-gray-500 dark:text-slate-400 font-medium">{t('cartEmpty')}</p>
                <button 
                  onClick={() => setActiveView('menu')}
                  className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                >
                  Voltar ao Cardápio
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
                  {cart.map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className="flex justify-between items-center border-b dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Qtd: {item.quantity}</p>
                          <span className="text-sky-600 dark:text-sky-400 font-bold text-sm">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        {item.observations && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-1">"{item.observations}"</p>
                        )}
                      </div>
                      <button 
                        onClick={() => removeFromCart(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <Minus size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Código do cupom" 
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        disabled={!!activeCoupon}
                        className="w-full bg-gray-50 dark:bg-slate-700 border-none rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white text-sm"
                      />
                    </div>
                    {activeCoupon ? (
                      <button 
                        onClick={() => { setActiveCoupon(null); setCouponCode(''); }}
                        className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 transition-all"
                      >
                        <XCircle size={20} />
                      </button>
                    ) : (
                      <button 
                        onClick={applyCoupon}
                        className="px-4 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-all text-sm"
                      >
                        Aplicar
                      </button>
                    )}
                  </div>
                  {activeCoupon && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-bold bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                      <Check size={14} />
                      Cupom "{activeCoupon.code}" aplicado!
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-sm text-gray-500 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>R$ {originalSubtotal.toFixed(2)}</span>
                  </div>
                  {promotionDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm text-sky-600 dark:text-sky-400 font-bold">
                      <span>Desconto (Promoções)</span>
                      <span>- R$ {promotionDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {activeCoupon && (
                    <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400 font-bold">
                      <span>Desconto (Cupom)</span>
                      <span>- R$ {couponDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xl font-black pt-2 border-t dark:border-slate-700">
                    <span className="dark:text-white uppercase tracking-tight">{t('total')}</span>
                    <span className="text-sky-600 dark:text-sky-400">R$ {total.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={placeOrder}
                    disabled={paymentStep === 'processing' || total <= 0}
                    className={cn(
                      "w-full py-4 rounded-2xl text-lg font-bold shadow-lg transition-all mt-4 active:scale-[0.98]",
                      (paymentStep === 'processing' || total <= 0)
                        ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                        : "bg-sky-600 dark:bg-sky-500 text-white hover:bg-sky-700 dark:hover:bg-sky-400"
                    )}
                  >
                    {paymentStep === 'processing' ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{t('processing')}...</span>
                      </div>
                    ) : t('finishOrder')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Promotions Banner */}
            {promotions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                  <Tag size={20} />
                  <h2 className="text-lg font-black uppercase tracking-tight">Ofertas Especiais</h2>
                </div>
                  <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                    {promotions.map((promo) => (
                      <motion.div 
                        key={promo.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex-shrink-0 w-80 bg-white dark:bg-slate-800 rounded-3xl shadow-lg relative overflow-hidden group border border-gray-100 dark:border-slate-700"
                      >
                        {promo.imageUrl ? (
                          <div className="relative h-40 w-full overflow-hidden">
                            <img src={promo.imageUrl} alt={promo.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-4 left-4 right-4">
                              <h3 className="font-black text-lg leading-tight text-white">{promo.name}</h3>
                              <p className="text-white/80 text-[10px] mt-0.5 line-clamp-1">{promo.description}</p>
                            </div>
                            <div className="absolute top-4 right-4 bg-sky-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg">
                              {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `R$ ${promo.discountValue} OFF`}
                            </div>
                          </div>
                        ) : (
                          <div className="p-5 bg-gradient-to-br from-sky-500 to-sky-700 text-white h-40 flex flex-col justify-between">
                            <div>
                              <h3 className="font-black text-xl leading-tight">{promo.name}</h3>
                              <p className="text-sky-100 text-xs mt-1 line-clamp-2">{promo.description}</p>
                            </div>
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold w-fit">
                              <Check size={14} />
                              {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `R$ ${promo.discountValue} OFF`}
                            </div>
                            <Tag className="absolute -right-4 -bottom-4 text-white/10 w-24 h-24 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
              </div>
            )}

            {/* Search and Filter */}
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-sky-500 transition-all dark:text-white"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>

              <div className="relative flex items-center gap-2">
                <div 
                  ref={scrollRef}
                  className="flex-1 flex gap-3 overflow-x-auto pb-2 no-scrollbar pr-12"
                >
                  {allCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all font-bold text-sm",
                        category === cat.id 
                          ? "bg-sky-600 text-white shadow-md scale-105" 
                          : "bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-slate-700"
                      )}
                    >
                      <cat.icon size={16} />
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="absolute right-10 top-0 bottom-2 w-12 bg-gradient-to-l from-sky-50 dark:from-slate-900 to-transparent pointer-events-none" />
                <button 
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-gray-100 dark:border-slate-700"
                  title="Ver todas as categorias"
                >
                  <Filter size={20} />
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="grid gap-4">
              {filteredMenu.length > 0 ? (
                filteredMenu.map((item) => (
                  <motion.div
                    layout
                    key={item.id}
                    className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm flex h-36 hover:shadow-md transition-all border border-transparent dark:border-slate-700 group active:scale-[0.98]"
                  >
                    <div className="w-36 h-full overflow-hidden">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight text-lg">{item.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mt-1">{item.description}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          {getDiscountedPrice(item) < item.price ? (
                            <>
                              <span className="text-gray-400 line-through text-xs">R$ {item.price.toFixed(2)}</span>
                              <span className="text-sky-600 dark:text-sky-400 font-black text-lg">R$ {getDiscountedPrice(item).toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="text-sky-600 dark:text-sky-400 font-black text-lg">R$ {item.price.toFixed(2)}</span>
                          )}
                        </div>
                        <button 
                          onClick={() => addToCart(item)}
                          className="bg-sky-600 dark:bg-sky-500 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-sky-700 dark:hover:bg-sky-400 transition-all shadow-sm"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-slate-400">Nenhum item encontrado.</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button 
                onClick={() => callWaiter('waiter')}
                className="flex flex-col items-center justify-center gap-2 p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-sky-500 transition-all group"
              >
                <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                  <Bell size={24} />
                </div>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Chamar Garçom</span>
              </button>
              <button 
                onClick={() => callWaiter('bill')}
                className="flex flex-col items-center justify-center gap-2 p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-amber-500 transition-all group"
              >
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <Receipt size={24} />
                </div>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Pedir Conta</span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-gray-100 dark:border-slate-800 px-6 py-4 z-40 pb-safe">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          <button 
            onClick={() => setActiveView('menu')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeView === 'menu' ? "text-sky-600 dark:text-sky-400 scale-110" : "text-gray-400"
            )}
          >
            <MenuIcon size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('menu')}</span>
          </button>
          
          <button 
            onClick={() => setActiveView('orders')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all relative",
              activeView === 'orders' ? "text-sky-600 dark:text-sky-400 scale-110" : "text-gray-400"
            )}
          >
            <Clock size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('orders')}</span>
            {activeOrder && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-sky-500 rounded-full animate-ping" />
            )}
          </button>

          <button 
            onClick={() => setActiveView('cart')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all relative",
              activeView === 'cart' ? "text-sky-600 dark:text-sky-400 scale-110" : "text-gray-400"
            )}
          >
            <ShoppingCart size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('cart')}</span>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category Grid Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('categories')}</h2>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id);
                      setIsCategoryModalOpen(false);
                    }}
                    className={cn(
                      "p-4 rounded-3xl border-2 transition-all flex flex-col items-center text-center gap-3 active:scale-95",
                      category === cat.id 
                        ? "bg-sky-50 dark:bg-sky-900/20 border-sky-500" 
                        : "bg-gray-50 dark:bg-slate-700/50 border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                      category === cat.id ? "bg-sky-500 text-white" : "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400"
                    )}>
                      <cat.icon size={24} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{cat.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
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
                  <h2 className="text-2xl font-bold dark:text-white">{t('paymentPix')}</h2>
                  
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
                      {t('pixDescription')} <span className="font-bold text-gray-900 dark:text-white">R$ {total.toFixed(2)}</span>
                    </p>
                    
                    <button 
                      onClick={copyPixCode}
                      className="w-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
                    >
                      {isCopying ? <Check size={18} className="text-green-500" /> : <List size={18} />}
                      {isCopying ? 'Copiado!' : 'Copiar Código PIX'}
                    </button>
                  </div>

                  <div className="w-full pt-4 border-t border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 text-sky-600 dark:text-sky-400 justify-center">
                      <Clock size={18} className="animate-pulse" />
                      <span className="text-sm font-medium">Aguardando pagamento...</span>
                    </div>
                  </div>

                  <button onClick={() => setPaymentStep('none')} className="text-gray-400 dark:text-slate-500 font-medium hover:text-gray-600">{t('cancel')}</button>
                </>
              ) : (
                <div className="py-12 space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
                  <p className="font-bold text-gray-900 dark:text-white">{t('processingOrder')}</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white">{selectedItem.name}</h2>
                  <p className="text-sky-600 dark:text-sky-400 font-bold text-lg">R$ {selectedItem.price.toFixed(2)}</p>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-3">{t('quantity')}</label>
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setItemQuantity(q => Math.max(1, q - 1))}
                      className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-200 transition-colors"
                    >
                      <Minus size={20} />
                    </button>
                    <span className="text-2xl font-black dark:text-white w-8 text-center">{itemQuantity}</span>
                    <button 
                      onClick={() => setItemQuantity(q => q + 1)}
                      className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">{t('observations')}</label>
                  <textarea 
                    value={itemObservations}
                    onChange={e => setItemObservations(e.target.value)}
                    placeholder={t('addNote')}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none dark:text-white min-h-[100px] resize-none"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    onClick={confirmAddToCart}
                    className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-sky-700 shadow-lg shadow-sky-200 dark:shadow-none transition-all flex justify-between px-8"
                  >
                    <span>{t('confirm')}</span>
                    <span>R$ {(selectedItem.price * itemQuantity).toFixed(2)}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout Error Modal */}
      <AnimatePresence>
        {logoutError && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl text-center space-y-8"
            >
              <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto">
                <AlertCircle size={56} />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ação Bloqueada</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {logoutError}
                </p>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={() => setLogoutError(null)}
                  className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
                >
                  Entendido
                </button>
                <button 
                  onClick={() => handleLogout(true)}
                  className="w-full py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold uppercase tracking-widest hover:bg-red-100 transition-all text-xs"
                >
                  Sair e Liberar Mesa Mesmo Assim
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Feedback Modal */}
      <AnimatePresence>
        {feedback && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4">
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className={cn(
                "p-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
                feedback.type === 'success' 
                  ? "bg-green-50/90 border-green-100 text-green-800 dark:bg-green-900/80 dark:border-green-800 dark:text-green-200" 
                  : "bg-red-50/90 border-red-100 text-red-800 dark:bg-red-900/80 dark:border-red-800 dark:text-red-200"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                feedback.type === 'success' ? "bg-green-100 dark:bg-green-800" : "bg-red-100 dark:bg-red-800"
              )}>
                {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold leading-tight">{feedback.message}</p>
              </div>
              <button onClick={() => setFeedback(null)} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
                <XCircle size={18} className="opacity-50" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
