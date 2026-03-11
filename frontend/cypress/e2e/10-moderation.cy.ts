describe('Moderation Page', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.intercept('GET', `**/events/${eventId}/media*status=pending*`, {
      statusCode: 200,
      body: {
        items: [
          {
            mediaId: 'med_flagged1',
            thumbnailUrl: 'https://via.placeholder.com/300',
            fullUrl: 'https://via.placeholder.com/800',
            fileType: 'image/jpeg',
            uploadedBy: 'Anónimo',
            uploadedAt: '2026-03-15T22:00:00Z',
            status: 'pending',
            reactionCounts: {},
            commentCount: 0,
          },
        ],
        nextCursor: null,
        total: 1,
      },
    }).as('pendingMedia');
  });

  it('shows pending media for review', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/moderation`);
    cy.wait('@pendingMedia');
    cy.get('img').should('have.length.at.least', 1);
  });

  it('approves a flagged media item', () => {
    cy.intercept('POST', `**/events/${eventId}/media/med_flagged1/moderate`, {
      statusCode: 200,
      body: { message: 'Approved' },
    }).as('moderate');

    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/moderation`);
    cy.wait('@pendingMedia');
    cy.contains(/aprobar|approve/i).first().click();
    cy.wait('@moderate');
  });

  it('rejects a flagged media item', () => {
    cy.intercept('POST', `**/events/${eventId}/media/med_flagged1/moderate`, {
      statusCode: 200,
      body: { message: 'Rejected' },
    }).as('moderate');

    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/moderation`);
    cy.wait('@pendingMedia');
    cy.contains(/rechazar|reject/i).first().click();
    cy.wait('@moderate');
  });
});
