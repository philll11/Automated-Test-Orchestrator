// src/application/test_plan_service.test.ts

import { TestPlanService, BoomiServiceFactory } from './test_plan_service';
import { ITestPlanRepository } from '../ports/i_test_plan_repository';
import { IDiscoveredComponentRepository } from '../ports/i_discovered_component_repository';
import { IComponentTestMappingRepository } from '../ports/i_component_test_mapping_repository';
import { IBoomiService, BoomiCredentials } from '../ports/i_boomi_service';
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
};

const mockComponentTestMappingRepo: jest.Mocked<IComponentTestMappingRepository> = {
    findTestMapping: jest.fn(),
    findAllTestMappings: jest.fn(),
};

const mockBoomiService: jest.Mocked<IBoomiService> = {
    getComponentDependencies: jest.fn(),
};

// Mock the Boomi Service Factory
const mockBoomiServiceFactory: jest.Mocked<BoomiServiceFactory> = jest.fn(() => mockBoomiService);

// A helper to allow async "fire-and-forget" tasks to complete within a test
const allowAsyncOperations = () => new Promise(process.nextTick);

describe('TestPlanService', () => {
    let service: TestPlanService;
    const dummyCredentials: BoomiCredentials = { accountId: 'test', username: 'test', password_or_token: 'test' };

    let consoleErrorSpy: jest.SpyInstance;

    // Before each test, create a new instance of the service with our mocks
    beforeEach(() => {
        // Reset all mock function calls before each test
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

            // Mock the save function to return the plan with an ID
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid', createdAt: new Date(), updatedAt: new Date() }));

            const result = await service.initiateDiscovery(rootComponentId, dummyCredentials);

            // Verify the immediate results
            expect(result.id).toBe('plan-uuid');
            expect(result.status).toBe('PENDING');
            expect(mockTestPlanRepo.save).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining(partialTestPlan));
        });

        it('should trigger the asynchronous discovery process in the background', async () => {
            // Spy on the discoverAndSaveAllDependencies method to ensure it's called
            const discoverySpy = jest.spyOn(service, 'discoverAndSaveAllDependencies');

            mockTestPlanRepo.save.mockResolvedValue({ id: 'plan-uuid', rootComponentId: 'root-123', status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });

            await service.initiateDiscovery('root-123', dummyCredentials);

            // Check that the async process was kicked off
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

        it('should find all dependencies, map tests, save them, and update plan status to AWAITING_SELECTION', async () => {
            // --- Arrange: Setup all mock return values ---
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);

            // Mock the dependency graph: root -> [child1, child2], child1 -> [grandChildId], child2 -> [], grandChild -> []
            mockBoomiService.getComponentDependencies
                .mockResolvedValueOnce([childId1, childId2]) // for rootId
                .mockResolvedValueOnce([grandChildId])      // for childId1
                .mockResolvedValueOnce([])                  // for childId2
                .mockResolvedValueOnce([]);                 // for grandChildId

            // Mock the test mappings
            const mappings = new Map<string, string>([[childId1, 'test-for-child-1']]);
            mockComponentTestMappingRepo.findAllTestMappings.mockResolvedValue(mappings);

            // --- Act: Run the discovery process ---
            await service.discoverAndSaveAllDependencies(rootId, testPlan.id, dummyCredentials);

            // --- Assert: Verify all interactions ---

            // 1. Verify all dependencies were discovered and saved
            expect(mockDiscoveredComponentRepo.saveAll).toHaveBeenCalledTimes(1);
            const savedComponents = mockDiscoveredComponentRepo.saveAll.mock.calls[0][0];
            expect(savedComponents.length).toBe(4); // root, child1, child2, grandchild

            // 2. Verify test mappings were applied correctly
            const child1Component = savedComponents.find(c => c.componentId === childId1);
            const rootComponent = savedComponents.find(c => c.componentId === rootId);
            expect(child1Component?.mappedTestId).toBe('test-for-child-1');
            expect(rootComponent?.mappedTestId).toBeUndefined();

            // 3. Verify the final status update
            expect(mockTestPlanRepo.update).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                id: testPlan.id,
                status: 'AWAITING_SELECTION',
            }));
        });

        it('should handle circular dependencies without an infinite loop', async () => {
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);

            // Mock a circular dependency: root -> child1, child1 -> root
            mockBoomiService.getComponentDependencies
                .mockResolvedValueOnce([childId1]) // for rootId
                .mockResolvedValueOnce([rootId]);  // for childId1

            mockComponentTestMappingRepo.findAllTestMappings.mockResolvedValue(new Map());

            await service.discoverAndSaveAllDependencies(rootId, testPlan.id, dummyCredentials);

            // Assert that the boomi service was only called once for each unique component
            expect(mockBoomiService.getComponentDependencies).toHaveBeenCalledTimes(2);
            expect(mockBoomiService.getComponentDependencies).toHaveBeenCalledWith(rootId);
            expect(mockBoomiService.getComponentDependencies).toHaveBeenCalledWith(childId1);

            // Assert that we saved exactly two components
            expect(mockDiscoveredComponentRepo.saveAll).toHaveBeenCalledTimes(1);
            const savedComponents = mockDiscoveredComponentRepo.saveAll.mock.calls[0][0];
            expect(savedComponents.length).toBe(2);
        });

        it('should update the test plan status to FAILED if the Boomi service throws an error', async () => {
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);

            const apiError = new Error("Boomi API is down");
            mockBoomiService.getComponentDependencies.mockRejectedValue(apiError);

            await service.discoverAndSaveAllDependencies(rootId, testPlan.id, dummyCredentials);

            // Assert that we never tried to save components
            expect(mockDiscoveredComponentRepo.saveAll).not.toHaveBeenCalled();

            // Assert that the plan status was updated to FAILED
            expect(mockTestPlanRepo.update).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                id: testPlan.id,
                status: 'FAILED',
            }));
        });
    });
});