import { type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('--- Starting E2E Test Suite ---');
  console.log('Base URL:', config.projects[0].use.baseURL);
}

export default globalSetup;
