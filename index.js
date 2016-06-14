#! /usr/bin/env node

var program = require('commander')
  , version = require('./package').version
  , request = require('coap').request
  , URL     = require('url')
  , through = require('through2')
  , method  = 'GET' // default
  , url
  , util = require('util')
  , cbor = require('cbor')

program
  .version(version)
  .option('-o, --observe', 'Observe the given resource', 'boolean', false)
  .option('-n, --no-new-line', 'No new line at the end of the stream', 'boolean', true)
  .option('-p, --payload <payload>', 'The payload for POST and PUT requests')
  .option('-q, --quiet', 'Do not print status codes of received packets', 'boolean', false)
  .option('-c, --non-confirmable', 'non-confirmable', 'boolean', false)
  .option('-x, --cbor', 'Encode/decode the payload with CBOR', 'boolean', false)
  .usage('[command] [options] url')


;['GET', 'PUT', 'POST', 'DELETE'].forEach(function(name) {
  program
    .command(name.toLowerCase())
    .description('performs a ' + name + ' request')
    .action(function() { method = name })
})

program.parse(process.argv)

if (!program.args[0]) {
  program.outputHelp()
  process.exit(-1)
}

url = URL.parse(program.args[0])
url.method = method
url.observe = program.observe
url.confirmable = !program.nonConfirmable

if (url.protocol !== 'coap:' || !url.hostname) {
  console.log('Wrong URL. Protocol is not coap or no hostname found.')
  process.exit(-1)
}

req = request(url).on('response', function(res) {
  // print only status code on empty response
  console.log("-----")
  console.log(util.inspect(res, { depth: null}));
  console.log("-----")
  if (!res.payload.length && !program.quiet) {
    process.stderr.write('\x1b[1m(' + res.code + ":" + res.payload + "::" + util.inspect(res.options,{ depth: null }) + ')\x1b[0m\n')
  }
    
    if (program.cbor){
      process.stderr.write('\x1b[1m(' + res.code + ':' + util.inspect(res.options,{ depth: null }) + ')\x1b[0m\n')
      var d = new cbor.Decoder();
      
      d.on('data', function(obj){
        console.log(util.inspect(obj,{ depth: null }));
      });
      
      res.pipe(d);
   } else
   {
      res.pipe(through(function addNewLine(chunk, enc, callback) {
        if (!program.quiet)
          process.stderr.write('\x1b[1m(' + res.code + ')\x1b[0m\t')
        if (program.newLine && chunk)
          chunk = chunk.toString('utf-8') + '\n'
        
        this.push(chunk)
        callback()
      })).pipe(process.stdout)
  }
  // needed because of some weird issue with
  // empty responses and streams
  if (!res.payload.length)
    process.exit(0)
})

if (method === 'GET' || method === 'DELETE' || program.payload) {
  if (program.cbor && program.payload)
    req.end(cbor.encode(program.payload))
  else 
    req.end(program.payload);
  return
  
}

if (program.cbor && process.stdin.read() === null) {
  var e = new cbor.Encoder();
  process.stdin.pipe(e).pipe(req)
} else {
  process.stdin.pipe(req)
}
