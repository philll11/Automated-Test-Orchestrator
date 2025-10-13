// src/application/mapping_service.unit.test.ts

import { MappingService } from './mapping_service.js';
import { IMappingRepository, NewMapping, UpdateMappingData } from '../ports/i_mapping_repository.js';
import { Mapping } from '../domain/mapping.js';
import { v4 as uuidv4 } from 'uuid';

// Mock the repository dependency
const mockMappingRepo: jest.Mocked<IMappingRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByMainComponentId: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findAllTestsForMainComponents: jest.fn(),
};

describe('MappingService', () => {
    let service: MappingService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new MappingService(mockMappingRepo);
    });

    describe('createMapping', () => {
        it('should generate a UUID, call the repository create method, and return the result', async () => {
            // Arrange
            const newMappingData: NewMapping = {
                mainComponentId: 'comp-123',
                testComponentId: 'test-123',
                testComponentName: 'Unit Test',
            };
            const expectedResult: Mapping = {
                id: 'mock-uuid',
                ...newMappingData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockMappingRepo.create.mockResolvedValue(expectedResult);

            // Act
            const result = await service.createMapping(newMappingData);

            // Assert
            // Verify the service's primary responsibility: adding a unique ID.
            expect(mockMappingRepo.create).toHaveBeenCalledTimes(1);
            expect(mockMappingRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.any(String), // The service should have added a UUID
                    mainComponentId: 'comp-123',
                })
            );
            expect(result).toBe(expectedResult);
        });
    });

    describe('getMappingById', () => {
        it('should call the repository findById method and return its result', async () => {
            const mappingId = 'mapping-uuid';
            mockMappingRepo.findById.mockResolvedValue({} as Mapping);
            await service.getMappingById(mappingId);
            expect(mockMappingRepo.findById).toHaveBeenCalledWith(mappingId);
        });
    });
    
    describe('getMappingsByMainComponentId', () => {
        it('should call the repository findByMainComponentId method', async () => {
            const mainComponentId = 'comp-123';
            await service.getMappingsByMainComponentId(mainComponentId);
            expect(mockMappingRepo.findByMainComponentId).toHaveBeenCalledWith(mainComponentId);
        });
    });

    describe('getAllMappings', () => {
        it('should call the repository findAll method', async () => {
            await service.getAllMappings();
            expect(mockMappingRepo.findAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('updateMapping', () => {
        it('should call the repository update method with the correct parameters', async () => {
            const mappingId = 'mapping-uuid';
            const updateData: UpdateMappingData = { testComponentName: 'Updated Name' };
            await service.updateMapping(mappingId, updateData);
            expect(mockMappingRepo.update).toHaveBeenCalledWith(mappingId, updateData);
        });
    });

    describe('deleteMapping', () => {
        it('should call the repository delete method and return its boolean result', async () => {
            const mappingId = 'mapping-uuid';
            mockMappingRepo.delete.mockResolvedValue(true);
            const result = await service.deleteMapping(mappingId);
            expect(mockMappingRepo.delete).toHaveBeenCalledWith(mappingId);
            expect(result).toBe(true);
        });
    });
});