-- This script sets up the initial database schema for the Automated Test Orchestrator.

-- Table: test_plans
-- Stores the master record for a single orchestration session.
CREATE TABLE test_plans (
    id UUID PRIMARY KEY,
    root_component_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Table: discovered_components
-- Stores individual components discovered during dependency analysis for a given test plan.
CREATE TABLE discovered_components (
    id UUID PRIMARY KEY,
    test_plan_id UUID NOT NULL,
    component_id VARCHAR(255) NOT NULL,
    component_name VARCHAR(255),
    component_type VARCHAR(255),
    CONSTRAINT fk_test_plan
        FOREIGN KEY(test_plan_id)
        REFERENCES test_plans(id)
        ON DELETE CASCADE
);

-- Table: mappings
-- A persistent lookup table that maps a production component to its corresponding test component.
CREATE TABLE mappings (
    id UUID PRIMARY KEY,
    main_component_id VARCHAR(255) NOT NULL,
    test_component_id VARCHAR(255) NOT NULL,
    test_component_name VARCHAR(255),
    is_deployed BOOLEAN DEFAULT FALSE,
    is_package BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

--
-- Table: test_execution_results
-- Stores the result of each individual test run
--
CREATE TABLE test_execution_results (
    id UUID PRIMARY KEY,
    test_plan_id UUID NOT NULL,
    discovered_component_id UUID NOT NULL,
    test_component_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    log TEXT,
    executed_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_test_plan
        FOREIGN KEY(test_plan_id)
        REFERENCES test_plans(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_discovered_component
        FOREIGN KEY(discovered_component_id)
        REFERENCES discovered_components(id)
        ON DELETE CASCADE
);

-- Optional: Add indexes for performance
CREATE INDEX idx_discovered_components_test_plan_id ON discovered_components(test_plan_id);
CREATE INDEX idx_test_execution_results_test_plan_id ON test_execution_results(test_plan_id);