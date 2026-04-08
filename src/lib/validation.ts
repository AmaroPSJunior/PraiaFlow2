export const validateMenuItem = (item: { name?: string; price?: number; category?: string; costPrice?: number }) => {
  const errors: Record<string, string> = {};
  
  if (!item.name || item.name.trim().length < 3) {
    errors.name = "O nome deve ter pelo menos 3 caracteres.";
  }
  
  if (item.price === undefined || item.price <= 0) {
    errors.price = "O preço deve ser maior que zero.";
  }

  if (item.costPrice !== undefined && item.costPrice < 0) {
    errors.costPrice = "O preço de custo não pode ser negativo.";
  }
  
  if (!item.category) {
    errors.category = "Selecione uma categoria.";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateCategory = (category: { name?: string; description?: string }) => {
  const errors: Record<string, string> = {};
  
  if (!category.name || category.name.trim().length < 2) {
    errors.name = "O nome deve ter pelo menos 2 caracteres.";
  }
  
  if (!category.description || category.description.trim().length < 5) {
    errors.description = "A descrição deve ter pelo menos 5 caracteres.";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const isValidTableNumber = (num: number) => {
  return typeof num === 'number' && num > 0 && Number.isInteger(num);
};

export const validateUser = (user: { email?: string; role?: string }) => {
  if (!user.email || !user.email.includes('@')) return false;
  const validRoles = ['admin', 'waiter', 'staff', 'client', 'root'];
  if (!user.role || !validRoles.includes(user.role)) return false;
  return true;
};

export const validateCoupon = (coupon: { code?: string; discount?: number }) => {
  if (!coupon.code || coupon.code.trim().length < 3) return false;
  if (coupon.discount === undefined || coupon.discount <= 0 || coupon.discount > 100) return false;
  return true;
};

export const validateOrder = (order: { items?: any[]; total?: number }) => {
  if (!order.items || order.items.length === 0) return false;
  if (order.total === undefined || order.total <= 0) return false;
  return true;
};
