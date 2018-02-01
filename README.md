## object-mapping

[![Build Status](https://travis-ci.org/joemfb/object-mapping.svg?branch=master)](https://travis-ci.org/joemfb/object-mapping)
[![Coverage Status](https://coveralls.io/repos/github/joemfb/object-mapping/badge.svg?branch=master)](https://coveralls.io/github/joemfb/object-mapping?branch=master)

A generic JSON schema-to-schema object mapping library.

Object transformation in one form or another is a nearly-universal
requirement. Applications containing a substantial variety of transformations
may benefit from expressing them declaratively. And applications managing many
differing object structures are likely to benefit from schema validation.
Declarative transformations in such applications are naturally expressed as a
mapping between schemas.

This library implements just such an approach, minimally and generically,
offered as demonstration of promise and proof of viability.

### usage

Given an *input* JSON object with a schema describing it, an *output* schema,
and a *definition* object mapping between them:

```
const input = {
  foo: 'bar'
}

const inputSchema = {
  properties: {
    foo: { type: 'string' }
  }
}

const outputSchema = {
  properties: {
    contents: {
      type: 'object',
      properties: {
        value: { type: 'string' },
        objectType: { type: 'string' }
      }
    }
  }
}

const definition = {
  contents: {
    $nested: {
      $constant: { objectType: 'example' },
      value: { 
        source: 'foo',
        lookup: { bar: 'baz' }
      }
    }
  }
}
```

We can trivially compile and apply a *mapper*:

```
const Mapper = require('object-mapping')
const mapper = new Mapper()
mapper.compile(definition, inputSchema, outputSchema)
mapper.applyTo(input)
```

Producing our desired output:

```
{
  contents: {
    value: { 'baz' },
    objectType: 'example' }
  }
}
```

### strategies

A mapping definition object is a template for constructing a JSON object from
a *single*, *flat* source object\*. The keys of the definition are the keys of
the output object, while the values of the definition are *strategies* for
retrieving or generating the values of the output object.

> \* _flat_ may change in the future with the introduction of JSON path
> expressions, but _single_ is unlikely to change.

There are five strategies for retrieving values:

#### source

The foundational strategy is *source*, which specifies a key to be looked up in the source object. Intuitively, this strategy simply copies values from the source to the output object, potentially under a different key.

This example definition

```
{
  "myTargetProperty": { "source": "mySourceProperty" }
}
```

will transform `{ "mySourceProperty": "foo" }` into
`{ "myTargetProperty": "foo" }`.

#### lookup

Next we have the *lookup* strategy, which embeds a lookup table in the mapping
definition itself. *Lookup* requires the presence of a *source* strategy; the
value retrieved via the source strategy is looked-up in the keys of the
embedded lookup table.

This example definition

```
{
  "myTargetProperty": {
    "source": "mySourceProperty"
    "lookup": {
      "foo": "bar"
    } 
  }
}
```

will transform `{ "mySourceProperty": "foo" }` into
`{ "myTargetProperty": "bar" }`.

Alternatively, the value of the *lookup* strategy can be a string referencing
a named lookup table, to be resolved by the `lookupResolver` passed to the
`Mapper` constructor (see [api](#api) below).

**Notes**

- Default values can be supported by using the empty string as a key in the lookup table.
- An Error is thrown if a value cannot be found in the lookup table.

#### function

Next we have the *function* strategy, which can be used in two modes. In the first, a *function* is specified in conjunction with a *source*; as one might expect, the referenced function is applied to the value retrieved via
the *source* strategy. In the second mode, *function* alone is specified. In this case, the referenced function is applied to the entire source object. This mode therefore supports compound values, complex conditionals, etc.

Functions a referenced by name and resolved by the `functionResolver` passed
to the `Mapper` constructor (see [api](#api) below).

This example definition

```
{
  "myTargetProperty": {
    "source": "mySourceProperty",
    "function": "upperCase"
  }
}
```

will transform `{ "mySourceProperty": "foo" }` into
`{ "myTargetProperty": "FOO" }` (assuming the presence of an `upperCase`
function).

And this example definition

```
{
  "myTargetProperty": {
    "function": "JSON.stringify"
  }
}
```

will transform `{ "mySourceProperty": "foo" }` into
`{ "myTargetProperty": "{\\"mySourceProperty\\":\\"foo\\"}" }` (assuming the
availability of `JSON.stringify`).

#### $nested

Like *function*, the *$nested* strategy can operate in two modes: the first results in a nested sub-object, the second results in a nested array of objects.

This example definition

```
{
  "myTargetProperty": {
    "$nested": {
      "myNestedProperty": {
        "source": "mySourceProperty"
      }
    }
  }
}
```

will transform `{ "mySourceProperty": "foo" }` into
`{ "myTargetProperty": { "myNestedProperty": foo" } }`.

And this example definition

```
{
  "myTargetProperty": {
    "$nested": [{
      "myNestedProperty": {
        "source": "mySourceProperty"
      }
    }, {
      "myNestedProperty": {
        "source": "anotherProperty"
      }
    }]
  }
}
```

will transform `{ "mySourceProperty": "foo", "anotherProperty": "bar" }` into
`{ "myTargetProperty": [{ "myNestedProperty": foo" }, { "myNestedProperty": bar" }] }`.

**Note**: for nested arrays where only one object is being mapped, *$nested*
does not have to be an array itself; the output object will automatically be
promoted to an array based on the schema type of target property.

### $constant

And finally, as a convenience, constant properties can be defined in the mapping itself.

This example definition

```
"$constant": {
  "myFirstConstant": "#1",
  "mySecondConstant": "#2"
},
"myTargetProperty": {
  "source": "mySourceProperty"
}
```

will transform `{ "mySourceProperty": "foo" }` into
`{ "myTargetProperty": "foo", "myFirstConstant": "#1", "mySecondConstant": "#2" }`

#### api

This library exports a simpler `Mapper` class. The constructor accepts a
`config` object with the following properties:

- `origin`: a string (or `undefined`) for annoting the origin of nested objects within arrays (default: `'mapper'`)
- `functionResolver`: a function from `string` to `Function` for looking up function references (default throws `Error`)
- `lookupResolver`: a function from `string` to `Function` for looking up references to named lookup-tables (default throws `Error`)

An instance of `Mapper` has the following public methods:

##### `compile(definition, inputSchema, outputSchema)`

Validates and compiles a `definition` object mapping from `inputSchema` to
`outputSchema` into an optimized internal representation, which is saved to
`this.mapping`.

##### `applyTo(data)`

Applies the compiled mapping to the supplied data, returning the output object.
