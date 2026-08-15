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
  "Andrés Iniesta": [{ club: "Barcelona", from: 2002, to: 2018 }],
  "Sergio Busquets": [{ club: "Barcelona", from: 2008, to: 2023 }, { club: "Inter Miami", from: 2023, to: 2026 }],
  "Gerard Piqué": [{ club: "Manchester United", from: 2004, to: 2008 }, { club: "Barcelona", from: 2008, to: 2022 }],
  "Dani Alves": [{ club: "Sevilla", from: 2003, to: 2008 }, { club: "Barcelona", from: 2008, to: 2016 }, { club: "Juventus FC", from: 2016, to: 2017 }, { club: "PSG", from: 2017, to: 2019 }],
  "Jordi Alba": [{ club: "Valencia", from: 2008, to: 2012 }, { club: "Barcelona", from: 2012, to: 2023 }, { club: "Inter Miami", from: 2023, to: 2026 }],
  "Luis Suárez": [{ club: "Ajax Amsterdam", from: 2007, to: 2011 }, { club: "Liverpool", from: 2011, to: 2014 }, { club: "Barcelona", from: 2014, to: 2020 }, { club: "Atletico Madrid", from: 2020, to: 2022 }, { club: "Inter Miami", from: 2024, to: 2026 }],
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
  "Ángel Di Maria": [{ club: "Benfica", from: 2007, to: 2010 }, { club: "Real Madrid", from: 2010, to: 2014 }, { club: "Manchester United", from: 2014, to: 2015 }, { club: "PSG", from: 2015, to: 2022 }, { club: "Juventus FC", from: 2022, to: 2023 }, { club: "Benfica", from: 2023, to: 2026 }],
  "Casemiro": [{ club: "Real Madrid", from: 2013, to: 2022 }, { club: "Manchester United", from: 2022, to: 2026 }],
  "Raphaël Varane": [{ club: "Lens", from: 2010, to: 2011 }, { club: "Real Madrid", from: 2011, to: 2021 }, { club: "Manchester United", from: 2021, to: 2024 }],
  "Isco": [{ club: "Valencia", from: 2011, to: 2013 }, { club: "Real Madrid", from: 2013, to: 2022 }, { club: "Sevilla", from: 2022, to: 2023 }, { club: "Real Betis", from: 2023, to: 2026 }],
  "Mesut Özil": [{ club: "Werder Bremen", from: 2008, to: 2010 }, { club: "Real Madrid", from: 2010, to: 2013 }, { club: "Arsenal", from: 2013, to: 2021 }, { club: "Fenerbahce", from: 2021, to: 2023 }],

  // ── Manchester United ───────────────────────────────────────
  "Wayne Rooney": [{ club: "Everton", from: 2002, to: 2004 }, { club: "Manchester United", from: 2004, to: 2017 }, { club: "Everton", from: 2017, to: 2018 }, { club: "DC United", from: 2018, to: 2020 }],
  "Rio Ferdinand": [{ club: "West Ham", from: 1995, to: 2000 }, { club: "Leeds United", from: 2000, to: 2002 }, { club: "Manchester United", from: 2002, to: 2014 }, { club: "QPR", from: 2014, to: 2015 }],
  "Nemanja Vidić": [{ club: "Manchester United", from: 2006, to: 2014 }, { club: "Inter Milan", from: 2014, to: 2016 }],
  "Patrice Evra": [{ club: "Nice", from: 2000, to: 2002 }, { club: "Monaco", from: 2002, to: 2006 }, { club: "Manchester United", from: 2006, to: 2014 }, { club: "Juventus FC", from: 2014, to: 2017 }, { club: "Marseille", from: 2017, to: 2018 }, { club: "West Ham", from: 2018, to: 2018 }],
  "Ryan Giggs": [{ club: "Manchester United", from: 1990, to: 2014 }],
  "Michael Carrick": [{ club: "West Ham", from: 1999, to: 2004 }, { club: "Tottenham", from: 2004, to: 2006 }, { club: "Manchester United", from: 2006, to: 2018 }],
  "Nani": [{ club: "Sporting CP", from: 2005, to: 2007 }, { club: "Manchester United", from: 2007, to: 2015 }],

  // ── Chelsea ─────────────────────────────────────────────────
  "Didier Drogba": [{ club: "Le Mans", from: 2002, to: 2003 }, { club: "Guingamp", from: 2002, to: 2003 }, { club: "Marseille", from: 2003, to: 2004 }, { club: "Chelsea", from: 2004, to: 2012 }, { club: "Galatasaray", from: 2013, to: 2014 }, { club: "Chelsea", from: 2014, to: 2015 }],
  "Frank Lampard": [{ club: "West Ham", from: 1995, to: 2001 }, { club: "Chelsea", from: 2001, to: 2014 }, { club: "Manchester City", from: 2014, to: 2015 }, { club: "New York City FC", from: 2015, to: 2016 }],
  "Petr Čech": [{ club: "Rennes", from: 2002, to: 2004 }, { club: "Chelsea", from: 2004, to: 2015 }, { club: "Arsenal", from: 2015, to: 2019 }],
  "Ashley Cole": [{ club: "Arsenal", from: 1999, to: 2006 }, { club: "Chelsea", from: 2006, to: 2014 }, { club: "AS Roma", from: 2014, to: 2016 }, { club: "LA Galaxy", from: 2016, to: 2019 }],
  "Eden Hazard": [{ club: "Lille", from: 2007, to: 2012 }, { club: "Chelsea", from: 2012, to: 2019 }, { club: "Real Madrid", from: 2019, to: 2023 }],
  "Michael Essien": [{ club: "Lyon", from: 2003, to: 2005 }, { club: "Chelsea", from: 2005, to: 2014 }, { club: "AC Milan", from: 2014, to: 2015 }],

  // ── Bayern Munich ───────────────────────────────────────────
  "Robert Lewandowski": [{ club: "Borussia Dortmund", from: 2010, to: 2014 }, { club: "Bayern Munich", from: 2014, to: 2022 }, { club: "Barcelona", from: 2022, to: 2026 }],
  "Thomas Müller": [{ club: "Bayern Munich", from: 2008, to: 2025 }],
  "Manuel Neuer": [{ club: "Schalke", from: 2006, to: 2011 }, { club: "Bayern Munich", from: 2011, to: 2026 }],
  "Arjen Robben": [{ club: "PSV Eindhoven", from: 2002, to: 2004 }, { club: "Chelsea", from: 2004, to: 2007 }, { club: "Real Madrid", from: 2007, to: 2009 }, { club: "Bayern Munich", from: 2009, to: 2019 }],
  "Franck Ribéry": [{ club: "Marseille", from: 2005, to: 2007 }, { club: "Bayern Munich", from: 2007, to: 2019 }, { club: "ACF Fiorentina", from: 2019, to: 2021 }],
  "David Alaba": [{ club: "Bayern Munich", from: 2010, to: 2021 }, { club: "Real Madrid", from: 2021, to: 2026 }],
  "Jerome Boateng": [{ club: "Hamburg", from: 2007, to: 2010 }, { club: "Manchester City", from: 2010, to: 2011 }, { club: "Bayern Munich", from: 2011, to: 2021 }, { club: "Lyon", from: 2021, to: 2023 }],
  "Thiago Alcântara": [{ club: "Barcelona", from: 2009, to: 2013 }, { club: "Bayern Munich", from: 2013, to: 2020 }, { club: "Liverpool", from: 2020, to: 2024 }],
  "Bastian Schweinsteiger": [{ club: "Bayern Munich", from: 2002, to: 2015 }, { club: "Manchester United", from: 2015, to: 2017 }, { club: "Chicago Fire", from: 2017, to: 2019 }],

  // ── PSG ─────────────────────────────────────────────────────
  "Kylian Mbappé": [{ club: "Monaco", from: 2015, to: 2017 }, { club: "PSG", from: 2017, to: 2024 }, { club: "Real Madrid", from: 2024, to: 2026 }],
  "Edinson Cavani": [{ club: "Palermo", from: 2007, to: 2010 }, { club: "SSC Napoli", from: 2010, to: 2013 }, { club: "PSG", from: 2013, to: 2020 }, { club: "Manchester United", from: 2020, to: 2022 }, { club: "Valencia", from: 2022, to: 2023 }],
  "Marco Verratti": [{ club: "PSG", from: 2012, to: 2023 }],
  "Marquinhos": [{ club: "AS Roma", from: 2012, to: 2013 }, { club: "PSG", from: 2013, to: 2026 }],
  "Thiago Silva": [{ club: "AC Milan", from: 2009, to: 2012 }, { club: "PSG", from: 2012, to: 2020 }, { club: "Chelsea", from: 2020, to: 2024 }, { club: "Fluminense", from: 2024, to: 2026 }],

  // ── Juventus ────────────────────────────────────────────────
  "Gianluigi Buffon": [{ club: "Parma FC", from: 1995, to: 2001 }, { club: "Juventus FC", from: 2001, to: 2018 }, { club: "PSG", from: 2018, to: 2019 }, { club: "Juventus FC", from: 2019, to: 2021 }, { club: "Parma FC", from: 2021, to: 2023 }],
  "Giorgio Chiellini": [{ club: "Juventus FC", from: 2005, to: 2022 }, { club: "LAFC", from: 2022, to: 2023 }],
  "Leonardo Bonucci": [{ club: "Juventus FC", from: 2010, to: 2017 }, { club: "AC Milan", from: 2017, to: 2018 }, { club: "Juventus FC", from: 2018, to: 2023 }],
  "Paulo Dybala": [{ club: "Palermo", from: 2012, to: 2015 }, { club: "Juventus FC", from: 2015, to: 2022 }, { club: "AS Roma", from: 2022, to: 2026 }],
  "Gonzalo Higuain": [{ club: "Real Madrid", from: 2007, to: 2013 }, { club: "SSC Napoli", from: 2013, to: 2016 }, { club: "Juventus FC", from: 2016, to: 2019 }, { club: "Inter Miami", from: 2020, to: 2022 }],
  "Paul Pogba": [{ club: "Manchester United", from: 2011, to: 2012 }, { club: "Juventus FC", from: 2012, to: 2016 }, { club: "Manchester United", from: 2016, to: 2022 }, { club: "Juventus FC", from: 2022, to: 2024 }],
  "Andrea Pirlo": [{ club: "Inter Milan", from: 1998, to: 2001 }, { club: "AC Milan", from: 2001, to: 2011 }, { club: "Juventus FC", from: 2011, to: 2015 }, { club: "New York City FC", from: 2015, to: 2017 }],

  // ── Liverpool ───────────────────────────────────────────────
  "Mohamed Salah": [{ club: "Chelsea", from: 2014, to: 2016 }, { club: "AS Roma", from: 2015, to: 2017 }, { club: "Liverpool", from: 2017, to: 2026 }],
  "Sadio Mané": [{ club: "Southampton", from: 2014, to: 2016 }, { club: "Liverpool", from: 2016, to: 2022 }, { club: "Bayern Munich", from: 2022, to: 2023 }, { club: "Al Nassr", from: 2023, to: 2026 }],
  "Roberto Firmino": [{ club: "Hoffenheim", from: 2011, to: 2015 }, { club: "Liverpool", from: 2015, to: 2023 }, { club: "Al Ahli", from: 2023, to: 2026 }],
  "Virgil van Dijk": [{ club: "Celtic", from: 2013, to: 2015 }, { club: "Southampton", from: 2015, to: 2018 }, { club: "Liverpool", from: 2018, to: 2026 }],
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
  "Zlatan Ibrahimović": [{ club: "Ajax Amsterdam", from: 2001, to: 2004 }, { club: "Juventus FC", from: 2004, to: 2006 }, { club: "Inter Milan", from: 2006, to: 2009 }, { club: "Barcelona", from: 2009, to: 2011 }, { club: "AC Milan", from: 2011, to: 2012 }, { club: "PSG", from: 2012, to: 2016 }, { club: "Manchester United", from: 2016, to: 2018 }, { club: "LA Galaxy", from: 2018, to: 2019 }, { club: "AC Milan", from: 2020, to: 2023 }],
  "Samuel Eto'o": [{ club: "Barcelona", from: 2004, to: 2009 }, { club: "Inter Milan", from: 2009, to: 2011 }, { club: "Chelsea", from: 2013, to: 2014 }, { club: "Everton", from: 2014, to: 2015 }],
  "Wesley Sneijder": [{ club: "Ajax Amsterdam", from: 2003, to: 2007 }, { club: "Real Madrid", from: 2007, to: 2009 }, { club: "Inter Milan", from: 2009, to: 2013 }, { club: "Galatasaray", from: 2013, to: 2017 }],
  "Clarence Seedorf": [{ club: "Real Madrid", from: 1996, to: 1999 }, { club: "Inter Milan", from: 2000, to: 2002 }, { club: "AC Milan", from: 2002, to: 2012 }],

  // ── Icônes ──────────────────────────────────────────────────
  "Zinédine Zidane": [{ club: "Bordeaux", from: 1992, to: 1996 }, { club: "Juventus FC", from: 1996, to: 2001 }, { club: "Real Madrid", from: 2001, to: 2006 }],
  "Ronaldinho": [{ club: "Grêmio", from: 1998, to: 2001 }, { club: "PSG", from: 2001, to: 2003 }, { club: "Barcelona", from: 2003, to: 2008 }, { club: "AC Milan", from: 2008, to: 2011 }, { club: "Flamengo", from: 2011, to: 2012 }, { club: "Atlético Mineiro", from: 2012, to: 2014 }, { club: "Querétaro", from: 2014, to: 2015 }, { club: "Fluminense", from: 2015, to: 2015 }],
  "David Beckham": [{ club: "Manchester United", from: 1992, to: 2003 }, { club: "Real Madrid", from: 2003, to: 2007 }, { club: "LA Galaxy", from: 2007, to: 2012 }, { club: "AC Milan", from: 2009, to: 2010 }, { club: "PSG", from: 2013, to: 2013 }],

  // ── Cadres Premier League ───────────────────────────────────
  // Manchester United
  "Paul Scholes": [{ club: "Manchester United", from: 1994, to: 2013 }],
  "Gary Neville": [{ club: "Manchester United", from: 1992, to: 2011 }],
  "Edwin van der Sar": [{ club: "Ajax Amsterdam", from: 1990, to: 1999 }, { club: "Juventus FC", from: 1999, to: 2001 }, { club: "Fulham", from: 2001, to: 2005 }, { club: "Manchester United", from: 2005, to: 2011 }],
  "David de Gea": [{ club: "Atletico Madrid", from: 2009, to: 2011 }, { club: "Manchester United", from: 2011, to: 2023 }],
  "Juan Mata": [{ club: "Valencia", from: 2007, to: 2011 }, { club: "Chelsea", from: 2011, to: 2014 }, { club: "Manchester United", from: 2014, to: 2022 }],
  "Marcus Rashford": [{ club: "Manchester United", from: 2015, to: 2026 }],
  "Bruno Fernandes": [{ club: "Sporting CP", from: 2017, to: 2020 }, { club: "Manchester United", from: 2020, to: 2026 }],
  "Antonio Valencia": [{ club: "Wigan Athletic", from: 2006, to: 2009 }, { club: "Manchester United", from: 2009, to: 2019 }],
  "Nemanja Matic": [{ club: "Chelsea", from: 2009, to: 2011 }, { club: "Benfica", from: 2011, to: 2014 }, { club: "Chelsea", from: 2014, to: 2017 }, { club: "Manchester United", from: 2017, to: 2022 }, { club: "AS Roma", from: 2022, to: 2023 }],
  // Chelsea
  "John Terry": [{ club: "Chelsea", from: 1998, to: 2017 }, { club: "Aston Villa", from: 2017, to: 2018 }],
  "Branislav Ivanović": [{ club: "Chelsea", from: 2008, to: 2017 }],
  "César Azpilicueta": [{ club: "Marseille", from: 2010, to: 2012 }, { club: "Chelsea", from: 2012, to: 2023 }, { club: "Atletico Madrid", from: 2023, to: 2025 }],
  "N'Golo Kanté": [{ club: "Leicester City", from: 2015, to: 2016 }, { club: "Chelsea", from: 2016, to: 2023 }, { club: "Al Ittihad", from: 2023, to: 2026 }],
  "Gary Cahill": [{ club: "Chelsea", from: 2012, to: 2019 }],
  "Diego Costa": [{ club: "Atletico Madrid", from: 2010, to: 2014 }, { club: "Chelsea", from: 2014, to: 2017 }, { club: "Atletico Madrid", from: 2018, to: 2020 }],
  "Thibaut Courtois": [{ club: "Atletico Madrid", from: 2011, to: 2014 }, { club: "Chelsea", from: 2014, to: 2018 }, { club: "Real Madrid", from: 2018, to: 2026 }],
  "Mason Mount": [{ club: "Chelsea", from: 2019, to: 2023 }, { club: "Manchester United", from: 2023, to: 2026 }],
  "Willian": [{ club: "Chelsea", from: 2013, to: 2020 }, { club: "Arsenal", from: 2020, to: 2021 }],
  // Arsenal
  "Robert Pires": [{ club: "Marseille", from: 1998, to: 2000 }, { club: "Arsenal", from: 2000, to: 2006 }, { club: "Villarreal", from: 2006, to: 2010 }],
  "Sol Campbell": [{ club: "Tottenham", from: 1995, to: 2001 }, { club: "Arsenal", from: 2001, to: 2006 }],
  "Gilberto Silva": [{ club: "Arsenal", from: 2002, to: 2008 }],
  "Laurent Koscielny": [{ club: "Arsenal", from: 2010, to: 2019 }, { club: "Bordeaux", from: 2019, to: 2022 }],
  "Alexis Sanchez": [{ club: "Barcelona", from: 2011, to: 2014 }, { club: "Arsenal", from: 2014, to: 2018 }, { club: "Manchester United", from: 2018, to: 2020 }, { club: "Inter Milan", from: 2020, to: 2022 }, { club: "Marseille", from: 2022, to: 2023 }],
  "Pierre-Emerick Aubameyang": [{ club: "Borussia Dortmund", from: 2013, to: 2018 }, { club: "Arsenal", from: 2018, to: 2022 }, { club: "Chelsea", from: 2022, to: 2023 }, { club: "Marseille", from: 2023, to: 2024 }],
  "Bacary Sagna": [{ club: "Arsenal", from: 2007, to: 2014 }, { club: "Manchester City", from: 2014, to: 2017 }],
  "Bukayo Saka": [{ club: "Arsenal", from: 2019, to: 2026 }],
  "Martin Ødegaard": [{ club: "Real Madrid", from: 2015, to: 2021 }, { club: "Arsenal", from: 2021, to: 2026 }],
  // Liverpool
  "Jamie Carragher": [{ club: "Liverpool", from: 1996, to: 2013 }],
  "Xabi Alonso": [{ club: "Real Sociedad", from: 2000, to: 2004 }, { club: "Liverpool", from: 2004, to: 2009 }, { club: "Real Madrid", from: 2009, to: 2014 }, { club: "Bayern Munich", from: 2014, to: 2017 }],
  "Fernando Torres": [{ club: "Atletico Madrid", from: 2001, to: 2007 }, { club: "Liverpool", from: 2007, to: 2011 }, { club: "Chelsea", from: 2011, to: 2014 }, { club: "AC Milan", from: 2014, to: 2015 }, { club: "Atletico Madrid", from: 2015, to: 2018 }],
  "Philippe Coutinho": [{ club: "Liverpool", from: 2013, to: 2018 }, { club: "Barcelona", from: 2018, to: 2022 }, { club: "Bayern Munich", from: 2019, to: 2020 }, { club: "Aston Villa", from: 2022, to: 2023 }],
  "Trent Alexander-Arnold": [{ club: "Liverpool", from: 2016, to: 2025 }, { club: "Real Madrid", from: 2025, to: 2026 }],
  "Andrew Robertson": [{ club: "Liverpool", from: 2017, to: 2026 }],
  "Fabinho": [{ club: "Monaco", from: 2015, to: 2018 }, { club: "Liverpool", from: 2018, to: 2023 }, { club: "Al Ittihad", from: 2023, to: 2026 }],
  // Manchester City
  "Fernandinho": [{ club: "Manchester City", from: 2013, to: 2022 }],
  "Bernardo Silva": [{ club: "Monaco", from: 2014, to: 2017 }, { club: "Manchester City", from: 2017, to: 2026 }],
  "Riyad Mahrez": [{ club: "Leicester City", from: 2014, to: 2018 }, { club: "Manchester City", from: 2018, to: 2023 }, { club: "Al Ahli", from: 2023, to: 2026 }],
  "Kyle Walker": [{ club: "Tottenham", from: 2009, to: 2017 }, { club: "Manchester City", from: 2017, to: 2025 }],
  "Rúben Dias": [{ club: "Benfica", from: 2017, to: 2020 }, { club: "Manchester City", from: 2020, to: 2026 }],
  "John Stones": [{ club: "Everton", from: 2013, to: 2016 }, { club: "Manchester City", from: 2016, to: 2026 }],
  "Jack Grealish": [{ club: "Aston Villa", from: 2014, to: 2021 }, { club: "Manchester City", from: 2021, to: 2026 }],
  "Pablo Zabaleta": [{ club: "Manchester City", from: 2008, to: 2017 }, { club: "West Ham", from: 2017, to: 2020 }],
  // Tottenham
  "Harry Kane": [{ club: "Tottenham", from: 2011, to: 2023 }, { club: "Bayern Munich", from: 2023, to: 2026 }],
  "Hugo Lloris": [{ club: "Lyon", from: 2008, to: 2012 }, { club: "Tottenham", from: 2012, to: 2023 }],
  "Dele Alli": [{ club: "Tottenham", from: 2015, to: 2022 }, { club: "Everton", from: 2022, to: 2024 }],
  "Christian Eriksen": [{ club: "Ajax Amsterdam", from: 2010, to: 2013 }, { club: "Tottenham", from: 2013, to: 2020 }, { club: "Inter Milan", from: 2020, to: 2021 }, { club: "Manchester United", from: 2022, to: 2026 }],
  "Jan Vertonghen": [{ club: "Ajax Amsterdam", from: 2006, to: 2012 }, { club: "Tottenham", from: 2012, to: 2020 }],
  // Leicester / Everton
  "Jamie Vardy": [{ club: "Leicester City", from: 2012, to: 2026 }],
  "Romelu Lukaku": [{ club: "Everton", from: 2014, to: 2017 }, { club: "Manchester United", from: 2017, to: 2019 }, { club: "Inter Milan", from: 2019, to: 2021 }, { club: "Chelsea", from: 2021, to: 2022 }, { club: "Inter Milan", from: 2022, to: 2023 }, { club: "AS Roma", from: 2023, to: 2024 }, { club: "SSC Napoli", from: 2024, to: 2026 }, { club: "Fenerbahce", from: 2026, to: 2027 }],
  "Seamus Coleman": [{ club: "Everton", from: 2009, to: 2026 }],

  // ── Cadres Serie A ──────────────────────────────────────────
  // Juventus
  "Alessandro Del Piero": [{ club: "Juventus FC", from: 1993, to: 2012 }, { club: "Sydney FC", from: 2012, to: 2014 }],
  "Pavel Nedvěd": [{ club: "SS Lazio", from: 1996, to: 2001 }, { club: "Juventus FC", from: 2001, to: 2009 }],
  "Gianluca Zambrotta": [{ club: "Juventus FC", from: 1999, to: 2006 }, { club: "Barcelona", from: 2006, to: 2008 }, { club: "AC Milan", from: 2008, to: 2012 }],
  "Claudio Marchisio": [{ club: "Juventus FC", from: 2006, to: 2018 }, { club: "Zenit", from: 2018, to: 2019 }],
  "Arturo Vidal": [{ club: "Bayer Leverkusen", from: 2007, to: 2011 }, { club: "Juventus FC", from: 2011, to: 2015 }, { club: "Bayern Munich", from: 2015, to: 2018 }, { club: "Barcelona", from: 2018, to: 2020 }, { club: "Inter Milan", from: 2020, to: 2022 }],
  "Miralem Pjanić": [{ club: "Lyon", from: 2008, to: 2011 }, { club: "AS Roma", from: 2011, to: 2016 }, { club: "Juventus FC", from: 2016, to: 2020 }, { club: "Barcelona", from: 2020, to: 2022 }],
  "Blaise Matuidi": [{ club: "Saint-Etienne", from: 2007, to: 2011 }, { club: "PSG", from: 2011, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2020 }, { club: "Inter Miami", from: 2020, to: 2022 }],
  "Juan Cuadrado": [{ club: "ACF Fiorentina", from: 2012, to: 2015 }, { club: "Chelsea", from: 2015, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2023 }, { club: "Inter Milan", from: 2023, to: 2024 }],
  "Alex Sandro": [{ club: "Porto", from: 2011, to: 2015 }, { club: "Juventus FC", from: 2015, to: 2023 }],
  "Wojciech Szczęsny": [{ club: "Arsenal", from: 2009, to: 2015 }, { club: "AS Roma", from: 2015, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2024 }, { club: "Barcelona", from: 2024, to: 2026 }],
  "Federico Chiesa": [{ club: "ACF Fiorentina", from: 2016, to: 2020 }, { club: "Juventus FC", from: 2020, to: 2024 }, { club: "Liverpool", from: 2024, to: 2026 }],
  "Andrea Barzagli": [{ club: "Palermo", from: 2003, to: 2008 }, { club: "Wolfsburg", from: 2008, to: 2011 }, { club: "Juventus FC", from: 2011, to: 2019 }],
  "Carlos Tevez": [{ club: "West Ham", from: 2006, to: 2007 }, { club: "Manchester United", from: 2007, to: 2009 }, { club: "Manchester City", from: 2009, to: 2013 }, { club: "Juventus FC", from: 2013, to: 2015 }, { club: "Boca Juniors", from: 2015, to: 2016 }],
  "Douglas Costa": [{ club: "Shakhtar Donetsk", from: 2010, to: 2015 }, { club: "Bayern Munich", from: 2015, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2020 }],
  // AC Milan
  "Paolo Maldini": [{ club: "AC Milan", from: 1985, to: 2009 }],
  "Alessandro Nesta": [{ club: "SS Lazio", from: 1993, to: 2002 }, { club: "AC Milan", from: 2002, to: 2012 }],
  "Gennaro Gattuso": [{ club: "AC Milan", from: 1999, to: 2012 }],
  "Filippo Inzaghi": [{ club: "Juventus FC", from: 1997, to: 2001 }, { club: "AC Milan", from: 2001, to: 2012 }],
  "Andriy Shevchenko": [{ club: "AC Milan", from: 1999, to: 2006 }, { club: "Chelsea", from: 2006, to: 2008 }, { club: "AC Milan", from: 2008, to: 2009 }],
  "Cafu": [{ club: "AS Roma", from: 1997, to: 2003 }, { club: "AC Milan", from: 2003, to: 2008 }],
  "Rui Costa": [{ club: "ACF Fiorentina", from: 1994, to: 2001 }, { club: "AC Milan", from: 2001, to: 2006 }],
  "Alexandre Pato": [{ club: "AC Milan", from: 2007, to: 2013 }],
  "Rafael Leao": [{ club: "Lille", from: 2018, to: 2019 }, { club: "AC Milan", from: 2019, to: 2026 }],
  "Theo Hernández": [{ club: "Real Madrid", from: 2017, to: 2019 }, { club: "AC Milan", from: 2019, to: 2025 }],
  "Sandro Tonali": [{ club: "AC Milan", from: 2020, to: 2023 }, { club: "Newcastle", from: 2023, to: 2026 }],
  "Franck Kessié": [{ club: "Atalanta BC", from: 2015, to: 2017 }, { club: "AC Milan", from: 2017, to: 2022 }, { club: "Barcelona", from: 2022, to: 2023 }, { club: "Al Ahli", from: 2023, to: 2026 }],
  // Inter
  "Javier Zanetti": [{ club: "Inter Milan", from: 1995, to: 2014 }],
  "Marco Materazzi": [{ club: "Inter Milan", from: 2001, to: 2011 }],
  "Esteban Cambiasso": [{ club: "Real Madrid", from: 2002, to: 2004 }, { club: "Inter Milan", from: 2004, to: 2014 }, { club: "Leicester City", from: 2014, to: 2015 }],
  "Walter Samuel": [{ club: "AS Roma", from: 2000, to: 2004 }, { club: "Real Madrid", from: 2004, to: 2005 }, { club: "Inter Milan", from: 2005, to: 2014 }],
  "Dejan Stanković": [{ club: "SS Lazio", from: 1998, to: 2004 }, { club: "Inter Milan", from: 2004, to: 2013 }],
  "Mauro Icardi": [{ club: "Inter Milan", from: 2013, to: 2019 }, { club: "PSG", from: 2019, to: 2022 }, { club: "Galatasaray", from: 2022, to: 2026 }],
  "Marcelo Brozovic": [{ club: "Inter Milan", from: 2015, to: 2023 }, { club: "Al Nassr", from: 2023, to: 2026 }],
  "Lautaro Martínez": [{ club: "Inter Milan", from: 2018, to: 2026 }],
  "Milan Škriniar": [{ club: "Sampdoria", from: 2016, to: 2017 }, { club: "Inter Milan", from: 2017, to: 2023 }, { club: "PSG", from: 2023, to: 2026 }],
  "Nicolò Barella": [{ club: "Cagliari Calcio", from: 2016, to: 2019 }, { club: "Inter Milan", from: 2019, to: 2026 }],
  "Hakan Çalhanoğlu": [{ club: "Bayer Leverkusen", from: 2014, to: 2017 }, { club: "AC Milan", from: 2017, to: 2021 }, { club: "Inter Milan", from: 2021, to: 2026 }],
  "Ivan Perišić": [{ club: "Wolfsburg", from: 2013, to: 2015 }, { club: "Inter Milan", from: 2015, to: 2022 }, { club: "Tottenham", from: 2022, to: 2024 }],
  // Roma
  "Francesco Totti": [{ club: "AS Roma", from: 1993, to: 2017 }],
  "Daniele De Rossi": [{ club: "AS Roma", from: 2001, to: 2019 }, { club: "Boca Juniors", from: 2019, to: 2020 }],
  "Edin Džeko": [{ club: "Wolfsburg", from: 2007, to: 2011 }, { club: "Manchester City", from: 2011, to: 2015 }, { club: "AS Roma", from: 2015, to: 2021 }, { club: "Inter Milan", from: 2021, to: 2023 }, { club: "Fenerbahce", from: 2023, to: 2026 }],
  "Lorenzo Pellegrini": [{ club: "Sassuolo", from: 2015, to: 2017 }, { club: "AS Roma", from: 2017, to: 2026 }],
  "Radja Nainggolan": [{ club: "Cagliari Calcio", from: 2010, to: 2014 }, { club: "AS Roma", from: 2014, to: 2018 }, { club: "Inter Milan", from: 2018, to: 2020 }, { club: "Cagliari Calcio", from: 2020, to: 2022 }],
  // Napoli
  "Marek Hamšík": [{ club: "Brescia", from: 2004, to: 2007 }, { club: "SSC Napoli", from: 2007, to: 2019 }],
  "Lorenzo Insigne": [{ club: "SSC Napoli", from: 2010, to: 2022 }, { club: "Toronto FC", from: 2022, to: 2025 }],
  "Kalidou Koulibaly": [{ club: "Genk", from: 2012, to: 2014 }, { club: "SSC Napoli", from: 2014, to: 2022 }, { club: "Chelsea", from: 2022, to: 2023 }, { club: "Al Hilal", from: 2023, to: 2026 }],
  "Dries Mertens": [{ club: "PSV Eindhoven", from: 2011, to: 2013 }, { club: "SSC Napoli", from: 2013, to: 2022 }, { club: "Galatasaray", from: 2022, to: 2026 }],
  "Victor Osimhen": [{ club: "Lille", from: 2019, to: 2020 }, { club: "SSC Napoli", from: 2020, to: 2026 }],
  "Khvicha Kvaratskhelia": [{ club: "SSC Napoli", from: 2022, to: 2025 }, { club: "PSG", from: 2025, to: 2026 }],
  "Piotr Zieliński": [{ club: "SSC Napoli", from: 2016, to: 2024 }, { club: "Inter Milan", from: 2024, to: 2026 }],
  // Lazio / Atalanta
  "Ciro Immobile": [{ club: "Torino FC", from: 2013, to: 2014 }, { club: "Borussia Dortmund", from: 2014, to: 2015 }, { club: "SS Lazio", from: 2016, to: 2024 }, { club: "Besiktas", from: 2024, to: 2026 }],
  "Sergej Milinković-Savić": [{ club: "SS Lazio", from: 2015, to: 2023 }, { club: "Al Hilal", from: 2023, to: 2026 }],
  "Miroslav Klose": [{ club: "Werder Bremen", from: 1999, to: 2007 }, { club: "Bayern Munich", from: 2007, to: 2011 }, { club: "SS Lazio", from: 2011, to: 2016 }],
  "Alejandro Gómez": [{ club: "Atalanta BC", from: 2014, to: 2021 }, { club: "Sevilla", from: 2021, to: 2023 }],
  "Duván Zapata": [{ club: "Atalanta BC", from: 2018, to: 2024 }, { club: "Torino FC", from: 2024, to: 2026 }],

  // ── Cadres La Liga ──────────────────────────────────────────
  // Atlético Madrid
  "Antoine Griezmann": [{ club: "Real Sociedad", from: 2009, to: 2014 }, { club: "Atletico Madrid", from: 2014, to: 2019 }, { club: "Barcelona", from: 2019, to: 2021 }, { club: "Atletico Madrid", from: 2021, to: 2026 }],
  "Koke": [{ club: "Atletico Madrid", from: 2009, to: 2026 }],
  "Saúl Ñíguez": [{ club: "Atletico Madrid", from: 2012, to: 2024 }, { club: "Sevilla", from: 2024, to: 2026 }],
  "Jan Oblak": [{ club: "Atletico Madrid", from: 2014, to: 2026 }],
  "Diego Godín": [{ club: "Villarreal", from: 2007, to: 2010 }, { club: "Atletico Madrid", from: 2010, to: 2019 }, { club: "Inter Milan", from: 2019, to: 2020 }, { club: "Cagliari Calcio", from: 2020, to: 2021 }],
  "Filipe Luís": [{ club: "Atletico Madrid", from: 2010, to: 2014 }, { club: "Chelsea", from: 2014, to: 2015 }, { club: "Atletico Madrid", from: 2015, to: 2019 }, { club: "Flamengo", from: 2019, to: 2023 }],
  "José María Giménez": [{ club: "Atletico Madrid", from: 2013, to: 2026 }],
  "João Félix": [{ club: "Benfica", from: 2018, to: 2019 }, { club: "Atletico Madrid", from: 2019, to: 2024 }],
  "Yannick Carrasco": [{ club: "Monaco", from: 2012, to: 2015 }, { club: "Atletico Madrid", from: 2016, to: 2018 }, { club: "Atletico Madrid", from: 2020, to: 2023 }, { club: "Al Shabab", from: 2023, to: 2026 }],
  "Marcos Llorente": [{ club: "Real Madrid", from: 2015, to: 2019 }, { club: "Atletico Madrid", from: 2019, to: 2026 }],
  "Álvaro Morata": [{ club: "Real Madrid", from: 2010, to: 2014 }, { club: "Juventus FC", from: 2014, to: 2016 }, { club: "Real Madrid", from: 2016, to: 2017 }, { club: "Chelsea", from: 2017, to: 2019 }, { club: "Atletico Madrid", from: 2019, to: 2024 }, { club: "AC Milan", from: 2024, to: 2025 }],
  "Thomas Partey": [{ club: "Atletico Madrid", from: 2015, to: 2020 }, { club: "Arsenal", from: 2020, to: 2025 }],
  "Rodri": [{ club: "Villarreal", from: 2015, to: 2018 }, { club: "Atletico Madrid", from: 2018, to: 2019 }, { club: "Manchester City", from: 2019, to: 2026 }],
  "Ángel Correa": [{ club: "Atletico Madrid", from: 2015, to: 2025 }, { club: "Tigres", from: 2025, to: 2026 }],
  "Rodrigo De Paul": [{ club: "Valencia", from: 2014, to: 2016 }, { club: "Udinese Calcio", from: 2016, to: 2021 }, { club: "Atletico Madrid", from: 2021, to: 2025 }, { club: "Inter Miami", from: 2025, to: 2026 }],
  // Barcelone (moderne)
  "Frenkie de Jong": [{ club: "Ajax Amsterdam", from: 2015, to: 2019 }, { club: "Barcelona", from: 2019, to: 2026 }],
  "Pedri": [{ club: "Barcelona", from: 2020, to: 2026 }],
  "Gavi": [{ club: "Barcelona", from: 2021, to: 2026 }],
  "Ronald Araújo": [{ club: "Barcelona", from: 2020, to: 2026 }, { club: "Liverpool", from: 2026, to: 2027 }],
  "Jules Kounde": [{ club: "Sevilla", from: 2019, to: 2022 }, { club: "Barcelona", from: 2022, to: 2026 }],
  "Marc-André ter Stegen": [{ club: "Borussia Mönchengladbach", from: 2010, to: 2014 }, { club: "Barcelona", from: 2014, to: 2026 }],
  "Raphinha": [{ club: "Leeds United", from: 2020, to: 2022 }, { club: "Barcelona", from: 2022, to: 2026 }],
  // Le `to: 2026` du Barça n'est plus « encore là » mais une vraie année de
  // départ : Torres a signé au PSG jusqu'en 2031 (annonce du club, 15/08/2026).
  "Ferran Torres": [{ club: "Valencia", from: 2017, to: 2020 }, { club: "Manchester City", from: 2020, to: 2022 }, { club: "Barcelona", from: 2022, to: 2026 }, { club: "PSG", from: 2026, to: 2027 }],
  "Ivan Rakitić": [{ club: "Sevilla", from: 2011, to: 2014 }, { club: "Barcelona", from: 2014, to: 2020 }, { club: "Sevilla", from: 2020, to: 2024 }],
  "Sergi Roberto": [{ club: "Barcelona", from: 2013, to: 2024 }],
  "Ousmane Dembélé": [{ club: "Rennes", from: 2015, to: 2016 }, { club: "Borussia Dortmund", from: 2016, to: 2017 }, { club: "Barcelona", from: 2017, to: 2023 }, { club: "PSG", from: 2023, to: 2026 }],
  "Ansu Fati": [{ club: "Barcelona", from: 2019, to: 2024 }, { club: "Brighton", from: 2023, to: 2024 }],
  // Real Madrid (moderne)
  "Federico Valverde": [{ club: "Real Madrid", from: 2018, to: 2026 }],
  "Vinícius Júnior": [{ club: "Flamengo", from: 2017, to: 2018 }, { club: "Real Madrid", from: 2018, to: 2026 }],
  "Rodrygo": [{ club: "Santos", from: 2017, to: 2019 }, { club: "Real Madrid", from: 2019, to: 2026 }],
  "Eduardo Camavinga": [{ club: "Rennes", from: 2019, to: 2021 }, { club: "Real Madrid", from: 2021, to: 2026 }],
  "Aurélien Tchouaméni": [{ club: "Monaco", from: 2020, to: 2022 }, { club: "Real Madrid", from: 2022, to: 2026 }],
  "Jude Bellingham": [{ club: "Borussia Dortmund", from: 2020, to: 2023 }, { club: "Real Madrid", from: 2023, to: 2026 }],
  "Dani Carvajal": [{ club: "Bayer Leverkusen", from: 2012, to: 2013 }, { club: "Real Madrid", from: 2013, to: 2026 }],
  "Éder Militão": [{ club: "Porto", from: 2018, to: 2019 }, { club: "Real Madrid", from: 2019, to: 2026 }],
  "Antonio Rüdiger": [{ club: "AS Roma", from: 2015, to: 2017 }, { club: "Chelsea", from: 2017, to: 2022 }, { club: "Real Madrid", from: 2022, to: 2026 }],
  "Nacho Fernández": [{ club: "Real Madrid", from: 2011, to: 2024 }],
  "Lucas Vázquez": [{ club: "Real Madrid", from: 2015, to: 2025 }],
  // Real Madrid (légendes)
  "Iker Casillas": [{ club: "Real Madrid", from: 1999, to: 2015 }, { club: "Porto", from: 2015, to: 2020 }],
  "Raúl González": [{ club: "Real Madrid", from: 1994, to: 2010 }, { club: "Schalke", from: 2010, to: 2012 }, { club: "Al Sadd", from: 2012, to: 2014 }],
  "Roberto Carlos": [{ club: "Inter Milan", from: 1995, to: 1996 }, { club: "Real Madrid", from: 1996, to: 2007 }, { club: "Fenerbahce", from: 2007, to: 2009 }],
  // Barcelone (légendes)
  "Deco": [{ club: "Porto", from: 1999, to: 2004 }, { club: "Barcelona", from: 2004, to: 2008 }, { club: "Chelsea", from: 2008, to: 2010 }, { club: "Fluminense", from: 2010, to: 2013 }],
  "Víctor Valdés": [{ club: "Barcelona", from: 2002, to: 2014 }, { club: "Manchester United", from: 2015, to: 2016 }],
  "Éric Abidal": [{ club: "Lyon", from: 2004, to: 2007 }, { club: "Barcelona", from: 2007, to: 2013 }, { club: "Monaco", from: 2013, to: 2014 }],
  "Seydou Keita": [{ club: "Sevilla", from: 2007, to: 2008 }, { club: "Barcelona", from: 2008, to: 2012 }],
  // Séville / Valence / Villarreal / Athletic / Sociedad / Betis
  "Jesús Navas": [{ club: "Sevilla", from: 2003, to: 2013 }, { club: "Manchester City", from: 2013, to: 2017 }, { club: "Sevilla", from: 2017, to: 2025 }],
  "Éver Banega": [{ club: "Valencia", from: 2008, to: 2014 }, { club: "Sevilla", from: 2014, to: 2016 }, { club: "Inter Milan", from: 2016, to: 2017 }, { club: "Sevilla", from: 2017, to: 2020 }],
  "Parejo": [{ club: "Valencia", from: 2011, to: 2020 }, { club: "Villarreal", from: 2020, to: 2026 }],
  "José Gayà": [{ club: "Valencia", from: 2012, to: 2026 }],
  "Santi Cazorla": [{ club: "Villarreal", from: 2006, to: 2011 }, { club: "Málaga", from: 2011, to: 2012 }, { club: "Arsenal", from: 2012, to: 2018 }, { club: "Villarreal", from: 2018, to: 2020 }, { club: "Al Sadd", from: 2020, to: 2023 }],
  "Gerard Moreno": [{ club: "Villarreal", from: 2013, to: 2015 }, { club: "Espanyol", from: 2015, to: 2018 }, { club: "Villarreal", from: 2018, to: 2026 }],
  "Inaki Williams": [{ club: "Athletic Bilbao", from: 2014, to: 2026 }],
  "Nico Williams": [{ club: "Athletic Bilbao", from: 2020, to: 2026 }],
  "Mikel Oyarzabal": [{ club: "Real Sociedad", from: 2015, to: 2026 }],
  "Nabil Fekir": [{ club: "Lyon", from: 2013, to: 2019 }, { club: "Real Betis", from: 2019, to: 2026 }],

  // ── Cadres Bundesliga ───────────────────────────────────────
  // Bayern
  "Joshua Kimmich": [{ club: "RB Leipzig", from: 2013, to: 2015 }, { club: "Bayern Munich", from: 2015, to: 2026 }],
  "Leon Goretzka": [{ club: "Schalke", from: 2013, to: 2018 }, { club: "Bayern Munich", from: 2018, to: 2026 }],
  "Serge Gnabry": [{ club: "Arsenal", from: 2012, to: 2016 }, { club: "Werder Bremen", from: 2016, to: 2017 }, { club: "Bayern Munich", from: 2017, to: 2026 }],
  "Kingsley Coman": [{ club: "PSG", from: 2013, to: 2014 }, { club: "Juventus FC", from: 2014, to: 2015 }, { club: "Bayern Munich", from: 2015, to: 2026 }],
  "Jamal Musiala": [{ club: "Bayern Munich", from: 2020, to: 2026 }],
  "Leroy Sané": [{ club: "Schalke", from: 2014, to: 2016 }, { club: "Manchester City", from: 2016, to: 2020 }, { club: "Bayern Munich", from: 2020, to: 2025 }, { club: "Galatasaray", from: 2025, to: 2026 }],
  "Dayot Upamecano": [{ club: "RB Leipzig", from: 2017, to: 2021 }, { club: "Bayern Munich", from: 2021, to: 2026 }],
  "Javi Martínez": [{ club: "Athletic Bilbao", from: 2006, to: 2012 }, { club: "Bayern Munich", from: 2012, to: 2021 }],
  "Corentin Tolisso": [{ club: "Lyon", from: 2013, to: 2017 }, { club: "Bayern Munich", from: 2017, to: 2022 }, { club: "Lyon", from: 2022, to: 2026 }],
  "Benjamin Pavard": [{ club: "Lille", from: 2015, to: 2016 }, { club: "Stuttgart", from: 2016, to: 2019 }, { club: "Bayern Munich", from: 2019, to: 2023 }, { club: "Inter Milan", from: 2023, to: 2026 }],
  "Niklas Süle": [{ club: "Hoffenheim", from: 2009, to: 2017 }, { club: "Bayern Munich", from: 2017, to: 2022 }, { club: "Borussia Dortmund", from: 2022, to: 2026 }],
  "Philipp Lahm": [{ club: "Stuttgart", from: 2003, to: 2005 }, { club: "Bayern Munich", from: 2005, to: 2017 }],
  // Dortmund
  "Marco Reus": [{ club: "Borussia Mönchengladbach", from: 2009, to: 2012 }, { club: "Borussia Dortmund", from: 2012, to: 2024 }, { club: "LA Galaxy", from: 2024, to: 2026 }],
  "Mats Hummels": [{ club: "Borussia Dortmund", from: 2008, to: 2016 }, { club: "Bayern Munich", from: 2016, to: 2019 }, { club: "Borussia Dortmund", from: 2019, to: 2024 }, { club: "AS Roma", from: 2024, to: 2025 }],
  "Mario Götze": [{ club: "Borussia Dortmund", from: 2009, to: 2013 }, { club: "Bayern Munich", from: 2013, to: 2016 }, { club: "Borussia Dortmund", from: 2016, to: 2020 }, { club: "PSV Eindhoven", from: 2020, to: 2022 }, { club: "Eintracht Frankfurt", from: 2022, to: 2026 }],
  "Nuri Şahin": [{ club: "Borussia Dortmund", from: 2005, to: 2011 }, { club: "Real Madrid", from: 2011, to: 2012 }, { club: "Borussia Dortmund", from: 2013, to: 2018 }, { club: "Werder Bremen", from: 2018, to: 2020 }],
  "Shinji Kagawa": [{ club: "Borussia Dortmund", from: 2010, to: 2012 }, { club: "Manchester United", from: 2012, to: 2014 }, { club: "Borussia Dortmund", from: 2014, to: 2019 }],
  "Christian Pulisic": [{ club: "Borussia Dortmund", from: 2016, to: 2019 }, { club: "Chelsea", from: 2019, to: 2023 }, { club: "AC Milan", from: 2023, to: 2026 }],
  "Jadon Sancho": [{ club: "Borussia Dortmund", from: 2017, to: 2021 }, { club: "Manchester United", from: 2021, to: 2024 }, { club: "Chelsea", from: 2024, to: 2025 }],
  "Julian Brandt": [{ club: "Bayer Leverkusen", from: 2014, to: 2019 }, { club: "Borussia Dortmund", from: 2019, to: 2026 }],
  "Emre Can": [{ club: "Bayern Munich", from: 2013, to: 2014 }, { club: "Liverpool", from: 2014, to: 2018 }, { club: "Juventus FC", from: 2018, to: 2020 }, { club: "Borussia Dortmund", from: 2020, to: 2026 }],
  // Leverkusen
  "Florian Wirtz": [{ club: "Bayer Leverkusen", from: 2020, to: 2025 }, { club: "Liverpool", from: 2025, to: 2026 }],
  "Granit Xhaka": [{ club: "Borussia Mönchengladbach", from: 2012, to: 2016 }, { club: "Arsenal", from: 2016, to: 2023 }, { club: "Bayer Leverkusen", from: 2023, to: 2026 }],
  "Jonathan Tah": [{ club: "Bayer Leverkusen", from: 2015, to: 2025 }, { club: "Bayern Munich", from: 2025, to: 2026 }],
  "Kai Havertz": [{ club: "Bayer Leverkusen", from: 2016, to: 2020 }, { club: "Chelsea", from: 2020, to: 2023 }, { club: "Arsenal", from: 2023, to: 2026 }],
  "Stefan Kießling": [{ club: "Bayer Leverkusen", from: 2006, to: 2018 }],
  // RB Leipzig
  "Timo Werner": [{ club: "Stuttgart", from: 2013, to: 2016 }, { club: "RB Leipzig", from: 2016, to: 2020 }, { club: "Chelsea", from: 2020, to: 2022 }, { club: "RB Leipzig", from: 2022, to: 2024 }, { club: "Tottenham", from: 2024, to: 2025 }],
  "Dani Olmo": [{ club: "Dinamo Zagreb", from: 2015, to: 2020 }, { club: "RB Leipzig", from: 2020, to: 2024 }, { club: "Barcelona", from: 2024, to: 2026 }],
  "Christopher Nkunku": [{ club: "PSG", from: 2015, to: 2019 }, { club: "RB Leipzig", from: 2019, to: 2023 }, { club: "Chelsea", from: 2023, to: 2026 }],
  "Emil Forsberg": [{ club: "RB Leipzig", from: 2015, to: 2023 }, { club: "New York Red Bulls", from: 2023, to: 2026 }],
  "Naby Keïta": [{ club: "RB Leipzig", from: 2016, to: 2018 }, { club: "Liverpool", from: 2018, to: 2023 }, { club: "Werder Bremen", from: 2023, to: 2025 }],
  // Schalke / divers
  "Klaas-Jan Huntelaar": [{ club: "Ajax Amsterdam", from: 2006, to: 2009 }, { club: "Real Madrid", from: 2009, to: 2010 }, { club: "AC Milan", from: 2010, to: 2011 }, { club: "Schalke", from: 2011, to: 2017 }, { club: "Ajax Amsterdam", from: 2017, to: 2021 }],
  "Julian Draxler": [{ club: "Schalke", from: 2011, to: 2015 }, { club: "Wolfsburg", from: 2015, to: 2017 }, { club: "PSG", from: 2017, to: 2023 }],
  "Benedikt Höwedes": [{ club: "Schalke", from: 2007, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2018 }, { club: "Lokomotiv Moscow", from: 2018, to: 2020 }],
  "Claudio Pizarro": [{ club: "Bayern Munich", from: 2001, to: 2007 }, { club: "Chelsea", from: 2007, to: 2008 }, { club: "Werder Bremen", from: 2008, to: 2012 }, { club: "Bayern Munich", from: 2012, to: 2015 }, { club: "Werder Bremen", from: 2015, to: 2020 }],
  "Sami Khedira": [{ club: "Stuttgart", from: 2006, to: 2010 }, { club: "Real Madrid", from: 2010, to: 2015 }, { club: "Juventus FC", from: 2015, to: 2021 }],
  "Sébastien Haller": [{ club: "Eintracht Frankfurt", from: 2017, to: 2019 }, { club: "West Ham", from: 2019, to: 2021 }, { club: "Ajax Amsterdam", from: 2021, to: 2022 }, { club: "Borussia Dortmund", from: 2022, to: 2024 }],
  "Luka Jović": [{ club: "Eintracht Frankfurt", from: 2017, to: 2019 }, { club: "Real Madrid", from: 2019, to: 2023 }, { club: "AC Milan", from: 2024, to: 2025 }],
  "Randal Kolo Muani": [{ club: "Nantes", from: 2018, to: 2022 }, { club: "Eintracht Frankfurt", from: 2022, to: 2023 }, { club: "PSG", from: 2023, to: 2026 }],

  // ── Cadres Ligue 1 ──────────────────────────────────────────
  // PSG
  "Presnel Kimpembe": [{ club: "PSG", from: 2014, to: 2026 }],
  "Idrissa Gueye": [{ club: "Lille", from: 2010, to: 2015 }, { club: "Aston Villa", from: 2015, to: 2016 }, { club: "Everton", from: 2016, to: 2019 }, { club: "PSG", from: 2019, to: 2022 }, { club: "Everton", from: 2022, to: 2026 }, { club: "Al Diriyah", from: 2026, to: 2027 }],
  "Achraf Hakimi": [{ club: "Real Madrid", from: 2017, to: 2020 }, { club: "Inter Milan", from: 2020, to: 2021 }, { club: "PSG", from: 2021, to: 2026 }],
  "Vitinha": [{ club: "Porto", from: 2020, to: 2022 }, { club: "PSG", from: 2022, to: 2026 }],
  "Warren Zaïre-Emery": [{ club: "PSG", from: 2022, to: 2026 }],
  "Javier Pastore": [{ club: "Palermo", from: 2009, to: 2011 }, { club: "PSG", from: 2011, to: 2018 }, { club: "AS Roma", from: 2018, to: 2021 }],
  "Ezequiel Lavezzi": [{ club: "SSC Napoli", from: 2007, to: 2012 }, { club: "PSG", from: 2012, to: 2016 }],
  "Adrien Rabiot": [{ club: "PSG", from: 2012, to: 2019 }, { club: "Juventus FC", from: 2019, to: 2024 }, { club: "Marseille", from: 2024, to: 2025 }],
  "Lucas Moura": [{ club: "PSG", from: 2013, to: 2018 }, { club: "Tottenham", from: 2018, to: 2023 }],
  "Serge Aurier": [{ club: "Toulouse", from: 2012, to: 2014 }, { club: "PSG", from: 2014, to: 2017 }, { club: "Tottenham", from: 2017, to: 2020 }],
  "Thiago Motta": [{ club: "Barcelona", from: 2001, to: 2007 }, { club: "Genoa CFC", from: 2008, to: 2009 }, { club: "Inter Milan", from: 2009, to: 2012 }, { club: "PSG", from: 2012, to: 2018 }],
  // Lyon
  "Alexandre Lacazette": [{ club: "Lyon", from: 2010, to: 2017 }, { club: "Arsenal", from: 2017, to: 2022 }, { club: "Lyon", from: 2022, to: 2025 }],
  "Memphis Depay": [{ club: "PSV Eindhoven", from: 2011, to: 2015 }, { club: "Manchester United", from: 2015, to: 2017 }, { club: "Lyon", from: 2017, to: 2021 }, { club: "Barcelona", from: 2021, to: 2023 }, { club: "Atletico Madrid", from: 2023, to: 2024 }],
  "Anthony Lopes": [{ club: "Lyon", from: 2012, to: 2026 }],
  "Houssem Aouar": [{ club: "Lyon", from: 2016, to: 2023 }, { club: "AS Roma", from: 2023, to: 2026 }],
  // Marseille
  "Dimitri Payet": [{ club: "Saint-Etienne", from: 2007, to: 2011 }, { club: "Lille", from: 2011, to: 2013 }, { club: "Marseille", from: 2013, to: 2015 }, { club: "West Ham", from: 2015, to: 2017 }, { club: "Marseille", from: 2017, to: 2023 }],
  "Steve Mandanda": [{ club: "Marseille", from: 2007, to: 2016 }, { club: "Crystal Palace", from: 2016, to: 2017 }, { club: "Marseille", from: 2017, to: 2022 }, { club: "Rennes", from: 2022, to: 2026 }],
  "Florian Thauvin": [{ club: "Marseille", from: 2013, to: 2015 }, { club: "Newcastle", from: 2015, to: 2016 }, { club: "Marseille", from: 2016, to: 2021 }, { club: "Udinese Calcio", from: 2023, to: 2025 }],
  "Mathieu Valbuena": [{ club: "Marseille", from: 2006, to: 2014 }, { club: "Lyon", from: 2015, to: 2017 }, { club: "Fenerbahce", from: 2017, to: 2020 }],
  "Boubacar Kamara": [{ club: "Marseille", from: 2016, to: 2022 }, { club: "Aston Villa", from: 2022, to: 2026 }],
  // Monaco
  "Radamel Falcao": [{ club: "Porto", from: 2009, to: 2011 }, { club: "Atletico Madrid", from: 2011, to: 2013 }, { club: "Monaco", from: 2013, to: 2014 }, { club: "Manchester United", from: 2014, to: 2015 }, { club: "Chelsea", from: 2015, to: 2016 }, { club: "Monaco", from: 2016, to: 2019 }, { club: "Galatasaray", from: 2019, to: 2021 }],
  "Thomas Lemar": [{ club: "Monaco", from: 2015, to: 2018 }, { club: "Atletico Madrid", from: 2018, to: 2024 }],
  "Wissam Ben Yedder": [{ club: "Toulouse", from: 2010, to: 2016 }, { club: "Sevilla", from: 2016, to: 2019 }, { club: "Monaco", from: 2019, to: 2024 }],
  "Aleksandr Golovin": [{ club: "Monaco", from: 2018, to: 2026 }],
  "Youri Tielemans": [{ club: "Anderlecht", from: 2013, to: 2017 }, { club: "Monaco", from: 2017, to: 2019 }, { club: "Leicester City", from: 2019, to: 2023 }, { club: "Aston Villa", from: 2023, to: 2026 }],
  // Lille / divers
  "Nicolas Pépé": [{ club: "Angers", from: 2017, to: 2017 }, { club: "Lille", from: 2017, to: 2019 }, { club: "Arsenal", from: 2019, to: 2023 }, { club: "Trabzonspor", from: 2023, to: 2024 }],
  "Jonathan David": [{ club: "Gent", from: 2018, to: 2020 }, { club: "Lille", from: 2020, to: 2025 }, { club: "Juventus FC", from: 2025, to: 2026 }],
  "Renato Sanches": [{ club: "Benfica", from: 2015, to: 2016 }, { club: "Bayern Munich", from: 2016, to: 2019 }, { club: "Lille", from: 2019, to: 2022 }, { club: "PSG", from: 2022, to: 2024 }],
  "Kurt Zouma": [{ club: "Saint-Etienne", from: 2011, to: 2014 }, { club: "Chelsea", from: 2014, to: 2021 }, { club: "West Ham", from: 2021, to: 2024 }],
  "Mario Balotelli": [{ club: "Inter Milan", from: 2007, to: 2010 }, { club: "Manchester City", from: 2010, to: 2013 }, { club: "AC Milan", from: 2013, to: 2014 }, { club: "Liverpool", from: 2014, to: 2016 }, { club: "Nice", from: 2016, to: 2019 }, { club: "Marseille", from: 2019, to: 2019 }],
  "Jean-Clair Todibo": [{ club: "Barcelona", from: 2019, to: 2020 }, { club: "Nice", from: 2021, to: 2024 }, { club: "West Ham", from: 2024, to: 2026 }],

  // ── Ajout automatique depuis Wikidata (P54 + qualificatifs de dates) ─────
  // Sourcé par scripts/spells-wikidata : QID retenu seulement s'il est humain,
  // footballeur ET né l'année que dit players.jsx — un homonyme ne passe pas.
  //
  // Trois règles ont écarté plus de joueurs qu'elles n'en ont retenu, et c'est
  // voulu :
  //   • un joueur n'entre que si TOUS ses clubs de players.jsx sont datés. Une
  //     liste partielle serait pire que rien : l'indice « mais jamais avec Y »
  //     lit ces périodes pour affirmer une ABSENCE.
  //   • deux périodes qui se chevauchent à des clubs différents = une des deux
  //     est fausse, et on ne sait pas laquelle. Wikidata porte par exemple deux
  //     passages de Schuster à l'Atlético, dont un en 1996-97 où il était à
  //     Pumas. Joueur refusé en entier.
  //   • une période à durée nulle (2023-2023, un prêt de six mois noté à
  //     l'année) reçoit sa saison : le test de coéquipiers est strict, une
  //     durée nulle ne chevaucherait jamais rien et ferait répondre « jamais
  //     ensemble » à propos d'un vrai coéquipier.
  "Alan Shearer": [{ club: "Southampton", from: 1988, to: 1992 }, { club: "Blackburn", from: 1992, to: 1996 }, { club: "Newcastle", from: 1996, to: 2006 }],
  "Alisson Becker": [{ club: "Internacional", from: 2013, to: 2016 }, { club: "AS Roma", from: 2016, to: 2018 }, { club: "Liverpool", from: 2018, to: 2026 }],
  "Andreas Brehme": [{ club: "Saarbrücken", from: 1980, to: 1981 }, { club: "Kaiserslautern", from: 1981, to: 1986 }, { club: "Bayern Munich", from: 1986, to: 1988 }, { club: "Inter Milan", from: 1988, to: 1992 }, { club: "Real Zaragoza", from: 1992, to: 1993 }, { club: "Kaiserslautern", from: 1993, to: 1998 }],
  "Bryan Robson": [{ club: "West Brom", from: 1974, to: 1981 }, { club: "Manchester United", from: 1981, to: 1994 }, { club: "Middlesbrough", from: 1994, to: 1997 }],
  "Cody Gakpo": [{ club: "PSV Eindhoven", from: 2018, to: 2023 }, { club: "Liverpool", from: 2023, to: 2026 }],
  "Dennis Bergkamp": [{ club: "Ajax Amsterdam", from: 1986, to: 1993 }, { club: "Inter Milan", from: 1993, to: 1995 }, { club: "Arsenal", from: 1995, to: 2006 }],
  "Diego Maradona": [{ club: "Argentinos Juniors", from: 1976, to: 1981 }, { club: "Boca Juniors", from: 1981, to: 1982 }, { club: "Barcelona", from: 1982, to: 1984 }, { club: "SSC Napoli", from: 1984, to: 1991 }, { club: "Sevilla", from: 1992, to: 1993 }, { club: "Newell's", from: 1993, to: 1994 }, { club: "Boca Juniors", from: 1995, to: 1997 }],
  "Désiré Doué": [{ club: "Rennes", from: 2021, to: 2024 }, { club: "PSG", from: 2024, to: 2026 }],
  "Franco Baresi": [{ club: "AC Milan", from: 1977, to: 1997 }],
  "Gheorghe Hagi": [{ club: "Sportul Studențesc", from: 1983, to: 1987 }, { club: "Steaua Bucharest", from: 1987, to: 1990 }, { club: "Real Madrid", from: 1990, to: 1992 }, { club: "Brescia", from: 1992, to: 1994 }, { club: "Barcelona", from: 1994, to: 1996 }, { club: "Galatasaray", from: 1996, to: 2001 }],
  "Lamine Yamal": [{ club: "Barcelona", from: 2023, to: 2026 }],
  "Luis Figo": [{ club: "Sporting CP", from: 1989, to: 1995 }, { club: "Barcelona", from: 1995, to: 2000 }, { club: "Real Madrid", from: 2000, to: 2005 }, { club: "Inter Milan", from: 2005, to: 2009 }],
  "Lúcio": [{ club: "Internacional", from: 1998, to: 2000 }, { club: "Bayer Leverkusen", from: 2001, to: 2004 }, { club: "Bayern Munich", from: 2004, to: 2009 }, { club: "Inter Milan", from: 2009, to: 2012 }, { club: "Juventus FC", from: 2012, to: 2013 }, { club: "São Paulo", from: 2013, to: 2014 }],
  "Marco van Basten": [{ club: "Ajax Amsterdam", from: 1981, to: 1987 }, { club: "AC Milan", from: 1987, to: 1995 }],
  "Michael Ballack": [{ club: "Bayer Leverkusen", from: 1999, to: 2002 }, { club: "Bayern Munich", from: 2002, to: 2006 }, { club: "Chelsea", from: 2006, to: 2010 }, { club: "Bayer Leverkusen", from: 2010, to: 2012 }],
  "Michel Platini": [{ club: "Nancy", from: 1972, to: 1979 }, { club: "Saint-Etienne", from: 1979, to: 1982 }, { club: "Juventus FC", from: 1982, to: 1987 }],
  "Moussa Diaby": [{ club: "PSG", from: 2018, to: 2019 }, { club: "Bayer Leverkusen", from: 2019, to: 2023 }, { club: "Aston Villa", from: 2023, to: 2024 }, { club: "Al Ittihad", from: 2024, to: 2026 }],
  "Oliver Kahn": [{ club: "Karlsruher SC", from: 1987, to: 1994 }, { club: "Bayern Munich", from: 1994, to: 2008 }],
  "Paul Breitner": [{ club: "Bayern Munich", from: 1970, to: 1974 }, { club: "Real Madrid", from: 1974, to: 1977 }, { club: "Bayern Munich", from: 1978, to: 1983 }],
  "Paul Gascoigne": [{ club: "Newcastle", from: 1985, to: 1988 }, { club: "Tottenham", from: 1988, to: 1992 }, { club: "SS Lazio", from: 1992, to: 1995 }, { club: "Rangers", from: 1995, to: 1998 }, { club: "Middlesbrough", from: 1998, to: 2000 }, { club: "Everton", from: 2000, to: 2002 }, { club: "Burnley", from: 2002, to: 2003 }],
  "Pelé": [{ club: "Santos", from: 1956, to: 1974 }, { club: "New York Cosmos", from: 1975, to: 1977 }],
  "Phil Foden": [{ club: "Manchester City", from: 2016, to: 2026 }],
  "Rivaldo": [{ club: "Deportivo La Coruna", from: 1996, to: 1997 }, { club: "Barcelona", from: 1997, to: 2002 }, { club: "AC Milan", from: 2002, to: 2003 }],
  "Roberto Baggio": [{ club: "ACF Fiorentina", from: 1985, to: 1990 }, { club: "Juventus FC", from: 1990, to: 1995 }, { club: "AC Milan", from: 1995, to: 1997 }, { club: "Bologna FC", from: 1997, to: 1998 }, { club: "Inter Milan", from: 1998, to: 2000 }],
  "Roger Milla": [{ club: "Tonnerre Yaoundé", from: 1974, to: 1977 }, { club: "Valenciennes", from: 1977, to: 1979 }, { club: "Monaco", from: 1979, to: 1980 }, { club: "Bastia", from: 1980, to: 1984 }, { club: "Saint-Etienne", from: 1984, to: 1986 }, { club: "Montpellier", from: 1986, to: 1989 }, { club: "Tonnerre Yaoundé", from: 1990, to: 1994 }],
  "Ronaldo Nazário": [{ club: "Cruzeiro", from: 1993, to: 1994 }, { club: "PSV Eindhoven", from: 1994, to: 1996 }, { club: "Barcelona", from: 1996, to: 1997 }, { club: "Inter Milan", from: 1997, to: 2002 }, { club: "Real Madrid", from: 2002, to: 2007 }, { club: "AC Milan", from: 2007, to: 2008 }, { club: "Corinthians", from: 2009, to: 2011 }],
  "Roy Keane": [{ club: "Cobh Ramblers", from: 1989, to: 1990 }, { club: "Nottingham Forest", from: 1990, to: 1993 }, { club: "Manchester United", from: 1993, to: 2005 }, { club: "Celtic", from: 2005, to: 2006 }],
  "Stefan de Vrij": [{ club: "Feyenoord", from: 2009, to: 2014 }, { club: "SS Lazio", from: 2014, to: 2018 }, { club: "Inter Milan", from: 2018, to: 2026 }, { club: "Panathinaikos", from: 2026, to: 2027 }],

  // ── Mercato d'été 2026 ──────────────────────────────────────
  // Une arrivée en 2026 se note { from: 2026, to: 2027 }, comme le passage de
  // de Vrij au Panathinaïkos juste au-dessus. Conséquence assumée : face à un
  // coéquipier dont le séjour en cours s'arrête à `to: 2026`, le chevauchement
  // STRICT est faux, donc wereTeammates répond non. C'est un faux NÉGATIF —
  // l'appelant retombe sur une formulation qui n'affirme rien. Réinterpréter les
  // 341 lignes existantes pour distinguer « encore là » de « parti en 2026 »
  // transformerait ces faux négatifs sûrs en affirmations non vérifiées, ce que
  // cette table existe précisément pour éviter.
  //
  // Digne : le PSG deux fois, avec le prêt à Rome au milieu du premier séjour —
  // pendant 2015-16 il était à Rome, pas à Paris, donc deux entrées distinctes
  // et non un seul bloc 2013-2016.
  "Lucas Digne": [{ club: "Lille", from: 2011, to: 2013 }, { club: "PSG", from: 2013, to: 2015 }, { club: "AS Roma", from: 2015, to: 2016 }, { club: "Barcelona", from: 2016, to: 2018 }, { club: "Everton", from: 2018, to: 2022 }, { club: "Aston Villa", from: 2022, to: 2026 }, { club: "PSG", from: 2026, to: 2027 }],
  // Akliouche : première apparition avec l'équipe première de Monaco en octobre
  // 2021, donc `from: 2021` — son premier contrat pro, signé en février 2022, est
  // une autre date, qui n'est pas celle de sa présence dans le vestiaire.
  "Maghnes Akliouche": [{ club: "Monaco", from: 2021, to: 2026 }, { club: "PSG", from: 2026, to: 2027 }],
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

// Chevauchement INCLUSIF (années qui se touchent comprises). À granularité
// « année », une année commune est AMBIGUË : transfert d'été (un part, l'autre
// arrive) = pas coéquipiers, MAIS transfert d'hiver = ~demi-saison ensemble
// (ex. Salah arrive à Chelsea en janv. 2014, Torres y est encore).
// → Pour affirmer « JAMAIS joué avec Y » sans risque, on exige que même ce
// chevauchement inclusif soit faux (sinon on pourrait nier un vrai duo).
export function mightHaveBeenTeammates(aName: string, bName: string): boolean {
  const a = CLUB_SPELLS[aName];
  const b = CLUB_SPELLS[bName];
  if (!a || !b) return false;
  for (const s1 of a) {
    for (const s2 of b) {
      if (s1.club === s2.club && s1.from <= s2.to && s2.from <= s1.to) return true;
    }
  }
  return false;
}

export function hasSpells(name: string): boolean {
  return !!CLUB_SPELLS[name];
}
