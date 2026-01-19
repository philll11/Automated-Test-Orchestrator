// jest.setup.ts
import dotenv from 'dotenv';
import path from 'path';

// The path should be relative to the project's root directory.
const envPath = path.resolve(process.cwd(), '.env.test');

// Load the environment file
dotenv.config({ path: envPath });