describe('QR Code Page', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.intercept('GET', `**/events/${eventId}/qr-stats`, {
      statusCode: 200,
      body: { totalScans: 42, uniqueVisitors: 28 },
    }).as('getQrStats');
  });

  it('renders QR code and event title', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/qr`);
    cy.wait('@getEvent');
    cy.contains('Boda Ana & Carlos').should('be.visible');
    // QR code should be rendered (SVG or canvas)
    cy.get('svg, canvas').should('exist');
  });

  it('has download button for QR code', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/qr`);
    cy.wait('@getEvent');
    cy.contains(/descargar|download|PNG|SVG/i).should('be.visible');
  });
});
