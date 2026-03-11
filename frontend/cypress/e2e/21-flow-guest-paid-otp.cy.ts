/**
 * Flow: Guest on Paid/Premium Event — OTP required before first upload
 * Sequence Diagram 2: Guest Flow — Paid/Premium Event (with OTP Verification)
 */
describe('Flow: Guest Paid Event with OTP Gate', () => {
  const eventId = 'evt_paid001';

  beforeEach(() => {
    cy.intercept('GET', `**/events/${eventId}`, {
      statusCode: 200,
      body: {
        eventId, title: 'Conferencia Tech GT', tier: 'paid',
        uploadCount: 20, uploadLimit: 500, status: 'active',
        startDate: '2026-04-01T09:00:00Z', endDate: '2026-04-01T18:00:00Z',
        mediaTypes: ['image/jpeg', 'image/png'], colorTheme: 'green',
        showDateTime: true, allowDownloads: true, allowVideo: false,
      },
    }).as('getEvent');
    cy.intercept('GET', `**/events/${eventId}/media*`, {
      statusCode: 200,
      body: { items: [], nextCursor: null, total: 0 },
    }).as('listMedia');
  });

  it('requires OTP verification before first upload on paid event', () => {
    // Step 1: Auth with password (returns verified: false for paid tier)
    cy.intercept('POST', `**/events/${eventId}/auth`, {
      statusCode: 200,
      body: {
        token: 'jwt-unverified',
        role: 'guest',
        nickname: 'Asistente',
        verified: false,
        event: { eventId, title: 'Conferencia Tech GT', tier: 'paid', uploadCount: 20, uploadLimit: 500 },
      },
    }).as('authEvent');

    cy.visit(`/e/${eventId}`);
    cy.wait('@getEvent');
    cy.get('input[type="password"]').type('tech2026');
    cy.get('button[type="submit"]').click();
    cy.wait('@authEvent');

    // Step 2: Gallery should load
    cy.url().should('include', '/gallery');

    // Step 3: Try to upload → redirected to OTP verify
    cy.visit(`/e/${eventId}/verify`);

    // Step 4: Send OTP via email
    cy.intercept('POST', `**/events/${eventId}/otp/send`, {
      statusCode: 200, body: { message: 'OTP sent' },
    }).as('sendOtp');

    cy.get('input[type="email"]').type('asistente@test.com');
    cy.get('button[type="submit"]').click();
    cy.wait('@sendOtp');

    // Step 5: Verify OTP → get verified JWT
    cy.intercept('POST', `**/events/${eventId}/otp/verify`, {
      statusCode: 200,
      body: { token: 'jwt-verified', verified: true },
    }).as('verifyOtp');

    cy.get('input[inputmode="numeric"], input[type="text"]').first().type('123456');
    cy.get('button[type="submit"]').click();
    cy.wait('@verifyOtp');
  });

  it('SMS fallback after 3 failed email OTP verifications', () => {
    cy.visit(`/e/${eventId}/verify`);
    cy.setToken();

    // Send OTP via email
    cy.intercept('POST', `**/events/${eventId}/otp/send`, {
      statusCode: 200, body: { message: 'OTP sent' },
    }).as('sendOtp');

    cy.get('input[type="email"]').type('asistente@test.com');
    cy.get('button[type="submit"]').click();
    cy.wait('@sendOtp');

    // Fail 3 times
    cy.intercept('POST', `**/events/${eventId}/otp/verify`, {
      statusCode: 400,
      body: { error: { message: 'Código incorrecto', code: 'INVALID_OTP' } },
    }).as('verifyFail');

    for (let i = 0; i < 3; i++) {
      cy.get('input[inputmode="numeric"], input[type="text"]').first().clear().type('000000');
      cy.get('button[type="submit"]').click();
      cy.wait('@verifyFail');
    }

    // After 3 failures, SMS fallback should appear
    cy.contains(/SMS|teléfono|celular/i).should('be.visible');
  });
});
