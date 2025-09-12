-- This script sets up the initial database schema for the Boomi Automated Test Orchestrator.

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
    test_plan_id UUID NOT NULL REFERENCES test_plans(id),
    component_id VARCHAR(255) NOT NULL,
    component_name VARCHAR(255),
    mapped_test_id VARCHAR(255),
    execution_status VARCHAR(50),
    execution_log TEXT
);

-- Table: component_test_mappings
-- A persistent lookup table that maps a production Boomi component to its corresponding test component.
CREATE TABLE component_test_mappings (
    main_component_id VARCHAR(255) PRIMARY KEY,
    test_component_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Optional: Add indexes for performance
CREATE INDEX idx_discovered_components_test_plan_id ON discovered_components(test_plan_id);
