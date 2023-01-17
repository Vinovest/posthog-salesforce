import { Properties } from '@posthog/plugin-scaffold'

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
