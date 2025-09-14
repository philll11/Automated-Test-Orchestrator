// src/inversify.config.ts

import 'reflect-metadata';
import { Container } from 'inversify';
import { Pool } from 'pg';
import { TYPES } from './inversify.types.js';
import globalPool from './infrastructure/database.js';

// Import services and controllers
import { ITestPlanService } from './ports/i_test_plan_service.js';
import { TestPlanService } from './application/test_plan_service.js';
import { TestPlanController } from './routes/test_plans.controller.js';
import { IMappingService } from './ports/i_mapping_service.js';
import { MappingService } from './application/mapping_service.js';
import { MappingsController } from './routes/mappings.controller.js';

// Import all repository interfaces and implementations
import { ITestPlanRepository } from './ports/i_test_plan_repository.js';
import { TestPlanRepository } from './infrastructure/repositories/test_plan_repository.js';
import { IDiscoveredComponentRepository } from './ports/i_discovered_component_repository.js';
import { DiscoveredComponentRepository } from './infrastructure/repositories/discovered_component_repository.js';
import { IMappingRepository } from './ports/i_mapping_repository.js';
import { MappingRepository } from './infrastructure/repositories/mapping_repository.js';
import { ITestExecutionResultRepository } from './ports/i_test_execution_result_repository.js';
import { TestExecutionResultRepository } from './infrastructure/repositories/test_execution_result_repository.js';


// Create the Inversify container
const container = new Container();

// --- Database Pool Binding ---
container.bind<Pool>(TYPES.PostgresPool).toConstantValue(globalPool);

// --- Controller Bindings ---
container.bind<TestPlanController>(TYPES.TestPlanController).to(TestPlanController).inSingletonScope();
container.bind<MappingsController>(TYPES.MappingsController).to(MappingsController).inSingletonScope();

// --- Repository Bindings ---
container.bind<ITestPlanRepository>(TYPES.ITestPlanRepository).to(TestPlanRepository).inSingletonScope();
container.bind<IDiscoveredComponentRepository>(TYPES.IDiscoveredComponentRepository).to(DiscoveredComponentRepository).inSingletonScope();
container.bind<IMappingRepository>(TYPES.IMappingRepository).to(MappingRepository).inSingletonScope();
container.bind<ITestExecutionResultRepository>(TYPES.ITestExecutionResultRepository).to(TestExecutionResultRepository).inSingletonScope();

// --- Service Bindings ---
container.bind<ITestPlanService>(TYPES.ITestPlanService).to(TestPlanService).inSingletonScope();
container.bind<IMappingService>(TYPES.IMappingService).to(MappingService).inSingletonScope();

export default container;