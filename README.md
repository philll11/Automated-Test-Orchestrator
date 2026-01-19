# **Automated Test Orchestrator (ATO)**

The Automated Test Orchestrator is an application designed to improve the reliability and efficiency of integration development by automating the discovery and execution of tests for any given component and its entire dependency tree.

## **Table of Contents**

-   [Core Features](#core-features)
-   [Architecture Overview](#architecture-overview)
-   [Prerequisites](#prerequisites)
-   [Getting Started](#getting-started)
-   [Development Workflow](#development-workflow)
-   [Running Tests](#running-tests)
-   [Project Structure](#project-structure)
-   [Deployment & Distribution](#deployment--distribution)

## **Core Features**

-   **Dual-Mode Operation:** Choose between **Component Mode** (for dependency analysis and coverage) or **Test Mode** (for direct execution of specific test processes).
-   **Flexible Test Plan Creation:** Create test plans from a list of components, human-readable process names, or folder paths via CLI or CSV import.
-   **Automated Dependency Discovery:** Recursively discover all nested child components to build a complete dependency map.
-   **Test Coverage Analysis:** Identify all available tests for every component in a plan and highlight coverage gaps.
-   **Interactive & Full Test Execution:** Execute a specific subset of tests or intelligently run all available tests for a plan.
-   **Consolidated Reporting:** View clear, Jest-like summary reports for every test execution.
-   **Historical Analysis:** Query and analyze historical test plans and their detailed results.

## **Architecture Overview**

This repository contains two distinct, independent applications that work together:

1.  **`automated-test-orchestrator-api`**: The backend service, a Node.js/Express application built using **Hexagonal Architecture (Ports & Adapters)**. This service contains all core business logic and exposes a REST API. It is designed to be run as a containerized application via Docker.

2.  **`automated-test-orchestrator-cli`**: The user-facing client, a command-line interface written in **Go (Golang)**. It is a standalone, cross-platform binary that interacts with the `api-service`. It is compiled locally and does not require Node.js to run.

## **Prerequisites**

Before you begin, ensure you have the following installed on your machine:
-   **Git**
-   **Docker** and **Docker Compose**
-   **For the API Service:** Node.js (LTS version, e.g., v20.x or higher) & NPM
-   **For the CLI:** Go (LTS version, e.g., v1.21 or higher)

## **Getting Started**

Follow these steps to get both the backend and the CLI running on your local machine.

### **1. Clone the Repository**
```sh
git clone <your-repository-url>
cd <repository-directory>
```

### **2. Set Up & Start the Backend API**

The API runs inside Docker containers.

```sh
# 1. Navigate into the API directory
cd automated-test-orchestrator-api

# 2. Set up environment variables by copying the example
# For Windows (PowerShell)
copy .env.example .env

# For macOS/Linux
cp .env.example .env

# 3. Install Node.js dependencies
npm install

# 4. Build and start the API service and PostgreSQL database containers
docker-compose up --build
```
The `api-service` will now be running and available at `http://localhost:3000`. Keep this terminal open to see live logs.

### **3. Set Up & Install the CLI**

The Go CLI is compiled into a native executable and "installed" by placing it in a directory on your system's PATH.

```sh
# 1. In a NEW terminal, navigate into the CLI directory
cd automated-test-orchestrator-cli

# 2. Build the executable. This creates an 'ato.exe' (Windows) or 'ato' (macOS/Linux) file.
go build -o ato .

# 3. "Install" the CLI by moving the executable to a directory on your PATH.
#    (See your OS documentation for how to add a directory to your PATH if needed)

# For Windows (assuming C:\Users\YourUser\bin is in your PATH)
move ato.exe C:\Users\YourUser\bin\

# For macOS/Linux (assuming /usr/local/bin is in your PATH)
sudo mv ato /usr/local/bin/
```

### **4. Configure and Verify the CLI**

With the API running and the CLI installed, you can now configure and test the connection.

```sh
# 1. Tell the CLI where the API is running. This is saved for all future commands.
ato config set api_url http://localhost:3000/api/v1

# 2. Verify the setup by listing credential profiles (this will be empty initially)
ato creds list
```

### **API Service Tests**

First, ensure your test database credentials are set up.

```sh
# In the automated-test-orchestrator-api directory
# For Windows (PowerShell)
copy .env.test.example .env.test

# For macOS/Linux
cp .env.test.example .env.test
```
Open `.env.test` and ensure the `DB_PASSWORD` and other variables match your main `.env` file.

```sh
# In the automated-test-orchestrator-api directory

# Run all unit tests
npm run test:unit

# Run all integration tests (requires Docker database to be running)
# These run serially to prevent database race conditions
npm run test:integration

# Run all end-to-end tests (requires Docker database to be running)
npm run test:e2e
```

## **Project Structure**
```
/
├── automated-test-orchestrator-api/   # The deployable backend application
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── package.json
│   └── src/
└── automated-test-orchestrator-cli/   # The standalone Go CLI tool
    ├── go.mod
    ├── build.ps1        # Example build script for cross-compilation
    ├── main.go
    ├── cmd/
    └── internal/
```

## **Deployment & Distribution**

### **API Service**
The `api-service` is designed for containerized deployment. The multi-stage `Dockerfile` creates a lightweight, production-optimized image. This image can be pushed to a container registry (like Azure Container Registry) and deployed to a container hosting service like **Azure App Service**.

### **CLI**
The CLI is distributed as a standalone binary. To create executables for multiple platforms (cross-compilation), use the provided `build.ps1` script or run the `go build` command with the appropriate `GOOS` and `GOARCH` environment variables.

```sh
# In the automated-test-orchestrator-cli directory

# Example: Build for Windows, macOS (ARM), and Linux
.\build.ps1
```
The resulting binaries in the `dist/` folder can be shared directly with end-users.