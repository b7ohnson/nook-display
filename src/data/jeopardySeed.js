export const JEOPARDY_BOARDS = [
  [
    {
      category: 'Animals',
      clues: [
        { value: 200,  q: 'The largest land animal on Earth.',                                     a: 'African Elephant' },
        { value: 400,  q: 'This flightless bird can run up to 45 mph.',                            a: 'Ostrich' },
        { value: 600,  q: 'A group of lions is called this.',                                       a: 'A Pride' },
        { value: 800,  q: 'This sea creature has three hearts and blue blood.',                     a: 'Octopus' },
        { value: 1000, q: 'The only mammal capable of true, sustained flight.',                    a: 'Bat' },
      ],
    },
    {
      category: 'US History',
      clues: [
        { value: 200,  q: 'The first President of the United States.',                             a: 'George Washington' },
        { value: 400,  q: 'The year the Declaration of Independence was signed.',                  a: '1776' },
        { value: 600,  q: 'The name of the ship the Pilgrims sailed to America.',                  a: 'The Mayflower' },
        { value: 800,  q: 'This battle is considered the turning point of the Civil War.',         a: 'Battle of Gettysburg' },
        { value: 1000, q: 'The only U.S. President elected to more than two terms.',              a: 'Franklin D. Roosevelt' },
      ],
    },
    {
      category: 'Movies',
      clues: [
        { value: 200,  q: '"To infinity and beyond!" is the catchphrase of this Toy Story hero.', a: 'Buzz Lightyear' },
        { value: 400,  q: 'The 1994 Disney film featuring a lion cub named Simba.',                a: 'The Lion King' },
        { value: 600,  q: 'The director of both Jurassic Park and Schindler\'s List.',             a: 'Steven Spielberg' },
        { value: 800,  q: 'The first Marvel Cinematic Universe film, released in 2008.',           a: 'Iron Man' },
        { value: 1000, q: 'The first film to gross more than $1 billion worldwide.',              a: 'Titanic (1997)' },
      ],
    },
    {
      category: 'Science',
      clues: [
        { value: 200,  q: "Water's chemical formula.",                                             a: 'H₂O' },
        { value: 400,  q: 'The planet known as the Red Planet.',                                   a: 'Mars' },
        { value: 600,  q: 'This gas makes up about 78% of Earth\'s atmosphere.',                  a: 'Nitrogen' },
        { value: 800,  q: 'The scientist who developed the theory of relativity.',                 a: 'Albert Einstein' },
        { value: 1000, q: 'The only planet in our solar system that rotates on its side.',        a: 'Uranus' },
      ],
    },
    {
      category: 'Sports',
      clues: [
        { value: 200,  q: 'Number of players per team on a basketball court at one time.',        a: '5' },
        { value: 400,  q: 'The country that has won the most FIFA World Cup titles.',             a: 'Brazil' },
        { value: 600,  q: 'The distance of a marathon in miles.',                                 a: '26.2 miles' },
        { value: 800,  q: 'This legendary boxer was known as "The Greatest."',                   a: 'Muhammad Ali' },
        { value: 1000, q: 'City that hosted the first modern Olympic Games in 1896.',            a: 'Athens, Greece' },
      ],
    },
    {
      category: 'Pop Culture',
      clues: [
        { value: 200,  q: 'The fictional kingdom in Disney\'s Frozen.',                           a: 'Arendelle' },
        { value: 400,  q: 'The social media app known for short videos, owned by ByteDance.',    a: 'TikTok' },
        { value: 600,  q: 'The TV show set at Dunder Mifflin Paper Company in Scranton, PA.',   a: 'The Office' },
        { value: 800,  q: 'This video game character is a plumber who rescues Princess Peach.',  a: 'Mario' },
        { value: 1000, q: 'The author of the Harry Potter series.',                              a: 'J.K. Rowling' },
      ],
    },
  ],
  [
    {
      category: 'Food & Drink',
      clues: [
        { value: 200,  q: 'The main ingredient in guacamole.',                                    a: 'Avocado' },
        { value: 400,  q: 'This Italian dish literally means "to the tooth" (firm texture).',    a: 'Al Dente' },
        { value: 600,  q: 'The country of origin for sushi.',                                     a: 'Japan' },
        { value: 800,  q: 'This spice comes from the stigmas of the Crocus flower.',             a: 'Saffron' },
        { value: 1000, q: 'The fermentation of grapes to produce this drink is called vinification.', a: 'Wine' },
      ],
    },
    {
      category: 'Geography',
      clues: [
        { value: 200,  q: 'The capital of France.',                                               a: 'Paris' },
        { value: 400,  q: 'The longest river in the world.',                                      a: 'The Nile' },
        { value: 600,  q: 'The smallest country in the world by area.',                          a: 'Vatican City' },
        { value: 800,  q: 'The continent with the most countries.',                               a: 'Africa' },
        { value: 1000, q: 'This mountain range separates Europe from Asia.',                     a: 'The Urals' },
      ],
    },
    {
      category: 'Music',
      clues: [
        { value: 200,  q: 'The King of Pop.',                                                     a: 'Michael Jackson' },
        { value: 400,  q: 'The Beatles were from this city.',                                     a: 'Liverpool, England' },
        { value: 600,  q: 'This instrument has 88 keys.',                                         a: 'Piano' },
        { value: 800,  q: 'The musical term for gradually getting louder.',                      a: 'Crescendo' },
        { value: 1000, q: 'This composer wrote the "Moonlight Sonata" while going deaf.',       a: 'Beethoven' },
      ],
    },
    {
      category: 'TV Shows',
      clues: [
        { value: 200,  q: '"Winter is Coming" is the motto of this HBO show\'s noble house.',   a: 'Game of Thrones / House Stark' },
        { value: 400,  q: 'The show where contestants are marooned and vote each other off.',   a: 'Survivor' },
        { value: 600,  q: 'This Netflix show is set in a fictional Hawkins, Indiana in the 80s.', a: 'Stranger Things' },
        { value: 800,  q: 'The longest-running animated prime-time show in US history.',        a: 'The Simpsons' },
        { value: 1000, q: 'Bryan Cranston played chemistry teacher Walter White in this show.',  a: 'Breaking Bad' },
      ],
    },
    {
      category: 'Math & Numbers',
      clues: [
        { value: 200,  q: 'How many sides does a hexagon have?',                                 a: '6' },
        { value: 400,  q: 'The value of Pi rounded to two decimal places.',                     a: '3.14' },
        { value: 600,  q: 'The square root of 144.',                                             a: '12' },
        { value: 800,  q: 'A prime number is only divisible by 1 and this.',                    a: 'Itself' },
        { value: 1000, q: 'In Roman numerals, the letter M represents this number.',           a: '1,000' },
      ],
    },
    {
      category: 'Inventions',
      clues: [
        { value: 200,  q: 'Alexander Graham Bell invented this.',                               a: 'The Telephone' },
        { value: 400,  q: 'The Wright Brothers made the first successful powered flight here.', a: 'Kitty Hawk, North Carolina' },
        { value: 600,  q: 'Thomas Edison is credited with inventing the practical version of this light source.', a: 'Light Bulb' },
        { value: 800,  q: 'This Scotsman invented the World Wide Web in 1989.',               a: 'Tim Berners-Lee' },
        { value: 1000, q: 'The printing press was invented by this German blacksmith in 1440.', a: 'Johannes Gutenberg' },
      ],
    },
  ],
]
