/**
 * Full Guest Flow — Sequence Diagram 1 (a-f)
 * QR Scan → Event Load → Password Auth → Gallery → Upload → React
 */
describe('Flow: Full Guest Lifecycle (Free Event)', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: { ...event, tier: 'basic' } }).as('getEvent');
    });
    cy.fixture('media').then((media) => {
      cy.intercept('GET', `**/events/${eventId}/media*`, { statusCode: 200, body: media }).as('listMedia');
    });
    cy.intercept('POST', `**/events/${eventId}/auth`, {
      statusCode: 200,
      body: {
        token: 'jwt-guest-token',
        role: 'guest',
        nickname: 'Invitado',
        verified: true,
        event: { eventId, title: 'Boda Ana & Carlos', tier: 'basic', uploadCount: 5, uploadLimit: 50 },
      },
    }).as('authEvent');
    cy.intercept('POST', `**/events/${eventId}/upload-url`, {
      statusCode: 200,
      body: { uploadUrl: 'https://s3.amazonaws.com/presigned', mediaId: 'med_new', s3Key: 'events/evt_test123/originals/med_new.jpg', expiresIn: 300 },
    }).as('getUploadUrl');
    cy.intercept('PUT', 'https://s3.amazonaws.com/**', { statusCode: 200 }).as('s3Upload');
    cy.intercept('POST', `**/events/${eventId}/media/med_001/reactions`, {
      statusCode: 200,
      body: { emoji: '❤️', count: 4 },
    }).as('addReaction');
  });

  it('completes the full guest flow: enter → auth → gallery → upload → react', () => {
    // Step 1a: QR scan lands on event entry page
    cy.visit(`/e/${eventId}`);
    cy.wait('@getEvent');
    cy.contains('Boda Ana & Carlos').should('be.visible');

    // Step 1b: Enter password
    cy.get('input[type="password"]').type('fiesta2026');
    cy.get('button[type="submit"]').click();
    cy.wait('@authEvent');

    // Step 1c: Gallery loads with photos
    cy.url().should('include', '/gallery');
    cy.wait('@listMedia');
    cy.get('img').should('have.length.at.least', 2);

    // Step 1d: Navigate to upload and upload a photo
    cy.get('a[href*="upload"], button').filter(':visible').then(($els) => {
      const uploadEl = $els.filter((_, el) => /subir|upload/i.test(el.textContent) || el.getAttribute('aria-label')?.match(/subir|upload/i));
      if (uploadEl.length) cy.wrap(uploadEl.first()).click();
      else cy.visit(`/e/${eventId}/upload`);
    });

    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('fake-jpeg-data'),
      fileName: 'wedding-photo.jpg',
      mimeType: 'image/jpeg',
    }, { force: true });
    cy.wait('@getUploadUrl');
    cy.wait('@s3Upload');

    // Step 1f: Navigate back to gallery and react to a photo
    cy.visit(`/e/${eventId}/gallery`);
    cy.wait('@listMedia');
    cy.get('img').first().click();
    cy.url().should('include', '/media/');
    cy.contains('❤️').click();
    cy.wait('@addReaction');
  });
});
