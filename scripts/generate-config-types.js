#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the JSON schema
const schemaPath = path.join(__dirname, '..', 'js', 'params.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Helper function to convert JSON schema type to TypeScript type
function convertJsonTypeToTypeScript(jsonType, properties = null, items = null) {
    switch (jsonType) {
        case 'string':
            return 'string';
        case 'integer':
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'array':
            if (items) {
                if (items.type === 'string') {
                    return 'string[]';
                } else if (items.type === 'integer') {
                    return 'number[]';
                } else if (items.type === 'object') {
                    return generateInterfaceFromObject(items) + '[]';
                }
            }
            return 'any[]';
        case 'object':
            if (properties) {
                return generateInterfaceFromObject({ properties, required: [] });
            }
            return 'Record<string, any>';
        default:
            return 'any';
    }
}

// Helper function to generate interface properties from object schema
function generateInterfaceFromObject(objectSchema, indent = '  ') {
    if (!objectSchema.properties) {
        return '{}';
    }

    const properties = [];
    const required = objectSchema.required || [];

    for (const [propName, propSchema] of Object.entries(objectSchema.properties)) {
        const isRequired = required.includes(propName);
        const optional = isRequired ? '' : '?';
        
        let typeAnnotation;
        
        // Special case for locaText properties - always use LocaTextConfig
        if (propName === 'locaText') {
            typeAnnotation = 'LocaTextConfig';
        } else if (propSchema.type === 'object' && propSchema.properties) {
            // Nested object
            typeAnnotation = '{\n' + 
                Object.entries(propSchema.properties).map(([nestedProp, nestedSchema]) => {
                    const nestedRequired = propSchema.required || [];
                    const nestedOptional = nestedRequired.includes(nestedProp) ? '' : '?';
                    // Special case for nested locaText properties
                    const nestedType = nestedProp === 'locaText' ? 'LocaTextConfig' : convertJsonTypeToTypeScript(nestedSchema.type);
                    return `${indent}  ${nestedProp}${nestedOptional}: ${nestedType};`;
                }).join('\n') + 
                '\n';
            if (propName == "needAttributes")
                typeAnnotation += indent + '  [key: string]: number; // Allow string indexing\n'; 
            typeAnnotation += indent + '}';
        } else if (propSchema.type === 'array' && propSchema.items) {
            // Array type
            if (propSchema.items.type === 'object' && propSchema.items.properties) {
                const itemInterface = generateInterfaceFromObject(propSchema.items, indent + '  ');
                typeAnnotation = `{\n${Object.entries(propSchema.items.properties).map(([itemProp, itemSchema]) => {
                    const itemRequired = propSchema.items.required || [];
                    const itemOptional = itemRequired.includes(itemProp) ? '' : '?';
                    // Special case for locaText in array items
                    const itemType = itemProp === 'locaText' ? 'LocaTextConfig' : convertJsonTypeToTypeScript(itemSchema.type);
                    return `${indent}  ${itemProp}${itemOptional}: ${itemType};`;
                }).join('\n')}\n${indent}}[]`;
            } else {
                typeAnnotation = convertJsonTypeToTypeScript(propSchema.type, null, propSchema.items);
            }
        } else {
            typeAnnotation = convertJsonTypeToTypeScript(propSchema.type, propSchema.properties, propSchema.items);
        }

        properties.push(`${indent}${propName}${optional}: ${typeAnnotation};`);
    }

    return properties.join('\n');
}

// Check if an object has locaText property
function hasLocaTextProperty(objectSchema) {
    return objectSchema.properties && objectSchema.properties.locaText;
}

// Generate the TypeScript content
function generateTypeScriptInterfaces() {
    let output = '// Generated TypeScript interfaces from params.schema.json\n';
    output += '// This file contains configuration interfaces for Anno 117 calculator parameters\n\n';

    // Always generate LocaTextConfig interface
    let needsLocaTextConfig = true;

    // Generate LocaTextConfig
    if (needsLocaTextConfig) {
        output += '// Common interface for localized text\n';
        output += 'export interface LocaTextConfig {\n';
        const locaTextSchema = Object.values(schema.properties)
            .find(prop => prop.type === 'array' && prop.items && hasLocaTextProperty(prop.items))
            ?.items?.properties?.locaText;
        
        if (locaTextSchema && locaTextSchema.properties) {
            for (const [lang, langSchema] of Object.entries(locaTextSchema.properties)) {
                output += `  ${lang}: ${convertJsonTypeToTypeScript(langSchema.type)};\n`;
            }
        }
        output += '  [key: string]: string; // Allow string indexing\n';
        output += '}\n\n';
    }

    // Generate interfaces for each property
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
        const title = propertySchema.title || propertyName;
        const interfaceName = title + 'Config';
        
        output += `// ${title} configuration interface\n`;        
        output += `export interface ${interfaceName} {\n`;

        if (propertySchema.type === 'array') {
            if (propertySchema.items && propertySchema.items.type === 'string') {
                // Array of strings - for languages, just indicate it's a string array in the interface
                output += '  // This interface represents individual items in the ' + propertyName + ' array\n';
                output += '  // The actual array type is string[]\n';
            } else if (propertySchema.items && propertySchema.items.type === 'object') {
                // Array of objects - generate interface for the object structure
                const interfaceContent = generateInterfaceFromObject(propertySchema.items);
                output += interfaceContent.replace(/locaText: \{[^}]+\}/g, 'locaText: LocaTextConfig');
            }
        } else if (propertySchema.type === 'object') {
            // Direct object - special handling for icon mappings
            if (propertyName === 'icons') {
                output += '  [iconPath: string]: string;\n';
            } else {
                const interfaceContent = generateInterfaceFromObject(propertySchema);
                output += interfaceContent;
            }
        }

        output += '\n}\n\n';
    }

    // Generate root interface that combines all arrays
    output += '// Root configuration interface combining all parameter types\n';
    output += 'export interface ParamsConfig {\n';
    
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
        const title = propertySchema.title || propertyName;
        const interfaceName = title + 'Config';
        
        if (propertySchema.type === 'array') {
            if (propertySchema.items && propertySchema.items.type === 'string') {
                output += `  ${propertyName}: string[];\n`;
            } else {
                output += `  ${propertyName}: ${interfaceName}[];\n`;
            }
        } else if (propertySchema.type === 'object') {
            output += `  ${propertyName}: ${interfaceName};\n`;
        }
    }
    
    output += '}\n';

    return output;
}

// Generate the TypeScript content
const typeScriptContent = generateTypeScriptInterfaces();

// Write to types.config.ts
const outputPath = path.join(__dirname, '..', 'src', 'types.config.ts');
fs.writeFileSync(outputPath, typeScriptContent, 'utf8');

console.log('Generated types.config.ts successfully!');
console.log(`Output written to: ${outputPath}`);