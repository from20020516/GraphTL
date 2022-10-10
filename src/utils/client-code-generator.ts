import * as fs from 'fs'
import { V2Client } from './twitter'
import { CodeGenerator } from '@himenon/openapi-typescript-code-generator'
import * as Templates from "@himenon/openapi-typescript-code-generator/templates"
import type * as Types from "@himenon/openapi-typescript-code-generator/types"

/**
 * Generate API client File for specified OpenAPI schema.
 * @param entryPoint path of schema `*.json | *.yaml` file.
 */
(async () => {
    const data = await V2Client.getOpenApiSpec()
    fs.writeFileSync('./openapi.json', JSON.stringify(data, null, 2))

    const codeGenerator = new CodeGenerator('./openapi.json')
    const apiClientGeneratorTemplate: Types.CodeGenerator.CustomGenerator<Templates.ApiClient.Option> = {
        generator: Templates.ApiClient.generator,
        option: {},
    }
    const code = codeGenerator.generateTypeDefinition([
        codeGenerator.getAdditionalTypeDefinitionCustomCodeGenerator(),
        apiClientGeneratorTemplate,
    ])
    fs.writeFileSync('./src/utils/client-generated.ts', code, { encoding: 'utf-8' })
})()
