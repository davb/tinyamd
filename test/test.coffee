chai = require 'chai'
expect = chai.expect
chai.should()


TINYAMD_PATH = '../src/tinyamd.coffee'
m = require(TINYAMD_PATH)


# error messages
ERR_INVALID_ARG = /invalid arguments/
ERR_MISSING = /missing module/
ERR_CIRCULAR_DEP = /circular dependency/


it "can be require'd in Node.js", ->
  expect(m).to.be.a('object')

it "exposes two functions `require` and `define`", ->
  expect(m.require).to.be.a('function')
  expect(m.define).to.be.a('function')


describe ".define", ->
  m = require(TINYAMD_PATH)
  
  it "does not accept zero arguments", ->
    expect(m.define.bind(m)).to.throw ERR_INVALID_ARG

  it "does not accept a single argument", ->
    expect(m.define.bind(m, "test")).to.throw ERR_INVALID_ARG

  it "accepts two arguments", ->
    expect(m.define.bind(m, "test", [])).to.not.throw ERR_INVALID_ARG

  it "accepts three arguments", ->
    expect(m.define.bind(m, "test", [], ->)).to.not.throw ERR_INVALID_ARG

  it "does not accept four arguments", ->
    expect(m.define.bind(m, "test", [], (->), "extra")).to.throw ERR_INVALID_ARG
    

describe ".require", ->
  m = require(TINYAMD_PATH)

  it "does not accept zero arguments", ->
    expect(m.require.bind(m)).to.throw ERR_INVALID_ARG

  it "accepts a single argument", ->
    expect(m.require.bind(m, "test")).to.not.throw ERR_INVALID_ARG

  it "does not accept two arguments", ->
    expect(m.require.bind(m, "test", "test2")).to.throw ERR_INVALID_ARG


describe "with a single module with no dependencies", ->
  m = require(TINYAMD_PATH)

  it "it returns the module when defined", ->
    m.define("test", -> 12)
    expect(m.require("test")).to.equal 12

  it "throws an error when the module is not defined", ->
    expect(m.require.bind(m, "undefined")).to.throw ERR_MISSING


describe "with a single module with one dependency", ->
  m = require(TINYAMD_PATH)

  it "returns the module when defined and dependency too", ->
    m.define("test2", ["dep2"], (dep) -> dep + 12)
    m.define("dep2", (-> 13))
    expect(m.require("test2")).to.equal 25

  it "throws an error when the dependency is missing", ->
    m.define("test3", ["dep3"], (dep) -> dep + 12)
    expect(m.require.bind(m, "test3")).to.throw ERR_MISSING

  it "throws an error when the module depends on itself", ->
    m.define("test4", ["test4"], (dep) -> dep + 12)
    expect(m.require.bind(m, "test4")).to.throw ERR_CIRCULAR_DEP


describe "with deeper dependencies", ->
  m = require(TINYAMD_PATH)

  it "returns the module when everything is good", ->
    m.define("test5", ["dep51", "dep52"], (a, b) -> a + b)
    m.define("dep51", (-> 51))
    m.define("dep52", ["dep51"], ((a) -> a + 52))
    expect(m.require("test5")).to.equal 51 + (51 + 52)


  it "detects circular dependencies", ->
    m.define("test6", ["dep61"], (a, b) -> a + b)
    m.define("dep61", ["dep62"], ((a) -> 61))
    m.define("dep62", ["dep63"], ((a) -> 62))
    m.define("dep63", ["dep61"], ((a) -> 63))
    expect(m.require.bind(m, "test6")).to.throw ERR_CIRCULAR_DEP


describe "with relative paths", ->
  m = require(TINYAMD_PATH)

  it "correctly resolves ./", ->
    m.define("test7/l21", ["./l22"], (a) -> a + 10)
    m.define("test7/l22", [], (-> 10))
    expect(m.require.bind(m, "test7/l21")).to.not.throw Error
    expect(m.require("test7/l21")).to.equal 20

  it "correctly resolves ../", ->
    m.define("test8/l11/l21", ["../l22"], (a) -> a + 10)
    m.define("test8/l22", [], (-> 10))
    expect(m.require.bind(m, "test8/l11/l21")).to.not.throw Error
    expect(m.require("test8/l11/l21")).to.equal 20


describe "when requiring the local 'require' module", ->
  m = require(TINYAMD_PATH)

  it "returns a local 'require' function", ->
    m.define("test9", ["require"], (req) -> req('test91') + 10)
    m.define("test91", [], (-> 10))
    expect(m.require.bind(m, "test9")).to.not.throw Error
    expect(m.require("test9")).to.equal 20

  it "the local 'require' function is relative to the requiring module", ->
    m.define("test10/l11/l21", ["require"], (req) -> req('../l12') + 10)
    m.define("test10/l12", [], (-> 10))
    expect(m.require.bind(m, "test10/l11/l21")).to.not.throw Error
    expect(m.require("test10/l11/l21")).to.equal 20



