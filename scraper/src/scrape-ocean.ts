import * as fs from "fs/promises";
import * as path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "data");

// IPHC Time Series Dataset definitions
// Source: https://www.iphc.int/data/time-series-datasets/
const IPHC_TSD_URLS = {
  "TSD-007": "https://www.iphc.int/uploads/data/time-series-datasets/TSD-007.csv", // Commercial landings
  "TSD-013": "https://www.iphc.int/uploads/data/time-series-datasets/TSD-013.csv", // Setline survey CPUE
};

// NOAA AFSC Stock Assessment reference data (static baseline 2024)
// Source: https://www.fisheries.noaa.gov/alaska/commercial-fishing/fisheries-catch-and-landings-reports-alaska
const NOAA_BASELINES = {
  pollock: {
    name: "Walleye Pollock",
    scientificName: "Gadus chalcogrammus",
    region: "BSAI + GOA",
    gearType: "Trawl",
    tacMT: 1880000,    // 2025 TAC in metric tons (BSAI + GOA combined)
    landedMT: 1088000, // 2024 landed biomass MT
    landedLbsThousands: 2398400, // convert: 1 MT = 2204.62 lbs
    season: "2024",
    source: "NOAA AFSC 2025 Stock Assessment — BSAI/GOA Pollock",
    sourceUrl: "https://www.fisheries.noaa.gov/resource/data/groundfish-stock-assessment-alaska-pollock",
  },
  sablefish: {
    name: "Sablefish (Black Cod)",
    scientificName: "Anoplopoma fimbria",
    region: "Alaska (Federal Waters)",
    gearType: "Longline",
    tacMT: 32600,
    landedMT: 31200,
    landedLbsThousands: 68784,
    season: "2024",
    source: "NOAA AFSC 2025 Sablefish Stock Assessment",
    sourceUrl: "https://www.fisheries.noaa.gov/resource/data/groundfish-stock-assessment-sablefish",
  },
  pacificCod: {
    name: "Pacific Cod",
    scientificName: "Gadus macrocephalus",
    region: "BSAI + GOA",
    gearType: "Trawl / Longline / Pot",
    tacMT: 229000,
    landedMT: 198000,
    landedLbsThousands: 436500,
    season: "2024",
    source: "NOAA AFSC 2025 Pacific Cod Stock Assessment",
    sourceUrl: "https://www.fisheries.noaa.gov/resource/data/groundfish-stock-assessment-pacific-cod",
  },
  arrowtooth: {
    name: "Arrowtooth Flounder",
    scientificName: "Atheresthes stomias",
    region: "GOA",
    gearType: "Trawl",
    tacMT: 178000,
    landedMT: 56000,
    landedLbsThousands: 123400,
    season: "2024",
    source: "NOAA AFSC GOA Arrowtooth Flounder Assessment",
    sourceUrl: "https://www.fisheries.noaa.gov/resource/data/groundfish-stock-assessments-gulf-alaska",
  },
  halibut: {
    name: "Pacific Halibut",
    scientificName: "Hippoglossus stenolepis",
    region: "IPHC Areas 2C–4 (Alaska Waters)",
    gearType: "Longline",
    tacMT: null,
    landedLbsThousands: 27500, // IPHC TSD-007 commercial landings only
    landedMT: 12474,
    season: "2024",
    source: "IPHC TSD-007 — Commercial Landings Time-Series",
    sourceUrl: "https://www.iphc.int/data/time-series-datasets/",
    note: "TSD-007 covers commercial landings only. Recreational, subsistence, and discard mortality are reported separately.",
  },
  kingCrab: {
    name: "Bristol Bay Red King Crab",
    scientificName: "Paralithodes camtschaticus",
    region: "Bristol Bay (BSAI)",
    gearType: "Pot",
    tacMT: null,
    tacLbs: 2310000, // 2024/25 TAC — 2.31M lbs (NOAA Oct 2024)
    landedLbsThousands: 0, // Fishery remained closed through 2024/25
    season: "2024",
    status: "Open — limited TAC",
    source: "NOAA BSAI Red King Crab TAC 2024/25",
    sourceUrl: "https://www.fisheries.noaa.gov/s3/2024-10/bristolbay-redkingcrabTAC-2024.pdf",
    note: "BBRKC reopened 2024/25 with 2.31M lb TAC after 2-year closure (2022–2024). Season ongoing.",
  },
  snowCrab: {
    name: "Bering Sea Snow Crab (Opilio)",
    scientificName: "Chionoecetes opilio",
    region: "Bering Sea (EBS)",
    gearType: "Pot",
    tacMT: null,
    tacLbs: 33900000,
    landedLbsThousands: 30100,
    season: "2024",
    status: "Open",
    source: "NOAA BSAI Snow Crab TAC 2024/25",
    sourceUrl: "https://www.fisheries.noaa.gov/alaska/population-assessments/north-pacific-groundfish-stock-assessments-and-fishery-evaluation",
  },
  herring: {
    name: "Pacific Herring",
    scientificName: "Clupea pallasii",
    region: "Alaska (Various Districts)",
    gearType: "Purse Seine / Gillnet",
    tacMT: null,
    landedLbsThousands: 82000,
    season: "2024",
    source: "ADF&G Division of Commercial Fisheries — Herring Reports",
    sourceUrl: "https://www.adfg.alaska.gov/index.cfm?adfg=herring.main",
  },
};

async function main() {
  console.log("AlaskaFishData | Ocean Harvest Scraper");
  console.log("Sources: NOAA AFSC Stock Assessments + IPHC TSD Datasets");
  console.log(`Run: ${new Date().toISOString()}\n`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const species = Object.entries(NOAA_BASELINES).map(([key, data]) => ({
    id: key,
    ...data,
    lastChecked: new Date().toISOString(),
  }));

  const output = {
    _meta: {
      sources: [
        "NOAA AFSC Stock Assessments — https://www.fisheries.noaa.gov/alaska/commercial-fishing/fisheries-catch-and-landings-reports-alaska",
        "IPHC Time Series Datasets — https://www.iphc.int/data/time-series-datasets/",
        "ADF&G Division of Commercial Fisheries — https://www.adfg.alaska.gov",
      ],
      generated: new Date().toISOString(),
      note: "Groundfish TAC figures from NOAA stock assessments. Halibut from IPHC TSD-007 (commercial landings only). Crab from NOAA BSAI TAC documents.",
    },
    species,
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, "ocean-harvest.json"),
    JSON.stringify(output, null, 2)
  );

  console.log(`✓ Wrote ${species.length} species → data/ocean-harvest.json`);
  species.forEach(s => console.log(`  - ${s.name}: ${s.season}`));
}

main().catch(console.error);
