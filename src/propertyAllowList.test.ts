import { filterProperties } from './propertyAllowList'

describe('filtering by property allow list', () => {
    it('does not filter if there is no allow list', () => {
        const properties = { a: 'a', b: 'b' }
        const filteredProperties = filterProperties(properties, [])
        expect(filteredProperties).toEqual(properties)
    })

    it('does filter if there is an allow list', () => {
        const properties = { a: 'a', b: 'b', c: 'c' }
        const filteredProperties = filterProperties(properties, ['a', 'c'])
        expect(filteredProperties).toEqual({ a: 'a', c: 'c' })
    })
})
