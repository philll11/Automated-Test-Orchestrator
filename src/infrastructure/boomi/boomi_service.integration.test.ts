import nock from 'nock';
import { BoomiService } from './boomi_service';
import { BoomiCredentials } from '../../ports/i_boomi_service';

// Define a scope for our mock API server. This must match the base URL our service creates.
const BOOMI_API_BASE = 'https://api.boomi.com';

describe('BoomiService Integration Tests', () => {
    const dummyCredentials: BoomiCredentials = {
        accountId: 'test-account-123',
        username: 'testuser',
        password_or_token: 'testpass',
    };
    const baseApiUrl = `/api/rest/v1/${dummyCredentials.accountId}`;

    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        // Ensure no nock interceptors are left over from previous tests
        nock.cleanAll();
        // Spy on console.warn to check for specific log messages without polluting the output
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        // Restore the original console.warn
        consoleWarnSpy.mockRestore();
    });

    it('should fetch component dependencies correctly on a happy path', async () => {
        // --- Arrange: Setup the mock API responses ---
        const rootComponentId = 'comp-root-A';
        const componentVersion = 17;

        // 1. Mock the GET /ComponentMetadata endpoint
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(200, { version: componentVersion });

        // 2. Mock the POST /ComponentReference/query endpoint
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

        // --- Act: Call the service method ---
        const service = new BoomiService(dummyCredentials);
        const dependencies = await service.getComponentDependencies(rootComponentId);

        // --- Assert: Verify the results ---
        expect(dependencies).toEqual(['dep-1', 'dep-2']);

        // Verify that all mocked endpoints were called
        expect(nock.isDone()).toBe(true);
    });

    it('should return an empty array if the component is not found (400 error)', async () => {
        // --- Arrange ---
        const invalidComponentId = 'comp-invalid-B';

        // Mock the GET /ComponentMetadata endpoint to return a 400 error
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${invalidComponentId}`)
            .reply(400, { message: 'Component not found' });

        // --- Act ---
        const service = new BoomiService(dummyCredentials);
        const dependencies = await service.getComponentDependencies(invalidComponentId);

        // --- Assert ---
        expect(dependencies).toEqual([]);

        // Check that the warning was logged
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            `Component with ID ${invalidComponentId} not found or invalid. It will be treated as having no dependencies.`
        );

        // Verify that the POST /query endpoint was NEVER called
        expect(nock.isDone()).toBe(true);
    });

    it('should return an empty array if a valid component has no dependencies', async () => {
        // --- Arrange ---
        const rootComponentId = 'comp-root-C';
        const componentVersion = 2;

        // 1. Mock the GET /ComponentMetadata endpoint
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(200, { version: componentVersion });

        // 2. Mock the POST /ComponentReference/query to return 0 results
        const mockQueryResponse = {
            numberOfResults: 0,
            result: [],
        };

        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentReference/query`) // Body can be less specific here
            .reply(200, mockQueryResponse);

        // --- Act ---
        const service = new BoomiService(dummyCredentials);
        const dependencies = await service.getComponentDependencies(rootComponentId);

        // --- Assert ---
        expect(dependencies).toEqual([]);
        expect(nock.isDone()).toBe(true);
    });

    it('should correctly set the Authorization header for Basic Auth', async () => {
        const rootComponentId = 'comp-auth-D';

        // Arrange: Mock the API but require the Basic Auth header to be present
        nock(BOOMI_API_BASE, {
            reqheaders: {
                // axios creates a 'Basic base64(user:pass)' header
                'authorization': `Basic ${Buffer.from('testuser:testpass').toString('base64')}`
            }
        })
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(400); // We don't care about the response, only that the request was matched

        const service = new BoomiService(dummyCredentials);
        await service.getComponentDependencies(rootComponentId);

        expect(nock.isDone()).toBe(true);
    });
});