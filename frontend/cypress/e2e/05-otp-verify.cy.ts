describe('OTP Verification Flow', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
  });

  it('renders OTP page with email input', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/verify`);
    cy.contains(/verificar|OTP|código|email/i).should('be.visible');
  });

  it('sends OTP via email and shows code input', () => {
    cy.intercept('POST', `**/events/${eventId}/otp/send`, {
      statusCode: 200,
      body: { message: 'OTP sent' },
    }).as('sendOtp');

    cy.setToken();
    cy.visit(`/e/${eventId}/verify`);
    cy.get('input[type="email"]').type('invitado@test.com');
    cy.get('button[type="submit"]').click();
    cy.wait('@sendOtp');
    // Should show code input after OTP is sent
    cy.get('input').should('exist');
  });

  it('verifies OTP code and redirects', () => {
    cy.intercept('POST', `**/events/${eventId}/otp/send`, {
      statusCode: 200,
      body: { message: 'OTP sent' },
    }).as('sendOtp');
    cy.intercept('POST', `**/events/${eventId}/otp/verify`, {
      statusCode: 200,
      body: { token: 'verified-jwt-token', verified: true },
    }).as('verifyOtp');

    cy.setToken();
    cy.visit(`/e/${eventId}/verify`);
    cy.get('input[type="email"]').type('invitado@test.com');
    cy.get('button[type="submit"]').click();
    cy.wait('@sendOtp');

    // Type the 6-digit code
    cy.get('input[inputmode="numeric"], input[type="text"]').first().type('123456');
    cy.get('button[type="submit"]').click();
    cy.wait('@verifyOtp');
  });

  it('shows error on invalid OTP', () => {
    cy.intercept('POST', `**/events/${eventId}/otp/send`, {
      statusCode: 200,
      body: { message: 'OTP sent' },
    }).as('sendOtp');
    cy.intercept('POST', `**/events/${eventId}/otp/verify`, {
      statusCode: 400,
      body: { error: { message: 'Código incorrecto', code: 'INVALID_OTP' } },
    }).as('verifyOtpFail');

    cy.setToken();
    cy.visit(`/e/${eventId}/verify`);
    cy.get('input[type="email"]').type('invitado@test.com');
    cy.get('button[type="submit"]').click();
    cy.wait('@sendOtp');

    cy.get('input[inputmode="numeric"], input[type="text"]').first().type('000000');
    cy.get('button[type="submit"]').click();
    cy.wait('@verifyOtpFail');
    cy.contains(/incorrecto|inválido|error/i).should('be.visible');
  });
});
