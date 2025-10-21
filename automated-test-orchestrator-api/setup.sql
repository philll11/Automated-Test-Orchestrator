-- This script sets up the database schema for the Automated Test Orchestrator.
-- Version: 5.0

-- Table: test_plans
-- Stores the master record for a single orchestration session.
CREATE TABLE test_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Table: test_plan_entry_points
-- Stores the initial component(s) used to define a test plan.
CREATE TABLE test_plan_entry_points (
    id UUID PRIMARY KEY,
    test_plan_id UUID NOT NULL,
    component_id VARCHAR(255) NOT NULL,
    CONSTRAINT fk_test_plan
        FOREIGN KEY(test_plan_id)
        REFERENCES test_plans(id)
        ON DELETE CASCADE
);

-- Table: plan_components
-- Stores a record of each component associated with a test plan, whether directly specified or discovered via dependency analysis.
CREATE TABLE plan_components (
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
    main_component_name VARCHAR(255),
    test_component_id VARCHAR(255) NOT NULL,
    test_component_name VARCHAR(255),
    is_deployed BOOLEAN DEFAULT FALSE,
    is_packaged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT unique_mapping UNIQUE (main_component_id, test_component_id)
);

-- Table: test_execution_results
-- Stores the result of each individual test run.
CREATE TABLE test_execution_results (
    id UUID PRIMARY KEY,
    test_plan_id UUID NOT NULL,
    plan_component_id UUID NOT NULL,
    test_component_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    executed_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_test_plan
        FOREIGN KEY(test_plan_id)
        REFERENCES test_plans(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_plan_component
        FOREIGN KEY(plan_component_id)
        REFERENCES plan_components(id)
        ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX idx_plan_components_test_plan_id ON plan_components(test_plan_id);
CREATE INDEX idx_test_execution_results_test_plan_id ON test_execution_results(test_plan_id);
CREATE INDEX idx_test_plan_entry_points_test_plan_id ON test_plan_entry_points(test_plan_id);