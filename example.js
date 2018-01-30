'use strict'

const Mapper = require('.')

const input = {
  index: 0,
  name: ' Foo ',
  value: 3,
  comment: 'this is an object'
}

const inputSchema = {
  title: 'input JSON schema',
  properties: {
    index: { type: 'number' },
    name: { type: 'string' },
    value: { type: 'number' },
    comment: { type: 'string' }
  }
}

const outputSchema = {
  title: 'output JSON schema',
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

const mapper = new Mapper({
  origin: 'example',
  functionResolver: f => functions[f]
})

mapper.compile(definition, inputSchema, outputSchema)

const output = mapper.applyTo(input)

console.log('*** Input Data ****')
console.log(JSON.stringify(input, null, 2))
console.log()
console.log('*** Output Data ****')
console.log(JSON.stringify(output, null, 2))
