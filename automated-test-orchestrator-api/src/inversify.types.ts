// src/inversify.types.ts

export const TYPES = {
    // Test Plan
    ITestPlanService: Symbol.for('ITestPlanService'),
    TestPlanController: Symbol.for('TestPlanController'),
    
    // Mapping
    IMappingService: Symbol.for('IMappingService'),
    MappingsController: Symbol.for('MappingsController'),

    // Credentials
    ICredentialService: Symbol.for('ICredentialService'),
    CredentialsController: Symbol.for('CredentialsController'),
    ISecureCredentialService: Symbol.for('ISecureCredentialService'),

    // Test Results
    ITestExecutionResultService: Symbol.for('ITestExecutionResultService'),
    TestExecutionResultsController: Symbol.for('TestExecutionResultsController'),
    
    // Repositories
    ITestPlanRepository: Symbol.for('ITestPlanRepository'),
    ITestPlanEntryPointRepository: Symbol.for('ITestPlanEntryPointRepository'),
    IPlanComponentRepository: Symbol.for('IPlanComponentRepository'),
    IMappingRepository: Symbol.for('IMappingRepository'),
    ITestExecutionResultRepository: Symbol.for('ITestExecutionResultRepository'),
    
    // Infrastructure
    PostgresPool: Symbol.for('PostgresPool'),
    IIntegrationPlatformServiceFactory: Symbol.for('IIntegrationPlatformServiceFactory'),
};