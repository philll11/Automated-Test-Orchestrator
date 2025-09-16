// src/application/test_plan_service.ts

import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { ITestPlanService, TestPlanWithDetails } from "../ports/i_test_plan_service.js";
import { TestPlan } from "../domain/test_plan.js";
import { ITestPlanRepository } from "../ports/i_test_plan_repository.js";
import { IIntegrationPlatformService, ComponentInfo } from "../ports/i_integration_platform_service.js";
import { DiscoveredComponent } from "../domain/discovered_component.js";
import { IDiscoveredComponentRepository } from "../ports/i_discovered_component_repository.js";
import { IMappingRepository } from "../ports/i_mapping_repository.js";
import { ITestExecutionResultRepository } from '../ports/i_test_execution_result_repository.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';

@injectable()
export class TestPlanService implements ITestPlanService {
    private readonly testPlanRepository: ITestPlanRepository;
    private readonly discoveredComponentRepository: IDiscoveredComponentRepository;
    private readonly componentTestMappingRepository: IMappingRepository;
    private readonly testExecutionResultRepository: ITestExecutionResultRepository;
    private readonly platformServiceFactory: IIntegrationPlatformServiceFactory;

    constructor(
        @inject(TYPES.ITestPlanRepository) testPlanRepository: ITestPlanRepository,
        @inject(TYPES.IDiscoveredComponentRepository) discoveredComponentRepository: IDiscoveredComponentRepository,
        @inject(TYPES.IMappingRepository) componentTestMappingRepository: IMappingRepository,
        @inject(TYPES.ITestExecutionResultRepository) testExecutionResultRepository: ITestExecutionResultRepository,
        @inject(TYPES.IIntegrationPlatformServiceFactory) platformServiceFactory: IIntegrationPlatformServiceFactory
    ) {
        this.testPlanRepository = testPlanRepository;
        this.discoveredComponentRepository = discoveredComponentRepository;
        this.componentTestMappingRepository = componentTestMappingRepository;
        this.testExecutionResultRepository = testExecutionResultRepository;
        this.platformServiceFactory = platformServiceFactory;
    }

    public async initiateDiscovery(rootComponentId: string, credentialProfile: string): Promise<TestPlan> {
        const testPlan: TestPlan = {
            id: uuidv4(),
            rootComponentId,
            status: 'DISCOVERING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const savedTestPlan = await this.testPlanRepository.save(testPlan);

        this.discoverAndSaveAllDependencies(rootComponentId, savedTestPlan.id, credentialProfile)
            .catch(async (error: Error) => {
                console.error(`[TestPlanService] Discovery failed for plan ${savedTestPlan.id}: ${error.message}`);
                const failedPlan: TestPlan = {
                    ...savedTestPlan,
                    status: 'DISCOVERY_FAILED',
                    failureReason: error.message,
                    updatedAt: new Date(),
                };
                await this.testPlanRepository.update(failedPlan);
            });

        return savedTestPlan;
    }

    public async getAllPlans(): Promise<TestPlan[]> {
        return this.testPlanRepository.findAll();
    }

    public async discoverAndSaveAllDependencies(rootComponentId: string, testPlanId: string, credentialProfile: string): Promise<void> {
        const testPlan = await this.testPlanRepository.findById(testPlanId);
        if (!testPlan) throw new Error(`TestPlan with id ${testPlanId} not found.`);

        try {
            const integrationPlatformService = await this.platformServiceFactory.create(credentialProfile);

            const discoveredComponentsMap = await this._findAllDependenciesRecursive(rootComponentId, integrationPlatformService);
            const discoveredComponents: DiscoveredComponent[] = Array.from(discoveredComponentsMap.values()).map(info => ({
                id: uuidv4(),
                testPlanId,
                componentId: info.id,
                componentName: info.name,
                componentType: info.type,
            }));

            await this.discoveredComponentRepository.saveAll(discoveredComponents);

            testPlan.status = 'AWAITING_SELECTION'; // Final success state for this stage
            testPlan.updatedAt = new Date();
            await this.testPlanRepository.update(testPlan);
        } catch (error) {
            // Re-throw the error to be caught by the caller's catch block
            throw error;
        }
    }

    public async getPlanWithDetails(planId: string): Promise<TestPlanWithDetails | null> {
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) return null;

        const discoveredComponents = await this.discoveredComponentRepository.findByTestPlanId(planId);
        const discoveredComponentIds = discoveredComponents.map(c => c.id);
        const mainComponentIds = discoveredComponents.map(c => c.componentId);

        // Fetch related data in parallel
        const [executionResults, availableTestsMap] = await Promise.all([
            this.testExecutionResultRepository.findByDiscoveredComponentIds(discoveredComponentIds),
            this.componentTestMappingRepository.findAllTestsForMainComponents(mainComponentIds)
        ]);

        // Create a map for efficient lookup of execution results
        const resultsByComponentId = new Map<string, any[]>();
        for (const result of executionResults) {
            if (!resultsByComponentId.has(result.discoveredComponentId)) {
                resultsByComponentId.set(result.discoveredComponentId, []);
            }
            resultsByComponentId.get(result.discoveredComponentId)!.push(result);
        }

        // Combine all data into the final response object
        const discoveredComponentsDetails = discoveredComponents.map(component => ({
            ...component,
            availableTests: availableTestsMap.get(component.componentId) || [],
            executionResults: resultsByComponentId.get(component.id) || [],
        }));

        return {
            ...testPlan,
            discoveredComponents: discoveredComponentsDetails,
        };
    }

    public async executeTests(planId: string, testsToRun: string[], credentialProfile: string): Promise<void> {
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) throw new Error(`TestPlan with id ${planId} not found.`);
        if (testPlan.status !== 'AWAITING_SELECTION') throw new Error(`TestPlan not in AWAITING_SELECTION state.`);

        await this.testPlanRepository.update({ ...testPlan, status: 'EXECUTING' });

        try {
            const integrationPlatformService = await this.platformServiceFactory.create(credentialProfile);

            const discoveredComponents = await this.discoveredComponentRepository.findByTestPlanId(planId);
            const mainComponentIds = discoveredComponents.map(c => c.componentId);
            const allAvailableTestsMap = await this.componentTestMappingRepository.findAllTestsForMainComponents(mainComponentIds);

            const testToDiscoveredComponentMap = new Map<string, DiscoveredComponent>();
            allAvailableTestsMap.forEach((testIds, mainComponentId) => {
                const discoveredComponent = discoveredComponents.find(dc => dc.componentId === mainComponentId);
                if (discoveredComponent) {
                    testIds.forEach(testId => testToDiscoveredComponentMap.set(testId, discoveredComponent));
                }
            });

            const executionPromises = testsToRun.map(async (testId) => {
                const discoveredComponent = testToDiscoveredComponentMap.get(testId);
                if (!discoveredComponent) {
                    console.warn(`Test ID '${testId}' was requested for execution but no corresponding component was found in this plan. Skipping.`);
                    return;
                }

                const result = await integrationPlatformService.executeTestProcess(testId);

                await this.testExecutionResultRepository.save({
                    testPlanId: planId,
                    discoveredComponentId: discoveredComponent.id,
                    testComponentId: testId,
                    status: result.status,
                    log: result.message,
                });
            });

            await Promise.allSettled(executionPromises);

            await this.testPlanRepository.update({ ...testPlan, status: 'COMPLETED', updatedAt: new Date() });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            console.error(`[TestPlanService] A system error occurred during execution for plan ${planId}: ${errorMessage}`);
            await this.testPlanRepository.update({
                ...testPlan,
                status: 'EXECUTION_FAILED',
                failureReason: errorMessage,
                updatedAt: new Date(),
            });
        }
    }

    private async _findAllDependenciesRecursive(rootComponentId: string, integrationPlatformService: IIntegrationPlatformService): Promise<Map<string, ComponentInfo>> {
        const finalMap = new Map<string, ComponentInfo>();
        const _recursiveHelper = async (componentId: string): Promise<void> => {
            if (finalMap.has(componentId)) return; // Already processed
            const componentInfo = await integrationPlatformService.getComponentInfoAndDependencies(componentId);
            if (!componentInfo) {
                finalMap.set(componentId, { id: componentId, name: 'Component Not Found', type: 'N/A', dependencyIds: [] });
                return;
            }
            finalMap.set(componentId, componentInfo);
            const discoveryPromises = componentInfo.dependencyIds.map(depId => _recursiveHelper(depId));
            await Promise.all(discoveryPromises);
        };
        await _recursiveHelper(rootComponentId);
        return finalMap;
    }
}