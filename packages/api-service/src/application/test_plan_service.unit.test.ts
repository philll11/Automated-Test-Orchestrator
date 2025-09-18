// src/application/test_plan_service.unit.test.ts

import { TestPlanService } from './test_plan_service.js';
import { ITestPlanRepository } from '../ports/i_test_plan_repository.js';
import { IPlanComponentRepository } from '../ports/i_plan_component_repository.js';
import { PlanComponent } from '../domain/plan_component.js';
import { IMappingRepository } from '../ports/i_mapping_repository.js';
import { IIntegrationPlatformService, ComponentInfo } from '../ports/i_integration_platform_service.js';
import { TestPlan } from '../domain/test_plan.js';
import { TestPlanWithDetails } from '../ports/i_test_plan_service.js';
import { ITestExecutionResultRepository, NewTestExecutionResult } from '../ports/i_test_execution_result_repository.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';
import { ITestPlanEntryPointRepository } from '../ports/i_test_plan_entry_point_repository.js';

// --- JEST MOCKS FOR ALL REPOSITORY PORTS ---
const mockTestPlanRepo: jest.Mocked<ITestPlanRepository> = {
    save: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
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

const allowAsyncOperations = () => new Promise(process.nextTick);

describe('TestPlanService', () => {
    let service: TestPlanService;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        service = new TestPlanService(
            mockTestPlanRepo,
            mockTestPlanEntryPointRepo,
            mockPlanComponentRepo,
            mockMappingRepo,
            mockTestExecutionResultRepo,
            mockPlatformServiceFactory
        );
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('getAllPlans', () => {
        it('should call the repository findAll method and return its result', async () => {
            const mockPlans: TestPlan[] = [
                { id: 'plan-1', status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() },
                { id: 'plan-2', status: 'DISCOVERY_FAILED', createdAt: new Date(), updatedAt: new Date() },
            ];
            mockTestPlanRepo.findAll.mockResolvedValue(mockPlans);
            const result = await service.getAllPlans();
            expect(mockTestPlanRepo.findAll).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockPlans);
        });
    });

    describe('getPlanWithDetails', () => {
        it('should return a plan enriched with components, available tests, and execution results', async () => {
            const planId = 'plan-abc';
            const mockPlan: TestPlan = { id: planId, status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() };
            const mockComponents: PlanComponent[] = [
                { id: 'pc-1', testPlanId: planId, componentId: 'comp-A' },
                { id: 'pc-2', testPlanId: planId, componentId: 'comp-B' },
            ];
            const mockResults: any[] = [
                { id: 'res-1', planComponentId: 'pc-1', testComponentId: 'test-A', status: 'SUCCESS' }
            ];
            const mockMappings = new Map([['comp-A', ['test-A', 'test-A2']], ['comp-B', ['test-B']]]);

            mockTestPlanRepo.findById.mockResolvedValue(mockPlan);
            mockPlanComponentRepo.findByTestPlanId.mockResolvedValue(mockComponents);
            mockTestExecutionResultRepo.findByPlanComponentIds.mockResolvedValue(mockResults);
            mockMappingRepo.findAllTestsForMainComponents.mockResolvedValue(mockMappings);

            const result = await service.getPlanWithDetails(planId) as TestPlanWithDetails;

            expect(result).not.toBeNull();
            expect(result.id).toBe(planId);
            expect(result.planComponents).toHaveLength(2);
            expect(result.planComponents[0].availableTests).toEqual(['test-A', 'test-A2']);
            expect(result.planComponents[0].executionResults).toHaveLength(1);
            expect(result.planComponents[1].availableTests).toEqual(['test-B']);
            expect(result.planComponents[1].executionResults).toHaveLength(0);
        });
    });

    describe('initiateDiscovery', () => {
        const credentialProfile = 'test-profile';
        const componentIds = ['comp-A', 'comp-B'];

        it('should create a TestPlan, save entry points, and trigger async processing', async () => {
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid' }));
            const processSpy = jest.spyOn(service as any, 'processPlanComponents').mockResolvedValue(undefined);

            const result = await service.initiateDiscovery(componentIds, credentialProfile, true);

            expect(result.status).toBe('DISCOVERING');
            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'DISCOVERING' }));
            expect(mockTestPlanEntryPointRepo.saveAll).toHaveBeenCalledWith([
                expect.objectContaining({ testPlanId: 'plan-uuid', componentId: 'comp-A' }),
                expect.objectContaining({ testPlanId: 'plan-uuid', componentId: 'comp-B' }),
            ]);
            expect(processSpy).toHaveBeenCalledWith(componentIds, 'plan-uuid', credentialProfile, true);
        });

        it('should update the plan to DISCOVERY_FAILED if async processing fails', async () => {
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid' }));
            const apiError = new Error("API is down");
            jest.spyOn(service as any, 'processPlanComponents').mockRejectedValue(apiError);

            await service.initiateDiscovery(componentIds, credentialProfile, false);
            await allowAsyncOperations();

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'DISCOVERY_FAILED',
                failureReason: apiError.message,
            }));
        });
    });

    describe('processPlanComponents', () => {
        const planId = 'plan-uuid';
        const credentialProfile = 'test-profile';
        const testPlan: TestPlan = { id: planId, status: 'DISCOVERING', createdAt: new Date(), updatedAt: new Date() };
        const compAInfo: ComponentInfo = { id: 'comp-A', name: 'Comp A', type: 'process', dependencyIds: ['comp-C'] };
        const compBInfo: ComponentInfo = { id: 'comp-B', name: 'Comp B', type: 'process', dependencyIds: [] };
        const compCInfo: ComponentInfo = { id: 'comp-C', name: 'Comp C', type: 'subprocess', dependencyIds: [] };

        beforeEach(() => {
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);
            mockPlatformServiceFactory.create.mockResolvedValue(mockIntegrationService);
        });

        it('should use getComponentInfo for each ID when discoverDependencies is false (Direct Mode)', async () => {
            mockIntegrationService.getComponentInfo.mockResolvedValueOnce(compAInfo).mockResolvedValueOnce(compBInfo);

            await (service as any).processPlanComponents(['comp-A', 'comp-B'], planId, credentialProfile, false);

            expect(mockIntegrationService.getComponentInfo).toHaveBeenCalledTimes(2);
            expect(mockIntegrationService.getComponentInfo).toHaveBeenCalledWith('comp-A');
            expect(mockIntegrationService.getComponentInfo).toHaveBeenCalledWith('comp-B');
            expect(mockIntegrationService.getComponentInfoAndDependencies).not.toHaveBeenCalled();
            expect(mockPlanComponentRepo.saveAll).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ componentId: 'comp-A' }),
                expect.objectContaining({ componentId: 'comp-B' }),
            ]));
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'AWAITING_SELECTION' }));
        });

        it('should use _findAllDependenciesRecursive when discoverDependencies is true (Recursive Mode)', async () => {
            const recursiveSpy = jest.spyOn(service as any, '_findAllDependenciesRecursive').mockResolvedValue(new Map([
                ['comp-A', compAInfo], ['comp-C', compCInfo]
            ]));

            await (service as any).processPlanComponents(['comp-A'], planId, credentialProfile, true);

            expect(recursiveSpy).toHaveBeenCalledWith('comp-A', mockIntegrationService);
            expect(mockIntegrationService.getComponentInfo).not.toHaveBeenCalled();
            expect(mockPlanComponentRepo.saveAll).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ componentId: 'comp-A' }),
                expect.objectContaining({ componentId: 'comp-C' }),
            ]));
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'AWAITING_SELECTION' }));
        });
    });

    describe('executeTests', () => {
        const planId = 'plan-to-execute';
        const credentialProfile = 'test-profile';
        const createReadyTestPlan = (): TestPlan => ({ id: planId, status: 'AWAITING_SELECTION', createdAt: new Date(), updatedAt: new Date() });
        const createPlanComponents = (): PlanComponent[] => [
            { id: 'pc-1', testPlanId: planId, componentId: 'comp-A' },
            { id: 'pc-2', testPlanId: planId, componentId: 'comp-B' },
        ];

        // This helper sets up the common mocks needed for both execute tests
        const setupCommonMocks = () => {
            const planComponents = createPlanComponents();
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            mockPlanComponentRepo.findByTestPlanId.mockResolvedValue(planComponents);
            // Setup a map of all available tests for the plan
            mockMappingRepo.findAllTestsForMainComponents.mockResolvedValue(new Map([
                ['comp-A', ['test-A1', 'test-A2']],
                ['comp-B', ['test-B1']],
            ]));
            mockPlatformServiceFactory.create.mockResolvedValue(mockIntegrationService);
            mockIntegrationService.executeTestProcess.mockResolvedValue({ status: 'SUCCESS', message: 'Passed' });
        };

        it('should execute ONLY the specified tests when a list is provided', async () => {
            // Arrange
            setupCommonMocks();
            const testsToRun = ['test-A1']; // User wants to run only one specific test

            // Act
            await service.executeTests(planId, testsToRun, credentialProfile);

            // Assert
            // Verify that executeTestProcess was called only for the specified test
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(1);
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-A1');

            // Verify that only one result was saved
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledTimes(1);
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                testComponentId: 'test-A1'
            }));

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
        });

        it('should execute ALL available tests when the testsToRun parameter is undefined', async () => {
            // Arrange
            setupCommonMocks();
            const testsToRun = undefined; // Simulate the user not providing the --tests flag

            // Act
            await service.executeTests(planId, testsToRun, credentialProfile);

            // Assert
            // Verify that executeTestProcess was called for ALL 3 available tests
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(3);
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-A1');
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-A2');
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledWith('test-B1');

            // Verify that 3 results were saved
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledTimes(3);

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
        });

        it('should execute ALL available tests when the testsToRun parameter is an empty array', async () => {
            // Arrange
            setupCommonMocks();
            const testsToRun: string[] = []; // Another way the "run all" case can be triggered

            // Act
            await service.executeTests(planId, testsToRun, credentialProfile);

            // Assert
            // The result should be the same as the 'undefined' case
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(3);
            expect(mockTestExecutionResultRepo.save).toHaveBeenCalledTimes(3);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
        });

        it('should update plan to EXECUTION_FAILED on a system-level error', async () => {
            // Arrange
            const systemError = new Error("Database is down");
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            mockPlatformServiceFactory.create.mockRejectedValue(systemError);

            // Act
            await service.executeTests(planId, ['test-A'], credentialProfile);

            // Assert
            expect(mockTestExecutionResultRepo.save).not.toHaveBeenCalled();
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'EXECUTION_FAILED',
                failureReason: systemError.message,
            }));
        });
    });
});