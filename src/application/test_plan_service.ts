// src/application/test_plan_service.ts

import { v4 as uuidv4 } from 'uuid';
import { ITestPlanService } from "../ports/i_test_plan_service.js";
import { TestPlan } from "../domain/test_plan.js";
import { ITestPlanRepository } from "../ports/i_test_plan_repository.js";
import { BoomiCredentials, IBoomiService } from "../ports/i_boomi_service.js";
import { DiscoveredComponent } from "../domain/discovered_component.js";
import { IDiscoveredComponentRepository } from "../ports/i_discovered_component_repository.js";
import { IComponentTestMappingRepository } from "../ports/i_component_test_mapping_repository.js";

// This is a "factory" to create a BoomiService. In a real app, this might be more complex.
// We pass this factory into the service so we can control BoomiService creation.
export type BoomiServiceFactory = (credentials: BoomiCredentials) => IBoomiService;

export class TestPlanService implements ITestPlanService {
    private readonly testPlanRepository: ITestPlanRepository;
    private readonly discoveredComponentRepository: IDiscoveredComponentRepository;
    private readonly componentTestMappingRepository: IComponentTestMappingRepository;
    private readonly boomiServiceFactory: BoomiServiceFactory;

    constructor(
        testPlanRepository: ITestPlanRepository,
        discoveredComponentRepository: IDiscoveredComponentRepository,
        componentTestMappingRepository: IComponentTestMappingRepository,
        boomiServiceFactory: BoomiServiceFactory
    ) {
        this.testPlanRepository = testPlanRepository;
        this.discoveredComponentRepository = discoveredComponentRepository;
        this.componentTestMappingRepository = componentTestMappingRepository;
        this.boomiServiceFactory = boomiServiceFactory;
    }

    public async initiateDiscovery(rootComponentId: string, credentials: BoomiCredentials): Promise<TestPlan> {
        console.log(`[SERVICE] initiateDiscovery called for component: ${rootComponentId}`);
        const testPlan: TestPlan = {
            id: uuidv4(),
            rootComponentId,
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const savedTestPlan = await this.testPlanRepository.save(testPlan);

        console.log(`[SERVICE] TestPlan ${savedTestPlan.id} created. Starting async discovery.`);

        // Execute asynchronously and intentionally don't await it
        this.discoverAndSaveAllDependencies(rootComponentId, savedTestPlan.id, credentials)
            .catch(async error => {
                console.error(`[TestPlanService] Discovery failed for plan ${savedTestPlan.id}. Updating status to FAILED.`, error);

                // We MUST update the plan in the database to reflect the failure.
                const failedPlan: TestPlan = {
                    ...savedTestPlan,
                    status: 'FAILED',
                    failureReason: error.message,
                    updatedAt: new Date(),
                };

                console.log(`[SERVICE] Updating plan ${savedTestPlan.id} to FAILED.`);

                await this.testPlanRepository.update(failedPlan);
            });

        return savedTestPlan;
    }

    public async discoverAndSaveAllDependencies(rootComponentId: string, testPlanId: string, credentials: BoomiCredentials): Promise<void> {

        console.log(`[SERVICE] discoverAndSaveAllDependencies started for plan ${testPlanId}.`);

        const testPlan = await this.testPlanRepository.findById(testPlanId);
        if (!testPlan) throw new Error(`TestPlan with id ${testPlanId} not found.`);

        try {
            const boomiService = this.boomiServiceFactory(credentials);

            const discoveredComponentsMap = new Map<string, string>();
            await this.findAllDependenciesRecursive(rootComponentId, boomiService, discoveredComponentsMap);

            const componentIds = Array.from(discoveredComponentsMap.keys());

            const testMappings = await this.componentTestMappingRepository.findAllTestMappings(componentIds);

            const discoveredComponents: DiscoveredComponent[] = componentIds.map(componentId => ({
                id: uuidv4(),
                testPlanId,
                componentId,
                componentName: discoveredComponentsMap.get(componentId),
                mappedTestId: testMappings.get(componentId),
                executionStatus: 'PENDING',
            }));

            await this.discoveredComponentRepository.saveAll(discoveredComponents);

            testPlan.status = 'AWAITING_SELECTION';
            testPlan.updatedAt = new Date();
            await this.testPlanRepository.update(testPlan);

        } catch (error) {
            console.error(`[TestPlanService] Failed to complete discovery for plan ${testPlanId}:`, error);
            testPlan.status = 'FAILED';
            testPlan.failureReason = (error instanceof Error) ? error.message : 'An unknown error occurred';
            testPlan.updatedAt = new Date();
            await this.testPlanRepository.update(testPlan);
            throw error;
        }
    }

    private async findAllDependenciesRecursive(componentId: string, boomiService: IBoomiService, discoveredComponentsMap: Map<string, string>): Promise<void> {

        if (discoveredComponentsMap.has(componentId)) return; // Already processed this component

        const componentInfo = await boomiService.getComponentInfoAndDependencies(componentId);

        // In theory, the only time componentInfo is null is if the root component doesn't exist.
        // Or if the component was deleted during the discovery process.
        // Either way, record it and return.
        if (!componentInfo) {
            discoveredComponentsMap.set(componentId, 'Component Not Found');
            return;
        }

        discoveredComponentsMap.set(componentId, componentInfo.name);

        const discoveryPromises = componentInfo.dependencyIds.map(depId =>
            this.findAllDependenciesRecursive(depId, boomiService, discoveredComponentsMap)
        );

        await Promise.all(discoveryPromises);
    }

    public async executeTests(planId: string, testsToRun: string[], credentials: BoomiCredentials, atomId: string): Promise<void> {
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) {
            throw new Error(`TestPlan with id ${planId} not found.`);
        }
        if (testPlan.status !== 'AWAITING_SELECTION') {
            throw new Error(`TestPlan is not in AWAITING_SELECTION state. Current state: ${testPlan.status}`);
        }

        await this.testPlanRepository.update({
            ...testPlan,
            status: 'EXECUTING'
        });

        const discoveredComponents = await this.discoveredComponentRepository.findByTestPlanId(planId);
        const componentsToTest = discoveredComponents.filter(c => testsToRun.includes(c.mappedTestId || ''));

        // Execute all tests in parallel and wait for all to complete
        const executionPromises = componentsToTest.map(async (component) => {
            await this.discoveredComponentRepository.update({
                ...component,
                executionStatus: 'RUNNING'
            });

            const result = await this.boomiServiceFactory(credentials).executeTestProcess(component.mappedTestId!, { atomId });

            await this.discoveredComponentRepository.update({
                ...component,
                executionStatus: result.status,
                executionLog: result.message
            });
        });

        // Promise.allSettled ensures we wait for all tests, even if some fail
        await Promise.allSettled(executionPromises);

        // Update the master plan status to COMPLETED
        await this.testPlanRepository.update({
            ...testPlan,
            status: 'COMPLETED',
            updatedAt: new Date()
        });
    }
}