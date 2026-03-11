describe('Guest Authentication Flow', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
  });

  it('shows event entry page with password field', () => {
    cy.visit(`/e/${eventId}`);
    cy.wait('@getEvent');
    cy.contains('Boda Ana & Carlos').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });

  it('authenticates with correct password', () => {
    cy.fixture('event').then((event) => {
      cy.intercept('POST', `**/events/${eventId}/auth`, {
        statusCode: 200,
        body: {
          token: 'jwt-test-token',
          role: 'guest',
          nickname: 'Invitado',
          verified: false,
          event,
        },
      }).as('authEvent');
    });

    cy.visit(`/e/${eventId}`);
    cy.wait('@getEvent');
    cy.get('input[type="password"]').type('fiesta2026');
    cy.get('button[type="submit"]').click();
    cy.wait('@authEvent');
    cy.url().should('include', '/gallery');
  });

  it('shows error on wrong password', () => {
    cy.intercept('POST', `**/events/${eventId}/auth`, {
      statusCode: 401,
      body: { error: { message: 'Contraseña incorrecta', code: 'INVALID_PASSWORD' } },
    }).as('authFail');

    cy.visit(`/e/${eventId}`);
    cy.wait('@getEvent');
    cy.get('input[type="password"]').type('wrong');
    cy.get('button[type="submit"]').click();
    cy.wait('@authFail');
    cy.contains('Contraseña incorrecta').should('be.visible');
  });
});
