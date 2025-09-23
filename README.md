# Automated Test Orchestrator (ATO)

The Automated Test Orchestrator is an application designed to improve the reliability and efficiency of integration development by automating the discovery and execution of tests for any given component and its entire dependency tree.

## Table of Contents

-   [Mission Statement](#mission-statement)
-   [Core Features](#core-features)
-   [Architecture Overview](#architecture-overview)
-   [Prerequisites](#prerequisites)
-   [Getting Started](#getting-started)
-   [Development Workflow](#development-workflow)
-   [Running Tests](#running-tests)
-   [Project Structure](#project-structure)
-   [Deployment](#deployment)

## Mission Statement

To design and build an application that serves as both a test execution engine and a test coverage analysis tool, improving confidence and accelerating development cycles for integration platforms.

## Core Features

-   **Flexible Test Plan Creation:** Create test plans from a list of components via CLI or CSV import.
-   **Automated Dependency Discovery:** Recursively discover all nested child components to build a complete dependency map.
-   **Test Coverage Analysis:** Identify all available tests for every component in a plan and highlight coverage gaps.
-   **Interactive & Full Test Execution:** Execute a specific subset of tests or intelligently run all available tests for a plan.
-   **Consolidated Reporting:** View clear, Jest-like summary reports for every test execution.
-   **Historical Analysis:** Query and analyze historical test plans and their detailed results.

## Architecture Overview

This project is a **monorepo** managed with NPM Workspaces, containing two primary packages:

1.  **`api-service`**: A backend Node.js/Express application built using **Hexagonal Architecture (Ports & Adapters)**. This service contains all core business logic and exposes a REST API.
2.  **`ato-cli`**: A command-line interface that acts as a client to the `api-service`, providing a user-friendly way to create plans, execute tests, and manage credentials.

The entire stack is designed to be run locally via Docker and deployed to the cloud (Azure) as a containerized application.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
-   **Node.js** (LTS version, e.g., v20.x or higher)
-   **NPM** (usually comes with Node.js)
-   **Docker** and **Docker Compose**
-   **Git**

## Getting Started

Follow these steps to get the application running on your local machine.

### 1. Clone the Repository
```sh
git clone <your-repository-url>
cd <repository-directory>
```

### 2. Set Up Environment Variables
The application uses environment variables for configuration. Create a `.env` file in the root of the project by copying the example file.

```sh
# For Windows (Command Prompt)
copy .env.example .env

# For macOS/Linux
cp .env.example .env
```
Now, open the `.env` file and fill in the required values - only the API_BASE_URL is required to run locally.

### 3. Install Dependencies
Install all dependencies for both the `api-service` and the `cli` using a single command from the project root.

```sh
npm install
```

### 4. Start the Backend Services
Run the following command from the project root to build and start the `api-service` and PostgreSQL database containers.

```sh
# Run in the foreground to see logs
docker-compose up --build

# Or, run in the background (detached mode)
docker-compose up --build -d
```
The `api-service` will be available at `http://localhost:3000`.

### 5. Build and Link the CLI
To use the `ato` command in your terminal, you need to compile the CLI and link it locally.

```sh
# 1. Build the CLI TypeScript code into JavaScript
npm run build -w ato-cli

# 2. Navigate into the CLI package directory
cd packages/cli

# 3. Create a global 'ato' command linked to your local code
npm link
```

### 6. Verify the Setup
The setup is complete! You can now interact with the running `api-service` using the CLI.

```sh
# Navigate back to the project root
cd ../..

# Test the CLI by listing credential profiles (will be empty)
ato creds list
```

## Development Workflow

The typical workflow involves two separate terminals:

1.  **Terminal 1 (Backend):** Keep the backend services running with `docker-compose up` to see live logs from the `api-service` and database.
2.  **Terminal 2 (CLI):** Use this terminal to run `ato` commands to interact with your application.

If you make changes to the `api-service` code, you will need to restart the Docker containers (`docker-compose up --build`). If you make changes to the `cli` code, you only need to rebuild it (`npm run build -w ato-cli`).

## Running Tests

Testing uses environment variables for configuration. Create a `.env.test` file in the /package/api-service directory by copying the example file.

```sh
# For Windows (Command Prompt)
copy .env.test.example .env.test

# For macOS/Linux
cp .env.test.example .env.test
```
Next, open the `.env.test` file and fill in the required values, such as credentials for your test integration platform and real component IDs you want to test.

All tests can be run from the project root directory. 

```sh
# Run all tests for all packages
npm test

# Run only unit tests for the api-service
npm run test:unit:all -w api-service

# Run only integration tests for the api-service
npm run test:int:all -w api-service

# Run only end-to-end tests for the api-service
npm run test:e2e:all -w api-service
```

## Project Structure
```
/
├── .dockerignore
├── .gitignore
├── docker-compose.yml   # Main Docker orchestration
├── docker-compose.override.yml # Local Docker configuration
├── init-dbs.sh          # Database initialization script
├── package.json         # Root package.json (manages the monorepo)
└── packages/
    ├── api-service/     # The deployable backend application
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    └── cli/             # The standalone CLI tool
        ├── package.json
        ├── tsconfig.json
        └── src/
```

## Deployment

The `api-service` is designed for containerized deployment. The multi-stage `Dockerfile` located in `packages/api-service` creates a lightweight, production-optimized image containing only the necessary runtime code.

This image can be pushed to a container registry (like Azure Container Registry) and deployed to a container hosting service like **Azure App Service**. The CLI package is **not** part of the deployment artifact.