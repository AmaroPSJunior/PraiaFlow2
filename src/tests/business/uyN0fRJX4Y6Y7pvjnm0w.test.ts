// Title: Alerta de Chamada de Garçom
// Description: Atendentes recebem alertas sonoros e visuais imediatos quando um cliente solicita assistência ou a conta.
// Category: other
// Priority: high
// Status: implemented

/* TEST_START */
it('should play sound on new waiter call', () => {
  const spy = jest.spyOn(window.Audio.prototype, 'play');
  addNewCall();
  expect(spy).toHaveBeenCalled();
});
/* TEST_END */
