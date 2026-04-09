import React, { useState, useEffect, useRef, useCallback } from "react";
const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";

async function sbFetch(path, options) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, {
    ...options,
    headers: Object.assign({
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": "application/json",
    }, options && options.method === "POST" ? {"Prefer": "return=minimal"} : {},
       options && options.headers ? options.headers : {})
  });
  if (!res.ok && res.status !== 201) return null;
  if (res.status === 201 || res.headers.get("content-length") === "0") return [];
  try { return await res.json(); } catch { return []; }
}

function getPlayerId() {
  try {
    let id = localStorage.getItem("bb_player_id");
    if (!id) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      id = Array.from({length:6}, function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
      localStorage.setItem("bb_player_id", id);
    }
    return id;
  } catch(e) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:6}, function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
  }
}




// ── CONSTANTS ──
const ROUND_DURATION = 90;
const QUESTION_DURATION = 5;
const CHAIN_DURATION = 90;
const COMBO_THRESHOLD = 3;

// ── CONSTANTS ──
// ── PLAYER DATABASE ──
const PLAYERS = [
  { name:"Cristiano Ronaldo", clubs:["Manchester United", "Real Madrid", "Juventus", "Al Nassr"], diff:"facile" },
  { name:"Lionel Messi", clubs:["Barcelona", "PSG", "Inter Miami"], diff:"facile" },
  { name:"Neymar", clubs:["Santos", "Barcelona", "PSG", "Al Hilal"], diff:"facile" },
  { name:"Kylian Mbappe", clubs:["Monaco", "PSG", "Real Madrid"], diff:"facile" },
  { name:"Erling Haaland", clubs:["Molde", "Salzburg", "Borussia Dortmund", "Manchester City"], diff:"facile" },
  { name:"Jude Bellingham", clubs:["Birmingham City", "Borussia Dortmund", "Real Madrid"], diff:"facile" },
  { name:"Vinicius Junior", clubs:["Flamengo", "Real Madrid"], diff:"facile" },
  { name:"Lamine Yamal", clubs:["Barcelona"], diff:"facile" },
  { name:"Cole Palmer", clubs:["Manchester City", "Chelsea"], diff:"facile" },
  { name:"Robert Lewandowski", clubs:["Borussia Dortmund", "Bayern Munich", "Barcelona"], diff:"facile" },
  { name:"Karim Benzema", clubs:["Lyon", "Real Madrid", "Al Ittihad"], diff:"facile" },
  { name:"Mohamed Salah", clubs:["Basel", "Chelsea", "Fiorentina", "Roma", "Liverpool"], diff:"facile" },
  { name:"Kevin De Bruyne", clubs:["Chelsea", "Wolfsburg", "Manchester City"], diff:"facile" },
  { name:"Harry Kane", clubs:["Tottenham", "Bayern Munich"], diff:"facile" },
  { name:"N'Golo Kante", clubs:["Leicester City", "Chelsea", "Al Ittihad"], diff:"facile" },
  { name:"Sergio Ramos", clubs:["Sevilla", "Real Madrid", "PSG"], diff:"facile" },
  { name:"Antoine Griezmann", clubs:["Atletico Madrid", "Barcelona"], diff:"facile" },
  { name:"Eden Hazard", clubs:["Lille", "Chelsea", "Real Madrid"], diff:"facile" },
  { name:"Luis Suarez", clubs:["Ajax", "Liverpool", "Barcelona", "Atletico Madrid"], diff:"facile" },
  { name:"Zlatan Ibrahimovic", clubs:["Juventus", "Inter Milan", "Barcelona", "AC Milan", "PSG", "Manchester United"], diff:"facile" },
  { name:"Gareth Bale", clubs:["Southampton", "Tottenham", "Real Madrid"], diff:"facile" },
  { name:"Wayne Rooney", clubs:["Everton", "Manchester United"], diff:"facile" },
  { name:"Toni Kroos", clubs:["Bayern Munich", "Real Madrid"], diff:"facile" },
  { name:"Luka Modric", clubs:["Tottenham", "Real Madrid"], diff:"facile" },
  { name:"Paul Pogba", clubs:["Manchester United", "Juventus"], diff:"facile" },
  { name:"Didier Drogba", clubs:["Le Mans", "Guingamp", "Marseille", "Chelsea", "Galatasaray"], diff:"facile" },
  { name:"Samuel Etoo", clubs:["Real Madrid", "Mallorca", "Barcelona", "Inter Milan", "Chelsea", "Everton"], diff:"facile" },
  { name:"Virgil van Dijk", clubs:["Celtic", "Southampton", "Liverpool"], diff:"facile" },
  { name:"David Beckham", clubs:["Manchester United", "Real Madrid", "AC Milan", "PSG", "LA Galaxy"], diff:"facile" },
  { name:"Sadio Mane", clubs:["Metz", "Salzburg", "Southampton", "Liverpool", "Bayern Munich", "Al Nassr"], diff:"moyen" },
  { name:"Raheem Sterling", clubs:["Liverpool", "Manchester City", "Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Ousmane Dembele", clubs:["Rennes", "Borussia Dortmund", "Barcelona", "PSG"], diff:"moyen" },
  { name:"Marcus Rashford", clubs:["Manchester United", "Aston Villa"], diff:"moyen" },
  { name:"Jack Grealish", clubs:["Aston Villa", "Manchester City"], diff:"moyen" },
  { name:"Declan Rice", clubs:["West Ham", "Arsenal"], diff:"moyen" },
  { name:"Bernardo Silva", clubs:["Monaco", "Manchester City"], diff:"moyen" },
  { name:"Joao Felix", clubs:["Benfica", "Atletico Madrid", "Chelsea", "Barcelona"], diff:"moyen" },
  { name:"Joao Cancelo", clubs:["Juventus", "Manchester City", "Bayern Munich", "Barcelona"], diff:"moyen" },
  { name:"Leroy Sane", clubs:["Schalke", "Manchester City", "Bayern Munich"], diff:"moyen" },
  { name:"Kai Havertz", clubs:["Bayer Leverkusen", "Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Theo Hernandez", clubs:["Atletico Madrid", "Real Madrid", "AC Milan"], diff:"moyen" },
  { name:"Aurelien Tchouameni", clubs:["Monaco", "Real Madrid"], diff:"moyen" },
  { name:"Eduardo Camavinga", clubs:["Rennes", "Real Madrid"], diff:"moyen" },
  { name:"William Saliba", clubs:["Saint-Etienne", "Arsenal"], diff:"moyen" },
  { name:"Jules Kounde", clubs:["Bordeaux", "Sevilla", "Barcelona"], diff:"moyen" },
  { name:"Federico Chiesa", clubs:["Fiorentina", "Juventus", "Liverpool"], diff:"moyen" },
  { name:"Bruno Fernandes", clubs:["Sporting CP", "Manchester United"], diff:"moyen" },
  { name:"Martin Odegaard", clubs:["Real Madrid", "Real Sociedad", "Arsenal"], diff:"moyen" },
  { name:"Adrien Rabiot", clubs:["PSG", "Juventus", "Marseille"], diff:"moyen" },
  { name:"Sandro Tonali", clubs:["AC Milan", "Newcastle"], diff:"moyen" },
  { name:"Florian Wirtz", clubs:["Bayer Leverkusen", "Liverpool"], diff:"moyen" },
  { name:"Jamal Musiala", clubs:["Chelsea", "Bayern Munich"], diff:"moyen" },
  { name:"Rafael Leao", clubs:["Sporting CP", "Lille", "AC Milan"], diff:"moyen" },
  { name:"Pedri", clubs:["Las Palmas", "Barcelona"], diff:"moyen" },
  { name:"Gavi", clubs:["Barcelona"], diff:"moyen" },
  { name:"Rodri", clubs:["Atletico Madrid", "Manchester City"], diff:"moyen" },
  { name:"Thomas Muller", clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Manuel Neuer", clubs:["Schalke", "Bayern Munich"], diff:"moyen" },
  { name:"Gianluigi Donnarumma", clubs:["AC Milan", "PSG"], diff:"moyen" },
  { name:"Raphael Varane", clubs:["Lens", "Real Madrid", "Manchester United"], diff:"moyen" },
  { name:"Marquinhos", clubs:["Roma", "PSG"], diff:"moyen" },
  { name:"Ruben Dias", clubs:["Benfica", "Manchester City"], diff:"moyen" },
  { name:"Kalidou Koulibaly", clubs:["Napoli", "Chelsea", "Al Hilal"], diff:"moyen" },
  { name:"David Alaba", clubs:["Bayern Munich", "Real Madrid"], diff:"moyen" },
  { name:"Andrew Robertson", clubs:["Hull City", "Liverpool"], diff:"moyen" },
  { name:"Frenkie de Jong", clubs:["Ajax", "Barcelona"], diff:"moyen" },
  { name:"Thiago Alcantara", clubs:["Barcelona", "Bayern Munich", "Liverpool"], diff:"moyen" },
  { name:"David Silva", clubs:["Valencia", "Manchester City", "Real Sociedad"], diff:"moyen" },
  { name:"Lautaro Martinez", clubs:["Racing Club", "Inter Milan"], diff:"moyen" },
  { name:"Paulo Dybala", clubs:["Palermo", "Juventus", "Roma"], diff:"moyen" },
  { name:"Enzo Fernandez", clubs:["River Plate", "Benfica", "Chelsea"], diff:"moyen" },
  { name:"Alexis Mac Allister", clubs:["Brighton", "Liverpool"], diff:"moyen" },
  { name:"Angel Di Maria", clubs:["Benfica", "Real Madrid", "Manchester United", "PSG", "Juventus"], diff:"moyen" },
  { name:"Carlos Tevez", clubs:["Manchester United", "Manchester City", "Juventus", "Boca Juniors"], diff:"moyen" },
  { name:"Radamel Falcao", clubs:["Porto", "Atletico Madrid", "Monaco", "Manchester United", "Chelsea"], diff:"moyen" },
  { name:"James Rodriguez", clubs:["Monaco", "Real Madrid", "Bayern Munich", "Everton"], diff:"moyen" },
  { name:"Heung-min Son", clubs:["Bayer Leverkusen", "Tottenham"], diff:"moyen" },
  { name:"Victor Osimhen", clubs:["Lille", "Napoli", "Galatasaray"], diff:"moyen" },
  { name:"Riyad Mahrez", clubs:["Le Havre", "Leicester City", "Manchester City", "Al Ahli"], diff:"moyen" },
  { name:"Ilkay Gundogan", clubs:["Borussia Dortmund", "Manchester City", "Barcelona", "AC Milan"], diff:"moyen" },
  { name:"Thiago Silva", clubs:["AC Milan", "PSG", "Chelsea"], diff:"moyen" },
  { name:"Casemiro", clubs:["Real Madrid", "Manchester United"], diff:"moyen" },
  { name:"Jordan Henderson", clubs:["Sunderland", "Liverpool", "Al Ettifaq", "Ajax"], diff:"moyen" },
  { name:"Harry Maguire", clubs:["Leicester City", "Manchester United", "West Ham"], diff:"moyen" },
  { name:"Kieran Trippier", clubs:["Tottenham", "Atletico Madrid", "Newcastle"], diff:"moyen" },
  { name:"Nicolas Otamendi", clubs:["Valencia", "Manchester City", "Benfica"], diff:"moyen" },
  { name:"Lisandro Martinez", clubs:["Ajax", "Manchester United"], diff:"moyen" },
  { name:"Richarlison", clubs:["Watford", "Everton", "Tottenham"], diff:"moyen" },
  { name:"Gabriel Jesus", clubs:["Palmeiras", "Manchester City", "Arsenal"], diff:"moyen" },
  { name:"Gabriel Martinelli", clubs:["Ituano", "Arsenal"], diff:"moyen" },
  { name:"Rodrygo", clubs:["Santos", "Real Madrid"], diff:"moyen" },
  { name:"Nicolo Barella", clubs:["Cagliari", "Inter Milan"], diff:"moyen" },
  { name:"Khvicha Kvaratskhelia", clubs:["Napoli", "PSG"], diff:"moyen" },
  { name:"Jonathan David", clubs:["Gent", "Lille", "Inter Milan"], diff:"moyen" },
  { name:"Ollie Watkins", clubs:["Brentford", "Aston Villa"], diff:"moyen" },
  { name:"Bradley Barcola", clubs:["Lyon", "PSG"], diff:"moyen" },
  { name:"Michael Olise", clubs:["Crystal Palace", "Bayern Munich"], diff:"moyen" },
  { name:"Viktor Gyokeres", clubs:["Coventry City", "Sporting CP", "Arsenal"], diff:"moyen" },
  { name:"Rasmus Hojlund", clubs:["Atalanta", "Manchester United"], diff:"moyen" },
  { name:"Memphis Depay", clubs:["PSV", "Manchester United", "Lyon", "Barcelona", "Atletico Madrid"], diff:"moyen" },
  { name:"Jadon Sancho", clubs:["Borussia Dortmund", "Manchester United", "Chelsea"], diff:"moyen" },
  { name:"Mason Mount", clubs:["Chelsea", "Manchester United"], diff:"moyen" },
  { name:"Pierre-Emerick Aubameyang", clubs:["Borussia Dortmund", "Arsenal", "Barcelona", "Chelsea", "Marseille"], diff:"moyen" },
  { name:"Olivier Giroud", clubs:["Montpellier", "Arsenal", "Chelsea", "AC Milan", "Los Angeles FC", "Lille"], diff:"moyen" },
  { name:"Edinson Cavani", clubs:["Napoli", "PSG", "Manchester United"], diff:"moyen" },
  { name:"Gonzalo Higuain", clubs:["Real Madrid", "Napoli", "Juventus", "AC Milan", "Chelsea"], diff:"moyen" },
  { name:"Alvaro Morata", clubs:["Real Madrid", "Juventus", "Chelsea", "Atletico Madrid", "AC Milan"], diff:"moyen" },
  { name:"Cesc Fabregas", clubs:["Arsenal", "Barcelona", "Chelsea", "Monaco"], diff:"moyen" },
  { name:"Xabi Alonso", clubs:["Real Sociedad", "Liverpool", "Real Madrid", "Bayern Munich"], diff:"moyen" },
  { name:"Andres Iniesta", clubs:["Barcelona", "Vissel Kobe"], diff:"moyen" },
  { name:"Frank Lampard", clubs:["West Ham", "Chelsea", "Manchester City"], diff:"moyen" },
  { name:"Steven Gerrard", clubs:["Liverpool"], diff:"moyen" },
  { name:"Rio Ferdinand", clubs:["West Ham", "Leeds United", "Manchester United"], diff:"moyen" },
  { name:"John Terry", clubs:["Chelsea", "Aston Villa"], diff:"moyen" },
  { name:"Michael Owen", clubs:["Liverpool", "Real Madrid", "Newcastle", "Manchester United"], diff:"moyen" },
  { name:"Miroslav Klose", clubs:["Werder Bremen", "Bayern Munich", "Lazio"], diff:"moyen" },
  { name:"Lucas Hernandez", clubs:["Atletico Madrid", "Bayern Munich", "PSG"], diff:"expert" },
  { name:"Dayot Upamecano", clubs:["RB Leipzig", "Bayern Munich"], diff:"expert" },
  { name:"Randal Kolo Muani", clubs:["Nantes", "Eintracht Frankfurt", "PSG", "Juventus"], diff:"expert" },
  { name:"Matteo Guendouzi", clubs:["Arsenal", "Marseille", "Lazio"], diff:"expert" },
  { name:"Wissam Ben Yedder", clubs:["Toulouse", "Sevilla", "Monaco"], diff:"expert" },
  { name:"Jonathan Clauss", clubs:["Marseille", "Nice"], diff:"expert" },
  { name:"Dani Olmo", clubs:["Dinamo Zagreb", "RB Leipzig", "Barcelona"], diff:"expert" },
  { name:"Mikel Oyarzabal", clubs:["Real Sociedad"], diff:"expert" },
  { name:"Alejandro Grimaldo", clubs:["Benfica", "Bayer Leverkusen"], diff:"expert" },
  { name:"Nico Williams", clubs:["Athletic Bilbao"], diff:"expert" },
  { name:"Mikel Merino", clubs:["Borussia Dortmund", "Newcastle", "Real Sociedad", "Arsenal"], diff:"expert" },
  { name:"Granit Xhaka", clubs:["Borussia Monchengladbach", "Arsenal", "Bayer Leverkusen"], diff:"expert" },
  { name:"Marco Reus", clubs:["Borussia Monchengladbach", "Borussia Dortmund"], diff:"expert" },
  { name:"Mats Hummels", clubs:["Borussia Dortmund", "Bayern Munich", "Roma"], diff:"expert" },
  { name:"Mario Gotze", clubs:["Borussia Dortmund", "Bayern Munich", "PSV"], diff:"expert" },
  { name:"Sami Khedira", clubs:["Real Madrid", "Juventus", "Arsenal"], diff:"expert" },
  { name:"Leon Goretzka", clubs:["Schalke", "Bayern Munich"], diff:"expert" },
  { name:"Diogo Jota", clubs:["Wolverhampton", "Liverpool"], diff:"expert" },
  { name:"Pedro Neto", clubs:["Wolverhampton", "Chelsea"], diff:"expert" },
  { name:"Vitinha", clubs:["Wolverhampton", "Porto", "PSG"], diff:"expert" },
  { name:"Marco Verratti", clubs:["PSG", "Al Arabi"], diff:"expert" },
  { name:"Nicolo Zaniolo", clubs:["Roma", "Galatasaray"], diff:"expert" },
  { name:"Manuel Locatelli", clubs:["AC Milan", "Sassuolo", "Juventus"], diff:"expert" },
  { name:"Giacomo Raspadori", clubs:["Sassuolo", "Napoli"], diff:"expert" },
  { name:"Gianluca Scamacca", clubs:["Sassuolo", "West Ham", "Atalanta"], diff:"expert" },
  { name:"Xavi", clubs:["Barcelona", "Al-Sadd"], diff:"expert" },
  { name:"Sergio Busquets", clubs:["Barcelona", "Inter Miami"], diff:"expert" },
  { name:"Giorgio Chiellini", clubs:["Juventus", "Los Angeles FC"], diff:"expert" },
  { name:"Leonardo Bonucci", clubs:["Juventus", "AC Milan", "Union Berlin"], diff:"expert" },
  { name:"Dani Carvajal", clubs:["Real Madrid"], diff:"expert" },
  { name:"Jerome Boateng", clubs:["Manchester City", "Bayern Munich"], diff:"expert" },
  { name:"Jordi Alba", clubs:["Valencia", "Barcelona", "Inter Miami"], diff:"expert" },
  { name:"Luke Shaw", clubs:["Southampton", "Manchester United"], diff:"expert" },
  { name:"Benjamin Pavard", clubs:["Stuttgart", "Bayern Munich", "Inter Milan"], diff:"expert" },
  { name:"Presnel Kimpembe", clubs:["PSG"], diff:"expert" },
  { name:"John Stones", clubs:["Everton", "Manchester City"], diff:"expert" },
  { name:"Arturo Vidal", clubs:["Juventus", "Bayern Munich", "Barcelona", "Inter Milan"], diff:"expert" },
  { name:"Nemanja Matic", clubs:["Chelsea", "Manchester United", "Roma"], diff:"expert" },
  { name:"Aaron Ramsey", clubs:["Arsenal", "Juventus"], diff:"expert" },
  { name:"Blaise Matuidi", clubs:["PSG", "Juventus"], diff:"expert" },
  { name:"Roberto Firmino", clubs:["Hoffenheim", "Liverpool"], diff:"expert" },
  { name:"Jamie Vardy", clubs:["Leicester City"], diff:"expert" },
  { name:"Divock Origi", clubs:["Liverpool", "AC Milan"], diff:"expert" },
  { name:"Thomas Lemar", clubs:["Monaco", "Atletico Madrid"], diff:"expert" },
  { name:"Kingsley Coman", clubs:["PSG", "Juventus", "Bayern Munich"], diff:"expert" },
  { name:"Ciro Immobile", clubs:["Juventus", "Torino", "Borussia Dortmund", "Lazio"], diff:"expert" },
  { name:"Lorenzo Insigne", clubs:["Napoli", "Toronto FC"], diff:"expert" },
  { name:"Dries Mertens", clubs:["PSV", "Napoli"], diff:"expert" },
  { name:"Hakim Ziyech", clubs:["Ajax", "Chelsea", "Galatasaray"], diff:"expert" },
  { name:"Wilfried Zaha", clubs:["Crystal Palace", "Manchester United"], diff:"expert" },
  { name:"Idrissa Gueye", clubs:["Aston Villa", "Everton", "PSG"], diff:"expert" },
  { name:"Ashley Cole", clubs:["Arsenal", "Chelsea", "Roma"], diff:"expert" },
  { name:"David de Gea", clubs:["Atletico Madrid", "Manchester United"], diff:"expert" },
  { name:"Fernando Llorente", clubs:["Athletic Bilbao", "Juventus", "Sevilla", "Tottenham"], diff:"expert" },
  { name:"Santi Cazorla", clubs:["Villarreal", "Malaga", "Arsenal"], diff:"expert" },
  { name:"Iker Casillas", clubs:["Real Madrid", "Porto"], diff:"expert" },
  { name:"Juan Mata", clubs:["Valencia", "Chelsea", "Manchester United"], diff:"expert" },
  { name:"Figo", clubs:["Sporting CP", "Barcelona", "Real Madrid", "Inter Milan"], diff:"expert" },
  { name:"Ricardo Carvalho", clubs:["Porto", "Chelsea", "Real Madrid", "Monaco"], diff:"expert" },
  { name:"Pepe", clubs:["Porto", "Real Madrid", "Besiktas"], diff:"expert" },
  { name:"Ruud van Nistelrooy", clubs:["PSV", "Manchester United", "Real Madrid"], diff:"expert" },
  { name:"Patrick Kluivert", clubs:["Ajax", "Barcelona", "Roma", "Valencia", "Newcastle"], diff:"expert" },
  { name:"Dirk Kuyt", clubs:["Liverpool", "Fenerbahce"], diff:"expert" },
  { name:"Diego Forlan", clubs:["Manchester United", "Atletico Madrid", "Inter Milan"], diff:"expert" },
  { name:"Hernan Crespo", clubs:["Lazio", "Inter Milan", "Chelsea", "AC Milan"], diff:"expert" },
  { name:"Juan Sebastian Veron", clubs:["Lazio", "Manchester United", "Inter Milan", "Chelsea"], diff:"expert" },
  { name:"Clarence Seedorf", clubs:["Ajax", "Real Madrid", "Inter Milan", "AC Milan"], diff:"expert" },
  { name:"Patrick Vieira", clubs:["AC Milan", "Arsenal", "Juventus", "Inter Milan", "Manchester City"], diff:"expert" },
  { name:"Emmanuel Petit", clubs:["Monaco", "Arsenal", "Barcelona", "Chelsea"], diff:"expert" },
  { name:"Peter Crouch", clubs:["Aston Villa", "Southampton", "Liverpool", "Tottenham"], diff:"expert" },
  { name:"Gennaro Gattuso", clubs:["AC Milan", "Tottenham"], diff:"expert" },
  { name:"Roberto Baggio", clubs:["Fiorentina", "Juventus", "AC Milan", "Inter Milan", "Bologna"], diff:"expert" },
  { name:"Christian Vieri", clubs:["Lazio", "Inter Milan", "AC Milan"], diff:"expert" },
  { name:"Filippo Inzaghi", clubs:["Juventus", "AC Milan"], diff:"expert" },
  { name:"Fabio Cannavaro", clubs:["Napoli", "Parma", "Inter Milan", "Juventus", "Real Madrid"], diff:"expert" },
  { name:"Luca Toni", clubs:["Fiorentina", "Bayern Munich", "Roma", "Juventus"], diff:"expert" },
  { name:"Antonio Cassano", clubs:["Roma", "Real Madrid", "Sampdoria", "Inter Milan", "AC Milan"], diff:"expert" },
  { name:"Rui Costa", clubs:["Fiorentina", "AC Milan"], diff:"expert" },
  { name:"Deco", clubs:["Porto", "Barcelona", "Chelsea"], diff:"expert" },
  { name:"Nani", clubs:["Sporting CP", "Manchester United", "Valencia"], diff:"expert" },
  { name:"Wesley Sneijder", clubs:["Ajax", "Real Madrid", "Inter Milan", "Galatasaray"], diff:"expert" },
  { name:"Arjen Robben", clubs:["PSV", "Chelsea", "Real Madrid", "Bayern Munich"], diff:"expert" },
  { name:"Mark van Bommel", clubs:["PSV", "Barcelona", "Bayern Munich", "AC Milan"], diff:"expert" },
  { name:"Antony", clubs:["Ajax", "Manchester United"], diff:"expert" },
  { name:"Gleison Bremer", clubs:["Torino", "Juventus"], diff:"expert" },
  { name:"Alejandro Garnacho", clubs:["Manchester United"], diff:"expert" },
  { name:"Kobbie Mainoo", clubs:["Manchester United"], diff:"expert" },
  { name:"Dean Huijsen", clubs:["Juventus", "Roma", "Bournemouth", "Real Madrid"], diff:"expert" },
  { name:"Savinho", clubs:["Girona", "Manchester City"], diff:"expert" },
  { name:"Rayan Cherki", clubs:["Lyon", "Borussia Dortmund"], diff:"expert" },
  { name:"Warren Zaire-Emery", clubs:["PSG"], diff:"expert" },
  { name:"Desire Doue", clubs:["Rennes", "PSG"], diff:"expert" },
  { name:"Khephren Thuram", clubs:["Nice", "Juventus"], diff:"expert" },
  { name:"Manu Kone", clubs:["Borussia Monchengladbach", "Roma"], diff:"expert" },
  { name:"Youssouf Fofana", clubs:["Monaco", "AC Milan"], diff:"expert" },
  { name:"Adam Wharton", clubs:["Crystal Palace"], diff:"expert" },
  { name:"Jarrod Bowen", clubs:["West Ham"], diff:"expert" },
  { name:"Morgan Gibbs-White", clubs:["Wolverhampton", "Nottingham Forest"], diff:"expert" },
  { name:"Marcus Thuram", clubs:["Borussia Monchengladbach", "Inter Milan"], diff:"expert" },
  { name:"Endrick", clubs:["Palmeiras", "Real Madrid"], diff:"expert" },
  { name:"Diogo Dalot", clubs:["Porto", "AC Milan", "Manchester United"], diff:"expert" },
  { name:"Naby Keita", clubs:["RB Leipzig", "Liverpool", "Werder Bremen"], diff:"expert" },
  { name:"Thomas Partey", clubs:["Atletico Madrid", "Arsenal"], diff:"expert" },
  { name:"Fabinho", clubs:["Monaco", "Liverpool", "Al Ittihad"], diff:"expert" },
  { name:"Ivan Rakitic", clubs:["Sevilla", "Barcelona"], diff:"expert" },
  { name:"Christian Eriksen", clubs:["Tottenham", "Inter Milan", "Manchester United"], diff:"expert" },
  { name:"Matthijs de Ligt", clubs:["Ajax", "Juventus", "Bayern Munich", "Manchester United"], diff:"expert" },
  { name:"Diego Costa", clubs:["Atletico Madrid", "Chelsea"], diff:"expert" },
  { name:"Sacha Boey", clubs:["Galatasaray", "Bayern Munich"], diff:"expert" },
  { name:"Gerard Pique", clubs:["Manchester United", "Barcelona"], diff:"expert" },
  { name:"Lukas Podolski", clubs:["Bayern Munich", "Arsenal", "Inter Milan", "Galatasaray"], diff:"expert" },
  { name:"Michael Ballack", clubs:["Bayer Leverkusen", "Bayern Munich", "Chelsea"], diff:"expert" },
  { name:"Bastian Schweinsteiger", clubs:["Bayern Munich", "Manchester United"], diff:"expert" },
  { name:"Serge Gnabry", clubs:["Arsenal", "Bayern Munich"], diff:"expert" },
  { name:"Timo Werner", clubs:["RB Leipzig", "Chelsea", "Tottenham"], diff:"expert" },
  { name:"Andre Schurrle", clubs:["Bayer Leverkusen", "Chelsea", "Borussia Dortmund", "Wolfsburg"], diff:"expert" },
  // ── 2016-2026 ──
  { name:"Ederson", clubs:["Benfica", "Manchester City"], diff:"expert" },
  { name:"Alisson Becker", clubs:["Roma", "Liverpool"], diff:"moyen" },
  { name:"Marc-Andre ter Stegen", clubs:["Borussia Monchengladbach", "Barcelona"], diff:"moyen" },
  { name:"Kepa Arrizabalaga", clubs:["Athletic Bilbao", "Chelsea", "Real Madrid"], diff:"expert" },
  { name:"Andre Onana", clubs:["Ajax", "Inter Milan", "Manchester United"], diff:"expert" },
  { name:"Mike Maignan", clubs:["Lille", "AC Milan"], diff:"moyen" },
  { name:"Gregor Kobel", clubs:["Stuttgart", "Borussia Dortmund"], diff:"expert" },
  { name:"Trent Alexander-Arnold", clubs:["Liverpool", "Real Madrid"], diff:"moyen" },
  { name:"Reece James", clubs:["Chelsea"], diff:"expert" },
  { name:"Achraf Hakimi", clubs:["Real Madrid", "Borussia Dortmund", "Inter Milan", "PSG"], diff:"moyen" },
  { name:"Ferland Mendy", clubs:["Lyon", "Real Madrid"], diff:"expert" },
  { name:"Alphonso Davies", clubs:["Vancouver Whitecaps", "Bayern Munich"], diff:"moyen" },
  { name:"Josko Gvardiol", clubs:["Dinamo Zagreb", "RB Leipzig", "Manchester City"], diff:"moyen" },
  { name:"Ibrahima Konate", clubs:["RC Lens", "RB Leipzig", "Liverpool"], diff:"expert" },
  { name:"Kim Min-jae", clubs:["Fenerbahce", "Napoli", "Bayern Munich"], diff:"expert" },
  { name:"Pau Torres", clubs:["Villarreal", "Aston Villa"], diff:"expert" },
  { name:"Jurrien Timber", clubs:["Ajax", "Arsenal"], diff:"expert" },
  { name:"Leny Yoro", clubs:["Lille", "Manchester United"], diff:"expert" },
  { name:"Dominik Szoboszlai", clubs:["Salzburg", "RB Leipzig", "Liverpool"], diff:"moyen" },
  { name:"Phil Foden", clubs:["Manchester City"], diff:"facile" },
  { name:"Bruno Guimaraes", clubs:["Athletico Paranaense", "Lyon", "Newcastle"], diff:"expert" },
  { name:"Xavi Simons", clubs:["PSG", "PSV", "RB Leipzig"], diff:"moyen" },
  { name:"Arda Guler", clubs:["Fenerbahce", "Real Madrid"], diff:"expert" },
  { name:"Christopher Nkunku", clubs:["PSG", "RB Leipzig", "Chelsea"], diff:"moyen" },
  { name:"Evan Ferguson", clubs:["Brighton"], diff:"expert" },
  { name:"Franco Mastantuono", clubs:["River Plate", "Real Madrid"], diff:"expert" },
  { name:"Joao Neves", clubs:["Benfica", "PSG"], diff:"expert" },
  { name:"Nuno Mendes", clubs:["Sporting CP", "PSG"], diff:"expert" },
  { name:"Ivan Toney", clubs:["Brentford", "Al Ahli"], diff:"expert" },
,
  { name:"Vinicius Jr", clubs:["Real Madrid"], diff:"facile" },
  { name:"Bukayo Saka", clubs:["Arsenal"], diff:"facile" },
  { name:"Federico Valverde", clubs:["Real Madrid"], diff:"facile" },
  { name:"Thibaut Courtois", clubs:["Chelsea", "Real Madrid"], diff:"facile" },
  { name:"Alisson", clubs:["Roma", "Liverpool"], diff:"facile" },
  { name:"Joshua Kimmich", clubs:["Bayern Munich"], diff:"facile" },
  { name:"Romelu Lukaku", clubs:["Manchester United", "Chelsea", "Inter Milan", "Roma", "Napoli"], diff:"facile" },
  { name:"Son Heung-min", clubs:["Tottenham"], diff:"facile" },
  { name:"Carlos Puyol", clubs:["Barcelona"], diff:"moyen" },
  { name:"Carles Puyol", clubs:["Barcelona"], diff:"moyen" },
  { name:"Falcao", clubs:["Porto", "Atletico Madrid", "Monaco", "Manchester United", "Chelsea"], diff:"moyen" },
  { name:"Samir Nasri", clubs:["Marseille", "Arsenal", "Manchester City"], diff:"moyen" },
  { name:"Bacary Sagna", clubs:["Arsenal", "Manchester City"], diff:"moyen" },
  { name:"Nicolas Anelka", clubs:["Arsenal", "Real Madrid", "PSG", "Manchester City", "Chelsea", "Bolton"], diff:"moyen" },
  { name:"Sylvain Wiltord", clubs:["Bordeaux", "Arsenal"], diff:"moyen" },
  { name:"Marc Overmars", clubs:["Ajax", "Arsenal", "Barcelona"], diff:"moyen" },
  { name:"Robert Pires", clubs:["Arsenal", "Marseille", "Villarreal"], diff:"moyen" },
  { name:"Claude Makelele", clubs:["Real Madrid", "Chelsea"], diff:"moyen" },
  { name:"Peter Cech", clubs:["Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Didier Deschamps", clubs:["Juventus", "Chelsea", "Monaco"], diff:"moyen" },
  { name:"Marcel Desailly", clubs:["Marseille", "AC Milan", "Chelsea"], diff:"moyen" },
  { name:"Lilian Thuram", clubs:["Monaco", "Parma", "Juventus", "Barcelona"], diff:"moyen" },
  { name:"William Gallas", clubs:["Chelsea", "Arsenal", "Tottenham"], diff:"moyen" },
  { name:"Frederic Kanoute", clubs:["West Ham", "Tottenham", "Sevilla"], diff:"moyen" },
  { name:"Yaya Toure", clubs:["Monaco", "Barcelona", "Manchester City"], diff:"moyen" },
  { name:"Kolo Toure", clubs:["Arsenal", "Manchester City", "Liverpool"], diff:"moyen" },
  { name:"Mikel Essien", clubs:["Lyon", "Chelsea"], diff:"moyen" },
  { name:"Oliver Kahn", clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Karl-Heinz Riedle", clubs:["Borussia Dortmund", "Liverpool"], diff:"moyen" },
  { name:"Stefan Effenberg", clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Lothar Matthaus", clubs:["Bayern Munich", "Inter Milan"], diff:"moyen" },
  { name:"Jürgen Klinsmann", clubs:["Bayern Munich", "Tottenham"], diff:"moyen" },
  { name:"Alessandro Nesta", clubs:["Lazio", "AC Milan"], diff:"moyen" },
  { name:"Paolo Maldini", clubs:["AC Milan"], diff:"moyen" },
  { name:"Franco Baresi", clubs:["AC Milan"], diff:"moyen" },
  { name:"Andrea Pirlo", clubs:["Inter Milan", "AC Milan", "Juventus", "New York City FC"], diff:"moyen" },
  { name:"Dida", clubs:["AC Milan"], diff:"moyen" },
  { name:"Rivaldo", clubs:["Barcelona", "AC Milan"], diff:"moyen" },
  { name:"Cafu", clubs:["Roma", "AC Milan"], diff:"moyen" },
  { name:"Roberto Carlos", clubs:["Real Madrid", "Fenerbahce"], diff:"moyen" },
  { name:"Lucio", clubs:["Bayer Leverkusen", "Bayern Munich", "Inter Milan"], diff:"moyen" },
  { name:"Luis Figo", clubs:["Sporting CP", "Barcelona", "Real Madrid", "Inter Milan"], diff:"moyen" },
  { name:"Simao Sabrosa", clubs:["Barcelona", "Atletico Madrid", "Besiktas"], diff:"moyen" },
  { name:"Raul", clubs:["Real Madrid", "Schalke"], diff:"moyen" },
  { name:"Fernando Hierro", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Emilio Butragueno", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Jamie Carragher", clubs:["Liverpool"], diff:"moyen" },
  { name:"Robbie Fowler", clubs:["Liverpool", "Manchester City"], diff:"moyen" },
  { name:"Kevin Keegan", clubs:["Liverpool", "Newcastle"], diff:"moyen" },
  { name:"Peter Schmeichel", clubs:["Manchester United"], diff:"moyen" },
  { name:"Roy Keane", clubs:["Manchester United", "Celtic"], diff:"moyen" },
  { name:"Paul Scholes", clubs:["Manchester United"], diff:"moyen" },
  { name:"Gary Neville", clubs:["Manchester United"], diff:"moyen" },
  { name:"Ole Gunnar Solskjaer", clubs:["Manchester United"], diff:"moyen" },
  { name:"Teddy Sheringham", clubs:["Manchester United", "Tottenham"], diff:"moyen" },
  { name:"Andy Cole", clubs:["Manchester United", "Newcastle", "Blackburn"], diff:"moyen" },
  { name:"Dwight Yorke", clubs:["Manchester United", "Aston Villa"], diff:"moyen" },
  { name:"Nwankwo Kanu", clubs:["Ajax", "Inter Milan", "Arsenal", "West Brom"], diff:"moyen" },
  { name:"Abedi Pele", clubs:["Marseille"], diff:"moyen" },
  { name:"George Weah", clubs:["Marseille", "PSG", "AC Milan", "Chelsea"], diff:"moyen" },
  { name:"Jay-Jay Okocha", clubs:["PSG", "Bolton"], diff:"moyen" },
  { name:"El Hadji Diouf", clubs:["Lens", "Liverpool", "Bolton"], diff:"moyen" },
  { name:"Hasan Salihamidzic", clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Oliver Neuville", clubs:["Borussia Dortmund", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Alessandro Del Piero", clubs:["Juventus"], diff:"moyen" },
  { name:"Francesco Totti", clubs:["Roma"], diff:"moyen" },
  { name:"Javier Zanetti", clubs:["Inter Milan"], diff:"moyen" },
  { name:"Nicola Ventola", clubs:["Bari", "Inter Milan", "Atalanta"], diff:"moyen" },
  { name:"Boudewijn Zenden", clubs:["Barcelona", "Chelsea", "Liverpool", "Marseille"], diff:"moyen" },
  { name:"Marc Wilmots", clubs:["Schalke", "Inter Milan"], diff:"moyen" },
  { name:"Johan Cruyff", clubs:["Ajax", "Barcelona"], diff:"moyen" },
  { name:"Marco van Basten", clubs:["Ajax", "AC Milan"], diff:"moyen" },
  { name:"Ruud Gullit", clubs:["AC Milan", "Chelsea"], diff:"moyen" },
  { name:"Frank Rijkaard", clubs:["Ajax", "AC Milan"], diff:"moyen" },
  { name:"Ronald Koeman", clubs:["Ajax", "Barcelona"], diff:"moyen" },
  { name:"Romario", clubs:["Barcelona", "PSV"], diff:"moyen" },
  { name:"Bebeto", clubs:["Deportivo", "Sevilla"], diff:"moyen" },
  { name:"Denilson", clubs:["Real Betis", "Bordeaux"], diff:"moyen" },
  { name:"Rui Patricio", clubs:["Sporting CP", "Wolves", "Roma"], diff:"moyen" },
  { name:"Pepe Reina", clubs:["Barcelona", "Villarreal", "Liverpool", "Napoli"], diff:"moyen" },
  { name:"Kevin Gameiro", clubs:["Lorient", "PSG", "Sevilla", "Atletico Madrid", "Valencia"], diff:"expert" },
  { name:"Djibril Cisse", clubs:["Auxerre", "Liverpool", "Marseille"], diff:"expert" },
  { name:"Nicolas Mahut", clubs:["Angers"], diff:"expert" },
  { name:"Youri Djorkaeff", clubs:["PSG", "Inter Milan", "Bolton"], diff:"expert" },
  { name:"Mirandinha", clubs:["Newcastle"], diff:"expert" },
  { name:"Jonathan Woodgate", clubs:["Real Madrid", "Newcastle", "Tottenham"], diff:"expert" },
  { name:"Sean Wright-Phillips", clubs:["Manchester City", "Chelsea"], diff:"expert" },
  { name:"Mikael Silvestre", clubs:["Manchester United", "Arsenal"], diff:"expert" },
  { name:"Quinton Fortune", clubs:["Manchester United", "Atletico Madrid"], diff:"expert" },
  { name:"Luke Chadwick", clubs:["Manchester United"], diff:"expert" },
  { name:"Corentin Tolisso", clubs:["Lyon", "Bayern Munich"], diff:"expert" },
  { name:"Mathieu Valbuena", clubs:["Marseille", "Lyon", "Fenerbahce"], diff:"expert" },
  { name:"Hatem Ben Arfa", clubs:["Lyon", "Marseille", "Newcastle", "Nice", "PSG"], diff:"expert" },
  { name:"Frederic Piquionne", clubs:["Monaco", "Lyon"], diff:"expert" },
  { name:"Mahamadou Diarra", clubs:["Lyon", "Real Madrid", "Atletico Madrid"], diff:"expert" },
  { name:"Juninho", clubs:["Lyon", "Atletico Madrid"], diff:"expert" },
  { name:"Sidney Govou", clubs:["Lyon"], diff:"expert" },
  { name:"Gregory Coupet", clubs:["Lyon"], diff:"expert" },
  { name:"Remi Garde", clubs:["Lyon", "Arsenal"], diff:"expert" },
  { name:"Claudio Pizarro", clubs:["Werder Bremen", "Bayern Munich", "Chelsea"], diff:"expert" },
  { name:"Stephane Dalmat", clubs:["PSG", "Inter Milan", "Tottenham"], diff:"expert" },
  { name:"David Rozehnal", clubs:["PSG", "Newcastle"], diff:"expert" },
  { name:"Noe Pamarot", clubs:["Tottenham", "Nice"], diff:"expert" },
  { name:"Gael Clichy", clubs:["Arsenal", "Manchester City"], diff:"expert" },
  { name:"Johan Djourou", clubs:["Arsenal"], diff:"expert" },
  { name:"Justin Hoyte", clubs:["Arsenal"], diff:"expert" },
  { name:"Jan Kirchhoff", clubs:["Bayern Munich", "Manchester City", "Sunderland"], diff:"expert" },
  { name:"Pierre Webo", clubs:["Mallorca", "Atletico Madrid"], diff:"expert" },
  { name:"Mutu", clubs:["Parma", "Chelsea", "Fiorentina"], diff:"expert" },
  { name:"Bogdan Lobont", clubs:["Ajax", "Roma"], diff:"expert" },
  { name:"Bogdan Stancu", clubs:["Galatasaray"], diff:"expert" },
  { name:"Chidi Odiah", clubs:["CSKA Moscow"], diff:"expert" },
  { name:"Thierry Henry", clubs:["Monaco", "Juventus", "Arsenal", "Barcelona", "New York Red Bulls"], diff:"facile" },
  { name:"Emmanuel Adebayor", clubs:["Monaco", "Arsenal", "Manchester City", "Real Madrid", "Tottenham"], diff:"moyen" },
  { name:"Nicolas Bendtner", clubs:["Arsenal", "Juventus"], diff:"expert" },
  { name:"Sylvain Distin", clubs:["Manchester City", "Everton"], diff:"expert" },
  { name:"Abdoulaye Meite", clubs:["Monaco", "Marseille", "Bolton"], diff:"expert" }
,
  { name:"Gabri Veiga", clubs:["Celta Vigo", "Al Qadsiah"], diff:"facile" },
  { name:"Ben White", clubs:["Arsenal"], diff:"facile" },
  { name:"Gabriel Magalhaes", clubs:["Lille", "Arsenal"], diff:"facile" },
  { name:"David Raya", clubs:["Brentford", "Arsenal"], diff:"facile" },
  { name:"Alexander Isak", clubs:["Borussia Dortmund", "Real Sociedad", "Newcastle"], diff:"facile" },
  { name:"Darwin Nunez", clubs:["Benfica", "Liverpool"], diff:"facile" },
  { name:"Luis Diaz", clubs:["Porto", "Liverpool"], diff:"facile" },
  { name:"Cody Gakpo", clubs:["PSV", "Liverpool"], diff:"facile" },
  { name:"Ryan Gravenberch", clubs:["Ajax", "Bayern Munich", "Liverpool"], diff:"facile" },
  { name:"Antonio Rudiger", clubs:["Stuttgart", "Roma", "Chelsea", "Real Madrid"], diff:"facile" },
  { name:"Fabian Ruiz", clubs:["Napoli", "PSG"], diff:"facile" },
  { name:"Marco Asensio", clubs:["Real Madrid", "PSG"], diff:"facile" },
  { name:"Milan Skriniar", clubs:["Inter Milan", "PSG"], diff:"facile" },
  { name:"Hakan Calhanoglu", clubs:["AC Milan", "Inter Milan"], diff:"facile" },
  { name:"Stefan de Vrij", clubs:["Lazio", "Inter Milan"], diff:"facile" },
  { name:"Alessandro Bastoni", clubs:["Inter Milan"], diff:"facile" },
  { name:"Ansu Fati", clubs:["Barcelona"], diff:"facile" },
  { name:"Ferran Torres", clubs:["Valencia", "Manchester City", "Barcelona"], diff:"facile" },
  { name:"Alexis Sanchez", clubs:["Udinese", "Barcelona", "Arsenal", "Manchester United", "Inter Milan", "Marseille"], diff:"facile" },
  { name:"Mesut Ozil", clubs:["Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahce"], diff:"moyen" },
  { name:"Per Mertesacker", clubs:["Werder Bremen", "Arsenal"], diff:"moyen" },
  { name:"Lars Bender", clubs:["Bayer Leverkusen"], diff:"moyen" },
  { name:"Sven Bender", clubs:["Borussia Dortmund", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Sergio Aguero", clubs:["Atletico Madrid", "Manchester City", "Barcelona"], diff:"moyen" },
  { name:"Javier Mascherano", clubs:["Liverpool", "Barcelona"], diff:"moyen" },
  { name:"Goran Pandev", clubs:["Lazio", "Inter Milan", "Napoli", "Genoa"], diff:"moyen" },
  { name:"Diego Milito", clubs:["Genoa", "Inter Milan"], diff:"moyen" },
  { name:"Esteban Cambiasso", clubs:["Real Madrid", "Inter Milan"], diff:"moyen" },
  { name:"Julio Cesar", clubs:["Inter Milan"], diff:"moyen" },
  { name:"Maicon", clubs:["Monaco", "Inter Milan"], diff:"moyen" },
  { name:"Samuel Eto'o", clubs:["Barcelona", "Inter Milan", "Chelsea", "Everton"], diff:"moyen" },
  { name:"Sulley Muntari", clubs:["Udinese", "Portsmouth", "Inter Milan", "AC Milan"], diff:"moyen" },
  { name:"Dejan Stankovic", clubs:["Lazio", "Inter Milan"], diff:"moyen" },
  { name:"Ivan Cordoba", clubs:["Inter Milan"], diff:"moyen" },
  { name:"Robinho", clubs:["Real Madrid", "Manchester City", "AC Milan", "Santos"], diff:"moyen" },
  { name:"Jo", clubs:["CSKA Moscow", "Manchester City", "Everton"], diff:"moyen" },
  { name:"Elano", clubs:["Shakhtar", "Manchester City", "Galatasaray"], diff:"moyen" },
  { name:"Vedran Corluka", clubs:["Manchester City", "Tottenham"], diff:"moyen" },
  { name:"Robbie Keane", clubs:["Tottenham", "Liverpool", "LA Galaxy"], diff:"moyen" },
  { name:"Jermain Defoe", clubs:["Tottenham", "Portsmouth"], diff:"moyen" },
  { name:"Ledley King", clubs:["Tottenham"], diff:"moyen" },
  { name:"Michael Carrick", clubs:["Tottenham", "Manchester United"], diff:"moyen" },
  { name:"Darren Bent", clubs:["Tottenham", "Sunderland", "Aston Villa"], diff:"moyen" },
  { name:"Pascal Chimbonda", clubs:["Wigan", "Tottenham"], diff:"moyen" },
  { name:"Niko Kranjcar", clubs:["Tottenham", "Portsmouth"], diff:"moyen" },
  { name:"Dimitar Berbatov", clubs:["Bayer Leverkusen", "Tottenham", "Manchester United"], diff:"moyen" },
  { name:"Kyle Walker", clubs:["Tottenham", "Manchester City"], diff:"moyen" },
  { name:"Hugo Lloris", clubs:["Lyon", "Tottenham"], diff:"moyen" },
  { name:"Jan Vertonghen", clubs:["Ajax", "Tottenham", "Benfica"], diff:"moyen" },
  { name:"Toby Alderweireld", clubs:["Ajax", "Atletico Madrid", "Tottenham"], diff:"moyen" },
  { name:"Mousa Dembele", clubs:["Tottenham", "Fulham"], diff:"moyen" },
  { name:"Victor Wanyama", clubs:["Celtic", "Southampton", "Tottenham"], diff:"moyen" },
  { name:"Dele Alli", clubs:["Tottenham", "Everton"], diff:"moyen" },
  { name:"Eric Dier", clubs:["Sporting CP", "Tottenham", "Bayern Munich"], diff:"moyen" },
  { name:"Moussa Sissoko", clubs:["Newcastle", "Tottenham"], diff:"moyen" },
  { name:"Rafael van der Vaart", clubs:["Ajax", "Real Madrid", "Tottenham"], diff:"moyen" },
  { name:"Wilson Palacios", clubs:["Wigan", "Tottenham", "Stoke"], diff:"moyen" },
  { name:"Nabil Fekir", clubs:["Lyon", "Real Betis"], diff:"moyen" },
  { name:"Morgan Schneiderlin", clubs:["Southampton", "Manchester United", "Everton"], diff:"moyen" },
  { name:"Victor Moses", clubs:["Chelsea", "Fenerbahce", "Spartak Moscow", "Inter Milan"], diff:"moyen" },
  { name:"Willian", clubs:["Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Oscar", clubs:["Chelsea", "Shanghai SIPG"], diff:"moyen" },
  { name:"John Obi Mikel", clubs:["Chelsea", "Trabzonspor"], diff:"moyen" },
  { name:"Ramires", clubs:["Benfica", "Chelsea", "Jiangsu Suning"], diff:"moyen" },
  { name:"David Luiz", clubs:["Benfica", "Chelsea", "PSG", "Arsenal"], diff:"moyen" },
  { name:"Gary Cahill", clubs:["Bolton", "Chelsea", "Crystal Palace"], diff:"moyen" },
  { name:"Branislav Ivanovic", clubs:["Chelsea", "West Brom"], diff:"moyen" },
  { name:"Ryan Bertrand", clubs:["Chelsea", "Southampton"], diff:"moyen" },
  { name:"Michael Essien", clubs:["Bastia", "Lyon", "Chelsea"], diff:"moyen" },
  { name:"Shaun Wright-Phillips", clubs:["Manchester City", "Chelsea"], diff:"moyen" },
  { name:"Joe Cole", clubs:["West Ham", "Chelsea", "Liverpool"], diff:"moyen" },
  { name:"Florent Malouda", clubs:["Guingamp", "Lyon", "Chelsea"], diff:"moyen" },
  { name:"Andriy Shevchenko", clubs:["Dynamo Kyiv", "AC Milan", "Chelsea"], diff:"moyen" },
  { name:"Salomon Kalou", clubs:["Chelsea", "Lille", "Hertha Berlin"], diff:"moyen" },
  { name:"Gus Poyet", clubs:["Chelsea", "Tottenham"], diff:"moyen" },
  { name:"Robert Huth", clubs:["Chelsea", "Stoke", "Leicester"], diff:"moyen" },
  { name:"Paulo Ferreira", clubs:["Porto", "Chelsea"], diff:"moyen" },
  { name:"Steve Sidwell", clubs:["Chelsea", "Aston Villa", "Fulham"], diff:"moyen" },
  { name:"Freddy Adu", clubs:["DC United", "Real Sociedad", "Benfica"], diff:"expert" },
  { name:"Jaroslaw Bieniuk", clubs:["Legia Warsaw"], diff:"expert" },
  { name:"Eidur Gudjohnsen", clubs:["Chelsea", "Barcelona", "Monaco"], diff:"expert" },
  { name:"Celestine Babayaro", clubs:["Ajax", "Newcastle"], diff:"expert" },
  { name:"Nii Lamptey", clubs:["PSV", "Aston Villa"], diff:"expert" },
  { name:"Paul Furlong", clubs:["Chelsea", "Birmingham City"], diff:"expert" },
  { name:"Scott Parker", clubs:["Chelsea", "Newcastle", "Tottenham"], diff:"expert" },
  { name:"Glen Johnson", clubs:["Chelsea", "Liverpool"], diff:"expert" },
  { name:"Carlton Cole", clubs:["Chelsea", "West Ham"], diff:"expert" },
  { name:"Mikael Forssell", clubs:["Chelsea", "Birmingham City"], diff:"expert" },
  { name:"Jimmy Floyd Hasselbaink", clubs:["Atletico Madrid", "Chelsea"], diff:"expert" },
  { name:"Slavisa Jokanovic", clubs:["Chelsea", "Deportivo"], diff:"expert" },
  { name:"Winston Bogarde", clubs:["Ajax", "AC Milan", "Chelsea"], diff:"expert" },
  { name:"Mario Melchiot", clubs:["Ajax", "Chelsea"], diff:"expert" },
  { name:"Enrique De Lucas", clubs:["Chelsea", "Espanyol"], diff:"expert" },
  { name:"Jody Morris", clubs:["Chelsea"], diff:"expert" },
  { name:"Samassi Abou", clubs:["West Ham", "Chelsea"], diff:"expert" },
  { name:"Muzzy Izzet", clubs:["Chelsea", "Leicester"], diff:"expert" },
  { name:"Neil Clement", clubs:["Chelsea", "West Brom"], diff:"expert" },
  { name:"Thor Gudjonsson", clubs:["Leicester", "Bayer Leverkusen"], diff:"expert" },
  { name:"David Grondin", clubs:["Arsenal", "Saint-Etienne"], diff:"expert" },
  { name:"Alberto Mendez", clubs:["Arsenal"], diff:"expert" },
  { name:"Igors Stepanovs", clubs:["Arsenal"], diff:"expert" },
  { name:"Pascal Cygan", clubs:["Lille", "Arsenal"], diff:"expert" },
  { name:"Jerome Thomas", clubs:["Arsenal", "West Brom"], diff:"expert" },
  { name:"Quincy Owusu-Abeyie", clubs:["Arsenal", "Spartak Moscow"], diff:"expert" },
  { name:"Jeremie Aliadiere", clubs:["Arsenal", "Middlesbrough"], diff:"expert" },
  { name:"Francis Jeffers", clubs:["Arsenal", "Everton"], diff:"expert" },
  { name:"Stathis Tavlaridis", clubs:["Arsenal", "Lille"], diff:"expert" },
  { name:"Moritz Volz", clubs:["Arsenal", "Fulham"], diff:"expert" },
  { name:"Stuart Taylor", clubs:["Arsenal", "Aston Villa"], diff:"expert" },
  { name:"Graham Stack", clubs:["Arsenal"], diff:"expert" },
  { name:"Rohan Ricketts", clubs:["Arsenal", "Tottenham"], diff:"expert" },
  { name:"Mark Randall", clubs:["Arsenal"], diff:"expert" },
  { name:"Craig Eastmond", clubs:["Arsenal", "Southend"], diff:"expert" },
  { name:"Nico Yennaris", clubs:["Arsenal"], diff:"expert" },
  { name:"Vito Mannone", clubs:["Arsenal", "Sunderland"], diff:"expert" },
  { name:"Sanchez Watt", clubs:["Arsenal"], diff:"expert" },
  { name:"Henri Lansbury", clubs:["Arsenal", "Nottingham Forest"], diff:"expert" },
  { name:"Daniel Boateng", clubs:["Arsenal"], diff:"expert" },
  { name:"Kyle Bartley", clubs:["Arsenal", "Swansea"], diff:"expert" },
  { name:"Jay Emmanuel-Thomas", clubs:["Arsenal", "Ipswich"], diff:"expert" },
  { name:"Nacer Barazite", clubs:["Arsenal", "Twente"], diff:"expert" }
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
  const MAX_PAIRS_PER_PLAYER = { facile: 6, moyen: 5, expert: 5 };

  for (const p of PLAYERS) {
    if (!p || !p.clubs) continue;
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
  if (!p || !p.clubs) continue;
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


// ── CLUB LOGOS (TheSportsDB) ──
const LOGO_CACHE = {};
// Direct logo URLs from Wikipedia (SVG/PNG badges)
const CLUB_LOGO_URLS = {
  "Manchester United": "https://crests.football-data.org/66.svg",
  "Manchester City": "https://crests.football-data.org/65.svg",
  "Real Madrid": "https://crests.football-data.org/86.svg",
  "Barcelona": "https://crests.football-data.org/81.svg",
  "Atletico Madrid": "https://crests.football-data.org/78.svg",
  "AC Milan": "https://crests.football-data.org/98.svg",
  "Inter Milan": "https://crests.football-data.org/108.svg",
  "Bayern Munich": "https://crests.football-data.org/5.svg",
  "Borussia Dortmund": "https://crests.football-data.org/4.svg",
  "PSG": "https://crests.football-data.org/524.svg",
  "Juventus": "https://crests.football-data.org/109.svg",
  "Liverpool": "https://crests.football-data.org/64.svg",
  "Chelsea": "https://crests.football-data.org/61.svg",
  "Arsenal": "https://crests.football-data.org/57.svg",
  "Tottenham": "https://crests.football-data.org/73.svg",
  "Napoli": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/SSC_Napoli_logo.svg/200px-SSC_Napoli_logo.svg.png",
  "Roma": "https://a.espncdn.com/i/teamlogos/soccer/500/104.png",
  "Lazio": "https://crests.football-data.org/110.svg",
  "Fiorentina": "https://upload.wikimedia.org/wikipedia/commons/a/a4/ACF_Fiorentina_logo_2022.png",
  "Atalanta": "https://upload.wikimedia.org/wikipedia/en/6/66/AtalantaBC.svg",
  "Bayer Leverkusen": "https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg",
  "RB Leipzig": "https://upload.wikimedia.org/wikipedia/en/0/04/RB_Leipzig_2014_logo.svg",
  "Eintracht Frankfurt": "https://upload.wikimedia.org/wikipedia/commons/0/04/Eintracht_Frankfurt_Logo.svg",
  "Sevilla": "https://crests.football-data.org/559.svg",
  "Valencia": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/200px-Valenciacf.svg.png",
  "Villarreal": "https://crests.football-data.org/449.svg",
  "Athletic Bilbao": "https://upload.wikimedia.org/wikipedia/en/9/98/Club_Athletic_de_Bilbao_logo.svg",
  "Real Betis": "https://upload.wikimedia.org/wikipedia/en/1/13/Real_betis_logo.svg",
  "Marseille": "https://crests.football-data.org/516.svg",
  "Lyon": "https://crests.football-data.org/523.svg",
  "Monaco": "https://upload.wikimedia.org/wikipedia/en/thumb/e/ea/AS_Monaco_FC.svg/200px-AS_Monaco_FC.svg.png",
  "Lille": "https://crests.football-data.org/521.svg",
  "Benfica": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/SL_Benfica_logo.svg/200px-SL_Benfica_logo.svg.png",
  "Porto": "https://upload.wikimedia.org/wikipedia/en/thumb/3/36/FC_Porto.svg/200px-FC_Porto.svg.png",
  "Sporting CP": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f8/Sporting_CP_%E2%80%93_Logo.svg/200px-Sporting_CP_%E2%80%93_Logo.svg.png",
  "Ajax": "https://crests.football-data.org/678.svg",
  "Newcastle": "https://crests.football-data.org/67.svg",
  "Everton": "https://crests.football-data.org/62.svg",
  "West Ham": "https://crests.football-data.org/563.svg",
  "Aston Villa": "https://upload.wikimedia.org/wikipedia/en/f/f9/Aston_Villa_FC_crest_%282016%29.svg",
  "Leicester City": "https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg",
  "Galatasaray": "https://crests.football-data.org/2007.svg",
  "Borussia Monchengladbach": "https://upload.wikimedia.org/wikipedia/commons/8/81/Borussia_M%C3%B6nchengladbach_logo.svg",
  "Schalke": "https://upload.wikimedia.org/wikipedia/commons/6/6d/FC_Schalke_04_Logo.svg",
  "Werder Bremen": "https://upload.wikimedia.org/wikipedia/en/8/8f/SV_Werder_Bremen.svg",
  "Wolfsburg": "https://upload.wikimedia.org/wikipedia/en/c/ce/VfL_Wolfsburg_Logo.svg",
  "Rennes": "https://crests.football-data.org/529.svg",
  "Fenerbahce": "https://upload.wikimedia.org/wikipedia/en/e/e4/Fenerbahce.svg",
  "Besiktas": "https://upload.wikimedia.org/wikipedia/commons/9/98/Be%C5%9Fikta%C5%9F_JK_logo.svg",
  "Brentford": "https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg",
  "Brighton": "https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg",
  "Crystal Palace": "https://upload.wikimedia.org/wikipedia/en/0/0c/Crystal_Palace_FC_logo.svg",
  "Wolverhampton": "https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg",
  "Southampton": "https://upload.wikimedia.org/wikipedia/en/c/c9/FC_Southampton.svg",
  "Leeds United": "https://upload.wikimedia.org/wikipedia/en/5/54/Leeds_United_F.C._logo.svg",
  "Sunderland": "https://upload.wikimedia.org/wikipedia/en/7/77/Logo_Sunderland.svg",
  "Nottingham Forest": "https://upload.wikimedia.org/wikipedia/en/e/e5/Nottingham_Forest_F.C._logo.svg",
  "Girona": "https://upload.wikimedia.org/wikipedia/en/6/6e/Girona_FC_logo.svg",
  "Real Sociedad": "https://crests.football-data.org/92.svg",
  "PSV": "https://upload.wikimedia.org/wikipedia/en/0/05/PSV_Eindhoven.svg",
  "Al Nassr": "https://upload.wikimedia.org/wikipedia/en/d/d2/Al-Nassr_FC_Logo.svg",
  "Al Hilal": "https://upload.wikimedia.org/wikipedia/en/3/36/Al-Hilal_Saudi_Club_Logo.svg",
  "Al Ittihad": "https://upload.wikimedia.org/wikipedia/en/9/9b/Al-Ittihad_Club_Logo.svg",
  "Inter Miami": "https://upload.wikimedia.org/wikipedia/en/3/37/Logo_of_Inter_Miami_CF.svg",
  "Los Angeles FC": "https://upload.wikimedia.org/wikipedia/en/3/37/Los_Angeles_FC_logo.svg",
  "Al Ahli": "https://upload.wikimedia.org/wikipedia/en/c/cd/Al-Ahli_Saudi_FC.png",
  "Al Arabi": "https://upload.wikimedia.org/wikipedia/en/8/85/Al-Arabi_SC_%28Qatar%29_logo.svg",
  "Al Ettifaq": "https://upload.wikimedia.org/wikipedia/en/a/a3/Al_Ettifaq_FC.svg",
  "Al-Sadd": "https://upload.wikimedia.org/wikipedia/en/1/10/Al_Sadd_SC_logo.svg",
  "Athletico Paranaense": "https://upload.wikimedia.org/wikipedia/en/7/77/Athletico_Paranaense_logo.svg",
  "Basel": "https://upload.wikimedia.org/wikipedia/en/2/2a/FC_Basel_Logo.svg",
  "Birmingham City": "https://upload.wikimedia.org/wikipedia/en/6/68/Birmingham_City_FC_logo.svg",
  "Boca Juniors": "https://a.espncdn.com/i/teamlogos/soccer/500/2048.png",
  "Bologna": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Bologna_FC_1909_logo.svg",
  "Bordeaux": "https://a.espncdn.com/i/teamlogos/soccer/500/181.png",
  "Bournemouth": "https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg",
  "Cagliari": "https://upload.wikimedia.org/wikipedia/en/7/74/Cagliari_Calcio_1920_logo.svg",
  "Celtic": "https://crests.football-data.org/732.svg",
  "Coventry City": "https://upload.wikimedia.org/wikipedia/en/4/40/Coventry_City_FC_logo.svg",
  "Dinamo Zagreb": "https://upload.wikimedia.org/wikipedia/en/4/47/GNK_Dinamo_Zagreb_Logo.svg",
  "Flamengo": "https://a.espncdn.com/i/teamlogos/soccer/500/1956.png",
  "Gent": "https://upload.wikimedia.org/wikipedia/en/e/e5/KAA_Gent_logo.svg",
  "Guingamp": "https://upload.wikimedia.org/wikipedia/en/1/13/En_Avant_Guingamp_logo.svg",
  "Hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Logo_TSG_Hoffenheim.svg",
  "Hull City": "https://upload.wikimedia.org/wikipedia/en/5/54/Hull_City_A.F.C._logo.svg",
  "Ituano": "https://upload.wikimedia.org/wikipedia/en/4/41/Ituano_FC.svg",
  "LA Galaxy": "https://upload.wikimedia.org/wikipedia/en/8/85/LA_Galaxy_logo.svg",
  "Las Palmas": "https://upload.wikimedia.org/wikipedia/en/5/5e/UD_Las_Palmas_logo.svg",
  "Le Havre": "https://upload.wikimedia.org/wikipedia/en/a/a4/HAC_logo.svg",
  "Le Mans": "https://upload.wikimedia.org/wikipedia/en/0/0b/Le_Mans_FC_logo.svg",
  "Lens": "https://crests.football-data.org/546.svg",
  "Malaga": "https://upload.wikimedia.org/wikipedia/en/6/6d/Malaga_CF.svg",
  "Mallorca": "https://upload.wikimedia.org/wikipedia/en/e/e9/Real_Club_Deportivo_Mallorca.svg",
  "Metz": "https://upload.wikimedia.org/wikipedia/en/c/c3/FC_Metz_logo.svg",
  "Molde": "https://upload.wikimedia.org/wikipedia/en/1/10/Molde_FK_logo.svg",
  "Montpellier": "https://crests.football-data.org/514.svg",
  "Nantes": "https://crests.football-data.org/543.svg",
  "Nice": "https://crests.football-data.org/522.svg",
  "Palermo": "https://upload.wikimedia.org/wikipedia/en/5/5c/Palermo_FC_logo.svg",
  "Palmeiras": "https://upload.wikimedia.org/wikipedia/en/1/10/Palmeiras_logo.svg",
  "Parma": "https://upload.wikimedia.org/wikipedia/en/e/e0/Parma_Calcio_1913_%28crest%29.svg",
  "RC Lens": "https://crests.football-data.org/546.svg",
  "Racing Club": "https://upload.wikimedia.org/wikipedia/en/6/64/Racing_Club_de_Avellaneda.svg",
  "River Plate": "https://a.espncdn.com/i/teamlogos/soccer/500/2049.png",
  "Saint-Etienne": "https://crests.football-data.org/527.svg",
  "Salzburg": "https://upload.wikimedia.org/wikipedia/en/7/74/Red_Bull_Salzburg_logo.svg",
  "Sampdoria": "https://upload.wikimedia.org/wikipedia/en/e/e7/U.C._Sampdoria_logo.svg",
  "Santos": "https://upload.wikimedia.org/wikipedia/en/2/2b/Santos_FC_Logo.svg",
  "Sassuolo": "https://upload.wikimedia.org/wikipedia/en/7/7a/US_Sassuolo_Calcio_logo.svg",
  "Stuttgart": "https://a.espncdn.com/i/teamlogos/soccer/500/137.png",
  "Torino": "https://upload.wikimedia.org/wikipedia/en/7/72/Torino_FC_Logo.svg",
  "Toronto FC": "https://upload.wikimedia.org/wikipedia/en/0/01/Toronto_FC_Logo.svg",
  "Toulouse": "https://crests.football-data.org/586.svg",
  "Union Berlin": "https://upload.wikimedia.org/wikipedia/en/4/44/1._FC_Union_Berlin_Logo.svg",
  "Vancouver Whitecaps": "https://upload.wikimedia.org/wikipedia/en/a/a7/Vancouver_Whitecaps_FC_logo.svg",
  "Vissel Kobe": "https://upload.wikimedia.org/wikipedia/en/e/ef/Vissel_Kobe_logo.svg",
  "Watford": "https://upload.wikimedia.org/wikipedia/en/e/e2/Watford.svg",

  "Wolverhampton": "https://crests.football-data.org/76.svg",
  "Crystal Palace": "https://crests.football-data.org/354.svg",
  "Brentford": "https://crests.football-data.org/402.svg",
  "Aston Villa": "https://crests.football-data.org/58.svg",
  "Southampton": "https://crests.football-data.org/340.svg",
  "West Brom": "https://crests.football-data.org/74.svg",
  "Sunderland": "https://crests.football-data.org/356.svg",
  "Fulham": "https://crests.football-data.org/63.svg",
  "Middlesbrough": "https://crests.football-data.org/343.svg",
  "Stoke": "https://crests.football-data.org/70.svg",
  "Wigan": "https://crests.football-data.org/75.svg",
  "Bolton": "https://crests.football-data.org/341.svg",
  "Blackburn": "https://crests.football-data.org/59.svg",
  "Portsmouth": "https://crests.football-data.org/2314.svg",
  "Bayer Leverkusen": "https://crests.football-data.org/3.svg",
  "RB Leipzig": "https://crests.football-data.org/721.svg",
  "Eintracht Frankfurt": "https://crests.football-data.org/19.svg",
  "Werder Bremen": "https://crests.football-data.org/12.svg",
  "Schalke": "https://crests.football-data.org/6.svg",
  "Borussia Monchengladbach": "https://crests.football-data.org/18.svg",
  "Stuttgart": "https://crests.football-data.org/10.svg",
  "PSV": "https://crests.football-data.org/674.svg",
  "Fiorentina": "https://crests.football-data.org/99.svg",
  "Udinese": "https://crests.football-data.org/115.svg",
  "Genoa": "https://crests.football-data.org/107.svg",
  "Atalanta": "https://crests.football-data.org/102.svg",
  "Parma": "https://crests.football-data.org/112.svg",
  "Fenerbahce": "https://crests.football-data.org/2007.svg",
  "Besiktas": "https://crests.football-data.org/2006.svg",
  "Trabzonspor": "https://crests.football-data.org/2008.svg",
  "Dynamo Kyiv": "https://crests.football-data.org/958.svg",
  "Shakhtar": "https://crests.football-data.org/960.svg",
  "CSKA Moscow": "https://crests.football-data.org/601.svg",
  "Spartak Moscow": "https://crests.football-data.org/603.svg",
  "Al Hilal": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1b/Al-Hilal_FC_new_logo.svg/200px-Al-Hilal_FC_new_logo.svg.png",
  "Al Nassr": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/Al_Nassr_FC.svg/200px-Al_Nassr_FC.svg.png",
  "Al Qadsiah": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Al-Qadsiah.svg/200px-Al-Qadsiah.svg.png",
  "Inter Miami": "https://upload.wikimedia.org/wikipedia/en/thumb/8/82/Inter_Miami_CF_crest.svg/200px-Inter_Miami_CF_crest.svg.png",
  "New York City FC": "https://crests.football-data.org/18183.svg",
  "New York Red Bulls": "https://crests.football-data.org/18182.svg",
  "LA Galaxy": "https://crests.football-data.org/18183.svg",
  "Montreal Impact": "https://upload.wikimedia.org/wikipedia/en/thumb/8/89/CF_Montreal_crest.svg/200px-CF_Montreal_crest.svg.png",
  "Real Betis": "https://crests.football-data.org/90.svg",
  "Celta Vigo": "https://crests.football-data.org/558.svg",
  "Deportivo": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f3/RC_Deportivo_de_la_Coru%C3%B1a_logo.svg/200px-RC_Deportivo_de_la_Coru%C3%B1a_logo.svg.png",
  "Espanyol": "https://crests.football-data.org/85.svg",
  "Malaga": "https://crests.football-data.org/89.svg",
  "Osasuna": "https://crests.football-data.org/79.svg",
  "Racing Club": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Racing_Club_de_Avellaneda.svg/200px-Racing_Club_de_Avellaneda.svg.png",
  "River Plate": "https://upload.wikimedia.org/wikipedia/en/thumb/8/83/River_Plate_crest.svg/200px-River_Plate_crest.svg.png",
  "Boca Juniors": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Boca_Juniors_logo.svg/200px-Boca_Juniors_logo.svg.png",
  "Santos": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Santos_FC_Logo.svg/200px-Santos_FC_Logo.svg.png",
  "Flamengo": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Flamengo_braz_logo.svg/200px-Flamengo_braz_logo.svg.png",
  "Palmeiras": "https://upload.wikimedia.org/wikipedia/en/thumb/1/10/Palmeiras_logo.svg/200px-Palmeiras_logo.svg.png",
};

const CLUB_NAME_SEARCH = {};

async function fetchClubLogo(clubName) {
  if (LOGO_CACHE[clubName] !== undefined) return LOGO_CACHE[clubName];
  // Use direct URL if available
  const directUrl = CLUB_LOGO_URLS[clubName] || null;
  LOGO_CACHE[clubName] = directUrl;
  return directUrl;
}

function ClubLogo({ club, size = 48 }) {
  const [logo, setLogo] = React.useState(LOGO_CACHE[club] || null);
  const [loading, setLoading] = React.useState(!LOGO_CACHE[club]);

  React.useEffect(() => {
    if (LOGO_CACHE[club] !== undefined) {
      setLogo(LOGO_CACHE[club]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchClubLogo(club).then(url => {
      setLogo(url);
      setLoading(false);
    });
  }, [club]);

  if (loading) return (
    <div style={{width:size,height:size,borderRadius:"50%",background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:size*.4,height:size*.4,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"white",animation:"spin .8s linear infinite"}}/>
    </div>
  );
  if (!logo) return null;
  return (
    <img src={logo} alt={club} style={{mixBlendMode:"multiply",width:size,height:size,objectFit:"contain"}} onError={function(e){e.target.onerror=null;e.target.style.display="none";e.target.parentNode.innerHTML="<div style=\"width:"+size+"px;height:"+size+"px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center;font-size:"+(size*0.35)+"px;font-weight:900;color:#999\">"+(club.slice(0,2).toUpperCase())+"</div>";}} src={logo} alt={club} style={{mixBlendMode:"multiply",width:size,height:size,objectFit:"contain",filter:"drop-shadow(0 2px 6px rgba(0,0,0,.3))"}}
      onError={e=>{e.target.style.display="none";}}/>
  );
}


// ── PLAYER PHOTOS (TheSportsDB) ──
const PLAYER_PHOTO_CACHE = {};

async function fetchPlayerPhoto(playerName) {
  if (PLAYER_PHOTO_CACHE[playerName] !== undefined) return PLAYER_PHOTO_CACHE[playerName];
  try {
    // Step 1: search Wikipedia for the player
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + " footballer")}&format=json&origin=*&srlimit=1`
    );
    const searchData = await searchRes.json();
    const pageTitle = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) { PLAYER_PHOTO_CACHE[playerName] = null; return null; }

    // Step 2: get the page thumbnail
    const imgRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&origin=*&pithumbsize=200`
    );
    const imgData = await imgRes.json();
    const pages = imgData?.query?.pages;
    const page = pages ? Object.values(pages)[0] : null;
    const photo = page?.thumbnail?.source || null;
    PLAYER_PHOTO_CACHE[playerName] = photo;
    return photo;
  } catch {
    PLAYER_PHOTO_CACHE[playerName] = null;
    return null;
  }
}

function PlayerPhoto({ name, size = 48, fallbackColors }) {
  const [photo, setPhoto] = React.useState(PLAYER_PHOTO_CACHE[name] || null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (PLAYER_PHOTO_CACHE[name] !== undefined) {
      setPhoto(PLAYER_PHOTO_CACHE[name]);
      return;
    }
    fetchPlayerPhoto(name).then(url => setPhoto(url));
  }, [name]);

  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  // Always show avatar, overlay photo when loaded
  return (
    <div style={{width:size,height:size,borderRadius:"50%",position:"relative",overflow:"hidden",flexShrink:0}}>
      {/* Fallback avatar always present */}
      <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${ca},${cb})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:800,color:"#fff",fontFamily:"system-ui"}}>
        {initials}
      </div>
      {/* Real photo on top if available */}
      {photo && !error && (
        <img src={photo} alt={name}
          onLoad={()=>setLoaded(true)}
          onError={()=>setError(true)}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",opacity:loaded?1:0,transition:"opacity .3s"}}/>
      )}
    </div>
  );
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
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
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

  // ── FRIENDS ──
  const [playerId] = useState(() => getPlayerId());
  const [friendInput, setFriendInput] = useState("");
  const [friendsList, setFriendsList] = useState([]);
  const [friendScores, setFriendScores] = useState([]);
  const [showFriends, setShowFriends] = useState(false);
  const [friendMsg, setFriendMsg] = useState("");
  const [friendLoading, setFriendLoading] = useState(false);

  const [qTimeLeft, setQTimeLeft] = useState(5);
  const qTimerRef = useRef(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFloat, setComboFloat] = useState(null);
  const [shaking, setShaking] = useState(false);

  const [lbMode, setLbMode] = useState("pont");
  const [lbDiff, setLbDiff] = useState("facile");
  const [playerName, setPlayerName] = useState("");
  const [showInstructions, setShowInstructions] = useState(null);
  // Chain game state
  const [chainPlayer, setChainPlayer] = useState('');
  const [chainUsedClubs, setChainUsedClubs] = useState(new Set());
  const [chainUsedPlayers, setChainUsedPlayers] = useState(new Set());
  const [chainCount, setChainCount] = useState(0);
  const [chainScore, setChainScore] = useState(0);
  const [chainLastClub, setChainLastClub] = useState('');
  const [chainHistory, setChainHistory] = useState([]);

  // UI state
  const [showConfetti, setShowConfetti] = useState(false);
  const [wasAway, setWasAway] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [myLastPts, setMyLastPts] = useState(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [myLbRank, setMyLbRank] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const seenInstructions = useRef(new Set());

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const scoreRef = useRef(0);
  const chainScoreRef = useRef(0);
  const comboRef = useRef(0);
  const lastAnswerTime = useRef(Date.now());
  const historyEndRef = useRef(null);
  const hasEndedRef = useRef(false);
  const chainLogoRef = useRef({});

  useEffect(() => {
    try {
      const r = localStorage.getItem("bb_record"); if(r) setRecord(JSON.parse(r));
      const cr = localStorage.getItem("bb_chain_record"); if(cr) setChainRecord(JSON.parse(cr));
      const n = localStorage.getItem("bb_name"); if(n) setPlayerName(n);
      const seen = localStorage.getItem("bb_seen"); if(seen) JSON.parse(seen).forEach(s=>seenInstructions.current.add(s));
    } catch {}
    loadLeaderboard("pont","facile");
    loadFriends().then(function(ids){fetchFriendScores(ids);});
  }, []);

  useEffect(()=>{scoreRef.current=score;},[score]);
  useEffect(()=>{comboRef.current=combo;},[combo]);
  useEffect(()=>{if(historyEndRef.current)historyEndRef.current.scrollIntoView({behavior:"smooth"});},[chainHistory]);

  // Timer
  useEffect(()=>{
    if(screen!=="game"&&screen!=="chainGame"){hasEndedRef.current=false;return;}
    hasEndedRef.current=false;
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{setTimeLeft(t=>Math.max(t-1,0));},1000);
    return()=>clearInterval(timerRef.current);
  },[screen,currentRound]);

  useEffect(()=>{
    if((screen!=="game"&&screen!=="chainGame")||timeLeft>0||hasEndedRef.current)return;
    hasEndedRef.current=true;
    
    if(screen==="game")endRound();
    else endChain();
  },[screen,timeLeft]);


  // Leaderboard (localStorage)
  // ── FRIEND FUNCTIONS ──
  async function loadFriends() {
    try {
      const stored = localStorage.getItem("bb_friends");
      const ids = stored ? JSON.parse(stored) : [];
      setFriendsList(ids);
      return ids;
    } catch { return []; }
  }

  async function fetchFriendScores(ids) {
    if (!ids || ids.length === 0) { setFriendScores([]); return; }
    setFriendLoading(true);
    try {
      const allIds = [playerId, ...ids];
      const filter = "player_id=in.(" + allIds.join(",") + ")";
      const data = await sbFetch("bb_scores?select=player_id,player_name,score,mode,diff,created_at&" + filter + "&order=score.desc");
      const best = {};
      (data || []).forEach(function(row) {
        const key = row.player_id + "_" + row.mode + "_" + (row.diff || "");
        if (!best[key] || row.score > best[key].score) best[key] = row;
      });
      setFriendScores(Object.values(best).sort(function(a,b){return b.score-a.score;}));
    } catch(e) { console.error(e); }
    setFriendLoading(false);
  }

  function addFriend(code) {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) { setFriendMsg("Code invalide (6 caractères)"); return; }
    if (clean === playerId) { setFriendMsg("C'est ton propre code !"); return; }
    if (friendsList.includes(clean)) { setFriendMsg("Ami déjà ajouté !"); return; }

    const newList = [...friendsList, clean];
    localStorage.setItem("bb_friends", JSON.stringify(newList));
    setFriendsList(newList);
    setFriendMsg("✓ Ami ajouté ! Ses scores apparaîtront dès qu'il aura joué.");
    setFriendInput("");
    fetchFriendScores(newList);
  }

  function removeFriend(code) {
    const newList = friendsList.filter(function(id){return id !== code;});
    localStorage.setItem("bb_friends", JSON.stringify(newList));
    setFriendsList(newList);
    fetchFriendScores(newList);
  }

  async function submitScore(name, sc, mode, d) {
    try {
      await sbFetch("bb_scores", {
        method: "POST",
        body: JSON.stringify({
          player_id: playerId,
          player_name: (name || "Anonyme").trim(),
          score: sc,
          mode: mode,
          diff: d || null,
        })
      });
    } catch(e) { console.error(e); }
  }


  function loadLeaderboard(mode, d) {
    try {
      const key = `bb_lb_${mode}_${d}`;
      const data = localStorage.getItem(key);
      setLeaderboard(data ? JSON.parse(data) : []);
    } catch { setLeaderboard([]); }
  }

  function footballPoints(sc, list) {
    // Comparer à mon propre meilleur score, pas au #1 global
    const myEntry = list.find(e => (e.player_name || e.name) === playerName.trim());
    const myBest = myEntry ? myEntry.score : 0;
    if(myBest === 0) return 10;        // Premier score = toujours victoire
    if(sc > myBest) return 10;         // Nouveau record perso = victoire
    if(sc >= myBest * 0.85) return 5;  // Proche du record = nul
    return 0;                           // Loin = défaite
  }

  function submitToLeaderboard(name, sc, mode, d) {
    submitScore(name, sc, mode, d);
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
    const eligible=PLAYERS.filter(p=>p&&p.clubs&&p.clubs.length>=2);
    const start=eligible[Math.floor(Math.random()*eligible.length)];
    const usedP=new Set([start.name]);
    // Prefetch logos for starting player clubs
    start.clubs.forEach(club => fetchClubLogo(club).then(url => { if(url) chainLogoRef.current[club]=url; }));
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
    setQTimeLeft(QUESTION_DURATION);
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
    clearInterval(qTimerRef.current);
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
      // Prefetch logos for next player
      getPlayerClubs(next).forEach(club => fetchClubLogo(club).then(url => { if(url) chainLogoRef.current[club]=url; }));
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



  // ── HOME ──

  // ── FRIENDS SCREEN ──
  if (showFriends) {
    const myScores = friendScores.filter(function(s){return s.player_id===playerId;});
    const otherScores = friendScores.filter(function(s){return s.player_id!==playerId;});
    const grouped = {};
    otherScores.forEach(function(s){
      if(!grouped[s.player_id]) grouped[s.player_id]={name:s.player_name,scores:[]};
      grouped[s.player_id].scores.push(s);
    });
    return (
      <div style={{...shell, overflow:"auto"}} key="friends">
        <div style={stripes}/>
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(function(){setShowFriends(false);setFriendMsg("");})}
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:2}}>AMIS</div>
          <div style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"6px 12px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,.6)",letterSpacing:2,textTransform:"uppercase"}}>Ton code</div>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.gold,letterSpacing:4}}>{playerId}</div>
          </div>
        </div>

        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>

          {/* Add friend */}
          <div style={{background:G.offWhite,borderRadius:16,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#888",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Ajouter un ami</div>
            <div style={{display:"flex",gap:8}}>
              <input
                value={friendInput}
                onChange={function(e){setFriendInput(e.target.value.toUpperCase());setFriendMsg("");}}
                placeholder="Code ami (6 lettres)"
                maxLength={6}
                style={{flex:1,padding:"10px 14px",borderRadius:12,border:"2px solid #e5e5e0",fontFamily:G.font,fontSize:15,fontWeight:700,letterSpacing:3,textTransform:"uppercase",outline:"none"}}
              />
              <button onClick={function(){addFriend(friendInput);}}
                style={{padding:"10px 16px",background:G.dark,color:G.white,border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                +
              </button>
            </div>
            {friendMsg && <div style={{marginTop:8,fontSize:13,color:friendMsg.startsWith("✓")?"#16a34a":"#ef4444",fontWeight:700}}>{friendMsg}</div>}
            <div style={{marginTop:8,fontSize:11,color:"#bbb"}}>Partage ton code à tes amis pour comparer vos scores</div>
          </div>

          {/* My scores */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:8}}>Mes meilleurs scores</div>
            {myScores.length===0 && <div style={{fontSize:13,color:"#bbb",textAlign:"center",padding:12}}>Joue une partie pour voir tes scores ici !</div>}
            {myScores.map(function(s,i){return(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:G.offWhite,borderRadius:12,marginBottom:6}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:G.dark}}>{s.mode==="pont"?"Le Pont":"La Chaîne"}{s.diff?" · "+s.diff:""}</div>
                  <div style={{fontSize:11,color:"#aaa"}}>{new Date(s.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                <div style={{fontFamily:G.heading,fontSize:24,color:G.dark}}>{s.score} <span style={{fontSize:12,color:"#aaa"}}>pts</span></div>
              </div>
            );})}
          </div>

          {/* Friends scores */}
          {friendsList.length>0 && (
            <div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#bbb",marginBottom:8}}>Scores de tes amis</div>
              {friendLoading && <div style={{textAlign:"center",color:"#bbb",fontSize:13,padding:12}}>Chargement...</div>}
              {!friendLoading && Object.values(grouped).map(function(friend,i){return(
                <div key={i} style={{background:G.offWhite,borderRadius:16,padding:12,marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontFamily:G.heading,fontSize:17,color:G.dark}}>{friend.name}</div>
                    <button onClick={function(){removeFriend(friend.scores[0].player_id);}}
                      style={{background:"transparent",border:"none",color:"#ccc",cursor:"pointer",fontSize:16,padding:"0 4px"}}>✕</button>
                  </div>
                  {friend.scores.map(function(s,j){return(
                    <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:j>0?"1px solid #eee":"none"}}>
                      <div style={{fontSize:12,color:"#666"}}>{s.mode==="pont"?"Le Pont":"La Chaîne"}{s.diff?" · "+s.diff:""}</div>
                      <div style={{fontFamily:G.heading,fontSize:18,color:G.dark}}>{s.score} <span style={{fontSize:11,color:"#aaa"}}>pts</span></div>
                    </div>
                  );})}
                </div>
              );})}
              {!friendLoading && Object.keys(grouped).length===0 && (
                <div style={{fontSize:13,color:"#bbb",textAlign:"center",padding:12}}>Tes amis n'ont pas encore joué</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }


  if(screen==="home") return (
    <div style={{...shell,animation:"fadeUp .5s ease"}} key="home">
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
          <button onClick={function(){setShowFriends(true);fetchFriendScores(friendsList);}} style={{flex:1,padding:"14px",background:G.offWhite,color:G.dark,border:"2px solid #e5e5e0",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>👥 Amis</button>
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
            
            <div style={{marginBottom:8,display:"flex",justifyContent:"center",zIndex:1}}><ClubLogo club={cur.c1} size={52}/></div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(20px,5.5vw,36px)",color:tc1==="#FFF"?"#ffffff":"#111",lineHeight:1.05,textAlign:"center",padding:"0 20px",zIndex:1,textShadow:tc1==="#FFF"?"0 3px 12px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{cur.c1}</div>
          </div>

          {/* VS */}
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:44,zIndex:2,flexShrink:0}}>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.white,letterSpacing:4,background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:30,padding:"5px 18px",border:"1.5px solid rgba(255,255,255,.15)",animation:"vsAppear .5s cubic-bezier(.22,1,.36,1) .3s both"}}>VS</div>
          </div>

          {/* Club 2 */}
          <div style={{flex:1,margin:"0 14px 10px 14px",borderRadius:28,background:`linear-gradient(145deg,${ca2} 0%,${cb2} 100%)`,boxShadow:`0 12px 40px ${ca2}55`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",animation:"clubSlideRight .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:`3px solid ${tc2==="#FFF"?"rgba(255,255,255,.12)":"rgba(0,0,0,.08)"}`,bottom:-30,left:-30}}/>
            <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",border:`2px solid ${tc2==="#FFF"?"rgba(255,255,255,.07)":"rgba(0,0,0,.05)"}`,top:10,right:-10}}/>
            
            <div style={{marginBottom:8,display:"flex",justifyContent:"center",zIndex:1}}><ClubLogo club={cur.c2} size={52}/></div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(20px,5.5vw,36px)",color:tc2==="#FFF"?"#ffffff":"#111",lineHeight:1.05,textAlign:"center",padding:"0 20px",zIndex:1,textShadow:tc2==="#FFF"?"0 3px 12px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{cur.c2}</div>
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
              <button onClick={handlePass} disabled={!!flash} style={{padding:"12px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer → (−0.5 pt)</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                placeholder="Nom du joueur..." autoComplete="off"
                style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:`2px solid ${flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0"}`,borderRadius:18,padding:"15px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s",animation:flash==="ko"?"answerKo .4s ease":flash==="ok"?"answerOk .4s ease":"none"}}/>
              <div style={{display:"flex",gap:10}}>
                <button onClick={handleSubmit} style={{flex:2,padding:"15px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>Valider</button>
                <button onClick={handlePass} disabled={!!flash} style={{flex:1,padding:15,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer →</button>
              </div>
            </div>
          )}
        </div>
      {/* Question timer bar */}
      <div style={{position:"fixed", bottom:0, left:0, right:0, height:5, background:"rgba(255,255,255,.15)", zIndex:100}}>
        <div style={{height:"100%", background:qTimeLeft>3?"#4ade80":qTimeLeft>1?"#fbbf24":"#ef4444", width:(qTimeLeft/QUESTION_DURATION*100)+"%", transition:"width 1s linear", borderRadius:"0 3px 3px 0"}}/>
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
            <ClubLogo club={chainLastClub} size={20}/> {chainLastClub}
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
          <button onClick={handleChainPass} disabled={!!flash} style={{flex:1,padding:16,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer →</button>
        </div>
        {chainHistory.length>0 && (
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#ccc",textAlign:"center"}}>Chaîne</div>
            {chainHistory.map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:G.offWhite,borderRadius:12,animation:`slideIn .3s ease ${i*.04}s both`,opacity:h.passed ? 0.7 : 1}}>
                <span style={{fontSize:10,color:"#bbb",fontWeight:700,minWidth:18}}>{i+1}.</span>
                <PlayerAvatarMini name={h.player} size={26}/>
                <span style={{fontSize:12,color:G.dark,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.player}</span>
                <span style={{display:"flex",alignItems:"center",flexShrink:0}}>{Icon.transfer(11,"#ccc")}</span>
                <span style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}><ClubLogo club={h.club} size={18}/><span style={{fontSize:12,color:h.passed?"#aaa":G.bg,fontWeight:700}}>{h.club}</span></span>
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
