/**
 * Flow: Host Admin Login → Dashboard → Edit → QR → Settings → Moderation
 * Sequence Diagram 5: Host Admin Login (Email OTP)
 * Sequence Diagram 8: Content Moderation (Host Review)
 * Sequence Diagram 9: QR Scan Tracking
 */
describe('Flow: Host Admin Full Lifecycle', () => {
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
      statusCode: 200, body: { items: [], nextCursor: null },
    }).as('getActivity');
    cy.intercept('GET', `**/events/${eventId}/qr-stats`, {
      statusCode: 200, body: { totalScans: 42, uniqueVisitors: 28 },
    }).as('getQrStats');
    cy.intercept('GET', `**/events/${eventId}/storage`, {
      statusCode: 200, body: { totalBytes: 48000000, byType: { 'image/jpeg': 40000000 } },
    }).as('getStorage');
  });

  it('host login → dashboard → edit → QR → moderation → settings', () => {
    // Step 1: Host login via email OTP
    cy.intercept('POST', '**/auth/host/login', { statusCode: 200, body: { message: 'OTP sent' } }).as('hostLogin');
    cy.intercept('POST', '**/auth/host/verify', {
      statusCode: 200,
      body: {
        token: 'host-jwt',
        role: 'host',
        events: [{ eventId: 'evt_test123', title: 'Boda Ana & Carlos', status: 'active' }],
      },
    }).as('hostVerify');

    cy.visit('/auth/host');
    cy.get('input[type="email"]').type('host@test.com');
    cy.get('button[type="submit"]').click();
    cy.wait('@hostLogin');

    cy.get('input[inputmode="numeric"], input[type="text"]').first().type('123456');
    cy.get('button[type="submit"]').click();
    cy.wait('@hostVerify');

    // Step 2: Navigate to dashboard
    cy.visitAdmin(eventId);
    cy.wait('@getStats');
    cy.contains('12').should('be.visible'); // upload count

    // Step 3: Navigate to edit
    cy.visit(`/e/${eventId}/admin/edit`);
    cy.wait('@getEvent');
    cy.intercept('PATCH', `**/events/${eventId}`, { statusCode: 200, body: { message: 'Updated' } }).as('updateEvent');
    cy.get('input').first().clear().type('Boda Actualizada');
    cy.get('button[type="submit"]').click();
    cy.wait('@updateEvent');

    // Step 4: QR page
    cy.visit(`/e/${eventId}/admin/qr`);
    cy.wait('@getEvent');
    cy.get('svg, canvas').should('exist'); // QR rendered
    cy.contains(/descargar|download/i).should('be.visible');

    // Step 5: Moderation
    cy.intercept('GET', `**/events/${eventId}/media*status=pending*`, {
      statusCode: 200,
      body: {
        items: [{
          mediaId: 'med_flagged1', thumbnailUrl: 'https://via.placeholder.com/300',
          fullUrl: 'https://via.placeholder.com/800', fileType: 'image/jpeg',
          uploadedBy: 'Anónimo', uploadedAt: '2026-03-15T22:00:00Z',
          status: 'pending', reactionCounts: {}, commentCount: 0,
        }],
        nextCursor: null, total: 1,
      },
    }).as('pendingMedia');

    cy.visit(`/e/${eventId}/admin/moderation`);
    cy.wait('@pendingMedia');
    cy.intercept('POST', `**/events/${eventId}/media/med_flagged1/moderate`, {
      statusCode: 200, body: { message: 'Approved' },
    }).as('moderate');
    cy.contains(/aprobar|approve/i).first().click();
    cy.wait('@moderate');

    // Step 6: Settings
    cy.visit(`/e/${eventId}/admin/settings`);
    cy.wait('@getEvent');
    cy.get('input[type="checkbox"], [role="switch"]').should('have.length.at.least', 1);
    cy.contains(/peligro|eliminar|danger/i).should('be.visible');
  });
});
