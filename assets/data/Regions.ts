/**
 * Defines the structure for a single province entry, used in the
 * tabular lookup after the geospatial check.
 */
export interface ProvinceEntry {
  label: string; // e.g., 'Ilocos Norte' (user-friendly UI label)
  value: string; // e.g., 'Ilocos Norte' (with space, matches standard name)
  gadm41_label: string; // e.g., 'IlocosNorte' (EXACT MATCH for GeoJSON NAME_1)
}

/**
 * Defines the structure for a region containing a list of provinces.
 */
export interface RegionEntry {
  region: string; // e.g., 'Region I'
  provinces: ProvinceEntry[];
}

/**
 * Tabular mapping of provinces to their respective regions.
 * NOTE: The 'gadm41_label' field MUST EXACTLY match the NAME_1 property in the GeoJSON file.
 */
export const provincesByRegion: RegionEntry[] = [
  {
    region: 'Region I',
    provinces: [
      {
        label: 'Ilocos Norte',
        value: 'Ilocos Norte',
        gadm41_label: 'IlocosNorte',
      },
      { label: 'Ilocos Sur', value: 'Ilocos Sur', gadm41_label: 'IlocosSur' },
      { label: 'La Union', value: 'La Union', gadm41_label: 'LaUnion' },
      { label: 'Pangasinan', value: 'Pangasinan', gadm41_label: 'Pangasinan' },
    ],
  },
  {
    region: 'CAR',
    provinces: [
      { label: 'Abra', value: 'Abra', gadm41_label: 'Abra' },
      { label: 'Apayao', value: 'Apayao', gadm41_label: 'Apayao' },
      { label: 'Benguet', value: 'Benguet', gadm41_label: 'Benguet' },
      { label: 'Ifugao', value: 'Ifugao', gadm41_label: 'Ifugao' },
      { label: 'Kalinga', value: 'Kalinga', gadm41_label: 'Kalinga' },
      {
        label: 'Mountain Province',
        value: 'Mountain Province',
        gadm41_label: 'MountainProvince',
      },
    ],
  },
  {
    region: 'Region II',
    provinces: [
      { label: 'Batanes', value: 'Batanes', gadm41_label: 'Batanes' },
      { label: 'Cagayan', value: 'Cagayan', gadm41_label: 'Cagayan' },
      { label: 'Isabela', value: 'Isabela', gadm41_label: 'Isabela' },
      {
        label: 'Nueva Vizcaya',
        value: 'Nueva Vizcaya',
        gadm41_label: 'NuevaVizcaya',
      },
      { label: 'Quirino', value: 'Quirino', gadm41_label: 'Quirino' },
    ],
  },
  {
    region: 'Region III',
    provinces: [
      { label: 'Aurora', value: 'Aurora', gadm41_label: 'Aurora' },
      { label: 'Bataan', value: 'Bataan', gadm41_label: 'Bataan' },
      { label: 'Bulacan', value: 'Bulacan', gadm41_label: 'Bulacan' },
      {
        label: 'Nueva Ecija',
        value: 'Nueva Ecija',
        gadm41_label: 'NuevaEcija',
      },
      { label: 'Pampanga', value: 'Pampanga', gadm41_label: 'Pampanga' },
      { label: 'Tarlac', value: 'Tarlac', gadm41_label: 'Tarlac' },
      { label: 'Zambales', value: 'Zambales', gadm41_label: 'Zambales' },
    ],
  },
  {
    region: 'NCR',
    // NOTE: GeoJSON uses 'MetropolitanManila' (spaces removed)
    provinces: [
      {
        label: 'Metro Manila',
        value: 'Metropolitan Manila',
        gadm41_label: 'MetropolitanManila',
      },
    ],
  },
  {
    region: 'Region IV-A',
    provinces: [
      { label: 'Batangas', value: 'Batangas', gadm41_label: 'Batangas' },
      { label: 'Cavite', value: 'Cavite', gadm41_label: 'Cavite' },
      { label: 'Laguna', value: 'Laguna', gadm41_label: 'Laguna' },
      { label: 'Quezon', value: 'Quezon', gadm41_label: 'Quezon' },
      { label: 'Rizal', value: 'Rizal', gadm41_label: 'Rizal' },
    ],
  },
  {
    region: 'Region IV-B',
    provinces: [
      { label: 'Marinduque', value: 'Marinduque', gadm41_label: 'Marinduque' },
      {
        label: 'Occidental Mindoro',
        value: 'Occidental Mindoro',
        gadm41_label: 'OccidentalMindoro',
      },
      {
        label: 'Oriental Mindoro',
        value: 'Oriental Mindoro',
        gadm41_label: 'OrientalMindoro',
      },
      { label: 'Palawan', value: 'Palawan', gadm41_label: 'Palawan' },
      { label: 'Romblon', value: 'Romblon', gadm41_label: 'Romblon' },
    ],
  },
  {
    region: 'Region V',
    provinces: [
      { label: 'Albay', value: 'Albay', gadm41_label: 'Albay' },
      {
        label: 'Camarines Norte',
        value: 'Camarines Norte',
        gadm41_label: 'CamarinesNorte',
      },
      // FIX for 'CamarinesSur' mismatch
      {
        label: 'Camarines Sur',
        value: 'Camarines Sur',
        gadm41_label: 'CamarinesSur',
      },
      {
        label: 'Catanduanes',
        value: 'Catanduanes',
        gadm41_label: 'Catanduanes',
      },
      { label: 'Masbate', value: 'Masbate', gadm41_label: 'Masbate' },
      { label: 'Sorsogon', value: 'Sorsogon', gadm41_label: 'Sorsogon' },
    ],
  },
  {
    region: 'Region VI',
    provinces: [
      { label: 'Aklan', value: 'Aklan', gadm41_label: 'Aklan' },
      { label: 'Antique', value: 'Antique', gadm41_label: 'Antique' },
      { label: 'Capiz', value: 'Capiz', gadm41_label: 'Capiz' },
      { label: 'Guimaras', value: 'Guimaras', gadm41_label: 'Guimaras' },
      { label: 'Iloilo', value: 'Iloilo', gadm41_label: 'Iloilo' },
      {
        label: 'Negros Occidental',
        value: 'Negros Occidental',
        gadm41_label: 'NegrosOccidental',
      },
    ],
  },
  {
    region: 'Region VII',
    provinces: [
      { label: 'Bohol', value: 'Bohol', gadm41_label: 'Bohol' },
      { label: 'Cebu', value: 'Cebu', gadm41_label: 'Cebu' },
      {
        label: 'Negros Oriental',
        value: 'Negros Oriental',
        gadm41_label: 'NegrosOriental',
      },
      { label: 'Siquijor', value: 'Siquijor', gadm41_label: 'Siquijor' },
    ],
  },
  {
    region: 'Region VIII',
    provinces: [
      { label: 'Biliran', value: 'Biliran', gadm41_label: 'Biliran' },
      {
        label: 'Eastern Samar',
        value: 'Eastern Samar',
        gadm41_label: 'EasternSamar',
      },
      { label: 'Leyte', value: 'Leyte', gadm41_label: 'Leyte' },
      {
        label: 'Northern Samar',
        value: 'Northern Samar',
        gadm41_label: 'NorthernSamar',
      },
      { label: 'Samar', value: 'Samar', gadm41_label: 'Samar' },
      {
        label: 'Southern Leyte',
        value: 'Southern Leyte',
        gadm41_label: 'SouthernLeyte',
      },
    ],
  },
  {
    region: 'Region IX',
    provinces: [
      {
        label: 'Zamboanga del Norte',
        value: 'Zamboanga del Norte',
        gadm41_label: 'ZamboangadelNorte',
      },
      {
        label: 'Zamboanga del Sur',
        value: 'Zamboanga del Sur',
        gadm41_label: 'ZamboangadelSur',
      },
      {
        label: 'Zamboanga Sibugay',
        value: 'Zamboanga Sibugay',
        gadm41_label: 'ZamboangaSibugay',
      },
    ],
  },
  {
    region: 'Region X',
    provinces: [
      { label: 'Bukidnon', value: 'Bukidnon', gadm41_label: 'Bukidnon' },
      { label: 'Camiguin', value: 'Camiguin', gadm41_label: 'Camiguin' },
      {
        label: 'Lanao del Norte',
        value: 'Lanao del Norte',
        gadm41_label: 'LanaodelNorte',
      },
      {
        label: 'Misamis Occidental',
        value: 'Misamis Occidental',
        gadm41_label: 'MisamisOccidental',
      },
      {
        label: 'Misamis Oriental',
        value: 'Misamis Oriental',
        gadm41_label: 'MisamisOriental',
      },
    ],
  },
  {
    region: 'Region XI',
    provinces: [
      {
        label: 'Davao de Oro',
        value: 'Davao de Oro',
        gadm41_label: 'DavaodeOro',
      },
      {
        label: 'Davao del Norte',
        value: 'Davao del Norte',
        gadm41_label: 'DavaodelNorte',
      },
      {
        label: 'Davao del Sur',
        value: 'Davao del Sur',
        gadm41_label: 'DavaodelSur',
      },
      {
        label: 'Davao Oriental',
        value: 'Davao Oriental',
        gadm41_label: 'DavaoOriental',
      },
      {
        label: 'Davao Occidental',
        value: 'Davao Occidental',
        gadm41_label: 'DavaoOccidental',
      },
    ],
  },
  {
    region: 'Region XII',
    provinces: [
      { label: 'Cotabato', value: 'Cotabato', gadm41_label: 'Cotabato' },
      { label: 'Sarangani', value: 'Sarangani', gadm41_label: 'Sarangani' },
      {
        label: 'South Cotabato',
        value: 'South Cotabato',
        gadm41_label: 'SouthCotabato',
      },
      {
        label: 'Sultan Kudarat',
        value: 'Sultan Kudarat',
        gadm41_label: 'SultanKudarat',
      },
    ],
  },
  {
    region: 'Caraga',
    provinces: [
      {
        label: 'Agusan del Norte',
        value: 'Agusan del Norte',
        gadm41_label: 'AgusandelNorte',
      },
      {
        label: 'Agusan del Sur',
        value: 'Agusan del Sur',
        gadm41_label: 'AgusandelSur',
      },
      {
        label: 'Dinagat Islands',
        value: 'Dinagat Islands',
        gadm41_label: 'DinagatIslands',
      },
      {
        label: 'Surigao del Norte',
        value: 'Surigao del Norte',
        gadm41_label: 'SurigaodelNorte',
      },
      {
        label: 'Surigao del Sur',
        value: 'Surigao del Sur',
        gadm41_label: 'SurigaodelSur',
      },
    ],
  },
  {
    region: 'BARMM',
    provinces: [
      { label: 'Basilan', value: 'Basilan', gadm41_label: 'Basilan' },
      {
        label: 'Lanao del Sur',
        value: 'Lanao del Sur',
        gadm41_label: 'LanaodelSur',
      },
      {
        label: 'Maguindanao del Norte',
        value: 'Maguindanao del Norte',
        gadm41_label: 'MaguindanaodelNorte',
      },
      {
        label: 'Maguindanao del Sur',
        value: 'Maguindanao del Sur',
        gadm41_label: 'MaguindanaodelSur',
      },
      { label: 'Sulu', value: 'Sulu', gadm41_label: 'Sulu' },
      { label: 'Tawi-Tawi', value: 'Tawi-Tawi', gadm41_label: 'TawiTawi' },
    ],
  },
];

/**
 * Finds the corresponding region for a given province name using the tabular data.
 * @param provinceName The NAME_1 value from the GeoJSON (e.g., 'CamarinesSur')
 * @returns The region name (e.g., 'Region V') or null.
 */
export const findRegionForProvince = (provinceName: string): string | null => {
  // We now rely on the gadm41_label being an exact match for the GeoJSON name (provinceName).

  for (const regionEntry of provincesByRegion) {
    if (
      regionEntry.provinces.some(
        // Look up using the new EXACT-MATCH property
        (province) => province.gadm41_label === provinceName,
      )
    ) {
      return regionEntry.region;
    }
  }
  return null;
};
