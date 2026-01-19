// src/application/test_plan_service.ts

import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import pLimit from 'p-limit';
import { TYPES } from '../inversify.types.js';
import { IPlatformConfig } from '../infrastructure/config.js';
import { ITestPlanService, TestPlanWithDetails, CreateTestPlanInputs } from "../ports/i_test_plan_service.js";
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
import { TestPlan, TestPlanStatus, TestPlanType } from '../domain/test_plan.js';

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

    public async initiateDiscovery(name: string, planType: TestPlanType, inputs: CreateTestPlanInputs, credentialProfile: string, discoverDependencies: boolean): Promise<TestPlan> {
        
        // --- 1. Backend Input Resolution Phase ---
        // We must resolve names and folders to specific Component IDs before creating the plan.
        const platformService = await this.platformServiceFactory.createService(credentialProfile);
        const resolvedComponents = await this.resolveInputs(inputs, planType, platformService);

        if (resolvedComponents.length === 0) {
            throw new Error('Input resolution failed: No valid components found matching the providing IDs, names, or folders.');
        }

        // --- 2. Plan Creation ---
        const testPlan: TestPlan = {
            id: uuidv4(),
            name: name,
            planType: planType,
            status: TestPlanStatus.DISCOVERING,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const savedTestPlan = await this.testPlanRepository.save(testPlan);

        const entryPoints: TestPlanEntryPoint[] = resolvedComponents.map(comp => ({
            id: uuidv4(),
            testPlanId: savedTestPlan.id,
            componentId: comp.id,
        }));
        await this.testPlanEntryPointRepository.saveAll(entryPoints);

        // --- 3. Async Processing ---
        if (planType === TestPlanType.TEST) {
             this.processTestModeComponents(resolvedComponents, savedTestPlan.id, credentialProfile)
                .catch(async (error: Error) => {
                    console.error(`[TestPlanService] Processing failed for plan ${savedTestPlan.id}: ${error.message}`);
                    await this.testPlanRepository.update({
                        ...savedTestPlan,
                        status: TestPlanStatus.DISCOVERY_FAILED,
                        failureReason: error.message,
                        updatedAt: new Date(),
                    });
                });
        } else {
             this.processPlanComponents(resolvedComponents, savedTestPlan.id, credentialProfile, discoverDependencies)
                .catch(async (error: Error) => {
                    console.error(`[TestPlanService] Processing failed for plan ${savedTestPlan.id}: ${error.message}`);
                    await this.testPlanRepository.update({
                        ...savedTestPlan,
                        status: TestPlanStatus.DISCOVERY_FAILED,
                        failureReason: error.message,
                        updatedAt: new Date(),
                    });
                });
        }

        return savedTestPlan;
    }

    private async resolveInputs(inputs: CreateTestPlanInputs, planType: TestPlanType, platformService: IIntegrationPlatformService): Promise<ComponentInfo[]> {
        // Context-Aware Filter: If TEST mode, rigorously filter for 'process' type only.
        const typeFilter = planType === TestPlanType.TEST ? ['process'] : undefined;

        // Recommendation B: Consolidate Search Query
        const criteria: any = {
            ids: inputs.compIds,
            names: inputs.compNames,
            folderNames: inputs.compFolderNames,
            types: typeFilter,
            exactNameMatch: true
        };

        const results = await platformService.searchComponents(criteria);

        // Validation: Ensure all requested Names were resolved.
        if (inputs.compNames && inputs.compNames.length > 0) {
            const foundNames = new Set(results.map(c => c.name));
            const missingNames = inputs.compNames.filter(n => !foundNames.has(n));
            
            if (missingNames.length > 0) {
                throw new Error(`Could not resolve the following names (or they are not executable processes): ${missingNames.join(', ')}`);
            }
        }

        // Deduplicate resolved components
        const uniqueMap = new Map<string, ComponentInfo>();
        results.forEach(c => uniqueMap.set(c.id, c));
        
        return Array.from(uniqueMap.values());
    }

    private async processTestModeComponents(resolvedComponents: ComponentInfo[], planId: string, credentialProfile: string): Promise<void> {
        // We already have the metadata from resolveInputs (Recommendation A).
        // No need to query getComponentInfo again for the resolved inputs.
        
        const planComponents: PlanComponent[] = resolvedComponents.map(info => ({
            id: uuidv4(),
            testPlanId: planId,
            sourceType: 'ARG',
            componentId: info.id,
            componentName: info.name,
            componentType: info.type
        }));

        await this.planComponentRepository.saveAll(planComponents);
        
        const plan = await this.testPlanRepository.findById(planId);
        if (plan) {
            plan.status = TestPlanStatus.AWAITING_SELECTION;
            plan.updatedAt = new Date();
            await this.testPlanRepository.update(plan);
        }
    }

    private async processPlanComponents(resolvedComponents: ComponentInfo[], testPlanId: string, credentialProfile: string, discoverDependencies: boolean): Promise<void> {
        const integrationPlatformService = await this.platformServiceFactory.createService(credentialProfile);
        const finalComponentsMap = new Map<string, ComponentInfo>();

        // Pre-populate with resolved components to avoid re-fetching
        resolvedComponents.forEach(info => finalComponentsMap.set(info.id, info));

        if (discoverDependencies) {
            // Recommendation A: Use available info to traverse
            // Note: We traverse starting from each resolved component ID
            for (const info of resolvedComponents) {
                const discoveredMap = await this._findAllDependenciesRecursive(info.id, integrationPlatformService);
                discoveredMap.forEach((value, key) => finalComponentsMap.set(key, value));
            }
        } 
        // Else: We already collected them in finalComponentsMap

        const planComponents: PlanComponent[] = Array.from(finalComponentsMap.values()).map(info => ({
            id: uuidv4(),
            testPlanId,
            sourceType: 'DISCOVERED',
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
        // Fetch plan again to ensure we have the latest state
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) return; // Should not happen if prepareForExecution was called

        try {
            const limit = pLimit(this.config.concurrencyLimit);

            const integrationPlatformService = await this.platformServiceFactory.createService(credentialProfile);
            const planComponents = await this.planComponentRepository.findByTestPlanId(planId);
            
            const testToPlanComponentMap = new Map<string, PlanComponent>();
            let finalTestsToExecute: string[] = [];

            if (testPlan.planType === TestPlanType.TEST) {
                // In TEST mode, the plan components are the executable tests themselves.
                planComponents.forEach(pc => {
                    testToPlanComponentMap.set(pc.componentId, pc);
                });

                if (testsToRun && testsToRun.length > 0) {
                     finalTestsToExecute = testsToRun.filter(tId => testToPlanComponentMap.has(tId));
                } else {
                     finalTestsToExecute = planComponents.map(pc => pc.componentId);
                }
            } else {
                // In COMPONENT mode (default), discover tests via mappings.
                const allAvailableTestsMap = await this.mappingRepository.findAllTestsForMainComponents(planComponents.map(c => c.componentId));

                allAvailableTestsMap.forEach((tests, mainComponentId) => {
                    const planComponent = planComponents.find(pc => pc.componentId === mainComponentId);
                    if (planComponent) {
                        tests.forEach(test => testToPlanComponentMap.set(test.id, planComponent));
                    }
                });

                if (testsToRun && testsToRun.length > 0) {
                    finalTestsToExecute = testsToRun;
                } else {
                    finalTestsToExecute = Array.from(allAvailableTestsMap.values()).flat().map(test => test.id);
                }
            }


            const executionPromises = finalTestsToExecute.map(async (testId) => {
                return limit(async () => {
                    const planComponent = testToPlanComponentMap.get(testId);
                    if (!planComponent) {
                        console.warn(`Test ID '${testId}' was requested but no corresponding component was found in this plan. Skipping.`);
                        return;
                    }
                    try {
                        // console.log(`[DEBUG] Executing test ${testId}...`);
                        const result = await integrationPlatformService.executeTestProcess(testId);
                        // console.log(`[DEBUG] Test ${testId} executed. Status: ${result.status}`);
                        const newResult: NewTestExecutionResult = {
                            testPlanId: planId,
                            planComponentId: planComponent.id,
                            testComponentId: testId,
                            status: result.status,
                            message: result.message,
                            testCases: result.testCases
                        };
                        await this.testExecutionResultRepository.save(newResult);
                        // console.log(`[DEBUG] Result saved for test ${testId}`);
                    } catch (err) {
                        console.error(`[DEBUG] Error executing/saving test ${testId}:`, err);
                        throw err;
                    }
                });
            });

            const results = await Promise.allSettled(executionPromises);
            // console.log(`[DEBUG] All settled results:`, JSON.stringify(results));
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