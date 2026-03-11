// Cypress E2E support file
// Loaded before every spec

// -- Custom commands --

declare global {
  namespace Cypress {
    interface Chainable {
      /** Stub API with intercept aliases */
      stubApi(method: string, path: string, response: object, alias?: string): Chainable;
      /** Set a fake JWT token in sessionStorage */
      setToken(token?: string): Chainable;
      /** Seed a mock event and navigate to its entry */
      visitEvent(eventId?: string): Chainable;
      /** Seed a mock host session and navigate to admin */
      visitAdmin(eventId?: string): Chainable;
    }
  }
}

const DEFAULT_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJldmVudElkIjoiZXZ0X3Rlc3QxMjMiLCJyb2xlIjoiZ3Vlc3QiLCJ2ZXJpZmllZCI6dHJ1ZX0.fake';
const HOST_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJldmVudElkIjoiZXZ0X3Rlc3QxMjMiLCJyb2xlIjoiaG9zdCJ9.fake';

Cypress.Commands.add('stubApi', (method: string, path: string, response: object, alias?: string) => {
  const name = alias || path.replace(/[^a-zA-Z]/g, '');
  cy.intercept(method, `**/api${path}*`, { statusCode: 200, body: response }).as(name);
});

Cypress.Commands.add('setToken', (token?: string) => {
  cy.window().then((win) => {
    win.sessionStorage.setItem('token', token || DEFAULT_TOKEN);
  });
});

Cypress.Commands.add('visitEvent', (eventId = 'evt_test123') => {
  cy.setToken();
  cy.visit(`/e/${eventId}`);
});

Cypress.Commands.add('visitAdmin', (eventId = 'evt_test123') => {
  cy.window().then((win) => {
    win.sessionStorage.setItem('token', HOST_TOKEN);
  });
  cy.visit(`/e/${eventId}/admin`);
});

export {};
