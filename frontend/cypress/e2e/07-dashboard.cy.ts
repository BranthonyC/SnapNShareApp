describe('Host Dashboard', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.fixture('stats').then((stats) => {
      cy.intercept('GET', `**/events/${eventId}/stats`, { statusCode: 200, body: stats }).as('getStats');
    });
    cy.fixture('media').then((media) => {
      cy.intercept('GET', `**/events/${eventId}/media*`, { statusCode: 200, body: media }).as('listMedia');
    });
    cy.intercept('GET', `**/events/${eventId}/activity*`, {
      statusCode: 200,
      body: { items: [], nextCursor: null },
    }).as('getActivity');
  });

  it('shows dashboard with stats cards', () => {
    cy.visitAdmin(eventId);
    cy.wait('@getStats');
    cy.contains('12').should('be.visible'); // upload count
    cy.contains('8').should('be.visible');  // guest count
  });

  it('navigates to edit event page', () => {
    cy.visitAdmin(eventId);
    cy.contains(/editar|configurar/i).click();
    cy.url().should('include', '/admin/edit');
  });

  it('navigates to QR page', () => {
    cy.visitAdmin(eventId);
    cy.contains(/QR|código/i).click();
    cy.url().should('include', '/admin/qr');
  });

  it('navigates to moderation page', () => {
    cy.visitAdmin(eventId);
    cy.contains(/moderación|moderar/i).click();
    cy.url().should('include', '/admin/moderation');
  });
});
