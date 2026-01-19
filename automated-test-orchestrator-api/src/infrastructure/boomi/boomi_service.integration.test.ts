import nock from 'nock';
import { BoomiService } from './boomi_service.js';
import { IntegrationPlatformCredentials } from '../../domain/integration_platform_credentials.js';
import { IPlatformConfig } from '../config.js'; // Import the config interface
import { ComponentSearchCriteria } from '../../ports/i_integration_platform_service.js';

// --- MOCK CREDENTIALS ---
const testCredentials: IntegrationPlatformCredentials = {
    accountId: 'test-account-123',
    username: 'testuser',
    passwordOrToken: 'test-token-abc',
    executionInstanceId: 'atom-instance-xyz'
};

const BOOMI_API_BASE = 'https://api.boomi.com';
const baseApiUrl = `/api/rest/v1/${testCredentials.accountId}`;

describe('BoomiService', () => {
    let consoleWarnSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        nock.cleanAll();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should use constructor options to override default values', () => {
        // --- THIS IS THE CORRECTED OBJECT ---
        const customConfig: IPlatformConfig = {
            pollInterval: 5000,
            maxPolls: 10,
            maxRetries: 2,
            initialDelay: 999,
            concurrencyLimit: 1, // Added the missing property
        };

        const service = new BoomiService(testCredentials, customConfig);

        // Assert that all custom values were used
        expect((service as any).pollInterval).toBe(5000);
        expect((service as any).maxPolls).toBe(10);
        expect((service as any).maxRetries).toBe(2);
        expect((service as any).initialDelay).toBe(999);
        // Note: The concurrencyLimit is not used directly by BoomiService, so we don't test it here.
        // We just need it to satisfy the IPlatformConfig type.
    });

    it('should fall back to default values if options are not provided', () => {
        const service = new BoomiService(testCredentials);

        // Verify the hardcoded default values
        expect((service as any).pollInterval).toBe(2000);
        expect((service as any).maxPolls).toBe(180);
        expect((service as any).maxRetries).toBe(5);
        expect((service as any).initialDelay).toBe(1000);
    });

    // (The rest of the tests in this file are correct and do not need to be changed)
    it('should fetch component info and dependencies correctly on a happy path', async () => {
        const rootComponentId = 'comp-root-A';
        const componentVersion = 17;

        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(200, { name: 'Root Component A', version: componentVersion, type: 'process' });

        const mockQueryResponse = {
            numberOfResults: 1,
            result: [{ references: [{ componentId: 'dep-1' }, { componentId: 'dep-2' }] }],
        };

        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentReference/query`)
            .reply(200, mockQueryResponse);

        const service = new BoomiService(testCredentials);
        const result = await service.getComponentInfoAndDependencies(rootComponentId);

        expect(result).toEqual({
            id: rootComponentId,
            name: 'Root Component A',
            type: 'process',
            dependencyIds: ['dep-1', 'dep-2']
        });
        expect(nock.isDone()).toBe(true);
    });

    it('should return null if the component is not found (400 error)', async () => {
        const invalidComponentId = 'comp-invalid-B';
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${invalidComponentId}`)
            .reply(400, { message: 'Component not found' });

        const service = new BoomiService(testCredentials);
        const result = await service.getComponentInfoAndDependencies(invalidComponentId);

        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
        expect(nock.isDone()).toBe(true);
    });

    it('should return an empty dependency array if a component has no dependencies', async () => {
        const rootComponentId = 'comp-root-C';
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(200, { name: 'Root Component C', version: 2, type: 'process' });

        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentReference/query`)
            .reply(200, { numberOfResults: 0, result: [] });

        const service = new BoomiService(testCredentials);
        const result = await service.getComponentInfoAndDependencies(rootComponentId);

        expect(result?.dependencyIds).toEqual([]);
        expect(nock.isDone()).toBe(true);
    });

    describe('executeTestProcess', () => {

        it('should poll until a successful completion', async () => {
            const componentId = 'comp-to-succeed';
            const requestId = 'execution-success-123';
            const recordUrl = 'https://platform.boomi.com/log/success-123';

            nock(BOOMI_API_BASE).post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId, recordUrl });
            nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).times(2).reply(200, { responseStatusCode: 202 });
            nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).reply(200, {
                responseStatusCode: 200,
                result: [{ status: 'COMPLETE' }]
            });

            const service = new BoomiService(testCredentials);
            const result = await service.executeTestProcess(componentId);

            expect(result.status).toBe('SUCCESS');
            expect(result.executionLogUrl).toBe(recordUrl);
            expect(nock.isDone()).toBe(true);
        });

        it('should poll until an ERROR status is returned', async () => {
            const componentId = 'comp-to-fail';
            const requestId = 'execution-fail-456';
            const errorMessage = 'Component failed spectacularly.';

            nock(BOOMI_API_BASE).post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId });
            nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).reply(200, { responseStatusCode: 202 });
            nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).reply(200, {
                responseStatusCode: 200,
                result: [{ status: 'ERROR', message: errorMessage }]
            });

            const service = new BoomiService(testCredentials);
            const result = await service.executeTestProcess(componentId);

            expect(result.status).toBe('FAILURE');
            expect(result.message).toContain(errorMessage);
            expect(nock.isDone()).toBe(true);
        });
        
        it('should return a failure if polling exceeds maxPolls from options', async () => {
            const componentId = 'comp-to-timeout';
            const requestId = 'execution-timeout-789';

            nock(BOOMI_API_BASE).post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId });
            
            nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).times(3).reply(200, { responseStatusCode: 202 });

            const customConfig = { pollInterval: 1, maxPolls: 3 };

            const service = new BoomiService(testCredentials, customConfig);
            const result = await service.executeTestProcess(componentId);

            expect(result.status).toBe('FAILURE');
            expect(result.message).toBe('Execution timed out while polling for a result.');
            expect(nock.isDone()).toBe(true);
        });
    });

    describe('searchComponents', () => {
        it('should consolidate ID, Name, and Folder searches into appropriate queries', async () => {
             // Setup Criteria
             const criteria: ComponentSearchCriteria = {
                 ids: ['proc-123', 'proc-456'],
                 names: ['My Process'],
                 folderNames: ['My Folder'],
                 types: ['process']
             };

             // Expect Single ComponentMetadata Query
             nock(BOOMI_API_BASE)
                 .post(`${baseApiUrl}/ComponentMetadata/query`, (body) => {
                     // This is the complex validation
                     const mainAnd = body.QueryFilter.expression;
                     if (mainAnd.operator !== 'and') return false;
                     
                     const filters = mainAnd.nestedExpression;
                     // Should have deleted=false, currentVersion=true, type=process, OR-block
                     const deleted = filters.find((f: any) => f.property === 'deleted');
                     const current = filters.find((f: any) => f.property === 'currentVersion');
                     const type = filters.find((f: any) => f.property === 'type');
                     const orBlock = filters.find((f: any) => f.operator === 'or');

                     if (!deleted || !current || !type || !orBlock) return false;

                     // Check OR block contents
                     const orExprs = orBlock.nestedExpression;
                     // Should contain:
                     // 1. folderName EQUALS ['My Folder']
                     // 2. name EQUALS ['My Process']
                     // 3. nested OR request for IDs
                     
                     const folderCheck = orExprs.find((f: any) => f.property === 'folderName' && f.argument[0] === 'My Folder');
                     const nameCheck = orExprs.find((f: any) => f.property === 'name' && f.argument[0] === 'My Process');
                     const idCheck = orExprs.find((f: any) => f.operator === 'or' && f.nestedExpression.length === 2); // 2 IDs

                     return !!folderCheck && !!nameCheck && !!idCheck;
                 })
                 .reply(200, {
                     numberOfResults: 1,
                     result: [
                         { componentId: 'proc-123', name: 'My Process', type: 'process', folderId: 'folder-abc', folderName: 'My Folder' }
                     ]
                 });

            const service = new BoomiService(testCredentials);
            const results = await service.searchComponents(criteria);

            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('proc-123');
            expect(nock.isDone()).toBe(true);
        });

        it('should handle pagination when search returns more results than one page', async () => {
             // Simple criteria
             const criteria: ComponentSearchCriteria = { names: ['Common'] };

             // Mock First Page (returns token)
             nock(BOOMI_API_BASE)
                .post(`${baseApiUrl}/ComponentMetadata/query`)
                .reply(200, {
                    numberOfResults: 2,
                    queryToken: 'token-abc',
                    result: [{ componentId: '1', name: 'Common A', version: 1, type: 'process' }]
                });

             // Mock Second Page (uses token, no token in response)
             // Note: Boomi API client sends token as JSON string, so body is "token-abc"
             nock(BOOMI_API_BASE)
                .post(`${baseApiUrl}/ComponentMetadata/queryMore`, JSON.stringify('token-abc'))
                .reply(200, {
                    numberOfResults: 1,
                    result: [{ componentId: '2', name: 'Common B', version: 1, type: 'process' }]
                });

             const service = new BoomiService(testCredentials);
             const results = await service.searchComponents(criteria);

             expect(results).toHaveLength(2);
             expect(results.map(r => r.id).sort()).toEqual(['1', '2']);
             expect(nock.isDone()).toBe(true);
        });
    });
});