describe('404 Not Found Page', () => {
  it('shows 404 page for unknown routes', () => {
    cy.visit('/some/random/page', { failOnStatusCode: false });
    cy.contains(/404|no encontrada|not found/i).should('be.visible');
  });

  it('has a link back to home', () => {
    cy.visit('/xyz', { failOnStatusCode: false });
    cy.get('a[href="/"]').should('exist');
  });
});
