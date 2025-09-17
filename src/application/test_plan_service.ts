// src/application/test_plan_service.ts

import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { ITestPlanService, TestPlanWithDetails } from "../ports/i_test_plan_service.js";
import { TestPlan } from "../domain/test_plan.js";
import { ITestPlanRepository } from "../ports/i_test_plan_repository.js";
import { ComponentInfo, IIntegrationPlatformService } from "../ports/i_integration_platform_service.js";
import { PlanComponent } from "../domain/plan_component.js";
import { IPlanComponentRepository } from "../ports/i_plan_component_repository.js";
import { IMappingRepository } from "../ports/i_mapping_repository.js";
import { ITestExecutionResultRepository, NewTestExecutionResult } from '../ports/i_test_execution_result_repository.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';
import { TestPlanEntryPoint } from '../domain/test_plan_entry_point.js';
import { ITestPlanEntryPointRepository } from '../ports/i_test_plan_entry_point_repository.js';

@injectable()
export class TestPlanService implements ITestPlanService {
    private readonly testPlanRepository: ITestPlanRepository;
    private readonly testPlanEntryPointRepository: ITestPlanEntryPointRepository;
    private readonly planComponentRepository: IPlanComponentRepository;
    private readonly mappingRepository: IMappingRepository;
    private readonly testExecutionResultRepository: ITestExecutionResultRepository;
    private readonly platformServiceFactory: IIntegrationPlatformServiceFactory;

    constructor(
        @inject(TYPES.ITestPlanRepository) testPlanRepository: ITestPlanRepository,
        @inject(TYPES.ITestPlanEntryPointRepository) testPlanEntryPointRepository: ITestPlanEntryPointRepository,
        @inject(TYPES.IPlanComponentRepository) planComponentRepository: IPlanComponentRepository,
        @inject(TYPES.IMappingRepository) mappingRepository: IMappingRepository,
        @inject(TYPES.ITestExecutionResultRepository) testExecutionResultRepository: ITestExecutionResultRepository,
        @inject(TYPES.IIntegrationPlatformServiceFactory) platformServiceFactory: IIntegrationPlatformServiceFactory
    ) {
        this.testPlanRepository = testPlanRepository;
        this.testPlanEntryPointRepository = testPlanEntryPointRepository;
        this.planComponentRepository = planComponentRepository;
        this.mappingRepository = mappingRepository;
        this.testExecutionResultRepository = testExecutionResultRepository;
        this.platformServiceFactory = platformServiceFactory;
    }

    public async initiateDiscovery(componentIds: string[], credentialProfile: string, discoverDependencies: boolean): Promise<TestPlan> {
        const testPlan: TestPlan = {
            id: uuidv4(),
            status: 'DISCOVERING',
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
                    status: 'DISCOVERY_FAILED',
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
                status: 'AWAITING_SELECTION',
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

    public async executeTests(planId: string, testsToRun: string[], credentialProfile: string): Promise<void> {
        const testPlan = await this.testPlanRepository.findById(planId);
        if (!testPlan) throw new Error(`TestPlan with id ${planId} not found.`);
        if (testPlan.status !== 'AWAITING_SELECTION') throw new Error(`TestPlan not in AWAITING_SELECTION state.`);

        await this.testPlanRepository.update({ ...testPlan, status: 'EXECUTING' });

        try {
            const integrationPlatformService = await this.platformServiceFactory.create(credentialProfile);
            const planComponents = await this.planComponentRepository.findByTestPlanId(planId);
            const allAvailableTestsMap = await this.mappingRepository.findAllTestsForMainComponents(planComponents.map(c => c.componentId));

            const testToPlanComponentMap = new Map<string, PlanComponent>();
            allAvailableTestsMap.forEach((testIds, mainComponentId) => {
                const planComponent = planComponents.find(pc => pc.componentId === mainComponentId);
                if (planComponent) {
                    testIds.forEach(testId => testToPlanComponentMap.set(testId, planComponent));
                }
            });

            const executionPromises = testsToRun.map(async (testId) => {
                const planComponent = testToPlanComponentMap.get(testId);
                if (!planComponent) {
                    console.warn(`Test ID '${testId}' was requested but no corresponding component was found in this plan. Skipping.`);
                    return;
                }
                const result = await integrationPlatformService.executeTestProcess(testId);
                const newResult: NewTestExecutionResult = {
                    testPlanId: planId,
                    planComponentId: planComponent.id,
                    testComponentId: testId,
                    status: result.status,
                    log: result.message,
                };
                await this.testExecutionResultRepository.save(newResult);
            });

            await Promise.allSettled(executionPromises);
            await this.testPlanRepository.update({ ...testPlan, status: 'COMPLETED', updatedAt: new Date() });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
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