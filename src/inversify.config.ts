// src/inversify.config.ts

import 'reflect-metadata';
import { Container } from 'inversify';
import type { Pool } from 'pg';
import { TYPES } from './inversify.types.js';


// Import Routers
import { TestPlanController } from './routes/test_plans.controller.js';
import { MappingsController } from './routes/mappings.controller.js';
import { CredentialsController } from './routes/credentials.controller.js';

// Import Services
import { TestPlanService } from './application/test_plan_service.js';
import { MappingService } from './application/mapping_service.js';
import { CredentialService } from './application/credential_service.js';

// Import Ports
import { ICredentialService } from './ports/i_credential_service.js';
import { ISecureCredentialService } from './ports/i_secure_credential_service.js';
import { ITestPlanService } from './ports/i_test_plan_service.js';
import { IMappingService } from './ports/i_mapping_service.js';
import { ITestPlanRepository } from './ports/i_test_plan_repository.js';
import { IDiscoveredComponentRepository } from './ports/i_discovered_component_repository.js';
import { IIntegrationPlatformServiceFactory } from './ports/i_integration_platform_service_factory.js';
import { IMappingRepository } from './ports/i_mapping_repository.js';
import { ITestExecutionResultRepository } from './ports/i_test_execution_result_repository.js';

// Import Infrastructure Adapters
import globalPool from './infrastructure/database.js';
import { TestPlanRepository } from './infrastructure/repositories/test_plan_repository.js';
import { DiscoveredComponentRepository } from './infrastructure/repositories/discovered_component_repository.js';
import { MappingRepository } from './infrastructure/repositories/mapping_repository.js';
import { TestExecutionResultRepository } from './infrastructure/repositories/test_execution_result_repository.js';
import { IntegrationPlatformServiceFactory } from './infrastructure/integration_platform_service_factory.js';
import { InMemorySecureCredentialService } from './infrastructure/in_memory_secure_credential_service.js';


// Create the Inversify container
const container = new Container();

// --- Database Pool Binding ---
container.bind<Pool>(TYPES.PostgresPool).toConstantValue(globalPool);

// --- Controller Bindings ---
container.bind<TestPlanController>(TYPES.TestPlanController).to(TestPlanController).inSingletonScope();
container.bind<MappingsController>(TYPES.MappingsController).to(MappingsController).inSingletonScope();
container.bind<CredentialsController>(TYPES.CredentialsController).to(CredentialsController).inSingletonScope();

// --- Repository Bindings ---
container.bind<ITestPlanRepository>(TYPES.ITestPlanRepository).to(TestPlanRepository).inSingletonScope();
container.bind<IDiscoveredComponentRepository>(TYPES.IDiscoveredComponentRepository).to(DiscoveredComponentRepository).inSingletonScope();
container.bind<IMappingRepository>(TYPES.IMappingRepository).to(MappingRepository).inSingletonScope();
container.bind<ITestExecutionResultRepository>(TYPES.ITestExecutionResultRepository).to(TestExecutionResultRepository).inSingletonScope();

// --- Service Bindings ---
container.bind<ITestPlanService>(TYPES.ITestPlanService).to(TestPlanService).inSingletonScope();
container.bind<IMappingService>(TYPES.IMappingService).to(MappingService).inSingletonScope();
container.bind<ICredentialService>(TYPES.ICredentialService).to(CredentialService).inSingletonScope();

// --- Infrastructure Adapter Bindings ---
container.bind<ISecureCredentialService>(TYPES.ISecureCredentialService).to(InMemorySecureCredentialService).inSingletonScope();
container.bind<IIntegrationPlatformServiceFactory>(TYPES.IIntegrationPlatformServiceFactory).to(IntegrationPlatformServiceFactory).inSingletonScope();

export default container;