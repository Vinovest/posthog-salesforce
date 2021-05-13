import { PluginMeta, PluginEvent, CacheExtension } from '@posthog/plugin-scaffold'
import type { RequestInfo, RequestInit, Response } from 'node-fetch'

// fetch only declared, as it's provided as a plugin VM global
declare function fetch(url: RequestInfo, init?: RequestInit): Promise<Response>


const CACHE_TOKEN = 'SF_AUTH_TOKEN'
const CACHE_TTL = 60 * 60 * 5 // in seconds
interface SalesforcePluginMeta extends PluginMeta {
    cache: CacheExtension,
    config: {
        salesforceHost: string
        eventPath: string
        eventMethodType: string
        username: string
        password: string
        consumerKey: string
        consumerSecret: string
        eventsToInclude: string
    }
}

function verifyConfig({ config }: SalesforcePluginMeta) {
    if (!config.salesforceHost) {
        throw new Error('host not provided!')
    }
    if (!config.username) {
        throw new Error('Username not provided!')
    }
    if (!config.password) {
        throw new Error('Password not provided!')
    }
    if (!config.eventsToInclude) {
        throw new Error('No events to include!')
    }
}

async function sendEventToSalesforce(event: PluginEvent, meta: SalesforcePluginMeta) {

    const { config } = meta

    const types = (config.eventsToInclude || '').split(',')

    if (!types.includes(event.event) || !event.properties) {
        return
    }

    const token = await getToken(meta)

    const response = await fetch(
        `${config.salesforceHost}/${config.eventPath}`,
        {
            method: config.eventMethodType,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(event.properties),
        }
    )
    if (!statusOk(response)) {
        throw new Error(`Not a 200 response from event hook ${response.status}`)
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

async function generateAndSetToken({ config, cache }: SalesforcePluginMeta): Promise<string> {
    const details: Record<string, string> = {
        grant_type: 'password',
        client_id: config.consumerKey,
        client_secret: config.consumerSecret,
        username: config.username,
        password: config.password,
    };

    let formBody = [];
    for (let property in details) {
        var encodedKey = encodeURIComponent(property);
        var encodedValue = encodeURIComponent(details[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }

    const response = await fetch(`${config.salesforceHost}/services/oauth2/token`, {
        method: 'post',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.join("&"),
    })

    if (!statusOk(response)) {
        throw new Error(`Got bad response getting the token ${response.status}`)
    }
    const body = await response.json()
    cache.set(CACHE_TOKEN, body.access_token, CACHE_TTL)
    return body.access_token
}

export async function setupPlugin(meta: SalesforcePluginMeta) {
    verifyConfig(meta)
    await getToken(meta)
}

export async function onEvent(event: PluginEvent, meta: SalesforcePluginMeta) {
    await sendEventToSalesforce(event, meta)
}

function statusOk(res: Response) {
    return String(res.status)[0] === '2'
}