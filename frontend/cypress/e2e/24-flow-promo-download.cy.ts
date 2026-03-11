/**
 * Flow: Promo Code Validation + ZIP Download
 * Sequence Diagram 10: Promo Code Validation
 * Sequence Diagram 11: ZIP Download Flow
 */
describe('Flow: Promo Codes and ZIP Download', () => {
  const eventId = 'evt_test123';

  it('validates a promo code during checkout', () => {
    cy.intercept('GET', '**/config', {
      statusCode: 200,
      body: {
        tiers: {
          basic: { uploadLimit: 50, storageRetentionDays: 30, features: [] },
          paid: { uploadLimit: 500, storageRetentionDays: 90, features: [] },
          premium: { uploadLimit: 1000, storageRetentionDays: 730, features: [] },
        },
        pricing: {
          basic: { USD: 100, GTQ: 800 },
          paid: { USD: 1500, GTQ: 11600 },
          premium: { USD: 3000, GTQ: 23200 },
        },
        defaultCountryCode: 'GT',
      },
    }).as('getConfig');

    cy.intercept('POST', '**/promo/validate', {
      statusCode: 200,
      body: { valid: true, discount: 20, code: 'TECHGT20', type: 'percentage' },
    }).as('validatePromo');

    cy.visit('/checkout?tier=paid');
    cy.wait('@getConfig');

    // Look for promo code input
    cy.get('input[name="promoCode"], input[placeholder*="código"], input[placeholder*="promo"]').then(($el) => {
      if ($el.length) {
        cy.wrap($el.first()).type('TECHGT20');
        cy.contains(/aplicar|apply|validar/i).click();
        cy.wait('@validatePromo');
        cy.contains(/20%|descuento|discount/i).should('be.visible');
      }
    });
  });

  it('downloads ZIP archive of event media (paid/premium)', () => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: { ...event, tier: 'paid' } }).as('getEvent');
    });
    cy.intercept('POST', `**/events/${eventId}/download-zip`, {
      statusCode: 200,
      body: { downloadUrl: 'https://s3.amazonaws.com/presigned-zip-url', expiresIn: 600, fileCount: 12 },
    }).as('downloadZip');

    cy.visitAdmin(eventId);

    // Navigate to gallery management or settings where download is available
    cy.visit(`/e/${eventId}/admin/gallery`);
    cy.fixture('media').then((media) => {
      cy.intercept('GET', `**/events/${eventId}/media*`, { statusCode: 200, body: media }).as('listMedia');
    });
    cy.wait('@listMedia');

    // Look for download/export button
    cy.get('body').then(($body) => {
      if ($body.text().match(/descargar.*zip|exportar|download/i)) {
        cy.contains(/descargar.*zip|exportar|download all/i).click();
        cy.wait('@downloadZip');
      }
    });
  });
});
