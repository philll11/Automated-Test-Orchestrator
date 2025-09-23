// src/swagger.ts

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Automated Test Orchestrator API',
      version: '1.0.0',
      description: 'API for the Automated Test Orchestrator. This documentation is auto-generated from the source code.',
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1"
      }
    ]
  },
  apis: ['./dist/routes/*.controller.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
