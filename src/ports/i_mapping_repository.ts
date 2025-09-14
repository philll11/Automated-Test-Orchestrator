// src/ports/mapping_repository.ts

import { Mapping } from "../domain/mapping.js";

export type NewMapping = Omit<Mapping, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateMappingData = Partial<Omit<Mapping, 'id' | 'mainComponentId' | 'createdAt' | 'updatedAt'>>;

export interface IMappingRepository {
  /**
   * Creates a new component-test mapping record.
   * @param newMapping The data for the new mapping, including a pre-generated UUID.
   */
  create(newMapping: Omit<Mapping, 'createdAt' | 'updatedAt'>): Promise<Mapping>;

  /**
   * Finds a single, unique mapping record by its UUID primary key.
   * @param id The unique ID of the mapping record.
   */
  findById(id: string): Promise<Mapping | null>;

  /**
   * Finds all mapping records associated with a specific main component ID.
   * @param mainComponentId The ID of the main component.
   * @returns An array of all associated mappings.
   */
  findByMainComponentId(mainComponentId: string): Promise<Mapping[]>;
  
  /**
   * Retrieves all component-test mappings from the datastore.
   */
  findAll(): Promise<Mapping[]>;

  /**
   * For a given list of main component IDs, finds all associated test component IDs.
   * @param mainComponentIds An array of main component IDs.
   * @returns A Map where the key is the mainComponentId and the value is an ARRAY of testComponentIds.
   */
  findAllTestsForMainComponents(mainComponentIds: string[]): Promise<Map<string, string[]>>;

  /**
   * Updates an existing component-test mapping record, identified by its unique ID.
   * @param id The unique ID of the mapping record to update.
   * @param updates The data to update.
   */
  update(id: string, updates: UpdateMappingData): Promise<Mapping | null>;

  /**
   * Deletes a component-test mapping record by its unique ID.
   * @param id The unique ID of the mapping record to delete.
   */
  delete(id: string): Promise<boolean>;
}