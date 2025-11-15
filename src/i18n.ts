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
    /* newFeature: {
        english: "",
        french: "",
        polish: "",
        spanish: "",
        italian: "",
        german: "",
        brazilian: "",
        russian: "",
        simplified_chinese: "",
        traditional_chinese: "",
        japanese: "",
        korean: ""
    }, */
    helpContent: {
        german:
            `<h5>Verwendung und Aufbau</h5>
<p>Trage die aktuelle Anzahl der Wohnhäuser pro Stufe in die oberste Reihe ein. Die Produktionsketten aktualisieren sich automatisch, sobald man das Eingabefeld verlässt. Es werden nur die benötigten Waren angezeigt.</p>
<p>Der Buchstabe in eckigen Klammern vor dem Einwohnernamen ist der <b>Hotkey</b> zum Fokussieren des Eingabefeldes. Dort kann man mit den Pfeiltasten die Anzahl erhöhen oder verringern.</p><br/>
<p>Die Reihe darunter zeigt die <b>Arbeitskraft</b>, die zum Betrieb aller Gebäude benötigt wird (aufgerundet auf die nächste vollständige Fabrik).</p><br/>
<p>Danach folgt eine <b>Übersicht der benötigten Waren</b>. Durch Klick auf die Überschrift kann jeder Abschnitt zusammengeklappt werden.</p><br/>
<p>Jede Kachel zeigt den Namen des Produkts, das Icon der produzierten Ware, die Anzahl der gebauten / benötigten Gebäude und die Produktionsrate in Tonnen pro Minute. Die Anzahl der Gebäude hat, wenn aktiviert, zwei Dezimalstellen, um direkt die Menge der Überkapazitäten anzuzeigen. Am unteren Rand der Kachel wird der (benötigte) <b>Output der Fabrik</b> angezeigt (was im Ausgangslager der Fabrik erzeugt wird plus Überschuss).</p>
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
<span>Falls Sie auf Fehler oder Unannehmlichkeiten stoßen oder Verbesserungen vorschlagen möchten, erstellen Sie ein Issue auf GitHub (</span><a href="https://github.com/NiHoel/Anno1800Calculator/issues">https://github.com/NiHoel/Anno1800Calculator/issues</a><span>)</span>`,


        english:
            `<h5>Usage and Structure</h5>
<p>Enter the current of residences per level into the topmost row. The production chains will update automatically when one leaves the input field. Only the required goods are displayed.</p>
<p>The letter in square brackets before the resident's name is the <b>hotkey</b> to focus the input field. There, one can use the arrow keys to inc-/decrement the number.</p><br/>
<p>The row below displays the <b>workforce</b> that is required to run all buildings (rounded towards the next complete factory).</p><br/>
<p>Afterwards an <b>overview of the required goods</b> follows. Clicking the heading collapses each section.</p><br/>
<p>Each card displays the name of the good, the icon of the produced good, the number of constructed / required buildings, and the production rate in tons per minute. The number of buildings has, if activated, two decimal places to directly show the amount of overcapacities. The bottom of the tile displays the (required) <b>output of the factory</b> (which are generated in the output storage of the factory plus excess goods).</p>
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
<span>If you encounter any bugs or inconveniences or if you want to suggest improvements, create an Issue on GitHub (</span><a href="https://github.com/NiHoel/Anno1800Calculator/issues">https://github.com/NiHoel/Anno1800Calculator/issues</a><span>)</span>`
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

