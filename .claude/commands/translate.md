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
   - Use the English and German text as the base for translation
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

## Dictionary of key terms
   {
      "lineID": -6901888795121698763,
      "locaText": {
        "brazilian": "Efeitos Ativos da Ilha",
        "english": "Active Island Effects",
        "french": "Effets insulaires actifs",
        "german": "Aktive Inseleffekte",
        "italian": "Effetti attivi dell'isola",
        "japanese": "​有効​な​島​の​効果",
        "korean": "​섬 ​효과 ​활성화",
        "polish": "Aktywne efekty wyspy",
        "russian": "Активные эффекты острова",
        "simplified_chinese": "​当前​岛屿​效果",
        "spanish": "Efectos de isla activos",
        "traditional_chinese": "​啟用​中的​島嶼​效果"
      },
      "name": "activeIslandEffects"
    },
    {
      "lineID": -6904082780390519730,
      "locaText": {
        "brazilian": "Construções afetadas",
        "english": "Affected Buildings",
        "french": "Bâtiments affectés",
        "german": "Beeinflusste Gebäude",
        "italian": "Edifici interessati",
        "japanese": "​影響​を​受ける​施設",
        "korean": "​영향을 ​받는 ​건물",
        "polish": "Budynki objęte efektem",
        "russian": "Затронутые постройки",
        "simplified_chinese": "​受​影响​建筑",
        "spanish": "Edificios afectados",
        "traditional_chinese": "​受​影響​建築"
      },
      "name": "affectedBuildings"
    },
    {
      "lineID": -6915762395677959303,
      "locaText": {
        "brazilian": "Todos",
        "english": "All",
        "french": "Tous",
        "german": "Alle",
        "italian": "Tutte",
        "japanese": "​すべて",
        "korean": "​전체",
        "polish": "Wszystkie",
        "russian": "Все",
        "simplified_chinese": "​全部",
        "spanish": "Todo",
        "traditional_chinese": "​全部"
      },
      "name": "all"
    },
    {
      "lineID": -6905197213145912196,
      "locaText": {
        "brazilian": "Todas as construções",
        "english": "All Buildings",
        "french": "Tous les bâtiments",
        "german": "Alle Gebäude",
        "italian": "Tutti gli edifici",
        "japanese": "​すべて​の​施設",
        "korean": "​모든 ​건물",
        "polish": "Wszystkie budynki",
        "russian": "Все постройки",
        "simplified_chinese": "​所有​建筑",
        "spanish": "Todos los edificios",
        "traditional_chinese": "​所有​建築"
      },
      "name": "allBuildings"
    },
    {
      "lineID": -6901911865748271091,
      "locaText": {
        "brazilian": "Todas as ilhas",
        "english": "All Islands",
        "french": "Toutes les îles",
        "german": "Alle Inseln",
        "italian": "Tutte le isole",
        "japanese": "​すべて​の​島",
        "korean": "​모든 ​섬",
        "polish": "Wszystkie wyspy",
        "russian": "Все острова",
        "simplified_chinese": "​所有​岛屿",
        "spanish": "Todas las islas",
        "traditional_chinese": "​所有​島嶼"
      },
      "name": "allIslands"
    },
    {
      "lineID": -6911313214704811434,
      "locaText": {
        "brazilian": "Aplicar",
        "english": "Apply",
        "french": "Appliquer",
        "german": "Anwenden",
        "italian": "Applica",
        "japanese": "​適用",
        "korean": "​적용",
        "polish": "Zastosuj",
        "russian": "Применить",
        "simplified_chinese": "​应用",
        "spanish": "Aplicar",
        "traditional_chinese": "​套用"
      },
      "name": "apply"
    },
    {
      "lineID": -6903712981431318990,
      "locaText": {
        "brazilian": "Efeitos de Área",
        "english": "Area Effects",
        "french": "Effets de zone",
        "german": "Bereichseffekte",
        "italian": "Effetti ad area",
        "japanese": "​範囲​効果",
        "korean": "​지역 ​효과",
        "polish": "Efekty obszarowe",
        "russian": "Эффекты по области",
        "simplified_chinese": "​范围​效果",
        "spanish": "Efectos de área",
        "traditional_chinese": "​區域​效果"
      },
      "name": "areaEffects"
    },
    {
      "lineID": -6908820605821366843,
      "locaText": {
        "brazilian": "Crença",
        "english": "Belief",
        "french": "Foi",
        "german": "Glauben",
        "italian": "Credenza",
        "japanese": "​信仰",
        "korean": "​신념",
        "polish": "Wiara",
        "russian": "Верования",
        "simplified_chinese": "​信仰",
        "spanish": "Fe",
        "traditional_chinese": "​信仰"
      },
      "name": "belief"
    },
    {
      "lineID": -6907330109749815048,
      "locaText": {
        "brazilian": "Impulsos",
        "english": "Buffs",
        "french": "Bonus",
        "german": "Buffs",
        "italian": "Buff",
        "japanese": "​バフ",
        "korean": "​강화 ​효과",
        "polish": "Premie",
        "russian": "Усиления",
        "simplified_chinese": "​增益",
        "spanish": "Ventajas",
        "traditional_chinese": "​增益"
      },
      "name": "buffs"
    },
    {
      "lineID": -6917203094771649915,
      "locaText": {
        "brazilian": "Construções",
        "english": "Buildings",
        "french": "Bâtiments",
        "german": "Gebäude",
        "italian": "Edifici",
        "japanese": "​建物",
        "korean": "​건물",
        "polish": "Budynki",
        "russian": "Постройки",
        "simplified_chinese": "​建筑",
        "spanish": "Edificios",
        "traditional_chinese": "​建築"
      },
      "name": "buildings"
    },
    {
      "lineID": -6915627349826723809,
      "locaText": {
        "brazilian": "Confirmar",
        "english": "Confirm",
        "french": "Confirmer",
        "german": "Bestätigen",
        "italian": "Conferma",
        "japanese": "​確認",
        "korean": "​확인",
        "polish": "Potwierdź",
        "russian": "Подтвердить",
        "simplified_chinese": "​确认",
        "spanish": "Confirmar",
        "traditional_chinese": "​確認"
      },
      "name": "confirm"
    },
    {
      "lineID": -6917180467021169596,
      "locaText": {
        "brazilian": "Materiais de construção",
        "english": "Construction Materials",
        "french": "Matériau de construction",
        "german": "Baumaterial",
        "italian": "Materiale da costruzione",
        "japanese": "​建設​資材",
        "korean": "​건설재",
        "polish": "Materiał budowlany",
        "russian": "Строительный материал",
        "simplified_chinese": "​建筑​材料",
        "spanish": "Materiales de construcción",
        "traditional_chinese": "​建築​材料"
      },
      "name": "constructionMaterial"
    },
    {
      "lineID": -6902845924876156586,
      "locaText": {
        "brazilian": "Tuberculose",
        "english": "Consumption",
        "french": "Consommation",
        "german": "Verbrauch",
        "italian": "Consumo",
        "japanese": "​消費",
        "korean": "​폐결핵",
        "polish": "Wyczerpanie",
        "russian": "Истощение",
        "simplified_chinese": "​痨​病",
        "spanish": "Tisis",
        "traditional_chinese": "​無力"
      },
      "name": "consumption"
    },
    {
      "lineID": -6913489339087789708,
      "locaText": {
        "brazilian": "Patrono atual",
        "english": "Current Patron",
        "french": "Dieu tutélaire actuel",
        "german": "Aktuelle Schutzgottheit",
        "italian": "Divinità attuale",
        "japanese": "​現在​の​祭神",
        "korean": "​현재 ​수호신",
        "polish": "Aktualny patron",
        "russian": "Текущий покровитель",
        "simplified_chinese": "​当前​守​护​神",
        "spanish": "Tutelaje actual",
        "traditional_chinese": "​目前​守護神"
      },
      "name": "currentPatron"
    },
    {
      "lineID": -6913943659840406396,
      "locaText": {
        "brazilian": "Devoção / Crença",
        "english": "Devotion / Belief",
        "french": "Dévotion / Foi",
        "german": "Verehrung/Glauben",
        "italian": "Devozione/Credenza",
        "japanese": "​信仰 / ​信心",
        "korean": "​신앙심 / ​신념",
        "polish": "Pobożność / Wiara",
        "russian": "Почитание / верования",
        "simplified_chinese": "​虔诚/​信仰",
        "spanish": "Devoción / Fe",
        "traditional_chinese": "​虔誠 / ​信仰"
      },
      "name": "devotion"
    },
    {
      "lineID": -6912820157918341621,
      "locaText": {
        "brazilian": "Baixar",
        "english": "Download",
        "french": "Télécharger",
        "german": "Herunterladen",
        "italian": "Scarica",
        "japanese": "​ダウンロード",
        "korean": "​다운로드",
        "polish": "Pobierz",
        "russian": "Скачать",
        "simplified_chinese": "​下载",
        "spanish": "Descargar",
        "traditional_chinese": "​下載"
      },
      "name": "download"
    },
    {
      "lineID": -6902234897441092053,
      "locaText": {
        "brazilian": "Efeito",
        "english": "Effect",
        "french": "Effet",
        "german": "Effekt",
        "italian": "Effetto",
        "japanese": "​効果",
        "korean": "​효과",
        "polish": "Efekt",
        "russian": "Эффект",
        "simplified_chinese": "​效果",
        "spanish": "Efecto",
        "traditional_chinese": "​效果"
      },
      "name": "effect"
    },
    {
      "lineID": -6902362035358284768,
      "locaText": {
        "brazilian": "Efeitos",
        "english": "Effects",
        "french": "Effets",
        "german": "Effekte",
        "italian": "Effetti",
        "japanese": "​効果",
        "korean": "​효과",
        "polish": "Efekty",
        "russian": "Эффект",
        "simplified_chinese": "​效果",
        "spanish": "Efectos",
        "traditional_chinese": "​效果"
      },
      "name": "effects"
    },
    {
      "lineID": -6902018417385309297,
      "locaText": {
        "brazilian": "Duração do evento",
        "english": "Event duration",
        "french": "Durée de l'événement",
        "german": "Ereignisdauer",
        "italian": "Durata dell'evento",
        "japanese": "​イベント​の​期間",
        "korean": "​이벤트 ​기간",
        "polish": "Czas trwania wydarzenia",
        "russian": "Длительность события",
        "simplified_chinese": "​活动​持续​时间",
        "spanish": "Duración del evento",
        "traditional_chinese": "​事件​持續​時間"
      },
      "name": "eventDuration"
    },
    {
      "lineID": -6900061796493286420,
      "locaText": {
        "brazilian": null,
        "english": "Extra Goods  ",
        "french": null,
        "german": null,
        "italian": null,
        "japanese": null,
        "korean": null,
        "polish": null,
        "russian": null,
        "simplified_chinese": null,
        "spanish": null,
        "traditional_chinese": null
      },
      "name": "extraGoods"
    },
    {
      "lineID": -6910306885876902499,
      "locaText": {
        "brazilian": "Global",
        "english": "Global",
        "french": "Global",
        "german": "Global",
        "italian": "Globale",
        "japanese": "​世界",
        "korean": "​전역",
        "polish": "Globalnie",
        "russian": "Глобально",
        "simplified_chinese": "​全局",
        "spanish": "Global",
        "traditional_chinese": "​全域"
      },
      "name": "global"
    },
    {
      "lineID": -6900227375200473257,
      "locaText": {
        "brazilian": "Efeitos globais",
        "english": "Global Effects",
        "french": "Effets globaux",
        "german": "Globale Effekte",
        "italian": "Effetti globali",
        "japanese": "​世界​効果",
        "korean": "​전역 ​효과",
        "polish": "Efekty globalne",
        "russian": "Глобальные эффекты",
        "simplified_chinese": "​全局​效果",
        "spanish": "Efectos globales",
        "traditional_chinese": "​全域​效果"
      },
      "name": "globalEffects"
    },
    {
      "lineID": -6904656400857447148,
      "locaText": {
        "brazilian": "Mercad.",
        "english": "Goods",
        "french": "March.",
        "german": "Waren",
        "italian": "Merci",
        "japanese": "​品物",
        "korean": "​물품",
        "polish": "Towary",
        "russian": "Товары",
        "simplified_chinese": "​货物",
        "spanish": "Productos",
        "traditional_chinese": "​貨物"
      },
      "name": "goods"
    },
    {
      "lineID": -6916926126237868583,
      "locaText": {
        "brazilian": "Consumo de mercadorias",
        "english": "Goods Consumption",
        "french": "Consommation de marchandises",
        "german": "Warenverbrauch",
        "italian": "Consumo di merci",
        "japanese": "​品物​の​消費",
        "korean": "​물품 ​소비량",
        "polish": "Konsumpcja towarów",
        "russian": "Потребление товаров",
        "simplified_chinese": "​物资​消耗",
        "spanish": "Consumo de productos",
        "traditional_chinese": "​貨物​消耗"
      },
      "name": "goodsConsumption"
    },
    {
      "lineID": -6906640699676227597,
      "locaText": {
        "brazilian": "Ajuda",
        "english": "Help",
        "french": "Aide",
        "german": "Hilfe",
        "italian": "Aiuto",
        "japanese": "​ヘルプ",
        "korean": "​도움말",
        "polish": "Pomoc",
        "russian": "Помощь",
        "simplified_chinese": "​帮助",
        "spanish": "Ayuda",
        "traditional_chinese": "​協助"
      },
      "name": "help"
    },
    {
      "lineID": -6901814024921012623,
      "locaText": {
        "brazilian": "Impulsos da Ilha",
        "english": "Island Buffs",
        "french": "Bonus de l'île",
        "german": "Inselbuffs",
        "italian": "Buff isola",
        "japanese": "​島​の​バフ",
        "korean": "​섬 ​강화 ​효과",
        "polish": "Premie wyspy",
        "russian": "Усиления острова",
        "simplified_chinese": "​岛屿​增益",
        "spanish": "Ventajas de isla",
        "traditional_chinese": "​島嶼​增益"
      },
      "name": "islandBuffs"
    },
    {
      "lineID": -6910251369175148580,
      "locaText": {
        "brazilian": "Idioma",
        "english": "Language",
        "french": "Langue",
        "german": "Sprache",
        "italian": "Lingua",
        "japanese": "​言語",
        "korean": "​언어",
        "polish": "Język",
        "russian": "Язык",
        "simplified_chinese": "​语言",
        "spanish": "Idioma",
        "traditional_chinese": "​語言"
      },
      "name": "language"
    },
    {
      "lineID": -6913212391033157055,
      "locaText": {
        "brazilian": "Atributos de necessidade",
        "english": "Need Attributes",
        "french": "Attributs de besoin",
        "german": "Attribute",
        "italian": "Attributi dei bisogni",
        "japanese": "​需要​の​特性",
        "korean": "​요구 ​속성",
        "polish": "Atrybuty związane z potrzebami",
        "russian": "Показатели потребностей",
        "simplified_chinese": "​需求​属性",
        "spanish": "Atributos de necesidad",
        "traditional_chinese": "​需求​屬性"
      },
      "name": "needAttributes"
    },
    {
      "lineID": -6901164581421416158,
      "locaText": {
        "brazilian": "Consumo de Necessidades",
        "english": "Need Consumption",
        "french": "Consommation du bien",
        "german": "Verbrauch der Bedürfnisse",
        "italian": "Bisogno di consumo",
        "japanese": "​需要​の​消費",
        "korean": "​물품 ​요구량",
        "polish": "Potrzebna konsumpcja",
        "russian": "Потребление",
        "simplified_chinese": "​需求​消耗​程度",
        "spanish": "Consumo de necesidades",
        "traditional_chinese": "​需求​消耗​程度"
      },
      "name": "needConsumption"
    },
    {
      "lineID": -6915455774919739315,
      "locaText": {
        "brazilian": "Necessidades",
        "english": "Needs",
        "french": "Besoins",
        "german": "Bedürfnisse",
        "italian": "Bisogni",
        "japanese": "​需要",
        "korean": "​요구",
        "polish": "Potrzeby",
        "russian": "Потребности",
        "simplified_chinese": "​需求",
        "spanish": "Necesidades",
        "traditional_chinese": "​需求"
      },
      "name": "needs"
    },
    {
      "lineID": -6913551300295748472,
      "locaText": {
        "brazilian": "Armazenamento de saída",
        "english": "Output Storage",
        "french": "Stockage de production",
        "german": "Warenlager",
        "italian": "Deposito in uscita",
        "japanese": "​生産​貯蔵​所",
        "korean": "​생산품 ​저장 ​공간",
        "polish": "Produkty",
        "russian": "Хранилище готовых товаров",
        "simplified_chinese": "​输出​仓库",
        "spanish": "Almacenaje de expedición",
        "traditional_chinese": "​產品​儲藏量"
      },
      "name": "outputStorage"
    },
    {
      "lineID": -6904053276046802194,
      "locaText": {
        "brazilian": "Deus Patrono",
        "english": "Patron God",
        "french": "Dieu tutélaire",
        "german": "Schutzgottheit",
        "italian": "Divinità protettrice",
        "japanese": "​祭神",
        "korean": "​수호신",
        "polish": "Opiekuńcze bóstwo",
        "russian": "Божество-покровитель",
        "simplified_chinese": "​守​护​神",
        "spanish": "Deidad tutelar",
        "traditional_chinese": "​守護神"
      },
      "name": "patron"
    },
    {
      "lineID": -6916892856177889166,
      "locaText": {
        "brazilian": "Efeito de Patrono Exaltado",
        "english": "Exalted Patron Effect",
        "french": "Effet du dieu tutélaire exalté",
        "german": "„Erhabene Schutzgottheit“-Effekt",
        "italian": "Effetto divinità eccelsa",
        "japanese": "​高位​祭神​の​効果",
        "korean": "​고귀한 ​수호신 ​효과",
        "polish": "Podniosły efekt patrona",
        "russian": "Эффект главного покровителя",
        "simplified_chinese": "​敬奉​守​护​神​的​效果",
        "spanish": "Efecto de deidad exaltada",
        "traditional_chinese": "​崇高​守護神​效果"
      },
      "name": "patronEffects"
    },
    {
      "lineID": -6914202634429573508,
      "locaText": {
        "brazilian": "Produção",
        "english": "Production",
        "french": "Production",
        "german": "Produktion",
        "italian": "Produzione",
        "japanese": "​生産",
        "korean": "​생산",
        "polish": "Produkcja",
        "russian": "Производство",
        "simplified_chinese": "​生产",
        "spanish": "Producción",
        "traditional_chinese": "​生產"
      },
      "name": "production"
    },
    {
      "lineID": -6914034826827989276,
      "locaText": {
        "brazilian": "Construtor de cidades",
        "english": "Production Buildings",
        "french": "Bâtiments de production",
        "german": "Produktionsgebäude",
        "italian": "Edifici produttivi",
        "japanese": "​生産​施設",
        "korean": "​생산 ​건물",
        "polish": "Budynki produkcyjne",
        "russian": "Производственные постройки",
        "simplified_chinese": "​生产​建筑",
        "spanish": "Edificios de producción",
        "traditional_chinese": "​生產​建築"
      },
      "name": "productionBuildings"
    },
    {
      "lineID": -6910138230344138817,
      "locaText": {
        "brazilian": "Cadeia de produção",
        "english": "Production Chain",
        "french": "Chaîne de production",
        "german": "Produktionskette",
        "italian": "Catena di produzione",
        "japanese": "​生産​チェーン",
        "korean": "​생산 ​체인",
        "polish": "Łańcuch produkcyjny",
        "russian": "Производственная цепочка",
        "simplified_chinese": "​生产​链",
        "spanish": "Cadena de producción",
        "traditional_chinese": "​生產​鏈"
      },
      "name": "productionChain"
    },
    {
      "lineID": -6902990997164434871,
      "locaText": {
        "brazilian": "Produtividade",
        "english": "Productivity",
        "french": "Productivité",
        "german": "Produktivität",
        "italian": "Produttività",
        "japanese": "​生産​性",
        "korean": "​생산성",
        "polish": "Wydajność",
        "russian": "Продуктивность",
        "simplified_chinese": "​生产​力",
        "spanish": "Productividad",
        "traditional_chinese": "​生產​效率"
      },
      "name": "productivity"
    },
    {
      "lineID": -6899952445988598006,
      "locaText": {
        "brazilian": "Serviços públicos",
        "english": "Public Services",
        "french": "Services publics",
        "german": "Öffentliche Dienste",
        "italian": "Servizi pubblici",
        "japanese": "​公共​サービス",
        "korean": "​공공 ​서비스",
        "polish": "Usługi publiczne",
        "russian": "Общественные здания",
        "simplified_chinese": "​公共​服务",
        "spanish": "Servicios públicos",
        "traditional_chinese": "​公共​服務"
      },
      "name": "publicBuildings"
    },
    {
      "lineID": -6908559383606239043,
      "locaText": {
        "brazilian": "Residências",
        "english": "Residences",
        "french": "Résidences",
        "german": "Wohnhäuser",
        "italian": "Residenze",
        "japanese": "​住居",
        "korean": "​주거지",
        "polish": "Domostwa",
        "russian": "Жилые дома",
        "simplified_chinese": "​住所",
        "spanish": "Residencias",
        "traditional_chinese": "​住所"
      },
      "name": "residences"
    },
    {
      "lineID": -6904910280097787367,
      "locaText": {
        "brazilian": null,
        "english": "Residents",
        "french": null,
        "german": null,
        "italian": null,
        "japanese": null,
        "korean": null,
        "polish": null,
        "russian": null,
        "simplified_chinese": null,
        "spanish": null,
        "traditional_chinese": null
      },
      "name": "residents"
    },
    {
      "lineID": -6915422247772755926,
      "locaText": {
        "brazilian": "Exibir informações",
        "english": "Show Information",
        "french": "Afficher les informations",
        "german": "Informationen anzeigen",
        "italian": "Mostra informazioni",
        "japanese": "​情報​を​表示",
        "korean": "​정보 ​보기",
        "polish": "Pokaż informacje",
        "russian": "Показать подробности",
        "simplified_chinese": "​显示​信息",
        "spanish": "Mostrar información",
        "traditional_chinese": "​顯示​資訊"
      },
      "name": "showInformation"
    },
    {
      "lineID": -6911349978207385087,
      "locaText": {
        "brazilian": "Mostra as necessidades desta classe populacional",
        "english": "Shows the needs of this population tier",
        "french": "Affiche les besoins de ce palier de population",
        "german": "Zeigt die Bedürfnisse dieser Bevölkerungsstufe.",
        "italian": "Mostra le esigenze di questo livello di popolazione",
        "japanese": "​この​市民​階層​の​需要​を​表示",
        "korean": "​해당 ​주민 ​계층의 ​요구 ​자원을 ​표시합니다.",
        "polish": "Pokazuje potrzeby na tym poziomie populacji",
        "russian": "Показывает потребности данного класса жителей",
        "simplified_chinese": "​显示​该​人口​阶级​的​需求",
        "spanish": "Muestra las necesidades de esta categoría de población",
        "traditional_chinese": "​顯示​該​人口​階級​的​需求"
      },
      "name": "showNeedsOfPopulationTier"
    },
    {
      "lineID": -6909909211298253262,
      "locaText": {
        "brazilian": "Configurações",
        "english": "Settings",
        "french": "Paramètres",
        "german": "Einstellungen",
        "italian": "Impostazioni",
        "japanese": "​設定",
        "korean": "​설정",
        "polish": "Ustawienia",
        "russian": "Настройки",
        "simplified_chinese": "​设置",
        "spanish": "Ajustes",
        "traditional_chinese": "​設定"
      },
      "name": "settings"
    },
    {
      "lineID": -6903619873875452438,
      "locaText": {
        "brazilian": "Comerciantes",
        "english": "Traders",
        "french": "Marchands",
        "german": "Händler",
        "italian": "Mercanti",
        "japanese": "​商人",
        "korean": "​상인",
        "polish": "Kupcy",
        "russian": "Торговцы",
        "simplified_chinese": "​商人",
        "spanish": "Comerciantes",
        "traditional_chinese": "​商人"
      },
      "name": "traders"
    },
    {
      "lineID": -6911891323366335933,
      "locaText": {
        "brazilian": "Comercializando",
        "english": "Trading",
        "french": "Commerce",
        "german": "Handeln",
        "italian": "Commercio",
        "japanese": "​取引",
        "korean": "​무역 ​중",
        "polish": "Handel",
        "russian": "Торговля",
        "simplified_chinese": "​交易",
        "spanish": "Comercio",
        "traditional_chinese": "​交易"
      },
      "name": "trading"
    },
    {
      "lineID": -6912046064850205942,
      "locaText": {
        "brazilian": "Total",
        "english": "Total",
        "french": "Total",
        "german": "Gesamt",
        "italian": "Totale",
        "japanese": "​合計",
        "korean": "​합계",
        "polish": "Razem",
        "russian": "Всего",
        "simplified_chinese": "​总计",
        "spanish": "Total",
        "traditional_chinese": "​總計"
      },
      "name": "total"
    },
    {
      "lineID": -6915569607474692589,
      "locaText": {
        "brazilian": "Rotas comerciais",
        "english": "Trade Routes",
        "french": "Routes commerciales",
        "german": "Handelsrouten",
        "italian": "Rotte commerciali",
        "japanese": "​取引​ルート",
        "korean": "​무역로",
        "polish": "Szlaki handlowe",
        "russian": "Торговые маршруты",
        "simplified_chinese": "​贸易​路线",
        "spanish": "Rutas de comercio",
        "traditional_chinese": "​貿易​路線"
      },
      "name": "tradeRoutes"
    },
    {
      "lineID": -6905498542987856790,
      "locaText": {
        "brazilian": "Efeito de Religião",
        "english": "Religion Effect",
        "french": "Effet (religion)",
        "german": "Religionseffekt",
        "italian": "Effetto religione",
        "japanese": "​宗教​の​効果",
        "korean": "​종교 ​효과",
        "polish": "Efekt religijny",
        "russian": "Эффект религии",
        "simplified_chinese": "​宗教​效果",
        "spanish": "Efecto de religión",
        "traditional_chinese": "​宗教​效果"
      },
      "name": "wonderEffect"
    },
    {
      "lineID": -6907309872814266407,
      "locaText": {
        "brazilian": "Mundo",
        "english": "World",
        "french": "Monde",
        "german": "Welt",
        "italian": "Mondo",
        "japanese": "​世界",
        "korean": "​세계",
        "polish": "Świat",
        "russian": "Мир",
        "simplified_chinese": "​世界",
        "spanish": "Mundo",
        "traditional_chinese": "​世界"
      },
      "name": "world"
    },
    {
      "lineID": -6914935202834947869,
      "locaText": {
        "brazilian": "Força de trabalho",
        "english": "Workforce",
        "french": "Main-d'œuvre",
        "german": "Arbeitskräfte",
        "italian": "Manodopera",
        "japanese": "​労働​力",
        "korean": "​노동력",
        "polish": "Siła robocza",
        "russian": "Рабочая сила",
        "simplified_chinese": "​劳动​力",
        "spanish": "Mano de obra",
        "traditional_chinese": "​勞動力"
      },
      "name": "workforce"
    }
