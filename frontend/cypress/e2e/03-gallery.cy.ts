describe('Gallery Page', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.fixture('media').then((media) => {
      cy.intercept('GET', `**/events/${eventId}/media*`, { statusCode: 200, body: media }).as('listMedia');
    });
  });

  it('shows gallery grid with photos', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/gallery`);
    cy.wait('@listMedia');
    cy.get('img').should('have.length.at.least', 2);
  });

  it('shows upload FAB button', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/gallery`);
    cy.wait('@listMedia');
    // Look for a button/link to upload
    cy.get('a[href*="upload"], button').filter(':contains("Subir"), :contains("upload"), [aria-label*="upload"], [aria-label*="Subir"]').should('exist');
  });

  it('navigates to media view on photo click', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/gallery`);
    cy.wait('@listMedia');
    cy.get('img').first().click();
    cy.url().should('include', '/media/');
  });

  it('shows empty state when no media', () => {
    cy.intercept('GET', `**/events/${eventId}/media*`, {
      statusCode: 200,
      body: { items: [], nextCursor: null, total: 0 },
    }).as('emptyMedia');
    cy.setToken();
    cy.visit(`/e/${eventId}/gallery`);
    cy.wait('@emptyMedia');
    cy.contains(/no hay|vacío|sube|primera/i).should('be.visible');
  });
});
