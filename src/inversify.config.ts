// src/inversify.config.ts

import 'reflect-metadata';
import { Container } from 'inversify';
import { Pool } from 'pg';
import { TYPES } from './inversify.types.js';
import globalPool from './infrastructure/database.js';
import { ITestPlanService } from './ports/i_test_plan_service.js';
import { TestPlanService } from './application/test_plan_service.js';
import { ITestPlanRepository } from './ports/i_test_plan_repository.js';
import { TestPlanController } from './routes/test_plans.controller.js';
import { TestPlanRepository } from './infrastructure/repositories/test_plan_repository.js';
import { IDiscoveredComponentRepository } from './ports/i_discovered_component_repository.js';
import { DiscoveredComponentRepository } from './infrastructure/repositories/discovered_component_repository.js';
import { IComponentTestMappingRepository } from './ports/i_component_test_mapping_repository.js';
import { ComponentTestMappingRepository } from './infrastructure/repositories/component_test_mapping_repository.js';

// Create the Inversify container
const container = new Container();

// --- Database Pool Binding ---
container.bind<Pool>(TYPES.PostgresPool).toConstantValue(globalPool);

// --- Controller Bindings ---
container.bind<TestPlanController>(TYPES.TestPlanController).to(TestPlanController).inSingletonScope();

// --- Repository Bindings ---
container.bind<ITestPlanRepository>(TYPES.ITestPlanRepository).to(TestPlanRepository).inSingletonScope();
container.bind<IDiscoveredComponentRepository>(TYPES.IDiscoveredComponentRepository).to(DiscoveredComponentRepository).inSingletonScope();
container.bind<IComponentTestMappingRepository>(TYPES.IComponentTestMappingRepository).to(ComponentTestMappingRepository).inSingletonScope();

// --- Service Bindings ---
container.bind<ITestPlanService>(TYPES.ITestPlanService).to(TestPlanService).inSingletonScope();

export default container;