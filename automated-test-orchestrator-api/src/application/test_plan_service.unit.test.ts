// src/application/test_plan_service.unit.test.ts

import { TestPlanService } from './test_plan_service.js';
import { ITestPlanRepository } from '../ports/i_test_plan_repository.js';
import { IPlanComponentRepository } from '../ports/i_plan_component_repository.js';
import { PlanComponent } from '../domain/plan_component.js';
import { IMappingRepository, AvailableTestInfo } from '../ports/i_mapping_repository.js';
import { IIntegrationPlatformService } from '../ports/i_integration_platform_service.js';
import { TestPlan, TestPlanStatus, TestPlanType } from '../domain/test_plan.js';
import { TestPlanWithDetails } from '../ports/i_test_plan_service.js';
import { ITestExecutionResultRepository } from '../ports/i_test_execution_result_repository.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';
import { ITestPlanEntryPointRepository } from '../ports/i_test_plan_entry_point_repository.js';
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
    findByComponentIds: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockTestExecutionResultRepo: jest.Mocked<ITestExecutionResultRepository> = {
    save: jest.fn(),
    findByPlanComponentIds: jest.fn(),
    findByFilters: jest.fn(),
    deleteByTestPlanId: jest.fn(),
};

const mockIntegrationService: jest.Mocked<IIntegrationPlatformService> = {
    getComponentInfo: jest.fn(),
    getComponentInfoAndDependencies: jest.fn(),
    executeTestProcess: jest.fn(),
    searchComponents: jest.fn(),
};

const mockPlatformServiceFactory: jest.Mocked<IIntegrationPlatformServiceFactory> = {
    createService: jest.fn(),
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
                { id: 'plan-1', name: 'Plan One', planType: TestPlanType.COMPONENT, status: TestPlanStatus.COMPLETED, createdAt: new Date(), updatedAt: new Date() },
                { id: 'plan-2', name: 'Plan Two', planType: TestPlanType.COMPONENT, status: TestPlanStatus.DISCOVERY_FAILED, createdAt: new Date(), updatedAt: new Date() },
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
            const mockPlan: TestPlan = { id: planId, name: 'Detailed Plan', planType: TestPlanType.COMPONENT, status: TestPlanStatus.COMPLETED, createdAt: new Date(), updatedAt: new Date() };
            const mockComponents: PlanComponent[] = [
                { id: 'pc-1', testPlanId: planId, componentId: 'comp-A', sourceType: 'Boomi' },
                { id: 'pc-2', testPlanId: planId, componentId: 'comp-B', sourceType: 'Boomi' },
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

        beforeEach(() => {
            mockPlatformServiceFactory.createService.mockResolvedValue(mockIntegrationService);
            mockIntegrationService.searchComponents.mockResolvedValue([
                { id: 'comp-A', name: 'Comp A', type: 'process', dependencyIds: [] },
                { id: 'comp-B', name: 'Comp B', type: 'process', dependencyIds: [] }
            ]);
        });

        it('should create a TestPlan with a name and trigger async processing', async () => {
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid' }));
            const processSpy = jest.spyOn(service as any, 'processPlanComponents').mockResolvedValue(undefined);

            // UPDATED: Pass the name parameter
            const result = await service.initiateDiscovery(planName, TestPlanType.COMPONENT, { compIds: componentIds }, credentialProfile, true);

            expect(result.name).toBe(planName); // ADDED: Check name
            expect(result.status).toBe(TestPlanStatus.DISCOVERING);
            // UPDATED: Check that the name is passed to the save method
            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: planName, planType: TestPlanType.COMPONENT, status: TestPlanStatus.DISCOVERING }));
            expect(mockTestPlanEntryPointRepo.saveAll).toHaveBeenCalled();
            // Checking first arg is array of ComponentInfo, checking by IDs
            const expectedResolvedComponents = [
                expect.objectContaining({ id: 'comp-A' }),
                expect.objectContaining({ id: 'comp-B' })
            ];
            expect(processSpy).toHaveBeenCalledWith(expectedResolvedComponents, 'plan-uuid', credentialProfile, true);
        });

        it('should handle errors in async processing and update TestPlan status', async () => {
            const apiError = new Error('Integration API failure');
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-fail' }));
            
            // Spy on internal method to simulate async error
            jest.spyOn(service as any, 'processPlanComponents').mockRejectedValue(apiError);

            await service.initiateDiscovery(planName, TestPlanType.COMPONENT, { compIds: componentIds }, credentialProfile, false);

            await allowAsyncOperations(); // Wait for promise chain

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                id: 'plan-fail',
                status: TestPlanStatus.DISCOVERY_FAILED,
                failureReason: 'Integration API failure'
            }));
        });

        it('should correctly map inputs to ComponentSearchCriteria', async () => {
            const inputs = {
                compIds: ['id-1'],
                compNames: ['Process A'],
                compFolderNames: ['Folder X']
            };
            
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-criteria-uuid' }));
            // Mock successful search so we don't fail on validation
            mockIntegrationService.searchComponents.mockResolvedValue([
                { id: 'id-1', name: 'Existing Process', type: 'process', dependencyIds: [] },
                { id: 'id-2', name: 'Process A', type: 'process', dependencyIds: [] }
            ]);

            await service.initiateDiscovery(planName, TestPlanType.COMPONENT, inputs, credentialProfile, false);

            expect(mockIntegrationService.searchComponents).toHaveBeenCalledWith(expect.objectContaining({
                ids: ['id-1'],
                names: ['Process A'],
                folderNames: ['Folder X'],
                exactNameMatch: true,
                types: undefined
            }));
        });

        it('should enforce type filtering when in TEST mode', async () => {
            const inputs = { compNames: ['My Test'] };
            
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-test-criteria' }));
            mockIntegrationService.searchComponents.mockResolvedValue([
                { id: 'test-1', name: 'My Test', type: 'process', dependencyIds: [] }
            ]);

            await service.initiateDiscovery(planName, TestPlanType.TEST, inputs, credentialProfile, false);

            expect(mockIntegrationService.searchComponents).toHaveBeenCalledWith(expect.objectContaining({
                types: ['process']
            }));
        });

        it('should throw an error if a requested Name is not found', async () => {
            const inputs = { compNames: ['Missing Process', 'Found Process'] };
            
            mockIntegrationService.searchComponents.mockResolvedValue([
                 { id: 'found-1', name: 'Found Process', type: 'process', dependencyIds: [] }
            ]);
            
            await expect(service.initiateDiscovery(planName, TestPlanType.COMPONENT, inputs, credentialProfile, false))
                .rejects
                .toThrow(/Could not resolve the following names/);
        });
    });

    describe('initiateDiscovery (TEST Mode)', () => {
        const planName = 'Test-Only Plan';
        const testIds = ['test-1', 'test-2'];
        const credentialProfile = 'test-profile';

        beforeEach(() => {
            mockPlatformServiceFactory.createService.mockResolvedValue(mockIntegrationService);
            mockIntegrationService.searchComponents.mockResolvedValue([
                { id: 'test-1', name: 'Test 1', type: 'process', dependencyIds: [] },
                { id: 'test-2', name: 'Test 2', type: 'process', dependencyIds: [] }
            ]);
        });

        it('should create a TestPlan in TEST mode and trigger processTestModeComponents', async () => {
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-test-uuid' }));
            // Spy on the test mode processing method
            const processTestSpy = jest.spyOn(service as any, 'processTestModeComponents').mockResolvedValue(undefined);
            const processComponentSpy = jest.spyOn(service as any, 'processPlanComponents');

            await service.initiateDiscovery(planName, TestPlanType.TEST, { compIds: testIds }, credentialProfile, false);

            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                name: planName,
                planType: TestPlanType.TEST
            }));

            // Should call TEST handler, NOT COMPONENT handler
            const expectedResolvedComponents = [
                expect.objectContaining({ id: 'test-1' }),
                expect.objectContaining({ id: 'test-2' })
            ];
            expect(processTestSpy).toHaveBeenCalledWith(expectedResolvedComponents, 'plan-test-uuid', credentialProfile);
            expect(processComponentSpy).not.toHaveBeenCalled();
        });
    });


    // `processPlanComponents` tests do not require changes as they don't deal with the new fields directly.

    describe('runTestExecution', () => {
        const planId = 'plan-to-execute';
        const planName = 'Execution Plan';
        const credentialProfile = 'test-profile';
        const createReadyTestPlan = (): TestPlan => ({ id: planId, name: planName, planType: TestPlanType.COMPONENT, status: TestPlanStatus.AWAITING_SELECTION, createdAt: new Date(), updatedAt: new Date() });
        const createPlanComponents = (): PlanComponent[] => [
            { id: 'pc-1', testPlanId: planId, componentId: 'comp-A', sourceType: 'Boomi' },
            { id: 'pc-2', testPlanId: planId, componentId: 'comp-B', sourceType: 'Boomi' },
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
            mockPlatformServiceFactory.createService.mockResolvedValue(mockIntegrationService);
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
            await service.runTestExecution(planId, undefined, credentialProfile);

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

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: TestPlanStatus.COMPLETED }));
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
            await service.runTestExecution(planId, undefined, credentialProfile);

            // Assert: The max concurrency should never exceed the configured limit (2)
            expect(maxConcurrent).toBe(mockConfig.concurrencyLimit);
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(3);
        });

        it('should execute tests directly in TEST mode without looking up mappings', async () => {
            // Arrange
            const testModePlan: TestPlan = { 
                id: 'plan-test-mode', 
                name: 'Direct Execution Plan', 
                planType: TestPlanType.TEST, 
                status: TestPlanStatus.AWAITING_SELECTION, 
                createdAt: new Date(), 
                updatedAt: new Date() 
            };
            
            // In TEST mode, componentId IS the testId
            const testComponents: PlanComponent[] = [
                { id: 'pc-1', testPlanId: 'plan-test-mode', componentId: 'test-direct-1', sourceType: 'ARG' },
                { id: 'pc-2', testPlanId: 'plan-test-mode', componentId: 'test-direct-2', sourceType: 'ARG' },
            ];

            mockTestPlanRepo.findById.mockResolvedValue(testModePlan);
            mockPlanComponentRepo.findByTestPlanId.mockResolvedValue(testComponents);
            mockPlatformServiceFactory.createService.mockResolvedValue(mockIntegrationService);
            
            // Mock successful execution
            mockIntegrationService.executeTestProcess.mockResolvedValue({ status: 'SUCCESS', message: 'Direct execution passed' });

            // Act
            await service.runTestExecution('plan-test-mode', undefined, credentialProfile);

            // Assert
            // Should NOT have called mapping repo for tests
            expect(mockMappingRepo.findAllTestsForMainComponents).not.toHaveBeenCalled();
            
            // Should have executed both tests directly
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(2);
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-direct-1');
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-direct-2');

            // Should have saved results
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledTimes(2);
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                testPlanId: 'plan-test-mode', 
                testComponentId: 'test-direct-1',
                status: 'SUCCESS'
            }));
        });
    });

    // `deletePlan` tests do not require changes.
});

// Helper function for the new concurrency test
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));