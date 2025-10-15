// src/routes/mappings.controller.ts

import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { IMappingService } from '../ports/i_mapping_service.js';
import { TYPES } from '../inversify.types.js';
import { BadRequestError, NotFoundError } from '../utils/app_error.js';
import { UpdateMappingData } from '../ports/i_mapping_repository.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Mapping:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The unique identifier for the mapping.
 *         mainComponentId:
 *           type: string
 *           description: The ID of the main component being tested.
 *         mainComponentName:
 *           type: string
 *           nullable: true
 *           description: The human-readable name of the main component.
 *         testComponentId:
 *           type: string
 *           description: The ID of the component that acts as a test.
 *         testComponentName:
 *           type: string
 *           nullable: true
 *           description: The human-readable name of the test component.
 *         isDeployed:
 *           type: boolean
 *           nullable: true
 *           description: Flag indicating if the test component is deployed.
 *         isPackaged:
 *           type: boolean
 *           nullable: true
 *           description: Flag indicating if the test component is a packaged component.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ApiResponse_Mapping:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/ResponseMetadata'
 *         data:
 *           $ref: '#/components/schemas/Mapping'
 *     ApiResponse_MappingList:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/ResponseMetadata'
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Mapping'
 */
@injectable()
export class MappingsController {
    constructor(
        @inject(TYPES.IMappingService) private mappingService: IMappingService
    ) { }

    /**
     * @swagger
     * /mappings:
     *   post:
     *     summary: Create a new test mapping
     *     tags: [Mappings]
     *     description: Creates a new mapping between a main component and a test component.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [mainComponentId, testComponentId]
     *             properties:
     *               mainComponentId:
     *                 type: string
     *                 example: "abc-123"
     *               mainComponentName:
     *                 type: string
     *                 example: "Main Process ABC"
     *               testComponentId:
     *                 type: string
     *                 example: "test-abc-123"
     *               testComponentName:
     *                 type: string
     *                 example: "Unit Test for ABC Process"
     *               isDeployed:
     *                 type: boolean
     *                 example: true
     *               isPackaged:
     *                 type: boolean
     *                 example: false
     *     responses:
     *       '201':
     *         description: Mapping created successfully.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_Mapping'
     */
    async createMapping(req: Request, res: Response): Promise<void> {
        const { mainComponentId, mainComponentName, testComponentId, testComponentName, isDeployed, isPackaged } = req.body;
        if (!mainComponentId || !testComponentId) {
            throw new BadRequestError('mainComponentId and testComponentId are required');
        }
        const newMapping = await this.mappingService.createMapping({ mainComponentId, mainComponentName, testComponentId, testComponentName, isDeployed, isPackaged });
        res.status(201).json({ metadata: { code: 201, message: 'Created' }, data: newMapping });
    }

    /**
     * @swagger
     * /mappings:
     *   get:
     *     summary: Retrieve all test mappings
     *     tags: [Mappings]
     *     description: Returns a list of all component-to-test mappings in the system.
     *     responses:
     *       '200':
     *         description: A list of mappings.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_MappingList'
     */
    async getAllMappings(req: Request, res: Response): Promise<void> {
        const mappings = await this.mappingService.getAllMappings();
        res.status(200).json({ metadata: { code: 200, message: 'OK' }, data: mappings });
    }

    /**
     * @swagger
     * /mappings/{mappingId}:
     *   get:
     *     summary: Retrieve a single mapping by its ID
     *     tags: [Mappings]
     *     description: Returns a single component-to-test mapping by its unique UUID.
     *     parameters:
     *       - in: path
     *         name: mappingId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *     responses:
     *       '200':
     *         description: The requested mapping.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_Mapping'
     *       '404':
     *         description: Mapping not found.
     */
    async getMappingById(req: Request, res: Response): Promise<void> {
        const { mappingId } = req.params;
        const mapping = await this.mappingService.getMappingById(mappingId);
        if (!mapping) throw new NotFoundError('Mapping not found');
        res.status(200).json({ metadata: { code: 200, message: 'OK' }, data: mapping });
    }

    /**
     * @swagger
     * /mappings/component/{mainComponentId}:
     *   get:
     *     summary: Retrieve all mappings for a component
     *     tags: [Mappings]
     *     description: Returns a list of all test mappings associated with a specific main component ID.
     *     parameters:
     *       - in: path
     *         name: mainComponentId
     *         required: true
     *         schema:
     *           type: string
     *           example: "abc-123"
     *     responses:
     *       '200':
     *         description: A list of mappings for the component.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_MappingList'
     */
    async getMappingsByMainComponentId(req: Request, res: Response): Promise<void> {
        const { mainComponentId } = req.params;
        const mappings = await this.mappingService.getMappingsByMainComponentId(mainComponentId);
        res.status(200).json({ metadata: { code: 200, message: 'OK' }, data: mappings });
    }

    /**
     * @swagger
     * /mappings/{mappingId}:
     *   put:
     *     summary: Update a test mapping
     *     tags: [Mappings]
     *     description: Updates one or more fields for an existing mapping.
     *     parameters:
     *       - in: path
     *         name: mappingId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               mainComponentName:
     *                 type: string
     *                 example: "Updated Main Process ABC"
     *               testComponentId:
     *                 type: string
     *                 example: "test-abc-123-v2"
     *               testComponentName:
     *                 type: string
     *                 example: "Updated Unit Test for ABC Process"
     *               isDeployed:
     *                 type: boolean
     *                 example: false
     *               isPackaged:
     *                 type: boolean
     *                 example: true
     *     responses:
     *       '200':
     *         description: The updated mapping.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_Mapping'
     *       '404':
     *         description: Mapping not found.
     */
    async updateMapping(req: Request, res: Response): Promise<void> {
        const { mappingId } = req.params;
        const { mainComponentName, testComponentId, testComponentName, isDeployed, isPackaged } = req.body;
        
        // Build the update object with only the fields that were provided
        const updateData: UpdateMappingData = {};
        if (mainComponentName !== undefined) updateData.mainComponentName = mainComponentName;
        if (testComponentId !== undefined) updateData.testComponentId = testComponentId;
        if (testComponentName !== undefined) updateData.testComponentName = testComponentName;
        if (isDeployed !== undefined) updateData.isDeployed = isDeployed;
        if (isPackaged !== undefined) updateData.isPackaged = isPackaged;
        
        if (Object.keys(updateData).length === 0) {
            throw new BadRequestError('At least one field to update must be provided');
        }

        const updatedMapping = await this.mappingService.updateMapping(mappingId, updateData);
        if (!updatedMapping) throw new NotFoundError('Mapping not found');
        res.status(200).json({ metadata: { code: 200, message: 'OK' }, data: updatedMapping });
    }

    /**
     * @swagger
     * /mappings/{mappingId}:
     *   delete:
     *     summary: Delete a test mapping
     *     tags: [Mappings]
     *     description: Deletes a specific component-to-test mapping by its unique UUID.
     *     parameters:
     *       - in: path
     *         name: mappingId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *     responses:
     *       '204':
     *         description: Mapping deleted successfully.
     *       '404':
     *         description: Mapping not found.
     */
    async deleteMapping(req: Request, res: Response): Promise<void> {
        const { mappingId } = req.params;
        const wasDeleted = await this.mappingService.deleteMapping(mappingId);
        if (!wasDeleted) throw new NotFoundError('Mapping not found');
        res.status(204).send();
    }
}