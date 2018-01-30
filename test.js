'use strict'

const expect = require('chai').expect
const Mapper = require('.')

describe('Mapper', () => {
  it('should construct', () => {
    const m = new Mapper()
    expect(m).to.be.an.instanceof(Mapper)
    expect(m.origin).to.equal('mapper')
    expect(m.validate).to.be.false
    expect(m.functionResolver).to.throw(/not implemented/)
    expect(m.lookupResolver).to.throw(/not implemented/)
  })

  it('should build lookup function', () => {
    const l = Mapper.lookupBuilder('foo', { bar: 'baz' })
    expect(l).to.be.an.instanceof(Function)
    expect(l('bar')).to.equal('baz')
    expect(() => { l('baz') }).to.throw(/unknown lookup "baz" for target "foo"/)
  })

  describe('compiler', () => {
    it('should require target in outputSchema', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { source: 'someProperty' }
      const outputSchema = {
        properties: { randomName: { type: 'string' } }
      }

      expect(() => {
        m._compileStrategy(name, definition, {}, outputSchema)
      }).to.throw(/unable to resolve target field/)
    })

    it('should require source in inputSchema', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { source: 'someProperty' }
      const inputSchema = {
        properties: { randomName: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      expect(() => {
        m._compileStrategy(name, definition, inputSchema, outputSchema)
      }).to.throw(/unable to resolve source field/)
    })

    it('should error on unrecognized strategy', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { foobar: 'someProperty' }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      expect(() => {
        m._compileStrategy(name, definition, {}, outputSchema)
      }).to.throw(/unknown strategy for "output"/)
    })

    it('should compile "copy" strategy', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { source: 'someProperty' }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      const out = m._compileStrategy(name, definition, inputSchema, outputSchema)
      expect(out.strategy).to.equal('copy')
      expect(out.targetName).to.equal(name)
      expect(out.function).to.be.undefined
    })

    it('should require source for "lookup" strategy', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { lookup: {} }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      expect(() => {
        m._compileStrategy(name, definition, {}, outputSchema)
      }).to.throw(/bad lookup for "output"; missing source/)
    })

    it('should disallow function for "lookup" strategy', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { source: 'someProperty', lookup: {}, function: 'foo' }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      expect(() => {
        m._compileStrategy(name, definition, inputSchema, outputSchema)
      }).to.throw(/lookup strategy cannot be combined with function/)
    })

    it('should compile "lookup" strategy', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { source: 'someProperty', lookup: {} }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      const out = m._compileStrategy(name, definition, inputSchema, outputSchema)
      expect(out.strategy).to.equal('lookup')
      expect(out.targetName).to.equal(name)
      expect(out.function).to.be.instanceof(Function)
    })

    it('should resolve named "lookup" strategy', () => {
      const m = new Mapper({
        lookupResolver: _ => _
      })
      const name = 'output'
      const definition = { source: 'someProperty', lookup: 'foo' }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      const out = m._compileStrategy(name, definition, inputSchema, outputSchema)
      expect(out.strategy).to.equal('lookup')
      expect(out.targetName).to.equal(name)
      expect(out.function).to.equal(definition.lookup)
    })

    it('should compile "functionVal" strategy', () => {
      const m = new Mapper({
        functionResolver: _ => _
      })
      const name = 'output'
      const definition = { source: 'someProperty', function: 'foo' }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      const out = m._compileStrategy(name, definition, inputSchema, outputSchema)
      expect(out.strategy).to.equal('functionVal')
      expect(out.targetName).to.equal(name)
      expect(out.function).to.equal(definition.function)
    })

    it('should compile "functionFull" strategy', () => {
      const m = new Mapper({
        functionResolver: _ => _
      })
      const name = 'output'
      const definition = { function: 'foo' }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      const out = m._compileStrategy(name, definition, {}, outputSchema)
      expect(out.strategy).to.equal('functionFull')
      expect(out.targetName).to.equal(name)
      expect(out.function).to.equal(definition.function)
    })

    it('should disallow peer strategies of $nested', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $nested: {}, source: 'someProperty' }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      expect(() => {
        m._compileStrategy(name, definition, {}, outputSchema)
      }).to.throw(/\$nested cannot be combined with any other strategy/)
    })

    it('should require target of type array|object for $nested', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $nested: {} }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      expect(() => {
        m._compileStrategy(name, definition, {}, outputSchema)
      }).to.throw(/unexpected \$nested targetField type "string" for "output"/)
    })

    it('should require $nested object for "nestedObject" strategy', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $nested: [] }
      const outputSchema = {
        properties: { [name]: { type: 'object', properties: { myProperty: { type: 'string' } } } }
      }

      expect(() => {
        m._compileStrategy(name, definition, {}, outputSchema)
      }).to.throw(/\$nested array for target of type object/)
    })

    it('should compile "nestedObject" strategy', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $nested: { myProperty: { source: 'someProperty' } } }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'object', properties: { myProperty: { type: 'string' } } } }
      }

      const out = m._compileStrategy(name, definition, inputSchema, outputSchema)
      expect(out.strategy).to.equal('nestedObject')
      expect(out.targetName).to.equal(name)
      expect(out.$nested.strategies).to.be.an.instanceof(Array)
      expect(out.$nested.strategies).to.have.lengthOf(1)
      expect(out.$nested.strategies[0].strategy).to.equal('copy')
      expect(out.$nested.strategies[0].function).to.be.undefined
    })

    it('should compile "nestedArray" strategy from object', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $nested: { myProperty: { source: 'someProperty' } } }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'array', items: { properties: { myProperty: { type: 'string' } } } } }
      }

      const out = m._compileStrategy(name, definition, inputSchema, outputSchema)
      expect(out.strategy).to.equal('nestedArray')
      expect(out.targetName).to.equal(name)
      expect(out.$nested).to.be.an.instanceof(Array)
      expect(out.$nested).to.have.lengthOf(1)
      expect(out.$nested[0].strategies).to.be.an.instanceof(Array)
      expect(out.$nested[0].strategies).to.have.lengthOf(1)
      expect(out.$nested[0].strategies[0].strategy).to.equal('copy')
      expect(out.$nested[0].strategies[0].function).to.be.undefined
    })

    it('should compile "nestedArray" strategy from array', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $nested: [{ myProperty: { source: 'someProperty' } }] }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'array', items: { properties: { myProperty: { type: 'string' } } } } }
      }

      const out = m._compileStrategy(name, definition, inputSchema, outputSchema)
      expect(out.strategy).to.equal('nestedArray')
      expect(out.targetName).to.equal(name)
      expect(out.$nested).to.be.an.instanceof(Array)
      expect(out.$nested).to.have.lengthOf(1)
      expect(out.$nested[0].strategies).to.be.an.instanceof(Array)
      expect(out.$nested[0].strategies).to.have.lengthOf(1)
      expect(out.$nested[0].strategies[0].strategy).to.equal('copy')
      expect(out.$nested[0].strategies[0].function).to.be.undefined
    })

    it('should capture $constant in definition', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $constant: { foo: 'bar' }, [name]: { source: 'someProperty' } }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      const out = m._compileDefinition(definition, inputSchema, outputSchema)
      expect(out.$constant).to.be.an.instanceof(Object)
      expect(out.$constant.foo).to.equal('bar')
      expect(out.strategies).to.be.an.instanceof(Array)
      expect(out.strategies).to.have.lengthOf(1)
      expect(out.strategies[0].strategy).to.equal('copy')
      expect(out.strategies[0].function).to.be.undefined
    })

    it('should error on duplicate property in $constant', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $constant: { [name]: 'bar' }, [name]: { source: 'someProperty' } }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      expect(() => {
        m._compileDefinition(definition, inputSchema, outputSchema)
      }).to.throw(/duplicate field "output" defined in strategy and \$constant/)
    })

    it('should error in compile on invalid arguments', () => {
      const m = new Mapper()
      expect(() => m.compile()).to.throw(/invalid definition/)
      expect(() => m.compile('foo')).to.throw(/invalid definition/)
      expect(() => m.compile({})).to.throw(/invalid inputSchema/)
      expect(() => m.compile({}, 'foo')).to.throw(/invalid inputSchema/)
      expect(() => m.compile({}, {})).to.throw(/invalid outputSchema/)
      expect(() => m.compile({}, {}, 'foo')).to.throw(/invalid outputSchema/)
    })

    it('should compile definition', () => {
      const m = new Mapper()
      const name = 'output'
      const definition = { $constant: { foo: 'bar' }, [name]: { source: 'someProperty' } }
      const inputSchema = {
        properties: { someProperty: { type: 'string' } }
      }
      const outputSchema = {
        properties: { [name]: { type: 'string' } }
      }

      m.compile(definition, inputSchema, outputSchema)
      expect(m.definition).to.equal(definition)
      expect(m.inputSchema).to.equal(inputSchema)
      expect(m.outputSchema).to.equal(outputSchema)
      expect(m.mapping.$constant).to.be.an.instanceof(Object)
      expect(m.mapping.$constant.foo).to.equal('bar')
      expect(m.mapping.strategies).to.be.an.instanceof(Array)
      expect(m.mapping.strategies).to.have.lengthOf(1)
      expect(m.mapping.strategies[0].strategy).to.equal('copy')
      expect(m.mapping.strategies[0].function).to.be.undefined
    })
  })

  describe('applicator', () => {
    it('should apply "copy" strategy', () => {
      const m = new Mapper()
      const strategy = {
        strategy: 'copy',
        targetName: 'output',
        targetField: { type: 'string' },
        sourceName: 'someProperty',
        sourceField: { type: 'string' }
      }
      const input = { someProperty: 'foo' }
      const out = m._applyStrategy(input, strategy)
      expect(out).to.equal('foo')
    })

    it('should trim value in "copy" strategy', () => {
      const m = new Mapper()
      const strategy = {
        strategy: 'copy',
        targetName: 'output',
        targetField: { type: 'string' },
        sourceName: 'someProperty',
        sourceField: { type: 'string' }
      }
      const input = { someProperty: ' foo' }
      const out = m._applyStrategy(input, strategy)
      expect(out).to.equal('foo')
    })

    it('should apply "lookup", "functionVal", and "functionFull" strategy', () => {
      const m = new Mapper()
      let arg
      const strategy = {
        strategy: 'lookup',
        targetName: 'output',
        targetField: { type: 'string' },
        sourceName: 'someProperty',
        sourceField: { type: 'string' },
        function: _ => {
          arg = _
          return 1
        }
      }
      const input = { someProperty: 'foo' }
      let out

      out = m._applyStrategy(input, strategy)
      expect(arg).to.equal('foo')
      expect(out).to.equal(1)

      arg = undefined
      strategy.strategy = 'functionVal'
      out = m._applyStrategy(input, strategy)
      expect(arg).to.equal('foo')
      expect(out).to.equal(1)

      arg = undefined
      strategy.strategy = 'functionFull'
      out = m._applyStrategy(input, strategy)
      expect(arg).to.equal(input)
      expect(out).to.equal(1)
    })

    it('should apply "nestedObject" strategy', () => {
      const m = new Mapper()
      const strategy = {
        strategy: 'nestedObject',
        targetName: 'container',
        targetField: { type: 'object' },
        $nested: {
          $constant: {},
          strategies: [{
            strategy: 'copy',
            targetName: 'output',
            targetField: { type: 'string' },
            sourceName: 'someProperty',
            sourceField: { type: 'string' }
          }]
        }
      }
      const input = { someProperty: 'foo' }
      const out = m._applyStrategy(input, strategy)
      expect(out).to.be.an.instanceof(Object)
      expect(out).to.have.property('output', 'foo')
    })

    it('should suppress empty output object in "nestedObject" strategy', () => {
      const m = new Mapper()
      const strategy = {
        strategy: 'nestedObject',
        targetName: 'container',
        targetField: { type: 'object' },
        $nested: {
          $constant: {},
          strategies: []
        }
      }
      const input = { someProperty: 'foo' }
      const out = m._applyStrategy(input, strategy)
      expect(out).to.be.null
    })

    it('should apply "nestedArray" strategy', () => {
      const m = new Mapper()
      const strategy = {
        strategy: 'nestedArray',
        targetName: 'container',
        targetField: { type: 'object' },
        $nested: [{
          $constant: {},
          strategies: [{
            strategy: 'copy',
            targetName: 'output',
            targetField: { type: 'string' },
            sourceName: 'someProperty',
            sourceField: { type: 'string' }
          }]
        }]
      }
      const input = { someProperty: 'foo' }
      const out = m._applyStrategy(input, strategy)
      expect(out).to.be.an.instanceof(Array)
      expect(out).to.have.lengthOf(1)
      expect(out[0]).to.have.property('output', 'foo')
      expect(out[0]).to.have.property('dataOrigin', m.origin)
    })

    it('should error on unknown strategy', () => {
      const m = new Mapper()
      const strategy = {
        strategy: 'foobar',
        targetName: 'output',
        targetField: { type: 'string' },
        sourceName: 'someProperty',
        sourceField: { type: 'string' }
      }

      const input = { someProperty: 'foo' }
      expect(() => {
        m._applyStrategy(input, strategy)
      }).to.throw(/unknown strategy "foobar"/)
    })

    it('should apply empty mapping', () => {
      const m = new Mapper()
      const mapping = {
        $constant: {},
        strategies: []
      }
      const input = { someProperty: 'foo' }
      const out = m._applyMapping(input, mapping)
      expect(out).to.deep.equal({})
    })

    it('should apply mapping', () => {
      const m = new Mapper()
      const mapping = {
        $constant: {},
        strategies: [{
          strategy: 'copy',
          targetName: 'output',
          targetField: { type: 'string' },
          sourceName: 'someProperty',
          sourceField: { type: 'string' }
        }]
      }
      const input = { someProperty: 'foo' }
      const out = m._applyMapping(input, mapping)
      expect(out).to.have.property('output', 'foo')
    })

    it('should suppress null when applying mapping', () => {
      const m = new Mapper()
      const mapping = {
        $constant: {},
        strategies: [{
          strategy: 'copy',
          targetName: 'output',
          targetField: { type: 'string' },
          sourceName: 'someProperty',
          sourceField: { type: 'string' }
        }]
      }
      const input = { someProperty: null }
      const out = m._applyMapping(input, mapping)
      expect(out).not.to.have.property('output')
    })

    it('should apply mapping with $constant', () => {
      const m = new Mapper()
      const mapping = {
        $constant: { bar: 'baz' },
        strategies: [{
          strategy: 'copy',
          targetName: 'output',
          targetField: { type: 'string' },
          sourceName: 'someProperty',
          sourceField: { type: 'string' }
        }]
      }
      const input = { someProperty: 'foo' }
      const out = m._applyMapping(input, mapping)
      expect(out).to.have.property('output', 'foo')
      expect(out).to.have.property('bar', 'baz')
    })
  })

  describe('example', () => {
    const input = {
      index: 0,
      name: ' Foo ',
      value: 3,
      comment: 'this is an object'
    }

    const inputSchema = {
      properties: {
        index: { type: 'number' },
        name: { type: 'string' },
        value: { type: 'number' },
        comment: { type: 'string' }
      }
    }

    const outputSchema = {
      properties: {
        name: { type: 'string' },
        idx: { type: 'number' },
        contents: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            values: {
              type: 'array',
              items: {
                properties: {
                  category: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }

    const definition = {
      name: { source: 'name' },
      idx: {
        source: 'index',
        function: 'increment'
      },
      contents: {
        $nested: {
          description: { source: 'comment' },
          values: {
            $nested: [{
              $constant: { category: 'original' },
              value: { source: 'value' }
            }, {
              $constant: { category: 'concatenated' },
              value: { function: 'concat' }
            }]
          }
        }
      }
    }

    const functions = {
      increment: _ => 1 + _,
      concat: _ => Object.keys(_).map(k => k + ':' + _[k]).join('|')
    }

    it('should require compile() in applyTo()', () => {
      const m = new Mapper()
      expect(() => { m.applyTo(null) }).to.throw(/compile\(\) required/)
    })

    it('should evaluate example', () => {
      const m = new Mapper({
        origin: 'example',
        functionResolver: f => functions[f]
      })

      m.compile(definition, inputSchema, outputSchema)

      const out = m.applyTo(input)
      expect(out).to.be.an.instanceof(Object)
      expect(out).to.have.property('name', 'Foo')
      expect(out).to.have.property('idx', 1)
      expect(out).to.have.property('contents')
      expect(out.contents).to.be.an.instanceof(Object)
      expect(out.contents).to.have.property('description', 'this is an object')
      expect(out.contents).to.have.property('values')
      expect(out.contents.values).to.be.an.instanceof(Array)
      expect(out.contents.values).to.have.lengthOf(2)
      expect(out.contents.values[0]).to.have.property('category', 'original')
      expect(out.contents.values[0]).to.have.property('value', 3)
      expect(out.contents.values[1]).to.have.property('category', 'concatenated')
      expect(out.contents.values[1].value).to.match(/index:0\|name: Foo \|value:3/)
    })
  })
})
