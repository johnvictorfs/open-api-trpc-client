import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { generateTypes } from './generator'
import fs from 'fs'

yargs(hideBin(process.argv))
  .command('types', 'generate type definitions for API client', (yargs) => {
    return yargs
      .option('schema', {
        describe: 'Location of the OpenAPI schema (URL or local path)',
        type: 'string',
        demandOption: true
      })
      .option('destination', {
        describe: 'Destination of the generated file for type definitions',
        type: 'string',
        demandOption: true
      })
      .option('period', {
        describe: 'How often to update the type definitions (in seconds), only used for URL schemas',
        type: 'number',
        default: 30
      })
  }, (argv) => {
    const updateTypeDefs = () => {
      const text = `[${new Date().toISOString()}] Generated types`
        console.time(text)

        generateTypes({
          destination: argv.destination,
          path: argv.schema,
        })

        console.timeEnd(text)
    }

    if (argv.schema.startsWith('http')) {
      // update periodically
      setInterval(updateTypeDefs, argv.period * 1000)
    } else {
      // Update when schema file changes
      updateTypeDefs()
      fs.watch(argv.schema, updateTypeDefs)
    }
  })
  .parse()
