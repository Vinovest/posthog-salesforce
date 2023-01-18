import { Properties } from '@posthog/plugin-scaffold'

export function parsePropertyAllowList(propertyAllowList: string): string[] {
    if (propertyAllowList.length > 0) {
        return propertyAllowList.split(',').map((property) => property.trim())
    } else {
        return []
    }
}

export function filterProperties(properties: Properties, propertyAllowList: string[]): Properties {
    if (!!propertyAllowList && propertyAllowList.length > 0) {
        const filteredProperties: Properties = {}
        for (const property of propertyAllowList) {
            if (property in properties) {
                filteredProperties[property] = properties[property]
            }
        }
        return filteredProperties
    } else {
        return properties
    }
}
