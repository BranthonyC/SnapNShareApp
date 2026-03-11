/**
 * Flow: Engagement — Reactions + Comments + Report
 * Covers Sequence 1f (React to Media) + Comment thread + Report flow
 */
describe('Flow: Media Engagement (Reactions, Comments, Report)', () => {
  const eventId = 'evt_test123';
  const mediaId = 'med_001';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.fixture('media').then((media) => {
      cy.intercept('GET', `**/events/${eventId}/media*`, { statusCode: 200, body: media }).as('listMedia');
    });
    cy.intercept('GET', `**/events/${eventId}/media/${mediaId}/comments*`, {
      statusCode: 200,
      body: {
        items: [
          { commentId: 'cmt_1', text: '¡Hermosa foto!', author: 'María', createdAt: '2026-03-15T21:00:00Z' },
          { commentId: 'cmt_2', text: 'Me encanta', author: 'Pedro', createdAt: '2026-03-15T21:05:00Z' },
        ],
        nextCursor: null,
      },
    }).as('listComments');
  });

  it('full engagement: view media → react → comment → report', () => {
    // Navigate to media view
    cy.setToken();
    cy.visit(`/e/${eventId}/media/${mediaId}`);

    // Reactions visible
    cy.contains('❤️').should('be.visible');

    // Add reaction
    cy.intercept('POST', `**/events/${eventId}/media/${mediaId}/reactions`, {
      statusCode: 200, body: { emoji: '🔥', count: 2 },
    }).as('addReaction');
    cy.contains('🔥').click();
    cy.wait('@addReaction');

    // Add comment
    cy.intercept('POST', `**/events/${eventId}/media/${mediaId}/comments`, {
      statusCode: 200,
      body: { commentId: 'cmt_new', text: '¡Increíble!', author: 'Invitado', createdAt: '2026-03-15T22:00:00Z' },
    }).as('addComment');
    cy.get('input[placeholder*="comentario"], textarea').first().type('¡Increíble!');
    cy.get('button[type="submit"], button[aria-label*="enviar"]').last().click();
    cy.wait('@addComment');

    // Report media
    cy.intercept('POST', `**/events/${eventId}/media/${mediaId}/report`, {
      statusCode: 200, body: { message: 'Reported' },
    }).as('reportMedia');
    cy.contains(/reportar|report/i).click();
  });
});
