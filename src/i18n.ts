// @ts-check

/** Codes are processed in the order they are listed here and the first match is used. */
export const languageCodes: Record<string, string> = {
    'en': 'english',
    'de': 'german',
    'zh_TW': 'chinese_traditional',
    'zh_HK': 'chinese_traditional',
    'zh_HANT': 'chinese_traditional',
    'zh': 'chinese_simplified',
    'fr': 'french',
    'es': 'spanish',
    'pt-br': 'brazilian',
    'ru': 'russian',
    'ko': 'korean',
    'ja': 'japanese',    
    'it': 'italien',    
    'pl': 'polish'
}

export const texts: Record<string, Record<string, string>> = {
    residents: {
        "french": "Résidents",
        "english": "Residents",
        "italian": "Residenti",
        "simplified_chinese": "居民",
        "spanish": "Residentes",
        "japanese": "住民",
        "traditional_chinese": "居民",
        "polish": "Mieszkańcy",
        "german": "Einwohner",
        "korean": "주민",
        "russian": "Жители",
        "brazilian": "Residentes"
    },
 
    workforce: {
        english: "Required Workforce",
        french: "Main-d'œuvre requise",
        polish: "Wymagana siła robocza",
        spanish: "Mano de obra requerida",
        italian: "Forza lavoro richiesta",
        german: "Benötigte Arbeitskraft",
        brazilian: "Força de trabalho necessária",
        russian: "Требуемая рабочая сила",
        simplified_chinese: "所需劳动力",
        traditional_chinese: "所需勞動力",
        japanese: "必要な労働力",
        korean: "필요한 인력"
    },
    itemsEquipped: {
        "english": "Items Equipped",
        "simplified_chinese": "已装备物品",
        "traditional_chinese": "已裝備物品",
        "italian": "Oggetti in uso",
        "spanish": "Objetos equipados",
        "german": "Ausgerüstete Items",
        "polish": "Przedmioty w użyciu",
        "french": "Objets en stock",
        "korean": "배치한 아이템",
        "japanese": "装備したアイテム",
        "russian": "Используемые предметы",
        "brazilian": "Itens equipados"
    },
    extraGoods: {
        "english": "Extra Goods",
        "simplified_chinese": "额外货物",
        "traditional_chinese": "額外貨物",
        "italian": "Merci aggiuntive",
        "spanish": "Bienes extra",
        "german": "Zusatzwaren",
        "polish": "Dodatkowe towary",
        "french": "Marchandises supplémentaires",
        "korean": "추가 물품",
        "japanese": "追加品物",
        "russian": "Дополнительные товары",
        "brazilian": "Bens extras"
    },
    "devotion": {
        "english": "Devotion",
        "simplified_chinese": "虔诚度",
        "traditional_chinese": "虔誠度",
        "italian": "Devozione",
        "spanish": "Devoción",
        "german": "Hingabe",
        "polish": "Oddanie",
        "french": "Dévotion",
        "korean": "헌신도",
        "japanese": "献身度",
        "russian": "Преданность"
    },

    "milestone": {
        "english": "Milestone",
        "simplified_chinese": "里程碑",
        "traditional_chinese": "里程碑",
        "italian": "Traguardo",
        "spanish": "Hito",
        "german": "Meilenstein",
        "polish": "Kamień milowy",
        "french": "Étape",
        "korean": "이정표",
        "japanese": "マイルストーン",
        "russian": "Этап"
    },
    "devotionRequired": {
        "english": "Devotion Required",
        "simplified_chinese": "需要虔诚度",
        "traditional_chinese": "需要虔誠度",
        "italian": "Devozione Richiesta",
        "spanish": "Devoción Requerida",
        "german": "Benötigte Hingabe",
        "polish": "Wymagane Oddanie",
        "french": "Dévotion Requise",
        "korean": "필요한 헌신도",
        "japanese": "必要な献身度",
        "russian": "Необходимая преданность"
    },
    "scaling": {
        "english": "Scaling",
        "simplified_chinese": "缩放",
        "traditional_chinese": "縮放",
        "italian": "Scala",
        "spanish": "Escala",
        "german": "Skalierung",
        "polish": "Skalowanie",
        "french": "Échelle",
        "korean": "스케일링",
        "japanese": "スケーリング",
        "russian": "Масштабирование"
    },

    "bonusResidents": {
        "simplified_chinese": "额外居民",
        "english": "Bonus Residents",
        "french": "Habitants supplémentaires",
        "german": "Zusätzliche Einwohner",
        //"guid": 22286,
        "italian": "Residenti bonus",
        "japanese": "ボーナス住民",
        "korean": "보너스 주민",
        "polish": "Dodatkowi mieszkańcy",
        "russian": "Дополнительное количество жителей",
        "spanish": "Bonificación de residentes",
        "traditional_chinese": "額外居民"
    },
    "bonusSupply": {
        "simplified_chinese": "额外供给",
        "english": "Bonus Supply",
        "french": "Bonus de ravitaillement",
        "german": "Zusatzversorgung",
        //"guid": 12315,
        "italian": "Bonus offerta",
        "japanese": "ボーナス供給",
        "korean": "보너스 제공",
        "polish": "Dodatkowe zaopatrzenie",
        "russian": "Дополнительное снабжение",
        "spanish": "Bonificación de suministros",
        "traditional_chinese": "額外供給"
    },
    "reduceConsumption": {
        "simplified_chinese": "降低消耗量",
        "english": "Reduce Consumption",
        "french": "Réduire la consommation",
        "german": "Verbrauch reduzieren",
        //"guid": 134956,
        "italian": "Riduci consumo",
        "japanese": "消費量を減らす",
        "korean": "소비 감소",
        "polish": "Zredukuj konsumpcję",
        "russian": "Снижение уровня потребления",
        "spanish": "Reducir consumo",
        "traditional_chinese": "降低消耗量"
    },


    "islands": {
        "english": "Islands",
        "simplified_chinese": "岛屿",
        "traditional_chinese": "島嶼",
        "italian": "Isole",
        "spanish": "Islas",
        "german": "Inseln",
        "polish": "Wyspy",
        "french": "Îles",
        "korean": "섬",
        "japanese": "島",
        "russian": "Острова"
    },
    "deleteAll": {
        "english": "Delete All",
        "simplified_chinese": "删除全部",
        "traditional_chinese": "刪除全部",
        "italian": "Cancella tutto",
        "spanish": "Borrar todo",
        "german": "Alles löschen",
        "polish": "Skasuj wszystko",
        "french": "Supprimer tout",
        "korean": "모두 삭제",
        "japanese": "すべて削除する",
        "russian": "Удалить все"
    },
    requiredNumberOfBuildings: {
        english: "Required Number of Buildings",
        french: "Nombre de bâtiments requis",
        polish: "Wymagana liczba budynków",
        spanish: "Número de edificios requeridos",
        italian: "Numero di edifici richiesti",
        german: "Benötigte Anzahl an Gebäuden",
        brazilian: "Número de edifícios necessários",
        russian: "Требуемое количество зданий",
        simplified_chinese: "所需建筑数量",
        traditional_chinese: "所需建築數量",
        japanese: "必要な建物の数",
        korean: "필요한 건물 수"
    },
    existingNumberOfBuildings: {
        english: "Existing Number of Buildings",
        french: "Nombre de bâtiments existants",
        polish: "Istniejąca liczba budynków",
        spanish: "Número de edificios existentes",
        italian: "Numero di edifici esistenti",
        german: "Vorhandene Anzahl an Gebäuden",
        brazilian: "Número de edifícios existentes",
        russian: "Существующее количество зданий",
        simplified_chinese: "现有建筑数量",
        traditional_chinese: "現有建築數量",
        japanese: "既存の建物の数",
        korean: "현재 건물 수"
    },
    existingNumberOfBuildingsIs: {
        english: "Is:",
        french: "Est :",
        polish: "Jest:",
        spanish: "Es:",
        italian: "È:",
        german: "Ist:",
        brazilian: "É:",
        russian: "Есть:",
        simplified_chinese: "现有：",
        traditional_chinese: "現有：",
        japanese: "現在：",
        korean: "현재:"
    },
    requiredNumberOfBuildingsShort: {
        english: "Required:",
        french: "Requis :",
        polish: "Wymagane:",
        spanish: "Requeridos:",
        italian: "Richiesti:",
        german: "Benötigt:",
        brazilian: "Necessários:",
        russian: "Требуется:",
        simplified_chinese: "所需：",
        traditional_chinese: "所需：",
        japanese: "必要：",
        korean: "필요:"
    },
    requiredNumberOfBuildingsDescription: {
        english: "Required number of buildings to produce consumer products",
        french: "Nombre de bâtiments requis pour produire des biens de consommation",
        polish: "Wymagana liczba budynków do produkcji dóbr konsumpcyjnych",
        spanish: "Número de edificios requeridos para producir bienes de consumo",
        italian: "Numero di edifici richiesti per produrre beni di consumo",
        german: "Benötigte Gebäudeanzahl zur Produktion von Verbrauchsgütern",
        brazilian: "Número de edifícios necessários para produzir bens de consumo",
        russian: "Требуемое количество зданий для производства потребительских товаров",
        simplified_chinese: "生产消费品所需的建筑数量",
        traditional_chinese: "生產消費品所需的建築數量",
        japanese: "消費財を生産するために必要な建物の数",
        korean: "소비재 생산에 필요한 건물 수"
    },
    tonsPerMinute: {
        "english": "Tons per minute (t/min)",
        "simplified_chinese": "每分钟吨数（吨／分钟）",
        "traditional_chinese": "每分鐘噸數（噸／分鐘）",
        "italian": "Tonnellate al minuto (t/min)",
        "spanish": "Toneladas por minuto (t/min)",
        "german": "Tonnen pro Minute (t/min)",
        "polish": "Tony na minutę (t/min)",
        "french": "Tonnes par minute (t/min)",
        "korean": "톤/분(1분당 톤 수)",
        "japanese": "トン毎分 (トン/分)",
        "russian": "Тонн в минуту (т./мин.)",
        "brazilian": "Toneladas por minuto (t/min)"
    },
    currentSupplier: {
        english: "Current:",
        french: "Actuel :",
        polish: "Bieżący:",
        spanish: "Actual:",
        italian: "Attuale:",
        german: "Aktuell:",
        brazilian: "Atual:",
        russian: "Текущий:",
        simplified_chinese: "当前：",
        traditional_chinese: "當前：",
        japanese: "現在：",
        korean: "현재:"
    },
    setAsDefault: {
        english: "Obtain goods from",
        french: "Obtenir des marchandises de",
        polish: "Uzyskaj towary od",
        spanish: "Obtener bienes de",
        italian: "Ottieni beni da",
        german: "Ware davon beziehen",
        brazilian: "Obter bens de",
        russian: "Получить товары от",
        simplified_chinese: "从此获取货物",
        traditional_chinese: "從此獲取貨物",
        japanese: "商品の入手元",
        korean: "상품 공급처"
    },
    capacityUtilisation: { // of a factory
        english: "Capacity utilisation",
        french: "Utilisation de la capacité",
        polish: "Wykorzystanie mocy produkcyjnych",
        spanish: "Utilización de capacidad",
        italian: "Utilizzo della capacità",
        german: "Auslastung",
        brazilian: "Utilização de capacidade",
        russian: "Использование мощности",
        simplified_chinese: "产能利用率",
        traditional_chinese: "產能利用率",
        japanese: "稼働率",
        korean: "가동률"
    },
    fullyUtilize: { // of a factory
        english: "fully utilise",
        french: "utiliser pleinement",
        polish: "w pełni wykorzystać",
        spanish: "utilizar completamente",
        italian: "utilizzare completamente",
        german: "voll auslasten",
        brazilian: "utilizar totalmente",
        russian: "полностью использовать",
        simplified_chinese: "全力生产",
        traditional_chinese: "全力生產",
        japanese: "完全稼働",
        korean: "전력 가동"
    },
    afterIslandCreation: {
        english: "After creation:",
        french: "Après création :",
        polish: "Po utworzeniu:",
        spanish: "Después de crear:",
        italian: "Dopo la creazione:",
        german: "Nach dem Erstellen:",
        brazilian: "Após criação:",
        russian: "После создания:",
        simplified_chinese: "创建后：",
        traditional_chinese: "創建後：",
        japanese: "作成後：",
        korean: "생성 후:"
    },
    showIslandOnCreation: {
        english: "Display island",
        french: "Afficher l'île",
        polish: "Wyświetl wyspę",
        spanish: "Mostrar isla",
        italian: "Mostra isola",
        german: "Insel anzeigen",
        brazilian: "Exibir ilha",
        russian: "Показать остров",
        simplified_chinese: "显示岛屿",
        traditional_chinese: "顯示島嶼",
        japanese: "島を表示",
        korean: "섬 표시"
    },
    "activateAllNeeds": {
        "english": "Activate all needs",
        "french": "Activer tous les besoins",
        "polish": "Aktywuj wszystkie potrzeby",
        "spanish": "Activar todas las necesidades",
        "italian": "Attiva tutti i bisogni",
        "german": "Alle Bedürfnisse aktivieren",
        "brazilian": "Ativar todas as necessidades",
        "russian": "Активировать все потребности",
        "simplified_chinese": "激活所有需求",
        "traditional_chinese": "激活所有需求",
        "japanese": "すべてのニーズを有効にする",
        "korean": "모든 요구 사항 활성화"

    },
    import: { // good is imported on this trade route
        english: "Import",
        french: "Importer",
        polish: "Importuj",
        spanish: "Importar",
        italian: "Importa",
        german: "Importieren",
        brazilian: "Importar",
        russian: "Импорт",
        simplified_chinese: "进口",
        traditional_chinese: "進口",
        japanese: "輸入",
        korean: "수입"
    },
    export: { // good is exported on this trade route
        english: "Export",
        french: "Exporter",
        polish: "Eksportuj",
        spanish: "Exportar",
        italian: "Esporta",
        german: "Exportieren",
        brazilian: "Exportar",
        russian: "Экспорт",
        simplified_chinese: "出口",
        traditional_chinese: "出口",
        japanese: "輸出",
        korean: "수출"
    },
    importDeficit: {
        english: "Import deficit",
        french: "Importer le déficit",
        polish: "Importuj deficyt",
        spanish: "Importar déficit",
        italian: "Importa deficit",
        german: "Defizit importieren",
        brazilian: "Importar déficit",
        russian: "Импортировать дефицит",
        simplified_chinese: "进口赤字",
        traditional_chinese: "進口赤字",
        japanese: "不足分をインポート",
        korean: "적자 수입"
    },
    exportOverproduction: {
        english: "Export overproduction",
        french: "Exporter la surproduction",
        polish: "Eksportuj nadprodukcję",
        spanish: "Exportar sobreproducción",
        italian: "Esporta sovrapproduzione",
        german: "Überproduktion exportieren",
        brazilian: "Exportar superprodução",
        russian: "Экспортировать перепроизводство",
        simplified_chinese: "出口过剩产品",
        traditional_chinese: "出口過剩產品",
        japanese: "過剰生産をエクスポート",
        korean: "과잉 생산 수출"
    },

    islandName: {
        english: "New island name",
        french: "Nom de la nouvelle île",
        polish: "Nazwa nowej wyspy",
        spanish: "Nombre de la nueva isla",
        italian: "Nome della nuova isola",
        german: "Neuer Inselname",
        brazilian: "Nome da nova ilha",
        russian: "Название нового острова",
        simplified_chinese: "新岛屿名称",
        traditional_chinese: "新島嶼名稱",
        japanese: "新しい島の名前",
        korean: "새로운 섬 이름"
    },
    selectedIsland: {
        english: "Selected Island",
        french: "Île sélectionnée",
        polish: "Wybrana wyspa",
        spanish: "Isla seleccionada",
        italian: "Isola selezionata",
        german: "Ausgewählte Insel",
        brazilian: "Ilha selecionada",
        russian: "Выбранный остров",
        simplified_chinese: "岛屿选择",
        traditional_chinese: "島嶼選擇",
        japanese: "選択された島",
        korean: "선택된 섬"
    },
    chooseFactories: {
        english: "Modify Production Chains",
        french: "Modifier les chaînes de production",
        polish: "Modyfikuj łańcuchy produkcyjne",
        spanish: "Modificar cadenas de producción",
        italian: "Modifica catene di produzione",
        german: "Modifiziere Produktionsketten",
        brazilian: "Modificar cadeias de produção",
        russian: "Изменить производственные цепочки",
        simplified_chinese: "修改生产链",
        traditional_chinese: "修改生產鏈",
        japanese: "生産チェーンを変更",
        korean: "생산 체인 수정"
    },
    noFixedFactory: {
        english: "Automatic: same region as consumer",
        french: "Automatique : même région que le consommateur",
        polish: "Automatycznie: ten sam region co konsument",
        spanish: "Automático: misma región que el consumidor",
        italian: "Automatico: stessa regione del consumatore",
        german: "Automatisch: gleichen Region wie Verbraucher",
        brazilian: "Automático: mesma região do consumidor",
        russian: "Автоматически: тот же регион, что и у потребителя",
        simplified_chinese: "自动：与消费者相同的地区",
        traditional_chinese: "自動：與消費者相同的地區",
        japanese: "自動：消費者と同じ地域",
        korean: "자동 : 소비자와 동일한 지역"
    },
    notes: {
        english: "Note",
        french: "Note",
        polish: "Notatka",
        spanish: "Nota",
        italian: "Nota",
        german: "Notizen",
        brazilian: "Nota",
        russian: "Заметка",
        simplified_chinese: "备注",
        traditional_chinese: "備註",
        japanese: "メモ",
        korean: "노트"
    },
    // view mode
    viewMode: {
        english: "View Mode",
        french: "Mode d'affichage",
        polish: "Tryb widoku",
        spanish: "Modo de vista",
        italian: "Modalità di visualizzazione",
        german: "Ansichtsmodus",
        brazilian: "Modo de visualização",
        russian: "Режим просмотра",
        simplified_chinese: "查看模式",
        traditional_chinese: "檢視模式",
        japanese: "表示モード",
        korean: "보기 모드"
    },
    viewStart: {
        english: "Start",
        french: "Démarrer",
        polish: "Start",
        spanish: "Comenzar",
        italian: "Inizio",
        german: "Starten",
        brazilian: "Começar",
        russian: "Начать",
        simplified_chinese: "开始",
        traditional_chinese: "開始",
        japanese: "スタート",
        korean: "시작"
    },
    viewPlan: {
        english: "Plan",
        french: "Planifier",
        polish: "Plan",
        spanish: "Planificar",
        italian: "Piano",
        german: "Planen",
        brazilian: "Planejar",
        russian: "План",
        simplified_chinese: "计划",
        traditional_chinese: "計劃",
        japanese: "プラン",
        korean: "계획"
    },
    viewMaster: {
        english: "Master",
        french: "Maître",
        polish: "Mistrz",
        spanish: "Maestro",
        italian: "Maestro",
        german: "Meistern",
        brazilian: "Mestre",
        russian: "Мастер",
        simplified_chinese: "大师",
        traditional_chinese: "大師",
        japanese: "マスター",
        korean: "마스터"
    },
    viewStartDescription: {
        english: "Start from scratch and progress through the resident tiers.",
        french: "Commencez de zéro et progressez à travers les niveaux de résidents.",
        polish: "Rozpocznij od zera i przejdź przez poziomy mieszkańców.",
        spanish: "Comienza desde cero y progresa a través de los niveles de residentes.",
        italian: "Inizia da zero e progredisci attraverso i livelli di residenti.",
        german: "Beginne von Vorne und schreite durch die Bevölkerungsstufen voran.",
        brazilian: "Comece do zero e progrida através dos níveis de residentes.",
        russian: "Начните с нуля и продвигайтесь через уровни жителей.",
        simplified_chinese: "从头开始并逐步提升居民等级。",
        traditional_chinese: "從頭開始並逐步提升居民等級。",
        japanese: "ゼロから始めて住民のレベルを進めていきます。",
        korean: "처음부터 시작하여 주민 단계를 진행하세요."
    },
    viewPlanDescription: {
        english: "The essential settings and DLCs are enabled to plan islands and huge cities.",
        french: "Les paramètres essentiels et les DLC sont activés pour planifier des îles et d'énormes cités.",
        polish: "Podstawowe ustawienia i DLC są włączone, aby planować wyspy i ogromne miasta.",
        spanish: "Las configuraciones esenciales y los DLC están habilitados para planificar islas y ciudades enormes.",
        italian: "Le impostazioni essenziali e i DLC sono abilitati per pianificare isole e città enormi.",
        german: "Die essentiellen Einstellungen und DLCs sind aktiviert, um Inseln und rießige Städte zu planen.",
        brazilian: "As configurações essenciais e DLCs estão habilitados para planejar ilhas e grandes cidades.",
        russian: "Основные настройки и DLC включены для планирования островов и огромных городов.",
        simplified_chinese: "启用了基本设置和DLC以规划岛屿和巨大城市。",
        traditional_chinese: "啟用了基本設定和DLC以規劃島嶼和巨大城市。",
        japanese: "島や巨大な都市を計画するために、必須の設定とDLCが有効になっています。",
        korean: "섬과 거대한 도시를 계획하기 위해 필수 설정과 DLC가 활성화되어 있습니다."
    },
    viewMasterDescription: {
        english: "All settings and DLCs are enabled.",
        french: "Tous les paramètres et DLC sont activés.",
        polish: "Wszystkie ustawienia i DLC są włączone.",
        spanish: "Todas las configuraciones y DLC están habilitados.",
        italian: "Tutte le impostazioni e i DLC sono abilitati.",
        german: "Alle Einstellungen und DLCs sind aktiviert.",
        brazilian: "Todas as configurações e DLCs estão habilitados.",
        russian: "Все настройки и DLC включены.",
        simplified_chinese: "所有设置和DLC均已启用。",
        traditional_chinese: "所有設定和DLC均已啟用。",
        japanese: "すべての設定とDLCが有効になっています。",
        korean: "모든 설정과 DLC가 활성화되어 있습니다."
    },

    // calculator and server management
    downloadConfig: {
        english: "Import / Export configuration.",
        french: "Importer / Exporter la configuration.",
        polish: "Importuj / Eksportuj konfigurację.",
        spanish: "Importar / Exportar configuración.",
        italian: "Importa / Esporta configurazione.",
        german: "Konfiguration importieren / exportieren.",
        brazilian: "Importar / Exportar configuração.",
        russian: "Импорт / Экспорт конфигурации.",
        simplified_chinese: "导入/导出配置。",
        traditional_chinese: "匯入/匯出配置。",
        japanese: "設定をインポート/エクスポート。",
        korean: "설정 가져오기 / 내보내기"
    },
    downloadCalculator: {
        english: "Download the calculator (source code of this website) to run it locally. To do so, extract the archive and double click index.html.",
        french: "Téléchargez le calculateur (code source de ce site) pour l'exécuter localement. Pour ce faire, extrayez l'archive et double-cliquez sur index.html.",
        polish: "Pobierz kalkulator (kod źródłowy tej witryny), aby uruchomić go lokalnie. W tym celu rozpakuj archiwum i kliknij dwukrotnie index.html.",
        spanish: "Descarga la calculadora (código fuente de este sitio web) para ejecutarla localmente. Para hacerlo, extrae el archivo y haz doble clic en index.html.",
        italian: "Scarica il calcolatore (codice sorgente di questo sito) per eseguirlo localmente. Per farlo, estrai l'archivio e fai doppio clic su index.html.",
        german: "Lade den Warenrechner (Quellcode dieser Seite) herunter, um ihn lokal auszuführen. Zum Ausführen, extrahiere das Archiv und doppelklicke auf index.html.",
        brazilian: "Baixe a calculadora (código-fonte deste site) para executá-la localmente. Para fazer isso, extraia o arquivo e clique duas vezes em index.html.",
        russian: "Загрузите калькулятор (исходный код этого сайта), чтобы запустить его локально. Для этого извлеките архив и дважды щелкните index.html.",
        simplified_chinese: "下载计算器（本网站的源代码）以在本地运行。为此，请解压存档并双击index.html。",
        traditional_chinese: "下載計算器（本網站的原始碼）以在本地執行。為此，請解壓縮檔案並雙擊index.html。",
        japanese: "計算機（このウェブサイトのソースコード）をダウンロードしてローカルで実行します。そのためには、アーカイブを解凍してindex.htmlをダブルクリックしてください。",
        korean: "Anno 계산기 (이 웹 사이트의 소스 코드)를 다운로드 하여 로컬로 실행 하십시오. 압축을 풀고 index.html 실행 하십시오."
    },
    calculatorUpdate: {
        english: "A new calculator version is available. Click the download button.",
        french: "Une nouvelle version du calculateur est disponible. Cliquez sur le bouton de téléchargement.",
        polish: "Dostępna jest nowa wersja kalkulatora. Kliknij przycisk pobierania.",
        spanish: "Hay una nueva versión de la calculadora disponible. Haga clic en el botón de descarga.",
        italian: "È disponibile una nuova versione del calcolatore. Fai clic sul pulsante di download.",
        german: "Eine neue Version des Warenrechners ist verfügbar. Klicke auf den Downloadbutton.",
        brazilian: "Uma nova versão da calculadora está disponível. Clique no botão de download.",
        russian: "Доступна новая версия калькулятора. Нажмите кнопку загрузки.",
        simplified_chinese: "新版本计算器已推出。点击下载按钮。",
        traditional_chinese: "新版本計算器已推出。點擊下載按鈕。",
        japanese: "新しいバージョンの計算機が利用可能です。ダウンロードボタンをクリックしてください。",
        korean: "새로운  117 계산기 버전이 제공됩니다. 다운로드 버튼을 클릭하십시오."
    },
    newFeature: {
        english: "Run factories at full capacity. Veneration effects are global.",
        french: "Faire tourner les usines à pleine capacité. Les effets de vénération sont globaux.",
        polish: "Uruchom fabryki na pełnych obrotach. Efekty czci są globalne.",
        spanish: "Ejecutar fábricas a plena capacidad. Los efectos de veneración son globales.",
        italian: "Eseguire le fabbriche a piena capacità. Gli effetti venerazione sono globali.",
        german: "Fabriken voll auslasten. Anbetungseffekte sind global.",
        brazilian: "Executar fábricas em capacidade total. Efeitos de veneração são globais.",
        russian: "Запускать фабрики на полную мощность. Эффекты поклонения глобальные.",
        simplified_chinese: "以满负荷运行工厂。敬神效果是全局的。",
        traditional_chinese: "以滿負荷運行工廠。崇敬效果是全域的。",
        japanese: "工場をフル稼働させる。崇拝の効果は世界規模です。",
        korean: "공장을 최대 용량으로 가동합니다. 숭배 효과는 전역입니다."
    }, 
    helpContent: {
        brazilian: `<h5>Uso e Estrutura</h5>
<p>Digite o número atual de residências por nível na linha superior. As cadeias de produção serão atualizadas automaticamente ao sair do campo de entrada. Apenas os bens necessários são exibidos.</p>
<p>A letra entre colchetes antes do nome do residente é a <b>tecla de atalho</b> para focar no campo de entrada. Lá, é possível usar as setas do teclado para aumentar ou diminuir o número.</p><br/>
<p>A linha abaixo exibe a <b>força de trabalho</b> necessária para operar todos os edifícios (arredondada para a próxima fábrica completa).</p><br/>
<p>Depois segue uma <b>visão geral dos bens necessários</b>. Clicando no título, cada seção pode ser recolhida.</p><br/>
<p>Cada cartão exibe o nome do bem, seu ícone, o número de edifícios construídos/necessários e a taxa de produção em toneladas por minuto. O número de edifícios tem, se ativado, duas casas decimais para mostrar diretamente a quantidade de capacidades excedentes. A parte inferior do cartão exibe a <b>produção da fábrica</b> (que é gerada no armazém de saída da fábrica mais bens excedentes).</p>
<p>Como os <b>materiais de construção</b> compartilham bens intermediários com consumíveis, eles são listados explicitamente (diferentemente dos calculadores de Annos anteriores) para planejar melhor a produção de minas. O número de fábricas deve ser inserido manualmente.</p><br/>

<h5>Configuração de População</h5>
<p>O botão no canto superior esquerdo dos níveis de população abre um menu dedicado. Os residentes são calculados automaticamente com base no número de residências, efeitos de consumo e necessidades atendidas.</p>
<p>As necessidades agrupadas por categoria estão abaixo dos residentes. A caixa de seleção ao lado do bem (des)bloqueia a necessidade. Clicar na caixa de seleção ao lado do título (des)marca toda a categoria. O ícone do mercado abre a visão geral da cadeia de produção.</p><br/>

<h5>Configurações Globais</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>Os botões à direita da barra de navegação servem para gerenciar a calculadora. Eles alternam o modo escuro, abrem configurações, mostram a ajuda ou abrem o diálogo de download. O idioma e a quantidade de informações exibidas podem ser ajustados nas configurações. Na <b>área de download</b> é possível importar e exportar a <b>configuração</b> (configurações, ilhas, produtividade, edifícios, ...). Além disso, esta calculadora pode ser baixada.</p><br/>

<h5>Diálogo de Configuração de Bens</h5>
<p>O botão no canto superior esquerdo da fábrica abre um menu mais detalhado. Lá, itens, edifícios, produtividade, módulos, efeitos e fornecimento de água podem ser aplicados ou inseridos. Ele lista apenas itens que alteram produtividade, bens de entrada ou força de trabalho e fornecem bens extras. Itens que não se enquadram em nenhuma das três categorias não são incluídos para maior clareza. Além disso, rotas comerciais e comerciantes são criados neste diálogo. O botão <b>Obter bens de</b> faz a fábrica produzir esse bem, ou importa o bem da ilha selecionada ou comerciante neutro (dependendo de qual você clicar).</p><br/>

<h5>Efeitos de Consumo, Cadeias de Produção e Itens de Bens Extras</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>Os botões estão à esquerda da barra de navegação.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>O diálogo de efeitos permite aplicar tecnologias pesquisadas (globalmente), Efeito de Patrono Exaltado (globalmente) e eventos (por sessão ou ilha).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>O diálogo de seleção de patrono permite aplicar o patrono e inserir a devoção. Ele exibe o bônus e fábricas afetadas.</p><br/>

<h5>Gerenciamento de Ilhas e Rotas Comerciais</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Ilha Selecionada</span> </div> <select name="islands" class="custom-select" ><option value="">Todas as Ilhas</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>Primeiro, é necessário abrir o <b>diálogo de gerenciamento de ilhas</b> clicando na engrenagem. Lá é possível criar novas ilhas. Depois de criar a primeira ilha, três novos elementos de controle aparecem no centro da barra de navegação: Trocar ilha, abrir gerenciamento de ilhas e abrir gerenciamento de rotas comerciais. Novas ilhas são associadas a uma <b>sessão</b>. A sessão influencia quais níveis de população, fábricas, itens e efeitos de consumo de bens aparecem. O botão <b>Deletar Tudo</b> reinicia a calculadora para seu estado inicial.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>Rotas comerciais são criadas</b> a partir do <b>diálogo de configuração de bens</b>. Existem dois tipos de rotas comerciais. O primeiro tipo são rotas para <b>comprar bens passivamente de comerciantes</b>. Clicando no botão <b>obter bens de</b> compra a demanda por esse bem de comerciantes. O segundo tipo são rotas para <b>transferir bens entre ilhas</b>. Como para bens extras, a demanda extra é aumentada de um lado e diminuída do outro. Ao abrir o diálogo de configuração de fábrica, a calculadora insere a <b>superprodução</b> no campo de entrada de quantidade para uma nova rota comercial. Quando a produção ou demanda da ilha mudam, botões aparecem ao lado de rotas comerciais adequadas que permitem adicionar a diferença. Um <span class="fa fa-exclamation-triangle " style="color:red"></span> em um campo de entrada sinaliza que a ilha de origem não produz o suficiente para suprir totalmente a rota comercial.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>O menu de rotas comerciais contém uma visão geral de todas as rotas comerciais, listadas na ordem de criação. É possível deletar rotas comerciais e ajustar sua carga lá.</p><br/>
<br/>

<h5>Aviso Legal</h5>
<p>A calculadora é fornecida sem garantia de qualquer tipo. O trabalho NÃO foi endossado pela Ubisoft Mainz de forma alguma. Todos os recursos do jogo Anno 117 são © da Ubisoft.</p><br/>
<p>Estes são especialmente, mas não exclusivamente, todos os ícones, designadores e valores de consumo.</p><br/>

<p>Este software está sob a licença MIT.</p><br/>

<h5>Autor</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Bugs e melhorias</h5>
<span>Se você encontrar algum bug ou inconveniência ou se quiser sugerir melhorias, junte-se ao servidor Discord (veja o link acima) ou abra uma Issue no GitHub (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,

        russian: `<h5>Использование и Структура</h5>
<p>Введите текущее количество резиденций для каждого уровня в верхнюю строку. Производственные цепочки автоматически обновятся, когда вы покинете поле ввода. Отображаются только необходимые товары.</p>
<p>Буква в квадратных скобках перед именем жителя — это <b>горячая клавиша</b> для фокусировки на поле ввода. Там можно использовать клавиши со стрелками для увеличения или уменьшения числа.</p><br/>
<p>Строка ниже отображает <b>рабочую силу</b>, необходимую для работы всех зданий (округлённую до следующей полной фабрики).</p><br/>
<p>Затем следует <b>обзор необходимых товаров</b>. Нажатие на заголовок сворачивает каждый раздел.</p><br/>
<p>Каждая карточка отображает название товара, его значок, количество построенных/необходимых зданий и скорость производства в тоннах в минуту. Количество зданий имеет, если активировано, два знака после запятой для прямого отображения объёма избыточных мощностей. Нижняя часть плитки отображает <b>производство фабрики</b> (которое генерируется на складе готовой продукции фабрики плюс избыточные товары).</p>
<p>Поскольку <b>строительные материалы</b> делят промежуточные товары с расходными материалами, они явно перечислены (в отличие от калькуляторов для предыдущих Anno), чтобы лучше планировать производство шахт. Количество фабрик должно быть введено вручную.</p><br/>

<h5>Настройка Населения</h5>
<p>Кнопка в верхнем левом углу уровней населения открывает специальное меню. Жители автоматически рассчитываются на основе количества резиденций, эффектов потребления и удовлетворённых потребностей.</p>
<p>Потребности, сгруппированные по категориям, находятся под жителями. Флажок рядом с товаром (раз)блокирует потребность. Нажатие на флажок рядом с заголовком (сни)мает галочку со всей категории. Значок рынка открывает обзор производственной цепочки.</p><br/>

<h5>Глобальные Настройки</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>Кнопки справа на панели навигации служат для управления калькулятором. Они переключают тёмный режим, открывают настройки, показывают справку или открывают диалог загрузки. Язык и количество отображаемой информации можно настроить в параметрах. В <b>области загрузки</b> можно импортировать и экспортировать <b>конфигурацию</b> (настройки, острова, производительность, здания, ...). Кроме того, этот калькулятор можно загрузить.</p><br/>

<h5>Диалог Конфигурации Товаров</h5>
<p>Кнопка в верхнем левом углу фабрики открывает более подробное меню. Там можно применить или ввести предметы, здания, производительность, модули, эффекты и водоснабжение. Он перечисляет только предметы, которые изменяют производительность, входящие товары или рабочую силу и предоставляют дополнительные товары. Предметы, которые не относятся ни к одной из трёх категорий, не включены для ясности. Кроме того, в этом диалоге создаются торговые маршруты и торговцы. Кнопка <b>Получить товары от</b> заставляет фабрику производить этот товар или импортирует товар с выбранного острова или от нейтрального торговца (в зависимости от того, на какой вы нажмёте).</p><br/>

<h5>Эффекты Потребления, Производственные Цепочки и Предметы Дополнительных Товаров</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>Кнопки находятся слева на панели навигации.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>Диалог эффектов позволяет применить исследованные технологии (глобально), Эффект Главного Покровителя (глобально) и события (по сессиям или островам).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>Диалог выбора покровителя позволяет применить покровителя и ввести почитание. Он отображает бонус и затронутые фабрики.</p><br/>

<h5>Управление Островами и Торговыми Маршрутами</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Выбранный Остров</span> </div> <select name="islands" class="custom-select" ><option value="">Все Острова</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>Сначала нужно открыть <b>диалог управления островами</b>, нажав на шестерёнку. Там можно создавать новые острова. После создания первого острова три новых элемента управления появляются в центре панели навигации: Переключить остров, открыть управление островами и открыть управление торговыми маршрутами. Новые острова связаны с <b>сессией</b>. Сессия влияет на то, какие уровни населения, фабрики, предметы и эффекты потребления товаров отображаются. Кнопка <b>Удалить Всё</b> сбрасывает калькулятор в исходное состояние.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>Торговые маршруты создаются</b> из <b>диалога конфигурации товаров</b>. Существует два вида торговых маршрутов. Первый вид — это маршруты для <b>пассивной покупки товаров у торговцев</b>. Нажатие кнопки <b>получить товары от</b> покупает спрос на этот товар у торговцев. Второй вид — это маршруты для <b>передачи товаров между островами</b>. Как и для дополнительных товаров, дополнительный спрос увеличивается с одной стороны и уменьшается с другой. При открытии диалога конфигурации фабрики калькулятор вводит <b>перепроизводство</b> в поле ввода количества для нового торгового маршрута. Когда производство или спрос острова изменяются, рядом с подходящими торговыми маршрутами появляются кнопки, позволяющие добавить разницу. <span class="fa fa-exclamation-triangle " style="color:red"></span> в поле ввода сигнализирует, что исходный остров производит недостаточно, чтобы полностью обеспечить торговый маршрут.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>Меню торговых маршрутов содержит обзор всех торговых маршрутов, перечисленных в порядке создания. Там можно удалять торговые маршруты и корректировать их нагрузку.</p><br/>
<br/>

<h5>Отказ от ответственности</h5>
<p>Калькулятор предоставляется без каких-либо гарантий. Работа НЕ была одобрена Ubisoft Mainz каким-либо образом. Все ресурсы из игры Anno 117 © Ubisoft.</p><br/>
<p>Это особенно, но не исключительно, все значки, обозначения и значения потребления.</p><br/>

<p>Это программное обеспечение распространяется под лицензией MIT.</p><br/>

<h5>Автор</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Ошибки и улучшения</h5>
<span>Если вы столкнулись с какими-либо ошибками или неудобствами или если вы хотите предложить улучшения, присоединяйтесь к серверу Discord (см. ссылку выше) или откройте Issue на GitHub (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,

        polish: `<h5>Użytkowanie i Struktura</h5>
<p>Wprowadź obecną liczbę rezydencji dla każdego poziomu w górnym wierszu. Łańcuchy produkcyjne zostaną automatycznie zaktualizowane po opuszczeniu pola wprowadzania. Wyświetlane są tylko wymagane towary.</p>
<p>Litera w nawiasach kwadratowych przed nazwą mieszkańca to <b>klawisz skrótu</b> do ustawienia fokusa w polu wprowadzania. Tam można używać klawiszy strzałek do zwiększania lub zmniejszania liczby.</p><br/>
<p>Wiersz poniżej wyświetla <b>siłę roboczą</b> wymaganą do obsługi wszystkich budynków (zaokrągloną w górę do następnej kompletnej fabryki).</p><br/>
<p>Następnie znajduje się <b>przegląd wymaganych towarów</b>. Kliknięcie nagłówka zwija każdą sekcję.</p><br/>
<p>Każda karta wyświetla nazwę towaru, jego ikonę, liczbę zbudowanych/wymaganych budynków oraz tempo produkcji w tonach na minutę. Liczba budynków ma, jeśli jest aktywowana, dwa miejsca dziesiętne, aby bezpośrednio pokazać ilość nadwyżek mocy produkcyjnych. Dół kafelka wyświetla <b>produkcję fabryki</b> (która jest generowana w magazynie wyjściowym fabryki plus nadwyżka towarów).</p>
<p>Ponieważ <b>materiały budowlane</b> dzielą towary pośrednie z materiałami eksploatacyjnymi, są one wyraźnie wymienione (w przeciwieństwie do kalkulatorów dla poprzednich Anno), aby lepiej zaplanować produkcję kopalni. Liczba fabryk musi być wprowadzona ręcznie.</p><br/>

<h5>Konfiguracja Populacji</h5>
<p>Przycisk w lewym górnym rogu poziomów populacji otwiera dedykowane menu. Mieszkańcy są automatycznie obliczani na podstawie liczby rezydencji, efektów konsumpcji i dostarczonych potrzeb.</p>
<p>Potrzeby pogrupowane według kategorii znajdują się poniżej mieszkańców. Pole wyboru obok towaru (od)blokuje potrzebę. Kliknięcie pola wyboru obok nagłówka (od)zaznacza całą kategorię. Ikona rynku otwiera przegląd łańcucha produkcyjnego.</p><br/>

<h5>Ustawienia Globalne</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>Przyciski po prawej stronie paska nawigacji służą do zarządzania kalkulatorem. Przełączają tryb ciemny, otwierają ustawienia, pokazują pomoc lub otwierają okno pobierania. Język i ilość wyświetlanych informacji można dostosować w ustawieniach. W <b>obszarze pobierania</b> można importować i eksportować <b>konfigurację</b> (ustawienia, wyspy, produktywność, budynki, ...). Ponadto kalkulator można pobrać.</p><br/>

<h5>Okno Konfiguracji Towarów</h5>
<p>Przycisk w lewym górnym rogu fabryki otwiera bardziej szczegółowe menu. Tam można zastosować lub wprowadzić przedmioty, budynki, produktywność, moduły, efekty i zaopatrzenie w wodę. Wymienia tylko przedmioty, które zmieniają produktywność, towary wejściowe lub siłę roboczą i zapewniają dodatkowe towary. Przedmioty, które nie należą do żadnej z trzech kategorii, nie są uwzględnione dla przejrzystości. Oprócz tego w tym oknie tworzone są trasy handlowe i kupcy. Przycisk <b>Uzyskaj towary od</b> sprawia, że fabryka produkuje ten towar lub importuje towar z wybranej wyspy lub neutralnego kupca (w zależności od tego, który klikniesz).</p><br/>

<h5>Efekty Konsumpcji, Łańcuchy Produkcyjne i Przedmioty Dodatkowych Towarów</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>Przyciski znajdują się po lewej stronie paska nawigacji.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>Okno efektów pozwala zastosować zbadane technologie (globalnie), Efekt Podniosłego Patrona (globalnie) oraz wydarzenia (na sesję lub wyspę).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>Okno wyboru patrona pozwala zastosować patrona i wprowadzić oddanie. Wyświetla bonus i dotknięte fabryki.</p><br/>

<h5>Zarządzanie Wyspami i Trasami Handlowymi</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Wybrana Wyspa</span> </div> <select name="islands" class="custom-select" ><option value="">Wszystkie Wyspy</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>Najpierw należy otworzyć <b>okno zarządzania wyspami</b>, klikając koło zębate. Tam można tworzyć nowe wyspy. Po utworzeniu pierwszej wyspy, trzy nowe elementy sterujące pojawiają się na środku paska nawigacji: Przełącz wyspę, otwórz zarządzanie wyspami i otwórz zarządzanie trasami handlowymi. Nowe wyspy są powiązane z <b>sesją</b>. Sesja wpływa na to, które poziomy populacji, fabryki, przedmioty i efekty konsumpcji towarów się pojawiają. Przycisk <b>Usuń Wszystko</b> resetuje kalkulator do stanu początkowego.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>Trasy handlowe są tworzone</b> z <b>okna konfiguracji towarów</b>. Istnieją dwa rodzaje tras handlowych. Pierwszy rodzaj to trasy do <b>pasywnego zakupu towarów od kupców</b>. Kliknięcie przycisku <b>uzyskaj towary od</b> kupuje popyt na ten towar od kupców. Drugi rodzaj to trasy do <b>transferu towarów między wyspami</b>. Podobnie jak w przypadku dodatkowych towarów, dodatkowy popyt jest zwiększany po jednej stronie i zmniejszany po drugiej. Podczas otwierania okna konfiguracji fabryki, kalkulator wprowadza <b>nadprodukcję</b> do pola wprowadzania ilości dla nowej trasy handlowej. Gdy produkcja lub popyt wyspy się zmienią, przyciski pojawiają się obok odpowiednich tras handlowych, które pozwalają dodać różnicę. <span class="fa fa-exclamation-triangle " style="color:red"></span> przy polu wprowadzania sygnalizuje, że wyspa źródłowa nie produkuje wystarczająco dużo, aby w pełni zaopatrzyć trasę handlową.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>Menu tras handlowych zawiera przegląd wszystkich tras handlowych, wymienionych w kolejności tworzenia. Tam można usuwać trasy handlowe i dostosowywać ich ładunek.</p><br/>
<br/>

<h5>Zastrzeżenie</h5>
<p>Kalkulator jest dostarczany bez żadnej gwarancji. Praca NIE została zatwierdzona przez Ubisoft Mainz w żaden sposób. Wszystkie zasoby z gry Anno 117 są © przez Ubisoft.</p><br/>
<p>Są to szczególnie, ale nie wyłącznie, wszystkie ikony, oznaczenia i wartości konsumpcji.</p><br/>

<p>To oprogramowanie jest objęte licencją MIT.</p><br/>

<h5>Autor</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Błędy i ulepszenia</h5>
<span>Jeśli napotkasz jakiekolwiek błędy lub niedogodności lub jeśli chcesz zasugerować ulepszenia, dołącz do serwera Discord (zobacz link powyżej) lub otwórz Issue na GitHubie (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,

        korean: `<h5>사용법 및 구조</h5>
<p>최상단 행에 레벨별 거주지의 현재 수를 입력하세요. 입력 필드를 벗어나면 생산 체인이 자동으로 업데이트됩니다. 필요한 물품만 표시됩니다.</p>
<p>주민 이름 앞의 대괄호 안에 있는 문자는 입력 필드에 포커스를 맞추기 위한 <b>단축키</b>입니다. 화살표 키를 사용하여 숫자를 증가 또는 감소시킬 수 있습니다.</p><br/>
<p>아래 행에는 모든 건물을 운영하는 데 필요한 <b>노동력</b>이 표시됩니다(다음 완전한 공장으로 올림).</p><br/>
<p>그 다음에는 <b>필요한 물품 개요</b>가 표시됩니다. 제목을 클릭하면 각 섹션이 접힙니다.</p><br/>
<p>각 카드에는 물품 이름, 아이콘, 건설된/필요한 건물 수, 분당 톤 단위의 생산율이 표시됩니다. 건물 수는 활성화된 경우 소수점 두 자리로 표시되어 초과 생산 능력을 직접 보여줍니다. 타일 하단에는 공장의 <b>생산량</b>(공장 출력 저장소에서 생성된 것과 초과 물품)이 표시됩니다.</p>
<p><b>건설 자재</b>는 소비재와 중간 물품을 공유하므로 광산 생산을 더 잘 계획하기 위해 명시적으로 나열됩니다(이전 Anno 계산기와 달리). 공장 수는 수동으로 입력해야 합니다.</p><br/>

<h5>인구 구성</h5>
<p>인구 레벨 왼쪽 상단의 버튼은 전용 메뉴를 엽니다. 주민은 거주지 수, 소비 효과 및 제공된 요구 사항에 따라 자동으로 계산됩니다.</p>
<p>카테고리별로 그룹화된 요구 사항은 주민 아래에 있습니다. 물품 옆의 확인란은 요구 사항을 잠금 해제하거나 잠급니다. 제목 옆의 확인란을 클릭하면 전체 카테고리가 선택 또는 선택 취소됩니다. 시장 아이콘은 생산 체인 개요를 엽니다.</p><br/>

<h5>전역 설정</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>탐색 모음 오른쪽의 버튼은 계산기 관리에 사용됩니다. 다크 모드 전환, 설정 열기, 도움말 표시 또는 다운로드 대화 상자를 엽니다. 설정에서 언어와 표시되는 정보의 양을 조정할 수 있습니다. <b>다운로드 영역</b>에서 <b>구성</b>(설정, 섬, 생산성, 건물 등)을 가져오고 내보낼 수 있습니다. 또한 이 계산기를 다운로드할 수 있습니다.</p><br/>

<h5>물품 구성 대화 상자</h5>
<p>공장 왼쪽 상단의 버튼은 더 자세한 메뉴를 엽니다. 여기에서 아이템, 건물, 생산성, 모듈, 효과 및 물 공급을 적용하거나 입력할 수 있습니다. 생산성, 입력 물품 또는 노동력을 변경하고 추가 물품을 제공하는 아이템만 나열됩니다. 세 가지 카테고리에 해당하지 않는 아이템은 명확성을 위해 포함되지 않습니다. 또한 이 대화 상자에서 무역로와 상인이 생성됩니다. <b>물품 공급처</b> 버튼은 공장이 해당 물품을 생산하도록 하거나 선택한 섬 또는 중립 상인에서 물품을 수입합니다(클릭한 항목에 따라 다름).</p><br/>

<h5>소비 효과, 생산 체인 및 추가 물품 아이템</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>버튼은 탐색 모음 왼쪽에 있습니다.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>효과 대화 상자에서 연구된 기술(전역), 고귀한 수호신 효과(전역) 및 이벤트(세션 또는 섬별)를 적용할 수 있습니다.</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>수호신 선택 대화 상자에서 수호신을 적용하고 헌신도를 입력할 수 있습니다. 보너스와 영향을 받는 공장이 표시됩니다.</p><br/>

<h5>섬 및 무역로 관리</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >선택된 섬</span> </div> <select name="islands" class="custom-select" ><option value="">모든 섬</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>먼저 톱니바퀴를 클릭하여 <b>섬 관리 대화 상자</b>를 열어야 합니다. 거기에서 새 섬을 만들 수 있습니다. 첫 번째 섬을 만든 후 탐색 모음 중앙에 세 개의 새로운 제어 요소가 나타납니다: 섬 전환, 섬 관리 열기, 무역로 관리 열기. 새 섬은 <b>세션</b>과 연결됩니다. 세션은 어떤 인구 레벨, 공장, 아이템 및 물품 소비 효과가 표시되는지에 영향을 줍니다. <b>모두 삭제</b> 버튼은 계산기를 초기 상태로 재설정합니다.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>무역로는</b> <b>물품 구성 대화 상자</b>에서 <b>생성됩니다</b>. 무역로에는 두 가지 유형이 있습니다. 첫 번째 유형은 <b>상인으로부터 물품을 수동적으로 구매하는</b> 경로입니다. <b>물품 공급처</b> 버튼을 클릭하면 상인으로부터 이 물품에 대한 수요를 구매합니다. 두 번째 유형은 <b>섬 간에 물품을 전송하는</b> 경로입니다. 추가 물품과 마찬가지로 추가 수요는 한쪽에서 증가하고 다른 쪽에서 감소합니다. 공장 구성 대화 상자를 열면 계산기는 새 무역로의 수량 입력 필드에 <b>초과 생산</b>을 입력합니다. 생산 또는 섬 수요가 변경되면 적절한 무역로 옆에 버튼이 나타나 차이를 추가할 수 있습니다. 입력 필드의 <span class="fa fa-exclamation-triangle " style="color:red"></span>는 원천 섬이 무역로를 완전히 공급하기에 충분하게 생산하지 못함을 나타냅니다.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>무역로 메뉴에는 생성 순서대로 나열된 모든 무역로의 개요가 포함되어 있습니다. 거기에서 무역로를 삭제하고 화물을 조정할 수 있습니다.</p><br/>
<br/>

<h5>면책 조항</h5>
<p>계산기는 어떠한 종류의 보증도 없이 제공됩니다. 이 작업은 어떤 방식으로도 Ubisoft Mainz의 승인을 받지 않았습니다. Anno 117 게임의 모든 자산은 © Ubisoft입니다.</p><br/>
<p>여기에는 특히 모든 아이콘, 지정자 및 소비 값이 포함되지만 이에 국한되지 않습니다.</p><br/>

<p>이 소프트웨어는 MIT 라이선스를 따릅니다.</p><br/>

<h5>저자</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>버그 및 개선 사항</h5>
<span>버그나 불편함을 발견하거나 개선 사항을 제안하고 싶다면 Discord 서버에 가입하거나(위 링크 참조) GitHub에서 Issue를 여십시오(</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,

        japanese: `<h5>使用方法と構造</h5>
<p>最上段に各レベルの住居の現在の数を入力してください。入力フィールドから離れると、生産チェーンが自動的に更新されます。必要な品物のみが表示されます。</p>
<p>住民名の前の角括弧内の文字は、入力フィールドにフォーカスするための<b>ホットキー</b>です。そこで矢印キーを使用して数値を増減できます。</p><br/>
<p>下の行には、すべての建物を稼働させるために必要な<b>労働力</b>が表示されます（次の完全な工場に切り上げられます）。</p><br/>
<p>その後、<b>必要な品物の概要</b>が続きます。見出しをクリックすると、各セクションを折りたたむことができます。</p><br/>
<p>各カードには、品物の名前、そのアイコン、建設済み/必要な建物の数、および毎分トン単位の生産率が表示されます。建物の数は、有効にすると小数点以下2桁で表示され、過剰能力の量を直接示します。タイルの下部には、工場の<b>生産量</b>（工場の出力倉庫で生成されたものと余剰品物）が表示されます。</p>
<p><b>建設資材</b>は消耗品と中間品物を共有するため、鉱山の生産をより適切に計画するために明示的にリストされています（以前のAnnoの計算機とは異なります）。工場の数は手動で入力する必要があります。</p><br/>

<h5>人口設定</h5>
<p>人口レベルの左上のボタンは、専用メニューを開きます。住民は、住居の数、消費効果、および供給された需要に基づいて自動的に計算されます。</p>
<p>カテゴリごとにグループ化された需要は、住民の下にあります。品物の横のチェックボックスで需要の（ロック解除）ロックが行われます。見出しの横のチェックボックスをクリックすると、カテゴリ全体が（チェック解除）チェックされます。市場アイコンは生産チェーンの概要を開きます。</p><br/>

<h5>グローバル設定</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>ナビゲーションバーの右側のボタンは、計算機の管理に使用されます。ダークモードの切り替え、設定を開く、ヘルプの表示、またはダウンロードダイアログを開きます。設定で言語と表示される情報の量を調整できます。<b>ダウンロードエリア</b>では、<b>設定</b>（設定、島、生産性、建物など）をインポートおよびエクスポートできます。さらに、この計算機をダウンロードできます。</p><br/>

<h5>品物設定ダイアログ</h5>
<p>工場の左上のボタンは、より詳細なメニューを開きます。そこで、アイテム、建物、生産性、モジュール、効果、および給水を適用または入力できます。生産性、入力品物、または労働力を変更し、追加品物を提供するアイテムのみがリストされます。3つのカテゴリのいずれにも該当しないアイテムは、明確性のために含まれていません。さらに、このダイアログで貿易ルートと商人が作成されます。<b>品物の入手元</b>ボタンは、工場にその品物を生産させるか、選択した島または中立商人から品物をインポートします（クリックした方によって異なります）。</p><br/>

<h5>消費効果、生産チェーン、追加品物アイテム</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>ボタンはナビゲーションバーの左側にあります。</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>効果ダイアログでは、研究された技術（グローバル）、高位祭神の効果（グローバル）、およびイベント（セッションまたは島ごと）を適用できます。</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>祭神選択ダイアログでは、祭神を適用し、信心を入力できます。ボーナスと影響を受ける工場が表示されます。</p><br/>

<h5>島と貿易ルートの管理</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >選択された島</span> </div> <select name="islands" class="custom-select" ><option value="">すべての島</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>まず、歯車をクリックして<b>島管理ダイアログ</b>を開く必要があります。そこで新しい島を作成できます。最初の島を作成すると、ナビゲーションバーの中央に3つの新しいコントロール要素が表示されます：島の切り替え、島管理を開く、貿易ルート管理を開く。新しい島は<b>セッション</b>に関連付けられます。セッションは、どの人口レベル、工場、アイテム、および品物消費効果が表示されるかに影響します。<b>すべて削除</b>ボタンは、計算機を初期状態にリセットします。</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>貿易ルートは</b><b>品物設定ダイアログ</b>から<b>作成されます</b>。貿易ルートには2種類あります。最初のタイプは、<b>商人から品物を受動的に購入する</b>ルートです。<b>品物の入手元</b>ボタンをクリックすると、商人からこの品物の需要が購入されます。2番目のタイプは、<b>島間で品物を転送する</b>ルートです。追加品物と同様に、追加需要は一方で増加し、他方で減少します。工場設定ダイアログを開くと、計算機は新しい貿易ルートの数量入力フィールドに<b>過剰生産</b>を入力します。生産または島の需要が変化すると、適切な貿易ルートの横にボタンが表示され、差分を追加できます。入力フィールドの<span class="fa fa-exclamation-triangle " style="color:red"></span>は、供給元の島が貿易ルートを完全に供給するのに十分な生産をしていないことを示します。</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>貿易ルートメニューには、作成順にリストされたすべての貿易ルートの概要が含まれています。そこで貿易ルートを削除し、その負荷を調整できます。</p><br/>
<br/>

<h5>免責事項</h5>
<p>計算機は、いかなる種類の保証もなく提供されます。この作品は、いかなる形でもUbisoft Mainzによって承認されていません。Anno 117ゲームのすべてのアセットは、©Ubisoftです。</p><br/>
<p>これらは特に、すべてのアイコン、指定子、および消費値を含みますが、これらに限定されません。</p><br/>

<p>このソフトウェアはMITライセンスの下にあります。</p><br/>

<h5>著者</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>バグと改善</h5>
<span>バグや不便な点に遭遇した場合、または改善を提案したい場合は、Discordサーバーに参加する（上記のリンクを参照）か、GitHubでIssueを開いてください（</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>）</span>`,

        italian: `<h5>Uso e Struttura</h5>
<p>Inserisci il numero attuale di residenze per livello nella riga superiore. Le catene di produzione si aggiorneranno automaticamente quando si lascia il campo di input. Vengono visualizzati solo i beni richiesti.</p>
<p>La lettera tra parentesi quadre prima del nome del residente è il <b>tasto di scelta rapida</b> per mettere a fuoco il campo di input. Lì, puoi usare i tasti freccia per aumentare o diminuire il numero.</p><br/>
<p>La riga sottostante mostra la <b>forza lavoro</b> necessaria per gestire tutti gli edifici (arrotondata alla fabbrica completa successiva).</p><br/>
<p>Successivamente segue una <b>panoramica dei beni richiesti</b>. Cliccando sul titolo, ogni sezione può essere compressa.</p><br/>
<p>Ogni scheda mostra il nome del bene, la sua icona, il numero di edifici costruiti/richiesti e il tasso di produzione in tonnellate al minuto. Il numero di edifici ha, se attivato, due cifre decimali per mostrare direttamente la quantità di capacità in eccesso. La parte inferiore della scheda mostra la <b>produzione della fabbrica</b> (che viene generata nello stoccaggio di uscita della fabbrica più i beni in eccesso).</p>
<p>Poiché i <b>materiali da costruzione</b> condividono beni intermedi con i consumabili, sono elencati esplicitamente (a differenza dei calcolatori per i precedenti Anno) per pianificare meglio la produzione delle miniere. Il numero di fabbriche deve essere inserito manualmente.</p><br/>

<h5>Configurazione della Popolazione</h5>
<p>Il pulsante in alto a sinistra dei livelli di popolazione apre un menu dedicato. I residenti vengono calcolati automaticamente in base al numero di residenze, agli effetti di consumo e ai bisogni forniti.</p>
<p>I bisogni raggruppati per categoria si trovano sotto i residenti. La casella di controllo accanto al bene (s)blocca il bisogno. Cliccando sulla casella di controllo accanto al titolo si (de)seleziona l'intera categoria. L'icona del mercato apre la panoramica della catena di produzione.</p><br/>

<h5>Impostazioni Globali</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>I pulsanti a destra della barra di navigazione servono per gestire il calcolatore. Attivano la modalità scura, aprono le impostazioni, mostrano l'aiuto o aprono la finestra di download. La lingua e la quantità di informazioni visualizzate possono essere regolate nelle impostazioni. Nell'<b>area di download</b> è possibile importare ed esportare la <b>configurazione</b> (impostazioni, isole, produttività, edifici, ...). Inoltre, questo calcolatore può essere scaricato.</p><br/>

<h5>Finestra di Configurazione Beni</h5>
<p>Il pulsante in alto a sinistra della fabbrica apre un menu più dettagliato. Lì, oggetti, edifici, produttività, moduli, effetti e approvvigionamento idrico possono essere applicati o inseriti. Elenca solo gli oggetti che modificano la produttività, i beni in ingresso o la forza lavoro e forniscono beni extra. Gli oggetti che non rientrano in nessuna delle tre categorie non sono inclusi per chiarezza. Inoltre, le rotte commerciali e i mercanti vengono creati in questa finestra. Il pulsante <b>Ottieni beni da</b> fa produrre quel bene alla fabbrica, o importa il bene dall'isola selezionata o dal mercante neutrale (a seconda di quale si clicca).</p><br/>

<h5>Effetti di Consumo, Catene di Produzione e Oggetti Beni Extra</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>I pulsanti si trovano a sinistra della barra di navigazione.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>La finestra degli effetti consente di applicare tecnologie ricercate (globalmente), Effetto Divinità Eccelsa (globalmente) ed eventi (per sessione o isola).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>La finestra di selezione della divinità protettrice consente di applicare la divinità protettrice e inserire la devozione. Mostra il bonus e le fabbriche interessate.</p><br/>

<h5>Gestione Isole e Rotte Commerciali</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Isola Selezionata</span> </div> <select name="islands" class="custom-select" ><option value="">Tutte le Isole</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>Per prima cosa, è necessario aprire la <b>finestra di gestione isole</b> cliccando sull'ingranaggio. Lì è possibile creare nuove isole. Dopo aver creato la prima isola, tre nuovi elementi di controllo appaiono al centro della barra di navigazione: Cambia isola, apri gestione isole e apri gestione rotte commerciali. Le nuove isole sono associate a una <b>sessione</b>. La sessione influenza quali livelli di popolazione, fabbriche, oggetti ed effetti di consumo beni appaiono. Il pulsante <b>Elimina Tutto</b> ripristina il calcolatore al suo stato iniziale.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>Le rotte commerciali vengono create</b> dalla <b>finestra di configurazione beni</b>. Esistono due tipi di rotte commerciali. Il primo tipo sono le rotte per <b>acquistare beni passivamente dai mercanti</b>. Cliccando il pulsante <b>ottieni beni da</b> si acquista la domanda per questo bene dai mercanti. Il secondo tipo sono le rotte per <b>trasferire beni tra isole</b>. Come per i beni extra, la domanda extra è aumentata da un lato e diminuita dall'altro. Quando si apre la finestra di configurazione della fabbrica, il calcolatore inserisce la <b>sovrapproduzione</b> nel campo di input della quantità per una nuova rotta commerciale. Quando la produzione o la domanda dell'isola cambiano, compaiono pulsanti accanto alle rotte commerciali appropriate che permettono di aggiungere la differenza. Un <span class="fa fa-exclamation-triangle " style="color:red"></span> su un campo di input segnala che l'isola di origine non produce abbastanza per rifornire completamente la rotta commerciale.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>Il menu delle rotte commerciali contiene una panoramica di tutte le rotte commerciali, elencate nell'ordine di creazione. È possibile eliminare le rotte commerciali e regolare il loro carico lì.</p><br/>
<br/>

<h5>Disclaimer</h5>
<p>Il calcolatore è fornito senza garanzia di alcun tipo. Il lavoro NON è stato approvato da Ubisoft Mainz in alcun modo. Tutti gli asset dal gioco Anno 117 sono © di Ubisoft.</p><br/>
<p>Questi sono in particolare ma non esclusivamente tutte le icone, designatori e valori di consumo.</p><br/>

<p>Questo software è sotto licenza MIT.</p><br/>

<h5>Autore</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Bug e miglioramenti</h5>
<span>Se si verificano bug o inconvenienti o se si desidera suggerire miglioramenti, unisciti al server Discord (vedi link sopra) o apri una Issue su GitHub (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,

        german:
            `<h5>Verwendung und Aufbau</h5>
<p>Trage die aktuelle Anzahl der Wohnhäuser pro Stufe in die oberste Reihe ein. Die Produktionsketten aktualisieren sich automatisch, sobald man das Eingabefeld verlässt. Es werden nur die benötigten Waren angezeigt.</p>
<p>Der Buchstabe in eckigen Klammern vor dem Einwohnernamen ist der <b>Hotkey</b> zum Fokussieren des Eingabefeldes. Dort kann man mit den Pfeiltasten die Anzahl erhöhen oder verringern.</p><br/>
<p>Die Reihe darunter zeigt die <b>Arbeitskraft</b>, die zum Betrieb aller Gebäude benötigt wird (aufgerundet auf die nächste vollständige Fabrik).</p><br/>
<p>Danach folgt eine <b>Übersicht der benötigten Waren</b>. Durch Klick auf die Überschrift kann jeder Abschnitt zusammengeklappt werden.</p><br/>
<p>Jede Kachel zeigt den Namen des Ware, ihr Icon, die Anzahl der gebauten / benötigten Gebäude und die Produktionsrate in Tonnen pro Minute. Die Anzahl der Gebäude hat, wenn aktiviert, zwei Dezimalstellen, um direkt die Menge der Überkapazitäten anzuzeigen. Am unteren Rand der Kachel wird der (benötigte) <b>Output der Fabrik</b> angezeigt (was im Ausgangslager der Fabrik erzeugt wird plus Überschuss).</p>
<p>Da <b>Baumaterialien</b> Zwischenprodukte mit Konsumgütern teilen, werden sie explizit aufgeführt (im Gegensatz zu Rechnern für frühere Anno-Teile), um die Produktion von Minen besser planen zu können. Die Anzahl der Fabriken muss manuell eingegeben werden.</p><br/>

<h5>Bevölkerungskonfiguration</h5>
<p>Der Button oben links bei den Bevölkerungsstufen öffnet ein separates Menü. Die Einwohner werden automatisch basierend auf der Anzahl der Wohnhäuser, Verbrauchseffekten und versorgten Bedürfnissen berechnet.</p>
<p>Die nach Kategorie gruppierten Bedürfnisse befinden sich unterhalb der Einwohner. Das Kontrollkästchen neben der Ware (ent-)sperrt das Bedürfnis. Durch Klick auf das Kontrollkästchen neben der Überschrift wird die gesamte Kategorie aktiviert oder deaktiviert. Das Marktplatz-Symbol öffnet die Produktionskettenübersicht.</p><br/>

<h5>Globale Einstellungen</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>Die Buttons rechts in der Navigationsleiste dienen der Verwaltung des Rechners. Sie schalten den Dark-Mode um, öffnen die Einstellungen, zeigen die Hilfe oder öffnen den Download-Dialog. In den Einstellungen können Sprache und die Menge der angezeigten Informationen angepasst werden. Im <b>Downloadbereich</b> kann die <b>Konfiguration</b> (Einstellungen, Inseln, Produktivität, Gebäude, ...) importiert und exportiert werden. Außerdem kann dieser Rechner heruntergeladen werden.</p><br/>

<h5>Warenkonfigurationsdialog</h5>
<p>Der Button oben links bei der Ware öffnet ein detaillierteres Menü. Dort können Items, Gebäude, Produktivität, Module, Effekte und Wasserversorgung angewendet oder eingegeben werden. Es werden nur Items aufgeführt, die Produktivität, Eingangswaren oder Arbeitskraft verändern oder Zusatzwaren bereitstellen. Items, die in keine der drei Kategorien fallen, sind der Übersichtlichkeit halber nicht enthalten. Außerdem werden in diesem Dialog Handelsrouten und Händler erstellt. Der Button <b>Ware davon beziehen</b> lässt die Fabrik diese Ware produzieren oder importiert die Ware von der ausgewählten Insel oder dem neutralen Händler (je nachdem, welchen Sie anklicken).</p><br/>


<h5>Verbrauchseffekte, Produktionsketten und Zusatzwaren-Items</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>Die Buttons befinden sich links in der Navigationsleiste.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>Der Effekt-Dialog ermöglicht die Anwendung von erforschten Technologien (global), Erhabenem Schutzherren-Effekt (global) und Ereignissen (pro Session oder Insel).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>Der Schutzherren-Auswahldialog ermöglicht die Auswahl des Schutzherren und die Eingabe der Hingabe. Er zeigt den Bonus und die betroffenen Fabriken an.</p><br/>

<h5>Insel- und Handelsroutenverwaltung</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Ausgewählte Insel</span> </div> <select name="islands" class="custom-select" ><option value="">Alle Inseln</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>Zuerst muss der <b>Inselverwaltungsdialog</b> durch Klick auf das Zahnrad geöffnet werden. Dort können neue Inseln erstellt werden. Nach dem Erstellen der ersten Insel erscheinen drei neue Bedienelemente in der Mitte der Navigationsleiste: Insel wechseln, Inselverwaltung öffnen und Handelsroutenverwaltung öffnen. Neue Inseln werden einer <b>Session</b> zugeordnet. Die Session beeinflusst, welche Bevölkerungsstufen, Fabriken, Items und Warenverbrauchseffekte angezeigt werden. Der Button <b>Alles löschen</b> setzt den Rechner auf den Ausgangszustand zurück.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>Handelsrouten werden erstellt</b> aus dem <b>Waren-Konfigurationsdialog</b>. Es gibt zwei Arten von Handelsrouten. Die erste Art sind Routen zum <b>passiven Wareneinkauf von Händlern</b>. Durch Klick auf den Button <b>Ware davon beziehen</b> wird der Bedarf für dieses Produkt von Händlern eingekauft. Die zweite Art sind Routen zum <b>Warentransfer zwischen Inseln</b>. Wie bei Zusatzwaren wird die zusätzliche Nachfrage auf der einen Seite erhöht und auf der anderen verringert. Beim Öffnen des Waren-Konfigurationsdialogs trägt der Rechner die <b>Überproduktion</b> in das Mengeneingabefeld für eine neue Handelsroute ein. Wenn sich Produktion oder Inselbedarf ändern, erscheinen Buttons neben geeigneten Handelsrouten, die das Hinzufügen der Differenz ermöglichen. Ein <span class="fa fa-exclamation-triangle " style="color:red"></span> bei einem Eingabefeld signalisiert, dass die Quellinsel nicht genug produziert, um die Handelsroute vollständig zu bedienen.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>Das Handelsroutenmenü enthält eine Übersicht aller Handelsrouten, aufgelistet in der Reihenfolge ihrer Erstellung. Dort können Handelsrouten gelöscht und ihre Transportmenge angepasst werden.</p><br/>
<br/>

<h5>Haftungsausschluss</h5>
<p>Der Rechner wird ohne jegliche Gewährleistung zur Verfügung gestellt. Die Arbeit wurde in KEINER Weise von Ubisoft Mainz unterstützt. Alle Assets aus dem Spiel Anno 117 sind © by Ubisoft.</p><br/>
<p>Dies betrifft insbesondere, aber nicht ausschließlich alle Icons, Bezeichnungen und Verbrauchswerte.</p><br/>

<p>Diese Software steht unter der MIT-Lizenz.</p><br/>

<h5>Autor</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Fehler und Verbesserungen</h5>
<span>Um auf Fehler oder Unannehmlichkeiten hinzuweisen oder Verbesserungen vorzuschlagen, tritt dem Discord-Server bei (siehe Link oben) oder eröffne ein Issue auf GitHub (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,


        english:
            `<h5>Usage and Structure</h5>
<p>Enter the current of residences per level into the topmost row. The production chains will update automatically when one leaves the input field. Only the required goods are displayed.</p>
<p>The letter in square brackets before the resident's name is the <b>hotkey</b> to focus the input field. There, one can use the arrow keys to inc-/decrement the number.</p><br/>
<p>The row below displays the <b>workforce</b> that is required to run all buildings (rounded towards the next complete factory).</p><br/>
<p>Afterwards an <b>overview of the required goods</b> follows. Clicking the heading collapses each section.</p><br/>
<p>Each card displays the name of the good, its icon, the number of constructed / required buildings, and the production rate in tons per minute. The number of buildings has, if activated, two decimal places to directly show the amount of overcapacities. The bottom of the tile displays the (required) <b>output of the factory</b> (which are generated in the output storage of the factory plus excess goods).</p>
<p>Since <b>construction materials</b> share intermediate goods with consumables they are explicitly listed (unlike in calculators for previous Annos) to better plan the production of mines. The number of factories must be entered manually.</p><br/>

<h5>Population Configuration</h5>
<p>The button top left of the population levels opens a dedicated menu. The residents are automatically calculated based on the number of residences, consumption effects and supplied needs.</p>
<p>The needs grouped by category are below the residents. The checkbox next to the good (un-)lock the need. Clicking the checkbox next to the heading (un-)checks the whole category. The marketplace icon opens the production chain overview.</p><br/>

<h5>Global Settings</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>The buttons on the right of the navigation bar serve the purpose of managing the calculator. They toggle dark mode, open settings, show the help or open the download dialog. The language and the amount of displayed information can be adjusted in the settings. In the <b>download area</b> one can import and export the <b>configuration</b> (settings, islands, productivity, buildings, ...). Moreover, this calculator can be downloaded.</p><br/>

<h5>Good Configuration Dialog</h5>
<p>The button top left of the factory opens a more detailled menu. There, items, buildings, productivity, modules, effects and water supply can be applied or entered. It only lists items which change productivity, input goods or workforce and provide extra goods. Items that fall in neither of the three categories are not included for clarity. Apart from that, trade routes and traders are created in this dialog. The button <b>Obtain goods from</b> makes the factory produce that good, or imports the good from the selected island or neutral trader (depending on which one you click)</p><br/>


<h5>Consumption Effects, Production Chains, and Extra Goods Items</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>The buttons are found in the left of the navigation bar.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>The effect dialog lets you apply researched technologies (globally), Exalted Patron Effect (globally) and events (per session or island).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>The patron selection dialog lets you apply the patron and enter the devotion. It displays the buff and affected factories.</p><br/>

<h5>Island and Trade Route Management</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Selected Island</span> </div> <select name="islands" class="custom-select" ><option value="">All Islands</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>First, one must open the <b>island management dialog</b> by clicking the cogwheel. One can create new islands there. After creating the first island three new control elements show up in the center of the navigation bar: Switch island, open island management, and open trade route management. New islands are associated with a <b>session</b>. The session influences which population levels, factories, items and good consumption effects show up. The button <b>Delete All</b> resets the calculator to its initial state.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>Trade routes are created</b> from the <b>good configuration dialog</b>. There are two kinds of trade routes. The first kind are routes to <b>purchase goods passively from traders</b>. Clicking the <b>obtain goods from</b> button purchases the demand for this good from traders. The second kind are routes to <b>transfer goods between islands</b>. Like for extra goods, the extra demand is increased on one side and decreased on the other. When opening the factory configuration dialog, the calculator enters the <b>overproduction</b> into the amount input field for a new trade route. When production or island demand change, buttons show up next to suitable trade routes that allow to add the difference. A <span class="fa fa-exclamation-triangle " style="color:red"></span> on an input field signals that the source island does not produce enough to fully supply the trade route.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>The trade route menu contains an overview of all trade routes, listed in the order of creation. One can delete trade routes and adjust their load there.</p><br/>
<br/>

<h5>Disclaimer</h5>
<p>The calculator is provided without warranty of any kind. The work was NOT endorsed by Ubisoft Mainz in any kind. All the assets from Anno 117 game are © by Ubisoft.</p><br/>
<p>These are especially but not exclusively all icons, designators, and consumption values.</p><br/>

<p>This software is under the MIT license.</p><br/>

<h5>Author</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Bugs and improvements</h5>
<span>If you encounter any bugs or inconveniences or if you want to suggest improvements, join the Discord server (see link above) or open an Issue on GitHub (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,

        french: `<h5>Utilisation et Structure</h5>
<p>Entrez le nombre actuel de résidences par niveau dans la ligne supérieure. Les chaînes de production se mettront à jour automatiquement lorsque vous quitterez le champ de saisie. Seuls les biens nécessaires sont affichés.</p>
<p>La lettre entre crochets avant le nom du résident est le <b>raccourci clavier</b> pour mettre le focus sur le champ de saisie. Là, vous pouvez utiliser les flèches du clavier pour augmenter ou diminuer le nombre.</p><br/>
<p>La ligne ci-dessous affiche la <b>main-d'œuvre</b> nécessaire pour faire fonctionner tous les bâtiments (arrondie à l'usine complète suivante).</p><br/>
<p>Ensuite, un <b>aperçu des biens requis</b> suit. En cliquant sur le titre, chaque section peut être réduite.</p><br/>
<p>Chaque carte affiche le nom du bien, son icône, le nombre de bâtiments construits/requis et le taux de production en tonnes par minute. Le nombre de bâtiments a, s'il est activé, deux décimales pour montrer directement la quantité de surcapacités. Le bas de la tuile affiche la <b>production de l'usine</b> (qui est générée dans le stockage de sortie de l'usine plus les biens excédentaires).</p>
<p>Étant donné que les <b>matériaux de construction</b> partagent des biens intermédiaires avec les consommables, ils sont explicitement listés (contrairement aux calculateurs pour les précédents Annos) pour mieux planifier la production des mines. Le nombre d'usines doit être saisi manuellement.</p><br/>

<h5>Configuration de la Population</h5>
<p>Le bouton en haut à gauche des niveaux de population ouvre un menu dédié. Les résidents sont automatiquement calculés en fonction du nombre de résidences, des effets de consommation et des besoins fournis.</p>
<p>Les besoins regroupés par catégorie se trouvent sous les résidents. La case à cocher à côté du bien (dé)verrouille le besoin. En cliquant sur la case à cocher à côté du titre, on (dé)coche toute la catégorie. L'icône du marché ouvre l'aperçu de la chaîne de production.</p><br/>

<h5>Paramètres Globaux</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>Les boutons à droite de la barre de navigation servent à gérer la calculatrice. Ils basculent le mode sombre, ouvrent les paramètres, affichent l'aide ou ouvrent le dialogue de téléchargement. La langue et la quantité d'informations affichées peuvent être ajustées dans les paramètres. Dans la <b>zone de téléchargement</b>, on peut importer et exporter la <b>configuration</b> (paramètres, îles, productivité, bâtiments, ...). De plus, cette calculatrice peut être téléchargée.</p><br/>

<h5>Dialogue de Configuration des Biens</h5>
<p>Le bouton en haut à gauche de l'usine ouvre un menu plus détaillé. Là, des objets, bâtiments, productivité, modules, effets et approvisionnement en eau peuvent être appliqués ou saisis. Il ne liste que les objets qui modifient la productivité, les biens d'entrée ou la main-d'œuvre et fournissent des biens supplémentaires. Les objets qui ne correspondent à aucune des trois catégories ne sont pas inclus pour plus de clarté. Par ailleurs, les routes commerciales et les marchands sont créés dans ce dialogue. Le bouton <b>Obtenir des marchandises de</b> fait produire ce bien par l'usine, ou importe le bien de l'île sélectionnée ou du marchand neutre (selon celui sur lequel vous cliquez).</p><br/>

<h5>Effets de Consommation, Chaînes de Production et Objets de Biens Supplémentaires</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>Les boutons se trouvent à gauche de la barre de navigation.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>Le dialogue des effets vous permet d'appliquer des technologies recherchées (globalement), l'Effet de Dieu Tutélaire Exalté (globalement) et des événements (par session ou île).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>Le dialogue de sélection du dieu tutélaire vous permet d'appliquer le dieu tutélaire et de saisir la dévotion. Il affiche le bonus et les usines affectées.</p><br/>

<h5>Gestion des Îles et des Routes Commerciales</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Île Sélectionnée</span> </div> <select name="islands" class="custom-select" ><option value="">Toutes les Îles</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>D'abord, il faut ouvrir le <b>dialogue de gestion des îles</b> en cliquant sur la roue dentée. On peut y créer de nouvelles îles. Après avoir créé la première île, trois nouveaux éléments de contrôle apparaissent au centre de la barre de navigation : Changer d'île, ouvrir la gestion des îles et ouvrir la gestion des routes commerciales. Les nouvelles îles sont associées à une <b>session</b>. La session influence quels niveaux de population, usines, objets et effets de consommation de biens apparaissent. Le bouton <b>Tout Supprimer</b> réinitialise la calculatrice à son état initial.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>Les routes commerciales sont créées</b> à partir du <b>dialogue de configuration des biens</b>. Il existe deux types de routes commerciales. Le premier type sont des routes pour <b>acheter des biens passivement auprès de marchands</b>. En cliquant sur le bouton <b>obtenir des marchandises de</b>, on achète la demande pour ce bien auprès de marchands. Le deuxième type sont des routes pour <b>transférer des biens entre îles</b>. Comme pour les biens supplémentaires, la demande supplémentaire est augmentée d'un côté et diminuée de l'autre. Lors de l'ouverture du dialogue de configuration d'usine, la calculatrice saisit la <b>surproduction</b> dans le champ de saisie de quantité pour une nouvelle route commerciale. Lorsque la production ou la demande de l'île changent, des boutons apparaissent à côté des routes commerciales appropriées qui permettent d'ajouter la différence. Un <span class="fa fa-exclamation-triangle " style="color:red"></span> sur un champ de saisie signale que l'île source ne produit pas assez pour approvisionner complètement la route commerciale.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>Le menu des routes commerciales contient un aperçu de toutes les routes commerciales, listées dans l'ordre de création. On peut supprimer des routes commerciales et ajuster leur charge là.</p><br/>
<br/>

<h5>Avertissement</h5>
<p>La calculatrice est fournie sans garantie d'aucune sorte. Le travail n'a PAS été approuvé par Ubisoft Mainz de quelque manière que ce soit. Tous les éléments du jeu Anno 117 sont © d'Ubisoft.</p><br/>
<p>Il s'agit notamment mais pas exclusivement de toutes les icônes, désignateurs et valeurs de consommation.</p><br/>

<p>Ce logiciel est sous licence MIT.</p><br/>

<h5>Auteur</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Bugs et améliorations</h5>
<span>Si vous rencontrez des bugs ou des désagréments ou si vous souhaitez suggérer des améliorations, rejoignez le serveur Discord (voir le lien ci-dessus) ou ouvrez une Issue sur GitHub (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`,

        traditional_chinese:
                `<h5>使用方式與結構</h5>

<p>在最上方一列輸入每個等級的居住建築數量。當離開輸入欄位時，生產鏈會自動更新。僅顯示所需的貨物。</p>
<p>居民名稱前方括號內的字母是<b>快捷鍵</b>，用於聚焦該輸入欄位。在欄位中可以使用方向鍵來增加或減少數值。</p><br/>
<p>下方的列顯示運作所有建築所需的<b>勞動力</b>（向上取整至完整工廠數量）。</p><br/>
<p>接著會顯示<b>所需貨物總覽</b>。點擊標題可以摺疊各個區段。</p><br/>
<p>每張卡片顯示貨物名稱、生產貨物的圖示、已建造/所需的建築數量，以及以每分鐘噸數為單位的生產率。建築數量在啟用時會有兩位小數，可直接顯示超額產能的數量。卡片底部顯示工廠的（所需）<b>產出</b>（即工廠輸出倉庫中產生的貨物加上多餘貨物）。</p>
<p>由於<b>建築材料</b>與消耗品共享中間產物，因此會明確列出（不同於前幾代 Anno 的計算器），以便更好地規劃礦場的生產。工廠數量必須手動輸入。</p><br/>

<h5>人口配置</h5>
<p>人口等級左上方的按鈕會開啟專用選單。居民數量會根據居住建築數量、消費效果和已供應的需求自動計算。</p>
<p>需求會依類別分組顯示在居民下方。貨物旁的核取方塊可以鎖定或解鎖該需求。點擊標題旁的核取方塊可以勾選或取消勾選整個類別。市場圖示會開啟生產鏈總覽。</p><br/>

<h5>全域設定</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>導覽列右側的按鈕用於管理計算器。它們可以切換深色模式、開啟設定、顯示說明或開啟下載對話框。可以在設定中調整語言和顯示資訊的數量。在<b>下載區域</b>可以匯入和匯出<b>配置</b>（設定、島嶼、生產力、建築等）。此外，也可以下載此計算器。</p><br/>

<h5>貨物配置對話框</h5>
<p>工廠左上方的按鈕會開啟更詳細的選單。在那裡可以套用或輸入物品、建築、生產力、模組、效果和供水。它只列出會改變生產力、輸入貨物或勞動力，以及提供額外貨物的物品。不屬於這三類的物品為了清晰起見不包含在內。此外，貿易路線和貿易商也在此對話框中建立。<b>從以下取得貨物</b>按鈕會讓工廠生產該貨物，或從選定的島嶼或中立貿易商進口該貨物（取決於您點擊哪一個）。</p><br/>

<h5>消費效果、生產鏈和額外貨物物品</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>這些按鈕位於導覽列的左側。</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>效果對話框讓您套用已研究的技術（全域）、崇高守護神效果（全域）和事件（每個時段或島嶼）。</p><br/>

<span class="float-left btn-group bg-dark mr-2"> <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>守護神選擇對話框讓您套用守護神並輸入虔誠度。它會顯示增益效果和受影響的工廠。</p><br/>

<h5>島嶼和貿易路線管理</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >已選擇的島嶼</span> </div> <select name="islands" class="custom-select" ><option value="">所有島嶼</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>首先，必須點擊齒輪圖示開啟<b>島嶼管理對話框</b>。可以在那裡建立新島嶼。建立第一個島嶼後，導覽列中央會出現三個新的控制元素：切換島嶼、開啟島嶼管理和開啟貿易路線管理。新島嶼會與一個<b>時段</b>關聯。時段會影響顯示哪些人口等級、工廠、物品和貨物消費效果。<b>全部刪除</b>按鈕會將計算器重置為初始狀態。</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>貿易路線是從</b><b>貨物配置對話框</b><b>建立的</b>。有兩種貿易路線。第一種是<b>從貿易商被動購買貨物</b>的路線。點擊<b>從以下取得貨物</b>按鈕會從貿易商購買該貨物的需求量。第二種是<b>在島嶼之間運輸貨物</b>的路線。就像額外貨物一樣，額外需求會在一側增加，在另一側減少。開啟工廠配置對話框時，計算器會將<b>超額產量</b>輸入到新貿易路線的數量輸入欄位中。當生產或島嶼需求改變時，適合的貿易路線旁會出現按鈕，允許添加差額。輸入欄位上的<span class="fa fa-exclamation-triangle " style="color:red"></span>表示來源島嶼的產量不足以完全供應該貿易路線。</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>貿易路線選單包含所有貿易路線的總覽，按建立順序列出。可以在那裡刪除貿易路線並調整其載貨量。</p><br/> <br/>

<h5>免責聲明</h5>
<p>本計算器不提供任何形式的保證。此作品並未獲得 Ubisoft Mainz 的任何形式背書。所有來自 Anno 117 遊戲的素材版權歸 Ubisoft 所有。</p><br/>
<p>這些素材尤其包括但不限於所有圖示、名稱和消費數值。</p><br/>

<p>本軟體採用 MIT 授權條款。</p><br/>

<h5>作者</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>錯誤回報與改進建議</h5>
<span>如果您遇到任何錯誤或不便之處，或想建議改進，請加入 Discord 伺服器（見上方連結）或在 GitHub 上建立 Issue（</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>）</span>`,

        simplified_chinese: `<h5>使用方法和结构</h5>
<p>在顶部一行输入每个等级的当前住宅数量。当您离开输入字段时，生产链将自动更新。仅显示所需的商品。</p>
<p>居民名称前方括号中的字母是用于聚焦输入字段的<b>快捷键</b>。在那里，您可以使用箭头键来增加或减少数字。</p><br/>
<p>下面一行显示运营所有建筑所需的<b>劳动力</b>（向上舍入到下一个完整工厂）。</p><br/>
<p>接下来是<b>所需商品概览</b>。点击标题可以折叠每个部分。</p><br/>
<p>每个卡片显示商品名称、其图标、已建造/所需建筑数量以及每分钟吨数的生产速度。如果激活，建筑数量有两位小数，可以直接显示过剩产能的数量。卡片底部显示<b>工厂产出</b>（在工厂的成品仓库中生成的产量加上额外商品）。</p>
<p>由于<b>建筑材料</b>与消耗品共享中间商品，它们被明确列出（与以前的Anno计算器不同），以便更好地规划矿山生产。工厂数量必须手动输入。</p><br/>

<h5>人口配置</h5>
<p>人口等级左上角的按钮打开专用菜单。居民会根据住宅数量、消费效果和提供的需求自动计算。</p>
<p>按类别分组的需求位于居民下方。商品旁边的复选框（取消）锁定需求。点击标题旁边的复选框（取消）选中整个类别。市场图标打开生产链概览。</p><br/>

<h5>全局设置</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>导航栏右侧的按钮用于控制计算器。它们切换深色模式、打开设置、显示帮助或打开下载对话框。可以在选项中配置语言和显示信息的数量。在<b>下载区域</b>，您可以导入和导出<b>配置</b>（设置、岛屿、生产力、建筑等）。此外，还可以下载此计算器。</p><br/>

<h5>商品配置对话框</h5>
<p>工厂左上角的按钮打开更详细的菜单。在那里可以应用或输入物品、建筑、生产力、模块、效果和供水。它仅列出修改生产力、输入商品或劳动力并提供额外商品的物品。为了清晰起见，不属于这三个类别之一的物品不包括在内。此外，在此对话框中创建贸易路线和商人。<b>从此获取商品</b>按钮使工厂生产此商品或从所选岛屿或中立商人进口商品（取决于您点击的哪个）。</p><br/>

<h5>消费效果、生产链和额外商品物品</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>按钮位于导航栏左侧。</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>效果对话框允许您应用研究的技术（全局）、首席赞助人效果（全局）和事件（按会话或岛屿）。</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>赞助人选择对话框允许您应用赞助人并输入奉献值。它显示奖励和受影响的工厂。</p><br/>

<h5>岛屿和贸易路线管理</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >选定岛屿</span> </div> <select name="islands" class="custom-select" ><option value="">所有岛屿</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>首先需要通过点击齿轮打开<b>岛屿管理对话框</b>。在那里可以创建新岛屿。创建第一个岛屿后，导航栏中央会出现三个新控件：切换岛屿、打开岛屿管理和打开贸易路线管理。新岛屿与<b>会话</b>关联。会话影响显示哪些人口等级、工厂、物品和商品消费效果。<b>删除全部</b>按钮将计算器重置为初始状态。</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p><b>贸易路线</b>从<b>商品配置对话框</b>创建。有两种类型的贸易路线。第一种是<b>从商人被动购买商品</b>的路线。点击<b>从此获取商品</b>按钮会从商人购买对此商品的需求。第二种是<b>在岛屿之间转移商品</b>的路线。与额外商品类似，额外需求在一侧增加，在另一侧减少。打开工厂配置对话框时，计算器会将<b>过剩生产</b>输入到新贸易路线的数量输入字段中。当岛屿的生产或需求发生变化时，相应贸易路线旁边会出现按钮，允许您添加差额。输入字段中的<span class="fa fa-exclamation-triangle " style="color:red"></span>表示源岛屿生产不足，无法完全供应贸易路线。</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>贸易路线菜单包含所有贸易路线的概览，按创建顺序列出。在那里可以删除贸易路线并调整其货物。</p><br/>
<br/>

<h5>免责声明</h5>
<p>计算器不提供任何保证。该作品未以任何方式获得Ubisoft Mainz的批准。Anno 117游戏中的所有资源均为Ubisoft©所有。</p><br/>
<p>特别是但不限于所有图标、指示符和消费值。</p><br/>

<p>此软件采用MIT许可证。</p><br/>

<h5>作者</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>错误和改进</h5>
<span>如果您遇到任何错误或不便，或者想建议改进，请加入Discord服务器（见上方链接）或在GitHub上创建Issue（</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>）</span>`,

        spanish: `<h5>Uso y Estructura</h5>
<p>Introduce el número actual de residencias por nivel en la fila superior. Las cadenas de producción se actualizarán automáticamente cuando salgas del campo de entrada. Solo se muestran los bienes necesarios.</p>
<p>La letra entre corchetes antes del nombre del residente es la <b>tecla de acceso rápido</b> para enfocar el campo de entrada. Allí puedes usar las teclas de flecha para aumentar o disminuir el número.</p><br/>
<p>La fila de abajo muestra la <b>mano de obra</b> necesaria para operar todos los edificios (redondeada a la siguiente fábrica completa).</p><br/>
<p>A continuación sigue una <b>visión general de los bienes necesarios</b>. Al hacer clic en el encabezado, cada sección se puede contraer.</p><br/>
<p>Cada tarjeta muestra el nombre del bien, su ícono, el número de edificios construidos/requeridos y la tasa de producción en toneladas por minuto. El número de edificios tiene, si está activado, dos decimales para mostrar directamente la cantidad de capacidad excedente. La parte inferior de la tarjeta muestra la <b>producción de la fábrica</b> (que se genera en el almacén de salida de la fábrica más bienes excedentes).</p>
<p>Dado que los <b>materiales de construcción</b> comparten bienes intermedios con consumibles, se enumeran explícitamente (a diferencia de las calculadoras para Anno anteriores) para planificar mejor la producción de minas. El número de fábricas debe introducirse manualmente.</p><br/>

<h5>Configuración de Población</h5>
<p>El botón en la esquina superior izquierda de los niveles de población abre un menú dedicado. Los residentes se calculan automáticamente en función del número de residencias, efectos de consumo y necesidades proporcionadas.</p>
<p>Las necesidades agrupadas por categorías están debajo de los residentes. La casilla de verificación junto al bien (des)bloquea la necesidad. Al hacer clic en la casilla de verificación junto al encabezado, se (des)marca toda la categoría. El ícono del mercado abre la visión general de la cadena de producción.</p><br/>

<h5>Configuración Global</h5>
<span class="btn-group bg-dark mr-2 float-left">
<button class="btn text-light"><span class="fa fa-adjust"> </span></button>
<button class="btn text-light"><span class="fa fa-cog"> </span></button>
<button class="btn text-light"><span class="fa fa-question-circle-o"> </span></button>
<button class="btn text-light"><span class="fa fa-download"> </span></button>
</span>
<p>Los botones a la derecha de la barra de navegación sirven para controlar la calculadora. Cambian el modo oscuro, abren la configuración, muestran la ayuda o abren el diálogo de descarga. El idioma y la cantidad de información mostrada se pueden configurar en las opciones. En el <b>área de descarga</b> puedes importar y exportar la <b>configuración</b> (ajustes, islas, productividad, edificios, ...). Además, esta calculadora se puede descargar.</p><br/>

<h5>Diálogo de Configuración de Bienes</h5>
<p>El botón en la esquina superior izquierda de la fábrica abre un menú más detallado. Allí se pueden aplicar o introducir artículos, edificios, productividad, módulos, efectos y suministro de agua. Solo enumera los artículos que modifican la productividad, los bienes de entrada o la mano de obra y proporcionan bienes adicionales. Los artículos que no pertenecen a ninguna de las tres categorías no se incluyen por claridad. Además, en este diálogo se crean rutas comerciales y comerciantes. El botón <b>Obtener bienes de</b> hace que la fábrica produzca este bien o importa el bien desde la isla seleccionada o desde un comerciante neutral (dependiendo de cuál hagas clic).</p><br/>

<h5>Efectos de Consumo, Cadenas de Producción y Artículos de Bienes Adicionales</h5>
<span class="btn-group bg-dark mr-2 float-left">
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#effects-dialog" class="icon-navbar" src="./icons/icon_add_goods_socket_white.png" />
    </button>
    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button>
</span>
<p>Los botones están a la izquierda en la barra de navegación.</p><br/>

<span class="btn-group bg-dark mr-2 float-left"><button type="button" class="btn"><img data-toggle="modal" data-target="#good-consumption-island-upgrade-dialog" class="icon-navbar" src="icons/icon_add_goods_socket_white.png" /></button></span>
<p>El diálogo de efectos permite aplicar tecnologías investigadas (globalmente), el Efecto del Patrón Principal (globalmente) y eventos (por sesión o isla).</p><br/>

<span class="float-left btn-group bg-dark mr-2">    <button type="button" class="btn">
        <img data-toggle="modal" data-target="#patron-selection-dialog" class="icon-navbar" src="./icons/icon_2d_religion_belief_0.webp" />
    </button></span>
<p>El diálogo de selección de patrón permite aplicar un patrón e introducir devoción. Muestra el bono y las fábricas afectadas.</p><br/>

<h5>Gestión de Islas y Rutas Comerciales</h5>
<div class="input-group mb-2" style=" max-width: 300px; "> <div class="input-group-prepend"> <span class="input-group-text" >Isla Seleccionada</span> </div> <select name="islands" class="custom-select" ><option value="">Todas las Islas</option></select> <div class="input-group-append"> <button class="btn btn-secondary" > <span class="fa fa-cog"> </span> </button> </div> </div>
<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img class="icon-navbar" src="icons/icon_map.png"> </button></span>
<p>Primero es necesario abrir el <b>diálogo de gestión de islas</b> haciendo clic en el engranaje. Allí puedes crear nuevas islas. Después de crear la primera isla, aparecen tres nuevos controles en el centro de la barra de navegación: Cambiar isla, abrir gestión de islas y abrir gestión de rutas comerciales. Las nuevas islas están vinculadas a una <b>sesión</b>. La sesión afecta qué niveles de población, fábricas, artículos y efectos de consumo de bienes se muestran. El botón <b>Eliminar Todo</b> restablece la calculadora al estado inicial.</p><br/>

<div class="float-left mr-2"> <button class="btn btn-light btn-sm" > <span class="fa fa-sliders"></span> </button> </div>
<p>Las <b>rutas comerciales se crean</b> desde el <b>diálogo de configuración de bienes</b>. Hay dos tipos de rutas comerciales. El primer tipo son las rutas para <b>comprar bienes pasivamente a comerciantes</b>. Al hacer clic en el botón <b>obtener bienes de</b> compra la demanda de este bien a los comerciantes. El segundo tipo son las rutas para <b>transferir bienes entre islas</b>. Similar a los bienes adicionales, la demanda adicional se incrementa en un lado y se reduce en el otro. Al abrir el diálogo de configuración de la fábrica, la calculadora introduce la <b>sobreproducción</b> en el campo de entrada de cantidad para la nueva ruta comercial. Cuando la producción o demanda de la isla cambian, aparecen botones junto a las rutas comerciales apropiadas que permiten agregar la diferencia. <span class="fa fa-exclamation-triangle " style="color:red"></span> en el campo de entrada indica que la isla de origen no está produciendo lo suficiente para abastecer completamente la ruta comercial.</p><br/>

<span class="float-left btn-group bg-dark mr-2"><button type="button" class="btn"> <img data-toggle="modal" data-target="#trade-routes-management-dialog" class="icon-navbar" src="icons/icon_shiptrade.png"> </button></span>
<p>El menú de rutas comerciales contiene una visión general de todas las rutas comerciales, enumeradas en orden de creación. Allí puedes eliminar rutas comerciales y ajustar su carga.</p><br/>
<br/>

<h5>Descargo de Responsabilidad</h5>
<p>La calculadora se proporciona sin ninguna garantía. El trabajo NO ha sido aprobado por Ubisoft Mainz de ninguna manera. Todos los recursos del juego Anno 117 son © de Ubisoft.</p><br/>
<p>Esto incluye especialmente, pero no exclusivamente, todos los íconos, designadores y valores de consumo.</p><br/>

<p>Este software está bajo la licencia MIT.</p><br/>

<h5>Autor</h5>
<p>Nico Höllerich</p>
<p>hoellerich.nico@freenet.de</p><br/>

<h5>Errores y Mejoras</h5>
<span>Si encuentras algún error o inconveniente o si quieres sugerir mejoras, únete al servidor de Discord (ver enlace arriba) o abre un Issue en GitHub (</span><a href="https://github.com/anno-mods/anno-117-calculator/issues">https://github.com/anno-mods/anno-117-calculator/issues</a><span>)</span>`
    },
    
    notObtaining: {
        "english": "Not obtaining",
        "french": "Ne pas obtenir",
        "polish": "Nie pozyskiwać",
        "spanish": "No obtener",
        "italian": "Non ottenere",
        "german": "Nicht beziehen",
        "brazilian": "Não obter",
        "russian": "Не получать",
        "simplified_chinese": "不采购",
        "traditional_chinese": "不採購",
        "japanese": "仕入れない",
        "korean": "조달하지 않음"
    }
};



export const options: Record<string, any> = {
    "decimalsForBuildings": {
        "name": "Show number of buildings with decimals",
        "locaText": {
            "english": "Show number of buildings with decimals",
            "french": "Afficher le nombre de bâtiments avec des décimales",
            "polish": "Pokaż liczbę budynków z dziesiątnymi",
            "spanish": "Mostrar el número de edificios con decimales",
            "italian": "Mostra il numero di edifici con decimali",
            "german": "Zeige Nachkommastellen bei der Gebäudeanzahl",
            "brazilian": "Mostrar número de edifícios com decimais",
            "russian": "Показать количество зданий с десятичными знаками",
            "simplified_chinese": "建筑数量显示为小数模式",
            "traditional_chinese": "建築數量顯示為小數模式",
            "japanese": "建物の数を小数点付きで表示",
            "korean": "건물 수를 소수점 단위로 표시"
        }
    },
    "hideNames": {
        "name": "Hide the names of products, factories, and population levels",
        "locaText": {
            "english": "Hide the names of products, factories, and population levels",
            "french": "Masquer les noms des produits, usines et niveaux de population",
            "polish": "Ukryj nazwy produktów, fabryk i poziomów populacji",
            "spanish": "Ocultar los nombres de productos, fábricas y niveles de población",
            "italian": "Nascondi i nomi di prodotti, fabbriche e livelli di popolazione",
            "german": "Verberge die Namen von Produkten, Fabriken und Bevölkerungsstufen",
            "brazilian": "Ocultar os nomes de produtos, fábricas e níveis de população",
            "russian": "Скрыть названия товаров, фабрик и уровней населения",
            "simplified_chinese": "隐藏产品、工厂和人口等级的名称",
            "traditional_chinese": "隱藏產品、工廠和人口等級的名稱",
            "japanese": "製品、工場、人口レベルの名前を非表示",
            "korean": "제품, 건물명 및 인구 이름 숨기기"
        }
    },
    /*
    "hideProductionBoost": {
        "name": "Hide the input fields for productivity",
        "locaText": {
            "english": "Hide the input fields for producivity",
            "french": "Masquer les champs de saisie pour la productivité",
            "polish": "Ukryj pola wejściowe dla produktywności",
            "spanish": "Ocultar los campos de entrada para la productividad",
            "italian": "Nascondi i campi di input per la produttività",
            "german": "Verberge das Eingabefelder für Produktivität",
            "brazilian": "Ocultar os campos de entrada para produtividade",
            "russian": "Скрыть поля ввода для производительности",
            "simplified_chinese": "隐藏生产力输入字段",
            "traditional_chinese": "隱藏生產力輸入字段",
            "japanese": "生産性の入力フィールドを非表示",
            "korean": "생산성 입력 필드 숨기기"
        }
    },
    */
    "showAllProducts": {
        "name": "Show all products available in the region",
        "locaText": {
            "english": "Show all products available in the region",
            "french": "Afficher tous les produits disponibles dans la région",
            "polish": "Pokaż wszystkie produkty dostępne w regionie",
            "spanish": "Mostrar todos los productos disponibles en la región",
            "italian": "Mostra tutti i prodotti disponibili nella regione",
            "german": "Zeige alle in der Region verfügbaren Produkte",
            "brazilian": "Mostrar todos os produtos disponíveis na região",
            "russian": "Показать все продукты, доступные в регионе",
            "simplified_chinese": "显示该地区所有可用的产品",
            "traditional_chinese": "顯示該地區所有可用的產品",
            "japanese": "地域で利用可能なすべての製品を表示",
            "korean": "지역에서 사용 가능한 모든 제품 표시"
        }
    },
    "missingBuildingsHighlight": {
        "name": "Highlight missing buildings",
        "locaText": {
            "english": "Highlight missing buildings",
            "french": "Mettre en évidence les bâtiments manquants",
            "polish": "Podświetl brakujące budynki",
            "spanish": "Resaltar edificios faltantes",
            "italian": "Evidenzia edifici mancanti",
            "german": "Fehlende Gebäude hervorheben",
            "brazilian": "Destacar edifícios faltantes",
            "russian": "Выделить недостающие здания",
            "simplified_chinese": "高亮缺失的建筑",
            "traditional_chinese": "高亮缺失的建築",
            "japanese": "不足している建物を強調表示",
            "korean": "부족한 건물 강조"
        }
    },

    // "needUnlockConditions": {
    //     "name": "Consider unlock conditions for needs",
    //     "locaText": {
    //         "english": "Consider unlock conditions for needs",
    //         "german": "Freischaltbedingungen der Bedürfnisse berücksichtigen",
    //     }
    // },
};

