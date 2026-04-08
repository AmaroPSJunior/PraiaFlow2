// Title: Segregação de Responsabilidades Admin
// Description: O administrador foca na gestão do quiosque. Responsabilidades operacionais (cozinha/atendimento) são delegadas aos perfis específicos.
// Category: other
// Priority: medium
// Status: implemented

/* TEST_START */
it('should not show kitchen alerts to admin', () => {
  const view = renderAdminView();
  expect(view.queryByText('Novo Pedido na Cozinha')).toBeNull();
});
/* TEST_END */
