import { describe, it, expect } from 'vitest';
import { validateMenuItem, validateCategory } from '../src/lib/validation';

describe('Validation Tests', () => {
  describe('validateMenuItem', () => {
    it('should fail if name is too short', () => {
      const result = validateMenuItem({ name: 'ab', price: 10, category: 'food' });
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeDefined();
    });

    it('should fail if price is zero or negative', () => {
      const result = validateMenuItem({ name: 'Burger', price: 0, category: 'food' });
      expect(result.isValid).toBe(false);
      expect(result.errors.price).toBeDefined();
    });

    it('should pass with valid data', () => {
      const result = validateMenuItem({ name: 'Burger', price: 15.5, category: 'food' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateCategory', () => {
    it('should fail if description is too short', () => {
      const result = validateCategory({ name: 'Drinks', description: 'abc' });
      expect(result.isValid).toBe(false);
      expect(result.errors.description).toBeDefined();
    });

    it('should pass with valid data', () => {
      const result = validateCategory({ name: 'Drinks', description: 'Refreshing beverages' });
      expect(result.isValid).toBe(true);
    });
  });
});
