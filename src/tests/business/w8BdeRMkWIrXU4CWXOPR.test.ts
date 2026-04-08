// Title: Auto-Promoção de Administrador
// Description: Usuários com o e-mail 'arcamos.j@gmail.com' são automaticamente promovidos ao cargo de 'admin' no primeiro login.
// Category: auth
// Priority: high
// Status: implemented

/* TEST_START */
it('should set role to admin for master email', () => {
  const user = { email: 'arcamos.j@gmail.com' };
  const profile = getProfile(user);
  expect(profile.role).toBe('admin');
});
/* TEST_END */
