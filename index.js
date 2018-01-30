'use strict'

class Mapper {
  constructor(config = {
    origin: 'mapper',
    validate: false,
    functionResolver: () => { throw new Error('not implemented') },
    lookupResolver: () => { throw new Error('not implemented') }
  }) {
    this.origin = config.origin
    this.validate = config.validate
    this.functionResolver = config.functionResolver
    this.lookupResolver = config.lookupResolver
    this.definition = null
    this.inputSchema = null
    this.outputSchema = null
    this.mapping = null
  }

  static lookupBuilder(key, lookup) {
    return function(val) {
      let resp = lookup[val]
      if (resp == null) {
        throw new Error('unknown lookup "' + val + '" for target "' + key + '"')
      }
      return resp
    }
  }

  static trimInput(x) {
    return (typeof x === 'string') ? x.trim() : x
  }

  _compileStrategy(key, strategy, inputSchema, outputSchema) {
    let strategyName = null

    let targetField = outputSchema.properties[key]
    if (!targetField) throw new Error('unable to resolve target field "' + key + '"')

    if (strategy.$nested) {
      if (strategy.lookup || strategy.source || strategy.function) {
        throw new Error('$nested cannot be combined with any other strategy')
      }

      // early returns for recursive strategies
      switch (targetField.type) {
        case 'array': {
          const nestedStrategies = Array.isArray(strategy.$nested) ?
                                   strategy.$nested : [strategy.$nested]
          return {
            strategy: 'nestedArray',
            targetName: key,
            targetField: targetField,
            $nested: nestedStrategies.map(n => {
              return this._compileDefinition(n, inputSchema, targetField.items)
            })
          }
        }

        case 'object':
          if (Array.isArray(strategy.$nested)) {
            throw new Error('$nested array for target of type object')
          }
          return {
            strategy: 'nestedObject',
            targetName: key,
            targetField: targetField,
            $nested: this._compileDefinition(strategy.$nested, inputSchema, targetField)
          }

        default:
          throw new Error('unexpected $nested targetField type "' + targetField.type + '" for "' + key + '"')
      }
    }

    let sourceField
    if (strategy.source) {
      sourceField = inputSchema.properties[strategy.source]
      if (!sourceField) {
        throw new Error('unable to resolve source field "' + strategy.source + '"')
      }
      strategyName = 'copy'
    }

    let fn

    if (strategy.lookup) {
      if (!strategy.source) {
        throw new Error('bad lookup for "' + key + '"; missing source')
      }
      if (strategy.function) {
        throw new Error('lookup strategy cannot be combined with function')
      }
      strategyName = 'lookup'
      fn = typeof strategy.lookup === 'string' ?
           this.lookupResolver(strategy.lookup) :
           this.constructor.lookupBuilder(key, strategy.lookup)
    }

    if (strategy.function) {
      strategyName = sourceField ? 'functionVal' : 'functionFull'
      // TODO: implement function pipelining
      fn = this.functionResolver(strategy.function)
    }

    if (strategyName == null) {
      throw new Error('unknown strategy for "' + key + '"')
    }

    return {
      strategy: strategyName,
      targetName: key,
      targetField: targetField,
      sourceName: strategy.source,
      sourceField: sourceField,
      function: fn
    }
  }

  _compileDefinition(definition, inputSchema, outputSchema) {
    return {
      $constant: definition.$constant || {},
      strategies: Object.keys(definition)
        .filter(key => key !== '$constant')
        .map(key => {
          if (definition.$constant && definition.$constant[key]) {
            throw new Error('duplicate field "' + key + '" defined in strategy and $constant')
          }
          return this._compileStrategy(key, definition[key], inputSchema, outputSchema)
        })
    }
  }

  _applyStrategy(data, strategy) {
    switch (strategy.strategy) {
      case 'copy': {
        const val = data[strategy.sourceName]
        return this.constructor.trimInput(val)
      }
      case 'lookup': // fallthru
      case 'functionVal': {
        const val = data[strategy.sourceName]
        return strategy.function(this.constructor.trimInput(val))
      }
      case 'functionFull':
        return strategy.function(data)
      case 'nestedObject': {
        const output = this._applyMapping(data, strategy.$nested)
        if (!Object.keys(output).length) return null
        return output
      }
      case 'nestedArray':
        return strategy.$nested
          .map(n => this._applyMapping(data, n))
          .filter(o => Object.keys(o).length)
          .map(n => Object.assign(n, { dataOrigin: this.origin }))
      default:
          throw new Error('unknown strategy "' + strategy.strategy + '"')
    }
  }

  _applyMapping(data, compiledMapping) {
    const output = compiledMapping.strategies.reduce((output, strategy) => {
      const result = this._applyStrategy(data, strategy)
      // TODO: configurable?
      if (result != '' && result != null) {
        output[strategy.targetName] = result
      }
      return output
    }, {})

    return Object.keys(output).length ?
           Object.assign(output, compiledMapping.$constant) :
           output
  }

  compile(definition, inputSchema, outputSchema) {
    // TODO: schema validation
    if (typeof definition !== 'object') throw new Error('invalid definition')
    if (typeof inputSchema !== 'object') throw new Error('invalid inputSchema')
    if (typeof outputSchema !== 'object') throw new Error('invalid outputSchema')

    this.definition = definition
    this.inputSchema = inputSchema
    this.outputSchema = outputSchema
    this.mapping = this._compileDefinition(this.definition, this.inputSchema, this.outputSchema)
  }

  applyTo(data) {
    if (!this.mapping) throw new Error('compile() required')

    // TODO:
    // validate(data, inputSchema)

    const output = this._applyMapping(data, this.mapping)

    // TODO:
    // validate(output, outputSchema)

    return output
  }
}

module.exports = exports = Mapper
