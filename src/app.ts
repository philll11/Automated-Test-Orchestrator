// src/app.ts

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';
import testPlanRoutes from './routes/test-plans';
import { errorHandler } from './middleware/error_handler';

// Create and configure the Express app
const app = express();

app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/v1/test-plans', testPlanRoutes);

// Error Handling Middleware (must be last)
app.use(errorHandler);

// Export the configured app
export default app;