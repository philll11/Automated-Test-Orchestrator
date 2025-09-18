// src/application/test_execution_result_service.unit.test.ts

import { TestExecutionResultService } from './test_execution_result_service.js';
import { ITestExecutionResultRepository, TestExecutionResultFilters } from '../ports/i_test_execution_result_repository.js';
import { TestExecutionResult } from '../domain/test_execution_result.js';

// --- JEST MOCK FOR THE REPOSITORY PORT ---
const mockResultRepo: jest.Mocked<ITestExecutionResultRepository> = {
    save: jest.fn(),
    findByPlanComponentIds: jest.fn(),
    findByFilters: jest.fn(),
};

describe('TestExecutionResultService', () => {
    let service: TestExecutionResultService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TestExecutionResultService(mockResultRepo);
    });

    describe('getResults', () => {
        it('should call the repository with the provided filters and return its result', async () => {
            // Arrange
            const filters: TestExecutionResultFilters = {
                testPlanId: 'plan-123',
                status: 'FAILURE',
            };
            const mockResults: TestExecutionResult[] = [
                { 
                    id: 'res-1', 
                    testPlanId: 'plan-123', 
                    planComponentId: 'pc-1', 
                    testComponentId: 'test-A', 
                    status: 'FAILURE', 
                    executedAt: new Date() 
                }
            ];
            mockResultRepo.findByFilters.mockResolvedValue(mockResults);

            // Act
            const result = await service.getResults(filters);

            // Assert
            expect(mockResultRepo.findByFilters).toHaveBeenCalledTimes(1);
            expect(mockResultRepo.findByFilters).toHaveBeenCalledWith(filters);
            expect(result).toEqual(mockResults);
        });

        it('should handle empty filters', async () => {
            // Arrange
            const filters: TestExecutionResultFilters = {};
            mockResultRepo.findByFilters.mockResolvedValue([]);

            // Act
            const result = await service.getResults(filters);

            // Assert
            expect(mockResultRepo.findByFilters).toHaveBeenCalledWith({});
            expect(result).toEqual([]);
        });
    });
});