// src/application/test_plan_service.unit.test.ts

import { TestPlanService } from './test_plan_service.js';
import { ITestPlanRepository } from '../ports/i_test_plan_repository.js';
import { IDiscoveredComponentRepository } from '../ports/i_discovered_component_repository.js';
import { DiscoveredComponent } from '../domain/discovered_component.js';
import { IMappingRepository } from '../ports/i_mapping_repository.js';
import { IIntegrationPlatformService } from '../ports/i_integration_platform_service.js';
import { TestPlan } from '../domain/test_plan.js';
import { TestPlanWithDetails } from '../ports/i_test_plan_service.js';
import { ITestExecutionResultRepository } from '../ports/i_test_execution_result_repository.js';
import { TestExecutionResult } from '../domain/test_execution_result.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';

// --- JEST MOCKS FOR ALL REPOSITORY PORTS ---
const mockTestPlanRepo: jest.Mocked<ITestPlanRepository> = {
    save: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
};

const mockDiscoveredComponentRepo: jest.Mocked<IDiscoveredComponentRepository> = {
    saveAll: jest.fn(),
    findByTestPlanId: jest.fn(),
    update: jest.fn(),
};

const mockComponentTestMappingRepo: jest.Mocked<IMappingRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByMainComponentId: jest.fn(),
    findAll: jest.fn(),
    findAllTestsForMainComponents: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockTestExecutionResultRepo: jest.Mocked<ITestExecutionResultRepository> = {
    save: jest.fn(),
    findByDiscoveredComponentIds: jest.fn(),
};

const mockIntegrationService: jest.Mocked<IIntegrationPlatformService> = {
    getComponentInfoAndDependencies: jest.fn(),
    executeTestProcess: jest.fn(),
};

const mockPlatformServiceFactory: jest.Mocked<IIntegrationPlatformServiceFactory> = {
    create: jest.fn(),
};

// Helper for async "fire-and-forget" tasks
const allowAsyncOperations = () => new Promise(process.nextTick);

describe('TestPlanService', () => {
    let service: TestPlanService;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        service = new TestPlanService(
            mockTestPlanRepo,
            mockDiscoveredComponentRepo,
            mockComponentTestMappingRepo,
            mockTestExecutionResultRepo,
            mockPlatformServiceFactory
        );
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    // --- Test the dynamic data aggregation logic ---
    describe('getPlanWithDetails', () => {
        it('should return a plan enriched with components, available tests, and execution results', async () => {
            const planId = 'plan-abc';
            const mockPlan: TestPlan = { id: planId, rootComponentId: 'root', status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() };
            const mockComponents: DiscoveredComponent[] = [
                { id: 'dc-1', testPlanId: planId, componentId: 'comp-A' },
                { id: 'dc-2', testPlanId: planId, componentId: 'comp-B' },
            ];
            const mockResults: TestExecutionResult[] = [
                { id: 'res-1', discoveredComponentId: 'dc-1', testComponentId: 'test-A', status: 'SUCCESS', executedAt: new Date() }
            ];
            const mockMappings = new Map([['comp-A', ['test-A', 'test-A2']], ['comp-B', ['test-B']]]);

            mockTestPlanRepo.findById.mockResolvedValue(mockPlan);
            mockDiscoveredComponentRepo.findByTestPlanId.mockResolvedValue(mockComponents);
            mockTestExecutionResultRepo.findByDiscoveredComponentIds.mockResolvedValue(mockResults);
            mockComponentTestMappingRepo.findAllTestsForMainComponents.mockResolvedValue(mockMappings);

            const result = await service.getPlanWithDetails(planId) as TestPlanWithDetails;

            expect(result).not.toBeNull();
            expect(result.id).toBe(planId);
            expect(result.discoveredComponents).toHaveLength(2);
            // Check component A
            expect(result.discoveredComponents[0].availableTests).toEqual(['test-A', 'test-A2']);
            expect(result.discoveredComponents[0].executionResults).toHaveLength(1);
            // Check component B
            expect(result.discoveredComponents[1].availableTests).toEqual(['test-B']);
            expect(result.discoveredComponents[1].executionResults).toHaveLength(0);
        });
    });

    // --- Test the workflow statuses ---
    describe('initiateDiscovery', () => {
        const credentialProfile = 'test-profile';

        it('should create a TestPlan with DISCOVERING status and trigger async discovery', async () => {
            const rootComponentId = 'root-123';
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid' }));

            const discoverySpy = jest.spyOn(service, 'discoverAndSaveAllDependencies').mockResolvedValue();

            const result = await service.initiateDiscovery(rootComponentId, credentialProfile);

            expect(result.status).toBe('DISCOVERING');
            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining({ rootComponentId, status: 'DISCOVERING' }));
            expect(discoverySpy).toHaveBeenCalledWith(rootComponentId, 'plan-uuid', credentialProfile);
        });

        it('should update the plan to DISCOVERY_FAILED if the async process throws an error', async () => {
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid' }));
            const apiError = new Error("API is down");
            jest.spyOn(service, 'discoverAndSaveAllDependencies').mockRejectedValue(apiError);

            await service.initiateDiscovery('root-123', credentialProfile);
            
            await allowAsyncOperations(); // Allow the promise's catch block to execute

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'DISCOVERY_FAILED',
                failureReason: apiError.message,
            }));
        });
    });

    // --- Test the discovery logic ---
    describe('discoverAndSaveAllDependencies', () => {
        const rootId = 'root-comp';
        const planId = 'plan-uuid';
        const credentialProfile = 'test-profile';
        const testPlan: TestPlan = { id: planId, rootComponentId: rootId, status: 'DISCOVERING', createdAt: new Date(), updatedAt: new Date() };

        it('should create an integration service, save components, and update the plan', async () => {
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);
            
            mockPlatformServiceFactory.create.mockResolvedValue(mockIntegrationService);
            mockIntegrationService.getComponentInfoAndDependencies.mockResolvedValue({ id: rootId, name: 'Root', type: 'process', dependencyIds: [] });

            await service.discoverAndSaveAllDependencies(rootId, planId, credentialProfile);

            expect(mockPlatformServiceFactory.create).toHaveBeenCalledWith(credentialProfile);
            expect(mockDiscoveredComponentRepo.saveAll).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'AWAITING_SELECTION' }));
        });
    });

    // --- Test the execution result logic ---
    describe('executeTests', () => {
        const planId = 'plan-to-execute';
        const credentialProfile = 'test-profile';
        const createReadyTestPlan = (): TestPlan => ({ id: planId, rootComponentId: 'root-123', status: 'AWAITING_SELECTION', createdAt: new Date(), updatedAt: new Date() });
        const createDiscoveredComponents = (): DiscoveredComponent[] => [
            { id: 'dc-1', testPlanId: planId, componentId: 'comp-A' },
            { id: 'dc-2', testPlanId: planId, componentId: 'comp-B' },
        ];

        it('should execute tests, save each result, and mark the plan as COMPLETED', async () => {
            const testsToRun = ['test-A', 'test-B'];
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            mockDiscoveredComponentRepo.findByTestPlanId.mockResolvedValue(createDiscoveredComponents());
            mockComponentTestMappingRepo.findAllTestsForMainComponents.mockResolvedValue(new Map([['comp-A', ['test-A']], ['comp-B', ['test-B']]]));
            
            mockPlatformServiceFactory.create.mockResolvedValue(mockIntegrationService);
            mockIntegrationService.executeTestProcess.mockResolvedValue({ status: 'SUCCESS', message: 'Passed' });

            await service.executeTests(planId, testsToRun, credentialProfile);

            expect(mockPlatformServiceFactory.create).toHaveBeenCalledWith(credentialProfile);
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-A');
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-B');
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledTimes(2);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
        });
        
        it('should update plan to EXECUTION_FAILED on a system-level error', async () => {
            const systemError = new Error("Database is down");
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            
            mockPlatformServiceFactory.create.mockRejectedValue(systemError);
            
            await service.executeTests(planId, ['test-A'], credentialProfile);
            
            expect(mockTestExecutionResultRepo.save).not.toHaveBeenCalled();
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'EXECUTION_FAILED',
                failureReason: systemError.message,
            }));
        });
    });
});