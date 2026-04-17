import { useState, useEffect, useRef, useCallback } from "react";
// @ts-nocheck
import { useLeaderboard } from "@/hooks/useLeaderboard";

// ── CONSTANTS ──
const ROUND_DURATION = 90;
const CHAIN_DURATION = 90;
const COMBO_THRESHOLD = 3;

// ── PLAYER DATABASE ──
const PLAYERS = [
  // FACILE
  { name:"Cristiano Ronaldo", clubs:["Manchester United","Real Madrid","Juventus"], diff:"facile" },
  { name:"Lionel Messi", clubs:["Barcelona","PSG"], diff:"facile" },
  { name:"Neymar", clubs:["Barcelona","PSG"], diff:"facile" },
  { name:"Kylian Mbappe", clubs:["Monaco","PSG","Real Madrid"], diff:"facile" },
  { name:"Zlatan Ibrahimovic", clubs:["Juventus","Inter Milan","Barcelona","AC Milan","PSG","Manchester United"], diff:"facile" },
  { name:"Robert Lewandowski", clubs:["Borussia Dortmund","Bayern Munich","Barcelona"], diff:"facile" },
  { name:"Erling Haaland", clubs:["Borussia Dortmund","Manchester City"], diff:"facile" },
  { name:"Karim Benzema", clubs:["Lyon","Real Madrid"], diff:"facile" },
  { name:"Antoine Griezmann", clubs:["Atletico Madrid","Barcelona"], diff:"facile" },
  { name:"Paul Pogba", clubs:["Manchester United","Juventus"], diff:"facile" },
  { name:"Eden Hazard", clubs:["Lille","Chelsea","Real Madrid"], diff:"facile" },
  { name:"Mohamed Salah", clubs:["Chelsea","Roma","Liverpool"], diff:"facile" },
  { name:"Sergio Ramos", clubs:["Sevilla","Real Madrid","PSG"], diff:"facile" },
  { name:"Luka Modric", clubs:["Tottenham","Real Madrid"], diff:"facile" },
  { name:"Toni Kroos", clubs:["Bayern Munich","Real Madrid"], diff:"facile" },
  { name:"Kevin De Bruyne", clubs:["Chelsea","Manchester City"], diff:"facile" },
  { name:"Harry Kane", clubs:["Tottenham","Bayern Munich"], diff:"facile" },
  { name:"Luis Suarez", clubs:["Liverpool","Barcelona","Atletico Madrid"], diff:"facile" },
  { name:"Romelu Lukaku", clubs:["Chelsea","Everton","Manchester United","Inter Milan","Roma","Napoli"], diff:"facile" },
  { name:"Alvaro Morata", clubs:["Real Madrid","Juventus","Chelsea","Atletico Madrid","AC Milan"], diff:"facile" },
  { name:"Jude Bellingham", clubs:["Borussia Dortmund","Real Madrid"], diff:"facile" },
  { name:"Vinicius Junior", clubs:["Real Madrid"], diff:"facile" },
  { name:"Yaya Toure", clubs:["Monaco","Barcelona","Manchester City"], diff:"facile" },
  { name:"Olivier Giroud", clubs:["Montpellier","Arsenal","Chelsea","AC Milan","Los Angeles FC","Lille"], diff:"facile" },
  { name:"Raheem Sterling", clubs:["Liverpool","Manchester City","Chelsea","Arsenal"], diff:"facile" },
  { name:"Ousmane Dembele", clubs:["Borussia Dortmund","Barcelona","PSG"], diff:"facile" },
  { name:"Raphael Varane", clubs:["Lens","Real Madrid","Manchester United"], diff:"facile" },
  { name:"Thiago Silva", clubs:["AC Milan","PSG","Chelsea"], diff:"facile" },
  { name:"Edinson Cavani", clubs:["Napoli","PSG","Manchester United"], diff:"facile" },
  { name:"Angel Di Maria", clubs:["Real Madrid","Manchester United","PSG","Juventus"], diff:"facile" },
  // MOYEN
  { name:"Thiago Alcantara", clubs:["Barcelona","Bayern Munich","Liverpool"], diff:"moyen" },
  { name:"Philippe Coutinho", clubs:["Liverpool","Barcelona","Bayern Munich","Aston Villa"], diff:"moyen" },
  { name:"Casemiro", clubs:["Real Madrid","Manchester United"], diff:"moyen" },
  { name:"Fabinho", clubs:["Monaco","Liverpool"], diff:"moyen" },
  { name:"Xabi Alonso", clubs:["Liverpool","Real Madrid","Bayern Munich"], diff:"moyen" },
  { name:"Cesc Fabregas", clubs:["Arsenal","Barcelona","Chelsea","Monaco"], diff:"moyen" },
  { name:"Robin van Persie", clubs:["Arsenal","Manchester United"], diff:"moyen" },
  { name:"Alexis Sanchez", clubs:["Barcelona","Arsenal","Manchester United","Inter Milan"], diff:"moyen" },
  { name:"Gonzalo Higuain", clubs:["Real Madrid","Napoli","Juventus","AC Milan","Chelsea"], diff:"moyen" },
  { name:"Mesut Ozil", clubs:["Real Madrid","Arsenal"], diff:"moyen" },
  { name:"Bernardo Silva", clubs:["Monaco","Manchester City"], diff:"moyen" },
  { name:"Joao Felix", clubs:["Atletico Madrid","Chelsea","Barcelona"], diff:"moyen" },
  { name:"Joao Cancelo", clubs:["Juventus","Manchester City","Bayern Munich","Barcelona"], diff:"moyen" },
  { name:"Leroy Sane", clubs:["Manchester City","Bayern Munich"], diff:"moyen" },
  { name:"Kai Havertz", clubs:["Bayer Leverkusen","Chelsea","Arsenal"], diff:"moyen" },
  { name:"Jadon Sancho", clubs:["Borussia Dortmund","Manchester United","Chelsea"], diff:"moyen" },
  { name:"Kyle Walker", clubs:["Tottenham","Manchester City"], diff:"moyen" },
  { name:"Achraf Hakimi", clubs:["Real Madrid","Borussia Dortmund","Inter Milan","PSG"], diff:"moyen" },
  { name:"Kingsley Coman", clubs:["PSG","Juventus","Bayern Munich"], diff:"moyen" },
  { name:"Theo Hernandez", clubs:["Atletico Madrid","Real Madrid","AC Milan"], diff:"moyen" },
  { name:"Blaise Matuidi", clubs:["PSG","Juventus"], diff:"moyen" },
  { name:"Aurelien Tchouameni", clubs:["Monaco","Real Madrid"], diff:"moyen" },
  { name:"Riyad Mahrez", clubs:["Leicester City","Manchester City"], diff:"moyen" },
  { name:"Victor Osimhen", clubs:["Lille","Napoli"], diff:"moyen" },
  { name:"Christian Eriksen", clubs:["Tottenham","Inter Milan","Manchester United"], diff:"moyen" },
  { name:"Sadio Mane", clubs:["Southampton","Liverpool","Bayern Munich"], diff:"moyen" },
  { name:"Frenkie de Jong", clubs:["Ajax","Barcelona"], diff:"moyen" },
  { name:"Matthijs de Ligt", clubs:["Ajax","Juventus","Bayern Munich","Manchester United"], diff:"moyen" },
  { name:"Hakan Calhanoglu", clubs:["AC Milan","Inter Milan"], diff:"moyen" },
  { name:"Ivan Rakitic", clubs:["Sevilla","Barcelona"], diff:"moyen" },
  { name:"Diego Costa", clubs:["Atletico Madrid","Chelsea"], diff:"moyen" },
  { name:"James Rodriguez", clubs:["Monaco","Real Madrid","Bayern Munich","Everton"], diff:"moyen" },
  { name:"Radamel Falcao", clubs:["Atletico Madrid","Monaco","Manchester United","Chelsea"], diff:"moyen" },
  { name:"Dani Alves", clubs:["Sevilla","Barcelona","Juventus","PSG"], diff:"moyen" },
  { name:"Gerard Pique", clubs:["Manchester United","Barcelona"], diff:"moyen" },
  { name:"Samuel Etoo", clubs:["Real Madrid","Barcelona","Inter Milan","Chelsea"], diff:"moyen" },
  { name:"Franck Ribery", clubs:["Marseille","Bayern Munich"], diff:"moyen" },
  { name:"Thibaut Courtois", clubs:["Atletico Madrid","Chelsea","Real Madrid"], diff:"moyen" },
  { name:"Keylor Navas", clubs:["Real Madrid","PSG"], diff:"moyen" },
  // EXPERT
  { name:"Pierre-Emerick Aubameyang", clubs:["Borussia Dortmund","Arsenal","Barcelona","Chelsea","Marseille"], diff:"expert" },
  { name:"Timo Werner", clubs:["RB Leipzig","Chelsea","Tottenham"], diff:"expert" },
  { name:"Jack Grealish", clubs:["Aston Villa","Manchester City"], diff:"expert" },
  { name:"Declan Rice", clubs:["West Ham","Arsenal"], diff:"expert" },
  { name:"N'Golo Kante", clubs:["Leicester City","Chelsea"], diff:"expert" },
  { name:"Andrea Pirlo", clubs:["Inter Milan","AC Milan","Juventus"], diff:"expert" },
  { name:"Gianluigi Buffon", clubs:["Juventus","PSG"], diff:"expert" },
  { name:"Paulo Dybala", clubs:["Juventus","Roma"], diff:"expert" },
  { name:"Hakim Ziyech", clubs:["Ajax","Chelsea"], diff:"expert" },
  { name:"Granit Xhaka", clubs:["Arsenal","Bayer Leverkusen"], diff:"expert" },
  { name:"Christian Pulisic", clubs:["Borussia Dortmund","Chelsea","AC Milan"], diff:"expert" },
  { name:"Nicolas Pepe", clubs:["Lille","Arsenal"], diff:"expert" },
  { name:"Willian", clubs:["Chelsea","Arsenal"], diff:"expert" },
  { name:"Mats Hummels", clubs:["Borussia Dortmund","Bayern Munich"], diff:"expert" },
  { name:"Milan Skriniar", clubs:["Inter Milan","PSG"], diff:"expert" },
  { name:"Federico Chiesa", clubs:["Fiorentina","Juventus","Liverpool"], diff:"expert" },
  { name:"Jorginho", clubs:["Napoli","Chelsea","Arsenal"], diff:"expert" },
  { name:"Jules Kounde", clubs:["Sevilla","Barcelona"], diff:"expert" },
  { name:"Thomas Lemar", clubs:["Monaco","Atletico Madrid"], diff:"expert" },
  { name:"Aymeric Laporte", clubs:["Athletic Bilbao","Manchester City"], diff:"expert" },
  { name:"Jesus Navas", clubs:["Sevilla","Manchester City"], diff:"expert" },
  { name:"Mario Gotze", clubs:["Borussia Dortmund","Bayern Munich"], diff:"expert" },
  { name:"Serge Gnabry", clubs:["Arsenal","Bayern Munich"], diff:"expert" },
  { name:"Bruno Fernandes", clubs:["Sporting CP","Manchester United"], diff:"expert" },
  { name:"Diogo Jota", clubs:["Wolverhampton","Liverpool"], diff:"expert" },
  { name:"Thomas Partey", clubs:["Atletico Madrid","Arsenal"], diff:"expert" },
  { name:"Martin Odegaard", clubs:["Real Madrid","Arsenal"], diff:"expert" },
  { name:"Arturo Vidal", clubs:["Juventus","Bayern Munich","Barcelona","Inter Milan"], diff:"expert" },
  { name:"Adrien Rabiot", clubs:["PSG","Juventus","Manchester United","Marseille"], diff:"expert" },
  { name:"Mauro Icardi", clubs:["Inter Milan","PSG"], diff:"expert" },
  { name:"Bastian Schweinsteiger", clubs:["Bayern Munich","Manchester United"], diff:"expert" },
  { name:"David Luiz", clubs:["Chelsea","PSG","Arsenal"], diff:"expert" },
  { name:"Fikayo Tomori", clubs:["Chelsea","AC Milan"], diff:"expert" },
  { name:"Daniel Sturridge", clubs:["Manchester City","Chelsea","Liverpool"], diff:"expert" },
  { name:"Andy Carroll", clubs:["Newcastle","Liverpool","West Ham"], diff:"expert" },
  { name:"Gael Clichy", clubs:["Arsenal","Manchester City"], diff:"expert" },
  { name:"Alex Song", clubs:["Arsenal","Barcelona"], diff:"expert" },
  { name:"Danny Welbeck", clubs:["Manchester United","Arsenal"], diff:"expert" },
  { name:"Dimitar Berbatov", clubs:["Tottenham","Manchester United"], diff:"expert" },
  { name:"Filipe Luis", clubs:["Atletico Madrid","Chelsea"], diff:"expert" },
  { name:"Joe Cole", clubs:["West Ham","Chelsea","Liverpool"], diff:"expert" },
  { name:"Gervinho", clubs:["Lille","Arsenal","Roma"], diff:"expert" },
  { name:"Nani", clubs:["Sporting CP","Manchester United","Valencia"], diff:"expert" },
  { name:"Memphis Depay", clubs:["Manchester United","Lyon","Barcelona","Atletico Madrid"], diff:"expert" },
  { name:"Patrice Evra", clubs:["Monaco","Manchester United","Juventus","Marseille"], diff:"expert" },
  { name:"Tiemoue Bakayoko", clubs:["Monaco","Chelsea","AC Milan"], diff:"expert" },
  { name:"Sandro Tonali", clubs:["AC Milan","Newcastle"], diff:"expert" },
  { name:"Emerson Palmieri", clubs:["Roma","Chelsea","Lyon","Marseille"], diff:"expert" },
  { name:"Pedro", clubs:["Barcelona","Chelsea","Roma"], diff:"expert" },
  { name:"Ander Herrera", clubs:["Athletic Bilbao","Manchester United","PSG"], diff:"expert" },
  { name:"Georginio Wijnaldum", clubs:["Liverpool","PSG","Roma"], diff:"expert" },
  { name:"Douglas Costa", clubs:["Bayern Munich","Juventus"], diff:"expert" },
  { name:"Florian Wirtz", clubs:["Bayer Leverkusen","Liverpool"], diff:"expert" },
  { name:"Jamal Musiala", clubs:["Chelsea","Bayern Munich"], diff:"expert" },
  { name:"Marcus Rashford", clubs:["Manchester United","Aston Villa"], diff:"expert" },
  { name:"Miralem Pjanic", clubs:["Roma","Juventus","Barcelona"], diff:"expert" },
  { name:"Lucas Hernandez", clubs:["Atletico Madrid","Bayern Munich","PSG"], diff:"expert" },
  { name:"Youri Tielemans", clubs:["Monaco","Leicester City","Aston Villa"], diff:"expert" },
  { name:"Divock Origi", clubs:["Lille","Liverpool","AC Milan"], diff:"expert" },
  { name:"Gianluigi Donnarumma", clubs:["AC Milan","PSG"], diff:"expert" },
  { name:"Khvicha Kvaratskhelia", clubs:["Napoli","PSG"], diff:"expert" },
  { name:"Cole Palmer", clubs:["Manchester City","Chelsea"], diff:"expert" },
  // ── AJOUTS ──
  // Africains
  { name:"Naby Keita",            clubs:["RB Leipzig","Liverpool","Werder Bremen"], diff:"expert" },
  { name:"Wilfried Zaha",         clubs:["Crystal Palace","Manchester United"], diff:"expert" },
  { name:"Cheikhou Kouyate",      clubs:["West Ham","Crystal Palace"], diff:"expert" },
  { name:"Idrissa Gueye",         clubs:["Aston Villa","Everton","PSG","Everton"], diff:"expert" },
  { name:"Kalidou Koulibaly",     clubs:["Napoli","Chelsea","Al Hilal"], diff:"moyen" },
  // Sud-Américains
  { name:"Carlos Tevez",          clubs:["Manchester United","Manchester City","Juventus","Boca Juniors"], diff:"moyen" },
  { name:"Sergio Aguero",         clubs:["Atletico Madrid","Manchester City","Barcelona"], diff:"facile" },
  { name:"Marcelo",               clubs:["Real Madrid","Olympiacos"], diff:"moyen" },
  { name:"Lautaro Martinez",      clubs:["Racing Club","Inter Milan"], diff:"moyen" },
  { name:"Nicolas Otamendi",      clubs:["Valencia","Manchester City","Benfica"], diff:"expert" },
  { name:"Lisandro Martinez",     clubs:["Ajax","Manchester United"], diff:"expert" },
  { name:"Alexis Mac Allister",   clubs:["Brighton","Liverpool"], diff:"expert" },
  // Bundesliga / Allemands
  { name:"Thomas Muller",         clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Manuel Neuer",          clubs:["Schalke","Bayern Munich"], diff:"moyen" },
  { name:"Ilkay Gundogan",        clubs:["Borussia Dortmund","Manchester City","Barcelona","AC Milan"], diff:"moyen" },
  // Anglais
  { name:"Kieran Trippier",       clubs:["Tottenham","Atletico Madrid","Newcastle"], diff:"expert" },
  { name:"Harry Maguire",         clubs:["Leicester City","Manchester United","West Ham"], diff:"moyen" },
  { name:"Jordan Henderson",      clubs:["Sunderland","Liverpool","Al Ettifaq"], diff:"moyen" },
  // Espagnols
  { name:"David de Gea",          clubs:["Atletico Madrid","Manchester United"], diff:"moyen" },
  { name:"Juan Mata",             clubs:["Valencia","Chelsea","Manchester United"], diff:"moyen" },
  { name:"Santi Cazorla",         clubs:["Villarreal","Malaga","Arsenal"], diff:"expert" },
  { name:"Mikel Merino",          clubs:["Borussia Dortmund","Newcastle","Real Sociedad","Arsenal"], diff:"expert" },
  // Italiens
  // Portugais
  { name:"Rafael Leao",           clubs:["Lille","AC Milan"], diff:"moyen" },
  // Néerlandais
  { name:"Virgil van Dijk",       clubs:["Celtic","Southampton","Liverpool"], diff:"facile" },

  // ── JOUEURS ACTUELS 2024-2026 ──
  // Angleterre
  { name:"Phil Foden",             clubs:["Manchester City"], diff:"facile" },
  { name:"Bukayo Saka",            clubs:["Arsenal"], diff:"facile" },
  { name:"Marcus Rashford",        clubs:["Manchester United","Aston Villa","Barcelona"], diff:"moyen" },
  { name:"Jack Grealish",          clubs:["Aston Villa","Manchester City"], diff:"moyen" },
  { name:"Declan Rice",            clubs:["West Ham","Arsenal"], diff:"moyen" },
  { name:"Trent Alexander-Arnold", clubs:["Liverpool","Real Madrid"], diff:"moyen" },
  { name:"Jordan Henderson",       clubs:["Liverpool","Al Ettifaq","Ajax"], diff:"moyen" },
  { name:"Harry Maguire",          clubs:["Leicester City","Manchester United","West Ham"], diff:"expert" },
  { name:"Kieran Trippier",        clubs:["Tottenham","Atletico Madrid","Newcastle"], diff:"expert" },
  { name:"Conor Gallagher",        clubs:["Chelsea","Atletico Madrid"], diff:"expert" },
  { name:"Raheem Sterling",        clubs:["Liverpool","Manchester City","Chelsea","Arsenal"], diff:"moyen" },
  // France
  { name:"Aurelien Tchouameni",    clubs:["Monaco","Real Madrid"], diff:"moyen" },
  { name:"Eduardo Camavinga",      clubs:["Rennes","Real Madrid"], diff:"moyen" },
  { name:"William Saliba",         clubs:["Saint-Etienne","Arsenal"], diff:"moyen" },
  { name:"Jules Kounde",           clubs:["Bordeaux","Sevilla","Barcelona"], diff:"moyen" },
  { name:"Theo Hernandez",         clubs:["Atletico Madrid","Real Madrid","AC Milan"], diff:"moyen" },
  { name:"Lucas Hernandez",        clubs:["Atletico Madrid","Bayern Munich","PSG"], diff:"expert" },
  { name:"Dayot Upamecano",        clubs:["RB Leipzig","Bayern Munich"], diff:"expert" },
  { name:"Ousmane Dembele",        clubs:["Rennes","Borussia Dortmund","Barcelona","PSG"], diff:"facile" },
  { name:"Marcus Thuram",          clubs:["Borussia Monchengladbach","Inter Milan"], diff:"moyen" },
  { name:"Randal Kolo Muani",      clubs:["Nantes","Eintracht Frankfurt","PSG","Juventus"], diff:"expert" },
  { name:"Matteo Guendouzi",       clubs:["Arsenal","Marseille","Lazio"], diff:"expert" },
  { name:"Adrien Rabiot",          clubs:["PSG","Juventus","Marseille"], diff:"moyen" },
  { name:"Wissam Ben Yedder",      clubs:["Sevilla","Monaco"], diff:"expert" },
  { name:"Jonathan Clauss",        clubs:["Marseille","Nice"], diff:"expert" },
  // Espagne
  { name:"Pedri",                  clubs:["Las Palmas","Barcelona"], diff:"moyen" },
  { name:"Gavi",                   clubs:["Barcelona"], diff:"moyen" },
  { name:"Rodri",                  clubs:["Atletico Madrid","Manchester City"], diff:"moyen" },
  { name:"Martin Odegaard",        clubs:["Real Madrid","Real Sociedad","Arsenal"], diff:"moyen" },
  { name:"Ferran Torres",          clubs:["Valencia","Manchester City","Barcelona"], diff:"moyen" },
  { name:"Dani Olmo",              clubs:["Dinamo Zagreb","RB Leipzig","Barcelona"], diff:"expert" },
  { name:"Mikel Oyarzabal",        clubs:["Real Sociedad"], diff:"expert" },
  { name:"Alejandro Grimaldo",     clubs:["Benfica","Bayer Leverkusen"], diff:"expert" },
  { name:"Nico Williams",          clubs:["Athletic Bilbao"], diff:"moyen" },
  { name:"Lamine Yamal",           clubs:["Barcelona"], diff:"facile" },
  { name:"Mikel Merino",           clubs:["Borussia Dortmund","Newcastle","Real Sociedad","Arsenal"], diff:"expert" },
  // Allemagne
  { name:"Florian Wirtz",          clubs:["Bayer Leverkusen","Liverpool"], diff:"moyen" },
  { name:"Jamal Musiala",          clubs:["Chelsea","Bayern Munich"], diff:"moyen" },
  { name:"Kai Havertz",            clubs:["Bayer Leverkusen","Chelsea","Arsenal"], diff:"moyen" },
  { name:"Leroy Sane",             clubs:["Schalke","Manchester City","Bayern Munich"], diff:"moyen" },
  { name:"Thomas Muller",          clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Manuel Neuer",           clubs:["Schalke","Bayern Munich"], diff:"moyen" },
  { name:"Granit Xhaka",           clubs:["Borussia Monchengladbach","Arsenal","Bayer Leverkusen"], diff:"expert" },
  // Portugal
  { name:"Rafael Leao",            clubs:["Sporting CP","Lille","AC Milan"], diff:"moyen" },
  { name:"Bruno Fernandes",        clubs:["Sporting CP","Manchester United"], diff:"moyen" },
  { name:"Joao Felix",             clubs:["Benfica","Atletico Madrid","Chelsea","Barcelona","Al Nassr"], diff:"moyen" },
  { name:"Diogo Jota",             clubs:["Wolverhampton","Liverpool"], diff:"expert" },
  { name:"Bernardo Silva",         clubs:["Monaco","Manchester City"], diff:"moyen" },
  { name:"Joao Cancelo",           clubs:["Juventus","Manchester City","Bayern Munich","Barcelona"], diff:"moyen" },
  { name:"Vitinha",                clubs:["Wolverhampton","Porto","PSG"], diff:"expert" },
  { name:"Pedro Neto",             clubs:["Wolverhampton","Chelsea"], diff:"expert" },
  // Italie
  { name:"Federico Chiesa",        clubs:["Fiorentina","Juventus","Liverpool"], diff:"moyen" },
  { name:"Nicolo Barella",         clubs:["Cagliari","Inter Milan"], diff:"moyen" },
  { name:"Marco Verratti",         clubs:["PSG","Al Arabi"], diff:"expert" },
  { name:"Giacomo Raspadori",      clubs:["Sassuolo","Napoli"], diff:"expert" },
  { name:"Gianluca Scamacca",      clubs:["Sassuolo","West Ham","Atalanta"], diff:"expert" },
  { name:"Sandro Tonali",          clubs:["AC Milan","Newcastle"], diff:"moyen" },
  { name:"Manuel Locatelli",       clubs:["AC Milan","Sassuolo","Juventus"], diff:"expert" },
  // Brésil
  { name:"Vinicius Junior",        clubs:["Flamengo","Real Madrid"], diff:"facile" },
  { name:"Rodrygo",                clubs:["Santos","Real Madrid"], diff:"moyen" },
  { name:"Endrick",                clubs:["Palmeiras","Real Madrid"], diff:"moyen" },
  { name:"Richarlison",            clubs:["Watford","Everton","Tottenham"], diff:"moyen" },
  { name:"Gabriel Jesus",          clubs:["Palmeiras","Manchester City","Arsenal"], diff:"moyen" },
  { name:"Gabriel Martinelli",     clubs:["Ituano","Arsenal"], diff:"moyen" },
  { name:"Antony",                 clubs:["Ajax","Manchester United"], diff:"expert" },
  { name:"Gleison Bremer",         clubs:["Torino","Juventus"], diff:"expert" },
  // Argentine
  { name:"Lionel Messi",           clubs:["Barcelona","PSG","Inter Miami"], diff:"facile" },
  { name:"Lautaro Martinez",       clubs:["Racing Club","Inter Milan"], diff:"moyen" },
  { name:"Alexis Mac Allister",    clubs:["Brighton","Liverpool"], diff:"moyen" },
  { name:"Lisandro Martinez",      clubs:["Ajax","Manchester United"], diff:"expert" },
  { name:"Alejandro Garnacho",     clubs:["Manchester United"], diff:"moyen" },
  { name:"Enzo Fernandez",         clubs:["River Plate","Benfica","Chelsea"], diff:"moyen" },
  { name:"Nicolas Otamendi",       clubs:["Valencia","Manchester City","Benfica"], diff:"expert" },
  // Autres
  { name:"Erling Haaland",         clubs:["Molde","Salzburg","Borussia Dortmund","Manchester City"], diff:"facile" },
  { name:"Jude Bellingham",        clubs:["Birmingham City","Borussia Dortmund","Real Madrid"], diff:"facile" },
  { name:"Vieirinha",              clubs:["Wolfsburg","PSV"], diff:"expert" },
  { name:"Rasmus Hojlund",         clubs:["Atalanta","Manchester United"], diff:"moyen" },
  { name:"Viktor Gyokeres",        clubs:["Coventry City","Sporting CP","Arsenal"], diff:"moyen" },
  { name:"Khvicha Kvaratskhelia",  clubs:["Napoli","PSG"], diff:"moyen" },
  { name:"Lautaro Martinez",       clubs:["Racing Club","Inter Milan"], diff:"moyen" },
  { name:"Ruben Amorim",           clubs:["Sporting CP"], diff:"expert" },
  { name:"Jonathan David",         clubs:["Gent","Lille","Inter Milan"], diff:"moyen" },
  { name:"Kobbie Mainoo",          clubs:["Manchester United"], diff:"expert" },
  { name:"Cole Palmer",            clubs:["Manchester City","Chelsea"], diff:"facile" },
  { name:"Dean Huijsen",           clubs:["Juventus","Roma","Bournemouth","Real Madrid"], diff:"expert" },
  { name:"Savinho",                clubs:["Girona","Manchester City"], diff:"expert" },
  { name:"Rayan Cherki",           clubs:["Lyon","Borussia Dortmund"], diff:"expert" },
  { name:"Warren Zaire-Emery",     clubs:["PSG"], diff:"expert" },
  { name:"Desire Doue",            clubs:["Rennes","PSG"], diff:"expert" },
  { name:"Bradley Barcola",        clubs:["Lyon","PSG"], diff:"moyen" },
  { name:"Khephren Thuram",        clubs:["Nice","Juventus"], diff:"expert" },
  { name:"Sacha Boey",             clubs:["Galatasaray","Bayern Munich"], diff:"expert" },
  { name:"Manu Kone",              clubs:["Borussia Monchengladbach","Roma"], diff:"expert" },
  { name:"Youssouf Fofana",        clubs:["Monaco","AC Milan"], diff:"expert" },
  { name:"Michael Olise",          clubs:["Crystal Palace","Bayern Munich"], diff:"moyen" },
  { name:"Adam Wharton",           clubs:["Crystal Palace"], diff:"expert" },
  { name:"Jarrod Bowen",           clubs:["West Ham"], diff:"expert" },
  { name:"Ollie Watkins",          clubs:["Brentford","Aston Villa"], diff:"moyen" },
  { name:"Morgan Gibbs-White",     clubs:["Wolverhampton","Nottingham Forest"], diff:"expert" },

  // ── LÉGENDES ──
  { name:"Zinedine Zidane",      clubs:["Cannes","Bordeaux","Juventus","Real Madrid"], diff:"expert" },
  { name:"Ronaldinho",           clubs:["PSG","Barcelona","AC Milan","Flamengo"], diff:"expert" },
  { name:"Ronaldo Nazario",      clubs:["Barcelona","Inter Milan","Real Madrid","AC Milan"], diff:"expert" },
  { name:"Thierry Henry",        clubs:["Monaco","Juventus","Arsenal","Barcelona"], diff:"expert" },
  { name:"David Beckham",        clubs:["Manchester United","Real Madrid","AC Milan","PSG","LA Galaxy"], diff:"expert" },
  { name:"Wayne Rooney",         clubs:["Everton","Manchester United","DC United"], diff:"expert" },
  { name:"Gareth Bale",          clubs:["Southampton","Tottenham","Real Madrid"], diff:"expert" },
  { name:"Kaka",                 clubs:["AC Milan","Real Madrid"], diff:"expert" },
  { name:"Didier Drogba",        clubs:["Le Mans","Guingamp","Marseille","Chelsea","Galatasaray"], diff:"expert" },
  { name:"Samuel Etoo",          clubs:["Real Madrid","Mallorca","Barcelona","Inter Milan","Chelsea","Everton"], diff:"expert" },
  { name:"Frank Lampard",        clubs:["West Ham","Chelsea","Manchester City"], diff:"expert" },
  { name:"Steven Gerrard",       clubs:["Liverpool"], diff:"expert" },
  { name:"Rio Ferdinand",        clubs:["West Ham","Leeds United","Manchester United"], diff:"expert" },
  { name:"John Terry",           clubs:["Chelsea","Aston Villa"], diff:"expert" },
  { name:"Michael Owen",         clubs:["Liverpool","Real Madrid","Newcastle","Manchester United"], diff:"expert" },
  { name:"Ashley Cole",          clubs:["Arsenal","Chelsea","Roma"], diff:"expert" },
  { name:"Andres Iniesta",       clubs:["Barcelona","Vissel Kobe"], diff:"expert" },
  { name:"Iker Casillas",        clubs:["Real Madrid","Porto"], diff:"expert" },
  { name:"David Villa",          clubs:["Valencia","Barcelona","Atletico Madrid"], diff:"expert" },
  { name:"Fernando Torres",      clubs:["Atletico Madrid","Liverpool","Chelsea","AC Milan"], diff:"expert" },
  { name:"Francesco Totti",      clubs:["Roma"], diff:"expert" },
  { name:"Alessandro Del Piero", clubs:["Juventus"], diff:"expert" },
  { name:"Filippo Inzaghi",      clubs:["Juventus","AC Milan"], diff:"expert" },
  { name:"Roberto Baggio",       clubs:["Fiorentina","Juventus","AC Milan","Inter Milan","Bologna"], diff:"expert" },
  { name:"Christian Vieri",      clubs:["Lazio","Inter Milan","AC Milan"], diff:"expert" },
  { name:"Gennaro Gattuso",      clubs:["AC Milan","Tottenham"], diff:"expert" },
  { name:"Luca Toni",            clubs:["Fiorentina","Bayern Munich","Roma","Juventus"], diff:"expert" },
  { name:"Figo",                 clubs:["Sporting CP","Barcelona","Real Madrid","Inter Milan"], diff:"expert" },
  { name:"Rui Costa",            clubs:["Fiorentina","AC Milan"], diff:"expert" },
  { name:"Deco",                 clubs:["Porto","Barcelona","Chelsea"], diff:"expert" },
  { name:"Pepe",                 clubs:["Porto","Real Madrid","Besiktas"], diff:"expert" },
  { name:"Arjen Robben",         clubs:["PSV","Chelsea","Real Madrid","Bayern Munich"], diff:"expert" },
  { name:"Wesley Sneijder",      clubs:["Ajax","Real Madrid","Inter Milan","Galatasaray"], diff:"expert" },
  { name:"Ruud van Nistelrooy",  clubs:["PSV","Manchester United","Real Madrid"], diff:"expert" },
  { name:"Patrick Kluivert",     clubs:["Ajax","Barcelona","Roma","Valencia","Newcastle"], diff:"expert" },
  { name:"Marco Reus",           clubs:["Borussia Monchengladbach","Borussia Dortmund"], diff:"expert" },
  { name:"Miroslav Klose",       clubs:["Werder Bremen","Bayern Munich","Lazio"], diff:"expert" },
  { name:"Lukas Podolski",       clubs:["Bayern Munich","Arsenal","Inter Milan","Galatasaray"], diff:"expert" },
  { name:"Michael Ballack",      clubs:["Bayer Leverkusen","Bayern Munich","Chelsea"], diff:"expert" },
  { name:"Sami Khedira",         clubs:["Real Madrid","Juventus","Arsenal"], diff:"expert" },
  { name:"Diego Forlan",         clubs:["Manchester United","Atletico Madrid","Inter Milan"], diff:"expert" },
  { name:"Carlos Tevez",         clubs:["Manchester United","Manchester City","Juventus","Boca Juniors"], diff:"expert" },
  { name:"Hernan Crespo",        clubs:["Lazio","Inter Milan","Chelsea","AC Milan"], diff:"expert" },
  { name:"Juan Sebastian Veron", clubs:["Lazio","Manchester United","Inter Milan","Chelsea"], diff:"expert" },
  { name:"Clarence Seedorf",     clubs:["Ajax","Real Madrid","Inter Milan","AC Milan"], diff:"expert" },
  { name:"Patrick Vieira",       clubs:["AC Milan","Arsenal","Juventus","Inter Milan","Manchester City"], diff:"expert" },
  { name:"Emmanuel Petit",       clubs:["Monaco","Arsenal","Barcelona","Chelsea"], diff:"expert" },
  { name:"Peter Crouch",         clubs:["Aston Villa","Southampton","Liverpool","Tottenham"], diff:"expert" },
  { name:"Javier Zanetti",       clubs:["Inter Milan"], diff:"expert" },
  { name:"Gabriel Batistuta",    clubs:["Fiorentina","Roma","Inter Milan"], diff:"expert" },
  { name:"Ever Banega",          clubs:["Valencia","Sevilla","Inter Milan"], diff:"expert" },
  { name:"Fernando Llorente",    clubs:["Athletic Bilbao","Juventus","Sevilla","Tottenham"], diff:"expert" },
  { name:"Santi Cazorla",        clubs:["Villarreal","Malaga","Arsenal"], diff:"expert" },
  { name:"David de Gea",         clubs:["Atletico Madrid","Manchester United"], diff:"expert" },
  { name:"Ricardo Carvalho",     clubs:["Porto","Chelsea","Real Madrid","Monaco"], diff:"expert" },
  { name:"Dirk Kuyt",            clubs:["Liverpool","Fenerbahce"], diff:"expert" },
  { name:"Antonio Cassano",      clubs:["Roma","Real Madrid","Sampdoria","Inter Milan","AC Milan"], diff:"expert" },
  { name:"Fabio Cannavaro",      clubs:["Napoli","Parma","Inter Milan","Juventus","Real Madrid"], diff:"expert" },
  { name:"Andre Schurrle",       clubs:["Bayer Leverkusen","Chelsea","Borussia Dortmund","Wolfsburg"], diff:"expert" },

];

const CLUB_ALIASES = {
  "PSG":["paris saint germain","paris saint-germain","paris sg","paris","psg"],
  "Manchester United":["man utd","man united","manchester utd","manu","man u"],
  "Manchester City":["man city","city"],
  "Real Madrid":["real","madrid","le real"],
  "Barcelona":["barca","fc barcelona","barcelone","barça"],
  "Atletico Madrid":["atletico","atleti","atletico de madrid"],
  "AC Milan":["milan ac","milan","ac milan"],
  "Inter Milan":["inter","internazionale","inter milano"],
  "Bayern Munich":["bayern","fc bayern","les bavarois"],
  "Borussia Dortmund":["dortmund","bvb"],
  "Borussia Monchengladbach":["gladbach","monchengladbach"],
  "RB Leipzig":["leipzig","rb"],
  "Bayer Leverkusen":["leverkusen","bayer"],
  "Juventus":["juve","juventus turin","la juve"],
  "Napoli":["naples","ssc napoli","ssc naples"],
  "Roma":["as roma","as rome","rome"],
  "Lazio":["ss lazio"],
  "Fiorentina":["la viola","florence"],
  "Tottenham":["spurs","tottenham hotspur"],
  "Arsenal":["ars","gunners","les gunners"],
  "Chelsea":["the blues","les blues"],
  "Liverpool":["lfc"],
  "Newcastle":["newcastle united","nufc"],
  "Everton":["toffees"],
  "West Ham":["west ham united","whu"],
  "Aston Villa":["villa","avfc"],
  "Leicester City":["leicester"],
  "Southampton":["saints"],
  "Wolverhampton":["wolves"],
  "Brighton":["bha"],
  "Marseille":["om","olympique de marseille","l'om"],
  "Lyon":["ol","olympique lyonnais"],
  "Monaco":["as monaco","asm"],
  "Lille":["losc"],
  "Rennes":["stade rennais"],
  "Nice":["ogc nice"],
  "Saint-Etienne":["asse","st etienne","sainté"],
  "Bordeaux":["girondins","fcgb"],
  "Sevilla":["seville","fc seville","séville"],
  "Valencia":["valence"],
  "Villarreal":["sous-marin jaune"],
  "Athletic Bilbao":["bilbao","athletic club","athletic"],
  "Real Betis":["betis"],
  "Sporting CP":["sporting","sporting lisbonne","sporting lisbon"],
  "Benfica":["sl benfica","benfica lisbonne"],
  "Porto":["fc porto"],
  "Ajax":["ajax amsterdam"],
  "Celtic":["celtic glasgow"],
  "Galatasaray":["gala"],
  "Schalke":["schalke 04"],
  "Werder Bremen":["werder","bremen","breme"],
  "Wolfsburg":["vfl wolfsburg"],
  "Eintracht Frankfurt":["frankfurt","eintracht"],
};

const CLUB_COLORS = {
  "Arsenal":["#EF0107","#063672"],"Chelsea":["#034694","#DBA111"],"Liverpool":["#C8102E","#00B2A9"],
  "Manchester United":["#DA291C","#FBE122"],"Manchester City":["#6CABDD","#1C2C5B"],"Tottenham":["#132257","#FFFFFF"],
  "Newcastle":["#241F20","#FFFFFF"],"Everton":["#003399","#FFFFFF"],"West Ham":["#7A263A","#1BB1E7"],
  "Aston Villa":["#670E36","#95BFE5"],"Leicester City":["#003090","#FDBE11"],
  "Brighton":["#0057B8","#FFFFFF"],"Southampton":["#D71920","#FFFFFF"],"Wolverhampton":["#FDB913","#231F20"],
  "Real Madrid":["#FEBE10","#FFFFFF"],"Barcelona":["#A50044","#004D98"],"Atletico Madrid":["#CB3524","#FFFFFF"],
  "Sevilla":["#D71920","#FFFFFF"],"Valencia":["#F47920","#000000"],"Villarreal":["#FCD000","#004C8C"],
  "Athletic Bilbao":["#EE2523","#FFFFFF"],"Real Betis":["#00954C","#FFFFFF"],
  "Juventus":["#000000","#FFFFFF"],"AC Milan":["#FB090B","#000000"],"Inter Milan":["#0066B2","#000000"],
  "Napoli":["#12A0C3","#FFFFFF"],"Roma":["#8E1F2F","#F0BC42"],"Lazio":["#87CEEB","#FFFFFF"],
  "Fiorentina":["#4B0082","#FFFFFF"],"Atalanta":["#1D2951","#E32221"],
  "PSG":["#004170","#DA291C"],"Marseille":["#009BCE","#FFFFFF"],"Lyon":["#032CA6","#E4003A"],
  "Monaco":["#D4011D","#FFFFFF"],"Lille":["#E31B23","#1F3764"],"Bordeaux":["#1A1255","#FFFFFF"],
  "Rennes":["#D0021B","#000000"],"Nice":["#000000","#DF212A"],"Saint-Etienne":["#007744","#FFFFFF"],
  "Bayern Munich":["#DC052D","#0066B2"],"Borussia Dortmund":["#FDE100","#000000"],
  "Bayer Leverkusen":["#E32221","#000000"],"Schalke":["#004D9D","#FFFFFF"],
  "Werder Bremen":["#1D8348","#FFFFFF"],"RB Leipzig":["#DD0741","#FFFFFF"],
  "Eintracht Frankfurt":["#E1000F","#000000"],"Wolfsburg":["#65B32E","#FFFFFF"],
  "Sporting CP":["#007848","#FFFFFF"],"Benfica":["#E31B23","#FFFFFF"],"Porto":["#003F87","#FFFFFF"],
  "Ajax":["#D2122E","#FFFFFF"],"Celtic":["#138a3e","#FFFFFF"],
  "Galatasaray":["#FFA500","#D40000"],"Lens":["#EE1C25","#F5C842"],
};

// ── BUILD DATABASES ──
const PONT_CLUBS = new Set([
  "Manchester City","Arsenal","Liverpool","Chelsea","Manchester United",
  "Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia",
  "Juventus","AC Milan","Inter Milan","Napoli","Roma",
  "Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen","Eintracht Frankfurt",
  "PSG","Marseille","Lyon","Monaco","Lille",
  "Benfica","Porto","Sporting CP",
]);

function buildPontDB() {
  const pairMap = {};
  // Track how many pairs each player appears in (cap for variety)
  const playerPairCount = {};
  const MAX_PAIRS_PER_PLAYER = { facile: 4, moyen: 3, expert: 3 };

  for (const p of PLAYERS) {
    const bigClubs = p.clubs.filter(c => PONT_CLUBS.has(c));
    if (bigClubs.length < 2) continue;
    const max = MAX_PAIRS_PER_PLAYER[p.diff] || 3;

    // Generate all pairs for this player, shuffled for fairness
    const pairs = [];
    for (let i = 0; i < bigClubs.length; i++) {
      for (let j = i+1; j < bigClubs.length; j++) {
        pairs.push([bigClubs[i], bigClubs[j]]);
      }
    }
    // Shuffle pairs so we don't always pick the same ones
    for (let i = pairs.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [pairs[i],pairs[j]] = [pairs[j],pairs[i]];
    }

    let added = 0;
    for (const [a,b] of pairs) {
      if (added >= max) break;
      const key = [a,b].sort().join("|||");
      if (!pairMap[key]) {
        pairMap[key] = { players:[], diff:p.diff };
      }
      if (!pairMap[key].players.includes(p.name)) {
        pairMap[key].players.push(p.name);
        playerPairCount[p.name] = (playerPairCount[p.name]||0) + 1;
        added++;
      }
      const ord = {facile:0,moyen:1,expert:2};
      if (ord[p.diff] < ord[pairMap[key].diff]) pairMap[key].diff = p.diff;
    }
  }

  const db = {facile:[],moyen:[],expert:[]};
  for (const [key,val] of Object.entries(pairMap)) {
    const [c1,c2] = key.split("|||");
    db[val.diff].push({c1,c2,p:val.players});
  }
  // Shuffle each difficulty pool for variety across sessions
  for (const diff of ["facile","moyen","expert"]) {
    for (let i = db[diff].length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [db[diff][i],db[diff][j]] = [db[diff][j],db[diff][i]];
    }
  }
  return db;
}
const DB = buildPontDB();

const CLUB_INDEX = {};
for (const p of PLAYERS) {
  for (const c of p.clubs) {
    if (!CLUB_INDEX[c]) CLUB_INDEX[c] = [];
    if (!CLUB_INDEX[c].includes(p.name)) CLUB_INDEX[c].push(p.name);
  }
}


// ── FOOTBALL SVG ICONS ──
const Icon = {
  ball: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill="none"/>
      <polygon points="12,2 14.5,7 19.5,7 15.5,10.5 17,15.5 12,12.5 7,15.5 8.5,10.5 4.5,7 9.5,7" stroke={color} strokeWidth="1.2" fill="none"/>
    </svg>
  ),
  boot: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 17h5l2-6h4l3 4h4v2H3v-2z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 11V6a2 2 0 0 1 2-2h2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  whistle: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="12" r="4" stroke={color} strokeWidth="1.5"/>
      <path d="M13 12h7M18 9l2-2M18 15l2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 8l-2-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  trophy: (size=20, color="#fbbf24") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 21h8M12 17v4M7 3H5a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V5a2 2 0 0 0-2-2h-2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 3h10v8a5 5 0 0 1-10 0V3z" stroke={color} strokeWidth="1.5"/>
    </svg>
  ),
  stadium: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="10" rx="9" ry="5" stroke={color} strokeWidth="1.5"/>
      <path d="M3 10v4c0 2.76 4.03 5 9 5s9-2.24 9-5v-4" stroke={color} strokeWidth="1.5"/>
      <ellipse cx="12" cy="10" rx="4" ry="2" stroke={color} strokeWidth="1.2"/>
    </svg>
  ),
  transfer: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M15 8l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 8l-4 4 4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".4"/>
    </svg>
  ),
  chain: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  flag: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 21V4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 4l16 4-16 4" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={color} fillOpacity=".2"/>
    </svg>
  ),
  pitch: (size=20, color="#fff") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="1" stroke={color} strokeWidth="1.5"/>
      <line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.2"/>
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.2"/>
      <rect x="2" y="8" width="4" height="8" stroke={color} strokeWidth="1.2"/>
      <rect x="18" y="8" width="4" height="8" stroke={color} strokeWidth="1.2"/>
    </svg>
  ),
};

// Animated ball that bounces on home screen
function BouncingBall() {
  return (
    <div style={{position:"absolute",pointerEvents:"none",zIndex:0}}>
      {[
        {top:"15%",left:"8%",size:18,delay:0,dur:3.2,opacity:.12},
        {top:"60%",left:"85%",size:24,delay:.8,dur:2.8,opacity:.08},
        {top:"35%",left:"92%",size:14,delay:1.4,dur:3.6,opacity:.1},
        {top:"80%",left:"12%",size:20,delay:.3,dur:2.5,opacity:.09},
        {top:"25%",left:"50%",size:10,delay:2,dur:4,opacity:.06},
      ].map((b,i)=>(
        <div key={i} style={{position:"fixed",top:b.top,left:b.left,opacity:b.opacity,
          animation:`floatBall ${b.dur}s ease-in-out ${b.delay}s infinite alternate`}}>
          {Icon.ball(b.size,"#fff")}
        </div>
      ))}
    </div>
  );
}


// ── PLAYER AVATAR ──
function PlayerAvatar({ name, size = 56 }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  const playerEntry = PLAYERS.find(p => p.name === name);
  const mainClub = playerEntry?.clubs?.[0] || "";
  const [ca, cb] = getClubColors(mainClub);
  const tc = textColor(ca);
  const fontSize = size * 0.36;
  const borderW = size * 0.06;
  // Pre-compute IDs to avoid regex in JSX
  const cleanId = name.split("").filter(ch => /[a-zA-Z]/.test(ch)).join("").slice(0, 12);
  const gradId = "avg" + cleanId + size;
  const clipId = "clp" + cleanId + size;

  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{flexShrink:0,filter:"drop-shadow(0 3px 8px rgba(0,0,0,.25))"}}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ca}/>
          <stop offset="100%" stopColor={cb}/>
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx={size/2} cy={size/2} r={size/2 - borderW}/>
        </clipPath>
      </defs>
      <circle cx={size/2} cy={size/2} r={size/2} fill={ca} opacity={.3}/>
      <circle cx={size/2} cy={size/2} r={size/2 - borderW} fill={"url(#" + gradId + ")"}/>
      <ellipse cx={size/2} cy={size*0.32} rx={size*0.28} ry={size*0.14}
        fill="rgba(255,255,255,.2)" clipPath={"url(#" + clipId + ")"}/>
      <text x={size/2} y={size/2 + fontSize*0.36}
        textAnchor="middle" fontSize={fontSize} fontWeight="800"
        fontFamily="'Bebas Neue',cursive,sans-serif" letterSpacing="2"
        fill={tc === "#FFF" ? "#ffffff" : "#111111"}>
        {initials}
      </text>
    </svg>
  );
}

// Mini avatar (for history list)
function PlayerAvatarMini({ name, size = 28 }) {
  return <PlayerAvatar name={name} size={size}/>;
}

// ── HELPERS ──
function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function norm(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").trim();}
function checkGuess(g,players){const gn=norm(g);return players.some(p=>{const pn=norm(p);return gn===pn||pn.split(" ").some(part=>part.length>2&&gn.includes(part));});}
function matchClub(input,playerClubs){
  const n=norm(input);
  for(const c of playerClubs){if(norm(c)===n)return c;}
  for(const c of playerClubs){const aliases=CLUB_ALIASES[c];if(aliases&&aliases.some(a=>norm(a)===n))return c;}
  if(n.length>=3){
    for(const c of playerClubs){if(norm(c).includes(n)||n.includes(norm(c)))return c;}
    for(const c of playerClubs){const aliases=CLUB_ALIASES[c];if(aliases&&aliases.some(a=>norm(a).includes(n)||n.includes(norm(a))))return c;}
  }
  return null;
}
function getPlayerClubs(name){const p=PLAYERS.find(x=>x.name===name);return p?p.clubs:[];}
function getPlayersForClub(club){return CLUB_INDEX[club]||[];}

// ══ MULTIPLAYER ENGINE (BroadcastChannel + localStorage) ══
// Works between browser tabs. Replace with Supabase for cross-device.

const MAX_PLAYERS = 10;

function mpStore(key) { return `bb_mp_${key}`; }

function mpGetRoom(code) {
  try { const d = localStorage.getItem(mpStore(code)); return d ? JSON.parse(d) : null; } catch { return null; }
}

function mpSaveRoom(code, room) {
  try { localStorage.setItem(mpStore(code), JSON.stringify(room)); } catch {}
}

function mpDeleteRoom(code) {
  try { localStorage.removeItem(mpStore(code)); } catch {}
}

function createRoom(code, hostName, diff, gameMode, totalRounds) {
  const room = {
    code, hostName, diff, gameMode, totalRounds: totalRounds || 1,
    status: "lobby",
    seed: Math.floor(Math.random() * 9999999),
    createdAt: Date.now(),
    players: [{ id: code + "_0", name: hostName, score: 0, status: "waiting", isHost: true, joinedAt: Date.now() }],
  };
  mpSaveRoom(code, room);
  return room;
}

function joinRoom(code, playerName) {
  const room = mpGetRoom(code);
  if (!room) return { error: "Partie introuvable" };
  if (room.status !== "lobby") return { error: "Partie déjà commencée" };
  if (room.players.length >= MAX_PLAYERS) return { error: `Maximum ${MAX_PLAYERS} joueurs atteint` };
  if (room.players.find(p => p.name === playerName)) return { error: "Ce pseudo est déjà pris" };
  const player = { id: code + "_" + room.players.length, name: playerName, score: 0, status: "waiting", isHost: false, joinedAt: Date.now() };
  room.players.push(player);
  mpSaveRoom(code, room);
  return { room, player };
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:4}, ()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}

function getClubColors(name){return CLUB_COLORS[name]||["#1a7a3a","#FFFFFF"];}
function textColor(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return(r*299+g*587+b*114)/1000>128?"#111":"#FFF";}
function generateOptions(correctPlayers,allPairs){
  const correct=correctPlayers[Math.floor(Math.random()*correctPlayers.length)];
  const pool=[];allPairs.forEach(pair=>pair.p.forEach(p=>{if(!correctPlayers.includes(p))pool.push(p);}));
  const wrongs=[...new Set(pool.sort(()=>Math.random()-.5))].slice(0,3);
  return [correct,...wrongs].sort(()=>Math.random()-.5);
}
function getComboLabel(c){if(c>=10)return"🔥 LÉGENDAIRE";if(c>=7)return"💫 INCROYABLE";if(c>=5)return"⚡ EN FEU";if(c>=3)return"🎯 COMBO";return"";}

// ── SOUNDS ──
function playSound(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    if(type==="ok"){
      [523,659,784].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain();
        osc.connect(g);g.connect(ctx.destination);osc.frequency.value=freq;osc.type="sine";
        g.gain.setValueAtTime(0,ctx.currentTime+i*.1);g.gain.linearRampToValueAtTime(.3,ctx.currentTime+i*.1+.02);
        g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.1+.3);
        osc.start(ctx.currentTime+i*.1);osc.stop(ctx.currentTime+i*.1+.3);
      });
    }else if(type==="combo"){
      [659,784,988,1175].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain();
        osc.connect(g);g.connect(ctx.destination);osc.frequency.value=freq;osc.type="sine";
        g.gain.setValueAtTime(0,ctx.currentTime+i*.08);g.gain.linearRampToValueAtTime(.35,ctx.currentTime+i*.08+.02);
        g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.08+.25);
        osc.start(ctx.currentTime+i*.08);osc.stop(ctx.currentTime+i*.08+.25);
      });
    }else{
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);osc.frequency.setValueAtTime(220,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110,ctx.currentTime+.3);osc.type="sawtooth";
      g.gain.setValueAtTime(.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.3);
      osc.start(ctx.currentTime);osc.stop(ctx.currentTime+.3);
    }
  }catch(e){}
}

// ── CSS ──
if(typeof document!=="undefined"&&!document.getElementById("bb-css")){
  const s=document.createElement("style");s.id="bb-css";
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800&display=swap');
    @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes popIn{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
    @keyframes scoreUp{0%{transform:scale(1)}50%{transform:scale(1.5);color:#4ade80}100%{transform:scale(1)}}
    @keyframes scoreDn{0%{transform:scale(1)}50%{transform:scale(1.3);color:#ef4444}100%{transform:scale(1)}}
    @keyframes comboFire{0%{transform:scale(1) rotate(0)}25%{transform:scale(1.3) rotate(-3deg)}50%{transform:scale(1.1) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
    @keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(1.3)}}
    @keyframes confettiFall{0%{transform:translateY(-100vh) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    @keyframes clubSlideLeft{0%{opacity:0;transform:translateX(-110%) scale(.88)}65%{transform:translateX(4%) scale(1.02)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes clubSlideRight{0%{opacity:0;transform:translateX(110%) scale(.88)}65%{transform:translateX(-4%) scale(1.02)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes vsAppear{0%{opacity:0;transform:scale(0) rotate(-15deg)}65%{transform:scale(1.25) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
    @keyframes sheetUp{0%{transform:translateY(100%);opacity:0}100%{transform:translateY(0);opacity:1}}
    @keyframes answerOk{0%{transform:scale(1)}30%{transform:scale(1.06)}60%{transform:scale(.97)}100%{transform:scale(1)}}
    @keyframes answerKo{0%,100%{transform:translateX(0)}15%{transform:translateX(-12px)}30%{transform:translateX(10px)}45%{transform:translateX(-8px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}}
    @keyframes flashOk{0%{background:rgba(74,222,128,0)}40%{background:rgba(74,222,128,.18)}100%{background:rgba(74,222,128,0)}}
    @keyframes flashKo{0%{background:rgba(239,68,68,0)}40%{background:rgba(239,68,68,.15)}100%{background:rgba(239,68,68,0)}}
    @keyframes chainPop{0%{transform:scale(.8);opacity:0}100%{transform:scale(1);opacity:1}}
    @keyframes playerDrop{0%{opacity:0;transform:translateY(-80%) scale(.88)}65%{transform:translateY(5%) scale(1.03)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes clubTagPop{0%{opacity:0;transform:scale(.7) translateX(-10px)}70%{transform:scale(1.08) translateX(2px)}100%{opacity:1;transform:scale(1) translateX(0)}}
    @keyframes optionIn{0%{opacity:0;transform:translateY(16px) scale(.95)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes optionPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes floatBall{0%{transform:translateY(0) rotate(0deg)}100%{transform:translateY(-18px) rotate(20deg)}}
    @keyframes kickBall{0%{transform:scale(1) rotate(0)}40%{transform:scale(1.15) rotate(-15deg)}100%{transform:scale(1) rotate(10deg)}}
    @keyframes heartbeat{0%,100%{transform:scale(1)}15%{transform:scale(1.15)}30%{transform:scale(1)}45%{transform:scale(1.1)}60%{transform:scale(1)}}
    @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:.6}}
  `;
  document.head.appendChild(s);
}

// ── NOTIFICATIONS ──
const NOTIF_MESSAGES = [
  { title:"⚽ BridgeBall t'attend !", body:"Tu connais tous les transferts ? Prouve-le !" },
  { title:"🏆 Bats ton record !", body:"Ton record t'attend. Reviens jouer !" },
  { title:"⚽ C'est l'heure du quiz !", body:"Qui a joué dans ces deux clubs ? Viens tester !" },
  { title:"🔗 La Chaîne t'appelle !", body:"Combien de clubs peux-tu enchaîner aujourd'hui ?" },
  { title:"📊 Le classement bouge !", body:"Quelqu'un a peut-être battu ton record..." },
];

function pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function sendNotif(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "bridgeball-reminder",
      renotify: true,
    });
  } catch(e) {}
}

function checkAndScheduleNotif() {
  try {
    const last = localStorage.getItem("bb_last_visit");
    const now = Date.now();
    localStorage.setItem("bb_last_visit", String(now));

    if (last) {
      const elapsed = now - parseInt(last);
      const h24 = 24 * 60 * 60 * 1000;
      // If 24h+ since last visit, note it (notif already sent by timer or we show banner)
      if (elapsed > h24) {
        return true; // Signal: user was away 24h+
      }
    }
    return false;
  } catch { return false; }
}

function scheduleNextNotif() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  // Schedule a notification in 24h if the tab stays open (PWA)
  const h24 = 24 * 60 * 60 * 1000;
  setTimeout(() => {
    const msg = pickRandom(NOTIF_MESSAGES);
    sendNotif(msg.title, msg.body);
    scheduleNextNotif(); // Reschedule for next 24h
  }, h24);
}


export default function LePont() {
  const lb = useLeaderboard();
  useEffect(() => { if(lb.entries.length > 0) setLeaderboard(lb.entries); }, [lb.entries]);
  useEffect(() => { if(lb.myRank) setMyLbRank(lb.myRank); }, [lb.myRank]);
  const [screen, setScreen] = useState("home");
  const [gameMode, setGameMode] = useState("pont");
  const [diff, setDiff] = useState("facile");
  const [totalRounds, setTotalRounds] = useState(3);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundScores, setRoundScores] = useState([]);
  const [record, setRecord] = useState(null);
  const [chainRecord, setChainRecord] = useState(null);
  const [queue, setQueue] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [guess, setGuess] = useState("");
  const [flash, setFlash] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [options, setOptions] = useState([]);
  const [animKey, setAnimKey] = useState(0);
  const [scoreAnim, setScoreAnim] = useState(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFloat, setComboFloat] = useState(null);
  const [chainPlayer, setChainPlayer] = useState("");
  const [chainUsedClubs, setChainUsedClubs] = useState(new Set());
  const [chainUsedPlayers, setChainUsedPlayers] = useState(new Set());
  const [chainCount, setChainCount] = useState(0);
  const [chainScore, setChainScore] = useState(0);
  const [chainHistory, setChainHistory] = useState([]);
  const [chainLastClub, setChainLastClub] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [myLbRank, setMyLbRank] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // ── MULTIPLAYER STATE ──
  const [mpScreen, setMpScreen] = useState(null);
  const [mpCode, setMpCode] = useState("");
  const [mpJoinInput, setMpJoinInput] = useState("");
  const [mpRoom, setMpRoom] = useState(null);
  const [mpMyId, setMpMyId] = useState(null);
  const [mpPlayers, setMpPlayers] = useState([]);
  const [mpCopied, setMpCopied] = useState(false);
  const [mpError, setMpError] = useState("");
  const [mpGameMode, setMpGameMode] = useState("pont");
  const [mpFinalScores, setMpFinalScores] = useState([]);
  const mpChannel = useRef(null);
  const mpPollRef = useRef(null);
  const [myLastPts, setMyLastPts] = useState(null);
  const [wasAway, setWasAway] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [lbMode, setLbMode] = useState("pont");
  const [lbDiff, setLbDiff] = useState("facile");
  const [playerName, setPlayerName] = useState("");
  const [showInstructions, setShowInstructions] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const seenInstructions = useRef(new Set());
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const scoreRef = useRef(0);
  const chainScoreRef = useRef(0);
  const comboRef = useRef(0);
  const lastAnswerTime = useRef(Date.now());
  const historyEndRef = useRef(null);
  const hasEndedRef = useRef(false);

  // Load persisted data
  useEffect(() => {
    // Check if user was away 24h+
    const away = checkAndScheduleNotif();
    setWasAway(away);
    // Check notification permission status
    if ("Notification" in window) {
      setNotifGranted(Notification.permission === "granted");
      // Show prompt after 3s if not yet decided
      if (Notification.permission === "default") {
        setTimeout(() => setShowNotifPrompt(true), 3000);
      }
      // If already granted, schedule recurring notif
      if (Notification.permission === "granted") {
        scheduleNextNotif();
      }
    }
  }, []);

  useEffect(() => {
    try {
      const r = localStorage.getItem("bb_record"); if(r) setRecord(JSON.parse(r));
      const cr = localStorage.getItem("bb_chain_record"); if(cr) setChainRecord(JSON.parse(cr));
      const n = localStorage.getItem("bb_name"); if(n) setPlayerName(n);
      const seen = localStorage.getItem("bb_seen"); if(seen) JSON.parse(seen).forEach(s=>seenInstructions.current.add(s));
    } catch {}
    loadLeaderboard("pont","facile");
    // Show tutorial on first visit
    try {
      if (!localStorage.getItem("bb_tutorial_done")) setShowTutorial(true);
    } catch {}
  }, []);

  useEffect(()=>{scoreRef.current=score;},[score]);
  useEffect(()=>{comboRef.current=combo;},[combo]);
  useEffect(()=>{if(historyEndRef.current)historyEndRef.current.scrollIntoView({behavior:"smooth"});},[chainHistory]);

  // Timer
  useEffect(()=>{
    if(screen!=="game"&&screen!=="chainGame"&&screen!=="mpPlaying"){hasEndedRef.current=false;return;}
    hasEndedRef.current=false;
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{setTimeLeft(t=>Math.max(t-1,0));},1000);
    return()=>clearInterval(timerRef.current);
  },[screen,currentRound]);

  useEffect(()=>{
    if((screen!=="game"&&screen!=="chainGame"&&screen!=="mpPlaying")||timeLeft>0||hasEndedRef.current)return;
    hasEndedRef.current=true;
    if(screen==="mpPlaying"){const r=mpGetRoom(mpCode);mpUpdateMyScore(scoreRef.current);setTimeout(()=>{const room=mpGetRoom(mpCode);if(room){setMpFinalScores([...room.players].sort((a,b)=>b.score-a.score));setMpScreen("mpResults");}},600);return;}
    if(screen==="game")endRound();
    else endChain();
  },[screen,timeLeft]);

  // Leaderboard (localStorage)
  function loadLeaderboard(mode, d) {
    // Load local first for speed
    try {
      const key = `bb_lb_${mode}_${d}`;
      const data = localStorage.getItem(key);
      if(data) setLeaderboard(JSON.parse(data));
    } catch {}
    // Then fetch from Supabase
    void lb.fetchLeaderboard(mode, d);
  }

  function footballPoints(sc, list) {
    const best = list.length > 0 ? list[0].score : 0;
    if(best === 0) return 10;       // premier score = victoire
    if(sc > best) return 10;        // victoire
    if(sc >= best * 0.85) return 5; // nul (dans les 15%)
    return 0;                       // défaite
  }

  function submitToLeaderboard(name, sc, mode, d) {
    const displayName = (name||"").trim() || "Anonyme";
    try {
      const key = `bb_lb_${mode}_${d}`;
      const data = localStorage.getItem(key);
      const list = data ? JSON.parse(data) : [];
      // Find if player already has an entry to accumulate pts
      const pts = footballPoints(sc, list);
      const existingIdx = list.findIndex(e => e.name === displayName);
      if(existingIdx >= 0) {
        // Update best score if better, always add football pts
        list[existingIdx].pts = (list[existingIdx].pts || 0) + pts;
        list[existingIdx].played = (list[existingIdx].played || 1) + 1;
        list[existingIdx].wins = (list[existingIdx].wins || 0) + (pts===3?1:0);
        list[existingIdx].draws = (list[existingIdx].draws || 0) + (pts===1?1:0);
        if(sc > list[existingIdx].score) {
          list[existingIdx].score = sc;
          list[existingIdx].combo = maxCombo;
          list[existingIdx].date = new Date().toLocaleDateString("fr-FR");
        }
        list[existingIdx].lastPts = pts;
      } else {
        list.push({
          name: displayName, score: sc, combo: maxCombo,
          date: new Date().toLocaleDateString("fr-FR"),
          pts, played:1, wins: pts===3?1:0, draws: pts===1?1:0, lastPts: pts,
        });
      }
      // Sort by football points, then by best score
      list.sort((a,b) => (b.pts||0)-(a.pts||0) || b.score-a.score);
      const top50 = list.slice(0,50);
      localStorage.setItem(key, JSON.stringify(top50));
      const rank = top50.findIndex(e => e.name === displayName) + 1;
      setMyLbRank(rank || null);
      setLeaderboard(top50);
      setMyLastPts(pts);
    } catch(e) { console.error(e); }
    // Submit to Supabase for global leaderboard
    void lb.submitScore({ playerName: displayName, score: sc, gameMode: mode, difficulty: d, totalRounds, maxCombo })
      .then(() => { if(lb.myRank) setMyLbRank(lb.myRank); });
  }

  function handleCorrectAnswer(base, isChain=false) {
    const now = Date.now();
    const elapsed = (now - lastAnswerTime.current) / 1000;
    lastAnswerTime.current = now;
    const speedBonus = elapsed <= COMBO_THRESHOLD ? 1 : 0;
    const newCombo = comboRef.current + 1;
    const comboBonus = newCombo>=10?3:newCombo>=5?2:newCombo>=3?1:0;
    const total = base + speedBonus + comboBonus;
    setCombo(newCombo); if(newCombo>maxCombo) setMaxCombo(newCombo);
    if(comboBonus>0||speedBonus>0){
      const parts=[];
      if(speedBonus)parts.push("⚡ SPEED");
      if(comboBonus)parts.push(`x${newCombo} COMBO +${comboBonus}`);
      setComboFloat(parts.join(" · "));
      playSound("combo");
      setTimeout(()=>setComboFloat(null),1200);
    }else{playSound("ok");}
    if(isChain){setChainScore(s=>{chainScoreRef.current=s+total;return s+total;});}
    else{setScore(s=>{scoreRef.current=s+total;return s+total;});}
    setScoreAnim("up"); setTimeout(()=>setScoreAnim(null),600);
    return total;
  }

  function handleWrongAnswer(penalty, isChain=false) {
    setCombo(0); comboRef.current=0; playSound("ko");
    if(isChain){setChainScore(s=>{chainScoreRef.current=s-penalty;return s-penalty;});}
    else{setScore(s=>{scoreRef.current=s-penalty;return s-penalty;});}
    setScoreAnim("down"); setTimeout(()=>setScoreAnim(null),600);
  }


  // ── MP HELPERS ──
  const mpBroadcast = useCallback((msg) => {
    try { mpChannel.current?.postMessage(msg); } catch {}
  }, []);

  const mpRefreshRoom = useCallback((code) => {
    const room = mpGetRoom(code || mpCode);
    if (room) {
      setMpPlayers([...room.players]);
      setMpRoom(room);
      if (room.status === "playing" && mpScreen === "mpLobby") {
        setMpScreen("mpPlaying");
        startMpGame(room);
      }
      if (room.status === "finished" && mpScreen === "mpPlaying") {
        setMpFinalScores([...room.players].sort((a,b) => b.score - a.score));
        setMpScreen("mpResults");
      }
    }
  }, [mpCode, mpScreen]);

  function startMpChannel(code) {
    try {
      if (mpChannel.current) mpChannel.current.close();
      const ch = new BroadcastChannel(`bb_room_${code}`);
      ch.onmessage = (e) => {
        if (e.data.type === "update") mpRefreshRoom(code);
        if (e.data.type === "start") { mpRefreshRoom(code); }
      };
      mpChannel.current = ch;
      // Poll every 2s as fallback
      clearInterval(mpPollRef.current);
      mpPollRef.current = setInterval(() => mpRefreshRoom(code), 2000);
    } catch {}
  }

  function startMpGame(room) {
    // Use seeded shuffle for same questions across all players
    function seededRng(seed) {
      let s = seed;
      return () => { s = (s*1664525+1013904223)&0x7fffffff; return s/0x7fffffff; };
    }
    const rng = seededRng(room.seed);
    const dbPool = [...(DB[room.diff]||DB.facile)];
    for (let i = dbPool.length-1; i > 0; i--) {
      const j = Math.floor(rng()*(i+1));
      [dbPool[i],dbPool[j]] = [dbPool[j],dbPool[i]];
    }
    setQueue(dbPool);
    setQIdx(0);
    setScore(0); scoreRef.current = 0;
    setTimeLeft(ROUND_DURATION);
    setGuess(""); setFlash(null); setFeedback(null);
    if (room.diff === "facile") setOptions(generateOptions(dbPool[0].p, DB[room.diff]||DB.facile));
    setAnimKey(0);
    setCombo(0); setMaxCombo(0); comboRef.current = 0; lastAnswerTime.current = Date.now();
  }

  function mpUpdateMyScore(finalScore) {
    const room = mpGetRoom(mpCode);
    if (!room) return;
    const p = room.players.find(p => p.id === mpMyId);
    if (p) {
      p.score = finalScore;
      p.status = "finished";
    }
    // Check if all finished
    if (room.players.every(p => p.status === "finished")) {
      room.status = "finished";
    }
    mpSaveRoom(mpCode, room);
    mpBroadcast({ type: "update" });
    mpRefreshRoom(mpCode);
  }

  useEffect(() => {
    return () => {
      mpChannel.current?.close();
      clearInterval(mpPollRef.current);
    };
  }, []);

  function endRound() {
    clearInterval(timerRef.current);
    const rs = scoreRef.current;
    setRoundScores(prev=>{
      const next=[...prev,rs];
      if(currentRound>=totalRounds){
        const total=next.reduce((a,b)=>a+b,0);
        try{
          const prev2=record;
          if(!prev2||total>prev2.score){
            const rec={score:total,date:new Date().toLocaleDateString("fr-FR"),name:playerName};
            localStorage.setItem("bb_record",JSON.stringify(rec));
            setRecord(rec); setIsNewRecord(true); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),4000);
          }
        }catch{}
        submitToLeaderboard(playerName,total,"pont",diff);
        setScreen("final");
      }else{setScreen("roundEnd");}
      return next;
    });
  }

  function endChain() {
    clearInterval(timerRef.current);
    const sc = chainScoreRef.current;
    try{
      const prev=chainRecord;
      if(!prev||sc>prev.score){
        const rec={score:sc,date:new Date().toLocaleDateString("fr-FR"),name:playerName};
        localStorage.setItem("bb_chain_record",JSON.stringify(rec));
        setChainRecord(rec); setIsNewRecord(true); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),4000);
      }else{setIsNewRecord(false);}
    }catch{}
    submitToLeaderboard(playerName,sc,"chaine",diff);
    setScreen("chainEnd");
  }

  function startRound(round) {
    const q=shuffle(DB[diff]);
    setQueue(q); setQIdx(0); setScore(0); scoreRef.current=0;
    setTimeLeft(ROUND_DURATION); setGuess(""); setFlash(null); setFeedback(null);
    if(diff==="facile") setOptions(generateOptions(q[0].p,DB[diff]));
    setCurrentRound(round); setAnimKey(0); setScreen("game");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startChain() {
    setIsNewRecord(false); setMyLastPts(null); setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    const eligible=PLAYERS.filter(p=>p.clubs.length>=2);
    const start=eligible[Math.floor(Math.random()*eligible.length)];
    const usedP=new Set([start.name]);
    setChainPlayer(start.name); setChainUsedClubs(new Set()); setChainUsedPlayers(usedP);
    setChainCount(0); setChainScore(0); chainScoreRef.current=0;
    setChainLastClub(""); setChainHistory([]); setGuess(""); setFlash(null); setFeedback(null);
    setTimeLeft(CHAIN_DURATION); setScore(0); scoreRef.current=0;
    setMyLbRank(null); setScreen("chainGame");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startCompetition() {
    setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    setRoundScores([]); setCurrentRound(1); setIsNewRecord(false); setMyLbRank(null); setMyLastPts(null);
    startRound(1);
  }

  function nextQ() {
    setQIdx(i=>{
      const next = i+1;
      // If we've gone through the whole queue, rebuild with fresh shuffle
      if (next >= queue.length) {
        const fresh = shuffle(DB[diff]);
        setQueue(fresh);
        if(diff==="facile") setOptions(generateOptions(fresh[0].p, DB[diff]));
        return 0;
      }
      if(diff==="facile") setOptions(generateOptions(queue[next].p,DB[diff]));
      return next;
    });
    setGuess(""); setFlash(null); setAnimKey(k=>k+1);
    if(diff!=="facile") setTimeout(()=>inputRef.current?.focus(),100);
  }

  function handleSubmit() {
    const g=guess.trim(); if(!g) return;
    const cur=queue[qIdx%queue.length];
    if(checkGuess(g,cur.p)){
      setFlash("ok"); setFeedback("ok"); handleCorrectAnswer(2);
      setTimeout(()=>{setFlash(null);setFeedback(null);nextQ();},900);
    }else{
      setFlash("ko"); setFeedback("ko"); handleWrongAnswer(1);
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},900);
    }
  }

  function handlePass() {
    setScore(s=>{scoreRef.current=s-.5;return s-.5;});
    nextQ();
  }

  function handleOptionClick(opt) {
    if(flash) return;
    const cur=queue[qIdx%queue.length];
    if(checkGuess(opt,cur.p)){
      setFlash("ok"); setFeedback("ok"); handleCorrectAnswer(2);
      setTimeout(()=>{setFlash(null);setFeedback(null);nextQ();},900);
    }else{
      setFlash(opt); setFeedback("ko"); handleWrongAnswer(1);
      setTimeout(()=>{setFlash(null);setFeedback(null);},900);
    }
  }

  function handleChainSubmit() {
    const g=guess.trim(); if(!g) return;
    const playerClubs=getPlayerClubs(chainPlayer);
    const available=playerClubs.filter(c=>!chainUsedClubs.has(c));
    const matched=matchClub(g,available);
    if(matched){
      const newUsed=new Set(chainUsedClubs); newUsed.add(matched); setChainUsedClubs(newUsed);
      setChainHistory(prev=>[...prev,{player:chainPlayer,club:matched}]);
      setChainCount(c=>c+1); handleCorrectAnswer(2,true);
      setFeedback("ok"); setFlash("ok");
      const clubPlayers=getPlayersForClub(matched).filter(p=>!chainUsedPlayers.has(p)&&getPlayerClubs(p).some(c=>!newUsed.has(c)));
      if(clubPlayers.length===0){setTimeout(()=>{setFeedback(null);setFlash(null);endChain();},800);return;}
      const next=clubPlayers[Math.floor(Math.random()*clubPlayers.length)];
      const newUsedP=new Set(chainUsedPlayers); newUsedP.add(next);
      setTimeout(()=>{setChainPlayer(next);setChainUsedPlayers(newUsedP);setChainLastClub(matched);setGuess("");setFeedback(null);setFlash(null);setTimeout(()=>inputRef.current?.focus(),100);},700);
    }else if(matchClub(g,playerClubs)){
      setFlash("used"); setFeedback("used"); playSound("ko");
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},1200);
    }else{
      handleWrongAnswer(1,true); setFeedback("ko"); setFlash("ko");
      setTimeout(()=>{setFlash(null);setFeedback(null);setGuess("");inputRef.current?.focus();},900);
    }
  }

  function handleChainPass() {
    setChainScore(s=>{chainScoreRef.current=s-.5;return s-.5;});
    const validClubs=(PLAYERS.find(p=>p.name===chainPlayer)?.clubs||[]).filter(c=>!chainUsedClubs.has(c));
    const chosen=validClubs.length>0?validClubs[Math.floor(Math.random()*validClubs.length)]:null;
    if(!chosen){endChain();return;}
    const newUsed=new Set(chainUsedClubs); newUsed.add(chosen);
    const clubPlayers=getPlayersForClub(chosen).filter(p=>!chainUsedPlayers.has(p)&&getPlayerClubs(p).some(c=>!newUsed.has(c)));
    if(clubPlayers.length===0){endChain();return;}
    const next=clubPlayers[Math.floor(Math.random()*clubPlayers.length)];
    const newUsedP=new Set(chainUsedPlayers); newUsedP.add(next);
    setChainUsedClubs(newUsed); setChainUsedPlayers(newUsedP);
    setChainHistory(prev=>[...prev,{player:chainPlayer,club:chosen,passed:true}]);
    setChainPlayer(next); setChainLastClub(chosen); setGuess("");
    setTimeout(()=>inputRef.current?.focus(),100);
  }

  function tryStart(mode) {
    setGameMode(mode);
    if(!seenInstructions.current.has(mode)){setShowInstructions(mode);return;}
    if(mode==="chaine")startChain();
    else{setCombo(0);setMaxCombo(0);comboRef.current=0;lastAnswerTime.current=Date.now();setRoundScores([]);setCurrentRound(1);setIsNewRecord(false);setMyLbRank(null);startRound(1);}
  }

  function dismissInstructions() {
    const mode=showInstructions;
    seenInstructions.current.add(mode);
    try{localStorage.setItem("bb_seen",JSON.stringify([...seenInstructions.current]));}catch{}
    setShowInstructions(null);
    if(mode==="chaine")startChain();
    else{setCombo(0);setMaxCombo(0);comboRef.current=0;lastAnswerTime.current=Date.now();setRoundScores([]);setCurrentRound(1);setIsNewRecord(false);setMyLbRank(null);startRound(1);}
  }

  const cur = queue[qIdx%Math.max(queue.length,1)];
  const total = roundScores.reduce((a,b)=>a+b,0);
  const duration = gameMode==="chaine"?CHAIN_DURATION:ROUND_DURATION;
  const tPct = timeLeft/duration;
  const urgent = timeLeft<=10&&timeLeft>0;

  // Design system
  const G = {
    bg:"#0d6e2e",bgLight:"#15943e",dark:"#0a0a0a",white:"#ffffff",
    offWhite:"#f7f7f2",accent:"#4ade80",gold:"#fbbf24",red:"#ef4444",
    font:"'Inter',system-ui,sans-serif",heading:"'Bebas Neue',cursive,sans-serif",
  };
  const shell = {
    minHeight:"100vh",display:"flex",flexDirection:"column",
    background:`linear-gradient(175deg,${G.bg} 0%,${G.bgLight} 40%,${G.bg} 100%)`,
    fontFamily:G.font,position:"relative",overflow:"hidden",
  };
  const stripes = {position:"absolute",inset:0,zIndex:0,pointerEvents:"none",background:"repeating-linear-gradient(90deg,transparent 0px,transparent 40px,rgba(255,255,255,.03) 40px,rgba(255,255,255,.03) 80px)"};
  const sheet = {background:G.white,borderRadius:"32px 32px 0 0",flex:1,padding:"20px 18px 28px",display:"flex",flexDirection:"column",gap:14,zIndex:1,boxShadow:"0 -8px 40px rgba(0,0,0,.12)"};

  const backBtn = (onClick) => (
    <button onClick={onClick} style={{background:"rgba(255,255,255,.15)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",borderRadius:14,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10,color:G.white,fontSize:18,fontWeight:700,flexShrink:0}}>←</button>
  );

  const timerCircle = (size=76) => {
    const r=(size/2)-5; const circ=2*Math.PI*r;
    return (
      <div style={{position:"relative",width:size,height:size,animation:urgent?"heartbeat .8s ease infinite":"none"}}>
        <svg style={{width:size,height:size,transform:"rotate(-90deg)"}} viewBox={`0 0 ${size} ${size}`}>
          <circle fill={urgent?"rgba(239,68,68,.15)":"rgba(255,255,255,.08)"} cx={size/2} cy={size/2} r={size/2}/>
          <circle fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={4} cx={size/2} cy={size/2} r={r}/>
          <circle fill="none" stroke={timeLeft<=20?"#ef4444":timeLeft<=40?"#fbbf24":G.accent} strokeWidth={urgent?6:4}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-tPct)}
            cx={size/2} cy={size/2} r={r} style={{transition:"stroke-dashoffset .9s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.heading,fontSize:size*.3,color:urgent?"#ef4444":G.white,animation:urgent?"urgentPulse 1s ease infinite":"none"}}>{timeLeft}</div>
      </div>
    );
  };

  const scoreDisplay = (sc, anim) => (
    <span style={{fontFamily:G.heading,fontSize:34,color:G.white,display:"inline-block",animation:anim==="up"?"scoreUp .5s ease":anim==="down"?"scoreDn .5s ease":"none"}}>{sc}</span>
  );

  const comboDisplay = combo>=3?(
    <div key={combo} style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:G.white,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:800,letterSpacing:1,animation:"comboFire .5s ease",zIndex:20,whiteSpace:"nowrap",boxShadow:"0 4px 15px rgba(245,158,11,.4)"}}>{getComboLabel(combo)}</div>
  ):null;

  const floatingPoints = comboFloat&&(
    <div style={{position:"fixed",top:"30%",left:"50%",transform:"translateX(-50%)",fontFamily:G.heading,fontSize:28,color:G.gold,letterSpacing:2,animation:"floatUp 1.2s ease forwards",zIndex:100,textShadow:"0 2px 10px rgba(0,0,0,.3)",pointerEvents:"none"}}>{comboFloat}</div>
  );

  const CONFETTI_COLORS=["#fbbf24","#ef4444","#4ade80","#3b82f6","#a855f7","#f97316"];
  const confettiOverlay = showConfetti&&(
    <div style={{position:"fixed",inset:0,zIndex:300,pointerEvents:"none",overflow:"hidden"}}>
      {Array.from({length:40}).map((_,i)=>{
        const left=Math.random()*100,delay=Math.random()*2,dur=2+Math.random()*2,size=6+Math.random()*8;
        return <div key={i} style={{position:"absolute",top:-20,left:`${left}%`,width:size,height:size,background:CONFETTI_COLORS[i%CONFETTI_COLORS.length],borderRadius:Math.random()>.5?"50%":2,animation:`confettiFall ${dur}s ease ${delay}s forwards`}}/>;
      })}
    </div>
  );

  const feedbackBar = (fb) => {
    if(!fb) return null;
    return (
      <div style={{borderRadius:16,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 16px",
        background:fb==="ok"?"#dcfce7":fb==="ko"?"#fee2e2":"#fef9c3",
        border:`2px solid ${fb==="ok"?G.accent:fb==="ko"?G.red:"#fbbf24"}`,
        animation:fb==="ok"?"answerOk .5s ease":fb==="ko"?"answerKo .4s ease":"popIn .3s ease",
      }}>
        {fb==="ok"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:"#16a34a"}}>{Icon.ball(18,"#16a34a")} BONNE RÉPONSE !</div><div style={{fontSize:12,fontWeight:600,color:"#16a34a",opacity:.7}}>+2 pts</div></>}
        {fb==="ko"&&<><div style={{display:"flex",alignItems:"center",gap:8,fontSize:17,fontWeight:800,color:G.red}}>{Icon.whistle(18,G.red)} MAUVAISE RÉPONSE</div><div style={{fontSize:12,fontWeight:600,color:G.red,opacity:.7}}>−1 pt</div></>}
        {fb==="used"&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:800,color:"#d97706"}}>{Icon.flag(16,"#d97706")} CLUB DÉJÀ UTILISÉ</div>}
      </div>
    );
  };

  const instructionsPopup = showInstructions&&(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",animation:"fadeIn .2s ease"}}>
      <div style={{background:G.white,borderRadius:28,padding:"32px 24px",maxWidth:360,width:"calc(100% - 40px)",animation:"popIn .3s ease",textAlign:"center"}}>
        <div style={{marginBottom:12,display:"flex",justifyContent:"center"}}>{showInstructions==="pont"?Icon.pitch(52,G.dark):Icon.transfer(52,G.dark)}</div>
        <div style={{fontFamily:G.heading,fontSize:32,color:G.dark,letterSpacing:2,marginBottom:16}}>
          {showInstructions==="pont"?"LE PONT":"LA CHAÎNE"}
        </div>
        {showInstructions==="pont"?(
          <div style={{fontSize:14,color:"#555",lineHeight:1.8,marginBottom:20}}>
            Deux clubs s'affichent. Trouve <strong>un joueur</strong> qui a joué dans les deux !<br/><br/>
            <span style={{color:"#16a34a",fontWeight:800}}>✓ +2</span> bonne réponse &nbsp;·&nbsp; <span style={{color:G.red,fontWeight:800}}>✗ −1</span> mauvaise &nbsp;·&nbsp; <span style={{color:"#aaa",fontWeight:800}}>→ −0.5</span> passer<br/><br/>
            <span style={{fontSize:12,color:"#999"}}>🔥 Réponds vite pour activer les combos !</span>
          </div>
        ):(
          <div style={{fontSize:14,color:"#555",lineHeight:1.8,marginBottom:20}}>
            Un joueur apparaît → donne un <strong>club</strong> où il a joué → un nouveau joueur de ce club → et ainsi de suite !<br/><br/>
            <strong>Un club ne peut être cité qu'une seule fois.</strong><br/>
            <span style={{fontSize:12,color:"#999"}}>Abréviations acceptées (PSG, Barça, Juve...)</span>
          </div>
        )}
        <button onClick={dismissInstructions} style={{width:"100%",padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:1}}>
          C'est parti ! →
        </button>
      </div>
    </div>
  );


  // ── NOTIFICATION PROMPT ──
  const notifPrompt = showNotifPrompt && !notifGranted && (
    <div style={{position:"fixed",bottom:20,left:16,right:16,zIndex:500,animation:"fadeUp .4s ease"}}>
      <div style={{background:G.dark,borderRadius:20,padding:"16px 18px",boxShadow:"0 8px 32px rgba(0,0,0,.4)",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:28}}>🔔</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:G.white}}>Reçois des rappels !</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>On te pinguera si t'as pas joué depuis 24h</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={async ()=>{
            const ok = await requestNotifPermission();
            setNotifGranted(ok);
            setShowNotifPrompt(false);
            if(ok) scheduleNextNotif();
          }} style={{flex:2,padding:"11px",background:"#16a34a",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>
            ✓ Oui, active !
          </button>
          <button onClick={()=>setShowNotifPrompt(false)} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:600}}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );

  // ── WELCOME BACK BANNER ──
  const welcomeBack = wasAway && (
    <div key="welcome-back" style={{position:"fixed",top:12,left:16,right:16,zIndex:400,animation:"fadeUp .5s ease .3s both"}}>
      <div style={{background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:16,padding:"12px 16px",boxShadow:"0 6px 24px rgba(245,158,11,.4)",display:"flex",alignItems:"center",gap:12}}>
        {Icon.ball(22,G.white)}
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:800,color:G.white}}>Content de te revoir ! 🙌</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:1}}>Ça fait +24h — ton record t'attend !</div>
        </div>
        <button onClick={()=>setWasAway(false)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:20,width:26,height:26,cursor:"pointer",color:G.white,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
    </div>
  );

  // ── TUTORIAL (shown over everything) ──
  if(showTutorial) return (
    <div style={{...shell}}>
      <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}}>
        <div style={{width:"100%",maxWidth:380,background:TUTORIAL_SLIDES[tutorialStep].color,borderRadius:28,padding:"36px 24px 28px",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28}}>
            {TUTORIAL_SLIDES.map((_,i)=>(
              <div key={i} style={{width:i===tutorialStep?24:8,height:8,borderRadius:4,background:i===tutorialStep?TUTORIAL_SLIDES[tutorialStep].accent:"rgba(255,255,255,.2)",transition:"all .3s"}}/>
            ))}
          </div>
          <div style={{fontSize:56,marginBottom:16}}>{TUTORIAL_SLIDES[tutorialStep].icon}</div>
          <div style={{fontFamily:G.heading,fontSize:32,color:"#fff",letterSpacing:2,marginBottom:6}}>{TUTORIAL_SLIDES[tutorialStep].title}</div>
          <div style={{fontSize:13,color:TUTORIAL_SLIDES[tutorialStep].accent,fontWeight:700,letterSpacing:1,marginBottom:16,textTransform:"uppercase"}}>{TUTORIAL_SLIDES[tutorialStep].subtitle}</div>
          <div style={{fontSize:15,color:"rgba(255,255,255,.7)",lineHeight:1.6,marginBottom:32}}>{TUTORIAL_SLIDES[tutorialStep].desc}</div>
          <div style={{display:"flex",gap:10}}>
            {tutorialStep > 0 && (
              <button onClick={()=>setTutorialStep(s=>s-1)} style={{flex:1,padding:"14px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>← Retour</button>
            )}
            {tutorialStep < TUTORIAL_SLIDES.length - 1 ? (
              <button onClick={()=>setTutorialStep(s=>s+1)} style={{flex:2,padding:"14px",background:TUTORIAL_SLIDES[tutorialStep].accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>Suivant →</button>
            ) : (
              <button onClick={()=>{setShowTutorial(false);try{localStorage.setItem("bb_tutorial_done","1");}catch{};}} style={{flex:2,padding:"14px",background:TUTORIAL_SLIDES[tutorialStep].accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>C'est parti 🚀</button>
            )}
          </div>
          {tutorialStep < TUTORIAL_SLIDES.length - 1 && (
            <button onClick={()=>{setShowTutorial(false);try{localStorage.setItem("bb_tutorial_done","1");}catch{};}} style={{marginTop:16,background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontFamily:G.font,fontSize:13}}>Passer</button>
          )}
        </div>
      </div>
    </div>
  );

  // ── LEADERBOARD SCREEN ──
  if(showLeaderboard) return (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key="lb">
      <div style={stripes}/>
      <div style={{zIndex:1,padding:"32px 20px 12px",textAlign:"center"}}>
        <div style={{fontFamily:G.heading,fontSize:"clamp(32px,8vw,52px)",color:G.white,letterSpacing:2,display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>{Icon.trophy(40,G.gold)} CLASSEMENT</div>
        <div style={{fontSize:11,letterSpacing:3,color:"rgba(255,255,255,.5)",textTransform:"uppercase",marginTop:4}}>10 pts victoire · 5 pts nul · 0 défaite</div>
      </div>
      <div style={{...sheet,flex:1,overflow:"hidden",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:8}}>
          {[["pont","⚽ Le Pont"],["chaine","🔗 La Chaîne"]].map(([m,lbl])=>(
            <button key={m} onClick={()=>{setLbMode(m);loadLeaderboard(m,lbDiff);}} style={{flex:1,padding:"10px",borderRadius:12,border:`2px solid ${lbMode===m?G.dark:"#e5e5e0"}`,background:lbMode===m?G.dark:G.offWhite,color:lbMode===m?G.white:"#666",fontFamily:G.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>{lbl}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:6}}>
          {["facile","moyen","expert"].map(d=>(
            <button key={d} onClick={()=>{setLbDiff(d);loadLeaderboard(lbMode,d);}} style={{flex:1,padding:"8px",borderRadius:10,border:`2px solid ${lbDiff===d?"#16a34a":"#e5e5e0"}`,background:lbDiff===d?"#16a34a":G.offWhite,color:lbDiff===d?G.white:"#666",fontFamily:G.font,fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{d}</button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          {leaderboard.length===0&&<div style={{textAlign:"center",color:"#bbb",padding:20,fontSize:14}}>Aucun score encore.<br/>Sois le premier ! 🏆</div>}
          {leaderboard.map((e,i)=>{
            const isMe=myLbRank!==null&&i+1===myLbRank;
            const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
            const w=e.wins||0, d2=e.draws||0, l=(e.played||1)-w-d2;
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",background:isMe?"linear-gradient(135deg,#fef3c7,#fde68a)":G.offWhite,borderRadius:14,border:isMe?"2px solid #fbbf24":i<3?"2px solid #e5e5e0":"1px solid #f0f0ea",animation:`slideIn .3s ease ${Math.min(i,15)*.03}s both`}}>
                <span style={{fontFamily:G.heading,fontSize:18,color:i<3?G.dark:"#bbb",minWidth:24,textAlign:"center"}}>{medal||i+1}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:800,color:isMe?"#92400e":G.dark,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}{isMe?" (toi)":""}</div>
                  <div style={{fontSize:10,color:"#bbb",marginTop:1}}>{w}V · {d2}N · {l}D &nbsp;|&nbsp; Best: {e.score}pts</div>
                </div>
                {e.combo>=3&&<span style={{fontSize:10,color:"#f59e0b"}}>🔥x{e.combo}</span>}
                <div style={{textAlign:"center",minWidth:36}}>
                  <div style={{fontFamily:G.heading,fontSize:22,color:i===0?"#f59e0b":i<3?G.dark:"#666"}}>{e.pts||0}</div>
                  <div style={{fontSize:9,color:"#bbb",letterSpacing:1}}>PTS</div>
                </div>
              </div>
            );
          })}
        </div>
        {myLbRank&&<div style={{padding:"10px 16px",background:"linear-gradient(135deg,#fef3c7,#fde68a)",borderRadius:14,textAlign:"center",border:"2px solid #fbbf24"}}><span style={{fontSize:14,fontWeight:700,color:"#92400e"}}>🎯 Ton classement : #{myLbRank}</span></div>}
        <button onClick={()=>setShowLeaderboard(false)} style={{width:"100%",padding:"14px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>↩ Retour</button>
      </div>
    </div>
  );


  // ── MULTIPLAYER SCREENS ──
  if (mpScreen === "mpMenu") return (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key="mp-menu">
      <div style={stripes}/>
      <div style={{zIndex:1,padding:"44px 20px 16px",textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>{Icon.stadium(44,G.white)}</div>
        <div style={{fontFamily:G.heading,fontSize:"clamp(36px,9vw,54px)",color:G.white,letterSpacing:2}}>MULTIJOUEUR</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginTop:6}}>Jusqu'à {MAX_PLAYERS} joueurs · même code</div>
      </div>
      <div style={sheet}>
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:6}}>Ton pseudo</div>
          <input value={playerName} onChange={e=>{setPlayerName(e.target.value);try{localStorage.setItem("bb_name",e.target.value);}catch{}}}
            placeholder="Entre ton pseudo..." maxLength={20}
            style={{width:"100%",background:G.offWhite,border:"2px solid #e5e5e0",borderRadius:14,padding:"12px 16px",fontFamily:G.font,fontSize:15,fontWeight:600,color:G.dark,outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:8,textAlign:"center"}}>Mode de jeu</div>
          <div style={{display:"flex",gap:8}}>
            {[["pont","⚽ Le Pont"],["chaine","🔗 La Chaîne"]].map(([m,lbl])=>(
              <button key={m} onClick={()=>setMpGameMode(m)} style={{flex:1,padding:"12px",borderRadius:14,border:`2px solid ${mpGameMode===m?G.dark:"#e5e5e0"}`,background:mpGameMode===m?G.dark:G.offWhite,color:mpGameMode===m?G.white:"#777",fontFamily:G.font,fontSize:14,fontWeight:700,cursor:"pointer"}}>{lbl}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:8,textAlign:"center"}}>Difficulté</div>
          <div style={{display:"flex",gap:8}}>
            {["facile","moyen","expert"].map(d=>(
              <button key={d} onClick={()=>setDiff(d)} style={{flex:1,padding:"10px",borderRadius:14,border:`2px solid ${diff===d?G.dark:"#e5e5e0"}`,background:diff===d?G.dark:G.offWhite,color:diff===d?G.white:"#777",fontFamily:G.font,fontSize:13,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{d}</button>
            ))}
          </div>
        </div>

        {mpGameMode==="pont" && (
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:8,textAlign:"center"}}>Manches</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              {[1,2,3].map(n=>(
                <button key={n} onClick={()=>setTotalRounds(n)} style={{width:64,height:64,borderRadius:16,border:`2px solid ${totalRounds===n?G.dark:"#e5e5e0"}`,background:totalRounds===n?G.dark:G.offWhite,color:totalRounds===n?G.white:"#888",fontFamily:G.heading,fontSize:30,cursor:"pointer",transition:"all .18s"}}>{n}</button>
              ))}
            </div>
          </div>
        )}

        <button onClick={()=>{
          if(!playerName.trim()){setMpError("Entre ton pseudo d'abord !");return;}
          const code=generateCode();
          const room=createRoom(code,playerName.trim(),diff,mpGameMode,totalRounds);
          setMpCode(code); setMpRoom(room); setMpMyId(room.players[0].id);
          setMpPlayers([...room.players]);
          startMpChannel(code);
          setMpError(""); setMpScreen("mpLobby");
        }} style={{width:"100%",padding:"18px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {Icon.ball(18,G.white)} Créer une partie
        </button>

        <div style={{textAlign:"center",fontSize:13,color:"#bbb",fontWeight:600}}>— ou —</div>

        <button onClick={()=>{setMpError("");setMpJoinInput("");setMpScreen("mpJoin");}} style={{width:"100%",padding:"18px",background:G.offWhite,color:G.dark,border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {Icon.transfer(18,G.dark)} Rejoindre avec un code
        </button>

        {mpError&&<div style={{textAlign:"center",fontSize:13,color:G.red,fontWeight:700,animation:"popIn .3s ease"}}>{mpError}</div>}
        <button onClick={()=>{setMpScreen(null);setMpError("");}} style={{background:"transparent",color:"#bbb",border:"none",cursor:"pointer",fontFamily:G.font,fontSize:14}}>↩ Retour</button>
      </div>
    </div>
  );

  if (mpScreen === "mpJoin") return (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key="mp-join">
      <div style={stripes}/>
      <div style={{zIndex:1,padding:"44px 20px 16px",textAlign:"center"}}>
        <div style={{fontFamily:G.heading,fontSize:"clamp(32px,8vw,50px)",color:G.white,letterSpacing:2}}>REJOINDRE</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,.55)",marginTop:6}}>Entre le code de ton ami</div>
      </div>
      <div style={sheet}>
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:6}}>Ton pseudo</div>
          <input value={playerName} onChange={e=>{setPlayerName(e.target.value);try{localStorage.setItem("bb_name",e.target.value);}catch{}}}
            placeholder="Entre ton pseudo..." maxLength={20}
            style={{width:"100%",background:G.offWhite,border:"2px solid #e5e5e0",borderRadius:14,padding:"12px 16px",fontFamily:G.font,fontSize:15,fontWeight:600,color:G.dark,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:6}}>Code de la partie</div>
          <input value={mpJoinInput} onChange={e=>setMpJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4))}
            placeholder="XXXX" maxLength={4}
            style={{width:"100%",background:G.offWhite,border:`2px solid ${mpJoinInput.length===4?"#16a34a":"#e5e5e0"}`,borderRadius:14,padding:"16px",fontFamily:G.heading,fontSize:52,fontWeight:800,color:G.dark,outline:"none",textAlign:"center",letterSpacing:12,boxSizing:"border-box",transition:"border .2s"}}/>
        </div>
        {mpError&&<div style={{textAlign:"center",fontSize:13,color:G.red,fontWeight:700,animation:"popIn .3s ease"}}>{mpError}</div>}
        <button onClick={()=>{
          if(!playerName.trim()){setMpError("Entre ton pseudo d'abord !");return;}
          if(mpJoinInput.length!==4){setMpError("Le code doit faire 4 caractères");return;}
          const res=joinRoom(mpJoinInput,playerName.trim());
          if(res.error){setMpError(res.error);return;}
          setMpCode(mpJoinInput); setMpRoom(res.room); setMpMyId(res.player.id);
          setMpPlayers([...res.room.players]);
          startMpChannel(mpJoinInput);
          const ch=mpChannel.current;
          if(ch) ch.postMessage({type:"update"});
          setMpError(""); setMpScreen("mpLobby");
        }} disabled={mpJoinInput.length!==4||!playerName.trim()}
          style={{width:"100%",padding:"18px",background:mpJoinInput.length===4&&playerName.trim()?G.dark:"#ccc",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,transition:"background .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {Icon.ball(18,G.white)} Rejoindre
        </button>
        <button onClick={()=>{setMpScreen("mpMenu");setMpError("");}} style={{background:"transparent",color:"#bbb",border:"none",cursor:"pointer",fontFamily:G.font,fontSize:14}}>↩ Retour</button>
      </div>
    </div>
  );

  if (mpScreen === "mpLobby") {
    const isHost = mpRoom?.players.find(p=>p.id===mpMyId)?.isHost;
    return (
      <div style={{...shell,animation:"fadeUp .4s ease"}} key="mp-lobby">
        <div style={stripes}/>
        <div style={{zIndex:1,padding:"36px 20px 14px",textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:"rgba(255,255,255,.55)"}}>Code de la partie</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(52px,14vw,80px)",color:G.gold,letterSpacing:12,marginTop:4}}>{mpCode}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.45)",marginTop:4}}>{mpPlayers.length}/{MAX_PLAYERS} joueur{mpPlayers.length>1?"s":""} · {diff} · {mpGameMode==="pont"?"Le Pont":"La Chaîne"}{mpGameMode==="pont"?` · ${mpRoom?.totalRounds||1} manche${(mpRoom?.totalRounds||1)>1?"s":""}`:" · 90 secondes"}</div>
        </div>
        <div style={{...sheet,overflow:"hidden"}}>
          {/* Copy + Share */}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{navigator.clipboard?.writeText(mpCode).catch(()=>{});setMpCopied(true);setTimeout(()=>setMpCopied(false),2000);}}
              style={{flex:1,padding:"12px",background:mpCopied?"#dcfce7":G.offWhite,color:mpCopied?"#16a34a":G.dark,border:`2px solid ${mpCopied?"#86efac":"#e5e5e0"}`,borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800,transition:"all .3s"}}>
              {mpCopied?"✓ Copié !":"📋 Copier le code"}
            </button>
            <button onClick={()=>navigator.share?.({title:"BridgeBall",text:`Rejoins ma partie ! Code : ${mpCode}`})}
              style={{flex:1,padding:"12px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>
              📤 Inviter
            </button>
          </div>

          {/* Players list */}
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",textAlign:"center"}}>Joueurs ({mpPlayers.length}/{MAX_PLAYERS})</div>
            {mpPlayers.map((p,i)=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:p.id===mpMyId?"linear-gradient(135deg,#dcfce7,#bbf7d0)":G.offWhite,borderRadius:16,border:p.id===mpMyId?"2px solid #86efac":"2px solid #e5e5e0",animation:`slideIn .3s ease ${i*.06}s both`}}>
                <PlayerAvatar name={p.name} size={40}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:G.dark}}>{p.name}{p.id===mpMyId?" (toi)":""}</div>
                  <div style={{fontSize:11,color:"#aaa"}}>{p.isHost?"👑 Hôte":"Joueur"}</div>
                </div>
                <div style={{width:10,height:10,borderRadius:"50%",background:p.status==="ready"?"#16a34a":"#e5e5e0"}}/>
              </div>
            ))}
            {mpPlayers.length < MAX_PLAYERS && (
              <div style={{padding:"12px 16px",borderRadius:16,border:"2px dashed #e5e5e0",textAlign:"center",color:"#ccc",fontSize:13}}>
                + En attente d'autres joueurs...
              </div>
            )}
          </div>

          {/* Start button (host only) */}
          {isHost && mpPlayers.length >= 1 ? (
            <button onClick={()=>{
              const room=mpGetRoom(mpCode);
              if(!room) return;
              room.status="playing";
              mpSaveRoom(mpCode,room);
              mpBroadcast({type:"start"});
              setMpScreen("mpPlaying");
              startMpGame(room);
            }} style={{width:"100%",padding:"18px",background:G.bg,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              {Icon.whistle(18,G.white)} Lancer la partie ({mpPlayers.length} joueur{mpPlayers.length>1?"s":""})
            </button>
          ) : !isHost ? (
            <div style={{textAlign:"center",padding:"16px",background:"#fffbeb",borderRadius:16,border:"1.5px solid #fbbf24"}}>
              <div style={{fontSize:13,color:"#92400e",fontWeight:700}}>⏳ En attente que l'hôte lance la partie...</div>
            </div>
          ) : null}

          <button onClick={()=>{
            mpChannel.current?.close();
            clearInterval(mpPollRef.current);
            if(mpRoom?.players[0]?.id===mpMyId) mpDeleteRoom(mpCode);
            setMpScreen(null); setMpCode(""); setMpRoom(null); setMpPlayers([]);
          }} style={{background:"transparent",color:"#bbb",border:"none",cursor:"pointer",fontFamily:G.font,fontSize:14}}>✕ Quitter la partie</button>
        </div>
      </div>
    );
  }

  if (mpScreen === "mpPlaying") {
    // Multiplayer game — same as solo but updates room score
    const cur2 = queue[qIdx%Math.max(queue.length,1)];
    const tPct2 = timeLeft/ROUND_DURATION;
    const urgent2 = timeLeft<=10&&timeLeft>0;
    if (!cur2) return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white,fontFamily:G.heading,fontSize:32}}>Chargement…</div></div>;
    const [ca1,cb1]=getClubColors(cur2.c1);
    const [ca2,cb2]=getClubColors(cur2.c2);
    const tc1=textColor(ca1); const tc2=textColor(ca2);

    // End round handler for multiplayer
    function endMpGame() {
      clearInterval(timerRef.current);
      const finalScore = scoreRef.current;
      mpUpdateMyScore(finalScore);
      // Immediately show results if room is done
      setTimeout(() => {
        const room = mpGetRoom(mpCode);
        if (room) {
          setMpFinalScores([...room.players].sort((a,b)=>b.score-a.score));
          setMpScreen("mpResults");
        }
      }, 800);
    }

    return (
      <div style={{...shell,animation:"fadeIn .2s ease"}} key={"mp-game-"+animKey}>
        <div style={stripes}/>
        {floatingPoints}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10,animation:feedback==="ok"?"flashOk .6s ease":feedback==="ko"?"flashKo .6s ease":"none"}}/>

        {/* Top bar */}
        <div style={{zIndex:3,padding:"10px 14px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,flexShrink:0}}>
          <div style={{background:"rgba(255,255,255,.13)",backdropFilter:"blur(10px)",borderRadius:16,padding:"7px 14px",display:"flex",alignItems:"center",gap:6,position:"relative"}}>
            {comboDisplay}
            <span style={{fontFamily:G.heading,fontSize:30,color:G.white,animation:scoreAnim==="up"?"scoreUp .5s ease":scoreAnim==="down"?"scoreDn .5s ease":"none"}}>{score}</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>pts</span>
          </div>
          {/* Timer */}
          <div style={{position:"relative",width:64,height:64,animation:urgent2?"heartbeat .8s ease infinite":"none"}}>
            <svg style={{width:64,height:64,transform:"rotate(-90deg)"}} viewBox="0 0 64 64">
              <circle fill={urgent2?"rgba(239,68,68,.15)":"rgba(255,255,255,.08)"} cx={32} cy={32} r={32}/>
              <circle fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={4} cx={32} cy={32} r={27}/>
              <circle fill="none" stroke={timeLeft<=20?"#ef4444":timeLeft<=40?"#fbbf24":G.accent} strokeWidth={urgent2?6:4}
                strokeLinecap="round" strokeDasharray={169} strokeDashoffset={169*(1-tPct2)}
                cx={32} cy={32} r={27} style={{transition:"stroke-dashoffset .9s linear"}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.heading,fontSize:19,color:urgent2?"#ef4444":G.white,animation:urgent2?"urgentPulse 1s ease infinite":"none"}}>{timeLeft}</div>
          </div>
          {/* Live scoreboard mini */}
          <div style={{background:"rgba(255,255,255,.13)",backdropFilter:"blur(10px)",borderRadius:16,padding:"6px 10px",display:"flex",flexDirection:"column",gap:2,maxHeight:60,overflowY:"auto"}}>
            {mpPlayers.slice(0,3).map((p,i)=>(
              <div key={p.id} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:9,color:"rgba(255,255,255,.5)"}}>{i+1}.</span>
                <span style={{fontSize:9,color:p.id===mpMyId?G.gold:"rgba(255,255,255,.7)",fontWeight:700,maxWidth:50,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                <span style={{fontSize:9,color:G.white,fontFamily:G.heading,marginLeft:"auto"}}>{p.id===mpMyId?score:p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Club cards */}
        <div key={"clubs-"+animKey} style={{flex:1,display:"flex",flexDirection:"column",gap:0,padding:"8px 0 0",zIndex:1,minHeight:0}}>
          <div style={{flex:1,margin:"0 12px 0 12px",borderRadius:24,background:`linear-gradient(145deg,${ca1} 0%,${cb1} 100%)`,boxShadow:`0 10px 34px ${ca1}55`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",animation:"clubSlideLeft .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:`2px solid ${tc1==="#FFF"?"rgba(255,255,255,.1)":"rgba(0,0,0,.06)"}`,top:-40,right:-30}}/>
            <div style={{fontSize:9,letterSpacing:5,textTransform:"uppercase",color:tc1==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",fontWeight:700,marginBottom:8}}>Club 1</div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(24px,7vw,44px)",color:tc1==="#FFF"?"#fff":"#111",lineHeight:1.05,textAlign:"center",padding:"0 18px",textShadow:tc1==="#FFF"?"0 2px 10px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{cur2.c1}</div>
          </div>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:38,zIndex:2}}>
            <div style={{fontFamily:G.heading,fontSize:18,color:G.white,letterSpacing:4,background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:30,padding:"4px 16px",border:"1px solid rgba(255,255,255,.15)",animation:"vsAppear .5s cubic-bezier(.22,1,.36,1) .3s both"}}>VS</div>
          </div>
          <div style={{flex:1,margin:"0 12px 8px 12px",borderRadius:24,background:`linear-gradient(145deg,${ca2} 0%,${cb2} 100%)`,boxShadow:`0 10px 34px ${ca2}55`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",animation:"clubSlideRight .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            <div style={{position:"absolute",width:180,height:180,borderRadius:"50%",border:`2px solid ${tc2==="#FFF"?"rgba(255,255,255,.1)":"rgba(0,0,0,.06)"}`,bottom:-28,left:-28}}/>
            <div style={{fontSize:9,letterSpacing:5,textTransform:"uppercase",color:tc2==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",fontWeight:700,marginBottom:8}}>Club 2</div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(24px,7vw,44px)",color:tc2==="#FFF"?"#fff":"#111",lineHeight:1.05,textAlign:"center",padding:"0 18px",textShadow:tc2==="#FFF"?"0 2px 10px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{cur2.c2}</div>
          </div>
        </div>

        {/* Bottom sheet */}
        <div style={{...sheet,borderRadius:"24px 24px 0 0",flexShrink:0,paddingTop:12,gap:10,animation:"sheetUp .45s cubic-bezier(.22,1,.36,1) .15s both"}}>
          {feedbackBar(feedback)}
          {diff==="facile"?(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div key={"opts-"+animKey} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {options.map((opt,oi)=>{
                  const isOk=flash==="ok"&&checkGuess(opt,cur2.p);
                  const isKo=flash===opt;
                  const pe=PLAYERS.find(p=>p.name===opt);
                  const mc=pe?.clubs?.[0]||"";
                  const [oca,ocb]=getClubColors(mc);
                  return(
                    <button key={opt} onClick={()=>handleOptionClick(opt)} disabled={!!flash}
                      style={{padding:"14px 10px",borderRadius:16,cursor:"pointer",fontFamily:G.font,fontSize:"clamp(12px,3vw,15px)",fontWeight:800,transition:"all .15s",position:"relative",overflow:"hidden",border:`2px solid ${isOk?G.accent:isKo?G.red:`${oca}44`}`,background:isOk?"#dcfce7":isKo?"#fee2e2":`linear-gradient(145deg,${oca}22,${ocb}11)`,color:isOk?"#16a34a":isKo?G.red:G.dark,animation:isOk?"answerOk .4s ease":isKo?"answerKo .4s ease":`optionIn .4s cubic-bezier(.22,1,.36,1) ${oi*.07}s both`}}>
                      {!isOk&&!isKo&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${oca},${ocb})`,borderRadius:"16px 16px 0 0"}}/>}
                      <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                        {!isOk&&!isKo&&<PlayerAvatarMini name={opt} size={28}/>}
                        {isOk&&<span>✓</span>}{isKo&&<span>✗</span>}
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handlePass} disabled={!!flash} style={{padding:"11px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:700,opacity:flash?.3:1}}>Passer → (−0.5 pt)</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                placeholder="Nom du joueur..." autoComplete="off"
                style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:`2px solid ${flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0"}`,borderRadius:16,padding:"14px 16px",fontFamily:G.font,fontSize:17,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s"}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={handleSubmit} style={{flex:2,padding:"14px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>Valider</button>
                <button onClick={handlePass} disabled={!!flash} style={{flex:1,padding:14,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,opacity:flash?.3:1}}>Passer →</button>
              </div>
            </div>
          )}
          <button onClick={endMpGame} style={{padding:"10px",background:"transparent",color:"#e5e5e0",border:"1px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:600}}>
            Terminer ma partie →
          </button>
        </div>
      </div>
    );
  }

  if (mpScreen === "mpResults") {
    const myResult = mpFinalScores.find(p=>p.id===mpMyId);
    const myRank = mpFinalScores.findIndex(p=>p.id===mpMyId)+1;
    const medals = ["🥇","🥈","🥉"];
    return (
      <div style={{...shell,animation:"fadeUp .4s ease"}} key="mp-results">
        {confettiOverlay}<div style={stripes}/>
        <div style={{zIndex:1,padding:"36px 20px 16px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:8,animation:"popIn .6s ease",display:"flex",justifyContent:"center"}}>{myRank===1?Icon.trophy(56,G.gold):Icon.ball(52,G.white)}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7vw,46px)",color:myRank===1?G.gold:G.white,letterSpacing:2,animation:"fadeUp .5s ease .1s both"}}>
            {myRank===1?"VICTOIRE !":myRank===2?"PODIUM !":"RÉSULTATS"}
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:4}}>{mpFinalScores.length} joueur{mpFinalScores.length>1?"s":"}"}</div>
        </div>
        <div style={sheet}>
          {/* Ranking */}
          <div style={{display:"flex",flexDirection:"column",gap:8,flex:1,overflowY:"auto"}}>
            {mpFinalScores.map((p,i)=>{
              const isMe = p.id===mpMyId;
              return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:isMe?"linear-gradient(135deg,#fef3c7,#fde68a)":i===0?"linear-gradient(135deg,#fff,#fff)":G.offWhite,borderRadius:16,border:isMe?"2px solid #fbbf24":i===0?"2px solid #fbbf24":"1.5px solid #e5e5e0",animation:`slideIn .4s ease ${i*.07}s both`,boxShadow:i===0?"0 4px 20px rgba(251,191,36,.3)":"none"}}>
                  <div style={{fontFamily:G.heading,fontSize:24,minWidth:36,textAlign:"center",color:i<3?G.dark:"#bbb"}}>{medals[i]||i+1}</div>
                  <PlayerAvatar name={p.name} size={38}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:isMe?"#92400e":G.dark}}>{p.name}{isMe?" (toi)":""}</div>
                    <div style={{fontSize:10,color:"#bbb"}}>{p.status==="finished"?"Terminé":"En cours..."}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.dark:isMe?"#92400e":"#666"}}>{p.score}</div>
                    <div style={{fontSize:9,color:"#bbb"}}>pts</div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={()=>{
            // Rejouer = même salon, reset scores
            const room=mpGetRoom(mpCode);
            if(room){
              room.status="lobby";
              room.seed=Math.floor(Math.random()*9999999);
              room.players.forEach(p=>{p.score=0;p.status="waiting";});
              mpSaveRoom(mpCode,room);
              mpBroadcast({type:"update"});
              setMpPlayers([...room.players]);
              setMpScreen("mpLobby");
            }
          }} style={{width:"100%",padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            {Icon.ball(16,G.white)} Rejouer
          </button>
          <button onClick={()=>{
            mpChannel.current?.close();
            clearInterval(mpPollRef.current);
            setMpScreen(null); setMpCode(""); setMpRoom(null); setMpPlayers([]); setMpFinalScores([]);
            setScreen("home");
          }} style={{width:"100%",padding:"14px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
            ↩ Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // ── HOME ──

  // ── TUTORIAL ──
  const TUTORIAL_SLIDES = [
    {
      icon: "⚽",
      title: "THE PLUG",
      subtitle: "Trouve le joueur qui relie 2 clubs",
      desc: "On te montre 2 clubs. Trouve le joueur qui a joué dans les deux !",
      color: "#1a4a2e",
      accent: "#00E676",
    },
    {
      icon: "⛓",
      title: "THE MERCATO",
      subtitle: "Enchaîne joueur → club → joueur",
      desc: "Un joueur est affiché. Tape un club où il a joué, puis un autre joueur de ce club… et ainsi de suite !",
      color: "#1a2a4a",
      accent: "#60a5fa",
    },
    {
      icon: "⚡",
      title: "DÉFI DU JOUR",
      subtitle: "Un joueur mystère chaque jour",
      desc: "Chaque jour, un nouveau joueur mystère à deviner. Reviens tous les jours pour ne pas perdre ta série !",
      color: "#3a2a00",
      accent: "#FFD600",
    },
    {
      icon: "👥",
      title: "MULTIJOUEUR",
      subtitle: "Joue avec tes potes",
      desc: "Crée une salle, partage le code, et affrontez-vous en temps réel jusqu'à 8 joueurs !",
      color: "#2a1a3a",
      accent: "#c084fc",
    },
  ];
  const tutorialSlide = TUTORIAL_SLIDES[tutorialStep];
  const tutorialModal = showTutorial ? (
    <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.92)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}}>
      <div style={{width:"100%",maxWidth:380,background:tutorialSlide.color,borderRadius:28,padding:"36px 24px 28px",border:"1px solid rgba(255,255,255,.1)",position:"relative",textAlign:"center"}}>
        {/* Step dots */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28}}>
          {TUTORIAL_SLIDES.map((_,i)=>(
            <div key={i} style={{width:i===tutorialStep?24:8,height:8,borderRadius:4,background:i===tutorialStep?tutorialSlide.accent:"rgba(255,255,255,.2)",transition:"all .3s"}}/>
          ))}
        </div>
        {/* Icon */}
        <div style={{fontSize:56,marginBottom:16}}>{tutorialSlide.icon}</div>
        {/* Title */}
        <div style={{fontFamily:G.heading,fontSize:32,color:"#fff",letterSpacing:2,marginBottom:6}}>{tutorialSlide.title}</div>
        <div style={{fontSize:13,color:tutorialSlide.accent,fontWeight:700,letterSpacing:1,marginBottom:16,textTransform:"uppercase"}}>{tutorialSlide.subtitle}</div>
        {/* Description */}
        <div style={{fontSize:15,color:"rgba(255,255,255,.7)",lineHeight:1.6,marginBottom:32}}>{tutorialSlide.desc}</div>
        {/* Buttons */}
        <div style={{display:"flex",gap:10}}>
          {tutorialStep > 0 && (
            <button onClick={()=>setTutorialStep(s=>s-1)} style={{flex:1,padding:"14px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>← Retour</button>
          )}
          {tutorialStep < TUTORIAL_SLIDES.length - 1 ? (
            <button onClick={()=>setTutorialStep(s=>s+1)} style={{flex:2,padding:"14px",background:tutorialSlide.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>Suivant →</button>
          ) : (
            <button onClick={()=>{setShowTutorial(false);try{localStorage.setItem("bb_tutorial_done","1");}catch{};}} style={{flex:2,padding:"14px",background:tutorialSlide.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>C'est parti 🚀</button>
          )}
        </div>
        {/* Skip */}
        {tutorialStep < TUTORIAL_SLIDES.length - 1 && (
          <button onClick={()=>{setShowTutorial(false);try{localStorage.setItem("bb_tutorial_done","1");}catch{};}} style={{marginTop:16,background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontFamily:G.font,fontSize:13}}>Passer</button>
        )}
      </div>
    </div>
  ) : null;

  if(screen==="home") return (
    <div style={{...shell,animation:"fadeUp .5s ease"}} key="home">
      {tutorialModal}
      <div style={stripes}/>
      <BouncingBall/>
      {confettiOverlay}
      {instructionsPopup}
      {notifPrompt}
      {welcomeBack}
      <div style={{zIndex:1,padding:"36px 20px 16px",textAlign:"center"}}>
        <div style={{fontSize:11,letterSpacing:5,textTransform:"uppercase",color:"rgba(255,255,255,.65)",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{Icon.ball(14,"rgba(255,255,255,.65)")} Jeu des transferts</div>
        <div style={{fontFamily:G.heading,fontSize:"clamp(64px,15vw,100px)",lineHeight:.88,letterSpacing:2,color:G.white,textShadow:"0 4px 30px rgba(0,0,0,.3)"}}>BRIDGE<span style={{color:G.accent}}>BALL</span></div>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.55)",marginTop:8}}>Football · Transferts · Quiz</div>
      </div>

      <div style={{...sheet}}>
        {/* Name input */}
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:6}}>Ton pseudo (classement)</div>
          <input value={playerName} onChange={e=>{setPlayerName(e.target.value);try{localStorage.setItem("bb_name",e.target.value);}catch{}}}
            placeholder="Entre ton pseudo..." maxLength={20}
            style={{width:"100%",background:G.offWhite,border:"2px solid #e5e5e0",borderRadius:14,padding:"12px 16px",fontFamily:G.font,fontSize:15,fontWeight:600,color:G.dark,outline:"none",boxSizing:"border-box"}}/>
        </div>

        {/* Difficulty */}
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:8,textAlign:"center"}}>Difficulté</div>
          <div style={{display:"flex",gap:8}}>
            {["facile","moyen","expert"].map(d=>(
              <button key={d} onClick={()=>setDiff(d)} style={{flex:1,padding:"10px 4px",borderRadius:14,border:`2px solid ${diff===d?G.dark:"#e5e5e0"}`,background:diff===d?G.dark:G.offWhite,color:diff===d?G.white:"#777",fontFamily:G.font,fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .18s",textTransform:"capitalize"}}>{d}</button>
            ))}
          </div>
        </div>

        {/* Rounds (pont only) */}
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:8,textAlign:"center"}}>Manches</div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            {[1,2,3].map(n=>(
              <button key={n} onClick={()=>setTotalRounds(n)} style={{width:64,height:64,borderRadius:16,border:`2px solid ${totalRounds===n?G.dark:"#e5e5e0"}`,background:totalRounds===n?G.dark:G.offWhite,color:totalRounds===n?G.white:"#888",fontFamily:G.heading,fontSize:30,cursor:"pointer",transition:"all .18s"}}>{n}</button>
            ))}
          </div>
        </div>

        {/* Game modes */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>tryStart("pont")} style={{flex:1,padding:"18px 10px",background:G.dark,color:G.white,border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,textAlign:"center"}}>
            <div style={{marginBottom:6,display:"flex",justifyContent:"center"}}>{Icon.pitch(32,"rgba(255,255,255,.9)")}</div>
            <div style={{fontFamily:G.heading,fontSize:20,letterSpacing:2}}>LE PONT</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>2 clubs → joueur</div>
          </button>
          <button onClick={()=>tryStart("chaine")} style={{flex:1,padding:"18px 10px",background:"linear-gradient(135deg,#1a4e2e,#0d6e2e)",color:G.white,border:"2px solid rgba(255,255,255,.15)",borderRadius:20,cursor:"pointer",fontFamily:G.font,textAlign:"center"}}>
            <div style={{marginBottom:6,display:"flex",justifyContent:"center"}}>{Icon.transfer(32,"rgba(255,255,255,.9)")}</div>
            <div style={{fontFamily:G.heading,fontSize:20,letterSpacing:2}}>LA CHAÎNE</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>joueur → club → ...</div>
          </button>
        </div>

        {/* Records */}
        <div style={{display:"flex",gap:8}}>
          {record&&<div style={{flex:1,background:"linear-gradient(135deg,#fef3c7,#fde68a)",borderRadius:14,padding:"10px 14px",textAlign:"center",border:"1.5px solid #fbbf24"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#92400e",marginBottom:2,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{Icon.trophy(14,"#92400e")} Record Pont</div>
            <div style={{fontFamily:G.heading,fontSize:26,color:"#92400e"}}>{record.score}</div>
          </div>}
          {chainRecord&&<div style={{flex:1,background:"linear-gradient(135deg,#e0f2fe,#bae6fd)",borderRadius:14,padding:"10px 14px",textAlign:"center",border:"1.5px solid #7dd3fc"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#075985",marginBottom:2,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{Icon.transfer(14,"#075985")} Record Chaîne</div>
            <div style={{fontFamily:G.heading,fontSize:26,color:"#075985"}}>{chainRecord.score}</div>
          </div>}
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setLbMode("pont");setLbDiff(diff);loadLeaderboard("pont",diff);setShowLeaderboard(true);}}
            style={{flex:1,padding:"12px",background:"#f0f9f4",color:"#16a34a",border:"2px solid #86efac",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {Icon.trophy(15,"#16a34a")} Classement
          </button>
          <button onClick={()=>{setMpError("");setMpJoinInput("");setMpScreen("mpMenu");}}
            style={{flex:1,padding:"12px",background:"#eff6ff",color:"#2563eb",border:"2px solid #93c5fd",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {Icon.transfer(15,"#2563eb")} Inviter un ami
          </button>
        </div>
      </div>
    </div>
  );

  // ── PONT GAME ──
  if(screen==="game"&&cur) {
    const [ca1,cb1]=getClubColors(cur.c1);
    const [ca2,cb2]=getClubColors(cur.c2);
    const tc1=textColor(ca1); const tc2=textColor(ca2);
    return (
      <div style={{...shell,animation:"fadeIn .2s ease"}} key={"game-"+currentRound}>
        <div style={stripes}/>
        {floatingPoints}
        {/* Screen flash */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10,animation:feedback==="ok"?"flashOk .6s ease":feedback==="ko"?"flashKo .6s ease":"none"}}/>

        {/* Top bar */}
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexShrink:0}}>
          {backBtn(()=>{clearInterval(timerRef.current);setScreen("home");})}
          <div style={{background:"rgba(255,255,255,.13)",backdropFilter:"blur(10px)",borderRadius:18,padding:"8px 18px",display:"flex",alignItems:"center",gap:8,position:"relative"}}>
            {comboDisplay}
            <span style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:700,letterSpacing:1}}>M{currentRound}/{totalRounds}</span>
            {scoreDisplay(score,scoreAnim)}
            <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontWeight:600}}>pts</span>
          </div>
          {timerCircle()}
          {record?<div style={{background:"rgba(255,255,255,.13)",backdropFilter:"blur(10px)",borderRadius:18,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>🏆</span><span style={{fontFamily:G.heading,fontSize:22,color:G.gold}}>{record.score}</span></div>:<div style={{width:70}}/>}
        </div>

        {/* Club cards — full height */}
        <div key={"clubs-"+animKey} style={{flex:1,display:"flex",flexDirection:"column",gap:0,padding:"10px 0 0",zIndex:1,minHeight:0}}>
          {/* Club 1 */}
          <div style={{flex:1,margin:"0 14px 0 14px",borderRadius:28,background:`linear-gradient(145deg,${ca1} 0%,${cb1} 100%)`,boxShadow:`0 12px 40px ${ca1}55`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",animation:"clubSlideLeft .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            <div style={{position:"absolute",width:220,height:220,borderRadius:"50%",border:`3px solid ${tc1==="#FFF"?"rgba(255,255,255,.12)":"rgba(0,0,0,.08)"}`,top:-40,right:-40}}/>
            <div style={{position:"absolute",width:120,height:120,borderRadius:"50%",border:`2px solid ${tc1==="#FFF"?"rgba(255,255,255,.07)":"rgba(0,0,0,.05)"}`,bottom:20,left:-20}}/>
            <div style={{fontSize:10,letterSpacing:5,textTransform:"uppercase",color:tc1==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",fontWeight:700,marginBottom:10,zIndex:1}}>Club 1</div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(26px,7vw,48px)",color:tc1==="#FFF"?"#ffffff":"#111",lineHeight:1.05,textAlign:"center",padding:"0 20px",zIndex:1,textShadow:tc1==="#FFF"?"0 3px 12px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{cur.c1}</div>
          </div>

          {/* VS */}
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:44,zIndex:2,flexShrink:0}}>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.white,letterSpacing:4,background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:30,padding:"5px 18px",border:"1.5px solid rgba(255,255,255,.15)",animation:"vsAppear .5s cubic-bezier(.22,1,.36,1) .3s both"}}>VS</div>
          </div>

          {/* Club 2 */}
          <div style={{flex:1,margin:"0 14px 10px 14px",borderRadius:28,background:`linear-gradient(145deg,${ca2} 0%,${cb2} 100%)`,boxShadow:`0 12px 40px ${ca2}55`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",animation:"clubSlideRight .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:`3px solid ${tc2==="#FFF"?"rgba(255,255,255,.12)":"rgba(0,0,0,.08)"}`,bottom:-30,left:-30}}/>
            <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",border:`2px solid ${tc2==="#FFF"?"rgba(255,255,255,.07)":"rgba(0,0,0,.05)"}`,top:10,right:-10}}/>
            <div style={{fontSize:10,letterSpacing:5,textTransform:"uppercase",color:tc2==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",fontWeight:700,marginBottom:10,zIndex:1}}>Club 2</div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(26px,7vw,48px)",color:tc2==="#FFF"?"#ffffff":"#111",lineHeight:1.05,textAlign:"center",padding:"0 20px",zIndex:1,textShadow:tc2==="#FFF"?"0 3px 12px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{cur.c2}</div>
          </div>
        </div>

        {/* Bottom sheet */}
        <div style={{...sheet,borderRadius:"28px 28px 0 0",animation:"sheetUp .45s cubic-bezier(.22,1,.36,1) .15s both",flexShrink:0,paddingTop:14,gap:10}}>
          {combo>=3&&<div style={{textAlign:"center",animation:"comboFire .5s ease"}}><span style={{background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:G.white,borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:800,letterSpacing:1}}>{getComboLabel(combo)} x{combo}</span></div>}
          {feedbackBar(feedback)}

          {diff==="facile"?(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div key={"opts-"+animKey} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {options.map((opt,oi)=>{
                  const isOk=flash==="ok"&&checkGuess(opt,cur.p);
                  const isKo=flash===opt;
                  const playerEntry = PLAYERS.find(p=>p.name===opt);
                  const mainClub = playerEntry?.clubs?.[0] || "";
                  const [oca,ocb] = getClubColors(mainClub);
                  const otc = textColor(oca);
                  return(
                    <button key={opt} onClick={()=>handleOptionClick(opt)} disabled={!!flash}
                      style={{
                        padding:"14px 10px", borderRadius:18, cursor:"pointer",
                        fontFamily:G.font, fontSize:"clamp(12px,3vw,16px)", fontWeight:800,
                        lineHeight:1.3, transition:"all .15s", position:"relative", overflow:"hidden",
                        border: isOk?"3px solid #16a34a": isKo?"3px solid #ef4444":`2px solid ${oca}44`,
                        background: isOk?"#dcfce7": isKo?"#fee2e2": `linear-gradient(145deg,${oca}22 0%,${ocb}11 100%)`,
                        color: isOk?"#16a34a": isKo?G.red: G.dark,
                        boxShadow: isOk?"0 0 20px rgba(74,222,128,.4)": isKo?"0 0 20px rgba(239,68,68,.3)": `0 3px 12px ${oca}22`,
                        animation: isOk?"answerOk .4s ease": isKo?"answerKo .4s ease": `optionIn .4s cubic-bezier(.22,1,.36,1) ${oi*.07}s both`,
                      }}>
                      {/* Club color strip */}
                      {!isOk&&!isKo&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${oca},${ocb})`,borderRadius:"18px 18px 0 0"}}/>}
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
                      {!isOk&&!isKo&&<PlayerAvatarMini name={opt} size={30}/>}
                      {isOk&&<span style={{fontSize:16}}>✓</span>}
                      {isKo&&<span style={{fontSize:16}}>✗</span>}
                      <span style={{fontSize:"clamp(12px,3vw,16px)",fontWeight:800,color:isOk?"#16a34a":isKo?G.red:G.dark}}>{opt}</span>
                    </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handlePass} disabled={!!flash} style={{padding:"12px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,opacity:flash?.3:1}}>Passer → (−0.5 pt)</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                placeholder="Nom du joueur..." autoComplete="off"
                style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:`2px solid ${flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0"}`,borderRadius:18,padding:"15px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s",animation:flash==="ko"?"answerKo .4s ease":flash==="ok"?"answerOk .4s ease":"none"}}/>
              <div style={{display:"flex",gap:10}}>
                <button onClick={handleSubmit} style={{flex:2,padding:"15px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>Valider</button>
                <button onClick={handlePass} disabled={!!flash} style={{flex:1,padding:15,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash?.3:1}}>Passer →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CHAIN GAME ──
  if(screen==="chainGame") {
    const chainPlayerEntry = PLAYERS.find(p => p.name === chainPlayer);
    const chainPlayerClubs = chainPlayerEntry ? chainPlayerEntry.clubs : [];
    const chainMainClub = chainPlayerClubs[0] || "";
    const [pca, pcb] = getClubColors(chainMainClub);
    const ptc = textColor(pca);
    const chainAvailableClubs = chainPlayerClubs.filter(cl => !chainUsedClubs.has(cl));
    const [cla, clb] = chainLastClub ? getClubColors(chainLastClub) : ["#1a7a3a","#fff"];
    const clTagColor = chainLastClub ? textColor(cla) : "#fff";
    return (
    <div style={{...shell,animation:"fadeIn .3s ease",overflow:"auto"}} key={"chain-"+chainCount}>
      <div style={stripes}/>
      {floatingPoints}
      <div style={{zIndex:2,padding:"12px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,position:"sticky",top:0}}>
        {backBtn(()=>{clearInterval(timerRef.current);setScreen("home");})}
        <div style={{background:"rgba(255,255,255,.12)",backdropFilter:"blur(8px)",borderRadius:18,padding:"8px 14px",display:"flex",alignItems:"center",gap:8,position:"relative"}}>
          {comboDisplay}
          <span style={{fontFamily:G.heading,fontSize:30,color:G.white,display:"inline-block",animation:scoreAnim==="up"?"scoreUp .5s ease":scoreAnim==="down"?"scoreDn .5s ease":"none"}}>{chainScore}</span>
          <span style={{fontSize:11,color:"rgba(255,255,255,.5)",fontWeight:600}}>pts</span>
        </div>
        {timerCircle(64)}
        {chainRecord
          ? <div style={{background:"rgba(255,255,255,.12)",backdropFilter:"blur(8px)",borderRadius:18,padding:"8px 12px",display:"flex",alignItems:"center",gap:6}}>
              {Icon.trophy(16,G.gold)}
              <span style={{fontFamily:G.heading,fontSize:20,color:G.gold}}>{chainRecord.score}</span>
            </div>
          : <div style={{width:50}}/>
        }
      </div>

      {chainLastClub && (
        <div style={{zIndex:1,textAlign:"center",padding:"4px 0",animation:"clubTagPop .4s cubic-bezier(.22,1,.36,1)"}}>
          <span style={{background:`linear-gradient(135deg,${cla},${clb})`,borderRadius:30,padding:"5px 16px",fontSize:12,color:clTagColor==="#FFF"?"#fff":"#111",fontWeight:700,boxShadow:`0 3px 12px ${cla}55`,display:"inline-flex",alignItems:"center",gap:5}}>
            {Icon.stadium(13,clTagColor==="#FFF"?"#fff":"#111")} {chainLastClub}
          </span>
        </div>
      )}

      <div key={"cp-"+chainCount} style={{
        zIndex:2, margin:"4px 16px", borderRadius:24,
        background:`linear-gradient(145deg, ${pca} 0%, ${pcb} 100%)`,
        padding:"20px", textAlign:"center",
        boxShadow:`0 12px 35px ${pca}55`,
        animation:"playerDrop .55s cubic-bezier(.22,1,.36,1)",
        position:"sticky", top:70, flexShrink:0, overflow:"hidden",
      }}>
        <div style={{position:"absolute",width:180,height:180,borderRadius:"50%",border:`2px solid ${ptc==="#FFF"?"rgba(255,255,255,.1)":"rgba(0,0,0,.06)"}`,top:-50,right:-30,pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:90,height:90,borderRadius:"50%",border:`2px solid ${ptc==="#FFF"?"rgba(255,255,255,.07)":"rgba(0,0,0,.04)"}`,bottom:-20,left:10,pointerEvents:"none"}}/>
        <div style={{fontSize:10,letterSpacing:4,textTransform:"uppercase",color:ptc==="#FFF"?"rgba(255,255,255,.6)":"rgba(0,0,0,.35)",marginBottom:10,fontWeight:700,zIndex:1,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          {Icon.ball(12,ptc==="#FFF"?"rgba(255,255,255,.6)":"rgba(0,0,0,.35)")} Donne un club de
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,zIndex:1,position:"relative",justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{animation:"playerDrop .4s cubic-bezier(.22,1,.36,1)"}}><PlayerAvatar name={chainPlayer} size={58}/></div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(18px,5vw,34px)",color:ptc==="#FFF"?"#fff":"#111",lineHeight:1.05,textShadow:ptc==="#FFF"?"0 2px 10px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{chainPlayer}</div>
            {chainUsedClubs.size>0 && <div style={{fontSize:10,color:ptc==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",marginTop:3,fontWeight:600}}>{chainAvailableClubs.length} club{chainAvailableClubs.length!==1?"s":""} restant{chainAvailableClubs.length!==1?"s":""}</div>}
          </div>
        </div>
        {combo>=3 && <div style={{marginTop:6,fontSize:12,fontWeight:800,color:ptc==="#FFF"?"#fff":"#111",animation:"comboFire .5s ease",zIndex:1,position:"relative"}}>{getComboLabel(combo)} x{combo}</div>}
      </div>

      <div style={{...sheet,marginTop:0,borderRadius:"28px 28px 0 0"}}>
        {feedbackBar(feedback)}
        <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChainSubmit()}
          placeholder="Nom du club..." autoComplete="off"
          style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:`2px solid ${flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0"}`,borderRadius:18,padding:"16px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s"}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={handleChainSubmit} style={{flex:2,padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>Valider</button>
          <button onClick={handleChainPass} disabled={!!flash} style={{flex:1,padding:16,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash?.3:1}}>Passer →</button>
        </div>
        {chainHistory.length>0 && (
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#ccc",textAlign:"center"}}>Chaîne</div>
            {chainHistory.map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:G.offWhite,borderRadius:12,animation:`slideIn .3s ease ${i*.04}s both`,opacity:h.passed?.7:1}}>
                <span style={{fontSize:10,color:"#bbb",fontWeight:700,minWidth:18}}>{i+1}.</span>
                <PlayerAvatarMini name={h.player} size={26}/>
                <span style={{fontSize:12,color:G.dark,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.player}</span>
                <span style={{display:"flex",alignItems:"center",flexShrink:0}}>{Icon.transfer(11,"#ccc")}</span>
                <span style={{fontSize:12,color:h.passed?"#aaa":G.bg,fontWeight:700,flexShrink:0}}>{h.club}</span>
              </div>
            ))}
            <div ref={historyEndRef}/>
          </div>
        )}
      </div>
    </div>
    );
  }


  // ── ROUND END ──
  if(screen==="roundEnd") return (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key="roundEnd">
      <div style={stripes}/>
      <div style={{zIndex:1,padding:"40px 20px 20px",textAlign:"center"}}>
        <div style={{fontSize:13,letterSpacing:4,textTransform:"uppercase",color:"rgba(255,255,255,.5)",fontWeight:600}}>Fin de manche {currentRound} · {diff}</div>
        <div style={{fontFamily:G.heading,fontSize:"clamp(36px,9vw,56px)",color:totalRounds===2&&currentRound===1?G.gold:G.white,letterSpacing:2,marginTop:6}}>
          {totalRounds===2&&currentRound===1?"⚽ MI-TEMPS !":"MANCHE "+currentRound+" TERMINÉE"}
        </div>
        {totalRounds===2&&currentRound===1&&<div style={{fontSize:14,color:"rgba(255,255,255,.6)",marginTop:8,letterSpacing:2}}>Retour sur le terrain dans 3... 2... 1...</div>}
      </div>
      <div style={sheet}>
        {roundScores.map((s,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:i===roundScores.length-1?G.dark:G.offWhite,borderRadius:18,padding:"16px 20px",animation:`slideIn .4s ease ${i*.08}s both`}}>
            <span style={{fontSize:15,color:i===roundScores.length-1?G.white:"#888",fontWeight:700}}>Manche {i+1}</span>
            <span style={{fontFamily:G.heading,fontSize:32,color:i===roundScores.length-1?G.white:G.dark}}>{s} pts</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#fef3c7,#fde68a)",borderRadius:18,padding:"16px 20px",border:"2px solid #fbbf24"}}>
          <span style={{fontSize:15,color:"#92400e",fontWeight:700}}>Total ({roundScores.length}/{totalRounds})</span>
          <span style={{fontFamily:G.heading,fontSize:32,color:"#92400e"}}>{roundScores.reduce((a,b)=>a+b,0)} pts</span>
        </div>
        <button onClick={()=>startRound(currentRound+1)} style={{width:"100%",padding:"18px",background:totalRounds===2&&currentRound===1?"#16a34a":G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,marginTop:"auto",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.whistle(18,G.white)} {totalRounds===2&&currentRound===1?"REPRENDRE LA PARTIE →":"MANCHE "+(currentRound+1)}</button>
      </div>
    </div>
  );

  // ── FINAL ──
  const makeResultScreen = (sc, mode, isChain) => (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key={isChain?"chainEnd":"final"}>
      {confettiOverlay}<div style={stripes}/>
      <div style={{zIndex:1,padding:"32px 20px 16px",textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:8,animation:"popIn .6s ease",display:"flex",justifyContent:"center"}}>{isNewRecord?Icon.trophy(60,G.gold):sc>=20?<span style={{fontSize:52}}>🔥</span>:Icon.ball(56,G.white)}</div>
        <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:isNewRecord?G.gold:G.white,letterSpacing:2,animation:"fadeUp .5s ease .1s both"}}>{isNewRecord?"NOUVEAU RECORD !":isChain?"TEMPS ÉCOULÉ !":"RÉSULTATS FINAUX"}</div>
      </div>
      <div style={sheet}>
        <div style={{background:G.offWhite,borderRadius:20,padding:"20px",textAlign:"center",border:"1.5px solid #eee"}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#bbb"}}>Score{isChain?"":" total"}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(54px,13vw,80px)",color:G.dark,lineHeight:1}}>{sc}</div>
          <div style={{fontSize:11,color:"#bbb"}}>pts{isChain?` · ${chainCount} lien${chainCount>1?"s":""}`:`  ·  ${totalRounds} manche${totalRounds>1?"s":""}`}</div>
          {maxCombo>=3&&<div style={{fontSize:13,color:"#f59e0b",marginTop:4,fontWeight:700}}>🔥 Meilleur combo : x{maxCombo}</div>}
          {isNewRecord&&<div style={{fontSize:12,color:G.accent,marginTop:6,fontStyle:"italic"}}>Ancien record battu 🎉</div>}
        </div>

        {!isChain&&roundScores.length>1&&(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {roundScores.map((s,i)=>{
              const best=Math.max(...roundScores);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:s===best?G.dark:G.offWhite,borderRadius:12,padding:"10px 16px",animation:`slideIn .4s ease ${i*.07}s both`}}>
                  <span style={{fontSize:13,fontWeight:700,color:s===best?G.white:"#aaa"}}>Manche {i+1} {s===best?"⭐":""}</span>
                  <span style={{fontFamily:G.heading,fontSize:24,color:s===best?G.white:G.dark}}>{s} pts</span>
                </div>
              );
            })}
          </div>
        )}

        {myLbRank&&<div style={{padding:"10px 16px",background:"linear-gradient(135deg,#fef3c7,#fde68a)",borderRadius:14,textAlign:"center",border:"2px solid #fbbf24"}}><span style={{fontSize:14,fontWeight:700,color:"#92400e"}}>🎯 Ton classement : #{myLbRank}</span></div>}

        {myLastPts!==null&&(
          <div style={{textAlign:"center",padding:"12px 16px",borderRadius:16,background:myLastPts===10?"linear-gradient(135deg,#dcfce7,#bbf7d0)":myLastPts===5?"linear-gradient(135deg,#fef9c3,#fef08a)":"linear-gradient(135deg,#fee2e2,#fecaca)",border:`2px solid ${myLastPts===10?"#86efac":myLastPts===5?"#fbbf24":"#fca5a5"}`}}>
            <div style={{fontFamily:G.heading,fontSize:26,letterSpacing:2,color:myLastPts===10?"#16a34a":myLastPts===5?"#92400e":"#dc2626"}}>
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{myLastPts===10?Icon.trophy(24,"#16a34a"):myLastPts===5?Icon.ball(24,"#92400e"):Icon.whistle(24,"#dc2626")} {myLastPts===3?"VICTOIRE  +3 PTS":myLastPts===1?"MATCH NUL  +1 PT":"DÉFAITE  +0 PT"}</span>
            </div>
            <div style={{fontSize:11,color:"#888",marginTop:2}}>{myLastPts===10?"Tu bats le record actuel !":myLastPts===5?"Proche du record !":"Reviens à la charge !"}</div>
          </div>
        )}
        <button onClick={()=>{setLbMode(mode);setLbDiff(diff);loadLeaderboard(mode,diff);setShowLeaderboard(true);}}
          style={{width:"100%",padding:"14px",background:"#f0f9f4",color:"#16a34a",border:"2px solid #86efac",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>
          <span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>{Icon.stadium(16,"#16a34a")} Voir le classement{myLbRank?` · #${myLbRank}`:""}</span>
        </button>
        <button onClick={()=>{if(isChain)startChain();else startCompetition();}} style={{width:"100%",padding:"18px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.ball(18,G.white)} Rejouer</button>
        <button onClick={()=>setScreen("home")} style={{width:"100%",padding:"14px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:700}}>↩ Accueil</button>
      </div>
    </div>
  );

  if(screen==="chainEnd") return makeResultScreen(chainScore,"chaine",true);
  if(screen==="final") return makeResultScreen(total,"pont",false);

  return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white}}>Chargement…</div></div>;
}
