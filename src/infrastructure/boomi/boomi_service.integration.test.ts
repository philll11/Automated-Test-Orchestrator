import nock from 'nock';
import { BoomiService } from './boomi_service';
import { IntegrationPlatformCredentials, TestExecutionOptions } from '../../ports/i_integration_platform_service.js';

// Define a scope for our mock API server. This must match the base URL our service creates.
const BOOMI_API_BASE = 'https://api.boomi.com';

describe('BoomiService Integration Tests', () => {
    const dummyCredentials: IntegrationPlatformCredentials = {
        accountId: 'test-account-123',
        username: 'testuser',
        passwordOrToken: 'testpass'
    };
    const baseApiUrl = `/api/rest/v1/${dummyCredentials.accountId}`;

    const executionOptions: TestExecutionOptions = { executionInstanceId: 'test-exec-instance-456' };

    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        nock.cleanAll();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    it('should fetch component info and dependencies correctly on a happy path', async () => {
        // --- Arrange: Setup the mock API responses ---
        const rootComponentId = 'comp-root-A';
        const componentVersion = 17;

        // Mock the GET /ComponentMetadata endpoint to include the component name
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(200, { name: 'Root Component A', version: componentVersion, type: 'process' });

        const expectedPostBody = {
            QueryFilter: {
                expression: {
                    operator: 'and',
                    nestedExpression: [
                        { operator: 'EQUALS', property: 'parentComponentId', argument: [rootComponentId] },
                        { operator: 'EQUALS', property: 'parentVersion', argument: [componentVersion] },
                    ],
                },
            },
        };

        const mockQueryResponse = {
            numberOfResults: 1,
            result: [
                {
                    references: [
                        { componentId: 'dep-1' },
                        { componentId: 'dep-2' },
                    ],
                },
            ],
        };

        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentReference/query`, expectedPostBody)
            .reply(200, mockQueryResponse);

        // --- Act ---
        const service = new BoomiService(dummyCredentials);
        const result = await service.getComponentInfoAndDependencies(rootComponentId);

        // Assert against the new return structure
        expect(result).toEqual({
            id: rootComponentId,
            name: 'Root Component A',
            type: 'process',
            dependencyIds: ['dep-1', 'dep-2']
        });

        expect(nock.isDone()).toBe(true);
    });

    it('should return null if the component is not found (400 error)', async () => {
        // --- Arrange ---
        const invalidComponentId = 'comp-invalid-B';
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${invalidComponentId}`)
            .reply(400, { message: 'Component not found' });

        // --- Act ---
        const service = new BoomiService(dummyCredentials);
        const result = await service.getComponentInfoAndDependencies(invalidComponentId);

        // Assert that the result is null
        expect(result).toBeNull();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            `Component with ID ${invalidComponentId} not found or invalid. It will be treated as having no dependencies.`
        );
        expect(nock.isDone()).toBe(true);
    });

    it('should return the name and an empty dependency array if a valid component has no dependencies', async () => {
        // --- Arrange ---
        const rootComponentId = 'comp-root-C';
        const componentVersion = 2;

        // Mock the GET /ComponentMetadata endpoint to include the component name
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(200, { name: 'Root Component C', version: componentVersion, type: 'process' });

        const mockQueryResponse = {
            numberOfResults: 0,
            result: [],
        };

        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentReference/query`)
            .reply(200, mockQueryResponse);

        // --- Act ---
        const service = new BoomiService(dummyCredentials);
        const result = await service.getComponentInfoAndDependencies(rootComponentId);

        // Assert against the new return structure with an empty array
        expect(result).toEqual({
            id: rootComponentId,
            name: 'Root Component C',
            type: 'process',
            dependencyIds: []
        });
        expect(nock.isDone()).toBe(true);
    });

    it('should correctly set the Authorization header for Basic Auth', async () => {
        const rootComponentId = 'comp-auth-D';
        nock(BOOMI_API_BASE, {
            reqheaders: {
                'authorization': `Basic ${Buffer.from('testuser:testpass').toString('base64')}`
            }
        })
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(400);

        const service = new BoomiService(dummyCredentials);
        await service.getComponentInfoAndDependencies(rootComponentId);

        expect(nock.isDone()).toBe(true);
    });

    describe('executeTestProcess', () => {

        it('should poll until a successful completion', async () => {
            const componentId = 'comp-to-succeed';
            const requestId = 'execution-success-123';
            const recordUrl = 'https://platform.boomi.com/log/success-123';

            nock(BOOMI_API_BASE)
                .post(`${baseApiUrl}/ExecutionRequest`)
                .reply(200, {
                    '@type': 'ExecutionRequest',
                    requestId,
                    recordUrl
                });

            nock(BOOMI_API_BASE)
                .get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`)
                .times(2)
                .reply(200, { '@type': 'AsyncOperationResult', responseStatusCode: 202 });

            nock(BOOMI_API_BASE)
                .get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`)
                .reply(200, {
                    '@type': 'AsyncOperationResult',
                    responseStatusCode: 200,
                    result: [{ '@type': 'ExecutionRecord', status: 'COMPLETE' }]
                });

            const service = new BoomiService(dummyCredentials);
            const result = await service.executeTestProcess(componentId, executionOptions);

            expect(result.status).toBe('SUCCESS');
            expect(result.executionLogUrl).toBe(recordUrl);
            expect(nock.isDone()).toBe(true);
        });

        it('should poll until an ERROR status is returned', async () => {
            const componentId = 'comp-to-fail';
            const requestId = 'execution-fail-456';

            nock(BOOMI_API_BASE).post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId });
            nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).reply(200, { responseStatusCode: 202 });
            nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).reply(200, {
                responseStatusCode: 200,
                result: [{ status: 'ERROR', message: 'Component failed spectacularly.' }]
            });

            const service = new BoomiService(dummyCredentials);
            const result = await service.executeTestProcess(componentId, executionOptions);

            expect(result.status).toBe('FAILURE');
            expect(result.message).toContain('Component failed spectacularly.');
            expect(nock.isDone()).toBe(true);
        });

        it('should return a failure if polling times out', async () => {
            const componentId = 'comp-to-timeout';
            const requestId = 'execution-timeout-789';

            nock(BOOMI_API_BASE).post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId });
            nock(BOOMI_API_BASE)
                .get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`)
                .times(10)
                .reply(200, { responseStatusCode: 202 });

            const service = new BoomiService(dummyCredentials, {
                pollInterval: 1,
                maxPolls: 10
            });
            const result = await service.executeTestProcess(componentId, executionOptions);

            expect(result.status).toBe('FAILURE');
            expect(result.message).toBe('Execution timed out while polling for a result.');
            expect(nock.isDone()).toBe(true);
        });
    });

});