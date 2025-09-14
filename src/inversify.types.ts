// src/inversify.types.ts

export const TYPES = {
    // Test Plan related
    ITestPlanService: Symbol.for('ITestPlanService'),
    TestPlanController: Symbol.for('TestPlanController'),
    
    // Mapping related
    IMappingService: Symbol.for('IMappingService'),
    MappingsController: Symbol.for('MappingsController'),

    // Repositories
    ITestPlanRepository: Symbol.for('ITestPlanRepository'),
    IDiscoveredComponentRepository: Symbol.for('IDiscoveredComponentRepository'),
    IMappingRepository: Symbol.for('IMappingRepository'),
    ITestExecutionResultRepository: Symbol.for('ITestExecutionResultRepository'),
    
    // Infrastructure
    PostgresPool: Symbol.for('PostgresPool'),
};