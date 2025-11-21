// src/application/test_plan_service.unit.test.ts

import { TestPlanService } from './test_plan_service.js';
import { ITestPlanRepository } from '../ports/i_test_plan_repository.js';
import { IPlanComponentRepository } from '../ports/i_plan_component_repository.js';
import { PlanComponent } from '../domain/plan_component.js';
import { IMappingRepository, AvailableTestInfo } from '../ports/i_mapping_repository.js';
import { IIntegrationPlatformService, ComponentInfo } from '../ports/i_integration_platform_service.js';
import { TestPlan } from '../domain/test_plan.js';
import { TestPlanWithDetails } from '../ports/i_test_plan_service.js';
import { ITestExecutionResultRepository } from '../ports/i_test_execution_result_repository.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';
import { ITestPlanEntryPointRepository } from '../ports/i_test_plan_entry_point_repository.js';
import { NotFoundError } from '../utils/app_error.js';
import { IPlatformConfig } from '../infrastructure/config.js';

// --- JEST MOCKS ---
const mockTestPlanRepo: jest.Mocked<ITestPlanRepository> = {
    save: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    deleteById: jest.fn(),
};

const mockTestPlanEntryPointRepo: jest.Mocked<ITestPlanEntryPointRepository> = {
    saveAll: jest.fn(),
};

const mockPlanComponentRepo: jest.Mocked<IPlanComponentRepository> = {
    saveAll: jest.fn(),
    findByTestPlanId: jest.fn(),
    update: jest.fn(),
};

const mockMappingRepo: jest.Mocked<IMappingRepository> = {
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
    findByPlanComponentIds: jest.fn(),
    findByFilters: jest.fn(),
};

const mockIntegrationService: jest.Mocked<IIntegrationPlatformService> = {
    getComponentInfo: jest.fn(),
    getComponentInfoAndDependencies: jest.fn(),
    executeTestProcess: jest.fn(),
};

const mockPlatformServiceFactory: jest.Mocked<IIntegrationPlatformServiceFactory> = {
    create: jest.fn(),
};

// --- MOCK CONFIG (NEW) ---
const mockConfig: IPlatformConfig = {
    pollInterval: 10,
    maxPolls: 5,
    maxRetries: 1,
    initialDelay: 10,
    concurrencyLimit: 2, // Use a small limit for testing
};

const allowAsyncOperations = () => new Promise(process.nextTick);

describe('TestPlanService', () => {
    let service: TestPlanService;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Service now includes the mockConfig
        service = new TestPlanService(
            mockConfig,
            mockTestPlanRepo,
            mockTestPlanEntryPointRepo,
            mockPlanComponentRepo,
            mockMappingRepo,
            mockTestExecutionResultRepo,
            mockPlatformServiceFactory,
        );
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('getAllPlans', () => {
        it('should return all plans with their names', async () => {
            const mockPlans: TestPlan[] = [
                { id: 'plan-1', name: 'Plan One', status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() },
                { id: 'plan-2', name: 'Plan Two', status: 'DISCOVERY_FAILED', createdAt: new Date(), updatedAt: new Date() },
            ];
            mockTestPlanRepo.findAll.mockResolvedValue(mockPlans);
            const result = await service.getAllPlans();
            expect(mockTestPlanRepo.findAll).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockPlans);
        });
    });

    describe('getPlanWithDetails', () => {
        it('should return an enriched plan with available tests as objects', async () => {
            const planId = 'plan-abc';
            const mockPlan: TestPlan = { id: planId, name: 'Detailed Plan', status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() };
            const mockComponents: PlanComponent[] = [
                { id: 'pc-1', testPlanId: planId, componentId: 'comp-A' },
                { id: 'pc-2', testPlanId: planId, componentId: 'comp-B' },
            ];
            const mockResults: any[] = [{ id: 'res-1', planComponentId: 'pc-1', testComponentId: 'test-A', status: 'SUCCESS' }];
            // UPDATED: Mappings now return AvailableTestInfo objects
            const mockMappings = new Map<string, AvailableTestInfo[]>([
                ['comp-A', [{ id: 'test-A', name: 'Test A' }, { id: 'test-A2', name: 'Test A2' }]],
                ['comp-B', [{ id: 'test-B', name: 'Test B' }]],
            ]);

            mockTestPlanRepo.findById.mockResolvedValue(mockPlan);
            mockPlanComponentRepo.findByTestPlanId.mockResolvedValue(mockComponents);
            mockTestExecutionResultRepo.findByPlanComponentIds.mockResolvedValue(mockResults);
            mockMappingRepo.findAllTestsForMainComponents.mockResolvedValue(mockMappings);

            const result = await service.getPlanWithDetails(planId) as TestPlanWithDetails;

            expect(result).not.toBeNull();
            expect(result.id).toBe(planId);
            expect(result.planComponents).toHaveLength(2);
            // UPDATED: Assertions check for the new object structure
            expect(result.planComponents[0].availableTests).toEqual([{ id: 'test-A', name: 'Test A' }, { id: 'test-A2', name: 'Test A2' }]);
            expect(result.planComponents[0].executionResults).toHaveLength(1);
            expect(result.planComponents[1].availableTests).toEqual([{ id: 'test-B', name: 'Test B' }]);
            expect(result.planComponents[1].executionResults).toHaveLength(0);
        });
    });

    describe('initiateDiscovery', () => {
        const planName = 'My Test Plan'; // ADDED: Name is now required
        const credentialProfile = 'test-profile';
        const componentIds = ['comp-A', 'comp-B'];

        it('should create a TestPlan with a name and trigger async processing', async () => {
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid' }));
            const processSpy = jest.spyOn(service as any, 'processPlanComponents').mockResolvedValue(undefined);

            // UPDATED: Pass the name parameter
            const result = await service.initiateDiscovery(planName, componentIds, credentialProfile, true);

            expect(result.name).toBe(planName); // ADDED: Check name
            expect(result.status).toBe('DISCOVERING');
            // UPDATED: Check that the name is passed to the save method
            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: planName, status: 'DISCOVERING' }));
            expect(mockTestPlanEntryPointRepo.saveAll).toHaveBeenCalled();
            expect(processSpy).toHaveBeenCalledWith(componentIds, 'plan-uuid', credentialProfile, true);
        });

        it('should update the plan to DISCOVERY_FAILED if async processing fails', async () => {
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid' }));
            const apiError = new Error("API is down");
            jest.spyOn(service as any, 'processPlanComponents').mockRejectedValue(apiError);

            await service.initiateDiscovery(planName, componentIds, credentialProfile, false);
            await allowAsyncOperations();

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'DISCOVERY_FAILED',
                failureReason: apiError.message,
            }));
        });
    });

    // `processPlanComponents` tests do not require changes as they don't deal with the new fields directly.

    describe('executeTests', () => {
        const planId = 'plan-to-execute';
        const planName = 'Execution Plan';
        const credentialProfile = 'test-profile';
        const createReadyTestPlan = (): TestPlan => ({ id: planId, name: planName, status: 'AWAITING_SELECTION', createdAt: new Date(), updatedAt: new Date() });
        const createPlanComponents = (): PlanComponent[] => [
            { id: 'pc-1', testPlanId: planId, componentId: 'comp-A' },
            { id: 'pc-2', testPlanId: planId, componentId: 'comp-B' },
        ];
        
        // UPDATED: Mappings now return AvailableTestInfo objects
        const createMappings = () => new Map<string, AvailableTestInfo[]>([
            ['comp-A', [{ id: 'test-A1', name: 'Test A1' }, { id: 'test-A2', name: 'Test A2' }]],
            ['comp-B', [{ id: 'test-B1', name: 'Test B1' }]],
        ]);

        const setupCommonMocks = () => {
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            mockPlanComponentRepo.findByTestPlanId.mockResolvedValue(createPlanComponents());
            mockMappingRepo.findAllTestsForMainComponents.mockResolvedValue(createMappings());
            mockPlatformServiceFactory.create.mockResolvedValue(mockIntegrationService);
            mockIntegrationService.executeTestProcess.mockImplementation(async (testId) => {
                // Simulate a failure for a specific test
                if (testId === 'test-A2') {
                    return { status: 'FAILURE', message: 'Assertion failed' };
                }
                return { status: 'SUCCESS', message: 'Passed' };
            });
        };

        it('should execute ALL available tests and save results with a `message` property', async () => {
            setupCommonMocks();
            await service.executeTests(planId, undefined, credentialProfile);

            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(3);
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledTimes(3);

            // UPDATED: Check for `message` property instead of `log`
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                testComponentId: 'test-A1',
                status: 'SUCCESS',
                message: 'Passed',
            }));
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                testComponentId: 'test-A2',
                status: 'FAILURE',
                message: 'Assertion failed',
            }));

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
        });

        it('should respect the concurrency limit when executing tests', async () => {
            // Arrange
            setupCommonMocks();
            let currentlyRunning = 0;
            let maxConcurrent = 0;

            // Mock the integration service with a delay to simulate real work
            mockIntegrationService.executeTestProcess.mockImplementation(async () => {
                currentlyRunning++;
                maxConcurrent = Math.max(maxConcurrent, currentlyRunning);
                await delay(20); // Simulate network latency
                currentlyRunning--;
                return { status: 'SUCCESS', message: 'Passed' };
            });

            // Act: Execute all 3 tests
            await service.executeTests(planId, undefined, credentialProfile);

            // Assert: The max concurrency should never exceed the configured limit (2)
            expect(maxConcurrent).toBe(mockConfig.concurrencyLimit);
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(3);
        });
    });

    // `deletePlan` tests do not require changes.
});

// Helper function for the new concurrency test
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));