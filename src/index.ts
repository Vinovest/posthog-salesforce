import { PluginEvent, CacheExtension, RetryError } from '@posthog/plugin-scaffold'
import type { RequestInfo, RequestInit, Response } from 'node-fetch'
import { createBuffer } from '@posthog/plugin-contrib'
import { parseEventSinkConfig, sendEventToSink, validateEventSinkConfig } from './eventSinkMapping'
import { Logger, makeLogger } from './logger'

// fetch only declared, as it's provided as a plugin VM global
declare function fetch(url: RequestInfo, init?: RequestInit): Promise<Response>

const CACHE_TOKEN = 'SF_AUTH_TOKEN'
const CACHE_TTL = 60 * 60 * 5 // in seconds

export interface SalesforcePluginConfig {
    salesforceHost: string
    eventPath: string
    eventMethodType: string
    username: string
    password: string
    consumerKey: string
    consumerSecret: string
    eventsToInclude: string
    debugLogging: string
    eventEndpointMapping: string // contains json or the empty string
}

export interface SalesforcePluginMeta {
    cache: CacheExtension
    config: SalesforcePluginConfig
    global: {
        buffer: ReturnType<typeof createBuffer>
        logger: Logger
    }
}

function verifyConfig({ config }: SalesforcePluginMeta) {
    const eventMapping = parseEventSinkConfig(config)

    validateEventSinkConfig(eventMapping, config)

    if (!config.salesforceHost) {
        throw new Error('host not provided!')
    }

    if (!/https:\/\/(.+).my.salesforce.com$/.test(config.salesforceHost)) {
        throw new Error('Invalid salesforce host')
    }

    if (!config.username) {
        throw new Error('Username not provided!')
    }
    if (!config.password) {
        throw new Error('Password not provided!')
    }
}

async function sendEventToSalesforce(event: PluginEvent, meta: SalesforcePluginMeta): Promise<void> {
    try {
        const { config, global } = meta

        const eventMapping = parseEventSinkConfig(config)

        if (eventMapping !== null) {
            sendEventToSink(event, eventMapping, meta, () => getToken(meta))
        } else {
            //maintain v1 behaviour unchanged otherwise
            const types = (config.eventsToInclude || '').split(',')

            if (!types.includes(event.event) || !event.properties) {
                return
            }

            global.logger.debug('processing event: ', event?.event)

            const token = await getToken(meta)

            const response = await fetch(`${config.salesforceHost}/${config.eventPath}`, {
                method: config.eventMethodType,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(event.properties),
            })

            const isOk = await statusOk(response, global.logger)
            if (!isOk) {
                throw new Error(`Not a 200 response from event hook ${response.status}. Response: ${response}`)
            }
        }
    } catch (error) {
        meta.global.logger.error('error while sending event to salesforce. event: ', event, ' the error was ', error)
        throw error
    }
}

async function getToken(meta: SalesforcePluginMeta): Promise<string> {
    const { cache } = meta
    const token = await cache.get(CACHE_TOKEN, null)
    if (token == null) {
        await generateAndSetToken(meta)
        return await getToken(meta)
    }
    return token as string
}

async function generateAndSetToken({ config, cache, global }: SalesforcePluginMeta): Promise<string> {
    const details: Record<string, string> = {
        grant_type: 'password',
        client_id: config.consumerKey,
        client_secret: config.consumerSecret,
        username: config.username,
        password: config.password,
    }

    const formBody: string[] = []
    for (const property in details) {
        const encodedKey = encodeURIComponent(property)
        const encodedValue = encodeURIComponent(details[property])
        formBody.push(encodedKey + '=' + encodedValue)
    }

    const response = await fetch(`${config.salesforceHost}/services/oauth2/token`, {
        method: 'post',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.join('&'),
    })

    if (!statusOk(response, global.logger)) {
        throw new Error(`Got bad response getting the token ${response.status}`)
    }
    const body = await response.json()
    cache.set(CACHE_TOKEN, body.access_token, CACHE_TTL)
    return body.access_token
}

export async function setupPlugin(meta: SalesforcePluginMeta): Promise<void> {
    const { global } = meta

    const debugLoggingOn = meta.config.debugLogging === 'debug logging on'
    global.logger = makeLogger(debugLoggingOn)

    verifyConfig(meta)

    try {
        await getToken(meta)
    } catch (error) {
        global.logger.error('error in getToken', error)
        throw new RetryError('Failed to getToken. cache or salesforce is unavailable')
    }

    global.buffer = createBuffer({
        limit: 1024 * 1024, // 1 MB
        timeoutSeconds: 1,
        onFlush: async (events) => {
            for (const event of events) {
                await sendEventToSalesforce(event, meta)
            }
        },
    })
}

export async function onEvent(event: PluginEvent, { global }: SalesforcePluginMeta): Promise<void> {
    if (!global.buffer) {
        throw new Error(`there is no buffer. setup must have failed, cannot process event: ${event.event}`)
    }
    const eventSize = JSON.stringify(event).length
    global.buffer.add(event, eventSize)
}

export function teardownPlugin({ global }: SalesforcePluginMeta): void {
    global.buffer.flush()
}

export async function statusOk(res: Response, logger: Logger): Promise<boolean> {
    logger.debug('testing response for whether it is "ok". has status: ', res.status, ' debug: ', JSON.stringify(res))
    return String(res.status)[0] === '2'
}
