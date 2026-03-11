describe('Gallery Management Page', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.fixture('media').then((media) => {
      cy.intercept('GET', `**/events/${eventId}/media*`, { statusCode: 200, body: media }).as('listMedia');
    });
  });

  it('shows gallery management grid', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/gallery`);
    cy.wait('@listMedia');
    cy.get('img').should('have.length.at.least', 2);
  });

  it('selects media for bulk actions', () => {
    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/gallery`);
    cy.wait('@listMedia');
    // Click on items to select them
    cy.get('input[type="checkbox"]').first().check({ force: true });
    cy.contains(/seleccionad|selected|eliminar/i).should('be.visible');
  });

  it('bulk deletes selected media', () => {
    cy.intercept('POST', `**/events/${eventId}/media/bulk-delete`, {
      statusCode: 200,
      body: { deleted: 2, failed: 0 },
    }).as('bulkDelete');

    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/gallery`);
    cy.wait('@listMedia');
    cy.get('input[type="checkbox"]').first().check({ force: true });
    cy.contains(/eliminar|delete/i).click();
    cy.wait('@bulkDelete');
  });

  it('searches media by uploader', () => {
    cy.intercept('GET', `**/events/${eventId}/media/search*`, {
      statusCode: 200,
      body: {
        items: [{
          mediaId: 'med_001',
          thumbnailUrl: 'https://via.placeholder.com/300',
          fullUrl: 'https://via.placeholder.com/800',
          fileType: 'image/jpeg',
          uploadedBy: 'María',
          uploadedAt: '2026-03-15T20:30:00Z',
          status: 'approved',
          reactionCounts: {},
          commentCount: 0,
        }],
        nextCursor: null,
        total: 1,
      },
    }).as('searchMedia');

    cy.visitAdmin(eventId);
    cy.visit(`/e/${eventId}/admin/gallery`);
    cy.wait('@listMedia');
    cy.get('input[placeholder*="buscar"], input[type="search"]').type('María');
    cy.wait('@searchMedia');
  });
});
