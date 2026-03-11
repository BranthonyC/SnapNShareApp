describe('Landing Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('renders hero section with CTA', () => {
    cy.contains('h1', 'Captura cada').should('be.visible');
    cy.contains('momento').should('be.visible');
    cy.contains('Crea tu evento').should('be.visible');
    cy.contains('Cómo funciona').should('be.visible');
  });

  it('renders how-it-works section', () => {
    cy.get('#como-funciona').should('exist');
    cy.contains('¿Cómo funciona?').should('be.visible');
    cy.contains('Paso 1').should('be.visible');
    cy.contains('Paso 2').should('be.visible');
    cy.contains('Paso 3').should('be.visible');
  });

  it('renders pricing section with 3 tiers', () => {
    cy.get('#precios').should('exist');
    cy.contains('Básico').should('be.visible');
    cy.contains('$1').should('be.visible');
    cy.contains('Estándar').should('be.visible');
    cy.contains('$15').should('be.visible');
    cy.contains('Premium').should('be.visible');
    cy.contains('$30').should('be.visible');
  });

  it('CTA navigates to checkout', () => {
    cy.contains('a', 'Crea tu evento').first().click();
    cy.url().should('include', '/checkout');
  });

  it('renders footer with correct links', () => {
    cy.contains('Privacidad').should('have.attr', 'href', '/privacy');
    cy.contains('Términos').should('have.attr', 'href', '/terms');
    cy.contains('Contacto').should('have.attr', 'href', 'mailto:hola@codersatelier.com');
    cy.contains('EventAlbum').should('be.visible');
  });
});
