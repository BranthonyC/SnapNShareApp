describe('Checkout Page', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/config', {
      statusCode: 200,
      body: {
        tiers: {
          basic: { uploadLimit: 50, storageRetentionDays: 30, features: ['50 fotos', 'QR incluido'] },
          paid: { uploadLimit: 500, storageRetentionDays: 90, features: ['500 fotos', 'Descargas', 'OTP'] },
          premium: { uploadLimit: 1000, storageRetentionDays: 730, features: ['1000 fotos', 'Videos', 'Moderación AI'] },
        },
        pricing: {
          basic: { USD: 100, GTQ: 800 },
          paid: { USD: 1500, GTQ: 11600 },
          premium: { USD: 3000, GTQ: 23200 },
        },
        defaultCountryCode: 'GT',
      },
    }).as('getConfig');
  });

  it('renders checkout page with tier selection', () => {
    cy.visit('/checkout');
    cy.wait('@getConfig');
    cy.contains(/básico|basic/i).should('be.visible');
    cy.contains(/estándar|paid/i).should('be.visible');
    cy.contains(/premium/i).should('be.visible');
  });

  it('selects a tier and shows event details form', () => {
    cy.visit('/checkout');
    cy.wait('@getConfig');
    cy.contains(/estándar|paid/i).click();
    cy.get('input').should('have.length.at.least', 1);
  });

  it('navigates to checkout with tier param', () => {
    cy.visit('/checkout?tier=paid');
    cy.wait('@getConfig');
    // Should pre-select the paid tier
    cy.contains('$15').should('be.visible');
  });

  it('validates required fields before submit', () => {
    cy.visit('/checkout');
    cy.wait('@getConfig');
    cy.contains(/estándar|paid/i).click();
    // Try to submit without filling fields
    cy.get('button[type="submit"]').click();
    // Should show validation errors
    cy.get('[role="alert"], .text-red-500, .text-error').should('exist');
  });

  it('submits checkout and creates event', () => {
    cy.intercept('POST', '**/events', {
      statusCode: 201,
      body: {
        eventId: 'evt_new001',
        qrUrl: 'https://eventalbum.codersatelier.com/e/evt_new001',
        adminUrl: 'https://eventalbum.codersatelier.com/e/evt_new001/admin',
        tier: 'basic',
        uploadLimit: 50,
        expiresAt: '2026-04-28T00:00:00Z',
      },
    }).as('createEvent');

    cy.visit('/checkout');
    cy.wait('@getConfig');
    cy.contains(/básico|basic/i).click();

    // Fill event details (fields may vary)
    cy.get('input[name="title"], input[placeholder*="nombre"], input[placeholder*="título"]')
      .first().type('Mi Fiesta');
    cy.get('input[name="hostEmail"], input[type="email"]')
      .first().type('host@test.com');
    cy.get('input[name="hostName"], input[placeholder*="nombre"]')
      .last().type('Carlos');
    cy.get('input[name="guestPassword"], input[type="password"]')
      .first().type('fiesta123');

    cy.get('button[type="submit"]').click();
    cy.wait('@createEvent');
  });
});
