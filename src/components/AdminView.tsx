import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, updateDoc, doc, orderBy, limit, addDoc, deleteDoc, serverTimestamp, setDoc, getDocs, where, getDoc } from 'firebase/firestore';
import { Order, MenuItem, Table, Category, AuditLog, Promotion, Coupon, ReservationSettings, UserProfile, SystemAccess } from '../types';
import { globalSignOut } from '../lib/authUtils';
import { logAction } from '../lib/firebase';
import { LayoutDashboard, ShoppingBag, ShoppingCart, ChevronRight, UtensilsCrossed, Settings, LogOut, CheckCircle, Clock, XCircle, AlertCircle, Play, Check, Truck, Plus, Trash2, Edit2, List, Beer, Pizza, Coffee, IceCream, Grape, Apple, Fish, Beef, Utensils, Menu, History, Soup, Cake, Wine, GlassWater, Sandwich, Cookie, Tag, Ticket, Sparkles, Search, Map as MapIcon, Calendar, QrCode, TrendingUp, Package, Bell, Receipt, User, RotateCcw, ShieldCheck, ChefHat, Code, Save, UserPlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../lib/LanguageContext';
import { getTableStatusFlags, canReleaseTable } from '../lib/business';
import { validateMenuItem, validateCategory } from '../lib/validation';
import { GoogleGenAI } from "@google/genai";
import { trackGeminiUsage } from '../lib/geminiTracker';
import CountdownTimer from './CountdownTimer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AdminViewProps {
  user: any;
  profile: UserProfile | null;
  onImpersonate?: (role: 'admin' | 'waiter' | 'staff' | 'client' | null) => void;
  impersonatedRole?: 'admin' | 'waiter' | 'staff' | 'client' | null;
}

export default function AdminView({ user: propUser, profile: propProfile }: AdminViewProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(propUser);
  const [profile, setProfile] = useState<UserProfile | null>(propProfile);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'menu' | 'categories' | 'tables' | 'history' | 'logs' | 'promotions' | 'coupons' | 'users'>('home');
  const [systemAccess, setSystemAccess] = useState<SystemAccess>({
    client: true,
    waiter: true,
    staff: true,
    admin: true,
    root: true
  });
  const [orderFilter, setOrderFilter] = useState<string>('');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [adminMenuCategory, setAdminMenuCategory] = useState<string>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  const [isForcedReleaseModalOpen, setIsForcedReleaseModalOpen] = useState(false);
  const [forcedReleaseTableId, setForcedReleaseTableId] = useState<string | null>(null);
  const [forcedReleaseTableNumber, setForcedReleaseTableNumber] = useState<number | null>(null);
  const [forcedReleaseObservation, setForcedReleaseObservation] = useState('');
  const [tableCountInput, setTableCountInput] = useState<string>('');
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isPrintAllModalOpen, setIsPrintAllModalOpen] = useState(false);
  const [qrTableNumber, setQrTableNumber] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [reservationSettings, setReservationSettings] = useState<ReservationSettings>({
    cost: 10,
    durationMinutes: 60,
    enabled: true
  });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
        isAnonymous: user?.isAnonymous,
        tenantId: user?.tenantId,
        providerInfo: user?.providerData?.map((provider: any) => ({
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
    throw new Error(JSON.stringify(errInfo));
  };
  
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'reservation'), (snapshot) => {
      if (snapshot.exists()) {
        setReservationSettings(snapshot.data() as ReservationSettings);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'system_access'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemAccess(snapshot.data() as SystemAccess);
      } else {
        // Initialize with defaults if not exists
        setDoc(doc(db, 'settings', 'system_access'), {
          client: true,
          waiter: true,
          staff: true,
          admin: true,
          root: true
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const { t } = useLanguage();

  // Auto-release expired reservations
  useEffect(() => {
    const checkExpiredReservations = async () => {
      const now = new Date();
      const expiredTables = tables.filter(t => 
        t.reservedUntil && 
        t.reservedUntil.toDate() < now && 
        !t.currentUserId // Only release if not actually occupied
      );

      for (const table of expiredTables) {
        try {
          await updateDoc(doc(db, 'tables', table.id), {
            reservedUntil: null,
            reservedBy: null,
            reservedByName: null
          });

          // Add audit log
          await addDoc(collection(db, 'auditLogs'), {
            action: 'update',
            entityType: 'tables',
            entityId: table.id,
            entityName: `Mesa ${table.number}`,
            details: 'Reserva expirada automaticamente',
            userEmail: 'SYSTEM',
            userId: 'SYSTEM',
            timestamp: serverTimestamp()
          });
        } catch (err) {
          console.error("Error auto-releasing table:", err);
        }
      }
    };

    const interval = setInterval(checkExpiredReservations, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [tables]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      console.error("Error in categories snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      console.error("Error in orders snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'menu'), (snapshot) => {
      setMenu(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    }, (error) => {
      console.error("Error in menu snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'promotions'), (snapshot) => {
      setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)));
    }, (error) => {
      console.error("Error in promotions snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon)));
    }, (error) => {
      console.error("Error in coupons snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const tableMap = new Map<number, Table>();
      const duplicatesToDelete: string[] = [];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Table;
        const tableNumber = data.number;
        if (!tableNumber) return;

        const existing = tableMap.get(tableNumber);
        const standardId = `table_${tableNumber}`;

        if (!existing) {
          tableMap.set(tableNumber, { id: docSnap.id, ...data } as Table);
        } else {
          // We found a duplicate. Decide which one to keep and mark the other for deletion.
          if (docSnap.id === standardId) {
            // Keep the standard ID, delete the other one
            duplicatesToDelete.push(existing.id);
            tableMap.set(tableNumber, { id: docSnap.id, ...data } as Table);
          } else if (existing.id === standardId) {
            // Keep the existing standard ID, delete this one
            duplicatesToDelete.push(docSnap.id);
          } else {
            // Neither is standard, keep the occupied one or just the first one
            if (data.currentUserId && !existing.currentUserId) {
              duplicatesToDelete.push(existing.id);
              tableMap.set(tableNumber, { id: docSnap.id, ...data } as Table);
            } else {
              duplicatesToDelete.push(docSnap.id);
            }
          }
        }
      });

      // Perform cleanup of duplicates in the background
      duplicatesToDelete.forEach(id => {
        if (!id.startsWith('table_')) { // Only delete auto-generated IDs
          deleteDoc(doc(db, 'tables', id)).catch(err => console.error("Error cleaning up duplicate table:", err));
        }
      });

      setTables(Array.from(tableMap.values()).sort((a, b) => a.number - b.number));
    }, (error) => {
      console.error("Error in tables snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }, (error) => {
      console.error("Error in audit_logs snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      console.error("Error in users snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  const [newUser, setNewUser] = useState({ email: '', displayName: '', password: '', role: 'client' as UserProfile['role'] });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password) {
      showFeedback('error', "Email e senha são obrigatórios.");
      return;
    }

    if (newUser.password.length < 6) {
      showFeedback('error', "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    
    setIsCreatingUser(true);
    try {
      const response = await fetch('/api/v1/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Erro do servidor: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Erro ao criar usuário');
      }

      await createAuditLog('create', 'users', data.uid, newUser.displayName || newUser.email, `Novo usuário criado via API com papel ${newUser.role}`);
      showFeedback('success', `Usuário ${newUser.displayName || newUser.email} criado com sucesso!`);
      setNewUser({ email: '', displayName: '', password: '', role: 'client' });
    } catch (error: any) {
      console.error("Error creating user:", error);
      showFeedback('error', error.message || "Erro ao criar usuário.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const updateUserRole = async (profileId: string, newRole: UserProfile['role']) => {
    try {
      const userSnap = await getDoc(doc(db, 'users', profileId));
      if (!userSnap.exists()) return;
      
      const userData = userSnap.data() as UserProfile;
      const oldRole = userData.role;
      
      if (oldRole === newRole) return;

      const newProfileId = `${userData.uid}_${newRole}`;
      const newProfileData = {
        ...userData,
        role: newRole,
        updatedAt: serverTimestamp()
      };

      // Create new profile document
      await setDoc(doc(db, 'users', newProfileId), newProfileData);
      
      // Delete old profile document if it was a composite ID or if we want to migrate
      if (profileId !== userData.uid) {
        await deleteDoc(doc(db, 'users', profileId));
      }

      showFeedback('success', `Papel alterado de ${oldRole} para ${newRole}`);
      await createAuditLog('update', 'users' as any, userData.uid, userData.uid, `Papel alterado para ${newRole}`);
    } catch (error) {
      console.error("Error updating user role:", error);
      showFeedback('error', "Erro ao atualizar permissão.");
    }
  };

  const releaseTable = async (tableId: string, tableNumber: number, observation?: string) => {
    const tableOrders = orders.filter(o => o.tableId === tableNumber.toString() && o.status !== 'cancelled');
    const allDelivered = tableOrders.length > 0 && tableOrders.every(o => o.status === 'delivered');
    
    if (!observation && tableOrders.length > 0 && !allDelivered) {
      showFeedback('error', "A mesa só pode ser liberada quando todos os pedidos estiverem entregues.");
      return;
    }

    try {
      await updateDoc(doc(db, 'tables', tableId), {
        currentUserId: null,
        currentUserName: null,
        currentCart: null,
        lastOrderId: null
      });
      
      await createAuditLog(
        'update', 
        'tables', 
        tableId, 
        `Mesa ${tableNumber}`, 
        observation ? `Liberação Forçada: ${observation}` : 'Liberação Normal'
      );
      
      showFeedback('success', `Mesa ${tableNumber} liberada com sucesso!`);
      setIsForcedReleaseModalOpen(false);
      setForcedReleaseObservation('');
      setForcedReleaseTableNumber(null);
      setForcedReleaseTableId(null);
    } catch (error) {
      console.error("Error releasing table:", error);
      showFeedback('error', "Erro ao liberar mesa.");
    }
  };

  const handleAddTable = async () => {
    const nextNumber = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1;
    const tableId = `table_${nextNumber}`;
    
    try {
      await setDoc(doc(db, 'tables', tableId), {
        number: nextNumber,
        active: true,
        currentUserId: null,
        currentUserName: null,
        currentCart: null,
        lastOrderId: null
      });
      
      await createAuditLog('create', 'tables', tableId, `Mesa ${nextNumber}`, 'Nova mesa adicionada');
      showFeedback('success', `Mesa ${nextNumber} adicionada com sucesso!`);
    } catch (error) {
      console.error("Error adding table:", error);
      showFeedback('error', "Erro ao adicionar mesa.");
    }
  };

  const handleSetTableCount = async () => {
    const newCount = parseInt(tableCountInput);
    if (isNaN(newCount) || newCount < 0 || newCount > 100) {
      showFeedback('error', "Por favor, insira um número válido entre 0 e 100.");
      return;
    }

    try {
      const currentMax = tables.length > 0 ? Math.max(...tables.map(t => t.number)) : 0;

      if (newCount > currentMax) {
        // Add missing tables
        for (let i = currentMax + 1; i <= newCount; i++) {
          const tableId = `table_${i}`;
          await setDoc(doc(db, 'tables', tableId), {
            number: i,
            active: true,
            currentUserId: null,
            currentUserName: null,
            currentCart: null,
            lastOrderId: null
          });
        }
        await createAuditLog('create', 'tables', 'multiple', `Definido total de ${newCount} mesas`);
        showFeedback('success', `${newCount - currentMax} mesas adicionadas com sucesso!`);
      } else if (newCount < currentMax) {
        // Remove tables from the end, but only if not occupied
        const tablesToRemove = tables.filter(t => t.number > newCount).sort((a, b) => b.number - a.number);
        let removedCount = 0;
        let skippedCount = 0;

        for (const table of tablesToRemove) {
          if (!table.currentUserId) {
            await deleteDoc(doc(db, 'tables', table.id));
            removedCount++;
          } else {
            skippedCount++;
          }
        }

        if (skippedCount > 0) {
          showFeedback('error', `${skippedCount} mesas não puderam ser removidas pois estão ocupadas.`);
        } else {
          showFeedback('success', `${removedCount} mesas removidas com sucesso!`);
        }

        await createAuditLog('delete', 'tables', 'multiple', `Reduzido total de mesas para ${newCount}`);
      }
      setTableCountInput('');
    } catch (error) {
      console.error("Error setting table count:", error);
      showFeedback('error', "Erro ao definir o número de mesas.");
    }
  };

  const handlePrintAllQRCodes = () => {
    const activeTables = tables.filter(t => t.active).sort((a, b) => a.number - b.number);
    if (activeTables.length === 0) {
      showFeedback('error', "Nenhuma mesa ativa encontrada para imprimir.");
      return;
    }
    setIsPrintAllModalOpen(true);
  };

  const executePrintAll = () => {
    const activeTables = tables.filter(t => t.active).sort((a, b) => a.number - b.number);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const stickersHtml = activeTables.map(table => {
        const qrElement = document.getElementById(`qr-print-all-${table.number}`);
        const svgHtml = qrElement?.querySelector('svg')?.outerHTML || '';
        return `
          <div class="container">
            <div class="qr-wrapper">
              ${svgHtml}
              <div class="number-overlay">${table.number}</div>
            </div>
            <div class="brand">PRAIA FLOW</div>
            <div class="table-label">Mesa ${table.number}</div>
          </div>
        `;
      }).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>QR Codes - Todas as Mesas</title>
            <style>
              body { 
                display: flex; 
                flex-wrap: wrap;
                gap: 20px;
                padding: 20px;
                justify-content: center;
                font-family: sans-serif;
              }
              .container {
                padding: 30px;
                border: 1px solid #eee;
                border-radius: 30px;
                text-align: center;
                page-break-inside: avoid;
                width: 260px;
              }
              .qr-wrapper {
                position: relative;
                display: inline-block;
              }
              .number-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                border: 3px solid black;
                font-weight: 900;
                font-size: 28px;
                color: black;
              }
              .brand {
                margin-top: 15px;
                font-size: 22px;
                font-weight: 900;
                letter-spacing: -1px;
              }
              .table-label {
                font-size: 10px;
                font-weight: 700;
                color: #94a3b8;
                letter-spacing: 3px;
                text-transform: uppercase;
              }
              @media print {
                body { padding: 0; }
                .container { border: 1px solid #ddd; margin-bottom: 20px; }
              }
            </style>
          </head>
          <body>
            ${stickersHtml}
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const toggleTableStatus = async (id: string, active: boolean) => {
    const table = tables.find(t => t.id === id);
    if (!active && table?.currentUserId) {
      showFeedback('error', "Não é possível desativar uma mesa ocupada.");
      return;
    }

    try {
      await updateDoc(doc(db, 'tables', id), { active });
      await createAuditLog('update', 'tables', id, `Mesa ${table?.number || id}`, active ? 'Ativada' : 'Desativada');
      showFeedback('success', `Mesa ${table?.number} ${active ? 'ativada' : 'desativada'} com sucesso!`);
    } catch (error) {
      console.error("Error toggling table status:", error);
      showFeedback('error', "Erro ao alterar status da mesa.");
    }
  };

  const openConfirmModal = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const handleDeleteTable = async (id: string, number: number) => {
    const table = tables.find(t => t.id === id);
    if (table?.currentUserId) {
      showFeedback('error', "Não é possível excluir uma mesa ocupada.");
      return;
    }
    
    openConfirmModal(
      "Excluir Mesa",
      `Tem certeza que deseja excluir a mesa ${number}?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'tables', id));
          await createAuditLog('delete', 'tables', id, `Mesa ${number}`, 'Mesa removida do sistema');
          showFeedback('success', `Mesa ${number} excluída com sucesso!`);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `tables/${id}`);
          showFeedback('error', "Erro ao excluir mesa.");
        }
      }
    );
  };

  const toggleAvailability = async (itemId: string, available: boolean) => {
    try {
      await updateDoc(doc(db, 'menu', itemId), { available });
      const item = menu.find(i => i.id === itemId);
      await createAuditLog('update', 'menu', itemId, item?.name || '', available ? 'Disponível' : 'Indisponível');
      showFeedback('success', `Item "${item?.name}" agora está ${available ? 'disponível' : 'indisponível'}.`);
    } catch (error) {
      console.error("Error toggling availability:", error);
      showFeedback('error', "Erro ao alterar disponibilidade.");
    }
  };

  const DEFAULT_MENU_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop';

  const createAuditLog = async (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, entityName: string, details?: string) => {
    if (!user) return;

    await addDoc(collection(db, 'audit_logs'), {
      action,
      entityType,
      entityId,
      entityName,
      userEmail: user.email,
      userId: user.uid,
      timestamp: serverTimestamp(),
      details: details || null,
    });
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const compressImage = async (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      if (base64.length > 1024 * 1024) { // If larger than 1MB, compress
        const compressed = await compressImage(base64);
        setEditingItem(prev => ({ ...prev, imageUrl: compressed }));
      } else {
        setEditingItem(prev => ({ ...prev, imageUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async () => {
    if (!editingItem?.name) {
      showFeedback('error', "Por favor, insira o nome do item primeiro.");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const promptText = `A professional, appetizing food photography of ${editingItem.name}. ${editingItem.description || ''}. High resolution, studio lighting, white background or elegant restaurant setting.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: promptText }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          }
        }
      });

      const usage = response.usageMetadata;
      if (usage) {
        trackGeminiUsage('gemini-2.5-flash-image', usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
      } else {
        // Fallback for image generation if metadata is missing
        trackGeminiUsage('gemini-2.5-flash-image', 100, 1000); 
      }

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const fullBase64 = `data:image/png;base64,${base64Data}`;
          
          // Always compress generated images to ensure they fit in Firestore
          const compressed = await compressImage(fullBase64, 800, 800, 0.6);
          setEditingItem(prev => ({ ...prev, imageUrl: compressed }));
          break;
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
      showFeedback('error', "Erro ao gerar imagem. Tente novamente.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    const validation = validateMenuItem(editingItem as any);
    if (!validation.isValid) {
      showFeedback('error', Object.values(validation.errors).join('\n'));
      return;
    }
    
    try {
      const { id, ...dataWithoutId } = editingItem;
      const itemToSave = {
        ...dataWithoutId,
        imageUrl: editingItem.imageUrl || DEFAULT_MENU_IMAGE,
        costPrice: Number(editingItem.costPrice) || 0,
        stockQuantity: Number(editingItem.stockQuantity) || 0,
        minStockAlert: Number(editingItem.minStockAlert) || 0,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email
      };

      if (id) {
        const oldItem = menu.find(i => i.id === id);
        const changes: string[] = [];
        if (oldItem) {
          if (oldItem.name !== editingItem.name) changes.push(`Nome: ${oldItem.name} -> ${editingItem.name}`);
          if (oldItem.price !== editingItem.price) changes.push(`Preço: ${oldItem.price} -> ${editingItem.price}`);
          if (oldItem.category !== editingItem.category) changes.push(`Categoria: ${oldItem.category} -> ${editingItem.category}`);
          if (oldItem.description !== editingItem.description) changes.push('Descrição alterada');
          if (oldItem.imageUrl !== editingItem.imageUrl) changes.push('Imagem alterada');
        }
        await updateDoc(doc(db, 'menu', id), itemToSave);
        await createAuditLog('update', 'menu', id, editingItem.name || '', changes.join(', '));
        showFeedback('success', `Item "${editingItem.name}" atualizado com sucesso!`);
      } else {
        const docRef = await addDoc(collection(db, 'menu'), { 
          ...itemToSave, 
          available: true, 
          createdAt: serverTimestamp(),
          createdBy: user?.email
        });
        await createAuditLog('create', 'menu', docRef.id, editingItem.name || '', 'Novo item adicionado ao cardápio');
        showFeedback('success', `Item "${editingItem.name}" criado com sucesso!`);
      }
      setIsMenuModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving menu item:", error);
      showFeedback('error', "Erro ao salvar o item. Tente novamente.");
    }
  };

  const handleDeleteMenu = async (id: string) => {
    const item = menu.find(i => i.id === id);
    openConfirmModal(
      "Excluir Item",
      `Tem certeza que deseja excluir "${item?.name}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'menu', id));
          await createAuditLog('delete', 'menu', id, item?.name || '', 'Item removido do cardápio');
          showFeedback('success', `Item "${item?.name}" excluído com sucesso!`);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `menu/${id}`);
          showFeedback('error', "Erro ao excluir o item.");
        }
      }
    );
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    
    const validation = validateCategory(editingCategory as any);
    if (!validation.isValid) {
      showFeedback('error', Object.values(validation.errors).join('\n'));
      return;
    }
    
    try {
      const { id, ...categoryDataWithoutId } = editingCategory;
      const categoryData = {
        name: editingCategory.name,
        description: editingCategory.description,
        icon: editingCategory.icon,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email
      };

      if (id) {
        const oldCategory = categories.find(c => c.id === id);
        const changes: string[] = [];
        if (oldCategory) {
          if (oldCategory.name !== editingCategory.name) changes.push(`Nome: ${oldCategory.name} -> ${editingCategory.name}`);
          if (oldCategory.description !== editingCategory.description) changes.push('Descrição alterada');
          if (oldCategory.icon !== editingCategory.icon) changes.push(`Ícone: ${oldCategory.icon} -> ${editingCategory.icon}`);
        }
        await updateDoc(doc(db, 'categories', id), categoryData);
        await createAuditLog('update', 'categories', id, editingCategory.name || '', changes.join(', '));
        showFeedback('success', `Categoria "${editingCategory.name}" atualizada com sucesso!`);
      } else {
        const docRef = await addDoc(collection(db, 'categories'), {
          ...categoryData,
          createdAt: serverTimestamp(),
          createdBy: user?.email
        });
        await createAuditLog('create', 'categories', docRef.id, editingCategory.name || '', 'Nova categoria criada');
        showFeedback('success', `Categoria "${editingCategory.name}" criada com sucesso!`);
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      console.error("Error saving category:", error);
      showFeedback('error', "Erro ao salvar a categoria.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const category = categories.find(c => c.id === id);
    openConfirmModal(
      "Excluir Categoria",
      `Tem certeza que deseja excluir a categoria "${category?.name}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'categories', id));
          await createAuditLog('delete', 'categories', id, category?.name || '', 'Categoria removida');
          showFeedback('success', `Categoria "${category?.name}" excluída com sucesso!`);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
          showFeedback('error', "Erro ao excluir categoria.");
        }
      }
    );
  };

  const generateAIBanner = async () => {
    if (!editingPromo?.name) {
      showFeedback('error', "Por favor, insira o nome da promoção primeiro.");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const promptText = `Crie um banner promocional vibrante e profissional para um restaurante chamado PraiaFlow. O tema da promoção é: "${editingPromo.name}". A descrição é: "${editingPromo.description || ''}". O banner deve ser atraente, com cores tropicais e comida deliciosa.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: promptText,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });

      const usage = response.usageMetadata;
      if (usage) {
        trackGeminiUsage('gemini-2.5-flash-image', usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
      } else {
        trackGeminiUsage('gemini-2.5-flash-image', 100, 1000);
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const rawImageUrl = `data:image/png;base64,${base64EncodeString}`;
          
          // Resize image before setting it to state to avoid Firestore 1MB limit
          // Using lower quality (0.5) to ensure it fits within 1MB
          const resizedImageUrl = await compressImage(rawImageUrl, 800, 450, 0.5);
          setEditingPromo(prev => ({ ...prev, imageUrl: resizedImageUrl }));
          
          showFeedback('success', "Banner gerado com sucesso!");
          break;
        }
      }
    } catch (error) {
      console.error("Error generating banner:", error);
      showFeedback('error', "Erro ao gerar banner com IA.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSavePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo) return;
    
    try {
      const promoData = {
        name: editingPromo.name || '',
        description: editingPromo.description || '',
        discountType: editingPromo.discountType || 'percentage',
        discountValue: Number(editingPromo.discountValue) || 0,
        targetType: editingPromo.targetType || 'all',
        targetId: (editingPromo.targetType === 'all') ? null : (editingPromo.targetId || null),
        imageUrl: editingPromo.imageUrl || null,
        active: editingPromo.active ?? true,
        updatedAt: serverTimestamp(),
      };

      if (editingPromo.id) {
        await updateDoc(doc(db, 'promotions', editingPromo.id), promoData);
        await createAuditLog('update', 'promotions', editingPromo.id, promoData.name, 'Promoção atualizada');
        showFeedback('success', "Promoção atualizada!");
      } else {
        const docRef = await addDoc(collection(db, 'promotions'), {
          ...promoData,
          createdAt: serverTimestamp(),
        });
        await createAuditLog('create', 'promotions', docRef.id, promoData.name, 'Promoção criada');
        showFeedback('success', "Promoção criada!");
      }
      setIsPromoModalOpen(false);
      setEditingPromo(null);
    } catch (error) {
      console.error("Error saving promotion:", error);
      showFeedback('error', "Erro ao salvar promoção. Verifique se a imagem não é muito grande.");
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    
    try {
      const couponData = {
        code: (editingCoupon.code || '').toUpperCase(),
        description: editingCoupon.description || '',
        discountType: editingCoupon.discountType || 'percentage',
        discountValue: Number(editingCoupon.discountValue) || 0,
        minPurchase: Number(editingCoupon.minPurchase) || 0,
        usageLimit: editingCoupon.usageLimit ? Number(editingCoupon.usageLimit) : null,
        active: editingCoupon.active ?? true,
        updatedAt: serverTimestamp(),
      };

      if (editingCoupon.id) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), couponData);
        await createAuditLog('update', 'coupons', editingCoupon.id, couponData.code, 'Cupom atualizado');
        showFeedback('success', "Cupom atualizado!");
      } else {
        const docRef = await addDoc(collection(db, 'coupons'), {
          ...couponData,
          usedCount: 0,
          createdAt: serverTimestamp(),
        });
        await createAuditLog('create', 'coupons', docRef.id, couponData.code, 'Cupom criado');
        showFeedback('success', "Cupom criado!");
      }
      setIsCouponModalOpen(false);
      setEditingCoupon(null);
    } catch (error) {
      console.error("Error saving coupon:", error);
      showFeedback('error', "Erro ao salvar cupom.");
    }
  };

  const handleDeletePromotion = async (id: string) => {
    const promo = promotions.find(p => p.id === id);
    openConfirmModal(
      "Excluir Promoção",
      `Excluir esta promoção "${promo?.name}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'promotions', id));
          await createAuditLog('delete', 'promotions', id, promo?.name || '', 'Promoção removida');
          showFeedback('success', "Promoção excluída.");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `promotions/${id}`);
          showFeedback('error', "Erro ao excluir.");
        }
      }
    );
  };

  const handleDeleteCoupon = async (id: string) => {
    const coupon = coupons.find(c => c.id === id);
    openConfirmModal(
      "Excluir Cupom",
      `Excluir este cupom "${coupon?.code}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'coupons', id));
          await createAuditLog('delete', 'coupons', id, coupon?.code || '', 'Cupom removido');
          showFeedback('success', "Cupom excluído.");
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `coupons/${id}`);
          showFeedback('error', "Erro ao excluir.");
        }
      }
    );
  };

  const categoryIcons = [
    { id: 'Beer', icon: Beer },
    { id: 'Pizza', icon: Pizza },
    { id: 'Coffee', icon: Coffee },
    { id: 'IceCream', icon: IceCream },
    { id: 'Grape', icon: Grape },
    { id: 'Apple', icon: Apple },
    { id: 'Fish', icon: Fish },
    { id: 'Beef', icon: Beef },
    { id: 'Soup', icon: Soup },
    { id: 'Cake', icon: Cake },
    { id: 'Wine', icon: Wine },
    { id: 'GlassWater', icon: GlassWater },
    { id: 'Sandwich', icon: Sandwich },
    { id: 'Cookie', icon: Cookie },
    { id: 'Utensils', icon: Utensils },
  ];

  const stats = {
    totalRevenue: orders.filter(o => o.status !== 'cancelled').reduce((acc, o) => acc + o.total, 0),
    totalProfit: orders.filter(o => o.status !== 'cancelled').reduce((acc, o) => {
      const orderCost = o.items.reduce((itemAcc, item) => itemAcc + ((item.costPrice || 0) * item.quantity), 0);
      return acc + (o.total - orderCost);
    }, 0),
    pendingOrders: orders.filter(o => o.status === 'paid').length,
    preparingOrders: orders.filter(o => o.status === 'preparing').length,
    lowStockCount: menu.filter(item => item.stockQuantity !== undefined && item.stockQuantity <= (item.minStockAlert || 5)).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex transition-colors relative">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-40 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold text-sky-600 dark:text-sky-400">{t('appName')}</h1>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col z-50 transition-transform duration-300 transform",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <h1 className="text-2xl font-bold text-sky-600 dark:text-sky-400">{t('appName')}</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t('adminPanel')}</p>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'home' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <LayoutDashboard size={20} /> Início
          </button>
          <button 
            onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'orders' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <ShoppingBag size={20} /> {t('orders')}
          </button>
          <button 
            onClick={() => { setActiveTab('categories'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'categories' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <List size={20} /> {t('categories')}
          </button>
          <button 
            onClick={() => { setActiveTab('menu'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'menu' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <UtensilsCrossed size={20} /> {t('menu')}
          </button>
          <button 
            onClick={() => { setActiveTab('tables'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'tables' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <Settings size={20} /> {t('tables')}
          </button>
          <button 
            onClick={() => { setActiveTab('promotions'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'promotions' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <Tag size={20} /> Promoções
          </button>
          <button 
            onClick={() => { setActiveTab('coupons'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'coupons' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <Ticket size={20} /> Cupons
          </button>
          <button 
            onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'history' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <Clock size={20} /> {t('history')}
          </button>
          <button 
            onClick={() => { setActiveTab('logs'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'logs' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <History size={20} /> Auditoria
          </button>
          <button 
            onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === 'users' ? "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <User size={20} /> Usuários
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between px-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <button 
            onClick={async () => {
              await globalSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
          >
            <LogOut size={20} /> {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto pt-20 lg:pt-8">
        {activeTab === 'home' && (
          <div className="space-y-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Bem-vindo, Administrador</h2>
              <p className="text-gray-500 dark:text-slate-400">Gerencie todas as funcionalidades do seu restaurante em um só lugar.</p>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Lucro Estimado</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">R$ {stats.totalProfit.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Estoque Baixo</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.lowStockCount}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Pedidos Hoje</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{orders.length}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Utensils size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Itens no Menu</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{menu.length}</p>
                </div>
              </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions and Stats */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 space-y-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ações Rápidas</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button onClick={() => setActiveTab('orders')} className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-2xl text-sky-600 dark:text-sky-400 hover:bg-sky-100 transition-all flex flex-col items-center gap-2">
                      <ShoppingBag size={20} />
                      <span className="text-[10px] font-bold uppercase">Pedidos</span>
                    </button>
                    <button onClick={() => setActiveTab('menu')} className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-all flex flex-col items-center gap-2">
                      <UtensilsCrossed size={20} />
                      <span className="text-[10px] font-bold uppercase">Menu</span>
                    </button>
                    <button onClick={() => setActiveTab('tables')} className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl text-green-600 dark:text-green-400 hover:bg-green-100 transition-all flex flex-col items-center gap-2">
                      <Settings size={20} />
                      <span className="text-[10px] font-bold uppercase">Mesas</span>
                    </button>
                    <button onClick={() => setActiveTab('promotions')} className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition-all flex flex-col items-center gap-2">
                      <Tag size={20} />
                      <span className="text-[10px] font-bold uppercase">Promo</span>
                    </button>
                  </div>
                </div>

                {/* Low Stock Alert */}
                {stats.lowStockCount > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-8 rounded-[2.5rem] border border-amber-200 dark:border-amber-800/30 space-y-4">
                    <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                      <AlertCircle size={24} />
                      <h3 className="font-bold">Alerta de Estoque</h3>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-300">Existem {stats.lowStockCount} itens com estoque baixo ou esgotado.</p>
                    <button 
                      onClick={() => setActiveTab('menu')}
                      className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-all"
                    >
                      Verificar Itens
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Feature Grid (Original) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button 
                onClick={() => setActiveTab('orders')}
                className="group p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 transition-all text-left flex flex-col gap-4"
              >
                <div className="w-14 h-14 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                  <ShoppingBag size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gerenciar Pedidos</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Acompanhe e atualize o status dos pedidos em tempo real.</p>
                </div>
                <div className="mt-auto flex items-center text-sky-600 font-bold text-sm">
                  Acessar <ChevronRight size={16} />
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('menu')}
                className="group p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 transition-all text-left flex flex-col gap-4"
              >
                <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <UtensilsCrossed size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cardápio</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Adicione, edite ou remova itens e categorias do menu.</p>
                </div>
                <div className="mt-auto flex items-center text-amber-600 font-bold text-sm">
                  Acessar <ChevronRight size={16} />
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('tables')}
                className="group p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 transition-all text-left flex flex-col gap-4"
              >
                <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                  <Settings size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Mesas e Layout</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Configure o número de mesas e imprima os QR Codes.</p>
                </div>
                <div className="mt-auto flex items-center text-green-600 font-bold text-sm">
                  Acessar <ChevronRight size={16} />
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('promotions')}
                className="group p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 transition-all text-left flex flex-col gap-4"
              >
                <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <Tag size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Promoções</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Crie ofertas especiais para atrair mais clientes.</p>
                </div>
                <div className="mt-auto flex items-center text-purple-600 font-bold text-sm">
                  Acessar <ChevronRight size={16} />
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('coupons')}
                className="group p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 transition-all text-left flex flex-col gap-4"
              >
                <div className="w-14 h-14 bg-pink-50 dark:bg-pink-900/20 rounded-2xl flex items-center justify-center text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform">
                  <Ticket size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cupons de Desconto</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gerencie cupons promocionais e descontos fixos.</p>
                </div>
                <div className="mt-auto flex items-center text-pink-600 font-bold text-sm">
                  Acessar <ChevronRight size={16} />
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('history')}
                className="group p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 transition-all text-left flex flex-col gap-4"
              >
                <div className="w-14 h-14 bg-gray-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-gray-600 dark:text-slate-300 group-hover:scale-110 transition-transform">
                  <Clock size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Histórico de Vendas</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Visualize relatórios de vendas e faturamento total.</p>
                </div>
                <div className="mt-auto flex items-center text-gray-600 font-bold text-sm">
                  Acessar <ChevronRight size={16} />
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('totalRevenue')}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">R$ {stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('newOrders')}</p>
                <p className="text-3xl font-bold text-amber-500">{stats.pendingOrders}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('preparingCount')}</p>
                <p className="text-3xl font-bold text-sky-500">{stats.preparingOrders}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('manageOrders')}</h2>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text"
                      placeholder="Buscar por cliente..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-sky-500 dark:text-white outline-none w-full sm:w-64"
                    />
                  </div>
                  {orderFilter && (
                    <button 
                      onClick={() => setOrderFilter('')}
                      className="text-xs bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full text-gray-500 hover:bg-gray-200 whitespace-nowrap"
                    >
                      Limpar Filtro (Mesa {orderFilter})
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 text-sm uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">{t('client')}</th>
                      <th className="px-6 py-4">{t('items')}</th>
                      <th className="px-6 py-4">{t('total')}</th>
                      <th className="px-6 py-4">{t('status')}</th>
                      <th className="px-6 py-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {orders
                      .filter(o => ['paid', 'preparing', 'ready', 'delivered'].includes(o.status))
                      .filter(o => !orderFilter || o.tableId === orderFilter)
                      .filter(o => !orderSearch || o.userName?.toLowerCase().includes(orderSearch.toLowerCase()))
                      .map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900 dark:text-white">{order.userName || t('client')}</p>
                          <p className="text-sm text-gray-500 dark:text-slate-400">#{order.orderNumber} • {t('mesa')} {order.tableId}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 dark:text-slate-300 space-y-1">
                            {order.items.map((i, idx) => (
                              <div key={idx}>
                                <span className="font-medium">{i.quantity}x {i.name}</span>
                                {i.observations && (
                                  <p className="text-xs text-sky-600 dark:text-sky-400 italic ml-4">"{i.observations}"</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-900 dark:text-white">R$ {order.total.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold uppercase",
                            order.status === 'paid' && "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                            order.status === 'preparing' && "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
                            order.status === 'ready' && "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
                            order.status === 'delivered' && "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400",
                            order.status === 'cancelled' && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            {order.status === 'paid' ? t('paidWaiting') : 
                             order.status === 'preparing' ? t('preparing') : 
                             order.status === 'ready' ? t('ready') : 
                             order.status === 'delivered' ? t('delivered') : order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {/* Status updates moved to Kitchen/Staff View */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('menu')}</h2>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => {
                    const itemsWithoutImage = menu.filter(m => !m.imageUrl || m.imageUrl === DEFAULT_MENU_IMAGE);
                    if (itemsWithoutImage.length === 0) {
                      showFeedback('success', "Todos os itens já possuem imagens!");
                      return;
                    }
                    
                    openConfirmModal(
                      "Gerar Imagens com IA",
                      `Deseja gerar imagens automáticas para ${itemsWithoutImage.length} itens? Isso pode levar alguns minutos.`,
                      async () => {
                        setIsGeneratingImage(true);
                        setGenerationProgress({ current: 0, total: itemsWithoutImage.length });
                        try {
                          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                          for (let i = 0; i < itemsWithoutImage.length; i++) {
                            const item = itemsWithoutImage[i];
                            setGenerationProgress(prev => ({ ...prev, current: i + 1 }));
                            
                            const prompt = `A professional, appetizing food photography of ${item.name}. ${item.description || ''}. High resolution, studio lighting, white background or elegant restaurant setting.`;
                            const response = await ai.models.generateContent({
                              model: 'gemini-2.5-flash-image',
                              contents: { parts: [{ text: prompt }] },
                              config: { imageConfig: { aspectRatio: "1:1" } }
                            });

                            const usage = response.usageMetadata;
                            if (usage) {
                              trackGeminiUsage('gemini-2.5-flash-image', usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
                            } else {
                              trackGeminiUsage('gemini-2.5-flash-image', 100, 1000);
                            }
                            
                            for (const part of response.candidates?.[0]?.content?.parts || []) {
                              if (part.inlineData) {
                                const base64Data = part.inlineData.data;
                                await updateDoc(doc(db, 'menu', item.id), { imageUrl: `data:image/png;base64,${base64Data}` });
                                break;
                              }
                            }
                          }
                          showFeedback('success', "Imagens geradas com sucesso!");
                        } catch (error) {
                          console.error("Error generating all images:", error);
                          showFeedback('error', "Erro ao gerar algumas imagens.");
                        } finally {
                          setIsGeneratingImage(false);
                          setGenerationProgress({ current: 0, total: 0 });
                        }
                      }
                    );
                  }}
                  disabled={isGeneratingImage}
                  className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-200 transition-all disabled:opacity-50 text-sm"
                >
                  {isGeneratingImage ? (
                    <>
                      <Clock className="animate-spin" size={18} />
                      {generationProgress.total > 0 ? `${generationProgress.current}/${generationProgress.total}` : 'Gerando...'}
                    </>
                  ) : (
                    <>
                      <Play size={18} /> Gerar Imagens
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setEditingItem({ imageUrl: DEFAULT_MENU_IMAGE }); setIsMenuModalOpen(true); }}
                  className="bg-sky-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-700 transition-all text-sm"
                >
                  <Plus size={18} /> {t('addItem')}
                </button>
              </div>
            </div>

            {/* Category Filter for Admin Menu */}
            <div className="relative flex items-center gap-2">
              <div 
                ref={scrollRef}
                className="flex-1 flex gap-2 overflow-x-auto pb-2 no-scrollbar pr-12"
              >
                <button
                  onClick={() => setAdminMenuCategory('all')}
                  className={cn(
                    "px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all",
                    adminMenuCategory === 'all' 
                      ? "bg-sky-600 text-white shadow-md" 
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-slate-700"
                  )}
                >
                  {t('all')}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setAdminMenuCategory(cat.id)}
                    className={cn(
                      "px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all",
                      adminMenuCategory === cat.id 
                        ? "bg-sky-600 text-white shadow-md" 
                        : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-slate-700"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-gray-50 dark:from-slate-900 to-transparent pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menu.filter(item => adminMenuCategory === 'all' || item.category === adminMenuCategory).map((item) => (
                <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex gap-4 relative group">
                  <img src={item.imageUrl} className="w-24 h-24 rounded-xl object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-1 mb-1">{item.description}</p>
                    <p className="text-sm text-sky-600 dark:text-sky-400 font-bold">R$ {item.price.toFixed(2)}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", item.available ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                        {item.available ? t('available') : t('unavailable')}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toggleAvailability(item.id, !item.available)}
                          className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline"
                        >
                          {t('change')}
                        </button>
                        <button 
                          onClick={() => { setEditingItem(item); setIsMenuModalOpen(true); }}
                          className="p-1 text-gray-400 hover:text-sky-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteMenu(item.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('categories')}</h2>
              <button 
                onClick={() => { setEditingCategory({}); setIsCategoryModalOpen(true); }}
                className="bg-sky-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-700 transition-all"
              >
                <Plus size={20} /> {t('addCategory')}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((cat) => {
                const IconComp = categoryIcons.find(i => i.id === cat.icon)?.icon || Utensils;
                return (
                  <div key={cat.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center text-center space-y-4 relative group">
                    <div className="w-16 h-16 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400">
                      <IconComp size={32} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{cat.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{cat.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => { setEditingCategory(cat); setIsCategoryModalOpen(true); }}
                        className="text-gray-400 hover:text-sky-600 transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="space-y-8">
            {/* Reservation Settings Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Configurações de Reserva</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Defina os parâmetros para reservas de mesas.</p>
                </div>
              </div>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                await setDoc(doc(db, 'settings', 'reservation'), reservationSettings);
                showFeedback('success', "Configurações de reserva salvas!");
              }} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="flex items-center gap-3 h-11">
                  <input 
                    type="checkbox" 
                    id="res-enabled-tab"
                    checked={reservationSettings.enabled} 
                    onChange={e => setReservationSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-5 h-5 text-sky-600 rounded-lg focus:ring-sky-500 border-gray-300 dark:border-slate-600"
                  />
                  <label htmlFor="res-enabled-tab" className="text-sm font-bold text-gray-700 dark:text-slate-300">Habilitar Reservas</label>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Custo (R$)</label>
                  <input 
                    type="number" 
                    required 
                    value={reservationSettings.cost} 
                    onFocus={(e) => e.target.select()}
                    onChange={e => setReservationSettings(prev => ({ ...prev, cost: Number(e.target.value) }))} 
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white font-bold" 
                  />
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Duração (Minutos)</label>
                    <input 
                      type="number" 
                      required 
                      value={reservationSettings.durationMinutes} 
                      onFocus={(e) => e.target.select()}
                      onChange={e => setReservationSettings(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))} 
                      className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white font-bold" 
                    />
                  </div>
                  <button 
                    type="submit"
                    className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none flex items-center gap-2"
                  >
                    <Save size={18} /> Salvar
                  </button>
                </div>
              </form>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tables')}</h2>
                <button 
                  onClick={() => setIsLayoutModalOpen(true)}
                  className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm text-sky-600 hover:bg-sky-50 transition-all flex items-center gap-2 text-sm font-bold"
                >
                  <MapIcon size={18} /> Layout
                </button>
                <button 
                  onClick={handlePrintAllQRCodes}
                  className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm text-sky-600 hover:bg-sky-50 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold whitespace-nowrap"
                >
                  <QrCode size={18} /> <span className="hidden sm:inline">Imprimir Todos</span><span className="sm:hidden">Todos</span>
                </button>
                <button 
                  onClick={async () => {
                    if (window.confirm("Tem certeza que deseja liberar TODAS as mesas ocupadas?")) {
                      try {
                        const q = query(collection(db, 'tables'), where('currentUserId', '!=', null));
                        const snapshot = await getDocs(q);
                        for (const docSnap of snapshot.docs) {
                          await updateDoc(doc(db, 'tables', docSnap.id), {
                            currentUserId: null,
                            currentUserName: null,
                            currentCart: null,
                            lastOrderId: null,
                            reservedUntil: null,
                            reservedBy: null,
                            reservedByName: null
                          });
                        }
                        showFeedback('success', "Todas as mesas foram liberadas!");
                      } catch (err) {
                        console.error("Error releasing all tables:", err);
                        showFeedback('error', "Erro ao liberar mesas.");
                      }
                    }
                  }}
                  className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm text-red-600 hover:bg-red-50 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold whitespace-nowrap"
                >
                  <RotateCcw size={18} /> <span className="hidden sm:inline">Liberar Todas</span><span className="sm:hidden">Liberar</span>
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 px-2 uppercase tracking-wider">Total de Mesas:</span>
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={tableCountInput}
                  onChange={(e) => setTableCountInput(e.target.value)}
                  placeholder={tables.length.toString()}
                  className="w-16 bg-gray-50 dark:bg-slate-700 border-none rounded-xl px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-sky-500 dark:text-white outline-none"
                />
                <button 
                  onClick={handleSetTableCount}
                  className="bg-sky-600 text-white px-4 py-1.5 rounded-xl font-bold text-sm hover:bg-sky-700 transition-all shadow-sm"
                >
                  Definir
                </button>
                <button 
                  onClick={handleAddTable}
                  className="p-1.5 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-xl transition-all"
                  title="Adicionar uma mesa"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tables.sort((a, b) => a.number - b.number).map((table) => {
                const tableOrders = orders.filter(o => o.tableId === table.number.toString() && o.status !== 'cancelled');
                const activeOrder = orders.find(o => o.id === table.lastOrderId);
                const hasCart = table.currentCart && table.currentCart.length > 0;
                
                const { showPaidFlag, hasPending, allDelivered } = getTableStatusFlags(tableOrders);
                const canRelease = canReleaseTable(tableOrders);
                
                return (
                  <div key={table.id} className={cn(
                    "bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border transition-all flex flex-col relative overflow-hidden",
                    table.currentUserId ? "border-sky-500 ring-1 ring-sky-500" : "border-gray-100 dark:border-slate-700",
                    !table.active && "opacity-60 grayscale"
                  )}>
                    {!table.active && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
                    )}
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-sm",
                        table.currentUserId ? "bg-sky-500 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-400"
                      )}>
                        {table.number}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {!table.active && (
                          <span className="bg-red-100 text-red-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Inativa
                          </span>
                        )}
                        {table.currentUserId && (
                          <>
                            <span className="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                              Ocupada
                            </span>
                            {showPaidFlag && (
                              <span className="bg-green-100 text-green-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <Check size={10} /> Pago
                              </span>
                            )}
                            {hasPending && (
                              <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                Pagamento Pendente
                              </span>
                            )}
                          </>
                        )}
                        {table.reservedUntil && table.reservedUntil.toDate() > new Date() && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <Calendar size={10} /> Reservada
                            </span>
                            <CountdownTimer 
                              targetDate={table.reservedUntil} 
                              className="text-amber-600 dark:text-amber-400 text-[10px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3 flex-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-lg">{t('mesa')} {table.number}</p>
                          {table.reservedUntil && table.reservedUntil.toDate() > new Date() ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium truncate flex items-center gap-2">
                              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                              Reservada por {table.reservedByName}
                            </p>
                          ) : table.currentUserName ? (
                            <p className="text-sm text-sky-600 dark:text-sky-400 font-medium truncate flex items-center gap-2">
                              <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></span>
                              {table.currentUserName}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-slate-500 italic">
                              Livre
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => toggleTableStatus(table.id, !table.active)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              table.active ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"
                            )}
                            title={table.active ? "Desativar Mesa" : "Ativar Mesa"}
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setQrTableNumber(table.number);
                              setIsQRModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                            title="Gerar QR Code"
                          >
                            <QrCode size={18} />
                          </button>
                          {!table.currentUserId && (
                            <button 
                              onClick={() => handleDeleteTable(table.id, table.number)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Excluir Mesa"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>

                    {/* Cart Items (Unfinalized) */}
                    {hasCart && (
                      <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/20">
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-2 flex items-center gap-1">
                          <ShoppingCart size={12} /> No Carrinho
                        </p>
                        <ul className="text-xs space-y-1 text-amber-800 dark:text-amber-300">
                          {table.currentCart?.map((item, i) => (
                            <li key={i} className="flex justify-between">
                              <span>{item.quantity}x {item.name}</span>
                              <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Active Order Details */}
                    {activeOrder && (
                      <div className="bg-sky-50 dark:bg-sky-900/10 p-3 rounded-xl border border-sky-100 dark:border-sky-900/20">
                        <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase mb-2 flex items-center gap-1">
                          <ShoppingBag size={12} /> Pedido #{activeOrder.orderNumber}
                        </p>
                        <ul className="text-xs space-y-1 text-sky-800 dark:text-sky-300">
                          {activeOrder.items.map((item, i) => (
                            <li key={i} className="flex justify-between">
                              <span>{item.quantity}x {item.name}</span>
                              <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                          <li className="pt-2 border-t border-sky-200 dark:border-sky-800 flex justify-between font-bold">
                            <span>Total</span>
                            <span>R$ {activeOrder.total.toFixed(2)}</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700 space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-50 dark:bg-slate-900/50 p-2 rounded-lg text-[10px] font-mono break-all text-gray-400 dark:text-slate-500 flex items-center justify-center">
                        /mesa/{table.number}
                      </div>
                      
                      {table.currentUserId && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => releaseTable(table.id, table.number)}
                            disabled={!canRelease}
                            className={cn(
                              "px-3 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1",
                              canRelease
                                ? "bg-red-500 text-white hover:bg-red-600 shadow-sm" 
                                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                            )}
                            title={!canRelease ? "Entregue todos os pedidos primeiro" : "Liberar Mesa"}
                          >
                            <LogOut size={14} /> Liberar
                          </button>
                          
                          <button 
                            onClick={() => {
                              setForcedReleaseTableId(table.id);
                              setForcedReleaseTableNumber(table.number);
                              setIsForcedReleaseModalOpen(true);
                            }}
                            className="px-3 py-2 rounded-xl text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-all flex items-center gap-1"
                            title="Liberação Forçada"
                          >
                            <AlertCircle size={14} /> Forçar
                          </button>
                        </div>
                      )}

                      {table.lastOrderId && (
                        <button 
                          onClick={() => {
                            setOrderFilter(table.number.toString());
                            setActiveTab('orders');
                          }}
                          className="p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-200 transition-all"
                          title="Ver Detalhes do Pedido"
                        >
                          <ChevronRight size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Histórico de Pedidos</h2>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 text-xs text-gray-500"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Sucesso</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Cancelado</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><div className="w-2 h-2 bg-amber-500 rounded-full"></div> Pendente</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 text-sm uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Mesa / Cliente</th>
                      <th className="px-6 py-4">Itens</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {order.createdAt?.toDate().toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {order.createdAt?.toDate().toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{order.userName || t('client')}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{t('mesa')} {order.tableId} • #{order.orderNumber}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-gray-600 dark:text-slate-300">
                            {order.items.length} itens
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">R$ {order.total.toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            order.status === 'paid' || order.status === 'delivered' || order.status === 'ready' || order.status === 'preparing' ? "bg-green-100 text-green-600" : 
                            order.status === 'cancelled' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Logs de Auditoria</h2>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 text-sm uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">{t('date')}</th>
                      <th className="px-6 py-4">{t('user')}</th>
                      <th className="px-6 py-4">{t('action')}</th>
                      <th className="px-6 py-4">{t('entity')}</th>
                      <th className="px-6 py-4">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {log.timestamp?.toDate().toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {log.timestamp?.toDate().toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900 dark:text-white">{log.userEmail}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            log.action === 'create' && "bg-green-100 text-green-600",
                            log.action === 'update' && "bg-blue-100 text-blue-600",
                            log.action === 'delete' && "bg-red-100 text-red-600"
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{log.entityName}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">{log.entityType}</p>
                        </td>
                        <td className="px-6 py-4">
                          {log.details ? (
                            <p className="text-xs text-sky-600 dark:text-sky-400 italic font-medium max-w-xs truncate" title={log.details}>
                              {log.details}
                            </p>
                          ) : (
                            <span className="text-gray-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Usuários</h2>
            </div>

            {/* Create User Form */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Novo Usuário</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Adicione um novo colaborador ou cliente ao sistema.</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Nome</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: João Silva"
                    value={newUser.displayName}
                    onChange={e => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
                  <input 
                    type="email"
                    required
                    placeholder="joao@email.com"
                    value={newUser.email}
                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Senha</label>
                  <input 
                    type="password"
                    required
                    placeholder="******"
                    value={newUser.password}
                    onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Papel</label>
                  <select 
                    value={newUser.role}
                    onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as any }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white font-bold"
                  >
                    <option value="client">Cliente</option>
                    <option value="waiter">Atendente</option>
                    <option value="staff">Cozinha</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  disabled={isCreatingUser}
                  className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreatingUser ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  Criar Usuário
                </button>
              </form>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 text-sm uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Papel Atual</th>
                      <th className="px-6 py-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {users.map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                              <User size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{user.displayName || user.email.split('@')[0]}</p>
                              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">{user.uid}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900 dark:text-white">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                            user.role === 'admin' && "bg-purple-100 text-purple-600",
                            user.role === 'waiter' && "bg-amber-100 text-amber-600",
                            user.role === 'staff' && "bg-blue-100 text-blue-600",
                            user.role === 'client' && "bg-gray-100 text-gray-600"
                          )}>
                            {user.role === 'admin' ? 'Administrador' : 
                             user.role === 'waiter' ? 'Atendente' : 
                             user.role === 'staff' ? 'Staff' : 'Cliente'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select 
                              value={user.role}
                              onChange={(e) => updateUserRole(user.uid, e.target.value as any)}
                              className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                            >
                              <option value="client">Cliente</option>
                              <option value="waiter">Atendente</option>
                              <option value="staff">Staff</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'promotions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Promoções</h2>
              <button 
                onClick={() => { 
                  setEditingPromo({ 
                    discountType: 'percentage', 
                    targetType: 'all', 
                    active: true,
                    discountValue: 0
                  }); 
                  setIsPromoModalOpen(true); 
                }}
                className="bg-sky-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none"
              >
                <Plus size={20} /> Nova Promoção
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                <div key={promo.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{promo.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{promo.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingPromo(promo); setIsPromoModalOpen(true); }} className="p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-xl transition-all">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeletePromotion(promo.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-xs font-bold uppercase">
                      {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `R$ ${promo.discountValue} OFF`}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded-full text-xs font-bold uppercase">
                      {promo.targetType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
                    <span>{promo.active ? 'Ativa' : 'Inativa'}</span>
                    <span>{promo.createdAt?.toDate().toLocaleDateString()}</span>
                  </div>
                  {promo.imageUrl && (
                    <div className="mt-4 rounded-xl overflow-hidden aspect-video bg-gray-50 dark:bg-slate-900">
                      <img src={promo.imageUrl} alt={promo.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'coupons' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cupons de Fidelidade</h2>
              <button 
                onClick={() => { 
                  setEditingCoupon({ 
                    discountType: 'percentage', 
                    active: true,
                    discountValue: 0,
                    minPurchase: 0
                  }); 
                  setIsCouponModalOpen(true); 
                }}
                className="bg-sky-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 dark:shadow-none"
              >
                <Plus size={20} /> Novo Cupom
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coupons.map((coupon) => (
                <div key={coupon.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-sky-600 dark:text-sky-400 font-mono">{coupon.code}</h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{coupon.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingCoupon(coupon); setIsCouponModalOpen(true); }} className="p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-xl transition-all">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteCoupon(coupon.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-xs font-bold uppercase">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `R$ ${coupon.discountValue} OFF`}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">Usos: {coupon.usedCount} / {coupon.usageLimit || '∞'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
                    <span>{coupon.active ? 'Ativo' : 'Inativo'}</span>
                    {coupon.expiryDate && (
                      <span>Expira em: {coupon.expiryDate?.toDate().toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  {feedback.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
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
      </main>
      {/* Menu Modal */}
      <AnimatePresence>
        {isMenuModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{editingItem?.id ? t('editItem') : t('addItem')}</h2>
                <button onClick={() => setIsMenuModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveMenu} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('name')}</label>
                  <input 
                    required
                    value={editingItem?.name || ''}
                    onChange={e => setEditingItem(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('description')}</label>
                  <textarea 
                    required
                    value={editingItem?.description || ''}
                    onChange={e => setEditingItem(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('price')}</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={editingItem?.price || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                      className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('category')}</label>
                    <select 
                      required
                      value={editingItem?.category || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                    >
                      <option value="">{t('selectCategory')}</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Preço de Custo (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editingItem?.costPrice || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, costPrice: parseFloat(e.target.value) }))}
                      className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Estoque Atual</label>
                    <input 
                      type="number"
                      value={editingItem?.stockQuantity || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, stockQuantity: parseInt(e.target.value) }))}
                      className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('imageUrl')}</label>
                  <div className="space-y-3">
                    {editingItem?.imageUrl && (
                      <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700">
                        <img 
                          src={editingItem.imageUrl} 
                          alt="Preview" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button 
                          type="button"
                          onClick={() => setEditingItem(prev => ({ ...prev, imageUrl: DEFAULT_MENU_IMAGE }))}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col items-center justify-center gap-2 px-4 py-3 bg-gray-50 dark:bg-slate-700 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-all group">
                        <Plus className="text-gray-400 group-hover:text-sky-500" size={20} />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">Upload</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        type="button"
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="flex flex-col items-center justify-center gap-2 px-4 py-3 bg-sky-50 dark:bg-sky-900/20 border-2 border-dashed border-sky-200 dark:border-sky-800 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all group disabled:opacity-50"
                      >
                        {isGeneratingImage ? <Clock className="animate-spin text-sky-500" size={20} /> : <Play className="text-sky-500 group-hover:scale-110 transition-transform" size={20} />}
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">Gerar AI</span>
                      </button>
                    </div>
                    <input 
                      required
                      value={editingItem?.imageUrl || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white placeholder:text-gray-400 text-xs"
                      placeholder="Ou cole a URL da imagem..."
                    />
                  </div>
                </div>
                <button type="submit" className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-all mt-4 shadow-lg shadow-sky-200 dark:shadow-none">
                  {t('save')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{editingCategory?.id ? t('editCategory') : t('addCategory')}</h2>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('name')}</label>
                  <input 
                    required
                    value={editingCategory?.name || ''}
                    onChange={e => setEditingCategory(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{t('description')}</label>
                  <input 
                    required
                    value={editingCategory?.description || ''}
                    onChange={e => setEditingCategory(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">{t('icon')}</label>
                  <div className="grid grid-cols-5 gap-2">
                    {categoryIcons.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setEditingCategory(prev => ({ ...prev, icon: item.id }))}
                        className={cn(
                          "p-3 rounded-xl border-2 transition-all flex items-center justify-center",
                          editingCategory?.icon === item.id 
                            ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400" 
                            : "border-transparent bg-gray-50 dark:bg-slate-700 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600"
                        )}
                      >
                        <item.icon size={20} />
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-all mt-4 shadow-lg shadow-sky-200 dark:shadow-none">
                  {t('save')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {isForcedReleaseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                    <AlertCircle size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Liberação Forçada</h2>
                </div>
                <button onClick={() => setIsForcedReleaseModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Você está prestes a liberar a <strong>Mesa {forcedReleaseTableNumber}</strong> forçadamente. 
                  Esta ação ignora pedidos pendentes e deve ser usada apenas em casos excepcionais.
                </p>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Motivo da Liberação
                  </label>
                  <textarea 
                    required
                    placeholder="Ex: Bug no sistema, pagamento feito por fora, etc..."
                    value={forcedReleaseObservation}
                    onChange={e => setForcedReleaseObservation(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white min-h-[100px] text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsForcedReleaseModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => forcedReleaseTableId && forcedReleaseTableNumber && releaseTable(forcedReleaseTableId, forcedReleaseTableNumber, forcedReleaseObservation)}
                    disabled={!forcedReleaseObservation.trim()}
                    className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Promotion Modal */}
        {isPromoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{editingPromo?.id ? 'Editar Promoção' : 'Nova Promoção'}</h2>
                <button onClick={() => setIsPromoModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400"><XCircle size={24} /></button>
              </div>
              <form onSubmit={handleSavePromotion} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Nome</label>
                  <input required value={editingPromo?.name || ''} onChange={e => setEditingPromo(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Descrição</label>
                  <textarea required value={editingPromo?.description || ''} onChange={e => setEditingPromo(prev => ({ ...prev, description: e.target.value }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white h-20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Tipo de Desconto</label>
                    <select value={editingPromo?.discountType || 'percentage'} onChange={e => setEditingPromo(prev => ({ ...prev, discountType: e.target.value as any }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white">
                      <option value="percentage">Porcentagem (%)</option>
                      <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Valor</label>
                    <input type="number" required value={editingPromo?.discountValue || ''} onChange={e => setEditingPromo(prev => ({ ...prev, discountValue: Number(e.target.value) }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Alvo</label>
                  <select value={editingPromo?.targetType || 'all'} onChange={e => setEditingPromo(prev => ({ ...prev, targetType: e.target.value as any }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white">
                    <option value="all">Todo o Cardápio</option>
                    <option value="category">Categoria Específica</option>
                    <option value="item">Item Específico</option>
                  </select>
                </div>
                {editingPromo?.targetType === 'category' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Categoria</label>
                    <select value={editingPromo?.targetId || ''} onChange={e => setEditingPromo(prev => ({ ...prev, targetId: e.target.value }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white">
                      <option value="">Selecione...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {editingPromo?.targetType === 'item' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Item</label>
                    <select value={editingPromo?.targetId || ''} onChange={e => setEditingPromo(prev => ({ ...prev, targetId: e.target.value }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white">
                      <option value="">Selecione...</option>
                      {menu.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">URL da Imagem / Banner</label>
                  <div className="flex gap-2">
                    <input 
                      value={editingPromo?.imageUrl || ''} 
                      onChange={e => setEditingPromo(prev => ({ ...prev, imageUrl: e.target.value }))} 
                      placeholder="https://..."
                      className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white" 
                    />
                    <button
                      type="button"
                      onClick={generateAIBanner}
                      disabled={isGeneratingImage}
                      className="p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-xl hover:bg-sky-200 transition-all disabled:opacity-50"
                      title="Gerar com IA"
                    >
                      {isGeneratingImage ? <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /> : <Sparkles size={20} />}
                    </button>
                  </div>
                  {editingPromo?.imageUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 aspect-video bg-gray-50 dark:bg-slate-900">
                      <img src={editingPromo.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="promo-active"
                    checked={editingPromo?.active ?? true} 
                    onChange={e => setEditingPromo(prev => ({ ...prev, active: e.target.checked }))}
                    className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                  />
                  <label htmlFor="promo-active" className="text-sm font-bold text-gray-700 dark:text-slate-300">Promoção Ativa</label>
                </div>
                <button type="submit" className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-all mt-4">Salvar</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Coupon Modal */}
        {isCouponModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{editingCoupon?.id ? 'Editar Cupom' : 'Novo Cupom'}</h2>
                <button onClick={() => setIsCouponModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400"><XCircle size={24} /></button>
              </div>
              <form onSubmit={handleSaveCoupon} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Código</label>
                  <input required value={editingCoupon?.code || ''} onChange={e => setEditingCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Descrição</label>
                  <input required value={editingCoupon?.description || ''} onChange={e => setEditingCoupon(prev => ({ ...prev, description: e.target.value }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Tipo</label>
                    <select value={editingCoupon?.discountType || 'percentage'} onChange={e => setEditingCoupon(prev => ({ ...prev, discountType: e.target.value as any }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white">
                      <option value="percentage">Porcentagem (%)</option>
                      <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Valor</label>
                    <input type="number" required value={editingCoupon?.discountValue || ''} onChange={e => setEditingCoupon(prev => ({ ...prev, discountValue: Number(e.target.value) }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Compra Mínima</label>
                    <input type="number" value={editingCoupon?.minPurchase || ''} onChange={e => setEditingCoupon(prev => ({ ...prev, minPurchase: Number(e.target.value) }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Limite de Uso</label>
                    <input type="number" value={editingCoupon?.usageLimit || ''} onChange={e => setEditingCoupon(prev => ({ ...prev, usageLimit: Number(e.target.value) }))} className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 dark:text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="coupon-active"
                    checked={editingCoupon?.active ?? true} 
                    onChange={e => setEditingCoupon(prev => ({ ...prev, active: e.target.checked }))}
                    className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                  />
                  <label htmlFor="coupon-active" className="text-sm font-bold text-gray-700 dark:text-slate-300">Cupom Ativo</label>
                </div>
                <button type="submit" className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-all mt-4">Salvar</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Layout Modal */}
        {isLayoutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-3xl p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold dark:text-white">Layout do Salão</h2>
                <button onClick={() => setIsLayoutModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>
              
              <div id="layout-container" className="relative bg-gray-100 dark:bg-slate-900 rounded-3xl aspect-video border-2 border-dashed border-gray-300 dark:border-slate-700 overflow-hidden">
                {tables.map((table, index) => {
                  // Default position if not set (grid layout)
                  const defaultX = (index % 5) * 20 + 10;
                  const defaultY = Math.floor(index / 5) * 20 + 10;

                  return (
                    <motion.div
                      key={table.id}
                      drag
                      dragMomentum={false}
                      onDragEnd={(_, info) => {
                        const container = document.getElementById('layout-container');
                        if (container) {
                          const rect = container.getBoundingClientRect();
                          const rawX = ((info.point.x - rect.left) / rect.width) * 100;
                          const rawY = ((info.point.y - rect.top) / rect.height) * 100;
                          
                          // Snap to grid (5% increments)
                          const x = Math.max(5, Math.min(95, Math.round(rawX / 5) * 5));
                          const y = Math.max(5, Math.min(95, Math.round(rawY / 5) * 5));
                          
                          updateDoc(doc(db, 'tables', table.id), { x, y });
                        }
                      }}
                      className="absolute cursor-move w-12 h-12 bg-sky-500 text-white rounded-xl flex items-center justify-center font-bold shadow-lg z-10"
                      style={{ 
                        left: `${table.x !== undefined ? table.x : defaultX}%`, 
                        top: `${table.y !== undefined ? table.y : defaultY}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      {table.number}
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400 text-center italic">Arraste as mesas para posicioná-las no mapa do salão.</p>
            </motion.div>
          </div>
        )}

        {/* QR Code Modal */}
        {isQRModalOpen && qrTableNumber !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-8 space-y-6 text-center"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold dark:text-white">QR Code Mesa {qrTableNumber}</h2>
                <button onClick={() => setIsQRModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>
              
              <div id="qr-to-print" className="bg-white p-8 rounded-3xl shadow-inner flex flex-col items-center gap-4 border border-gray-100">
                <div className="relative">
                  <QRCodeSVG 
                    value={`${window.location.origin}/mesa/${qrTableNumber}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 border-black">
                      <span className="text-black font-black text-3xl">{qrTableNumber}</span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-slate-900 font-black text-2xl uppercase tracking-tighter">PRAIA FLOW</p>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em]">Mesa {qrTableNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => {
                    const printContent = document.getElementById('qr-to-print');
                    if (printContent) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>QR Code Mesa ${qrTableNumber}</title>
                              <style>
                                body { 
                                  display: flex; 
                                  flex-direction: column;
                                  align-items: center; 
                                  justify-content: center; 
                                  height: 100vh; 
                                  margin: 0;
                                  font-family: sans-serif;
                                }
                                .container {
                                  padding: 40px;
                                  border: 1px solid #eee;
                                  border-radius: 40px;
                                  text-align: center;
                                }
                                .qr-wrapper {
                                  position: relative;
                                  display: inline-block;
                                }
                                .number-overlay {
                                  position: absolute;
                                  top: 50%;
                                  left: 50%;
                                  transform: translate(-50%, -50%);
                                  background: white;
                                  width: 70px;
                                  height: 70px;
                                  border-radius: 50%;
                                  display: flex;
                                  align-items: center;
                                  justify-content: center;
                                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                  border: 4px solid black;
                                  font-weight: 900;
                                  font-size: 36px;
                                  color: black;
                                }
                                .brand {
                                  margin-top: 20px;
                                  font-size: 28px;
                                  font-weight: 900;
                                  letter-spacing: -1px;
                                }
                                .table-label {
                                  font-size: 12px;
                                  font-weight: 700;
                                  color: #94a3b8;
                                  letter-spacing: 4px;
                                  text-transform: uppercase;
                                }
                              </style>
                            </head>
                            <body>
                              <div class="container">
                                <div class="qr-wrapper">
                                  ${printContent.querySelector('svg')?.outerHTML}
                                  <div class="number-overlay">${qrTableNumber}</div>
                                </div>
                                <div class="brand">PRAIA FLOW</div>
                                <div class="table-label">Mesa ${qrTableNumber}</div>
                              </div>
                              <script>
                                window.onload = () => {
                                  window.print();
                                  setTimeout(() => window.close(), 500);
                                };
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }
                  }}
                  className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-all flex items-center justify-center gap-2"
                >
                  <QrCode size={20} /> Imprimir QR Code
                </button>
                <button 
                  onClick={() => setIsQRModalOpen(false)}
                  className="w-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Print All QR Codes Modal */}
        {isPrintAllModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl p-8 flex flex-col gap-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold dark:text-white">Visualização de QR Codes</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Confira todos os códigos antes de imprimir ou gerar o PDF</p>
                </div>
                <button onClick={() => setIsPrintAllModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
                  <XCircle size={24} className="text-gray-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-4">
                  {tables.filter(t => t.active).sort((a, b) => a.number - b.number).map(table => (
                    <div key={table.id} className="bg-gray-50 dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 flex flex-col items-center gap-3">
                      <div className="relative bg-white p-2 rounded-xl shadow-sm">
                        <QRCodeSVG 
                          value={`${window.location.origin}/mesa/${table.number}`}
                          size={120}
                          level="H"
                          includeMargin={true}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center shadow-md border-2 border-black">
                            <span className="text-black font-black text-xl">{table.number}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-tighter">PRAIA FLOW</p>
                        <p className="text-slate-400 font-bold text-[8px] uppercase tracking-[0.2em]">Mesa {table.number}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button 
                  onClick={() => {
                    executePrintAll();
                    setIsPrintAllModalOpen(false);
                  }}
                  className="flex-1 bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-all flex items-center justify-center gap-2"
                >
                  <QrCode size={20} /> Gerar PDF / Imprimir
                </button>
                <button 
                  onClick={() => setIsPrintAllModalOpen(false)}
                  className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden QR codes for printing all */}
      <div style={{ display: 'none' }}>
        {tables.filter(t => t.active).sort((a, b) => a.number - b.number).map(table => (
          <div key={table.id} id={`qr-print-all-${table.number}`}>
            <QRCodeSVG 
              value={`${window.location.origin}/mesa/${table.number}`}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
        ))}
      </div>
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-8 space-y-6 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <AlertCircle size={32} />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{confirmModal.title}</h3>
                <p className="text-gray-500 dark:text-slate-400 mt-2">{confirmModal.message}</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
