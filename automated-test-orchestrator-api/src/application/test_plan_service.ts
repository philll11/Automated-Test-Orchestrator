// src/application/test_plan_service.ts

import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import pLimit from 'p-limit';
import { TYPES } from '../inversify.types.js';
import { IPlatformConfig } from '../infrastructure/config.js';
import { ITestPlanService, TestPlanWithDetails } from "../ports/i_test_plan_service.js";
import { ITestPlanRepository } from "../ports/i_test_plan_repository.js";
import { ComponentInfo, IIntegrationPlatformService } from "../ports/i_integration_platform_service.js";
import { PlanComponent } from "../domain/plan_component.js";
import { IPlanComponentRepository } from "../ports/i_plan_component_repository.js";
import { IMappingRepository } from "../ports/i_mapping_repository.js";
import { ITestExecutionResultRepository, NewTestExecutionResult } from '../ports/i_test_execution_result_repository.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';
import { TestPlanEntryPoint } from '../domain/test_plan_entry_point.js';
import { ITestPlanEntryPointRepository } from '../ports/i_test_plan_entry_point_repository.js';
import { NotFoundError } from '../utils/app_error.js';
import { TestPlan, TestPlanStatus } from '../domain/test_plan.js';

@injectable()
export class TestPlanService implements ITestPlanService {
    private readonly config: IPlatformConfig;
    private readonly testPlanRepository: ITestPlanRepository;
    private readonly testPlanEntryPointRepository: ITestPlanEntryPointRepository;
    private readonly planComponentRepository: IPlanComponentRepository;
    private readonly mappingRepository: IMappingRepository;
    private readonly testExecutionResultRepository: ITestExecutionResultRepository;
    private readonly platformServiceFactory: IIntegrationPlatformServiceFactory;

    constructor(
        @inject(TYPES.IPlatformConfig) config: IPlatformConfig,
        @inject(TYPES.ITestPlanRepository) testPlanRepository: ITestPlanRepository,
        @inject(TYPES.ITestPlanEntryPointRepository) testPlanEntryPointRepository: ITestPlanEntryPointRepository,
        @inject(TYPES.IPlanComponentRepository) planComponentRepository: IPlanComponentRepository,
        @inject(TYPES.IMappingRepository) mappingRepository: IMappingRepository,
        @inject(TYPES.ITestExecutionResultRepository) testExecutionResultRepository: ITestExecutionResultRepository,
        @inject(TYPES.IIntegrationPlatformServiceFactory) platformServiceFactory: IIntegrationPlatformServiceFactory
    ) {
        this.config = config;
        this.testPlanRepository = testPlanRepository;
        this.testPlanEntryPointRepository = testPlanEntryPointRepository;
        this.planComponentRepository = planComponentRepository;
        this.mappingRepository = mappingRepository;
        this.testExecutionResultRepository = testExecutionResultRepository;
        this.platformServiceFactory = platformServiceFactory;
    }

    public async initiateDiscovery(name: string, componentIds: string[], credentialProfile: string, discoverDependencies: boolean): Promise<TestPlan> {
        const testPlan: TestPlan = {
            id: uuidv4(),
            name: name,
            status: TestPlanStatus.DISCOVERING,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const savedTestPlan = await this.testPlanRepository.save(testPlan);

        const entryPoints: TestPlanEntryPoint[] = componentIds.map(componentId => ({
            id: uuidv4(),
            testPlanId: savedTestPlan.id,
            componentId,
        }));
        await this.testPlanEntryPointRepository.saveAll(entryPoints);

        this.processPlanComponents(componentIds, savedTestPlan.id, credentialProfile, discoverDependencies)
            .catch(async (error: Error) => {
                console.error(`[TestPlanService] Processing failed for plan ${savedTestPlan.id}: ${error.message}`);
                await this.testPlanRepository.update({
                    ...savedTestPlan,
                    status: TestPlanStatus.DISCOVERY_FAILED,
                    failureReason: error.message,
                    updatedAt: new Date(),
                });
            });

        return savedTestPlan;
    }

    private async processPlanComponents(entryPointIds: string[], testPlanId: string, credentialProfile: string, discoverDependencies: boolean): Promise<void> {
        const integrationPlatformService = await this.platformServiceFactory.create(credentialProfile);
        const finalComponentsMap = new Map<string, ComponentInfo>();

        if (discoverDependencies) {
            for (const id of entryPointIds) {
                const discoveredMap = await this._findAllDependenciesRecursive(id, integrationPlatformService);
                discoveredMap.forEach((value, key) => finalComponentsMap.set(key, value));
            }
        } else {
            for (const id of entryPointIds) {
                const info = await integrationPlatformService.getComponentInfo(id);
                if (info) finalComponentsMap.set(id, info);
            }
        }

        const planComponents: PlanComponent[] = Array.from(finalComponentsMap.values()).map(info => ({
            id: uuidv4(),
            testPlanId,
            componentId: info.id,
            componentName: info.name,
            componentType: info.type,
        }));

        await this.planComponentRepository.saveAll(planComponents);

        const testPlan = await this.testPlanRepository.findById(testPlanId);
        if (testPlan) {
            await this.testPlanRepository.update({
                ...testPlan,
                status: TestPlanStatus.AWAITING_SELECTION,
                updatedAt: new Date(),
            });
        }
    }

    public async getAllPlans(): Promise<TestPlan[]> {
        return this.testPlanRepository.findAll();
    }

    public async getPlanWithDetails(planId: string): Promise<TestPlanWithDetails | null> {
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) return null;

        const planComponents = await this.planComponentRepository.findByTestPlanId(planId);
        const planComponentIds = planComponents.map(c => c.id);
        const mainComponentIds = planComponents.map(c => c.componentId);

        const [executionResults, availableTestsMap] = await Promise.all([
            this.testExecutionResultRepository.findByPlanComponentIds(planComponentIds),
            this.mappingRepository.findAllTestsForMainComponents(mainComponentIds)
        ]);

        const resultsByComponentId = new Map<string, any[]>();
        for (const result of executionResults) {
            if (!resultsByComponentId.has(result.planComponentId)) {
                resultsByComponentId.set(result.planComponentId, []);
            }
            resultsByComponentId.get(result.planComponentId)!.push(result);
        }

        const planComponentsDetails = planComponents.map(component => ({
            ...component,
            availableTests: availableTestsMap.get(component.componentId) || [],
            executionResults: resultsByComponentId.get(component.id) || [],
        }));

        return { ...testPlan, planComponents: planComponentsDetails };
    }

    public async deletePlan(planId: string): Promise<void> {
        const existingPlan = await this.testPlanRepository.findById(planId);
        if (!existingPlan) {
            throw new NotFoundError(`Test plan with ID ${planId} not found.`);
        }
        await this.testPlanRepository.deleteById(planId);
    }

    public async prepareForExecution(planId: string): Promise<void> {
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) throw new Error(`TestPlan with id ${planId} not found.`);

        const allowedExecutionStates: TestPlanStatus[] = [
            TestPlanStatus.AWAITING_SELECTION, 
            TestPlanStatus.COMPLETED, 
            TestPlanStatus.EXECUTION_FAILED,
            TestPlanStatus.DISCOVERY_FAILED
        ];
        if (!allowedExecutionStates.includes(testPlan.status)) {
            throw new Error(`TestPlan cannot be executed. Its status is '${testPlan.status}', but it must be one of: ${allowedExecutionStates.join(', ')}.`);
        }

        // Clear previous execution results
        await this.testExecutionResultRepository.deleteByTestPlanId(planId);

        // Set status to EXECUTING immediately
        await this.testPlanRepository.update({ ...testPlan, status: TestPlanStatus.EXECUTING, failureReason: undefined });
    }

    public async runTestExecution(planId: string, testsToRun: string[] | undefined, credentialProfile: string): Promise<void> {
        // Fetch plan again to ensure we have the latest state (though we assume it's EXECUTING)
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) return; // Should not happen if prepareForExecution was called

        try {
            const limit = pLimit(this.config.concurrencyLimit);

            const integrationPlatformService = await this.platformServiceFactory.create(credentialProfile);
            const planComponents = await this.planComponentRepository.findByTestPlanId(planId);
            const allAvailableTestsMap = await this.mappingRepository.findAllTestsForMainComponents(planComponents.map(c => c.componentId));

            const testToPlanComponentMap = new Map<string, PlanComponent>();
            allAvailableTestsMap.forEach((tests, mainComponentId) => {
                const planComponent = planComponents.find(pc => pc.componentId === mainComponentId);
                if (planComponent) {
                    tests.forEach(test => testToPlanComponentMap.set(test.id, planComponent));
                }
            });

            // If no specific tests were requested, run all available tests.
            let finalTestsToExecute: string[];
            console.log(`[DEBUG] testsToRun received: ${JSON.stringify(testsToRun)}`);
            if (testsToRun && testsToRun.length > 0) {
                finalTestsToExecute = testsToRun;
            } else {
                // Flatten the map values and extract just the test IDs for execution
                finalTestsToExecute = Array.from(allAvailableTestsMap.values()).flat().map(test => test.id);
            }
            console.log(`[DEBUG] finalTestsToExecute: ${JSON.stringify(finalTestsToExecute)}`);

            const executionPromises = finalTestsToExecute.map(async (testId) => {
                return limit(async () => {
                    const planComponent = testToPlanComponentMap.get(testId);
                    if (!planComponent) {
                        console.warn(`Test ID '${testId}' was requested but no corresponding component was found in this plan. Skipping.`);
                        return;
                    }
                    try {
                        console.log(`[DEBUG] Executing test ${testId}...`);
                        const result = await integrationPlatformService.executeTestProcess(testId);
                        console.log(`[DEBUG] Test ${testId} executed. Status: ${result.status}`);
                        const newResult: NewTestExecutionResult = {
                            testPlanId: planId,
                            planComponentId: planComponent.id,
                            testComponentId: testId,
                            status: result.status,
                            message: result.message,
                            testCases: result.testCases
                        };
                        await this.testExecutionResultRepository.save(newResult);
                        console.log(`[DEBUG] Result saved for test ${testId}`);
                    } catch (err) {
                        console.error(`[DEBUG] Error executing/saving test ${testId}:`, err);
                        throw err;
                    }
                });
            });

            const results = await Promise.allSettled(executionPromises);
            console.log(`[DEBUG] All settled results:`, JSON.stringify(results));
            await this.testPlanRepository.update({ ...testPlan, status: TestPlanStatus.COMPLETED, updatedAt: new Date() });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            await this.testPlanRepository.update({
                ...testPlan,
                status: TestPlanStatus.EXECUTION_FAILED,
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