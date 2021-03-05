import * as fs from 'fs'
import * as CodeGenerator from '@himenon/openapi-typescript-code-generator'

/**
 * Generate API client File for specified OpenAPI schema.
 * @param entryPoint path of schema `*.json | *.yaml` file.
 */
const clientCodeGenerator = (entryPoint = 'openapi.json') =>
    fs.writeFileSync('./src/utils/client-generated.ts', CodeGenerator.generateTypeScriptCode({ entryPoint }), { encoding: 'utf-8' })

export default clientCodeGenerator
clientCodeGenerator()
