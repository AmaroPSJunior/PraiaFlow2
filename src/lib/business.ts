import { Order, Table, UserProfile } from '../types';

export const canReleaseTable = (tableOrders: Order[]): boolean => {
  if (tableOrders.length === 0) return true;
  return tableOrders.every(order => order.status === 'delivered');
};

export const getTableStatusFlags = (tableOrders: Order[]) => {
  const hasOrders = tableOrders.length > 0;
  const allPaid = hasOrders && tableOrders.every(o => o.status !== 'pending' && o.status !== 'cancelled');
  const hasPending = tableOrders.some(o => o.status === 'pending');
  const allDelivered = hasOrders && tableOrders.every(o => o.status === 'delivered');
  
  return {
    showPaidFlag: allPaid && !hasPending,
    hasPending,
    allDelivered
  };
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const isValidTransition = (current: string, next: string) => {
  const flow: Record<string, string[]> = {
    'pending': ['paid', 'cancelled'],
    'paid': ['preparing'],
    'preparing': ['ready'],
    'ready': ['delivered'],
    'delivered': []
  };
  return flow[current]?.includes(next) || false;
};

export const extractTableFromUrl = (url: string) => {
  const parts = url.split('/');
  return parts[parts.length - 1];
};

export const calculateFinalBill = (total: number, signal: number) => {
  return Math.max(0, total - signal);
};

export const getProfileByEmail = (user: { email: string }): Partial<UserProfile> => {
  if (user.email === 'arcamos.j@gmail.com') {
    return { role: 'admin' };
  }
  return { role: 'client' };
};

export const calculateTotal = (items: { price: number; qty: number }[]) => {
  return items.reduce((acc, item) => acc + (item.price * item.qty), 0);
};
