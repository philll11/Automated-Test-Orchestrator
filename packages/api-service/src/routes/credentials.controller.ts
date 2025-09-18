// src/routes/credentials.controller.ts

import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { ICredentialService } from '../ports/i_credential_service.js';
import { BadRequestError, NotFoundError } from '../utils/app_error.js';

@injectable()
export class CredentialsController {
  constructor(
    @inject(TYPES.ICredentialService) private credentialService: ICredentialService
  ) { }

  /**
   * @swagger
   * /api/v1/credentials:
   *   post:
   *     summary: Add or Update a Credential Profile
   *     tags: [Credentials]
   *     description: Securely saves a new credential profile. If a profile with the same name exists, it will be overwritten.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - profileName
   *               - accountId
   *               - username
   *               - passwordOrToken
   *               - executionInstanceId
   *             properties:
   *               profileName:
   *                 type: string
   *                 example: "dev-account"
   *               accountId:
   *                 type: string
   *                 example: "boomi-V123XYZ"
   *               username:
   *                 type: string
   *                 example: "user@example.com"
   *               passwordOrToken:
   *                 type: string
   *                 format: password
   *                 example: "a-secret-token-value"
   *               executionInstanceId:
   *                 type: string
   *                 example: "atom-1a2b3c"
   *     responses:
   *       '201':
   *         description: Created. The profile was saved successfully.
   *       '400':
   *         description: Bad Request. Missing required fields.
   */
  public async addCredential(req: Request, res: Response): Promise<void> {
    const { profileName, ...credentials } = req.body;

    if (!profileName || !credentials.accountId || !credentials.username || !credentials.passwordOrToken || !credentials.executionInstanceId) {
      throw new BadRequestError('Request body must include profileName and all credential fields.');
    }

    await this.credentialService.add(profileName, credentials);
    res.status(201).json({
      metadata: { code: 201, message: 'Created' },
    });
  }

  /**
   * @swagger
   * /api/v1/credentials:
   *   get:
   *     summary: List Credential Profiles
   *     tags: [Credentials]
   *     description: Retrieves a list of all saved credential profiles, omitting sensitive fields.
   *     responses:
   *       '200':
   *         description: OK.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 metadata:
   *                   $ref: '#/components/schemas/ResponseMetadata'
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CredentialProfile'
   */
  public async listCredentials(req: Request, res: Response): Promise<void> {
    const profiles = await this.credentialService.list();
    res.status(200).json({
      metadata: { code: 200, message: 'OK' },
      data: profiles,
    });
  }

  /**
   * @swagger
   * /api/v1/credentials/{profileName}:
   *   delete:
   *     summary: Delete a Credential Profile
   *     tags: [Credentials]
   *     description: Permanently deletes a credential profile by its unique name.
   *     parameters:
   *       - in: path
   *         name: profileName
   *         required: true
   *         schema:
   *           type: string
   *           example: "dev-account"
   *     responses:
   *       '204':
   *         description: No Content. The profile was deleted successfully.
   *       '404':
   *         description: Not Found. The specified profile does not exist.
   */
  public async deleteCredential(req: Request, res: Response): Promise<void> {
    const { profileName } = req.params;
    const success = await this.credentialService.delete(profileName);

    if (!success) {
      throw new NotFoundError(`Profile "${profileName}" not found.`);
    }

    res.status(204).send();
  }
}