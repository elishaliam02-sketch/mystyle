/**
 * A calorie estimate for every dish the photo model knows.
 *
 * The on-device model (Google AIY food_V1) names 2,024 dishes from around the
 * world. About 400 of them are foods in the app's own library (./foodlabels.ts)
 * and get exact figures; the other ~1,600 — "Pad thai", "Khachapuri",
 * "Bún bò Huế" — used to come back as "not in the database", so the photo
 * named the dish and then could not count it.
 *
 * Every one of those is now placed in a family of dishes that are alike on the
 * plate (a noodle soup, a stew, a savoury pastry, a cake…), each with typical
 * per-100 g figures and a typical portion. That is an estimate — the screen
 * says so — but it is the estimate a dietitian would make from the name, and
 * it can be logged in two taps and adjusted by portion like any other food.
 *
 * About 850 dishes whose names say nothing to a keyword were classified by
 * hand (HAND); the rest by the words in their names (RULES); anything left is
 * a generic "dish". dishtest in visiontest.ts checks the classic cases.
 */
import { adhocFood, registerPortion, type Food, type FoodTag } from "@/kitchen/data";

export type Family =
  | "soup"
  | "noodleSoup"
  | "stew"
  | "curry"
  | "noodles"
  | "pasta"
  | "rice"
  | "porridge"
  | "dumplings"
  | "savoryPastry"
  | "sandwich"
  | "pizza"
  | "bread"
  | "pancake"
  | "friedDough"
  | "cake"
  | "pudding"
  | "candy"
  | "grilledMeat"
  | "meatballs"
  | "sausage"
  | "friedMeat"
  | "fish"
  | "salad"
  | "vegDish"
  | "starchSide"
  | "legumes"
  | "egg"
  | "cheeseDish"
  | "casserole"
  | "drink"
  | "sauce"
  | "bowl"
  | "chips"
  | "dish";

type FamilyInfo = { kcal: number; protein: number; carbs: number; fat: number; g: number; portionHe: string; portionEn: string; he: string; en: string; tag: FoodTag };

export const FAMILIES: Record<Family, FamilyInfo> = {
  soup: { kcal: 45, protein: 3, carbs: 5, fat: 1.5, g: 350, portionHe: "קערה", portionEn: "a bowl", he: "מרק", en: "soup", tag: "veg" },
  noodleSoup: { kcal: 75, protein: 5, carbs: 9, fat: 2, g: 500, portionHe: "קערה גדולה", portionEn: "a large bowl", he: "מרק אטריות", en: "noodle soup", tag: "carb" },
  stew: { kcal: 130, protein: 11, carbs: 8, fat: 6, g: 300, portionHe: "צלחת", portionEn: "a plate", he: "תבשיל", en: "stew", tag: "protein" },
  curry: { kcal: 150, protein: 10, carbs: 9.5, fat: 8, g: 300, portionHe: "צלחת", portionEn: "a plate", he: "קארי / תבשיל מתובל", en: "curry", tag: "protein" },
  noodles: { kcal: 170, protein: 7, carbs: 24, fat: 5, g: 300, portionHe: "צלחת", portionEn: "a plate", he: "מנת אטריות", en: "noodle dish", tag: "carb" },
  pasta: { kcal: 160, protein: 6, carbs: 25, fat: 4, g: 300, portionHe: "צלחת", portionEn: "a plate", he: "מנת פסטה", en: "pasta dish", tag: "carb" },
  rice: { kcal: 170, protein: 5, carbs: 28.5, fat: 4, g: 300, portionHe: "צלחת", portionEn: "a plate", he: "מנת אורז", en: "rice dish", tag: "carb" },
  porridge: { kcal: 90, protein: 2, carbs: 17, fat: 1.5, g: 300, portionHe: "קערה", portionEn: "a bowl", he: "דייסה", en: "porridge", tag: "carb" },
  dumplings: { kcal: 220, protein: 9, carbs: 28, fat: 8, g: 200, portionHe: "כ־8 כיסונים", portionEn: "about 8 dumplings", he: "כיסונים", en: "dumplings", tag: "carb" },
  savoryPastry: { kcal: 290, protein: 9, carbs: 30, fat: 15, g: 150, portionHe: "2 יחידות", portionEn: "2 pieces", he: "מאפה או טיגון מלוח", en: "savoury pastry", tag: "carb" },
  sandwich: { kcal: 250, protein: 12, carbs: 28, fat: 10, g: 220, portionHe: "יחידה", portionEn: "one", he: "כריך / עטיפה", en: "sandwich / wrap", tag: "carb" },
  pizza: { kcal: 260, protein: 11, carbs: 31.5, fat: 10, g: 200, portionHe: "2 משולשים", portionEn: "2 slices", he: "פיצה / מאפה עם תוספות", en: "pizza / topped flatbread", tag: "carb" },
  bread: { kcal: 270, protein: 8, carbs: 50.5, fat: 4, g: 100, portionHe: "2 פרוסות", portionEn: "2 slices", he: "לחם", en: "bread", tag: "carb" },
  pancake: { kcal: 220, protein: 6, carbs: 31, fat: 8, g: 150, portionHe: "2–3 יחידות", portionEn: "2\u20133 pieces", he: "פנקייק / קרפ", en: "pancake / crêpe", tag: "carb" },
  friedDough: { kcal: 380, protein: 6, carbs: 48.5, fat: 18, g: 90, portionHe: "2 יחידות", portionEn: "2 pieces", he: "מאפה מטוגן מתוק", en: "sweet fried dough", tag: "sweet" },
  cake: { kcal: 380, protein: 5, carbs: 49.5, fat: 18, g: 100, portionHe: "פרוסה", portionEn: "a slice", he: "עוגה / מאפה מתוק", en: "cake / sweet pastry", tag: "sweet" },
  pudding: { kcal: 150, protein: 4, carbs: 22, fat: 5, g: 150, portionHe: "קערית", portionEn: "a small bowl", he: "קינוח", en: "dessert", tag: "sweet" },
  candy: { kcal: 420, protein: 4, carbs: 67, fat: 15, g: 40, portionHe: "2–3 יחידות", portionEn: "2\u20133 pieces", he: "ממתק", en: "sweet", tag: "sweet" },
  grilledMeat: { kcal: 220, protein: 25, carbs: 1, fat: 13, g: 180, portionHe: "מנה", portionEn: "a serving", he: "בשר / עוף צלוי", en: "grilled meat", tag: "protein" },
  meatballs: { kcal: 230, protein: 15, carbs: 8.75, fat: 15, g: 160, portionHe: "4 קציצות", portionEn: "4 meatballs", he: "קציצות", en: "meatballs", tag: "protein" },
  sausage: { kcal: 300, protein: 14, carbs: 2.5, fat: 26, g: 100, portionHe: "מנה", portionEn: "a serving", he: "נקניק / בשר מעובד", en: "sausage / cured meat", tag: "protein" },
  friedMeat: { kcal: 260, protein: 18, carbs: 13, fat: 15, g: 180, portionHe: "מנה", portionEn: "a serving", he: "בשר / עוף מטוגן", en: "fried meat", tag: "protein" },
  fish: { kcal: 150, protein: 18, carbs: 3.75, fat: 7, g: 200, portionHe: "מנה", portionEn: "a serving", he: "דג / פירות ים", en: "fish / seafood", tag: "protein" },
  salad: { kcal: 90, protein: 3, carbs: 6, fat: 6, g: 200, portionHe: "קערה", portionEn: "a bowl", he: "סלט", en: "salad", tag: "veg" },
  vegDish: { kcal: 90, protein: 3, carbs: 8, fat: 5, g: 200, portionHe: "מנה", portionEn: "a serving", he: "מנת ירקות", en: "vegetable dish", tag: "veg" },
  starchSide: { kcal: 150, protein: 2, carbs: 22, fat: 6, g: 200, portionHe: "מנה", portionEn: "a serving", he: "תוספת (תפו״א / פלנטיין)", en: "starchy side", tag: "carb" },
  legumes: { kcal: 140, protein: 8, carbs: 16, fat: 5, g: 250, portionHe: "מנה", portionEn: "a serving", he: "קטניות / טופו", en: "beans / tofu", tag: "protein" },
  egg: { kcal: 170, protein: 11, carbs: 4.5, fat: 12, g: 150, portionHe: "מנה", portionEn: "a serving", he: "מנת ביצים", en: "egg dish", tag: "protein" },
  cheeseDish: { kcal: 300, protein: 16, carbs: 9.5, fat: 22, g: 120, portionHe: "מנה", portionEn: "a serving", he: "מנת גבינה", en: "cheese dish", tag: "dairy" },
  casserole: { kcal: 160, protein: 8, carbs: 14, fat: 8, g: 300, portionHe: "מנה", portionEn: "a serving", he: "מאפה / פשטידה", en: "bake / casserole", tag: "carb" },
  drink: { kcal: 50, protein: 1, carbs: 9, fat: 1, g: 250, portionHe: "כוס", portionEn: "a glass", he: "משקה", en: "drink", tag: "drink" },
  sauce: { kcal: 150, protein: 3, carbs: 12, fat: 10, g: 40, portionHe: "2 כפות", portionEn: "2 tablespoons", he: "רוטב / ממרח", en: "sauce / spread", tag: "spice" },
  bowl: { kcal: 160, protein: 8, carbs: 16, fat: 7, g: 400, portionHe: "צלחת", portionEn: "a plate", he: "צלחת מעורבת", en: "mixed plate", tag: "protein" },
  chips: { kcal: 500, protein: 7, carbs: 55, fat: 28, g: 50, portionHe: "חופן", portionEn: "a handful", he: "חטיף", en: "snack", tag: "sweet" },
  dish: { kcal: 170, protein: 8, carbs: 16.5, fat: 8, g: 300, portionHe: "מנה", portionEn: "a serving", he: "מנה", en: "dish", tag: "carb" },
};

/** Dishes classified by hand, by family (labels exactly as the model names them). */
const HAND: Partial<Record<Family, string>> = {
  soup: "Miyan kuka|Minestra di ceci|Sciusceddu|Brenebon|Sop saudara|Banga|Maccu|Ginestrata|Garmugia|Peppersoup|Açorda|Magiritsa|Lablabi|Gulyásleves|Wodzionka|Czernina|Ollada|Garbure|Psarosoupa|Ukha|Mulukhiyah|Piti|Salmorejo|Minestrone|Ash reshteh|Hulatang|Butajiru|Buddha Jumps Over the Wall|Yong tau foo|Zōni|Tteokguk|Panada|Tekwan|Seolleongtang|Fugu chiri|Caldillo de perro|Pappa al pomodoro|Revithia|Hochzeitssuppe|Tarhana|Mykyrokka|Bakso|Ajoblanco|Maneštra|Pachi Pulusu|Konro|Gazpachuelo|Empal gentong|Kaeng som|Ohaw|Chikhirtma|Porra antequerana|Tourin|Dovga",
  noodleSoup: "Hōtō|Bún riêu|Kal-guksu|Mixian|Champon|Janchi-guksu|Banmian|Soki|Bánh canh|Bún bò Huế|Ohn no khao swè|Thukpa|Yaka mein|Bún ốc|Nam ngiao",
  stew: "Rinflajš|Dobradinha|Bruckfleisch|Fricasse|Baodu|Calulu|Thịt kho tàu|Tripes à la mode de Caen|Shab Deg|Tripe|Coq au vin|Saltah|Imoni|Cabidela|Kakuni|Cachupa|Mince and tatties|Motsunabe|Carne de porco à alentejana|Mixiote|Grillades|Sinseollo|Afelia|Kaldereta|Moambe|Shimotsukare|Aspic|Shabu-shabu|Jeongol|Pölsa|Cocido madrileño|Carbonade flamande|Sauerbraten|Tharid|Potée|Svíčková|Ndolé|Hachee|Philippine adobo|Mrouzia|Gopchang-jeongol|New England boiled dinner|Millionbøf|Fahsa|Zürcher Geschnetzeltes|Wat|Sautéed reindeer|Booyah|Rössypottu|Baeckeoffe|Étouffée|Tatws Pum Munud|Burgoo|Sarapatel|Mala Mogodu|Thai suki|Keledoş|Kig ha farz|Chakhchoukha|Birria|Picadillo|Caruru|Carne pizzaiola|Gheimeh|Fesenjān|Fårikål|Ropa vieja|Shuizhu|Tafelspitz|Yassa|Mućkalica|Seswaa|Pichelsteiner|Ostropel|Cocido lebaniego|Tochitură|Nimono|Oden|Cocido montañés|Kedjenou|Pieds paquets|Lapskaus|Ciulama|Kuchmachi|Kuurdak",
  curry: "Ayam masak merah|Woku|Murgh musallam|Amok trey|Asam pedas|Machher Jhol|Kombdi vade|Enne gai|Xacuti|Qeema|Galinha à portuguesa|Ema datshi|Balchão|Kaeng pa|Mas riha|Tongseng|Kaeng khae|Kaeng tai pla|Majjige huli",
  noodles: "Kottu|Yi mein|Lai fun|Youmian|Cumian|Naryn|Mi krop|Liangpi|Hiyashi chūka|Liangfen|Ants climbing a tree|Mak-guksu|Idiyappam|Shahe fen|Laping|Khauk swè thoke|Phat si-io|Meeshay|Nan gyi thohk|Mont di|Rat na",
  pasta: "Pizokel|Pisarei e faśö|Fideuà|Strapačky|Beshbarmak|Túrós csusza|Schupfnudel|Tetrazzini|Kesme|Mlinci|Fusi",
  rice: "Riso patate e cozze|Sartù|Saleeg|Omo tuo|Hawaiian haystack|Kateh|Kiritanpo|Sekihan|Chitranna|Kralan|Erkuai|Xôi|Thieboudienne|Tamago kake gohan|Pakhala|Nam Khao|Loco moco|Arròs negre|Lo mai gai|Cifantuan|Galinhada|Ogok-bap|Minchee|Bánh chưng|Cơm tấm|Kabuni|Puliyogare|Takikomi gohan|Kamameshi|Vangibath|Spanakorizo|Chazuke|Attiéké|Tahri|Waakye|Sanna|Suman",
  porridge: "Bazin|Pirao|Mămăligă|Kokonte|Akple|Khichu|Tuo Zaafi|Žganci|Ga'at|Koozh|Ragi mudde|Asida|Jolpan|Gachas|Kutia|Sabudana Khichadi|Harees|Lâpa|Øllebrød|Gofio|Gari|Puttu|Popara|Kačamak|Ambuyat|Champorado|Vispipuuro|Ogi|Zosui|Konkonte|Dhindo|Kondowole",
  dumplings: "Bánh bột lọc|Bánh cuốn|Maultasche|Knedle|Bánh bèo|Fun guo|Hoppang|Quenelle|Kroppkaka|Kozhukkatta|Blodpalt|Modak|Suanla chaoshou|Kalduny|Nikuman|Leberknödel",
  savoryPastry: "Molote|Erbazzone|Punugulu|Chả giò|Nachos|Totopo|Shkedei marak|Panelle|Corunda|Entomatada|Kalakukko|Chile relleno|Onion ring|Popiah|Hornazo|Runza|Chimichanga|Coulibiac|Panucho|Tlacoyo|Murtabak|Bridie|Bolani|Ngo hiang|Memela|Kachori|Enchilada|Kaassoufflé|Acarajé|Bedfordshire clanger|Flaouna|Zelnik|Plăcintă|Sarburma|Bakwan|Chilaquiles|Lekor|Salbute|Kibinai|Lobiani|Bamischijf",
  sandwich: "Carrozza|Texas Tommy|Tantuni|Fajita|Sincronizada|Gringas|Patty melt|Pringá|Mitraillette|Mother-in-law|Spiedie|Muffuletta|Jucy Lucy|Dodger Dog|Fluffernutter|Dyrlægens natmad|Hot Brown|Maxwell Street Polish|Hamdog|Smörgåstårta|Double Down|Mollete",
  pizza: "Flammekueche|Musakhan|Sardenara",
  bread: "Casatiello|Gyeran-ppang|Schiacciata|Pampushka|Fouée|Wotou|Folar|Sabaayad|Himbasha|Fit-fit|Kitcha|Manchet|Blaa|Bakarkhani|Yin si juan|Korovai|Farl|Lazarakia|Rusk|Potbrood|Kifli|Pistolette|Litti|Popover|Kolach|Bhakri|Obi non|Zopf|Tsoureki|Sgabeo|Gibassier|Paska|Khakhra|Pathiri|Jolada rotti|Spoonbread|Kulich|Cozonac|Fougasse|Luchi|Dhebra|Pa amb tomàquet|Torricado",
  pancake: "Puran poli|Thalipeeth|Quarkkäulchen|Talo|Fläskpannkaka|Laobing|Dhokla|Palatschinke|Mücver|Qutab|Lahoh|Ploye|Ponganalu|Borlengo|Fuling jiabing|Chataamari|Baghrir|Racuchy",
  friedDough: "Jian dui|Pantua|Boondi|Zhaliang|Malpua|Ox-tongue pastry|Calas|Gujia|Boortsog|Struffoli|Mekitsa|Khaja|Kokis|Hushpuppy|Vetkoek|Anarsa|Kakara pitha|Gosh-e Fil|Krofne|Uštipci|Kroštule|Fritule|Poornalu|Arisa Pitha|Schuxen|Milho frito|Cronut|Ghevar",
  cake: "Khanom tan|Spongata|Mattentaart|Cartellate|Roccocò|Bint al-sahn|Bibikkan|Bundevara|Pitsi-pitsî|Couque de Dinant|Uirō|Tortell|Croquembouche|Kwareżimal|Pitha|Hanabiramochi|Lo mai chi|Kulolo|Happy Faces|Dhondas|Makroudh|Palitaw|Snickerdoodle|Sklandrausis|Speculaas|Trdelník|Thekua|Blondie|Kūčiukai|Buchteln|Patoleo|Bara brith|Bündner Nusstorte|Dessert bar|Sapin-sapin|Coyotas|Stroopwafel|Tompouce|Sfouf|Tortas de aceite|Éclair|Bear claw|Bienenstich|Pastry heart|Nian gao|Ostkaka|Spettekaka|Vatrushka|Mustacciuoli|Zeeuwse bolus|Smulpaj|Shekerbura|Seri Muka|Šakotis|Mucenici|Yule log|Barmbrack|Rönttönen|Sultsina|Manjū|Enduri Pitha|Carac|Bungeo-ppang|Yaksik|Rijstevlaai|Vlaai|Finikia|Chhena poda|Magenbrot|Lakhamari|Clootie|Zwetschgenkuchen|Amandine|Azerbaijani pakhlava|Pastry|Melomakarono|Cornulețe|Khanom chan|Tinginys",
  pudding: "Boeber|Khanom mo kaeng|Chongos zamoranos|Thapthim krop|Cherries jubilee|Frangollo|Qubani-ka-Meetha|Sheer khurma|Shaved ice|Café liégeois|Chè|Watalappam|Cranachan|Ladob|Bananas Foster|Sorbetes|Knickerbocker glory|Double ka meetha|Moustalevria|Ais kacang|Chhena kheeri|Risalamande|Jiuniang|Rødgrød|Buttermilk koldskål|Haupia|Guilinggao|Floating island|Assidat Zgougou|Teurgoule|Strawberry delight|Tufahije|Ambrosia|Canjica|Ras malai|Tapai|Rožata|Doodhpak|Žemlovka|Bionico|Thiakry|Paskha",
  candy: "Sutarfeni|Chim chum|Amanattō|Khabees|Churma|Calisson|Sachima|Chhena gaja|Kalamay|Kalakand|Khira sagara|Coconut bar|Pootharekulu|Ghari|Slatko|Krówki|Panjiri|Kuli-kuli|Higashi|Chomchom|Panocha|Gozinaki|Namagashi|Polkagris|Havregrynskugle|Salt water taffy|Fios de ovos|Kaju katli|Ruske kape|Tilkut|Chhena Jhili|Gyūhi|Szaloncukor|Túró Rudi|Chaku|Haystack|Kansar|Panellets|Sukhdi|Scotcheroos|Pustakari|Sunnundallu|Kalu dodol|Modjeska|Thong yip",
  grilledMeat: "Carne a la tampiqueña|Meat from tiblica|Bò lúc lắc|Turducken|Fuqi feipian|Chilorio|Vanillerostbraten|Arrosticini|Liver and onions|Jokbal|Babi panggang|Kai yang|Squab|Jingisukan|Bossam|Rostbrätel|Lechazo|Pinnekjøtt|Choila|Carne de vinha d'alhos|Surf and turf|London broil|Smalahove|Cornish game hen|Cochinita pibil|Nam tok|Machaca|Ćevapi|Bistek|Vitello tonnato|Bò nướng lá lốt|Sosatie|Nuea phat phrik|Saltimbocca|Ambelopoulia|Æbleflæsk|Burnt ends|Galinha à africana|Suckling pig|Kokoretsi|Skilpadjies|Gored gored|Bò 7 món|Horumonyaki|Phat khing|Jing Jiang Rou Si|Makchang|Schweinshaxe|Laulau|Frigărui|Phat phrik khing|Flæskesteg|Quzi|Ayam bakar|Poc Chuc|Mu kratha",
  meatballs: "Köttbullar|Meatloaf|Meatcake|Frikadeller|Frikkadel|Zrazy|Slavink|Wallenbergare",
  sausage: "Chaudin|Caltaboș|Pigs in a blanket|Debrecener|Leberkäse|Mustamakkara|Boerewors|Chireta|Pâté|Liver pâté|Rullepølse|Frikandel|Smoked meat|Goetta|Qazı|Prinskorv|Fläskkorv|Ciccioli|Chistorra|Medisterpølse|Balkenbrij|Moronga|Lebanon bologna|Bakkwa|Salo|Landjäger|Cudighi|Pihtije|Chả lụa|Sheftalia|Skilandis|Half-smoke|Kilishi",
  friedMeat: "Gepuk|Kushikatsu|Finger steaks|Swiss wing|Karađorđeva šnicla|Cuchifritos|Laziji|Buffalo wing",
  fish: "Baccalà alla lucana|Buridda|Crappit heid|Cabbie claw|Scampi|Escargot|Orange cuttlefish|Masgouf|Karasumi|Agwi-jjim|Arbroath smokie|Clams casino|Nanbanzuke|Shiokara|Oysters Rockefeller|Pollock roe|Rakfisk|Ankimo|San-nakji|Cappon magro|Paling in 't groen|Huachinango a la Veracruzana|Oysters Bienville|Ikan goreng|Hinava|Fesikh|Bagnun",
  salad: "Selat solo|Kachumbari|Yusheng|Celery Victor|Miang kham|Ulam|Gỏi cuốn|Ketoprak|Lalab|Namasu|Dakos|Curtido|Asinan|Lawar",
  vegDish: "Dodo ikire|Nopalito|Umeboshi|Chadachadi|Kaipen|Khatkhate|Sataraš|Laverbread|Santula|Matbukha|Makdous|Carciofi alla giudia|Dongchimi|Buddha's delight|Yuxiang|Buntil|Botok|Rajas con crema|Romeritos|Pao cai|Zarangollo|Chanpurū|Lecsó|Chwinamul|Soybean sprout|Ajapsandali|Murături|Escalivada|Kuluban|Pkhali",
  starchSide: "Fried plantain|Elote|Pyttipanna|Potatoes O'Brien|Truffade|Brændende kærlighed|Trinxat|Alloco",
  legumes: "Ekuru|Hiyayakko|Agedashi dōfu|Nattō|Fabada asturiana|Lobio|Ghugni|Misal|Usal|Umngqusho|Tavče gravče|Fabes con almejas|Frejon|Caparrones|Kinema|Jhunka|Baghali ghatogh",
  egg: "Soufflé|Hangtown fry|Eggs Sardou|Eggs Neptune|Çılbır|Oeufs en meurette|Gyeran-jjim|Kerak telor",
  cheeseDish: "Zagorski Štrukli|Ġbejna|Obatzda|Frico|Smažený sýr|Queijo do Pico",
  casserole: "Tavë Kosi|Johnny Marzetti|Flying Jacob|Tepsi baytinijan|Patatnik|Giouvetsi|Janssons frestelse|Slinger|Podvarak",
  drink: "Douzhi|Solkadhi|Kompot",
  sauce: "Tempoyak|Sirop de Liège|Tsukudani|Tarama|Cincalok|Chermoula|Cacık|Urnebes|Jeow bong|Serundeng|Kartoffelkäse",
  bowl: "Anju|Sadhya|Fatteh|Gujeolpan|Brotzeit|Samay Baji",
  chips: "Bombay mix|Chakodi",
};

const BY_LABEL = new Map<string, Family>();
for (const [family, list] of Object.entries(HAND) as [Family, string][]) for (const l of list.split("|")) BY_LABEL.set(l, family);

/** Words in a dish's name that place it in a family, most specific first. */
const RULES: [Family, RegExp][] = [
  ["noodleSoup", /\b(pho|ramen|udon soup|laksa|soto|mee soup|noodle soup|bak kut|kalguksu|jjamppong|saimin|khao soi|bun bo|mohinga|lagman|laghman)\b/i],
  ["soup", /\b(soup|broth|consomm|bouillon|gazpacho|borscht|borsch|chowder|bisque|minestr|potage|velout|caldo|sopa|zuppa|shchi|solyanka|rassolnik|okroshka|guk|tang|jjigae|miso|dashi|harira|chorba|shorba|çorba|ciorb|juha|polévka|zupa|sopas|suimono|kharcho|khash|tom yum|tom kha|sinigang|pozole|menudo|avgolemono|pottage|goulash soup|cock-a-leekie|cullen skink|vichyssoise|ribollita|acquacotta)\b/i],
  ["stew", /\b(stew|ragout|ragù|ragu|goulash|gulyás|gulasch|pörkölt|paprikash|tagine|tajine|casserole|cassoulet|daube|bourguignon|fricass|chili|chilli|hotpot|hot pot|nabe|feijoada|cozido|olla|puchero|estofado|guisado|sancocho|ajiaco|locro|mafe|maafe|jollof|étouffée|etouffee|gumbo|jambalaya|stroganoff|navarin|blanquette|irish stew|scouse|cawl|bigos|chakapuli|chanakhi|khoresh|khoresht|stifado|kokkinisto|yahni|matelote|bouillabaisse|cioppino|brudet|pepperpot|bredie|potjie|oyakodon|sukiyaki|nikujaga|dimlama|shurpa)\b/i],
  ["curry", /\b(curry|masala|korma|vindaloo|tikka|makhani|rogan josh|jalfrezi|dopiaza|biryani|biriyani|rendang|gulai|kari|kare|massaman|panang|keema|saag|palak|dal|dhal|daal|sambar|rasam|kadhi|kofta|nihari|haleem|paneer|chana|chole|rajma|aloo|gobi|bhuna|pasanda|dhansak|balti|opor|kapitan)\b/i],
  ["noodles", /\b(noodle|chow mein|lo mein|pad thai|pad see ew|yakisoba|soba|udon|ramen|mee|mie|bihun|bee hoon|kway teow|char kway|japchae|naengmyeon|pancit|spätzle|spaetzle|halušky|haluski|kluski|lokshen|vermicelli|glass noodle|rice noodle|misua|mian|lamian|dan dan|zhajiangmian|jajangmyeon)\b/i],
  ["pasta", /\b(pasta|spaghetti|linguine|fettuccine|tagliatelle|pappardelle|penne|rigatoni|macaroni|mac and cheese|lasagn|ravioli|tortellini|tortelloni|agnolotti|cannelloni|gnocchi|orecchiette|trofie|pici|bucatini|carbonara|amatriciana|bolognese|puttanesca|cacio e pepe|pesto|ziti|farfalle|fusilli|orzo|culurgiones|malloreddus|pansotti|strozzapreti|garganelli|cavatelli|bigoli|maltagliati|pizzoccheri|tajarin|casoncelli|marubini|anolini|cappelletti|passatelli|maccheroni|busiate|lorighittas|fregola)\b/i],
  ["rice", /\b(rice|risotto|paella|pilaf|pilau|plov|pulao|polo|chelow|kabsa|mandi|majboos|machboos|maqluba|mujaddara|arroz|nasi|onigiri|bibimbap|donburi|don\b|gyūdon|gyudon|katsudon|kaisendon|tekkadon|chahan|fried rice|congee|jook|juk|porridge|arancini|supplì|suppli|jambalaya|khichdi|khichri|kedgeree|dolma|sarma|zongzi|lemang|ketupat|lontong|biryani|omurice|kimbap|gimbap|sushi|temaki|maki|nigiri|chirashi|poke)\b/i],
  ["dumplings", /\b(dumpling|jiaozi|gyoza|gyōza|wonton|wantan|baozi|bao|xiaolongbao|shumai|siu mai|har gow|momo|mandu|pierogi|pierogy|pelmeni|vareniki|varenyky|khinkali|manti|mantı|buuz|chuchvara|knödel|knoedel|kluski|pyzy|kopytka|klöße|klösse|germknödel|dampfnudel|tangyuan|potsticker|gnudi|kreplach|pastizzi)\b/i],
  ["pancake", /\b(pancake|crêpe|crepe|galette|blini|blintz|palatschinken|palačinke|naleśniki|dosa|uttapam|appam|hopper|idli|injera|pannenkoek|poffertjes|dutch baby|kaiserschmarrn|waffle|gofre|syrniki|oladyi|draniki|latke|rösti|rosti|boxty|hash brown|jianbing|bánh xèo|banh xeo|okonomiyaki|chilla|cheela|pesarattu|crumpet|pikelet|hotcake|flapjack|tortita|arepa|cachapa|farinata|socca|cecina)\b/i],
  ["fish", /\b(fish|salmon|tuna|cod|haddock|hake|herring|mackerel|sardine|anchov|trout|carp|tilapia|catfish|snapper|bass|bream|sole|halibut|flounder|plaice|turbot|swordfish|eel|unagi|squid|calamari|octopus|shrimp|prawn|lobster|crab|crayfish|crawfish|clam|mussel|oyster|scallop|cockle|seafood|bacalhau|bacalao|baccalà|baccala|stockfish|lutefisk|gravlax|lox|kipper|rollmops|surströmming|fishcake|fish cake|fish ball|gefilte|brandade|ceviche|aguachile|poke|sashimi|tataki|tiradito|kinilaw|kokoda|oka|hoe|hoe-deopbap|finnan|cullen|kedgeree|moqueca|zarzuela|caldeirada|cataplana|bouillabaisse|cioppino|paella de marisco|fideuà|fideua)\b/i],
  ["salad", /\b(salad|salat|salade|ensalada|insalata|slaw|coleslaw|tabbouleh|tabouli|fattoush|caprese|niçoise|nicoise|waldorf|cobb|caesar|som tam|som tum|larb|laab|yam|gado-gado|gado gado|urap|pecel|rojak|kerabu|ensalada|vinegret|vinaigrette|olivier|shopska|horiatiki|panzanella|raita|kachumber|koshimbir|kosambari|chaat|salpicon|salpicón|ceviche|poke|namul|muchim|sunomono|goma-ae|ohitashi|shirae|kinpira)\b/i],
  ["savoryPastry", /\b(samosa|empanada|pastel|pasty|burek|börek|borek|bourekas|gözleme|gozleme|spanakopita|tiropita|kolokythopita|khachapuri|pirog|pirozhki|piroshki|pierożki|kubbeh|kibbeh|kibbe|sfiha|fatayer|manakish|lahmacun|pide|calzone|stromboli|quiche|tourtière|pâté en croûte|pastilla|bastilla|b'stilla|briouat|brik|bureki|banitsa|kolache|kalach|knish|curry puff|karipap|epok|spring roll|egg roll|lumpia|chả giò|cha gio|rissole|coxinha|croquet|kroket|pastelito|salteña|saltena|tequeño|papa rellena|arepa|pupusa|gordita|tamale|tamal|sope|huarache|tlayuda|chalupa|tostada|tostado|flauta|taquito)\b/i],
  ["sandwich", /\b(sandwich|burger|hamburger|cheeseburger|sub\b|hoagie|po' boy|po boy|panini|panino|tramezzino|croque|bocadillo|torta|cemita|pambazo|bánh mì|banh mi|kebab|döner|doner|shawarma|gyro|gyros|souvlaki pita|wrap|burrito|taco|quesadilla|hot dog|hotdog|corn dog|cheesesteak|reuben|club|blt|sloppy joe|francesinha|chivito|lomito|choripán|choripan|bauru|bifana|prego|jibarito|smørrebrød|smorrebrod|montadito|vada pav|dabeli|pav bhaji|kati roll|frankie|roti john|zapiekanka|langos|lángos|toast)\b/i],
  ["pizza", /\b(pizza|flammkuchen|tarte flambée|focaccia|pissaladière|farinata|sfincione|pinsa|piadina|coca\b|lahmajun|manaeesh|khachapuri|okonomiyaki|pajeon|jeon|chijimi|jeon|takoyaki)\b/i],
  ["bread", /\b(bread|loaf|roll|bun|baguette|brioche|ciabatta|pita|naan|roti|chapati|paratha|puri|poori|bhatura|kulcha|injera|lavash|lafa|laffa|matzo|matzah|tortilla|bagel|pretzel|brezel|challah|pumpernickel|rye|soda bread|scone|biscuit|crumpet|muffin|english muffin|focaccia|pogača|pogaca|simit|bazlama|yufka|tandır|chapata|bolillo|telera|pan\b|pão|pao de|broa|borodinsky|arepa|cornbread|hushpupp|johnnycake|bannock|damper|kisra|khubz|markook|taboon|ka'ak|kaak|mantou|shaobing|youtiao|bing\b|pane\b|grissini|taralli|friselle|piadina|crescentina|gnocco|tigella|panuozzo|bammy)\b/i],
  ["friedDough", /\b(doughnut|donut|churro|beignet|fritter|sufganiyah|bombolone|berliner|krapfen|pączki|paczki|malasada|loukoumades|lokma|bamiyeh|zalabia|zeppole|sopaipilla|sopapilla|buñuelo|bunuelo|funnel cake|olliebollen|oliebol|mandazi|puff-puff|puff puff|chin chin|koeksister|jalebi|imarti|balushahi|gulab jamun|youtiao|bambalouni|sfenj|ghoriba|yoyo|picarones|castagnole|frittelle|chiacchiere|crostoli|angel wings|faworki|khvorost|beignets|fried dough|fry bread|frybread|langos)\b/i],
  ["cake", /\b(cake|torte|tart|tarte|pie\b|gateau|gâteau|brownie|cheesecake|strudel|baklava|kunafa|knafeh|künefe|kataifi|galaktoboureko|bougatsa|basbousa|revani|namoura|halva|halwa|kheer|payasam|sheera|kesari|cookie|biscotti|macaron|macaroon|madeleine|financier|éclair|eclair|profiterole|cream puff|choux|croissant|pain au chocolat|danish|cinnamon roll|kanelbulle|babka|kugelhopf|gugelhupf|panettone|pandoro|stollen|lebkuchen|pfeffernüsse|linzer|sachertorte|dobos|esterházy|krempita|kremšnita|napoleon|mille-feuille|millefeuille|pavlova|lamington|trifle|tiramisu|cannoli|sfogliatella|zeppole|pastiera|cassata|panforte|crostata|torta|bundt|pound cake|sponge|swiss roll|roulade|charlotte|clafoutis|far breton|kouign|pastel de nata|pastéis|queijada|bolo|quindim|brigadeiro|alfajor|chajá|tres leches|pionono|kek|kuchen|makowiec|sernik|mazurek|piernik|kołacz|kolache|potica|gibanica|šarena|pita|štrukli|strukli|dobos|rigó jancsi|flódni|zserbó|kürtőskalács|chimney cake|mooncake|castella|dorayaki|taiyaki|imagawayaki|daifuku|mochi|dango|yokan|anpan|melonpan|hotteok|bingsu|tteok|kue|kuih|bibingka|puto|kutsinta|ube|halo-halo|mamón|ensaymada|pan de|pastel|cupcake|scone|shortbread|flapjack|parkin|bakewell|eccles|banbury|chelsea bun|bath bun|spotted dick|jam roly|sticky toffee|bread pudding|bread and butter|crumble|cobbler|crisp|buckle|brown betty|grunt|slump|pandowdy|kladdkaka|semla|prinsesstårta|kanelbulle|kringle|wienerbrød|æbleskiver|lefse|krumkake|rosettes|sandbakkels|fattigmann|pepparkakor|vasilopita|koulourakia|karydopita|melomakarona|kourabiedes|diples|loukoumas|ma'amoul|maamoul|ghraybeh|barazek|asabe|kanafeh|qatayef|atayef|basbousa|harissa|meghli|muhallebi|sütlaç|kazandibi|tavuk göğsü|aşure|ashure|güllaç|revani|şekerpare|tulumba|lokum|turrón|turron|polvorón|mantecado|roscón|rosca|pan dulce|concha|marranito|empanada de|capirotada|tarta|torrija|leche frita|filloa|bica|piononos|ensaïmada|coca de)\b/i],
  ["pudding", /\b(pudding|custard|flan|crème brûlée|creme brulee|crème caramel|panna cotta|mousse|pots de crème|zabaglione|sabayon|blancmange|junket|rice pudding|arroz con leche|kheer|payasam|firni|phirni|sago|tapioca|chè|che\b|tong sui|tangyuan|bubur|kolak|halo-halo|hong dou tang|douhua|tofu pudding|mango pudding|muhallebi|malabi|sütlaç|kissel|kisel|mämmi|clafoutis|flummery|fool|syllabub|posset|eton mess|trifle|jelly|jello|gelatin|basundi|rabri|rasmalai|rasgulla|rasgolla|sandesh|mishti doi|shrikhand|kulfi|falooda|cendol|es campur|es teler|bingsu|kakigōri|kakigori|shave ice|granita|sorbet|gelato|ice cream|semifreddo|affogato|sundae|banana split|parfait|frozen yogurt|popsicle|paleta|dondurma|halo)\b/i],
  ["candy", /\b(candy|sweet|toffee|fudge|caramel|nougat|marzipan|praline|brittle|truffle|bonbon|chocolate|lollipop|marshmallow|meringue|halva|halwa|lokum|turkish delight|churchkhela|pastila|zefir|gummy|jelly bean|licorice|liquorice|mochi|tanghulu|dragée|comfit|barfi|burfi|ladoo|laddu|peda|mysore pak|soan papdi|chikki|gajak|rewari|brigadeiro|beijinho|cocada|dulce de leche|cajeta|alegría|palanqueta|jamoncillo|mazapán|mazapan|obleas|pepitoria|tablet|macaroon|rocky road|s'more|smore|fairy floss|cotton candy|candy floss|sugar|amanattō|konpeitō|wagashi|yokan)\b/i],
  ["friedMeat", /\b(fried chicken|karaage|tonkatsu|katsu|schnitzel|milanesa|cotoletta|escalope|cordon bleu|chicken fried|nugget|popcorn chicken|chicken wings|buffalo wings|wings|tempura|fritto misto|fish and chips|fish fingers|pakora|pakoda|bhaji|bhajji|vada|chicharrón|chicharron|crackling|pork rinds|ayam goreng|gai tod|har cheong gai|kaarage|panko|croquette|korokke|menchi|pozharsky)\b/i],
  ["sausage", /\b(sausage|wurst|bratwurst|weisswurst|currywurst|frankfurter|wiener|kielbasa|kiełbasa|chorizo|chouriço|linguiça|salsiccia|salami|pepperoni|mortadella|prosciutto|jamón|jamon|ham|bacon|pancetta|guanciale|lardo|coppa|capocollo|bresaola|speck|andouille|andouillette|boudin|black pudding|blood sausage|morcilla|haggis|scrapple|spam|luncheon|merguez|sujuk|sucuk|lukanka|kulen|cevapi|loukaniko|longganisa|lap cheong|sai ua|naem|isterband|falukorv|fuet|sobrassada|butifarra|botifarra|embutido|cecina|ciauscolo|nduja|'nduja|cotechino|zampone|saucisson|rillettes|pâté|pate|terrine|foie gras|head cheese|brawn|jambon)\b/i],
  ["grilledMeat", /\b(kebab|kabob|kebap|shashlik|shish|satay|sate|yakitori|kushiyaki|anticucho|espetada|souvlaki|brochette|skewer|suya|asado|churrasco|picanha|parrillada|barbecue|bbq|barbacoa|carne asada|steak|bistec|bife|filet|tenderloin|sirloin|ribeye|t-bone|brisket|pastrami|corned beef|roast beef|roast|rotisserie|tandoori|tikka|galbi|kalbi|bulgogi|samgyeopsal|yakiniku|jerk|pinchos|pincho|chuletas|chop|cutlet|pork chop|lamb chop|rack of lamb|leg of lamb|ribs|spare ribs|char siu|siu yuk|lechon|lechón|cochinillo|porchetta|pulled pork|carnitas|al pastor|tacos al pastor|cabrito|mechoui|méchoui|kleftiko|kontosouvli|gyro|shawarma|döner|doner|adana|iskender|köfte|kofte|kofta|cevapi|ćevapi|ćevapčići|pljeskavica|mici|mititei|chislic|biltong|jerky|pemmican|beef|pork|lamb|mutton|veal|venison|goat|duck|goose|turkey|chicken)\b/i],
  ["vegDish", /\b(ratatouille|caponata|piperade|pisto|lecsó|lecso|shakshuka|zaalouk|baba|baba ghanoush|mutabbal|imam bayildi|karnıyarık|moussaka|musaka|stuffed|dolma|yemista|gemista|sarma|golubtsy|gołąbki|sataraš|ajvar|zakuska|pinakbet|laing|ginataang|sayur|tumis|stir-fry|stir fry|stir-fried|chop suey|bhaji|sabzi|sabji|poriyal|thoran|avial|aviyal|kootu|palya|bharta|baingan|bhindi|kurma|namul|kimchi|pickle|sauerkraut|kapusta|gundruk|tsukemono|succotash|creamed spinach|greens|collard|callaloo|efo riro|ewedu|ogbono|egusi|okra|gumbo z|palaver|kontomire|matapa|chakalaka|sukuma|mchicha|ratatouille|tian|gratin|colcannon|champ|bubble and squeak|rumbledethumps|stoemp|stamppot|hutspot|mashed|mash|purée|pure|potato|patata|papas|batata|aloo|kartoffel|rösti|pommes|chips|fries|frites|hash|tater|croquette|gnocchi|kugel|latke)\b/i],
  ["legumes", /\b(hummus|houmous|falafel|ful|foul|ful medames|bean|beans|frijoles|feijão|feijao|lentil|dal|dhal|chickpea|chana|garbanzo|mujaddara|koshari|kushari|cholent|hamin|fasolada|fasole|pasulj|gigandes|fagioli|pasta e fagioli|cassoulet|baked beans|refried|moros|gallo pinto|rice and beans|red beans|hoppin|akara|akla|moi moi|moin moin|ewa|misir|shiro|kik alicha|edamame|natto|nattō|tofu|tempeh|tempe|tahu|dubu|doufu|douhua|yuba|seitan|mapo)\b/i],
  ["egg", /\b(egg|omelette|omelet|frittata|tortilla española|tortilla de patatas|spanish omelette|quiche|shakshuka|shakshouka|huevos|menemen|çılbır|cilbir|eggs benedict|scotch egg|deviled|devilled|tamagoyaki|chawanmushi|oyakodon|kuku|eggah|egg foo|foo young|chả trứng|khai|kai jeow|yam khai|century egg|tea egg|balut|soufflé|souffle|french toast|pain perdu|torrija)\b/i],
  ["cheeseDish", /\b(fondue|raclette|cheese|queso|fromage|formaggio|käse|kase|halloumi|feta|paneer|mozzarella|burrata|stracciatella|ricotta|mascarpone|brie|camembert|welsh rarebit|rarebit|mac and cheese|poutine|aligot|tartiflette|croziflette|käsespätzle|kasespatzle|khachapuri|quesadilla|queso fundido|chile con queso|provoleta|saganaki|tirokafteri|labneh|labne|tzatziki|cacik|jajik|raita|ġbejna|gbejna|bryndza|bryndzové|oscypek|syr|sirne|kajmak|urda|brânză|branza|pão de queijo|pao de queijo|chipa|cheesecake|cheese straw|gougère|gougere|tyropita|tiropita|burek)\b/i],
  ["casserole", /\b(casserole|gratin|bake|baked|pie\b|shepherd|cottage pie|lasagna|moussaka|pastitsio|pastitsada|kugel|hotdish|tater tot|timballo|timbale|sartù|sartu|pasticcio|parmigiana|parmigiano|melanzane|tian|clafoutis|strata|cobbler|tourtière|pot pie|cottage|papet|gratin dauphinois|dauphinoise|hachis parmentier|tartiflette|pastel de papa|pastel de choclo|escondidinho|empadão|bobotie|moussaka|musaka|tavë|tave|tava|güveç|guvec|djuvec|đuveč|kaserol)\b/i],
  ["drink", /\b(tea|chai|coffee|café|cafe|espresso|latte|cappuccino|mocha|juice|smoothie|shake|milkshake|lassi|ayran|doogh|kefir|kombucha|kvass|lemonade|soda|punch|cocktail|mojito|margarita|sangria|wine|beer|cider|sake|soju|vodka|whisky|whiskey|rum|gin|tequila|mezcal|pisco|brandy|liqueur|horchata|agua fresca|atole|champurrado|tejuino|chicha|pulque|boza|sahlab|salep|kissel|sbiten|glühwein|gluhwein|mulled|eggnog|posset|hot chocolate|cocoa|milk|bubble tea|boba|thai tea|teh|kopi|cendol|falooda|sharbat|sherbet|jallab|tamarind|sugarcane|coconut water|yakult|ramune|mate|maté|tereré|chicha morada|masala chai|bandrek|wedang)\b/i],
  ["sauce", /\b(sauce|salsa|dip|chutney|relish|pesto|aioli|mayonnaise|mayo|ketchup|mustard|hollandaise|béarnaise|bearnaise|gravy|jus|coulis|compote|jam|jelly|marmalade|preserve|spread|paste|sambal|sambol|harissa|zhug|schug|chimichurri|mojo|romesco|tahini|tarator|skordalia|toum|muhammara|tapenade|guacamole|hummus|baba|ajvar|pindjur|lyutenitsa|tkemali|adjika|satsivi|nam prik|nam jim|nuoc cham|nước chấm|ponzu|tare|teriyaki|hoisin|oyster sauce|xo sauce|chili oil|gochujang|doenjang|ssamjang|miso|mole|pipián|pipian|recado|achiote|sofrito|refogado|soffritto|mirepoix|roux|béchamel|velouté|espagnole|demi-glace|beurre blanc|ragout|mostarda|mostarda di)\b/i],
  ["bowl", /\b(bowl|plate|platter|thali|bento|meze|mezze|tapas|antipasto|smorgasbord|banchan|dim sum|yum cha|zakuski|osechi|combo|set meal|nasi campur|nasi padang|rijsttafel|sadya|combination)\b/i],
  ["porridge", /\b(porridge|oatmeal|grits|polenta|mămăligă|mamaliga|kasha|congee|jook|juk|bubur|pap|ugali|sadza|nshima|fufu|banku|kenkey|eba|garri|amala|tuwo|pounded yam|funge|funchi|cou-cou|coocoo|mealie|mielie|genfo|kitfo|atole|champurrado|tsampa|khichdi|pongal|upma|poha|dalia|semolina|cream of wheat|farina|muesli|granola|cereal)\b/i],
];

/** Which family a dish the model named belongs to. */
export function familyOf(label: string): Family {
  const hand = BY_LABEL.get(label);
  if (hand) return hand;
  return RULES.find(([, re]) => re.test(label))?.[0] ?? "dish";
}

/**
 * A dish the library does not know, as a food with estimated figures and a
 * typical portion — so a recognised photo of it can be logged. `src: "ai"`
 * marks the figures as an estimate wherever they are shown.
 */
export function estimateFood(label: string): Food {
  const family = familyOf(label);
  const f = FAMILIES[family];
  const id = `est:${label}`;
  registerPortion(id, { g: f.g, he: f.portionHe, en: f.portionEn });
  return {
    ...adhocFood(label, f.tag),
    id,
    he: `${label} · ${f.he}`,
    en: `${label} · ${f.en}`,
    n: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat },
    src: "ai",
  };
}
