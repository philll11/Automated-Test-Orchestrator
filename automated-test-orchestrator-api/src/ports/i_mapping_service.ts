// src/ports/i_mapping_service.ts

import { Mapping } from "../domain/mapping.js";
import { NewMapping, UpdateMappingData } from "./i_mapping_repository.js";

export interface IMappingService {
  /**
   * Creates a new component-to-test mapping.
   * @param mappingData The data for the new mapping (mainComponentId and testComponentId).
   * @returns The newly created mapping, including its unique ID.
   */
  createMapping(mappingData: NewMapping): Promise<Mapping>;

  /**
   * Retrieves a single, unique mapping by its UUID.
   * @param id The unique ID of the mapping record.
   * @returns The mapping, or null if not found.
   */
  getMappingById(id: string): Promise<Mapping | null>;

  /**
   * Retrieves all mappings for a specific main component.
   * @param mainComponentId The ID of the main component.
   * @returns An array of all associated mappings.
   */
  getMappingsByMainComponentId(mainComponentId: string): Promise<Mapping[]>;

  /**
   * Retrieves all component-to-test mappings in the system.
   * @returns An array of all mappings.
   */
  getAllMappings(): Promise<Mapping[]>;

  /**
   * Updates an existing mapping's testComponentId.
   * @param id The unique ID of the mapping record to update.
   * @param updateData The fields to be updated.
   * @returns The updated mapping, or null if not found.
   */
  updateMapping(id: string, updateData: UpdateMappingData): Promise<Mapping | null>;

  /**
   * Deletes a mapping by its unique ID.
   * @param id The unique ID of the mapping record to delete.
   * @returns A boolean indicating if the deletion was successful.
   */
  deleteMapping(id: string): Promise<boolean>;
}