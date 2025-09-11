// src/application/test_plan_service.test.ts

import { TestPlanService, BoomiServiceFactory } from './test_plan_service';
import { ITestPlanRepository } from '../ports/i_test_plan_repository';
import { IDiscoveredComponentRepository } from '../ports/i_discovered_component_repository';
import { DiscoveredComponent } from '../domain/discovered_component';
import { IComponentTestMappingRepository } from '../ports/i_component_test_mapping_repository';
import { IBoomiService, BoomiCredentials, ComponentInfoAndDependencies } from '../ports/i_boomi_service';
import { TestPlan } from '../domain/test_plan';

// Use jest.mock() to create automatic mocks of our interfaces
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

const mockComponentTestMappingRepo: jest.Mocked<IComponentTestMappingRepository> = {
    findTestMapping: jest.fn(),
    findAllTestMappings: jest.fn(),
};

const mockBoomiService: jest.Mocked<IBoomiService> = {
    getComponentInfoAndDependencies: jest.fn(),
    executeTestProcess: jest.fn(),
};

// Mock the Boomi Service Factory
const mockBoomiServiceFactory: jest.Mocked<BoomiServiceFactory> = jest.fn(() => mockBoomiService);

// A helper to allow async "fire-and-forget" tasks to complete within a test
const allowAsyncOperations = () => new Promise(process.nextTick);

describe('TestPlanService', () => {
    let service: TestPlanService;
    const dummyCredentials: BoomiCredentials = { accountId: 'test', username: 'test', password_or_token: 'test' };

    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        service = new TestPlanService(
            mockTestPlanRepo,
            mockDiscoveredComponentRepo,
            mockComponentTestMappingRepo,
            mockBoomiServiceFactory
        );
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('initiateDiscovery', () => {
        it('should create a TestPlan with PENDING status, save it, and return it immediately', async () => {
            const rootComponentId = 'root-123';
            const partialTestPlan = { rootComponentId, status: 'PENDING' };
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid', createdAt: new Date(), updatedAt: new Date() }));
            const result = await service.initiateDiscovery(rootComponentId, dummyCredentials);
            expect(result.id).toBe('plan-uuid');
            expect(result.status).toBe('PENDING');
            expect(mockTestPlanRepo.save).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining(partialTestPlan));
        });

        it('should trigger the asynchronous discovery process in the background', async () => {
            const discoverySpy = jest.spyOn(service, 'discoverAndSaveAllDependencies');
            mockTestPlanRepo.save.mockResolvedValue({ id: 'plan-uuid', rootComponentId: 'root-123', status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
            await service.initiateDiscovery('root-123', dummyCredentials);
            expect(discoverySpy).toHaveBeenCalledTimes(1);
            expect(discoverySpy).toHaveBeenCalledWith('root-123', 'plan-uuid', dummyCredentials);
        });
    });

    describe('discoverAndSaveAllDependencies (The Async Process)', () => {
        const rootId = 'root-comp';
        const childId1 = 'child-comp-1';
        const childId2 = 'child-comp-2';
        const grandChildId = 'grand-child-comp';
        const testPlan: TestPlan = { id: 'plan-uuid', rootComponentId: rootId, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() };

        it('should find all dependencies, save them with names and PENDING status, and update plan to AWAITING_SELECTION', async () => {
            // --- Arrange: Setup all mock return values ---
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);

            // Mock the dependency graph with the correct return structure
            mockBoomiService.getComponentInfoAndDependencies
                .mockImplementation(async (id: string): Promise<ComponentInfoAndDependencies | null> => {
                    switch (id) {
                        case rootId: return { name: 'Root Component', dependencyIds: [childId1, childId2] };
                        case childId1: return { name: 'Child Component 1', dependencyIds: [grandChildId] };
                        case childId2: return { name: 'Child Component 2', dependencyIds: [] };
                        case grandChildId: return { name: 'GrandChild Component', dependencyIds: [] };
                        default: return null;
                    }
                });

            const mappings = new Map<string, string>([[childId1, 'test-for-child-1']]);
            mockComponentTestMappingRepo.findAllTestMappings.mockResolvedValue(mappings);

            // --- Act ---
            await service.discoverAndSaveAllDependencies(rootId, testPlan.id, dummyCredentials);

            // --- Assert ---
            expect(mockDiscoveredComponentRepo.saveAll).toHaveBeenCalledTimes(1);
            const savedComponents: DiscoveredComponent[] = mockDiscoveredComponentRepo.saveAll.mock.calls[0][0];
            expect(savedComponents.length).toBe(4);

            const rootComponent = savedComponents.find(c => c.componentId === rootId);
            const child1Component = savedComponents.find(c => c.componentId === childId1);

            // Verify component names are saved correctly
            expect(rootComponent?.componentName).toBe('Root Component');
            expect(child1Component?.componentName).toBe('Child Component 1');

            // Verify the default execution status is PENDING for all components
            expect(savedComponents.every(c => c.executionStatus === 'PENDING')).toBe(true);
            
            // Verify test mappings were applied correctly
            expect(child1Component?.mappedTestId).toBe('test-for-child-1');
            expect(rootComponent?.mappedTestId).toBeUndefined();

            // Verify the final plan status update
            expect(mockTestPlanRepo.update).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                id: testPlan.id,
                status: 'AWAITING_SELECTION',
            }));
        });

        it('should handle circular dependencies without an infinite loop', async () => {
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);

            // Mock a circular dependency with the correct return structure
            mockBoomiService.getComponentInfoAndDependencies
                .mockImplementation(async (id: string): Promise<ComponentInfoAndDependencies | null> => {
                    switch (id) {
                        case rootId: return { name: 'Root Component', dependencyIds: [childId1] };
                        case childId1: return { name: 'Child Component 1', dependencyIds: [rootId] };
                        default: return null;
                    }
                });

            mockComponentTestMappingRepo.findAllTestMappings.mockResolvedValue(new Map());
            await service.discoverAndSaveAllDependencies(rootId, testPlan.id, dummyCredentials);

            expect(mockBoomiService.getComponentInfoAndDependencies).toHaveBeenCalledTimes(2);
            expect(mockBoomiService.getComponentInfoAndDependencies).toHaveBeenCalledWith(rootId);
            expect(mockBoomiService.getComponentInfoAndDependencies).toHaveBeenCalledWith(childId1);

            expect(mockDiscoveredComponentRepo.saveAll).toHaveBeenCalledTimes(1);
            const savedComponents = mockDiscoveredComponentRepo.saveAll.mock.calls[0][0];
            expect(savedComponents.length).toBe(2);
        });

        it('should update the test plan status to FAILED if the Boomi service throws an error', async () => {
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);
            const apiError = new Error("Boomi API is down");
            mockBoomiService.getComponentInfoAndDependencies.mockRejectedValue(apiError);

            // Use a try-catch to swallow the error that the service re-throws, allowing us to assert on the aftermath
            try {
                await service.discoverAndSaveAllDependencies(rootId, testPlan.id, dummyCredentials);
            } catch (e) {
                // Expected to throw
            }

            expect(mockDiscoveredComponentRepo.saveAll).not.toHaveBeenCalled();
            expect(mockTestPlanRepo.update).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                id: testPlan.id,
                status: 'FAILED',
            }));
        });
    });

    // --- This describe block is mostly correct, with a minor data model update ---
    describe('executeTests', () => {
        const dummyAtomId = 'test-atom-123';
        const planId = 'plan-to-execute';
        const createReadyTestPlan = (): TestPlan => ({
            id: planId,
            rootComponentId: 'root-123',
            status: 'AWAITING_SELECTION',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Added componentName and executionStatus for data model consistency
        const createDiscoveredComponents = (): DiscoveredComponent[] => [
            { id: 'dc-1', testPlanId: planId, componentId: 'comp-A', componentName: 'Comp A', mappedTestId: 'test-A', executionStatus: 'PENDING' },
            { id: 'dc-2', testPlanId: planId, componentId: 'comp-B', componentName: 'Comp B', mappedTestId: 'test-B', executionStatus: 'PENDING' },
            { id: 'dc-3', testPlanId: planId, componentId: 'comp-C', componentName: 'Comp C', mappedTestId: undefined, executionStatus: 'PENDING' },
            { id: 'dc-4', testPlanId: planId, componentId: 'comp-D', componentName: 'Comp D', mappedTestId: 'test-D', executionStatus: 'PENDING' },
        ];

        it('should update statuses correctly, execute all selected tests, and mark the plan as COMPLETED', async () => {
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            mockDiscoveredComponentRepo.findByTestPlanId.mockResolvedValue(createDiscoveredComponents());
            const testsToRun = ['test-A', 'test-B'];
            mockBoomiService.executeTestProcess.mockResolvedValue({ status: 'SUCCESS', message: 'All good!' });

            await service.executeTests(planId, testsToRun, dummyCredentials, dummyAtomId);

            expect(mockTestPlanRepo.update).toHaveBeenCalledTimes(2);
            expect(mockTestPlanRepo.update.mock.calls[0][0]).toEqual(expect.objectContaining({ status: 'EXECUTING' }));
            expect(mockTestPlanRepo.update.mock.calls[1][0]).toEqual(expect.objectContaining({ status: 'COMPLETED' }));
            expect(mockBoomiService.executeTestProcess).toHaveBeenCalledTimes(2);
            expect(mockDiscoveredComponentRepo.update).toHaveBeenCalledTimes(4);
        });

        it('should mark plan as COMPLETED even if some tests fail', async () => {
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            mockDiscoveredComponentRepo.findByTestPlanId.mockResolvedValue(createDiscoveredComponents());
            const testsToRun = ['test-A', 'test-D'];
            mockBoomiService.executeTestProcess
                .mockResolvedValueOnce({ status: 'SUCCESS', message: 'Test A passed' })
                .mockResolvedValueOnce({ status: 'FAILURE', message: 'Test D failed' });

            await service.executeTests(planId, testsToRun, dummyCredentials, dummyAtomId);

            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
            expect(mockDiscoveredComponentRepo.update).toHaveBeenCalledWith(
                expect.objectContaining({ mappedTestId: 'test-D', executionStatus: 'FAILURE' })
            );
        });

        it('should throw an error if the test plan is not in AWAITING_SELECTION state', async () => {
            const testPlanWrongState: TestPlan = { ...createReadyTestPlan(), status: 'PENDING' };
            mockTestPlanRepo.findById.mockResolvedValue(testPlanWrongState);
            await expect(service.executeTests(planId, [], dummyCredentials, dummyAtomId)).rejects.toThrow(
                'TestPlan is not in AWAITING_SELECTION state. Current state: PENDING'
            );
        });
    });
});