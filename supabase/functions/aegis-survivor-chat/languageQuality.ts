export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  zu: "isiZulu",
  af: "Afrikaans",
  xh: "isiXhosa",
  st: "Sesotho",
  tn: "Setswana",
  ts: "Xitsonga",
  ve: "Tshivenda",
  nso: "Sepedi",
  nr: "isiNdebele",
  ss: "SiSwati",
  sw: "Swahili",
  fr: "French",
  am: "Amharic",
  ar: "Arabic",
};

const SUPPORTED_LANGUAGE_CODES = new Set(Object.keys(LANGUAGE_LABELS));

export const normalizeLanguageCode = (language?: string): string => {
  const normalized = (language ?? "en").toLowerCase().split("-")[0] ?? "en";
  return SUPPORTED_LANGUAGE_CODES.has(normalized) ? normalized : "en";
};

export const inferLanguageFromMessage = (message: string): string => {
  const value = message.toLowerCase();

  if (/\b(dumela|o\s+kae|ke\s*a\s*leboga|tswee\s*tswee)\b/u.test(value)) return "tn";
  if (/\b(sawubona|ngiyabonga|unjani|ngicela)\b/u.test(value)) return "zu";
  if (/\b(molo|enkosi|unjani|nceda)\b/u.test(value)) return "xh";
  if (/\b(hoe\s+gaan|dankie|asseblief|hallo)\b/u.test(value)) return "af";
  if (/\b(dumela|kea\s*leboha|ka\s*kopo|lumela)\b/u.test(value)) return "st";

  return "en";
};

export const isGreetingMessage = (message: string): boolean => {
  const value = message.trim().toLowerCase();
  return /^(dumela|hello|hi|hey|sawubona|molo|lumela|thobela)\b/u.test(value);
};

export const getGreetingResponse = (language: string): string => {
  const greetings: Record<string, string> = {
    en: "Hello. I am AEGIS, your support assistant. I am here to listen and help you safely. What would you like to talk about today?",
    tn: "Dumela. Ke AEGIS, mothusi wa gago wa tshegetso. Ke teng go go reetsa le go go thusa ka polokego. O ka rata go bua ka eng gompieno?",
    zu: "Sawubona. Ngingu-AEGIS, umsekeli wakho wokuphepha. Ngikhona ukukulalela nokukusiza ngokuphepha. Ungathanda ukukhuluma ngani namhlanje?",
    af: "Hallo. Ek is AEGIS, jou ondersteuningsassistent. Ek is hier om na jou te luister en jou veilig te help. Waaroor wil jy vandag praat?",
    xh: "Molo. Ndingu-AEGIS, umncedisi wakho wenkxaso. Ndilapha ukukuphulaphula nokukunceda ngendlela ekhuselekileyo. Ungathanda ukuthetha ngantoni namhlanje?",
    st: "Lumela. Ke AEGIS, mothusi wa hao wa tshehetso. Ke teng ho o mamela le ho o thusa ka polokeho. O ka rata ho bua ka eng kajeno?",
    ts: "Avuxeni. Hi mina AEGIS, mupfuni wa nseketelo wa wena. Ndzi kona ku ku yingisela ni ku pfuna hi ndlela ya vuhlayiseki. U lava ku vulavula hi yini namuntlha?",
    ve: "Ndaa. Ndi AEGIS, muthusi wau wa thikhedzo. Ndi hone u thetshelesa na u thusa nga ndila yo tsireledzeaho. Ni tama u amba nga mini namusi?",
    nso: "Dumela. Ke AEGIS, mothuši wa gago wa thekgo. Ke mo go go theeletša le go go thuša ka polokego. O nyaka go bolela ka eng lehono?",
    nr: "Lotjhani. Ngingu-AEGIS, umsizi wakho wokweseka. Ngilapha ukukulalela nokukusiza ngokuphepha. Ufuna ukukhuluma ngani namhlanje?",
    ss: "Sawubona. Ngingu-AEGIS, umsiti wakho wekusekela. Ngikhona kukulalela nekukusita ngokuphepha. Ungatsandza kukhuluma ngani lamuhla?",
  };

  return greetings[language] ?? greetings.en;
};

export const isLowQualityResponse = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.length < 20) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;

  const uniqueWords = new Set(words);
  const repetitionRatio = 1 - uniqueWords.size / words.length;

  const bigrams: string[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    bigrams.push(`${words[index]} ${words[index + 1]}`);
  }
  const uniqueBigrams = new Set(bigrams);
  const repeatedBigrams = bigrams.length - uniqueBigrams.size;

  return repetitionRatio > 0.45 || repeatedBigrams > 6;
};

export const isMismatchedLanguageResponse = (text: string, language: string): boolean => {
  if (language === "en") return false;

  const normalized = text.trim().toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 10) return false;

  const markers: Record<string, string[]> = {
    tn: ["ke", "gore", "go", "tsweetswee", "gompieno"],
    zu: ["ngi", "uku", "kanye", "futhi", "sicela"],
    af: ["ek", "jou", "is", "en", "asseblief"],
    xh: ["ndi", "uku", "kwaye", "nceda", "ndiy"],
    st: ["ke", "ho", "mme", "kopo", "lumela"],
    ts: ["ndzi", "ku", "na", "swi", "eka"],
    ve: ["ndi", "zwi", "nahone", "ṋe", "ri"],
    nso: ["ke", "go", "gomme", "bjale", "hle"],
    nr: ["ngi", "begodu", "sicela", "nje", "nawe"],
    ss: ["ngi", "futsi", "sicela", "nyalo", "nawe"],
  };

  const englishMarkers = new Set(["the", "and", "you", "your", "please", "with", "what", "this", "that", "help"]);
  const languageMarkers = markers[language] ?? [];

  const hasLanguageMarker = languageMarkers.some((marker) => normalized.includes(marker));
  const englishCount = words.filter((word) => englishMarkers.has(word)).length;
  const englishRatio = englishCount / words.length;

  return !hasLanguageMarker && englishRatio > 0.35;
};

export const getFallbackSupportResponse = (language: string, riskLevel: string, _userMessage?: string): string => {
  const critical: Record<string, string> = {
    en: "I hear you, and your safety is the top priority right now. Please contact a trusted person or emergency services nearby immediately. If you want, I can guide you through immediate safety steps now.",
    tn: "Ke utlwa botlhoko jo o bo itemogelang. Polokego ya gago e botlhokwa thata gone jaanong. Tsweetswee batla motho yo o mo ikanyang kgotsa tirelo ya tshoganyetso gaufi le wena ka bonako. Fa o batla, nka go thusa ka dikgato tse di bonolo tsa polokego gone jaanong.",
    zu: "Ngiyakuzwa, futhi ukuphepha kwakho kubaluleke kakhulu manje. Sicela uxhumane nomuntu omethembayo noma usizo oluphuthumayo oluseduze ngokushesha. Uma uthanda, ngingakusiza ngezinyathelo eziphuthumayo zokuphepha manje.",
    af: "Ek hoor jou, en jou veiligheid is nou die belangrikste. Kontak asseblief onmiddellik iemand wat jy vertrou of nooddienste naby jou. As jy wil, kan ek jou nou deur onmiddellike veiligheidsstappe lei.",
    xh: "Ndiyakuzwa, kwaye ukhuseleko lwakho lolona lubalulekileyo ngoku. Nceda unxibelelane nomntu omthembayo okanye iinkonzo zikaxakeka ezikufutshane ngokukhawuleza. Ukuba uyafuna, ndingakukhokela kumanyathelo okhuseleko ngoku.",
    st: "Kea u utlwa, mme polokeho ya hao ke yona ya bohlokwa hona jwale. Ka kopo ikopanye kapele le motho eo o mo tshepang kapa ditshebeletso tsa tshohanyetso tse haufi. Ha o batla, nka o tataisa ka mehato ya polokeho hanghang.",
    ts: "Ndzi ku twisisa, naswona vuhlayiseki bya wena i bya nkoka swinene sweswi. Hi kombela u tihlanganisa hi ku hatlisa ni munhu loyi u tshembaka yena kumbe vukorhokeri bya xihatla lebyi nga kusuhi na wena.",
    ve: "Ndi a zwi pfesesa, nahone tsireledzo yau ndi yone ya ndeme zwino. Ri humbela u kwama muthu ane wa mu fulufhela kana thuso ya tshitshavha i re tsini na inwi nga u ṱavhanya.",
    nso: "Ke a go kwa, gomme polokego ya gago ke yona e bohlokwa kudu gona bjale. Hle ikgokaganye ka pela le motho yo o mo tshepago goba ditirelo tša tšhoganetšo tše di lego kgauswi le wena.",
    nr: "Ngiyakuzwa, begodu ukuphepha kwakho kuqakatheke khulu nje. Sicela uthintane msinyana nomuntu omthembako namkha neensetjenziswa zezimo eziphuthumako eziseduze nawe.",
    ss: "Ngiyakuzwa, futsi kuphepha kwakho kubaluleke kakhulu nyalo. Sicela uthintane masinyane nemuntfu lotsembako nome tinsita tetimo letiphutfumako letisedvute nawe.",
  };

  const supportive: Record<string, string> = {
    en: "Thank you for sharing. I am here to support you. Tell me what is worrying you, and we can work through safe, practical next steps together. Let us start with one small step you can take now.",
    tn: "Ke a leboga go bua le nna. Ke fa go go tshegetsa. O ka mpolelela se se go tshwenyang, mme re ka tsaya dikgato tse di bonolo le tse di sireletsegileng mmogo. A re simolole ka kgato e le nngwe e nnyane e o ka e dirang jaanong.",
    zu: "Ngiyabonga ngokukhuluma nami. Ngikhona ukukweseka. Ungangitshela okukhathazayo ukuze sihlele izinyathelo ezilula nezivikelekile ndawonye. Ake siqale ngesinyathelo esisodwa esincane ongakwazi ukusenza manje.",
    af: "Dankie dat jy deel. Ek is hier om jou te ondersteun. Vertel my wat jou bekommer, en ons kan saam deur veilige, praktiese volgende stappe werk. Kom ons begin met een klein stap wat jy nou kan neem.",
    xh: "Enkosi ngokwabelana. Ndilapha ukukuxhasa. Ndixelele into ekukhathazayo, size sisebenze kunye kumanyathelo akhuselekileyo nacacileyo alandelayo. Masiqale ngenyathelo elinye elincinci onokulithatha ngoku.",
    st: "Kea leboha ka ho arolelana. Ke teng ho o tshehetsa. Mpolelle se o tshwenyehileng ka sona, mme re sebetse mmoho mehatong e sireletsehileng le e sebetsang. A re qale ka mohato o le mong o monyane oo o ka o nkang hona jwale.",
    ts: "Ndza khensa leswi u avelaneke swona. Ndzi kona ku ku seketela. Ndzi byele leswi ku karhataka leswaku hi ta teka magoza lama hlayisekeke naswona lama tirhaka. A hi sunguleni hi goza rin'we ro olova leri u nga ri tekaka sweswi.",
    ve: "Ndi a livhuwa nga u kovhekana. Ndi hone u u thusa. Mmbudzeni zwi u khou vhilaedzaho uri ri kone u dzhia maga o tsireledzeaho. Ri thome nga gundo lithihi ḽiṱuku ḽine na nga ḽi ita zwino.",
    nso: "Ke leboga ge o arolelana. Ke mo go go thekga. Mpotšiše se se go tshwenyago gore re tšee magato a polokego ao a šomago. A re thomeng ka kgato e tee e nnyane yeo o ka e tšeago gona bjale.",
    nr: "Ngiyathokoza ngokwabelana. Ngilapha ukukweseka. Ngitjele okukukhathazako ukuze sisebenzisane kumanyathelo aphephileko naqondileko. Asithome ngesinyathelo sinye esincani ongasithatha nje.",
    ss: "Ngiyabonga ngekwabelana. Ngikhona kukusekela. Ngitjele lokukukhatsatako kuze sisebente ndzawonye etinyatselweni letiphephile futsi letisebentako. Asicale ngasinye sinyatelo lesincane longasenta nyalo.",
  };

  if (riskLevel === "critical") {
    return critical[language] ?? critical.en;
  }

  return supportive[language] ?? supportive.en;
};

export const isNearDuplicateResponse = (current: string, previous: string): boolean => {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const a = normalize(current);
  const b = normalize(previous);

  if (!a || !b) return false;
  if (a === b) return true;

  const aWords = new Set(a.split(" "));
  const bWords = new Set(b.split(" "));
  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  const union = new Set([...aWords, ...bWords]).size;
  const similarity = union > 0 ? intersection / union : 0;

  return similarity > 0.85;
};

export const isEchoingUserInput = (responseText: string, userMessage: string): boolean => {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const response = normalize(responseText);
  const user = normalize(userMessage);

  if (!response || !user) return false;
  if (response === user) return true;

  const userWords = user.split(" ").filter(Boolean);
  if (userWords.length < 4) {
    return false;
  }

  const overlap = userWords.filter((word) => response.includes(word)).length / userWords.length;
  const containsLongUserFragment = user.length > 24 && response.includes(user);

  return containsLongUserFragment || overlap > 0.8;
};
