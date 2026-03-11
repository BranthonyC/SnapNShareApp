describe('Edit Event Page', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
  });

  it('renders edit form with pre-filled data', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/edit`);
    cy.wait('@getEvent');
    cy.get('input').should('have.length.at.least', 1);
  });

  it('saves event updates', () => {
    cy.intercept('PATCH', `**/events/${eventId}`, {
      statusCode: 200,
      body: { message: 'Updated' },
    }).as('updateEvent');

    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/edit`);
    cy.wait('@getEvent');

    // Find and modify title field
    cy.get('input').first().clear().type('Boda Ana & Carlos - Actualizado');
    cy.get('button[type="submit"]').click();
    cy.wait('@updateEvent');
  });
});
