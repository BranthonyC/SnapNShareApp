describe('Media View Page', () => {
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
        ],
        nextCursor: null,
      },
    }).as('listComments');
  });

  it('shows full-size image', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/media/${mediaId}`);
    cy.get('img').should('have.length.at.least', 1);
  });

  it('shows reactions bar', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/media/${mediaId}`);
    cy.contains('❤️').should('be.visible');
  });

  it('adds a reaction', () => {
    cy.intercept('POST', `**/events/${eventId}/media/${mediaId}/reactions`, {
      statusCode: 200,
      body: { emoji: '❤️', count: 4 },
    }).as('addReaction');

    cy.setToken();
    cy.visit(`/e/${eventId}/media/${mediaId}`);
    cy.contains('❤️').click();
    cy.wait('@addReaction');
  });

  it('adds a comment', () => {
    cy.intercept('POST', `**/events/${eventId}/media/${mediaId}/comments`, {
      statusCode: 200,
      body: { commentId: 'cmt_new', text: '¡Genial!', author: 'Invitado', createdAt: '2026-03-15T22:00:00Z' },
    }).as('addComment');

    cy.setToken();
    cy.visit(`/e/${eventId}/media/${mediaId}`);
    cy.get('input[placeholder*="comentario"], textarea').first().type('¡Genial!');
    cy.get('button[type="submit"], button[aria-label*="enviar"]').last().click();
    cy.wait('@addComment');
  });

  it('reports media', () => {
    cy.intercept('POST', `**/events/${eventId}/media/${mediaId}/report`, {
      statusCode: 200,
      body: { message: 'Reported' },
    }).as('reportMedia');

    cy.setToken();
    cy.visit(`/e/${eventId}/media/${mediaId}`);
    cy.contains(/reportar|report/i).click();
  });
});
