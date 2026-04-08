// Title: Saída Forçada com Pendências
// Description: Permitir que o cliente libere a mesa mesmo com pedidos pendentes ou não pagos, mediante confirmação de 'Saída Forçada'.
// Category: table
// Priority: medium
// Status: implemented

/* TEST_START */
it('should allow force logout with pending orders', async () => {
  const hasPending = true;
  await handleLogout(true);
  expect(table.isReleased).toBe(true);
});
/* TEST_END */
