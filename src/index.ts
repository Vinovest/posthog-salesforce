import { PluginMeta, PluginEvent } from '@posthog/plugin-scaffold'
import fetch from 'node-fetch'

const CACHE_TOKEN = 'salesforce-token'
const CACHE_TTL = 60 * 60 * 5 // in seconds
interface SalesforcePluginMeta extends PluginMeta {
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

async function sendEventsToSalesforce(events: PluginEvent[], meta: SalesforcePluginMeta) {
   
    const { config } = meta

    const types = (config.eventsToInclude || '').split(',')
   
    const sendEvents = events.filter((e) => types.includes(e.event))
    console.log(sendEvents)
    if (sendEvents.length == 0) {
        return
    }
    console.log("going to get the token")
    const token = await getToken(meta)
    console.log("has a token ", token)
    for (const e of sendEvents) {
        if (!e.properties) {
            continue
        }   
        console.log("sending the event")
        await fetch(`${config.salesforceHost}/${config.eventPath}`,
        {   
            method: config.eventMethodType,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(e.properties),
        })
    }
}

async function getToken(meta: SalesforcePluginMeta): Promise<string> {
    const { cache } = meta
    console.log("grabbing the token")
    const token = await cache.get(CACHE_TOKEN, null)
    console.log(token)
    if (token == null) {
        await generateAndSetToken(meta)
        return await getToken(meta)
    }
    return token as string
}

async function canPingSalesforce({ cache, config }: SalesforcePluginMeta): Promise<boolean> {
    const token = await cache.get(CACHE_TOKEN, null)
    if (token == null) {
        return false
    }
    // will see if we have access to the api

    const response = await fetch(`${config.salesforceHost}/services/data`,{
        method: 'get',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })

    if (response.status < 200 || response.status > 299) {
        throw new Error(`Unable to ping salesforce. Status code ${response.status}`)
    }
    return true
}

async function generateAndSetToken({ config, cache }: SalesforcePluginMeta): Promise<string> {
    const response = await fetch(`${config.salesforceHost}/services/oauth2/token`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'password',
            client_id: config.consumerKey,
            client_secret: config.consumerSecret,
            username: config.username,
            password: config.password,
        }),
    })
    if(response.status < 200 || response.status > 299) {
        throw new Error(`Got bad response getting the token ${response.status}`)
    }

    const body = await response.json()
    console.log("generated the token", body)
    cache.set(CACHE_TOKEN, body.access_token, CACHE_TTL)
    return body.access_token
}

export async function setupPlugin(meta: SalesforcePluginMeta) {
    verifyConfig(meta)
    if (canPingSalesforce(meta)) {
        console.log("has the token")
        return
    }
    console.log("generatign the token")
    await generateAndSetToken(meta)
}

export async function processEventBatch(events: PluginEvent[], meta: SalesforcePluginMeta) {
    await sendEventsToSalesforce(events, meta)

    return events
}
