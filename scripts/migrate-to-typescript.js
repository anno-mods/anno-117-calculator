#!/usr/bin/env node

/**
 * Migration script to help convert JavaScript files to TypeScript
 * This script provides utilities for the migration process
 */

const fs = require('fs');
const path = require('path');

/**
 * Converts a JavaScript file to TypeScript with basic type annotations
 * @param {string} jsFilePath - Path to the JavaScript file
 * @param {string} tsFilePath - Path to the output TypeScript file
 */
function convertJsToTs(jsFilePath, tsFilePath) {
    console.log(`Converting ${jsFilePath} to ${tsFilePath}`);
    
    try {
        let content = fs.readFileSync(jsFilePath, 'utf8');
        
        // Remove @ts-check comments
        content = content.replace(/\/\/ @ts-check\n?/g, '');
        
        // Add basic type annotations for function parameters
        content = content.replace(
            /function\s+(\w+)\s*\(([^)]*)\)/g,
            (match, funcName, params) => {
                if (params.trim() === '') return match;
                
                const typedParams = params.split(',').map(param => {
                    const trimmed = param.trim();
                    if (trimmed.includes('=')) {
                        const [name, defaultValue] = trimmed.split('=');
                        return `${name.trim()}: any = ${defaultValue.trim()}`;
                    }
                    return `${trimmed}: any`;
                }).join(', ');
                
                return `function ${funcName}(${typedParams})`;
            }
        );
        
        // Add basic type annotations for arrow functions
        content = content.replace(
            /(\w+)\s*=>\s*{/g,
            (match, params) => {
                if (params.includes('(')) return match;
                return `(${params}: any) => {`;
            }
        );
        
        // Add basic type annotations for class properties
        content = content.replace(
            /this\.(\w+)\s*=\s*ko\.observable\(/g,
            'public $1: KnockoutObservable<any> = ko.observable('
        );
        
        // Add basic type annotations for constructor parameters
        content = content.replace(
            /constructor\s*\(([^)]*)\)/g,
            (match, params) => {
                if (params.trim() === '') return `constructor()`;
                
                const typedParams = params.split(',').map(param => {
                    const trimmed = param.trim();
                    return `${trimmed}: any`;
                }).join(', ');
                
                return `constructor(${typedParams})`;
            }
        );
        
        // Add import statements for common types
        if (content.includes('NamedElement') || content.includes('Option') || content.includes('DLC')) {
            content = `import { NamedElement, Option, DLC } from './util';\n\n${content}`;
        }
        
        // Add export statements for classes
        content = content.replace(
            /class\s+(\w+)/g,
            'export class $1'
        );
        
        // Add export statements for functions
        content = content.replace(
            /function\s+(\w+)/g,
            'export function $1'
        );
        
        // Write the converted content
        fs.writeFileSync(tsFilePath, content);
        console.log(`✓ Successfully converted ${jsFilePath}`);
        
    } catch (error) {
        console.error(`✗ Error converting ${jsFilePath}:`, error.message);
    }
}

/**
 * Creates a stub TypeScript file for a module
 * @param {string} tsFilePath - Path to the TypeScript file
 * @param {string} moduleName - Name of the module
 */
function createStubFile(tsFilePath, moduleName) {
    const stubContent = `// Stub for ${moduleName} module - will be converted from js/${moduleName}.js
export class ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} {
    constructor(config: any) {
        // TODO: Convert from js/${moduleName}.js
    }
}
`;
    
    try {
        fs.writeFileSync(tsFilePath, stubContent);
        console.log(`✓ Created stub file ${tsFilePath}`);
    } catch (error) {
        console.error(`✗ Error creating stub file ${tsFilePath}:`, error.message);
    }
}

/**
 * Main migration function
 */
function migrateToTypeScript() {
    const jsDir = path.join(__dirname, '..', 'js');
    const srcDir = path.join(__dirname, '..', 'src');
    
    // Create src directory if it doesn't exist
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
    }
    
    // List of files to convert
    const filesToConvert = [
        'util.js',
        'main.js',
        'i18n.js',
        'population.js',
        'factories.js',
        'trade.js',
        'world.js',
        'views.js',
        'components.js'
    ];
    
    console.log('Starting JavaScript to TypeScript migration...\n');
    
    // Convert each file
    filesToConvert.forEach(file => {
        const jsPath = path.join(jsDir, file);
        const tsPath = path.join(srcDir, file.replace('.js', '.ts'));
        
        if (fs.existsSync(jsPath)) {
            convertJsToTs(jsPath, tsPath);
        } else {
            console.log(`⚠ File ${jsPath} not found, creating stub`);
            createStubFile(tsPath, file.replace('.js', ''));
        }
    });
    
    // Create params.ts stub
    const paramsTsPath = path.join(srcDir, 'params.ts');
    const paramsStubContent = `// Stub for params module - will be converted from js/params.js
// This file contains the configuration data generated by external program
if ((window as any).params == null) {
    (window as any).params = {};
}
`;
    
    try {
        fs.writeFileSync(paramsTsPath, paramsStubContent);
        console.log('✓ Created params.ts stub');
    } catch (error) {
        console.error('✗ Error creating params.ts:', error.message);
    }
    
    console.log('\nMigration completed!');
    console.log('\nNext steps:');
    console.log('1. Review and refine the converted TypeScript files');
    console.log('2. Add proper type definitions in src/types.ts');
    console.log('3. Fix any compilation errors');
    console.log('4. Test the application functionality');
    console.log('5. Run "npm run type-check" to verify types');
}

// Run migration if this script is executed directly
if (require.main === module) {
    migrateToTypeScript();
}

module.exports = {
    convertJsToTs,
    createStubFile,
    migrateToTypeScript
}; 