export type LeagueClub = {
  id: string;
  name: string;
  city: string;
  primary: string;
  secondary: string;
  rep: 1 | 2 | 3 | 4 | 5;
  budget: number;
};

export type Division = {
  level: 1 | 2 | 3;
  label: string;
  clubs: LeagueClub[];
};

export type League = {
  id: string;
  name: string;
  country: string;
  flag: string;
  divisions: Division[];
};

const mk = (id: string, name: string, city: string, primary: string, secondary: string, rep: 1|2|3|4|5, budget: number): LeagueClub =>
  ({ id, name, city, primary, secondary, rep, budget });

export const LEAGUES: League[] = [
  {
    id: "ligue1", name: "Ligue 1", country: "France", flag: "🇫🇷",
    divisions: [
      { level: 1, label: "Division 1", clubs: [
        mk("l1d1_1","AS Nordville","Nordville","#003F87","#FFFFFF",5,2_500_000),
        mk("l1d1_2","FC Montbleu","Montbleu","#DA291C","#FFFFFF",4,1_800_000),
        mk("l1d1_3","Olympique Rivière","Rivière","#009900","#FFFFFF",5,2_200_000),
        mk("l1d1_4","Stade Champagne","Reims Nord","#0033A0","#FFD700",3,900_000),
        mk("l1d1_5","RC Pontlieu","Pontlieu","#111111","#FF0000",4,1_400_000),
        mk("l1d1_6","Bordeaux Atlantique","Bordeaux","#000B5E","#FFFFFF",4,1_600_000),
        mk("l1d1_7","Étoile du Sud","Toulouse","#E8D44D","#1B1B1B",3,800_000),
        mk("l1d1_8","FC Lorival","Lorival","#8B0000","#FFFFFF",3,750_000),
      ]},
      { level: 2, label: "Division 2", clubs: [
        mk("l1d2_1","FC Belvaux","Belvaux","#1D6FA4","#FFFFFF",3,350_000),
        mk("l1d2_2","SC Duvallon","Duvallon","#CC0000","#FFD700",2,280_000),
        mk("l1d2_3","US Chalais","Chalais","#006400","#FFFFFF",2,260_000),
        mk("l1d2_4","Racing Pontoise","Pontoise","#003580","#FFFFFF",3,300_000),
        mk("l1d2_5","AS Briançon","Briançon","#FF6600","#FFFFFF",2,240_000),
        mk("l1d2_6","FC Montverdi","Montverdi","#551A8B","#FFD700",2,220_000),
        mk("l1d2_7","RC Picardie","Picardie","#1B1B1B","#C0C0C0",3,270_000),
        mk("l1d2_8","US Larbaud","Larbaud","#008080","#FFFFFF",2,200_000),
      ]},
      { level: 3, label: "Division 3", clubs: [
        mk("l1d3_1","FC Aubenas","Aubenas","#003366","#FFFFFF",1,60_000),
        mk("l1d3_2","AS Peytieu","Peytieu","#CC0000","#FFFFFF",1,55_000),
        mk("l1d3_3","Sporting Grenois","Grenoble","#006600","#FFFF00",2,75_000),
        mk("l1d3_4","RC Montceau","Montceau","#1A1A1A","#FF4500",1,50_000),
        mk("l1d3_5","US Brançon","Brançon","#8B4513","#FFFFFF",1,48_000),
        mk("l1d3_6","AS Lavardac","Lavardac","#4B0082","#FFFFFF",1,45_000),
        mk("l1d3_7","FC Beaumont","Beaumont","#006400","#FFFFFF",2,70_000),
        mk("l1d3_8","CS Pauillac","Pauillac","#B22222","#FFD700",1,52_000),
      ]},
    ],
  },
  {
    id: "premier", name: "Premier League", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    divisions: [
      { level: 1, label: "Division 1", clubs: [
        mk("pld1_1","Northgate City","Northgate","#6CABDD","#FFFFFF",5,2_800_000),
        mk("pld1_2","Ashford United","Ashford","#DA291C","#FFFFFF",4,1_700_000),
        mk("pld1_3","Bridgeton FC","Bridgeton","#034694","#FFFFFF",5,2_300_000),
        mk("pld1_4","Cromwell Rovers","Cromwell","#FF6600","#1A1A1A",3,850_000),
        mk("pld1_5","Hartley Athletic","Hartley","#FFFFFF","#000000",4,1_200_000),
        mk("pld1_6","Westpool Town","Westpool","#FDB913","#132257",4,1_500_000),
        mk("pld1_7","Blackmoor FC","Blackmoor","#000000","#FFD700",3,780_000),
        mk("pld1_8","Kingston AFC","Kingston","#003333","#FFFFFF",3,700_000),
      ]},
      { level: 2, label: "Championship", clubs: [
        mk("pld2_1","Barton Town","Barton","#CC0000","#FFFFFF",3,320_000),
        mk("pld2_2","Fieldwick United","Fieldwick","#003399","#FFFFFF",2,260_000),
        mk("pld2_3","Redmore Athletic","Redmore","#FF0000","#1A1A1A",3,290_000),
        mk("pld2_4","Stonegate FC","Stonegate","#006600","#FFFFFF",2,240_000),
        mk("pld2_5","Carlbridge Rovers","Carlbridge","#003580","#FFD700",3,310_000),
        mk("pld2_6","Melbury City","Melbury","#99CCFF","#FFFFFF",2,220_000),
        mk("pld2_7","Westshore United","Westshore","#FF6600","#FFFFFF",2,200_000),
        mk("pld2_8","Penfield AFC","Penfield","#550055","#FFFFFF",2,210_000),
      ]},
      { level: 3, label: "League One", clubs: [
        mk("pld3_1","Millhaven FC","Millhaven","#003366","#FFFFFF",1,65_000),
        mk("pld3_2","Greenwick Town","Greenwick","#006600","#FFFFFF",1,58_000),
        mk("pld3_3","Brackleton United","Brackleton","#CC0000","#FFFFFF",2,78_000),
        mk("pld3_4","Thornton Rovers","Thornton","#FF6600","#1A1A1A",1,52_000),
        mk("pld3_5","Coldfield AFC","Coldfield","#1A1A1A","#C0C0C0",1,48_000),
        mk("pld3_6","Riverstone City","Riverstone","#003399","#FFFFFF",2,72_000),
        mk("pld3_7","Marshfield FC","Marshfield","#8B0000","#FFFFFF",1,50_000),
        mk("pld3_8","Eastbury Town","Eastbury","#004400","#FFD700",1,55_000),
      ]},
    ],
  },
  {
    id: "liga", name: "La Liga", country: "Espagne", flag: "🇪🇸",
    divisions: [
      { level: 1, label: "División 1", clubs: [
        mk("lgd1_1","CD Velázquez","Velázquez","#CC0000","#FFD700",5,2_600_000),
        mk("lgd1_2","UD Montalbán","Montalbán","#003087","#FFFFFF",4,1_900_000),
        mk("lgd1_3","Atlético Ribera","Ribera","#CC0000","#1A1A1A",5,2_400_000),
        mk("lgd1_4","Real Segovia","Segovia","#FFFFFF","#663399",3,880_000),
        mk("lgd1_5","CF Plasencia","Plasencia","#FF6600","#FFFFFF",4,1_300_000),
        mk("lgd1_6","UD Compostela","Santiago","#006600","#FFFFFF",4,1_100_000),
        mk("lgd1_7","CD Llerena","Llerena","#000080","#FFD700",3,760_000),
        mk("lgd1_8","Real Campiña","Campiña","#FFFFFF","#003580",3,720_000),
      ]},
      { level: 2, label: "División 2", clubs: [
        mk("lgd2_1","CD Manzano","Manzano","#CC0000","#FFFFFF",3,300_000),
        mk("lgd2_2","UD Villafranqueza","Villafranqueza","#003399","#FFFFFF",2,250_000),
        mk("lgd2_3","CF Almadén","Almadén","#006600","#FFD700",2,230_000),
        mk("lgd2_4","Real Mondéjar","Mondéjar","#FFFFFF","#000080",3,280_000),
        mk("lgd2_5","CD Herencia","Herencia","#FF0000","#FFFF00",2,220_000),
        mk("lgd2_6","CF Talavera Sur","Talavera","#8B0000","#FFFFFF",2,210_000),
        mk("lgd2_7","UD Aljarafe","Aljarafe","#006400","#FFFFFF",3,265_000),
        mk("lgd2_8","CD Benicassim","Benicassim","#003399","#FFD700",2,200_000),
      ]},
      { level: 3, label: "División 3", clubs: [
        mk("lgd3_1","CF Alcaudete","Alcaudete","#CC0000","#FFFFFF",1,60_000),
        mk("lgd3_2","UD Lucena Sur","Lucena","#003399","#FFFFFF",1,55_000),
        mk("lgd3_3","CD Trigueros","Trigueros","#006600","#FFFFFF",2,72_000),
        mk("lgd3_4","CF Huelma","Huelma","#FF6600","#1A1A1A",1,48_000),
        mk("lgd3_5","Real Ojén","Ojén","#FFFFFF","#CC0000",1,45_000),
        mk("lgd3_6","UD Guarromán","Guarromán","#8B4513","#FFD700",1,50_000),
        mk("lgd3_7","CD Fernán Núñez","Fernán Núñez","#003366","#FFFFFF",1,52_000),
        mk("lgd3_8","CF La Roda","La Roda","#006400","#FFFF00",2,68_000),
      ]},
    ],
  },
  {
    id: "bundesliga", name: "Bundesliga", country: "Allemagne", flag: "🇩🇪",
    divisions: [
      { level: 1, label: "1. Bundesliga", clubs: [
        mk("bld1_1","SC Neustadt","Neustadt","#CC0000","#FFFFFF",5,2_700_000),
        mk("bld1_2","FC Bergheim","Bergheim","#1A1A1A","#FFD700",4,1_600_000),
        mk("bld1_3","SV Waldenfels","Waldenfels","#003366","#FFFFFF",5,2_100_000),
        mk("bld1_4","FC Rosenau","Rosenau","#CC0000","#1A1A1A",3,870_000),
        mk("bld1_5","SC Thalheim","Thalheim","#FFFFFF","#CC0000",4,1_100_000),
        mk("bld1_6","VfB Kronach","Kronach","#CC0000","#FFFFFF",4,1_200_000),
        mk("bld1_7","SpVgg Ravenau","Ravenau","#006400","#FFFFFF",3,750_000),
        mk("bld1_8","TSV Mainburg","Mainburg","#003399","#FFFFFF",3,700_000),
      ]},
      { level: 2, label: "2. Bundesliga", clubs: [
        mk("bld2_1","SC Grünbach","Grünbach","#006400","#FFFFFF",3,290_000),
        mk("bld2_2","FC Leimental","Leimental","#CC0000","#FFD700",2,240_000),
        mk("bld2_3","VfL Altenfels","Altenfels","#003399","#FFFFFF",2,220_000),
        mk("bld2_4","TSV Buchenberg","Buchenberg","#FF6600","#FFFFFF",3,270_000),
        mk("bld2_5","1. FC Weißbach","Weißbach","#CC0000","#FFFFFF",2,200_000),
        mk("bld2_6","SC Altenhain","Altenhain","#1A1A1A","#FFFFFF",2,210_000),
        mk("bld2_7","SV Moosach","Moosach","#006400","#FFD700",2,195_000),
        mk("bld2_8","FC Steingaden","Steingaden","#003366","#FFFFFF",3,250_000),
      ]},
      { level: 3, label: "3. Liga", clubs: [
        mk("bld3_1","TSV Kirchstetten","Kirchstetten","#CC0000","#FFFFFF",1,62_000),
        mk("bld3_2","SC Friesental","Friesental","#003399","#FFFFFF",1,55_000),
        mk("bld3_3","SV Waldkraiburg","Waldkraiburg","#006400","#FFFFFF",2,74_000),
        mk("bld3_4","FC Rottenburg","Rottenburg","#FF6600","#1A1A1A",1,49_000),
        mk("bld3_5","TSG Haßloch","Haßloch","#1A1A1A","#C0C0C0",1,47_000),
        mk("bld3_6","VfB Osterrönfeld","Osterrönfeld","#8B0000","#FFFFFF",1,51_000),
        mk("bld3_7","SC Haunstetten","Haunstetten","#003366","#FFD700",2,71_000),
        mk("bld3_8","FC Waldsassen","Waldsassen","#006400","#FFFF00",1,54_000),
      ]},
    ],
  },
  {
    id: "seriea", name: "Serie A", country: "Italie", flag: "🇮🇹",
    divisions: [
      { level: 1, label: "Serie A", clubs: [
        mk("sad1_1","AC Vallobbia","Vallobbia","#CC0000","#000000",5,2_500_000),
        mk("sad1_2","UC Forlimpopoli","Forlimpopoli","#003399","#FFFFFF",4,1_700_000),
        mk("sad1_3","FC Frosinone Est","Frosinone","#000080","#FFD700",5,2_200_000),
        mk("sad1_4","AC Moncalvo","Moncalvo","#CC0000","#FFFFFF",3,840_000),
        mk("sad1_5","UC Villadossola","Villadossola","#1A1A1A","#00BFFF",4,1_300_000),
        mk("sad1_6","AC Castelfranco","Castelfranco","#CC0000","#000000",4,1_100_000),
        mk("sad1_7","US Atessa","Atessa","#006400","#FFFFFF",3,730_000),
        mk("sad1_8","CS Piacenza Sud","Piacenza","#CC0000","#FFFFFF",3,710_000),
      ]},
      { level: 2, label: "Serie B", clubs: [
        mk("sad2_1","FC Correggio","Correggio","#CC0000","#FFFFFF",3,300_000),
        mk("sad2_2","UC Busseto","Busseto","#003399","#FFD700",2,250_000),
        mk("sad2_3","AC Rivalta","Rivalta","#1A1A1A","#FFFFFF",2,220_000),
        mk("sad2_4","US Mogliano","Mogliano","#003399","#FFFFFF",3,280_000),
        mk("sad2_5","AC Oleggio","Oleggio","#CC0000","#000000",2,210_000),
        mk("sad2_6","UC Carini","Carini","#006400","#FFFFFF",2,200_000),
        mk("sad2_7","FC Bagnolo","Bagnolo","#FF6600","#FFFFFF",2,195_000),
        mk("sad2_8","AC Cerignola","Cerignola","#8B0000","#FFD700",3,260_000),
      ]},
      { level: 3, label: "Serie C", clubs: [
        mk("sad3_1","UC Campobasso","Campobasso","#003399","#FFFFFF",1,60_000),
        mk("sad3_2","AC Molfetta Est","Molfetta","#CC0000","#FFFFFF",1,54_000),
        mk("sad3_3","FC Treviglio","Treviglio","#006400","#FFFFFF",2,73_000),
        mk("sad3_4","UC Tortona","Tortona","#003399","#FFD700",1,50_000),
        mk("sad3_5","AC Bressanone","Bressanone","#CC0000","#1A1A1A",1,46_000),
        mk("sad3_6","US Corigliano","Corigliano","#006400","#FFFFFF",1,49_000),
        mk("sad3_7","FC Fondi","Fondi","#8B4513","#FFFFFF",1,52_000),
        mk("sad3_8","AC Sulmona","Sulmona","#CC0000","#FFD700",2,69_000),
      ]},
    ],
  },
];

export function getLeague(id: string): League | undefined {
  return LEAGUES.find(l => l.id === id);
}

export function getClub(leagueId: string, clubId: string): LeagueClub | undefined {
  const league = getLeague(leagueId);
  if (!league) return undefined;
  for (const div of league.divisions) {
    const club = div.clubs.find(c => c.id === clubId);
    if (club) return club;
  }
  return undefined;
}

export function getDivisionClubs(leagueId: string, level: 1|2|3): LeagueClub[] {
  const league = getLeague(leagueId);
  if (!league) return [];
  return league.divisions.find(d => d.level === level)?.clubs ?? [];
}
