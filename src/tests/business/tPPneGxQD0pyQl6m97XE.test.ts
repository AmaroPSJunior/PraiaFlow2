// Title: Gestão de Reembolso de Reserva
// Description: O valor da reserva (sinal) deve ser reembolsado ou debitado do consumo final. Em caso de no-show, o valor é retido.
// Category: payment
// Priority: medium
// Status: implemented

/* TEST_START */
it('should deduct reservation cost from final bill', () => {
  const bill = 100; const signal = 10;
  expect(calculateFinal(bill, signal)).toBe(90);
});
/* TEST_END */
