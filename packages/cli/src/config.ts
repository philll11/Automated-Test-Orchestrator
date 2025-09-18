// cli/src/config.ts

import dotenv from 'dotenv';

// Load environment variables from the .env file at the project root
dotenv.config();

/**
 * A centralized configuration object for the CLI.
 * It reads values from environment variables with sensible defaults.
 */
export const config = {
  /**
   * The base URL for the backend API.
   */
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000/api/v1'
};