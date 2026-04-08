// Title: Identificação Automática via QR
// Description: A identificação da mesa é feita automaticamente através do escaneamento do QR Code, redirecionando o cliente para a mesa correta.
// Category: table
// Priority: high
// Status: implemented

/* TEST_START */
it('should extract table number from QR URL', () => {
  const url = 'https://app.com/mesa/5';
  expect(extractTable(url)).toBe('5');
});
/* TEST_END */
