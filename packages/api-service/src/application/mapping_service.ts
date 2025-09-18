// src/application/mapping_service.ts

import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { IMappingService } from '../ports/i_mapping_service.js';
import { IMappingRepository, NewMapping, UpdateMappingData } from '../ports/i_mapping_repository.js';
import { Mapping } from '../domain/mapping.js';
import { TYPES } from '../inversify.types.js';

@injectable()
export class MappingService implements IMappingService {
    constructor(
        @inject(TYPES.IMappingRepository) private mappingRepository: IMappingRepository
    ) {}

    async createMapping(mappingData: NewMapping): Promise<Mapping> {
        const mappingWithId: Omit<Mapping, 'createdAt' | 'updatedAt'> = {
            id: uuidv4(),
            ...mappingData
        };
        return this.mappingRepository.create(mappingWithId);
    }

    async getMappingById(id: string): Promise<Mapping | null> {
        return this.mappingRepository.findById(id);
    }

    async getMappingsByMainComponentId(mainComponentId: string): Promise<Mapping[]> {
        return this.mappingRepository.findByMainComponentId(mainComponentId);
    }

    async getAllMappings(): Promise<Mapping[]> {
        return this.mappingRepository.findAll();
    }

    async updateMapping(id: string, updateData: UpdateMappingData): Promise<Mapping | null> {
        return this.mappingRepository.update(id, updateData);
    }

    async deleteMapping(id: string): Promise<boolean> {
        return this.mappingRepository.delete(id);
    }
}