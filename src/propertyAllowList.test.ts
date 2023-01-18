import { filterProperties, parsePropertyAllowList } from './propertyAllowList'

describe('filtering by property allow list', () => {
    describe('filtering', () => {
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

    describe('parsing config', () => {
        it('can parse a valid string', () => {
            const properties = 'a,b,c'
            const parsedProperties = parsePropertyAllowList(properties)
            expect(parsedProperties).toEqual(['a', 'b', 'c'])
        })

        it('can parse a valid string with spaces', () => {
            const properties = 'a, b, c,d,e'
            const parsedProperties = parsePropertyAllowList(properties)
            expect(parsedProperties).toEqual(['a', 'b', 'c', 'd', 'e'])
        })

        it('can parse an empty string', () => {
            const properties = ''
            const parsedProperties = parsePropertyAllowList(properties)
            expect(parsedProperties).toEqual([])
        })
    })
})
