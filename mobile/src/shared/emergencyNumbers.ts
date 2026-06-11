/**
 * Per-country emergency numbers. GBV is a worldwide challenge, so the SOS and
 * Resources screens dial the correct local services based on the user's region.
 *
 * Service labels are translated at render time via the i18n `services.*` keys —
 * only the NUMBERS live here. `112` is the GSM-standard emergency number and
 * works on most mobile networks worldwide, so it is the safe fallback.
 *
 * IMPORTANT: these are reference values compiled per region. Emergency and
 * helpline numbers change — verify against official local sources before a
 * production launch in each country.
 */

export type ServiceId = "police" | "gbv" | "ambulance" | "childline" | "mentalHealth";

export interface EmergencyService {
  id: ServiceId;
  number: string; // human-readable, for display
  dial: string; // digits only, for the tel: link
}

export interface CountryEmergency {
  code: string; // ISO 3166-1 alpha-2 (or "INTL")
  name: string; // English name, shown in the region picker
  flag: string; // emoji flag
  ussd?: string;
  services: EmergencyService[];
}

const s = (id: ServiceId, number: string, dial = number.replace(/[^0-9*#]/g, "")): EmergencyService => ({
  id,
  number,
  dial,
});

export const COUNTRIES: CountryEmergency[] = [
  {
    code: "ZA",
    name: "South Africa",
    flag: "🇿🇦",
    ussd: "*134*7355#",
    services: [
      s("police", "10111"),
      s("gbv", "0800 428 428"),
      s("ambulance", "10177"),
      s("childline", "116"),
      s("mentalHealth", "0800 567 567"),
    ],
  },
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    services: [
      s("police", "911"),
      s("gbv", "1-800-799-7233"),
      s("ambulance", "911"),
      s("mentalHealth", "988"),
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    services: [
      s("police", "999"),
      s("gbv", "0808 2000 247"),
      s("ambulance", "999"),
      s("mentalHealth", "116 123"),
    ],
  },
  {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    services: [
      s("police", "911"),
      s("gbv", "1-866-863-0511"),
      s("ambulance", "911"),
      s("mentalHealth", "988"),
    ],
  },
  {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    services: [
      s("police", "000"),
      s("gbv", "1800 737 732"),
      s("ambulance", "000"),
      s("mentalHealth", "13 11 14"),
    ],
  },
  {
    code: "IE",
    name: "Ireland",
    flag: "🇮🇪",
    services: [
      s("police", "112"),
      s("gbv", "1800 341 900"),
      s("ambulance", "112"),
      s("mentalHealth", "116 123"),
    ],
  },
  {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    services: [
      s("police", "112"),
      s("gbv", "181"),
      s("ambulance", "108"),
      s("childline", "1098"),
      s("mentalHealth", "1800-599-0019"),
    ],
  },
  {
    code: "KE",
    name: "Kenya",
    flag: "🇰🇪",
    services: [
      s("police", "999"),
      s("gbv", "1195"),
      s("ambulance", "999"),
      s("childline", "116"),
    ],
  },
  {
    code: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    services: [s("police", "112"), s("ambulance", "112")],
  },
  {
    code: "BR",
    name: "Brazil",
    flag: "🇧🇷",
    services: [
      s("police", "190"),
      s("gbv", "180"),
      s("ambulance", "192"),
      s("mentalHealth", "188"),
    ],
  },
  {
    code: "PT",
    name: "Portugal",
    flag: "🇵🇹",
    services: [
      s("police", "112"),
      s("gbv", "800 202 148"),
      s("ambulance", "112"),
    ],
  },
  {
    code: "ES",
    name: "Spain",
    flag: "🇪🇸",
    services: [
      s("police", "112"),
      s("gbv", "016"),
      s("ambulance", "112"),
    ],
  },
  {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    services: [
      s("police", "17"),
      s("gbv", "3919"),
      s("ambulance", "15"),
    ],
  },
  {
    code: "DE",
    name: "Germany",
    flag: "🇩🇪",
    services: [
      s("police", "110"),
      s("gbv", "116 016"),
      s("ambulance", "112"),
    ],
  },
  {
    code: "IT",
    name: "Italy",
    flag: "🇮🇹",
    services: [
      s("police", "112"),
      s("gbv", "1522"),
      s("ambulance", "112"),
    ],
  },
  {
    code: "MX",
    name: "Mexico",
    flag: "🇲🇽",
    services: [s("police", "911"), s("ambulance", "911")],
  },
  {
    code: "RU",
    name: "Russia",
    flag: "🇷🇺",
    services: [
      s("police", "102"),
      s("gbv", "8-800-7000-600"),
      s("ambulance", "103"),
    ],
  },
  {
    code: "CN",
    name: "China",
    flag: "🇨🇳",
    services: [
      s("police", "110"),
      s("gbv", "12338"),
      s("ambulance", "120"),
    ],
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    flag: "🇸🇦",
    services: [
      s("police", "999"),
      s("gbv", "1919"),
      s("ambulance", "997"),
    ],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    services: [s("police", "999"), s("ambulance", "998")],
  },
  {
    code: "EG",
    name: "Egypt",
    flag: "🇪🇬",
    services: [s("police", "122"), s("ambulance", "123")],
  },
  {
    code: "NZ",
    name: "New Zealand",
    flag: "🇳🇿",
    services: [s("police", "111"), s("gbv", "0800 456 450"), s("ambulance", "111")],
  },
  {
    code: "NL",
    name: "Netherlands",
    flag: "🇳🇱",
    services: [s("police", "112"), s("gbv", "0800 2000"), s("ambulance", "112")],
  },
  {
    code: "BE",
    name: "Belgium",
    flag: "🇧🇪",
    services: [s("police", "112"), s("gbv", "1712"), s("ambulance", "112")],
  },
  {
    code: "SE",
    name: "Sweden",
    flag: "🇸🇪",
    services: [s("police", "112"), s("gbv", "020 50 50 50"), s("ambulance", "112")],
  },
  {
    code: "NO",
    name: "Norway",
    flag: "🇳🇴",
    services: [s("police", "112"), s("gbv", "116 006"), s("ambulance", "113")],
  },
  {
    code: "DK",
    name: "Denmark",
    flag: "🇩🇰",
    services: [s("police", "112"), s("gbv", "1888"), s("ambulance", "112")],
  },
  {
    code: "FI",
    name: "Finland",
    flag: "🇫🇮",
    services: [s("police", "112"), s("gbv", "080 005 005"), s("ambulance", "112")],
  },
  {
    code: "CH",
    name: "Switzerland",
    flag: "🇨🇭",
    services: [s("police", "117"), s("ambulance", "144")],
  },
  {
    code: "AT",
    name: "Austria",
    flag: "🇦🇹",
    services: [s("police", "133"), s("gbv", "0800 222 555"), s("ambulance", "144")],
  },
  {
    code: "PL",
    name: "Poland",
    flag: "🇵🇱",
    services: [s("police", "112"), s("gbv", "800 120 002"), s("ambulance", "112")],
  },
  {
    code: "GR",
    name: "Greece",
    flag: "🇬🇷",
    services: [s("police", "100"), s("gbv", "15900"), s("ambulance", "166")],
  },
  {
    code: "TR",
    name: "Türkiye",
    flag: "🇹🇷",
    services: [s("police", "155"), s("gbv", "183"), s("ambulance", "112")],
  },
  {
    code: "KR",
    name: "South Korea",
    flag: "🇰🇷",
    services: [s("police", "112"), s("gbv", "1366"), s("ambulance", "119")],
  },
  {
    code: "JP",
    name: "Japan",
    flag: "🇯🇵",
    services: [s("police", "110"), s("ambulance", "119")],
  },
  {
    code: "ID",
    name: "Indonesia",
    flag: "🇮🇩",
    services: [s("police", "110"), s("gbv", "129"), s("ambulance", "118")],
  },
  {
    code: "PH",
    name: "Philippines",
    flag: "🇵🇭",
    services: [s("police", "911"), s("gbv", "1343"), s("ambulance", "911")],
  },
  {
    code: "MY",
    name: "Malaysia",
    flag: "🇲🇾",
    services: [s("police", "999"), s("gbv", "15999"), s("ambulance", "999")],
  },
  {
    code: "TH",
    name: "Thailand",
    flag: "🇹🇭",
    services: [s("police", "191"), s("gbv", "1300"), s("ambulance", "1669")],
  },
  {
    code: "PK",
    name: "Pakistan",
    flag: "🇵🇰",
    services: [s("police", "15"), s("gbv", "1099"), s("ambulance", "1122")],
  },
  {
    code: "BD",
    name: "Bangladesh",
    flag: "🇧🇩",
    services: [s("police", "999"), s("gbv", "109"), s("ambulance", "999")],
  },
  {
    code: "AR",
    name: "Argentina",
    flag: "🇦🇷",
    services: [s("police", "911"), s("gbv", "144"), s("ambulance", "107")],
  },
  {
    code: "CL",
    name: "Chile",
    flag: "🇨🇱",
    services: [s("police", "133"), s("gbv", "1455"), s("ambulance", "131")],
  },
  {
    code: "CO",
    name: "Colombia",
    flag: "🇨🇴",
    services: [s("police", "123"), s("gbv", "155"), s("ambulance", "123")],
  },
  {
    code: "PE",
    name: "Peru",
    flag: "🇵🇪",
    services: [s("police", "105"), s("gbv", "100"), s("ambulance", "106")],
  },
  {
    code: "GH",
    name: "Ghana",
    flag: "🇬🇭",
    services: [s("police", "191"), s("ambulance", "193")],
  },
  {
    code: "UG",
    name: "Uganda",
    flag: "🇺🇬",
    services: [s("police", "999"), s("childline", "116")],
  },
  {
    code: "ZW",
    name: "Zimbabwe",
    flag: "🇿🇼",
    services: [s("police", "995"), s("ambulance", "994")],
  },
  {
    code: "INTL",
    name: "International (GSM 112)",
    flag: "🌐",
    services: [s("police", "112"), s("ambulance", "112")],
  },
];

export const DEFAULT_COUNTRY = "INTL";

export function getCountry(code: string | null | undefined): CountryEmergency {
  return (
    COUNTRIES.find((c) => c.code === code) ??
    COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)!
  );
}

export function findService(country: CountryEmergency, id: ServiceId): EmergencyService | undefined {
  return country.services.find((svc) => svc.id === id);
}
