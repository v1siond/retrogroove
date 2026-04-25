// scripts/seed-songs.ts
// Run with: npx tsx scripts/seed-songs.ts

import * as fs from 'fs'
import * as path from 'path'

interface OldSong {
  title: string
  artist: string
}

interface NewSong {
  id: string
  title: string
  artist: string
  bloque: 1 | 2 | 3 | 4 | 'extras'
  youtubePosition: number
  enabled: boolean
}

// YouTube playlist order - canonical order that determines bloques
const PLAYLIST_ORDER: OldSong[] = [
  // Bloque 1: 1-14
  { title: 'Celebration', artist: 'Kool & The Gang' },
  { title: 'September', artist: 'Earth, Wind & Fire' },
  { title: "Let's Groove", artist: 'Earth, Wind & Fire' },
  { title: 'Funkytown', artist: 'Lipps Inc.' },
  { title: 'Disco Inferno', artist: 'The Trammps' },
  { title: 'I Will Survive', artist: 'Gloria Gaynor' },
  { title: 'Hot Stuff', artist: 'Donna Summer' },
  { title: 'Bad Girls', artist: 'Donna Summer' },
  { title: 'Le Freak', artist: 'Chic' },
  { title: 'Get Down on It', artist: 'Kool & The Gang' },
  { title: 'Ladies Night', artist: 'Kool & The Gang' },
  { title: 'You Should Be Dancing', artist: 'Bee Gees' },
  { title: 'Rock With You', artist: 'Michael Jackson' },
  { title: 'Give It Up', artist: 'KC & The Sunshine Band' },

  // Bloque 2: 15-30
  { title: 'Take On Me', artist: 'a-ha' },
  { title: 'Footloose', artist: 'Kenny Loggins' },
  { title: 'Maniac', artist: 'Michael Sembello' },
  { title: 'Heart of Glass', artist: 'Blondie' },
  { title: 'One Way or Another', artist: 'Blondie' },
  { title: 'Like a Virgin', artist: 'Madonna' },
  { title: 'Mamma Mia', artist: 'ABBA' },
  { title: 'Dancing with Myself', artist: 'Billy Idol' },
  { title: 'A Little Respect', artist: 'Erasure' },
  { title: 'Dressed for Success', artist: 'Roxette' },
  { title: "Don't Get Me Wrong", artist: 'The Pretenders' },
  { title: 'Heartbreaker', artist: 'Pat Benatar' },
  { title: 'Goodbye to You', artist: 'Scandal' },
  { title: 'On the Radio', artist: 'Donna Summer' },
  { title: 'Crazy Little Thing Called Love', artist: 'Queen' },
  { title: 'Jump', artist: 'Van Halen' },

  // Bloque 3: 31-45
  { title: 'Música Ligera', artist: 'Soda Stereo' },
  { title: 'Persiana Americana', artist: 'Soda Stereo' },
  { title: 'Prófugos', artist: 'Soda Stereo' },
  { title: 'Lamento Boliviano', artist: 'Enanitos Verdes' },
  { title: 'La Muralla Verde', artist: 'Enanitos Verdes' },
  { title: 'Mil Horas', artist: 'Los Abuelos de la Nada' },
  { title: 'Pronta Entrega', artist: 'Virus' },
  { title: 'Luna de Miel', artist: 'Virus' },
  { title: 'Entre Dos Tierras', artist: 'Héroes del Silencio' },
  { title: 'Mujer Amante', artist: 'Rata Blanca' },
  { title: 'Devuélveme a Mi Chica', artist: 'Hombres G' },
  { title: 'Lobo-Hombre en París', artist: 'La Unión' },
  { title: 'Auto Rojo', artist: 'Vilma Palma e Vampiros' },
  { title: 'Cuando Seas Grande', artist: 'Miguel Mateos' },
  { title: 'La Calle Es Su Lugar', artist: 'GIT' },

  // Bloque 4: 46-60
  { title: 'Estoy Aquí', artist: 'Shakira' },
  { title: 'Antología', artist: 'Shakira' },
  { title: 'Ciega Sordomuda', artist: 'Shakira' },
  { title: 'Inevitable', artist: 'Shakira' },
  { title: 'Pies Descalzos', artist: 'Shakira' },
  { title: 'Te Aviso Te Anuncio', artist: 'Shakira' },
  { title: 'Azúcar Amargo', artist: 'Fey' },
  { title: 'Eternamente Bella', artist: 'Alejandra Guzmán' },
  { title: 'Mírala, Míralo', artist: 'Alejandra Guzmán' },
  { title: 'El Sol No Regresa', artist: 'La 5a Estación' },
  { title: 'Oye Mi Amor', artist: 'Maná' },
  { title: 'Contéstame', artist: 'Grupo Río' },
  { title: 'Decir Adiós', artist: 'Amén' },
  { title: 'Nada Fue un Error', artist: 'Coti' },
  { title: 'Avenida Larco', artist: 'Frágil' },

  // Extras: 61+
  { title: 'Me Estoy Enamorando', artist: 'Pedro Suárez-Vértiz' },
  { title: 'Triciclo Perú', artist: 'Los Mojarras' },
  { title: 'Suna', artist: 'Mar de Copas' },
  { title: 'Zombie', artist: 'The Cranberries' },
  { title: 'Creep', artist: 'Radiohead' },
  { title: 'Mr. Jones', artist: 'Counting Crows' },
  { title: 'Semi-Charmed Life', artist: 'Third Eye Blind' },
  { title: 'Santeria', artist: 'Sublime' },
  { title: 'Like a Stone', artist: 'Audioslave' },
  { title: 'You Oughta Know', artist: 'Alanis Morissette' },
  { title: 'Rehab', artist: 'Amy Winehouse' },
  { title: 'Take a Picture', artist: 'Filter' },
  { title: "New Year's Day", artist: 'U2' },
  { title: 'Dancing in the Dark', artist: 'Bruce Springsteen' },
  { title: 'Born to Be Wild', artist: 'Steppenwolf' },
  { title: 'Paranoid', artist: 'Black Sabbath' },
  { title: 'Are You Gonna Go My Way', artist: 'Lenny Kravitz' },
  { title: 'Voy en un Coche', artist: 'Christina Rosenvinge' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getBloque(position: number): 1 | 2 | 3 | 4 | 'extras' {
  if (position <= 14) return 1
  if (position <= 30) return 2
  if (position <= 45) return 3
  if (position <= 60) return 4
  return 'extras'
}

const songs: NewSong[] = PLAYLIST_ORDER.map((song, index) => {
  const position = index + 1
  return {
    id: slugify(song.title),
    title: song.title,
    artist: song.artist,
    bloque: getBloque(position),
    youtubePosition: position,
    enabled: true,
  }
})

const output = { songs }
const outputPath = path.join(process.cwd(), 'content', 'songs.json')

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
console.log(`✓ Seeded ${songs.length} songs to ${outputPath}`)

// Log bloque distribution
const bloqueCounts = songs.reduce((acc, song) => {
  const key = song.bloque === 'extras' ? 'extras' : `bloque${song.bloque}`
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {} as Record<string, number>)

console.log('\nBloque distribution:')
Object.entries(bloqueCounts).forEach(([bloque, count]) => {
  console.log(`  ${bloque}: ${count} songs`)
})
