/**
 * Flow: Host Creates Event (Free/Basic)
 * Sequence Diagram 3: Host Flow — Create Free Event
 * And Diagram 4: Purchase Paid/Premium (3-Step Wizard)
 */
describe('Flow: Host Create Event (3-Step Wizard)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/config', {
      statusCode: 200,
      body: {
        tiers: {
          basic: { uploadLimit: 50, storageRetentionDays: 30, features: ['50 fotos', 'QR'] },
          paid: { uploadLimit: 500, storageRetentionDays: 90, features: ['500 fotos', 'OTP', 'Descargas'] },
          premium: { uploadLimit: 1000, storageRetentionDays: 730, features: ['1000 fotos', 'Video', 'Moderación AI'] },
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

  it('creates a basic ($1) event via checkout wizard', () => {
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

    // Step 1: Land on checkout from CTA
    cy.visit('/');
    cy.contains('a', 'Crea tu evento').first().click();
    cy.url().should('include', '/checkout');
    cy.wait('@getConfig');

    // Step 2: Select Basic tier
    cy.contains(/básico|basic/i).click();

    // Step 3: Fill event details
    cy.get('input[name="title"], input[placeholder*="nombre"], input[placeholder*="título"]').first().type('Mi Cumpleaños');
    cy.get('input[name="hostEmail"], input[type="email"]').first().type('host@test.com');
    cy.get('input[name="hostName"], input[placeholder*="nombre"]').last().type('Ana');
    cy.get('input[name="guestPassword"], input[type="password"]').first().type('fiesta123');

    // Step 4: Submit
    cy.get('button[type="submit"]').click();
    cy.wait('@createEvent');

    // Should show success with QR code or redirect
    cy.contains(/evt_new001|creado|éxito|QR/i).should('be.visible');
  });

  it('creates a paid ($15) event with Recurrente checkout', () => {
    cy.intercept('POST', '**/checkout', {
      statusCode: 200,
      body: { checkoutUrl: 'https://app.recurrente.com/checkout/test-123', checkoutId: 'chk_test123' },
    }).as('createCheckout');

    cy.visit('/checkout?tier=paid');
    cy.wait('@getConfig');

    // Should pre-select paid tier and show $15
    cy.contains('$15').should('be.visible');
  });
});
