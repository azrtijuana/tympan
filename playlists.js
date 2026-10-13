// Catalogue des playlists. Chaque morceau : [artiste, titre, année]
// Les extraits audio sont récupérés à la volée sur Deezer au lancement d'une partie.
// Pour ajouter une playlist : copie un bloc, change l'id, le nom et la liste.

const CATEGORIES = [
  { id: 'decades', label: 'Par année' },
  { id: 'genres', label: 'Par style' },
  { id: 'artists', label: 'Par artiste' },
  { id: 'special', label: 'Spécial' },
];

const LISTS = {
  y70: {
    cat: 'decades', name: 'Années 70', tagline: 'Disco, rock et chanson',
    tracks: [
      ['ABBA', 'Dancing Queen', 1976], ['Queen', 'Bohemian Rhapsody', 1975], ['Bee Gees', "Stayin' Alive", 1977],
      ['Gloria Gaynor', 'I Will Survive', 1978], ['Earth, Wind & Fire', 'September', 1978], ['Eagles', 'Hotel California', 1976],
      ['Village People', 'Y.M.C.A.', 1978], ['Donna Summer', 'I Feel Love', 1977], ['Boney M.', 'Rasputin', 1978],
      ['Fleetwood Mac', 'Dreams', 1977], ['Led Zeppelin', 'Stairway to Heaven', 1971], ['David Bowie', 'Heroes', 1977],
      ['Elton John', 'Rocket Man', 1972], ['Stevie Wonder', 'Superstition', 1972], ['Chic', 'Le Freak', 1978],
      ['Claude François', 'Alexandrie Alexandra', 1978], ['Patrick Hernandez', 'Born to Be Alive', 1979],
      ['Lynyrd Skynyrd', 'Sweet Home Alabama', 1974], ['Pink Floyd', 'Another Brick in the Wall', 1979],
      ['Supertramp', 'The Logical Song', 1979], ['Marvin Gaye', "Let's Get It On", 1973], ['Blondie', 'Heart of Glass', 1979],
      ['Joe Dassin', "L'été indien", 1975], ['Electric Light Orchestra', 'Mr. Blue Sky', 1977],
      ['KC and the Sunshine Band', "That's the Way (I Like It)", 1975], ['Rod Stewart', "Da Ya Think I'm Sexy?", 1978],
      ['Michel Polnareff', 'On ira tous au paradis', 1972], ['The Clash', 'London Calling', 1979],
    ],
  },
  y80: {
    cat: 'decades', name: 'Années 80', tagline: 'Synthés, brushing et tubes',
    tracks: [
      ['Michael Jackson', 'Billie Jean', 1982], ['a-ha', 'Take On Me', 1985], ['Toto', 'Africa', 1982],
      ['Europe', 'The Final Countdown', 1986], ['Cyndi Lauper', 'Girls Just Want to Have Fun', 1983],
      ['Bon Jovi', "Livin' on a Prayer", 1986], ['Queen', 'Another One Bites the Dust', 1980], ['Madonna', 'Like a Virgin', 1984],
      ['Whitney Houston', 'I Wanna Dance with Somebody', 1987], ['Rick Astley', 'Never Gonna Give You Up', 1987],
      ['Survivor', 'Eye of the Tiger', 1982], ['Prince', 'Purple Rain', 1984], ['Kim Wilde', 'Kids in America', 1981],
      ['Indochine', "L'aventurier", 1982], ['Téléphone', 'Un autre monde', 1984], ['Desireless', 'Voyage voyage', 1986],
      ['Wham!', 'Wake Me Up Before You Go-Go', 1984], ['Kool & The Gang', 'Celebration', 1980],
      ['Eurythmics', 'Sweet Dreams (Are Made of This)', 1983], ["Guns N' Roses", "Sweet Child O' Mine", 1987],
      ['Tears for Fears', 'Everybody Wants to Rule the World', 1985], ['Dire Straits', 'Money for Nothing', 1985],
      ['Bonnie Tyler', 'Total Eclipse of the Heart', 1983], ['Kenny Loggins', 'Footloose', 1984],
      ['Daniel Balavoine', "L'Aziza", 1985], ['Jean-Jacques Goldman', 'Quand la musique est bonne', 1982],
      ['Mylène Farmer', 'Libertine', 1986], ['The Police', 'Every Breath You Take', 1983],
      ['Phil Collins', 'In the Air Tonight', 1981], ['Ray Parker Jr.', 'Ghostbusters', 1984],
    ],
  },
  y90: {
    cat: 'decades', name: 'Années 90', tagline: 'Dance, grunge et boys bands',
    tracks: [
      ['Nirvana', 'Smells Like Teen Spirit', 1991], ['Britney Spears', '...Baby One More Time', 1998],
      ['Spice Girls', 'Wannabe', 1996], ['Backstreet Boys', 'I Want It That Way', 1999], ['Oasis', 'Wonderwall', 1995],
      ['Haddaway', 'What Is Love', 1993], ['Eiffel 65', 'Blue (Da Ba Dee)', 1998], ['Coolio', "Gangsta's Paradise", 1995],
      ['Céline Dion', 'My Heart Will Go On', 1997], ['Ricky Martin', 'Livin\' la Vida Loca', 1999], ['Aqua', 'Barbie Girl', 1997],
      ['Alanis Morissette', 'Ironic', 1995], ['Lou Bega', 'Mambo No. 5', 1999], ['Whitney Houston', 'I Will Always Love You', 1992],
      ['Dr. Alban', "It's My Life", 1992], ['2 Unlimited', 'No Limit', 1993], ['Los Del Rio', 'Macarena', 1995],
      ['Gala', 'Freed from Desire', 1996], ['Daft Punk', 'Around the World', 1997], ['Fugees', 'Killing Me Softly', 1996],
      ['TLC', 'No Scrubs', 1999], ['R.E.M.', 'Losing My Religion', 1991], ['The Cranberries', 'Zombie', 1994],
      ['IAM', 'Je danse le Mia', 1993], ['MC Solaar', 'Bouge de là', 1990], ['Alliance Ethnik', 'Respect', 1995],
      ['Larusso', "Tu m'oublieras", 1998], ['Hanson', 'MMMBop', 1997], ['Vengaboys', 'We Like to Party!', 1998],
      ['Shania Twain', "That Don't Impress Me Much", 1997],
    ],
  },
  y00: {
    cat: 'decades', name: 'Années 2000', tagline: 'R&B, électro et pop-rock',
    tracks: [
      ['Eminem', 'Without Me', 2002], ['Beyoncé', 'Crazy in Love', 2003], ['OutKast', 'Hey Ya!', 2003],
      ['The Black Eyed Peas', 'I Gotta Feeling', 2009], ['Shakira', "Hips Don't Lie", 2006], ['Rihanna', 'Umbrella', 2007],
      ['The Killers', 'Mr. Brightside', 2003], ['Britney Spears', 'Toxic', 2003], ['Lady Gaga', 'Poker Face', 2008],
      ['Gnarls Barkley', 'Crazy', 2006], ['Daft Punk', 'One More Time', 2000], ['Modjo', 'Lady (Hear Me Tonight)', 2000],
      ['Linkin Park', 'In the End', 2000], ['50 Cent', 'In da Club', 2003], ['Amy Winehouse', 'Rehab', 2006],
      ['Coldplay', 'Viva la Vida', 2008], ['Kelly Clarkson', 'Since U Been Gone', 2004], ['Usher', 'Yeah!', 2004],
      ['Nelly Furtado', 'Maneater', 2006], ['Akon', 'Smack That', 2006], ['Katy Perry', 'I Kissed a Girl', 2008],
      ['Diam\'s', 'La boulette', 2006], ['Bob Sinclar', 'Love Generation', 2005], ['David Guetta', 'Love Is Gone', 2007],
      ['Christophe Maé', "On s'attache", 2007], ['Kylie Minogue', "Can't Get You Out of My Head", 2001],
      ['Justin Timberlake', 'SexyBack', 2006], ['Alicia Keys', "Fallin'", 2001], ['Avril Lavigne', 'Complicated', 2002],
      ['Sean Paul', 'Get Busy', 2003], ['Las Ketchup', 'The Ketchup Song (Aserejé)', 2002],
    ],
  },
  y10: {
    cat: 'decades', name: 'Années 2010', tagline: 'Streaming, EDM et tubes planétaires',
    tracks: [
      ['Pharrell Williams', 'Happy', 2013], ['Mark Ronson', 'Uptown Funk', 2014], ['Adele', 'Rolling in the Deep', 2010],
      ['Gotye', 'Somebody That I Used to Know', 2011], ['Ed Sheeran', 'Shape of You', 2017], ['Luis Fonsi', 'Despacito', 2017],
      ['Daft Punk', 'Get Lucky', 2013], ['Avicii', 'Wake Me Up', 2013], ['Stromae', 'Alors on danse', 2010],
      ['Stromae', 'Papaoutai', 2013], ['PSY', 'Gangnam Style', 2012], ['Carly Rae Jepsen', 'Call Me Maybe', 2011],
      ['LMFAO', 'Party Rock Anthem', 2011], ['Maroon 5', 'Moves like Jagger', 2011], ['Bruno Mars', 'Locked Out of Heaven', 2012],
      ['Imagine Dragons', 'Believer', 2017], ['Billie Eilish', 'bad guy', 2019], ['Lil Nas X', 'Old Town Road', 2019],
      ['Kendji Girac', 'Color Gitano', 2014], ['Gims', 'Sapés comme jamais', 2015], ['Major Lazer', 'Lean On', 2015],
      ['Justin Bieber', 'Sorry', 2015], ['Rihanna', 'Diamonds', 2012], ['Katy Perry', 'Roar', 2013], ['Sia', 'Chandelier', 2014],
      ['Calvin Harris', 'Summer', 2014], ['Orelsan', 'Basique', 2017], ['Angèle', 'Balance ton quoi', 2019],
      ['Aya Nakamura', 'Djadja', 2018], ['Drake', 'Hotline Bling', 2015], ['Kygo', 'Firestone', 2014],
    ],
  },
  y20: {
    cat: 'decades', name: 'Années 2020', tagline: 'Les hits récents',
    tracks: [
      ['The Weeknd', 'Blinding Lights', 2020], ['Dua Lipa', 'Levitating', 2020], ['Harry Styles', 'As It Was', 2022],
      ['Olivia Rodrigo', 'drivers license', 2021], ['Miley Cyrus', 'Flowers', 2023], ['Glass Animals', 'Heat Waves', 2020],
      ['Måneskin', "Beggin'", 2021], ['Lil Nas X', 'MONTERO (Call Me By Your Name)', 2021], ['Doja Cat', 'Say So', 2020],
      ['Sabrina Carpenter', 'Espresso', 2024], ['Billie Eilish', 'BIRDS OF A FEATHER', 2024], ['Taylor Swift', 'Anti-Hero', 2022],
      ['Bad Bunny', 'Tití Me Preguntó', 2022], ['Rema', 'Calm Down', 2022], ['Tiakola', 'Meuda', 2022],
      ['Angèle', "Bruxelles je t'aime", 2021], ['Lady Gaga', 'Die With A Smile', 2024], ['Benson Boone', 'Beautiful Things', 2024],
      ['Teddy Swims', 'Lose Control', 2023], ['SZA', 'Kill Bill', 2022], ['Elton John', 'Cold Heart', 2021],
      ['Ed Sheeran', 'Bad Habits', 2021], ['Stromae', "L'enfer", 2022], ['Tate McRae', 'greedy', 2023],
      ['Chappell Roan', 'Good Luck, Babe!', 2024], ['Dua Lipa', 'Houdini', 2023], ['Jack Harlow', 'First Class', 2022],
      ['Ninho', 'Jefe', 2021], ['Imagine Dragons', 'Enemy', 2021], ['Werenoi', 'Solitaire', 2023],
    ],
  },
  rapfr: {
    cat: 'genres', name: 'Rap FR', tagline: 'Des classiques aux streams',
    tracks: [
      ['PNL', 'Au DD', 2019], ['Booba', 'DKR', 2016], ['Nekfeu', 'On verra', 2015], ['Orelsan', 'La terre est ronde', 2011],
      ['Jul', 'Tchikita', 2016], ['Ninho', 'Lettre à une femme', 2019], ['Damso', 'Macarena', 2017], ['Kaaris', 'Zoo', 2013],
      ['Niska', 'Réseaux', 2017], ['Lomepal', 'Trop beau', 2018], ['Bigflo & Oli', 'Dommage', 2017], ['Soprano', 'Mon précieux', 2014],
      ['Sexion d\'Assaut', 'Désolé', 2010], ['Diam\'s', 'DJ', 2003], ['Tiakola', 'Meuda', 2022], ['MC Solaar', 'Caroline', 1991],
      ['IAM', "L'école du micro d'argent", 1997], ['Suprême NTM', 'Ma Benz', 1998], ['Vald', 'Désaccordé', 2017],
      ['Werenoi', 'Solitaire', 2023], ['Naps', 'La kiffance', 2019], ['Koba LaD', 'RR 9.1', 2018], ['Maes', 'Madrina', 2019],
      ['Gims', 'Bella', 2013], ['Orelsan', 'Basique', 2017], ['PNL', 'Deux frères', 2019], ['SCH', 'Champs-Élysées', 2021],
      ['Gazo', 'DIE', 2021], ['Ninho', 'Jefe', 2021], ['Booba', 'Validée', 2015],
    ],
  },
  rapus: {
    cat: 'genres', name: 'Rap US', tagline: 'West coast, trap et légendes',
    tracks: [
      ['Eminem', 'Lose Yourself', 2002], ['2Pac', 'California Love', 1995], ['The Notorious B.I.G.', 'Juicy', 1994],
      ['Dr. Dre', 'Still D.R.E.', 1999], ['Kanye West', 'Stronger', 2007], ['Jay-Z', 'Empire State of Mind', 2009],
      ['Kendrick Lamar', 'HUMBLE.', 2017], ['Drake', "God's Plan", 2018], ['Travis Scott', 'SICKO MODE', 2018],
      ['Post Malone', 'rockstar', 2017], ['Cardi B', 'Bodak Yellow', 2017], ['50 Cent', 'In da Club', 2003],
      ['Snoop Dogg', "Drop It Like It's Hot", 2004], ['Nicki Minaj', 'Super Bass', 2011], ['Kendrick Lamar', 'Not Like Us', 2024],
      ['OutKast', 'Ms. Jackson', 2000], ['Missy Elliott', 'Get Ur Freak On', 2001], ['Lil Wayne', 'Lollipop', 2008],
      ['Wiz Khalifa', 'See You Again', 2015], ['Macklemore & Ryan Lewis', 'Thrift Shop', 2012], ['Kanye West', 'Gold Digger', 2005],
      ['Juice WRLD', 'Lucid Dreams', 2018], ['Future', 'Mask Off', 2017], ['Migos', 'Bad and Boujee', 2016],
      ['DMX', "X Gon' Give It to Ya", 2003], ['House of Pain', 'Jump Around', 1992], ['Coolio', "Gangsta's Paradise", 1995],
      ['Eminem', 'The Real Slim Shady', 2000], ['Travis Scott', 'goosebumps', 2016], ['Drake', 'Hotline Bling', 2015],
    ],
  },
  rock: {
    cat: 'genres', name: 'Rock', tagline: 'Riffs et hymnes de stade',
    tracks: [
      ['Queen', 'We Will Rock You', 1977], ['AC/DC', 'Highway to Hell', 1979], ['Nirvana', 'Come As You Are', 1991],
      ['The White Stripes', 'Seven Nation Army', 2003], ['Red Hot Chili Peppers', 'Californication', 1999],
      ["Guns N' Roses", 'Welcome to the Jungle', 1987], ['The Rolling Stones', "(I Can't Get No) Satisfaction", 1965],
      ['The Beatles', 'Hey Jude', 1968], ['Deep Purple', 'Smoke on the Water', 1972], ['Metallica', 'Enter Sandman', 1991],
      ['Muse', 'Uprising', 2009], ['Arctic Monkeys', 'Do I Wanna Know?', 2013], ['Green Day', 'Basket Case', 1994],
      ['Foo Fighters', 'Everlong', 1997], ['Linkin Park', 'Numb', 2003], ['The Clash', 'Should I Stay or Should I Go', 1982],
      ['Kiss', "I Was Made for Lovin' You", 1979], ['Bon Jovi', "It's My Life", 2000], ['System of a Down', 'Toxicity', 2001],
      ['Rage Against the Machine', 'Killing in the Name', 1992], ['Noir Désir', 'Le vent nous portera', 2001],
      ['Téléphone', 'Ça (c\'est vraiment toi)', 1982], ['Indochine', "J'ai demandé à la lune", 2002],
      ['The Offspring', "The Kids Aren't Alright", 1998], ['Blink-182', 'All the Small Things', 1999],
      ['Pixies', 'Where Is My Mind?', 1988], ['Oasis', "Don't Look Back in Anger", 1995], ['U2', 'With or Without You', 1987],
      ['Måneskin', 'Zitti e buoni', 2021], ['AC/DC', 'Back in Black', 1980],
    ],
  },
  electro: {
    cat: 'genres', name: 'Électro & Dance', tagline: 'French touch, EDM, club',
    tracks: [
      ['Daft Punk', 'Harder, Better, Faster, Stronger', 2001], ['David Guetta', 'Titanium', 2011], ['Avicii', 'Levels', 2011],
      ['Swedish House Mafia', "Don't You Worry Child", 2012], ['Calvin Harris', 'Feel So Close', 2011],
      ['Martin Garrix', 'Animals', 2013], ['Darude', 'Sandstorm', 1999], ['Stardust', 'Music Sounds Better with You', 1998],
      ['Bob Sinclar', 'World, Hold On', 2006], ['Justice', 'D.A.N.C.E.', 2007], ['Kavinsky', 'Nightcall', 2010],
      ['DJ Snake', 'Turn Down for What', 2013], ['DJ Snake', 'Taki Taki', 2018], ['The Chainsmokers', 'Closer', 2016],
      ['Robin Schulz', 'Prayer in C', 2014], ['Alan Walker', 'Faded', 2015], ['Fatboy Slim', 'Right Here, Right Now', 1999],
      ['The Prodigy', 'Firestarter', 1996], ['Benny Benassi', 'Satisfaction', 2002], ['Eric Prydz', 'Call on Me', 2004],
      ['Cascada', 'Everytime We Touch', 2005], ['Mr. Oizo', 'Flat Beat', 1999], ['Purple Disco Machine', 'Hypnotized', 2020],
      ['Joel Corry', 'Sorry', 2019], ['Klingande', 'Jubel', 2013], ['Ofenbach', 'Be Mine', 2016], ['Modjo', 'Lady (Hear Me Tonight)', 2000],
      ['Daft Punk', 'One More Time', 2000], ['Avicii', 'Hey Brother', 2013], ['David Guetta', 'Memories', 2009],
    ],
  },
  varfr: {
    cat: 'genres', name: 'Variété française', tagline: 'Les refrains que tout le monde connaît',
    tracks: [
      ['Johnny Hallyday', 'Allumer le feu', 1998], ['Céline Dion', "Pour que tu m'aimes encore", 1995],
      ['Jean-Jacques Goldman', 'Je te donne', 1985], ['Michel Sardou', 'Les lacs du Connemara', 1981],
      ['Édith Piaf', 'La vie en rose', 1947], ['Charles Aznavour', 'La bohème', 1965], ['Francis Cabrel', "Je l'aime à mourir", 1979],
      ['Claude François', "Comme d'habitude", 1967], ['Joe Dassin', 'Les Champs-Élysées', 1969], ['Indila', 'Dernière danse', 2013],
      ['Zaz', 'Je veux', 2010], ['Louane', 'Avenir', 2015], ['Vianney', "Je m'en vais", 2016],
      ['Christophe Maé', 'Il est où le bonheur', 2016], ['Calogero', 'En apesanteur', 2002],
      ['Patrick Bruel', 'Place des grands hommes', 1989], ['Mylène Farmer', 'Désenchantée', 1991], ['France Gall', 'Ella, elle l\'a', 1987],
      ['Renaud', 'Mistral gagnant', 1985], ['Jacques Brel', 'Ne me quitte pas', 1959], ['Daniel Balavoine', 'Le chanteur', 1978],
      ['Les Rita Mitsouko', 'Marcia Baila', 1984], ['Angèle', 'Tout oublier', 2018], ['Amir', "J'ai cherché", 2016],
      ['Kendji Girac', 'Andalouse', 2014], ['Slimane', "Viens on s'aime", 2018], ['Clara Luciani', 'La grenade', 2018],
      ['Julien Doré', 'Coco Câline', 2016], ['Michel Polnareff', 'On ira tous au paradis', 1972], ['Dalida', 'Laissez-moi danser', 1979],
    ],
  },
};

const ARTISTS = [
  'Michael Jackson', 'Queen', 'Daft Punk', 'Beyoncé', 'Rihanna', 'Taylor Swift', 'Drake', 'Eminem', 'The Weeknd',
  'Bruno Mars', 'Coldplay', 'Stromae', 'Jul', 'Ninho', 'PNL', 'Aya Nakamura', 'Angèle', 'Johnny Hallyday',
];

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const ARTIST_IDS = Object.fromEntries(ARTISTS.map(a => ['a-' + slug(a), a]));

const SPECIAL = {
  mix: { name: 'Mix total', tagline: 'Toutes les playlists mélangées' },
  charts: { name: 'Hits du moment', tagline: 'Le classement Deezer en direct' },
  custom: { name: 'Artiste au choix', tagline: 'Tape le nom de n\'importe quel artiste' },
};

function catalog() {
  const out = [];
  for (const [id, l] of Object.entries(LISTS)) out.push({ id, cat: l.cat, name: l.name, tagline: l.tagline, count: l.tracks.length });
  for (const [id, name] of Object.entries(ARTIST_IDS)) out.push({ id, cat: 'artists', name, tagline: 'Ses titres les plus écoutés' });
  for (const [id, s] of Object.entries(SPECIAL)) out.push({ id, cat: 'special', name: s.name, tagline: s.tagline });
  return { categories: CATEGORIES, playlists: out };
}

function isValidPlaylist(id) {
  return Boolean(LISTS[id] || ARTIST_IDS[id] || SPECIAL[id]);
}

function playlistName(id, customArtist) {
  if (LISTS[id]) return LISTS[id].name;
  if (ARTIST_IDS[id]) return ARTIST_IDS[id];
  if (id === 'custom') return customArtist || 'Artiste au choix';
  return SPECIAL[id] ? SPECIAL[id].name : id;
}

module.exports = { LISTS, ARTIST_IDS, catalog, isValidPlaylist, playlistName };
