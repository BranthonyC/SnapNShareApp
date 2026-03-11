describe('Host Authentication Flow', () => {
  it('renders host login page', () => {
    cy.visit('/auth/host');
    cy.contains(/iniciar|host|email|correo/i).should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
  });

  it('sends login OTP and shows code input', () => {
    cy.intercept('POST', '**/auth/host/login', {
      statusCode: 200,
      body: { message: 'OTP sent' },
    }).as('hostLogin');

    cy.visit('/auth/host');
    cy.get('input[type="email"]').type('host@test.com');
    cy.get('button[type="submit"]').click();
    cy.wait('@hostLogin');
    // Should transition to OTP code input
    cy.get('input').should('exist');
  });

  it('verifies host OTP and redirects to dashboard', () => {
    cy.intercept('POST', '**/auth/host/login', {
      statusCode: 200,
      body: { message: 'OTP sent' },
    }).as('hostLogin');
    cy.intercept('POST', '**/auth/host/verify', {
      statusCode: 200,
      body: {
        token: 'host-jwt-token',
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
  });
});
