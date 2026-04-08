// Title: Fluxo de Status do Pedido
// Description: Pedidos devem seguir a sequência: Pendente -> Pago -> Preparando -> Pronto -> Entregue.
// Category: order
// Priority: high
// Status: implemented

/* TEST_START */
it('should follow correct status sequence', () => {
  const status = ['pending', 'paid', 'preparing', 'ready', 'delivered'];
  expect(isValidTransition('pending', 'paid')).toBe(true);
});
/* TEST_END */
