// src/inversify.types.ts

// This file contains only the symbols used for DI bindings.
// It has no dependencies, which prevents circular import errors.
export const TYPES = {
    ITestPlanService: Symbol.for('ITestPlanService'),
    ITestPlanRepository: Symbol.for('ITestPlanRepository'),
    IDiscoveredComponentRepository: Symbol.for('IDiscoveredComponentRepository'),
    IComponentTestMappingRepository: Symbol.for('IComponentTestMappingRepository'),
    TestPlanController: Symbol.for('TestPlanController'),
    PostgresPool: Symbol.for('PostgresPool'),
};