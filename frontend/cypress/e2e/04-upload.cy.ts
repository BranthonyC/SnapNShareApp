describe('Upload Flow', () => {
  const eventId = 'evt_test123';

  beforeEach(() => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, { statusCode: 200, body: event }).as('getEvent');
    });
    cy.intercept('POST', `**/events/${eventId}/upload-url`, {
      statusCode: 200,
      body: {
        uploadUrl: 'https://s3.amazonaws.com/presigned-url',
        mediaId: 'med_new001',
        s3Key: 'events/evt_test123/originals/med_new001.jpg',
        expiresIn: 300,
      },
    }).as('getUploadUrl');
    cy.intercept('PUT', 'https://s3.amazonaws.com/**', { statusCode: 200 }).as('s3Upload');
  });

  it('renders upload page with file picker', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/upload`);
    cy.contains(/subir|fotos|seleccionar|archivo/i).should('be.visible');
    cy.get('input[type="file"]').should('exist');
  });

  it('uploads a file via presigned URL', () => {
    cy.setToken();
    cy.visit(`/e/${eventId}/upload`);

    // Create a test image blob
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('fake-image-data'),
      fileName: 'test-photo.jpg',
      mimeType: 'image/jpeg',
    }, { force: true });

    // Should request presigned URL
    cy.wait('@getUploadUrl');

    // Should upload to S3
    cy.wait('@s3Upload');
  });

  it('shows upload limit warning when event is near capacity', () => {
    cy.fixture('event').then((event) => {
      cy.intercept('GET', `**/events/${eventId}`, {
        statusCode: 200,
        body: { ...event, uploadCount: 498, uploadLimit: 500 },
      }).as('getEventNearLimit');
    });
    cy.setToken();
    cy.visit(`/e/${eventId}/upload`);
    cy.wait('@getEventNearLimit');
    // Should show some warning about being near the limit
    cy.contains(/498|límite|quedan/i).should('be.visible');
  });
});
