import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'https://d1s9zkxvf49wr6.cloudfront.net',
    viewportWidth: 390,
    viewportHeight: 844,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    env: {
      API_URL: 'https://nqndi6afrl.execute-api.us-east-1.amazonaws.com/staging',
    },
  },
});
