describe('Settings Page', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.intercept('GET', `**/events/${eventId}/storage`, {
      statusCode: 200,
      body: { totalBytes: 48000000, byType: { 'image/jpeg': 40000000, 'image/png': 8000000 } },
    }).as('getStorage');
  });

  it('renders settings page with toggles', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/settings`);
    cy.wait('@getEvent');
    cy.get('input[type="checkbox"], [role="switch"]').should('have.length.at.least', 1);
  });

  it('updates event settings', () => {
    cy.intercept('PATCH', `**/events/${eventId}/settings`, {
      statusCode: 200,
      body: { message: 'Updated' },
    }).as('updateSettings');

    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/settings`);
    cy.wait('@getEvent');

    // Toggle a setting
    cy.get('input[type="checkbox"], [role="switch"]').first().click();
    cy.wait('@updateSettings');
  });

  it('shows danger zone with delete option', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/settings`);
    cy.wait('@getEvent');
    cy.contains(/peligro|eliminar|danger|borrar/i).should('be.visible');
  });
});
