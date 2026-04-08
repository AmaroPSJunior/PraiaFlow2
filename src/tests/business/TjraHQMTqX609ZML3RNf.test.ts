// Title: Liberação Automática de Mesa
// Description: Ao realizar o logout (saída) do sistema, a mesa ocupada pelo cliente deve ser automaticamente liberada (currentUserId = null).
// Category: table
// Priority: high
// Status: implemented

/* TEST_START */
it('should clear table on logout', async () => {
  await handleLogout();
  const table = await getTable(tableId);
  expect(table.currentUserId).toBeNull();
});
/* TEST_END */
