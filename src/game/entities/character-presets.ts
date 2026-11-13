export type CharacterGender = 'male' | 'female'

export type OutfitPresetId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export const MIN_OUTFIT_ID = 1
export const MAX_OUTFIT_ID = 10

export interface OutfitPresetMeta {
  id: OutfitPresetId
  gender: CharacterGender
  footwear: 'sneakers' | 'sandals'
  name: string
  subtitle: string
  description: string
  hatName: string
  topName: string
  bottomName: string
  shoesName: string
}

export const OUTFIT_PRESETS: OutfitPresetMeta[] = [
  {
    id: 1,
    gender: 'male',
    footwear: 'sneakers',
    name: 'Casual Striker',
    subtitle: 'Street Casual',
    description:
      'Topi trucker dua warna, kaos santai boxy, celana jeans rolled-cuff, dan sepatu boot chunky.',
    hatName: 'Trucker Cap',
    topName: 'Boxy Tee',
    bottomName: 'Rolled Jeans',
    shoesName: 'Chunky Boots',
  },
  {
    id: 2,
    gender: 'male',
    footwear: 'sandals',
    name: 'Jawara Nusantara',
    subtitle: 'Pendekar Tradisional',
    description:
      'Udeng ikat kepala batik, baju pangsi pesilat, sabuk emas nusantara, dan celana komprang.',
    hatName: 'Udeng Tradisional',
    topName: 'Baju Pangsi & Sabuk',
    bottomName: 'Celana Komprang',
    shoesName: 'Sandal Jawara',
  },
  {
    id: 3,
    gender: 'male',
    footwear: 'sneakers',
    name: 'Street Sprinter',
    subtitle: 'Urban Runner',
    description:
      'Topi terbalik dengan jambul rambut, hoodie santai saku kanguru, dan celana training garis samping.',
    hatName: 'Backwards Cap & Tuft',
    topName: 'Kangaroo Hoodie',
    bottomName: 'Trackpants',
    shoesName: 'Running Kicks',
  },
  {
    id: 4,
    gender: 'male',
    footwear: 'sneakers',
    name: 'Athletic Runner',
    subtitle: 'Sporty Sprinter',
    description:
      'Rambut spike energik, sweatband dahi, tank top tanpa lengan, dan celana pendek atletik.',
    hatName: 'Sweatband & Hair',
    topName: 'Athletic Tank',
    bottomName: 'Sport Shorts',
    shoesName: 'Sport Shoes',
  },
  {
    id: 5,
    gender: 'male',
    footwear: 'sneakers',
    name: 'Bocil Pramuka',
    subtitle: 'Seragam Sekolah',
    description:
      'Baret miring emblem emas garuda, kemeja kacu merah-putih, celana pendek seragam, dan kaus kaki tinggi.',
    hatName: 'Baret Pramuka',
    topName: 'Kemeja Kacu',
    bottomName: 'Celana Seragam',
    shoesName: 'High Socks & Shoes',
  },
  {
    id: 6,
    gender: 'male',
    footwear: 'sneakers',
    name: 'Urban Puffer',
    subtitle: 'Musim Dingin Kota',
    description:
      'Kupluk pom-pom beanie tebal, rompi puffer ber-zipper modern, dan celana kargo saku samping.',
    hatName: 'Pom-Pom Beanie',
    topName: 'Puffer Vest',
    bottomName: 'Cargo Pants',
    shoesName: 'Winter Boots',
  },
  {
    id: 7,
    gender: 'female',
    footwear: 'sandals',
    name: 'Srikandi Nusantara',
    subtitle: 'Pendekar Putri',
    description:
      'Sanggul mahkota emas, kebaya modern ber-selendang, sabuk nusantara, dan rok kain batik.',
    hatName: 'Sanggul & Mahkota',
    topName: 'Kebaya Selendang',
    bottomName: 'Rok Kain Batik',
    shoesName: 'Sandal Tradisional',
  },
  {
    id: 8,
    gender: 'female',
    footwear: 'sneakers',
    name: 'Aero Ponytail',
    subtitle: 'Sprinter Kuncir',
    description:
      'Kuncir ekor kuda energik, visor olahraga, jersey ramping tim, dan rok tenis atletik.',
    hatName: 'Ponytail & Visor',
    topName: 'Jersey Atletik',
    bottomName: 'Rok Tenis Skort',
    shoesName: 'Running Kicks',
  },
  {
    id: 9,
    gender: 'female',
    footwear: 'sneakers',
    name: 'Siswi Pramuka',
    subtitle: 'Seragam Putri',
    description:
      'Baret pramuka dengan rambut sebahu, kemeja kacu putri, rok lipit seragam, dan kaus kaki tinggi.',
    hatName: 'Baret & Rambut Bob',
    topName: 'Kemeja Kacu Putri',
    bottomName: 'Rok Lipit Seragam',
    shoesName: 'High Socks & Shoes',
  },
  {
    id: 10,
    gender: 'female',
    footwear: 'sneakers',
    name: 'Hijab Striker',
    subtitle: 'Atlet Berhijab',
    description:
      'Hijab sporty rapi dengan ikat kepala aksen, tunik jersey lengan panjang, dan celana jogger atletik.',
    hatName: 'Hijab Sporty',
    topName: 'Tunik Lengan Panjang',
    bottomName: 'Sport Jogger',
    shoesName: 'Running Kicks',
  },
]

export function clampOutfitId(outfitId?: number): OutfitPresetId {
  if (typeof outfitId !== 'number' || !Number.isFinite(outfitId)) {
    return MIN_OUTFIT_ID
  }
  const rounded = Math.trunc(outfitId)
  return Math.max(MIN_OUTFIT_ID, Math.min(MAX_OUTFIT_ID, rounded)) as OutfitPresetId
}

export function getOutfitPresetMeta(outfitId: number): OutfitPresetMeta {
  const validId = clampOutfitId(outfitId)
  return OUTFIT_PRESETS.find((preset) => preset.id === validId) ?? OUTFIT_PRESETS[0]!
}

