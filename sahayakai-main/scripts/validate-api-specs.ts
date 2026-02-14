#!/usr/bin/env ts-node

/**
 * Validate OpenAPI Specifications
 * 
 * This script validates all OpenAPI spec files in the api-specs/ directory
 * and ensures they conform to OpenAPI 3.0 standards.
 * 
 * Usage:
 *   npm run api:validate
 *   npm run api:validate -- --spec api-specs/quiz-generator.yaml
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIV3 } from 'openapi-types';

const SPECS_DIR = path.join(process.cwd(), 'api-specs');

interface ValidationResult {
    file: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate a single OpenAPI spec file
 */
async function validateSpec(filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
        file: path.basename(filePath),
        valid: false,
        errors: [],
        warnings: [],
    };

    try {
        // Parse and validate the spec
        const api = await SwaggerParser.validate(filePath) as OpenAPIV3.Document;

        result.valid = true;

        // Additional custom validations
        performCustomValidations(api, result);

        console.log(`✅ ${result.file} - Valid`);

        if (result.warnings.length > 0) {
            console.log(`⚠️  Warnings:`);
            result.warnings.forEach(w => console.log(`   - ${w}`));
        }

    } catch (error: any) {
        result.valid = false;
        result.errors.push(error.message);
        console.log(`❌ ${result.file} - Invalid`);
        console.log(`   Error: ${error.message}`);
    }

    return result;
}

/**
 * Perform custom validation checks beyond OpenAPI spec compliance
 */
function performCustomValidations(
    api: OpenAPIV3.Document,
    result: ValidationResult
): void {
    // Check if all paths have tags
    if (api.paths) {
        Object.entries(api.paths).forEach(([pathKey, pathItem]) => {
            if (pathItem) {
                Object.entries(pathItem).forEach(([method, operation]) => {
                    if (
                        method !== 'parameters' &&
                        method !== 'servers' &&
                        typeof operation === 'object' &&
                        operation !== null
                    ) {
                        const op = operation as OpenAPIV3.OperationObject;
                        if (!op.tags || op.tags.length === 0) {
                            result.warnings.push(
                                `${method.toUpperCase()} ${pathKey} has no tags`
                            );
                        }

                        // Check if operation has summary and description
                        if (!op.summary) {
                            result.warnings.push(
                                `${method.toUpperCase()} ${pathKey} has no summary`
                            );
                        }

                        // Check if responses include error cases
                        if (op.responses) {
                            const hasErrorResponses = Object.keys(op.responses).some(
                                code => parseInt(code) >= 400
                            );
                            if (!hasErrorResponses) {
                                result.warnings.push(
                                    `${method.toUpperCase()} ${pathKey} has no error responses (400+)`
                                );
                            }
                        }
                    }
                });
            }
        });
    }

    // Check if spec has examples
    let hasExamples = false;
    if (api.paths) {
        Object.values(api.paths).forEach(pathItem => {
            if (pathItem) {
                Object.values(pathItem).forEach(operation => {
                    if (
                        typeof operation === 'object' &&
                        operation !== null &&
                        'requestBody' in operation
                    ) {
                        const op = operation as OpenAPIV3.OperationObject;
                        if (op.requestBody && 'content' in op.requestBody) {
                            const requestBody = op.requestBody as OpenAPIV3.RequestBodyObject;
                            Object.values(requestBody.content || {}).forEach(mediaType => {
                                if (mediaType.examples || mediaType.example) {
                                    hasExamples = true;
                                }
                            });
                        }
                    }
                });
            }
        });
    }

    if (!hasExamples) {
        result.warnings.push('Spec has no request/response examples');
    }

    // Check security definitions
    if (api.components?.securitySchemes) {
        console.log(`   ℹ️  Security schemes defined: ${Object.keys(api.components.securitySchemes).join(', ')}`);
    } else {
        result.warnings.push('No security schemes defined');
    }
}

/**
 * Get all YAML files from api-specs directory
 */
function getSpecFiles(): string[] {
    if (!fs.existsSync(SPECS_DIR)) {
        console.error(`❌ Specs directory not found: ${SPECS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(SPECS_DIR)
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.join(SPECS_DIR, file));

    return files;
}

/**
 * Main execution
 */
async function main() {
    console.log('🔍 Validating OpenAPI Specifications...\n');

    const args = process.argv.slice(2);
    let specFiles: string[];

    // Check if specific spec file is provided
    const specIndex = args.indexOf('--spec');
    if (specIndex !== -1 && args[specIndex + 1]) {
        specFiles = [args[specIndex + 1]];
    } else {
        specFiles = getSpecFiles();
    }

    if (specFiles.length === 0) {
        console.log('⚠️  No spec files found in api-specs/');
        process.exit(0);
    }

    console.log(`Found ${specFiles.length} spec file(s)\n`);

    const results: ValidationResult[] = [];

    for (const file of specFiles) {
        const result = await validateSpec(file);
        results.push(result);
        console.log(''); // Empty line between files
    }

    // Summary
    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.filter(r => !r.valid).length;
    const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0);

    console.log('─'.repeat(50));
    console.log('📊 Validation Summary:');
    console.log(`   Valid: ${validCount} ✅`);
    console.log(`   Invalid: ${invalidCount} ❌`);
    console.log(`   Warnings: ${warningCount} ⚠️`);
    console.log('─'.repeat(50));

    if (invalidCount > 0) {
        console.log('\n❌ Validation failed. Please fix errors above.');
        process.exit(1);
    } else if (warningCount > 0) {
        console.log('\n⚠️  Validation passed with warnings. Consider addressing them.');
        process.exit(0);
    } else {
        console.log('\n✅ All specs are valid!');
        process.exit(0);
    }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}


export { validateSpec };
export type { ValidationResult };
