// Années par club (« spells ») pour un socle de stars vérifiées.
// Objectif : pouvoir affirmer de façon FIABLE que deux joueurs ont été
// coéquipiers (même club à des dates qui se chevauchent) — la base players.jsx
// n'a pas les dates, donc deux joueurs passés par le même club à des époques
// différentes (ex. Evra & Niang à l'OM à ~12 ans d'écart) n'y sont PAS coéquipiers.
//
// Règles :
//  • Les noms de joueurs et de clubs doivent matcher EXACTEMENT ceux de players.jsx.
//  • `to` = année de départ ; pour un club encore en cours, on met 2026.
//  • Un même club peut apparaître 2× (deux passages) → deux entrées.
//  • Couverture volontairement partielle (stars) : le contraste « j'ai joué avec
//    X mais jamais avec Y » n'apparaît que si les 3 joueurs (mystère, X, Y) sont
//    couverts ici. Sinon on retombe sur un repli sûr côté FindPlayer.

export type Spell = { club: string; from: number; to: number };

export const CLUB_SPELLS: Record<string, Spell[]> = {
  // ── Barcelone ───────────────────────────────────────────────
  "Lionel Messi": [{ club: "Barcelona", from: 2004, to: 2021 }, { club: "PSG", from: 2021, to: 2023 }, { club: "Inter Miami", from: 2023, to: 2026 }],
  "Xavi": [{ club: "Barcelona", from: 1998, to: 2015 }, { club: "Al Sadd", from: 2015, to: 2019 }],
  "Andres Iniesta": [{ club: "Barcelona", from: 2002, to: 2018 }],
  "Sergio Busquets": [{ club: "Barcelona", from: 2008, to: 2023 }, { club: "Inter Miami", from: 2023, to: 2026 }],
  "Gerard Pique": [{ club: "Manchester United", from: 2004, to: 2008 }, { club: "Barcelona", from: 2008, to: 2022 }],
  "Dani Alves": [{ club: "Sevilla", from: 2003, to: 2008 }, { club: "Barcelona", from: 2008, to: 2016 }, { club: "Juventus FC", from: 2016, to: 2017 }, { club: "PSG", from: 2017, to: 2019 }],
  "Jordi Alba": [{ club: "Valencia", from: 2008, to: 2012 }, { club: "Barcelona", from: 2012, to: 2023 }, { club: "Inter Miami", from: 2023, to: 2026 }],
  "Luis Suárez": [{ club: "Ajax", from: 2007, to: 2011 }, { club: "Liverpool", from: 2011, to: 2014 }, { club: "Barcelona", from: 2014, to: 2020 }, { club: "Atletico Madrid", from: 2020, to: 2022 }, { club: "Inter Miami", from: 2024, to: 2026 }],
  "Neymar": [{ club: "Santos", from: 2009, to: 2013 }, { club: "Barcelona", from: 2013, to: 2017 }, { club: "PSG", from: 2017, to: 2023 }, { club: "Al Hilal", from: 2023, to: 2025 }, { club: "Santos", from: 2025, to: 2026 }],
  "David Villa": [{ club: "Valencia", from: 2005, to: 2010 }, { club: "Barcelona", from: 2010, to: 2013 }, { club: "Atletico Madrid", from: 2013, to: 2014 }],
  "Carles Puyol": [{ club: "Barcelona", from: 1999, to: 2014 }],

  // ── Real Madrid ─────────────────────────────────────────────
  "Cristiano Ronaldo": [{ club: "Sporting CP", from: 2002, to: 2003 }, { club: "Manchester United", from: 2003, to: 2009 }, { club: "Real Madrid", from: 2009, to: 2018 }, { club: "Juventus FC", from: 2018, to: 2021 }, { club: "Manchester United", from: 2021, to: 2022 }, { club: "Al Nassr", from: 2023, to: 2026 }],
  "Karim Benzema": [{ club: "Lyon", from: 2005, to: 2009 }, { club: "Real Madrid", from: 2009, to: 2023 }, { club: "Al Ittihad", from: 2023, to: 2026 }],
  "Luka Modrić": [{ club: "Tottenham", from: 2008, to: 2012 }, { club: "Real Madrid", from: 2012, to: 2025 }, { club: "AC Milan", from: 2025, to: 2026 }],
  "Sergio Ramos": [{ club: "Sevilla", from: 2004, to: 2005 }, { club: "Real Madrid", from: 2005, to: 2021 }, { club: "PSG", from: 2021, to: 2023 }, { club: "Sevilla", from: 2023, to: 2024 }, { club: "Monterrey", from: 2025, to: 2026 }],
  "Toni Kroos": [{ club: "Bayern Munich", from: 2007, to: 2014 }, { club: "Real Madrid", from: 2014, to: 2024 }],
  "Marcelo": [{ club: "Real Madrid", from: 2007, to: 2022 }],
  "Gareth Bale": [{ club: "Southampton", from: 2006, to: 2007 }, { club: "Tottenham", from: 2007, to: 2013 }, { club: "Real Madrid", from: 2013, to: 2022 }],
  "Angel Di Maria": [{ club: "Benfica", from: 2007, to: 2010 }, { club: "Real Madrid", from: 2010, to: 2014 }, { club: "Manchester United", from: 2014, to: 2015 }, { club: "PSG", from: 2015, to: 2022 }, { club: "Juventus FC", from: 2022, to: 2023 }, { club: "Benfica", from: 2023, to: 2026 }],
  "Casemiro": [{ club: "Real Madrid", from: 2013, to: 2022 }, { club: "Manchester United", from: 2022, to: 2026 }],
  "Raphael Varane": [{ club: "Lens", from: 2010, to: 2011 }, { club: "Real Madrid", from: 2011, to: 2021 }, { club: "Manchester United", from: 2021, to: 2024 }],
  "Isco": [{ club: "Valencia", from: 2011, to: 2013 }, { club: "Real Madrid", from: 2013, to: 2022 }, { club: "Sevilla", from: 2022, to: 2023 }, { club: "Real Betis", from: 2023, to: 2026 }],
  "Mesut Özil": [{ club: "Werder Bremen", from: 2008, to: 2010 }, { club: "Real Madrid", from: 2010, to: 2013 }, { club: "Arsenal", from: 2013, to: 2021 }, { club: "Fenerbahce", from: 2021, to: 2023 }],

  // ── Manchester United ───────────────────────────────────────
  "Wayne Rooney": [{ club: "Everton", from: 2002, to: 2004 }, { club: "Manchester United", from: 2004, to: 2017 }, { club: "Everton", from: 2017, to: 2018 }, { club: "DC United", from: 2018, to: 2020 }],
  "Rio Ferdinand": [{ club: "West Ham", from: 1995, to: 2000 }, { club: "Leeds", from: 2000, to: 2002 }, { club: "Manchester United", from: 2002, to: 2014 }, { club: "QPR", from: 2014, to: 2015 }],
  "Nemanja Vidić": [{ club: "Manchester United", from: 2006, to: 2014 }, { club: "Inter Milan", from: 2014, to: 2016 }],
  "Patrice Evra": [{ club: "Nice", from: 2000, to: 2002 }, { club: "Monaco", from: 2002, to: 2006 }, { club: "Manchester United", from: 2006, to: 2014 }, { club: "Juventus FC", from: 2014, to: 2017 }, { club: "Marseille", from: 2017, to: 2018 }, { club: "West Ham", from: 2018, to: 2018 }],
  "Ryan Giggs": [{ club: "Manchester United", from: 1990, to: 2014 }],
  "Michael Carrick": [{ club: "West Ham", from: 1999, to: 2004 }, { club: "Tottenham", from: 2004, to: 2006 }, { club: "Manchester United", from: 2006, to: 2018 }],
  "Nani": [{ club: "Sporting CP", from: 2005, to: 2007 }, { club: "Manchester United", from: 2007, to: 2015 }],

  // ── Chelsea ─────────────────────────────────────────────────
  "Didier Drogba": [{ club: "Le Mans", from: 2002, to: 2003 }, { club: "Guingamp", from: 2002, to: 2003 }, { club: "Marseille", from: 2003, to: 2004 }, { club: "Chelsea", from: 2004, to: 2012 }, { club: "Galatasaray", from: 2013, to: 2014 }, { club: "Chelsea", from: 2014, to: 2015 }],
  "Frank Lampard": [{ club: "West Ham", from: 1995, to: 2001 }, { club: "Chelsea", from: 2001, to: 2014 }, { club: "Manchester City", from: 2014, to: 2015 }, { club: "New York City FC", from: 2015, to: 2016 }],
  "Petr Čech": [{ club: "Rennes", from: 2002, to: 2004 }, { club: "Chelsea", from: 2004, to: 2015 }, { club: "Arsenal", from: 2015, to: 2019 }],
  "Ashley Cole": [{ club: "Arsenal", from: 1999, to: 2006 }, { club: "Chelsea", from: 2006, to: 2014 }, { club: "Roma", from: 2014, to: 2016 }, { club: "LA Galaxy", from: 2016, to: 2019 }],
  "Eden Hazard": [{ club: "Lille", from: 2007, to: 2012 }, { club: "Chelsea", from: 2012, to: 2019 }, { club: "Real Madrid", from: 2019, to: 2023 }],
  "Michael Essien": [{ club: "Lyon", from: 2003, to: 2005 }, { club: "Chelsea", from: 2005, to: 2014 }, { club: "AC Milan", from: 2014, to: 2015 }],

  // ── Bayern Munich ───────────────────────────────────────────
  "Robert Lewandowski": [{ club: "Borussia Dortmund", from: 2010, to: 2014 }, { club: "Bayern Munich", from: 2014, to: 2022 }, { club: "Barcelona", from: 2022, to: 2026 }],
  "Thomas Müller": [{ club: "Bayern Munich", from: 2008, to: 2025 }],
  "Manuel Neuer": [{ club: "Schalke", from: 2006, to: 2011 }, { club: "Bayern Munich", from: 2011, to: 2026 }],
  "Arjen Robben": [{ club: "PSV", from: 2002, to: 2004 }, { club: "Chelsea", from: 2004, to: 2007 }, { club: "Real Madrid", from: 2007, to: 2009 }, { club: "Bayern Munich", from: 2009, to: 2019 }],
  "Franck Ribéry": [{ club: "Marseille", from: 2005, to: 2007 }, { club: "Bayern Munich", from: 2007, to: 2019 }, { club: "Fiorentina", from: 2019, to: 2021 }],
  "David Alaba": [{ club: "Bayern Munich", from: 2010, to: 2021 }, { club: "Real Madrid", from: 2021, to: 2026 }],
  "Jerome Boateng": [{ club: "Hamburg", from: 2007, to: 2010 }, { club: "Manchester City", from: 2010, to: 2011 }, { club: "Bayern Munich", from: 2011, to: 2021 }, { club: "Lyon", from: 2021, to: 2023 }],
  "Thiago Alcântara": [{ club: "Barcelona", from: 2009, to: 2013 }, { club: "Bayern Munich", from: 2013, to: 2020 }, { club: "Liverpool", from: 2020, to: 2024 }],
  "Bastian Schweinsteiger": [{ club: "Bayern Munich", from: 2002, to: 2015 }, { club: "Manchester United", from: 2015, to: 2017 }, { club: "Chicago Fire", from: 2017, to: 2019 }],

  // ── PSG ─────────────────────────────────────────────────────
  "Kylian Mbappé": [{ club: "Monaco", from: 2015, to: 2017 }, { club: "PSG", from: 2017, to: 2024 }, { club: "Real Madrid", from: 2024, to: 2026 }],
  "Edinson Cavani": [{ club: "Palermo", from: 2007, to: 2010 }, { club: "Napoli", from: 2010, to: 2013 }, { club: "PSG", from: 2013, to: 2020 }, { club: "Manchester United", from: 2020, to: 2022 }, { club: "Valencia", from: 2022, to: 2023 }],
  "Marco Verratti": [{ club: "PSG", from: 2012, to: 2023 }],
  "Marquinhos": [{ club: "Roma", from: 2012, to: 2013 }, { club: "PSG", from: 2013, to: 2026 }],
  "Thiago Silva": [{ club: "AC Milan", from: 2009, to: 2012 }, { club: "PSG", from: 2012, to: 2020 }, { club: "Chelsea", from: 2020, to: 2024 }, { club: "Fluminense", from: 2024, to: 2026 }],

  // ── Juventus ────────────────────────────────────────────────
  "Gianluigi Buffon": [{ club: "Parma", from: 1995, to: 2001 }, { club: "Juventus FC", from: 2001, to: 2018 }, { club: "PSG", from: 2018, to: 2019 }, { club: "Juventus FC", from: 2019, to: 2021 }, { club: "Parma", from: 2021, to: 2023 }],
  "Giorgio Chiellini": [{ club: "Juventus FC", from: 2005, to: 2022 }, { club: "LAFC", from: 2022, to: 2023 }],
  "Leonardo Bonucci": [{ club: "Juventus FC", from: 2010, to: 2017 }, { club: "AC Milan", from: 2017, to: 2018 }, { club: "Juventus FC", from: 2018, to: 2023 }],
  "Paulo Dybala": [{ club: "Palermo", from: 2012, to: 2015 }, { club: "Juventus FC", from: 2015, to: 2022 }, { club: "Roma", from: 2022, to: 2026 }],
  "Gonzalo Higuain": [{ club: "Real Madrid", from: 2007, to: 2013 }, { club: "Napoli", from: 2013, to: 2016 }, { club: "Juventus FC", from: 2016, to: 2019 }, { club: "Inter Miami", from: 2020, to: 2022 }],
  "Paul Pogba": [{ club: "Manchester United", from: 2011, to: 2012 }, { club: "Juventus FC", from: 2012, to: 2016 }, { club: "Manchester United", from: 2016, to: 2022 }, { club: "Juventus FC", from: 2022, to: 2024 }],
  "Andrea Pirlo": [{ club: "Inter Milan", from: 1998, to: 2001 }, { club: "AC Milan", from: 2001, to: 2011 }, { club: "Juventus FC", from: 2011, to: 2015 }, { club: "New York City FC", from: 2015, to: 2017 }],

  // ── Liverpool ───────────────────────────────────────────────
  "Mohamed Salah": [{ club: "Chelsea", from: 2014, to: 2016 }, { club: "Roma", from: 2015, to: 2017 }, { club: "Liverpool", from: 2017, to: 2026 }],
  "Sadio Mané": [{ club: "Southampton", from: 2014, to: 2016 }, { club: "Liverpool", from: 2016, to: 2022 }, { club: "Bayern Munich", from: 2022, to: 2023 }, { club: "Al Nassr", from: 2023, to: 2026 }],
  "Roberto Firmino": [{ club: "Hoffenheim", from: 2011, to: 2015 }, { club: "Liverpool", from: 2015, to: 2023 }, { club: "Al Ahli", from: 2023, to: 2026 }],
  "Virgil van Dijk": [{ club: "Celtic", from: 2013, to: 2015 }, { club: "Southampton", from: 2015, to: 2018 }, { club: "Liverpool", from: 2018, to: 2026 }],
  "Alisson": [{ club: "Roma", from: 2016, to: 2018 }, { club: "Liverpool", from: 2018, to: 2026 }],
  "Steven Gerrard": [{ club: "Liverpool", from: 1998, to: 2015 }, { club: "LA Galaxy", from: 2015, to: 2016 }],

  // ── Manchester City ─────────────────────────────────────────
  "Sergio Aguero": [{ club: "Atletico Madrid", from: 2006, to: 2011 }, { club: "Manchester City", from: 2011, to: 2021 }, { club: "Barcelona", from: 2021, to: 2022 }],
  "Kevin De Bruyne": [{ club: "Chelsea", from: 2012, to: 2014 }, { club: "Wolfsburg", from: 2014, to: 2015 }, { club: "Manchester City", from: 2015, to: 2025 }],
  "David Silva": [{ club: "Valencia", from: 2004, to: 2010 }, { club: "Manchester City", from: 2010, to: 2020 }, { club: "Real Sociedad", from: 2020, to: 2023 }],
  "Raheem Sterling": [{ club: "Liverpool", from: 2012, to: 2015 }, { club: "Manchester City", from: 2015, to: 2022 }, { club: "Chelsea", from: 2022, to: 2025 }],
  "Yaya Touré": [{ club: "Barcelona", from: 2007, to: 2010 }, { club: "Manchester City", from: 2010, to: 2018 }],
  "İlkay Gündoğan": [{ club: "Borussia Dortmund", from: 2011, to: 2016 }, { club: "Manchester City", from: 2016, to: 2023 }, { club: "Barcelona", from: 2023, to: 2024 }, { club: "Manchester City", from: 2024, to: 2026 }],
  "Erling Haaland": [{ club: "Salzburg", from: 2019, to: 2020 }, { club: "Borussia Dortmund", from: 2020, to: 2022 }, { club: "Manchester City", from: 2022, to: 2026 }],

  // ── Arsenal ─────────────────────────────────────────────────
  "Thierry Henry": [{ club: "Monaco", from: 1994, to: 1999 }, { club: "Juventus FC", from: 1999, to: 1999 }, { club: "Arsenal", from: 1999, to: 2007 }, { club: "Barcelona", from: 2007, to: 2010 }, { club: "New York Red Bulls", from: 2010, to: 2014 }],
  "Cesc Fabregas": [{ club: "Arsenal", from: 2003, to: 2011 }, { club: "Barcelona", from: 2011, to: 2014 }, { club: "Chelsea", from: 2014, to: 2019 }, { club: "Monaco", from: 2019, to: 2022 }],
  "Robin van Persie": [{ club: "Feyenoord", from: 2001, to: 2004 }, { club: "Arsenal", from: 2004, to: 2012 }, { club: "Manchester United", from: 2012, to: 2015 }, { club: "Fenerbahce", from: 2015, to: 2018 }],
  "Patrick Vieira": [{ club: "AC Milan", from: 1995, to: 1996 }, { club: "Arsenal", from: 1996, to: 2005 }, { club: "Juventus FC", from: 2005, to: 2006 }, { club: "Inter Milan", from: 2006, to: 2010 }, { club: "Manchester City", from: 2010, to: 2011 }],

  // ── AC Milan / Inter ────────────────────────────────────────
  "Kaká": [{ club: "AC Milan", from: 2003, to: 2009 }, { club: "Real Madrid", from: 2009, to: 2013 }, { club: "AC Milan", from: 2013, to: 2014 }, { club: "Orlando City", from: 2014, to: 2017 }],
  "Zlatan Ibrahimovic": [{ club: "Ajax", from: 2001, to: 2004 }, { club: "Juventus FC", from: 2004, to: 2006 }, { club: "Inter Milan", from: 2006, to: 2009 }, { club: "Barcelona", from: 2009, to: 2011 }, { club: "AC Milan", from: 2011, to: 2012 }, { club: "PSG", from: 2012, to: 2016 }, { club: "Manchester United", from: 2016, to: 2018 }, { club: "LA Galaxy", from: 2018, to: 2019 }, { club: "AC Milan", from: 2020, to: 2023 }],
  "Samuel Eto'o": [{ club: "Barcelona", from: 2004, to: 2009 }, { club: "Inter Milan", from: 2009, to: 2011 }, { club: "Chelsea", from: 2013, to: 2014 }, { club: "Everton", from: 2014, to: 2015 }],
  "Wesley Sneijder": [{ club: "Ajax", from: 2003, to: 2007 }, { club: "Real Madrid", from: 2007, to: 2009 }, { club: "Inter Milan", from: 2009, to: 2013 }, { club: "Galatasaray", from: 2013, to: 2017 }],
  "Clarence Seedorf": [{ club: "Real Madrid", from: 1996, to: 1999 }, { club: "Inter Milan", from: 2000, to: 2002 }, { club: "AC Milan", from: 2002, to: 2012 }],

  // ── Icônes ──────────────────────────────────────────────────
  "Zinédine Zidane": [{ club: "Bordeaux", from: 1992, to: 1996 }, { club: "Juventus FC", from: 1996, to: 2001 }, { club: "Real Madrid", from: 2001, to: 2006 }],
  "Ronaldinho": [{ club: "Grêmio", from: 1998, to: 2001 }, { club: "PSG", from: 2001, to: 2003 }, { club: "Barcelona", from: 2003, to: 2008 }, { club: "AC Milan", from: 2008, to: 2011 }, { club: "Flamengo", from: 2011, to: 2012 }, { club: "Atlético Mineiro", from: 2012, to: 2014 }, { club: "Querétaro", from: 2014, to: 2015 }, { club: "Fluminense", from: 2015, to: 2015 }],
  "David Beckham": [{ club: "Manchester United", from: 1992, to: 2003 }, { club: "Real Madrid", from: 2003, to: 2007 }, { club: "LA Galaxy", from: 2007, to: 2012 }, { club: "AC Milan", from: 2009, to: 2010 }, { club: "PSG", from: 2013, to: 2013 }],
};

// Deux joueurs ont-ils été coéquipiers ? (même club + saisons qui se chevauchent)
// `to` = année de DÉPART (saison non jouée) → chevauchement STRICT : deux joueurs
// dont l'un part l'été où l'autre arrive (années qui se « touchent ») n'ont PAS
// joué ensemble (ex. Zlatan quitte le Barça 2010-11, Fàbregas arrive 2011).
export function wereTeammates(aName: string, bName: string): boolean {
  const a = CLUB_SPELLS[aName];
  const b = CLUB_SPELLS[bName];
  if (!a || !b) return false;
  for (const s1 of a) {
    for (const s2 of b) {
      if (s1.club === s2.club && s1.from < s2.to && s2.from < s1.to) return true;
    }
  }
  return false;
}

export function hasSpells(name: string): boolean {
  return !!CLUB_SPELLS[name];
}
