// src/app.ts

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import testPlanRoutes from './routes/test_plans.js';
import mappingRoutes from './routes/mappings.js';
import credentialRoutes from './routes/credentials.js';
import { errorHandler } from './middleware/error_handler.js';

// Create and configure the Express app
const app = express();

app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/v1/test-plans', testPlanRoutes);
app.use('/api/v1/mappings', mappingRoutes);
app.use('/api/v1/credentials', credentialRoutes); 

// Error Handling Middleware (must be last)
app.use(errorHandler);

// Export the configured app
export default app;