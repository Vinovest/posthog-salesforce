import { PluginEvent } from '@posthog/plugin-scaffold'
import { SalesforcePluginConfig, SalesforcePluginMeta, statusOk } from '.'
import type { RequestInfo, RequestInit, Response } from 'node-fetch'
import { filterProperties, parsePropertyAllowList } from './propertyAllowList'

// fetch only declared, as it's provided as a plugin VM global
declare function fetch(url: RequestInfo, init?: RequestInit): Promise<Response>

export interface EventSink {
    salesforcePath: string
    propertiesToInclude: string
}

export type EventToSinkMapping = Record<string, EventSink>

export const parseEventSinkConfig = (config: SalesforcePluginConfig): EventToSinkMapping | null => {
    let eventMapping: EventToSinkMapping | null = null
    if (config.eventEndpointMapping?.length > 0) {
        try {
            eventMapping = JSON.parse(config.eventEndpointMapping) as EventToSinkMapping
        } catch (e) {
            // swallow exceptions parsing the event mapping
        }
    }
    return eventMapping
}

export const validateEventSinkConfig = (
    eventMapping: EventToSinkMapping | null,
    config: SalesforcePluginConfig
): void => {
    if (eventMapping !== null) {
        Object.entries(eventMapping).map((entry) => {
            const eventSink = entry[1]
            debugger
            if (eventSink.salesforcePath == null || eventSink.salesforcePath.trim() === '') {
                throw new Error('You must provide a salesforce path for each mapping in config.eventEndpointMapping.')
            }
        })
    } else {
        // if no eventMapping is provided then we still need to receive eventsToInclude
        if (!config.eventsToInclude) {
            throw new Error('If you are not providing an eventEndpointMapping then you must provide events to include.')
        }
    }
    // don't send v1 and v2 mapping
    if (eventMapping !== null && !!config.eventsToInclude?.trim()) {
        throw new Error('You should not provide both eventsToInclude and eventMapping.')
    }
}

export const sendEventToSink = async (
    event: PluginEvent,
    eventMapping: EventToSinkMapping,
    meta: SalesforcePluginMeta,
    token: () => Promise<string>
): Promise<void> => {
    const hasMappingForThisEvent = event.event in eventMapping
    if (!hasMappingForThisEvent || !event.properties) {
        return
    }

    const { config, global } = meta
    const logger = global.logger

    const eventSinkConfig = eventMapping[event.event]
    logger.debug('v2: processing event: ', event?.event, ' with config ', eventSinkConfig)

    const propertyAllowList = parsePropertyAllowList(eventSinkConfig.propertiesToInclude)
    const response = await fetch(`${config.salesforceHost}/${eventSinkConfig.salesforcePath}`, {
        method: config.eventMethodType,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify(filterProperties(event.properties, propertyAllowList)),
    })

    const isOk = await statusOk(response, logger)
    if (!isOk) {
        throw new Error(`Not a 200 response from event hook ${response.status}. Response: ${response}`)
    }
}
