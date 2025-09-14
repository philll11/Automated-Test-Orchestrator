// src/application/test_plan_service.unit.test.ts

import { TestPlanService } from './test_plan_service.js';
import { ITestPlanRepository } from '../ports/i_test_plan_repository.js';
import { IDiscoveredComponentRepository } from '../ports/i_discovered_component_repository.js';
import { DiscoveredComponent } from '../domain/discovered_component.js';
import { IComponentTestMappingRepository } from '../ports/i_component_test_mapping_repository.js';
import { IIntegrationPlatformService } from '../ports/i_integration_platform_service.js';
import { TestPlan } from '../domain/test_plan.js';
import { TestPlanWithComponents } from '../ports/i_test_plan_service.js';

// Mocks for repository interfaces remain the same
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

// Mock for the integration service itself
const mockIntegrationService: jest.Mocked<IIntegrationPlatformService> = {
    getComponentInfoAndDependencies: jest.fn(),
    executeTestProcess: jest.fn(),
};

describe('TestPlanService', () => {
    let service: TestPlanService;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Instantiate the service with its new constructor, factory is removed.
        service = new TestPlanService(
            mockTestPlanRepo,
            mockDiscoveredComponentRepo,
            mockComponentTestMappingRepo
        );
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('getPlanWithDetails', () => {
        it('should return a combined object of a plan and its components if found', async () => {
            // Arrange
            const planId = 'plan-abc';
            const mockPlan: TestPlan = { id: planId, rootComponentId: 'root', status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() };
            const mockComponents: DiscoveredComponent[] = [{ id: 'dc-1', testPlanId: planId, componentId: 'root', componentName: 'Root', executionStatus: 'PENDING' }];
            
            mockTestPlanRepo.findById.mockResolvedValue(mockPlan);
            mockDiscoveredComponentRepo.findByTestPlanId.mockResolvedValue(mockComponents);

            // Act
            const result = await service.getPlanWithDetails(planId) as TestPlanWithComponents;

            // Assert
            expect(result).not.toBeNull();
            expect(result.id).toBe(planId);
            expect(result.discoveredComponents).toBe(mockComponents);
            expect(mockTestPlanRepo.findById).toHaveBeenCalledWith(planId);
            expect(mockDiscoveredComponentRepo.findByTestPlanId).toHaveBeenCalledWith(planId);
        });

        it('should return null if the test plan is not found', async () => {
            // Arrange
            const planId = 'non-existent-plan';
            mockTestPlanRepo.findById.mockResolvedValue(null);

            // Act
            const result = await service.getPlanWithDetails(planId);

            // Assert
            expect(result).toBeNull();
            expect(mockDiscoveredComponentRepo.findByTestPlanId).not.toHaveBeenCalled();
        });
    });

    describe('initiateDiscovery', () => {
        it('should create and save a PENDING TestPlan and trigger async discovery', async () => {
            const rootComponentId = 'root-123';
            mockTestPlanRepo.save.mockImplementation(async (plan) => ({ ...plan, id: 'plan-uuid', createdAt: new Date(), updatedAt: new Date() }));
            
            const discoverySpy = jest.spyOn(service, 'discoverAndSaveAllDependencies').mockResolvedValue(); // Mock implementation to prevent execution

            // Act
            const result = await service.initiateDiscovery(rootComponentId, mockIntegrationService);

            // Assert
            expect(result.status).toBe('PENDING');
            expect(mockTestPlanRepo.save).toHaveBeenCalledWith(expect.objectContaining({ rootComponentId }));
            expect(discoverySpy).toHaveBeenCalledWith(rootComponentId, 'plan-uuid', mockIntegrationService);
        });
    });

    describe('discoverAndSaveAllDependencies', () => {
        const rootId = 'root-comp';
        const testPlan: TestPlan = { id: 'plan-uuid', rootComponentId: rootId, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() };

        it('should discover all components, map tests, and update the plan to AWAITING_SELECTION', async () => {
            // Arrange
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);
            mockIntegrationService.getComponentInfoAndDependencies.mockResolvedValue({ id: rootId, name: 'Root', type: 'process', dependencyIds: [] });
            mockComponentTestMappingRepo.findAllTestMappings.mockResolvedValue(new Map());

            // Act
            await service.discoverAndSaveAllDependencies(rootId, testPlan.id, mockIntegrationService);

            // Assert
            expect(mockDiscoveredComponentRepo.saveAll).toHaveBeenCalledTimes(1);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'AWAITING_SELECTION',
            }));
        });

        it('should update the plan to FAILED if discovery throws an error', async () => {
            // Arrange
            mockTestPlanRepo.findById.mockResolvedValue(testPlan);
            const apiError = new Error("API is down");
            mockIntegrationService.getComponentInfoAndDependencies.mockRejectedValue(apiError);

            // Act & Assert
            await expect(service.discoverAndSaveAllDependencies(rootId, testPlan.id, mockIntegrationService)).rejects.toThrow(apiError);
            
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'FAILED',
                failureReason: apiError.message,
            }));
        });
    });

    describe('executeTests', () => {
        const planId = 'plan-to-execute';
        const dummyAtomId = 'test-atom-123';
        const createReadyTestPlan = (): TestPlan => ({ id: planId, rootComponentId: 'root-123', status: 'AWAITING_SELECTION', createdAt: new Date(), updatedAt: new Date() });
        const createDiscoveredComponents = (): DiscoveredComponent[] => [
            { id: 'dc-1', testPlanId: planId, componentId: 'comp-A', componentName: 'Comp A', mappedTestId: 'test-A', executionStatus: 'PENDING' },
            { id: 'dc-2', testPlanId: planId, componentId: 'comp-B', componentName: 'Comp B', mappedTestId: 'test-B', executionStatus: 'PENDING' },
        ];

        it('should execute selected tests and mark the plan as COMPLETED', async () => {
            // Arrange
            mockTestPlanRepo.findById.mockResolvedValue(createReadyTestPlan());
            mockDiscoveredComponentRepo.findByTestPlanId.mockResolvedValue(createDiscoveredComponents());

            const testsToRun = ['test-A', 'test-B'];
            mockIntegrationService.executeTestProcess.mockResolvedValue({ status: 'SUCCESS', message: 'All good!' });

            // Act
            await service.executeTests(planId, testsToRun, mockIntegrationService, dummyAtomId);

            // Assert
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'EXECUTING' }));
            expect(mockIntegrationService.executeTestProcess).toHaveBeenCalledTimes(2);
            expect(mockTestPlanRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
        });

        it('should throw an error if the test plan is not in AWAITING_SELECTION state', async () => {
            const testPlanWrongState: TestPlan = { ...createReadyTestPlan(), status: 'PENDING' };
            mockTestPlanRepo.findById.mockResolvedValue(testPlanWrongState);

            // Act & Assert
            await expect(service.executeTests(planId, [], mockIntegrationService, dummyAtomId)).rejects.toThrow(
                'TestPlan is not in AWAITING_SELECTION state. Current state: PENDING'
            );
        });
    });
});