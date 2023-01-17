import { PluginEvent } from '@posthog/plugin-scaffold'
import { SalesforcePluginConfig, SalesforcePluginMeta } from '.'
import { EventToSinkMapping, parseEventSinkConfig, sendEventToSink, validateEventSinkConfig } from './eventSinkMapping'

describe('event sink mapping', () => {
    const invalidMapping: EventToSinkMapping = {
        a: {
            salesforcePath: 'something',
            propertiesToInclude: [],
        },
        b: {
            salesforcePath: '',
            propertiesToInclude: [],
        },
    }

    const validMapping: EventToSinkMapping = {
        $pageview: {
            salesforcePath: 'something',
            propertiesToInclude: [],
        },
    }

    describe('parsing', () => {
        it('can parse a valid event sink mapping', () => {
            const config = ({ eventEndpointMapping: JSON.stringify(validMapping) } as unknown) as SalesforcePluginConfig
            const mapping = parseEventSinkConfig(config)
            expect(mapping).toEqual(validMapping)
        })

        it('can parse an empty event sink mapping', () => {
            const config = ({ eventEndpointMapping: '' } as unknown) as SalesforcePluginConfig
            const mapping = parseEventSinkConfig(config)
            expect(mapping).toEqual(null)
        })

        it('can parse nonsense as an empty event sink mapping', () => {
            const config = ({ eventEndpointMapping: '🤘' } as unknown) as SalesforcePluginConfig
            const mapping = parseEventSinkConfig(config)
            expect(mapping).toEqual(null)
        })
    })

    describe('validation', () => {
        it('can validate an event sink mapping with missing salesforcePath', () => {
            expect(() => {
                validateEventSinkConfig(invalidMapping, ({
                    eventEndpointMapping: JSON.stringify(invalidMapping),
                } as unknown) as SalesforcePluginConfig)
            }).toThrowError('You must provide a salesforce path for each mapping in config.eventEndpointMapping.')
        })

        it('can validate invalid JSON in EventToSinkMapping', () => {
            const mapping = ({
                really: 'not an event to sink mapping',
            } as unknown) as EventToSinkMapping
            expect(() => {
                validateEventSinkConfig(mapping, ({
                    eventEndpointMapping: JSON.stringify(mapping),
                } as unknown) as SalesforcePluginConfig)
            }).toThrowError('You must provide a salesforce path for each mapping in config.eventEndpointMapping.')
        })

        it('can validate eventsToInclude must be present if an event sink mapping is not', () => {
            expect(() => {
                validateEventSinkConfig(null, ({
                    eventEndpointMapping: '',
                } as unknown) as SalesforcePluginConfig)
            }).toThrowError('If you are not providing an eventEndpointMapping then you must provide events to include.')
        })

        it('can validate that you should not send v1 and v2 config', () => {
            const mapping: EventToSinkMapping = {
                $pageView: {
                    salesforcePath: 'something',
                    propertiesToInclude: [],
                },
            }
            expect(() => {
                validateEventSinkConfig(mapping, ({
                    eventEndpointMapping: JSON.stringify(mapping),
                    eventsToInclude: '$pageView',
                } as unknown) as SalesforcePluginConfig)
            }).toThrowError('You should not provide both eventsToInclude and eventMapping.')
        })
    })

    describe('sending to sink', () => {
        const mockFetch = jest.fn()
        beforeEach(() => {
            mockFetch.mockClear()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(global as any).fetch = mockFetch
            mockFetch.mockReturnValue(Promise.resolve({ status: 200 }))
        })
        it('does not send to a sink if there is no mapping for the event', async () => {
            await sendEventToSink(
                { event: 'uninteresting' } as PluginEvent,
                validMapping,
                ({} as unknown) as SalesforcePluginMeta,
                async () => 'token'
            )
            expect(mockFetch).not.toHaveBeenCalled()
        })

        it('does send to a sink if there is a mapping for the event', async () => {
            const global = ({ logger: { debug: jest.fn() } } as unknown) as SalesforcePluginMeta['global']
            const config = {
                salesforceHost: 'https://example.io',
                eventMethodType: 'POST',
                eventPath: '',
                username: '',
                password: '',
                consumerKey: '',
                consumerSecret: '',
                eventsToInclude: '',
                debugLogging: 'false',
                eventEndpointMapping: '',
            }
            await sendEventToSink(
                ({ event: '$pageview', properties: { my: 'properties' } } as unknown) as PluginEvent,
                validMapping,
                ({
                    global: global,
                    config: config,
                    cache: undefined,
                } as unknown) as SalesforcePluginMeta,
                async () => 'the bearer token'
            )
            expect(mockFetch).toHaveBeenCalledWith('https://example.io/something', {
                body: '{"my":"properties"}',
                headers: { Authorization: 'Bearer the bearer token', 'Content-Type': 'application/json' },
                method: 'POST',
            })
        })
    })
})
