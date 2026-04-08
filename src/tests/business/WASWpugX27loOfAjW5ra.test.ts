// Title: Gestão de Estoque em Tempo Real
// Description: O estoque dos itens é decrementado automaticamente ao realizar um pedido pago. Alertas são emitidos quando o estoque atinge o nível crítico.
// Category: order
// Priority: high
// Status: implemented

/* TEST_START */
it('should decrement stock on order', async () => {
  const initialStock = item.stock;
  await placeOrder(item, 2);
  expect(item.stock).toBe(initialStock - 2);
});
/* TEST_END */
