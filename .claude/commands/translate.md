# Translate i18n Key

Translate a text key in src/i18n.ts into all supported languages.

## Usage

```
/translate <key_name>
```

Example: `/translate requiredNumberOfBuildings`

## Instructions for Claude

When the user runs this command with a translation key:

1. **Read the current entry** from `src/i18n.ts` for the specified key
2. **Identify missing translations** by comparing against the required language list:
   - english
   - french
   - polish
   - spanish
   - italian
   - german
   - brazilian
   - russian
   - simplified_chinese
   - traditional_chinese
   - japanese
   - korean

3. **Generate translations** for missing languages:
   - Use the English text as the base for translation
   - Provide accurate, contextually appropriate translations
   - Maintain consistent tone and terminology with existing translations
   - For Chinese, provide both simplified_chinese and traditional_chinese variants

4. **Update the file** using the Edit tool:
   - Replace the existing entry with the complete translation set
   - Maintain consistent formatting (order languages alphabetically if possible)
   - Use proper quoting style (match existing style in file)

5. **Verify** the changes:
   - Run `npm run type-check` to ensure TypeScript validity
   - Display the updated entry showing all 12 languages

## Important Notes

- Never modify quotes or special characters in existing translations
- Preserve any formatting or placeholders (like `<b>`, `%s`, etc.) in translations
- If a translation already exists for a language, do not change it unless explicitly asked
- After completion, show a summary of which languages were added
