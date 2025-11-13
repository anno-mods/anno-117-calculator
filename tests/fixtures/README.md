# Test Fixtures

This directory contains test configuration files that are loaded into localStorage before running tests.

## Available Fixtures

### empty.json
Minimal configuration with no population or factories configured. Use this for testing initial state and default values.

### basic.json
Basic configuration with one empty island and no buildings. Use this for:
- **Binding validation tests** - Verify templates render without errors
- **E2E tests** - Test basic application initialization and structure

### with-data.json
Configuration with one island per session and sample data (1 residence, 1 factory per island). Use this for:
- **Computed observable tests** - Test calculations with actual factory and population data
- **E2E tests that check relationships** - Verify initialization order, demands, buffs, etc.

## Creating New Fixtures

Fixtures are JSON objects where each key-value pair represents a localStorage entry. The key is the storage key, and the value is the stored string value.

### Example: Population Configuration

```json
{
  "versionCalculator": "test",
  "language": "english",
  "1010343.residents": "1000",
  "1010343.buildings.constructed": "5"
}
```

This sets up:
- Version and language
- 1000 residents for population level with GUID 1010343
- 5 constructed buildings for that level

### Example: Factory Configuration

```json
{
  "versionCalculator": "test",
  "language": "english",
  "1010517.buildings.constructed": "10",
  "1010517.buildings.fullyUtilizeConstructed": "1"
}
```

This sets up:
- 10 constructed buildings for factory with GUID 1010517
- Fully utilize constructed buildings setting enabled

## Storage Key Patterns

Common localStorage key patterns used by the calculator:

- `versionCalculator` - Calculator version
- `language` - Selected language
- `settings.{optionName}` - Application settings (0 = false, 1 = true)
- `{guid}.residents` - Population resident count
- `{guid}.buildings.constructed` - Number of constructed buildings
- `{guid}.buildings.fullyUtilizeConstructed` - Whether to fully utilize buildings
- `{guid}.boost` - Productivity boost value
- `{populationGuid}[{needGuid}].checked` - Population need activation state
- `{populationGuid}[{needGuid}].notes` - Notes for specific need
- `island.effect.{effectGuid}.scaling` - Island-level effect scaling (0-1)
- `global.effect.{effectGuid}.scaling` - Global effect scaling (0-1)

## Using Fixtures in Tests

```typescript
import { ConfigLoader } from '../helpers/config-loader';

const configLoader = new ConfigLoader();
await configLoader.loadConfig(page, 'tests/fixtures/basic.json');
```

Or programmatically:

```typescript
import { FixtureManager } from '../helpers/fixture-manager';

const fixtureManager = new FixtureManager();
const config = fixtureManager.generateFixture({
  populationLevels: [
    { guid: 1010343, residents: 1000, buildings: 5 }
  ],
  factories: [
    { guid: 1010517, buildings: 10, boost: 1.5 }
  ]
});
```
