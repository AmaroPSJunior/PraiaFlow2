import { describe, it, expect } from 'vitest';
import { canReleaseTable, getTableStatusFlags } from '../src/lib/business';
import { Order } from '../src/types';

describe('Business Logic Tests', () => {
  describe('canReleaseTable', () => {
    it('should allow releasing a table with no orders', () => {
      expect(canReleaseTable([])).toBe(true);
    });

    it('should NOT allow releasing a table with pending orders', () => {
      const orders: Partial<Order>[] = [{ status: 'pending' }];
      expect(canReleaseTable(orders as Order[])).toBe(false);
    });

    it('should NOT allow releasing a table with paid but not delivered orders', () => {
      const orders: Partial<Order>[] = [{ status: 'paid' }];
      expect(canReleaseTable(orders as Order[])).toBe(false);
    });

    it('should allow releasing a table when all orders are delivered', () => {
      const orders: Partial<Order>[] = [{ status: 'delivered' }, { status: 'delivered' }];
      expect(canReleaseTable(orders as Order[])).toBe(true);
    });
  });

  describe('getTableStatusFlags', () => {
    it('should show paid flag when all orders are paid and none are pending', () => {
      const orders: Partial<Order>[] = [{ status: 'paid' }, { status: 'preparing' }];
      const flags = getTableStatusFlags(orders as Order[]);
      expect(flags.showPaidFlag).toBe(true);
      expect(flags.hasPending).toBe(false);
    });

    it('should NOT show paid flag if there is a pending order', () => {
      const orders: Partial<Order>[] = [{ status: 'paid' }, { status: 'pending' }];
      const flags = getTableStatusFlags(orders as Order[]);
      expect(flags.showPaidFlag).toBe(false);
      expect(flags.hasPending).toBe(true);
    });
  });
});
