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

  // ── Cadres Premier League ───────────────────────────────────
  // Manchester United
  "Paul Scholes": [{ club: "Manchester United", from: 1994, to: 2013 }],
  "Gary Neville": [{ club: "Manchester United", from: 1992, to: 2011 }],
  "Edwin van der Sar": [{ club: "Ajax", from: 1990, to: 1999 }, { club: "Juventus FC", from: 1999, to: 2001 }, { club: "Fulham", from: 2001, to: 2005 }, { club: "Manchester United", from: 2005, to: 2011 }],
  "David de Gea": [{ club: "Atletico Madrid", from: 2009, to: 2011 }, { club: "Manchester United", from: 2011, to: 2023 }],
  "Juan Mata": [{ club: "Valencia", from: 2007, to: 2011 }, { club: "Chelsea", from: 2011, to: 2014 }, { club: "Manchester United", from: 2014, to: 2022 }],
  "Marcus Rashford": [{ club: "Manchester United", from: 2015, to: 2026 }],
  "Bruno Fernandes": [{ club: "Sporting CP", from: 2017, to: 2020 }, { club: "Manchester United", from: 2020, to: 2026 }],
  "Antonio Valencia": [{ club: "Wigan", from: 2006, to: 2009 }, { club: "Manchester United", from: 2009, to: 2019 }],
  "Nemanja Matic": [{ club: "Chelsea", from: 2009, to: 2011 }, { club: "Benfica", from: 2011, to: 2014 }, { club: "Chelsea", from: 2014, to: 2017 }, { club: "Manchester United", from: 2017, to: 2022 }, { club: "Roma", from: 2022, to: 2023 }],
  // Chelsea
  "John Terry": [{ club: "Chelsea", from: 1998, to: 2017 }, { club: "Aston Villa", from: 2017, to: 2018 }],
  "Branislav Ivanović": [{ club: "Chelsea", from: 2008, to: 2017 }],
  "César Azpilicueta": [{ club: "Marseille", from: 2010, to: 2012 }, { club: "Chelsea", from: 2012, to: 2023 }, { club: "Atletico Madrid", from: 2023, to: 2025 }],
  "N'Golo Kanté": [{ club: "Leicester", from: 2015, to: 2016 }, { club: "Chelsea", from: 2016, to: 2023 }, { club: "Al Ittihad", from: 2023, to: 2026 }],
  "Gary Cahill": [{ club: "Chelsea", from: 2012, to: 2019 }],
  "Diego Costa": [{ club: "Atletico Madrid", from: 2010, to: 2014 }, { club: "Chelsea", from: 2014, to: 2017 }, { club: "Atletico Madrid", from: 2018, to: 2020 }],
  "Thibaut Courtois": [{ club: "Atletico Madrid", from: 2011, to: 2014 }, { club: "Chelsea", from: 2014, to: 2018 }, { club: "Real Madrid", from: 2018, to: 2026 }],
  "Mason Mount": [{ club: "Chelsea", from: 2019, to: 2023 }, { club: "Manchester United", from: 2023, to: 2026 }],
  "Willian": [{ club: "Chelsea", from: 2013, to: 2020 }, { club: "Arsenal", from: 2020, to: 2021 }],
  // Arsenal
  "Robert Pires": [{ club: "Marseille", from: 1998, to: 2000 }, { club: "Arsenal", from: 2000, to: 2006 }, { club: "Villarreal", from: 2006, to: 2010 }],
  "Freddie Ljungberg": [{ club: "Arsenal", from: 1998, to: 2007 }],
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
  "Riyad Mahrez": [{ club: "Leicester", from: 2014, to: 2018 }, { club: "Manchester City", from: 2018, to: 2023 }, { club: "Al Ahli", from: 2023, to: 2026 }],
  "Kyle Walker": [{ club: "Tottenham", from: 2009, to: 2017 }, { club: "Manchester City", from: 2017, to: 2025 }],
  "Rúben Dias": [{ club: "Benfica", from: 2017, to: 2020 }, { club: "Manchester City", from: 2020, to: 2026 }],
  "John Stones": [{ club: "Everton", from: 2013, to: 2016 }, { club: "Manchester City", from: 2016, to: 2026 }],
  "Jack Grealish": [{ club: "Aston Villa", from: 2014, to: 2021 }, { club: "Manchester City", from: 2021, to: 2026 }],
  "Pablo Zabaleta": [{ club: "Manchester City", from: 2008, to: 2017 }, { club: "West Ham", from: 2017, to: 2020 }],
  // Tottenham
  "Harry Kane": [{ club: "Tottenham", from: 2011, to: 2023 }, { club: "Bayern Munich", from: 2023, to: 2026 }],
  "Hugo Lloris": [{ club: "Lyon", from: 2008, to: 2012 }, { club: "Tottenham", from: 2012, to: 2023 }],
  "Dele Alli": [{ club: "Tottenham", from: 2015, to: 2022 }, { club: "Everton", from: 2022, to: 2024 }],
  "Christian Eriksen": [{ club: "Ajax", from: 2010, to: 2013 }, { club: "Tottenham", from: 2013, to: 2020 }, { club: "Inter Milan", from: 2020, to: 2021 }, { club: "Manchester United", from: 2022, to: 2026 }],
  "Jan Vertonghen": [{ club: "Ajax", from: 2006, to: 2012 }, { club: "Tottenham", from: 2012, to: 2020 }],
  // Leicester / Everton
  "Jamie Vardy": [{ club: "Leicester", from: 2012, to: 2026 }],
  "Romelu Lukaku": [{ club: "Everton", from: 2014, to: 2017 }, { club: "Manchester United", from: 2017, to: 2019 }, { club: "Inter Milan", from: 2019, to: 2021 }, { club: "Chelsea", from: 2021, to: 2022 }, { club: "Inter Milan", from: 2022, to: 2023 }, { club: "Roma", from: 2023, to: 2024 }, { club: "Napoli", from: 2024, to: 2026 }],
  "Seamus Coleman": [{ club: "Everton", from: 2009, to: 2026 }],

  // ── Cadres Serie A ──────────────────────────────────────────
  // Juventus
  "Alessandro Del Piero": [{ club: "Juventus FC", from: 1993, to: 2012 }, { club: "Sydney FC", from: 2012, to: 2014 }],
  "Pavel Nedvěd": [{ club: "Lazio", from: 1996, to: 2001 }, { club: "Juventus FC", from: 2001, to: 2009 }],
  "Gianluca Zambrotta": [{ club: "Juventus FC", from: 1999, to: 2006 }, { club: "Barcelona", from: 2006, to: 2008 }, { club: "AC Milan", from: 2008, to: 2012 }],
  "Claudio Marchisio": [{ club: "Juventus FC", from: 2006, to: 2018 }, { club: "Zenit", from: 2018, to: 2019 }],
  "Arturo Vidal": [{ club: "Bayer Leverkusen", from: 2007, to: 2011 }, { club: "Juventus FC", from: 2011, to: 2015 }, { club: "Bayern Munich", from: 2015, to: 2018 }, { club: "Barcelona", from: 2018, to: 2020 }, { club: "Inter Milan", from: 2020, to: 2022 }],
  "Miralem Pjanić": [{ club: "Lyon", from: 2008, to: 2011 }, { club: "Roma", from: 2011, to: 2016 }, { club: "Juventus FC", from: 2016, to: 2020 }, { club: "Barcelona", from: 2020, to: 2022 }],
  "Blaise Matuidi": [{ club: "Saint-Étienne", from: 2007, to: 2011 }, { club: "PSG", from: 2011, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2020 }, { club: "Inter Miami", from: 2020, to: 2022 }],
  "Juan Cuadrado": [{ club: "Fiorentina", from: 2012, to: 2015 }, { club: "Chelsea", from: 2015, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2023 }, { club: "Inter Milan", from: 2023, to: 2024 }],
  "Alex Sandro": [{ club: "Porto", from: 2011, to: 2015 }, { club: "Juventus FC", from: 2015, to: 2023 }],
  "Wojciech Szczęsny": [{ club: "Arsenal", from: 2009, to: 2015 }, { club: "Roma", from: 2015, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2024 }, { club: "Barcelona", from: 2024, to: 2026 }],
  "Federico Chiesa": [{ club: "Fiorentina", from: 2016, to: 2020 }, { club: "Juventus FC", from: 2020, to: 2024 }, { club: "Liverpool", from: 2024, to: 2026 }],
  "Andrea Barzagli": [{ club: "Palermo", from: 2003, to: 2008 }, { club: "Wolfsburg", from: 2008, to: 2011 }, { club: "Juventus FC", from: 2011, to: 2019 }],
  "Carlos Tevez": [{ club: "West Ham", from: 2006, to: 2007 }, { club: "Manchester United", from: 2007, to: 2009 }, { club: "Manchester City", from: 2009, to: 2013 }, { club: "Juventus FC", from: 2013, to: 2015 }, { club: "Boca Juniors", from: 2015, to: 2016 }],
  "Douglas Costa": [{ club: "Shakhtar Donetsk", from: 2010, to: 2015 }, { club: "Bayern Munich", from: 2015, to: 2017 }, { club: "Juventus FC", from: 2017, to: 2020 }],
  // AC Milan
  "Paolo Maldini": [{ club: "AC Milan", from: 1985, to: 2009 }],
  "Alessandro Nesta": [{ club: "Lazio", from: 1993, to: 2002 }, { club: "AC Milan", from: 2002, to: 2012 }],
  "Gennaro Gattuso": [{ club: "AC Milan", from: 1999, to: 2012 }],
  "Filippo Inzaghi": [{ club: "Juventus FC", from: 1997, to: 2001 }, { club: "AC Milan", from: 2001, to: 2012 }],
  "Andriy Shevchenko": [{ club: "AC Milan", from: 1999, to: 2006 }, { club: "Chelsea", from: 2006, to: 2008 }, { club: "AC Milan", from: 2008, to: 2009 }],
  "Cafu": [{ club: "Roma", from: 1997, to: 2003 }, { club: "AC Milan", from: 2003, to: 2008 }],
  "Rui Costa": [{ club: "Fiorentina", from: 1994, to: 2001 }, { club: "AC Milan", from: 2001, to: 2006 }],
  "Alexandre Pato": [{ club: "AC Milan", from: 2007, to: 2013 }],
  "Rafael Leao": [{ club: "Lille", from: 2018, to: 2019 }, { club: "AC Milan", from: 2019, to: 2026 }],
  "Theo Hernández": [{ club: "Real Madrid", from: 2017, to: 2019 }, { club: "AC Milan", from: 2019, to: 2025 }],
  "Sandro Tonali": [{ club: "AC Milan", from: 2020, to: 2023 }, { club: "Newcastle", from: 2023, to: 2026 }],
  "Franck Kessié": [{ club: "Atalanta", from: 2015, to: 2017 }, { club: "AC Milan", from: 2017, to: 2022 }, { club: "Barcelona", from: 2022, to: 2023 }, { club: "Al Ahli", from: 2023, to: 2026 }],
  // Inter
  "Javier Zanetti": [{ club: "Inter Milan", from: 1995, to: 2014 }],
  "Marco Materazzi": [{ club: "Inter Milan", from: 2001, to: 2011 }],
  "Esteban Cambiasso": [{ club: "Real Madrid", from: 2002, to: 2004 }, { club: "Inter Milan", from: 2004, to: 2014 }, { club: "Leicester", from: 2014, to: 2015 }],
  "Walter Samuel": [{ club: "Roma", from: 2000, to: 2004 }, { club: "Real Madrid", from: 2004, to: 2005 }, { club: "Inter Milan", from: 2005, to: 2014 }],
  "Dejan Stanković": [{ club: "Lazio", from: 1998, to: 2004 }, { club: "Inter Milan", from: 2004, to: 2013 }],
  "Mauro Icardi": [{ club: "Inter Milan", from: 2013, to: 2019 }, { club: "PSG", from: 2019, to: 2022 }, { club: "Galatasaray", from: 2022, to: 2026 }],
  "Marcelo Brozovic": [{ club: "Inter Milan", from: 2015, to: 2023 }, { club: "Al Nassr", from: 2023, to: 2026 }],
  "Lautaro Martínez": [{ club: "Inter Milan", from: 2018, to: 2026 }],
  "Milan Škriniar": [{ club: "Sampdoria", from: 2016, to: 2017 }, { club: "Inter Milan", from: 2017, to: 2023 }, { club: "PSG", from: 2023, to: 2026 }],
  "Nicolò Barella": [{ club: "Cagliari", from: 2016, to: 2019 }, { club: "Inter Milan", from: 2019, to: 2026 }],
  "Hakan Çalhanoğlu": [{ club: "Bayer Leverkusen", from: 2014, to: 2017 }, { club: "AC Milan", from: 2017, to: 2021 }, { club: "Inter Milan", from: 2021, to: 2026 }],
  "Ivan Perišić": [{ club: "Wolfsburg", from: 2013, to: 2015 }, { club: "Inter Milan", from: 2015, to: 2022 }, { club: "Tottenham", from: 2022, to: 2024 }],
  // Roma
  "Francesco Totti": [{ club: "Roma", from: 1993, to: 2017 }],
  "Daniele De Rossi": [{ club: "Roma", from: 2001, to: 2019 }, { club: "Boca Juniors", from: 2019, to: 2020 }],
  "Edin Džeko": [{ club: "Wolfsburg", from: 2007, to: 2011 }, { club: "Manchester City", from: 2011, to: 2015 }, { club: "Roma", from: 2015, to: 2021 }, { club: "Inter Milan", from: 2021, to: 2023 }, { club: "Fenerbahce", from: 2023, to: 2026 }],
  "Lorenzo Pellegrini": [{ club: "Sassuolo", from: 2015, to: 2017 }, { club: "Roma", from: 2017, to: 2026 }],
  "Radja Nainggolan": [{ club: "Cagliari", from: 2010, to: 2014 }, { club: "Roma", from: 2014, to: 2018 }, { club: "Inter Milan", from: 2018, to: 2020 }, { club: "Cagliari", from: 2020, to: 2022 }],
  // Napoli
  "Marek Hamšík": [{ club: "Brescia", from: 2004, to: 2007 }, { club: "Napoli", from: 2007, to: 2019 }],
  "Lorenzo Insigne": [{ club: "Napoli", from: 2010, to: 2022 }, { club: "Toronto FC", from: 2022, to: 2025 }],
  "Kalidou Koulibaly": [{ club: "Genk", from: 2012, to: 2014 }, { club: "Napoli", from: 2014, to: 2022 }, { club: "Chelsea", from: 2022, to: 2023 }, { club: "Al Hilal", from: 2023, to: 2026 }],
  "Dries Mertens": [{ club: "PSV", from: 2011, to: 2013 }, { club: "Napoli", from: 2013, to: 2022 }, { club: "Galatasaray", from: 2022, to: 2026 }],
  "Victor Osimhen": [{ club: "Lille", from: 2019, to: 2020 }, { club: "Napoli", from: 2020, to: 2026 }],
  "Khvicha Kvaratskhelia": [{ club: "Napoli", from: 2022, to: 2025 }, { club: "PSG", from: 2025, to: 2026 }],
  "Piotr Zieliński": [{ club: "Napoli", from: 2016, to: 2024 }, { club: "Inter Milan", from: 2024, to: 2026 }],
  // Lazio / Atalanta
  "Ciro Immobile": [{ club: "Torino", from: 2013, to: 2014 }, { club: "Borussia Dortmund", from: 2014, to: 2015 }, { club: "Lazio", from: 2016, to: 2024 }, { club: "Beşiktaş", from: 2024, to: 2026 }],
  "Sergej Milinković-Savić": [{ club: "Lazio", from: 2015, to: 2023 }, { club: "Al Hilal", from: 2023, to: 2026 }],
  "Miroslav Klose": [{ club: "Werder Bremen", from: 1999, to: 2007 }, { club: "Bayern Munich", from: 2007, to: 2011 }, { club: "Lazio", from: 2011, to: 2016 }],
  "Alejandro Gómez": [{ club: "Atalanta", from: 2014, to: 2021 }, { club: "Sevilla", from: 2021, to: 2023 }],
  "Duván Zapata": [{ club: "Atalanta", from: 2018, to: 2024 }, { club: "Torino", from: 2024, to: 2026 }],
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
