import React, { useState, useEffect, useRef, useCallback } from "react";




const SB_URL = "https://ialjlsrgcolocoaegzrc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGpsc3JnY29sb2NvYWVnenJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM3NzksImV4cCI6MjA5MTA3OTc3OX0.-SU8anuPhnpoa-PYhIHQqrcuOBsHxdtBJKRZuiGcGwM";
async function sbFetch(path, options) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, {
    ...options,
    headers: Object.assign({"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json"},
      options&&options.method==="POST"?{"Prefer":"return=minimal"}:{},
      options&&options.headers?options.headers:{})
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
      id = Array.from({length:6},function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
      localStorage.setItem("bb_player_id", id);
    }
    return id;
  } catch(e) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:6},function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
  }
}


// ── CONSTANTS ──
const ROUND_DURATION = 90;
const QUESTION_DURATION = 10;
const CHAIN_QUESTION_DURATION = 15;
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
  { name:"Cole Palmer", clubs:["Manchester City", "Chelsea"], diff:"moyen" },
  { name:"Robert Lewandowski", clubs:["Borussia Dortmund", "Bayern Munich", "Barcelona"], diff:"facile" },
  { name:"Karim Benzema", clubs:["Lyon", "Real Madrid", "Al Ittihad"], diff:"facile" },
  { name:"Mohamed Salah", clubs:["Basel", "Chelsea", "Fiorentina", "Roma", "Liverpool"], diff:"facile" },
  { name:"Kevin De Bruyne", clubs:["Chelsea", "Wolfsburg", "Manchester City"], diff:"facile" },
  { name:"Harry Kane", clubs:["Tottenham", "Bayern Munich"], diff:"facile" },
  { name:"N'Golo Kante", clubs:["Leicester City", "Chelsea", "Al Ittihad"], diff:"facile" },
  { name:"Sergio Ramos", clubs:["Sevilla", "Real Madrid", "PSG"], diff:"facile" },
  { name:"Antoine Griezmann", clubs:["Real Sociedad", "Atletico Madrid", "Barcelona"], diff:"facile" },
  { name:"Eden Hazard", clubs:["Lille", "Chelsea", "Real Madrid"], diff:"facile" },
  { name:"Luis Suarez", clubs:["Ajax", "Liverpool", "Barcelona", "Atletico Madrid"], diff:"facile" },
  { name:"Zlatan Ibrahimovic", clubs:["Malmo", "Ajax", "Juventus", "Inter Milan", "Barcelona", "AC Milan", "PSG", "Manchester United", "LA Galaxy"], diff:"facile" },
  { name:"Gareth Bale", clubs:["Southampton", "Tottenham", "Real Madrid"], diff:"facile" },
  { name:"Wayne Rooney", clubs:["Everton", "Manchester United"], diff:"facile" },
  { name:"Toni Kroos", clubs:["Bayern Munich", "Bayer Leverkusen", "Real Madrid"], diff:"facile" },
  { name:"Luka Modric", clubs:["Dinamo Zagreb", "Tottenham", "Real Madrid"], diff:"facile" },
  { name:"Paul Pogba", clubs:["Manchester United", "Juventus", "Monaco"], diff:"facile" },
  { name:"Didier Drogba", clubs:["Le Mans", "Guingamp", "Marseille", "Chelsea", "Galatasaray"], diff:"facile" },
  { name:"Samuel Eto'o", clubs:["Real Madrid", "Mallorca", "Barcelona", "Inter Milan", "Anzhi", "Chelsea", "Everton"], diff:"facile" },
  { name:"Virgil van Dijk", clubs:["Celtic", "Southampton", "Liverpool"], diff:"facile" },
  { name:"David Beckham", clubs:["Manchester United", "Real Madrid", "AC Milan", "PSG", "LA Galaxy"], diff:"facile" },
  { name:"Sadio Mane", clubs:["Metz", "Salzburg", "Southampton", "Liverpool", "Bayern Munich", "Al Nassr"], diff:"facile" },
  { name:"Raheem Sterling", clubs:["Liverpool", "Manchester City", "Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Ousmane Dembele", clubs:["Rennes", "Borussia Dortmund", "Barcelona", "PSG"], diff:"moyen" },
  { name:"Marcus Rashford", clubs:["Manchester United","Barcelona"], diff:"moyen" },
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
  { name:"Adrien Rabiot", clubs:["PSG", "Juventus", "Marseille", "AC Milan"], diff:"moyen" },
  { name:"Sandro Tonali", clubs:["AC Milan", "Newcastle"], diff:"moyen" },
  { name:"Florian Wirtz", clubs:["Bayer Leverkusen", "Liverpool"], diff:"moyen" },
  { name:"Jamal Musiala", clubs:["Chelsea", "Bayern Munich"], diff:"moyen" },
  { name:"Rafael Leao", clubs:["Sporting CP", "Lille", "AC Milan"], diff:"moyen" },
  { name:"Pedri", clubs:["Las Palmas", "Barcelona"], diff:"moyen" },
  { name:"Gavi", clubs:["Barcelona"], diff:"moyen" },
  { name:"Rodri", clubs:["Atletico Madrid", "Manchester City"], diff:"moyen" },
  { name:"Thomas Muller", clubs:["Bayern Munich"], diff:"facile" },
  { name:"Manuel Neuer", clubs:["Schalke", "Bayern Munich"], diff:"facile" },
  { name:"Gianluigi Donnarumma", clubs:["AC Milan", "PSG"], diff:"moyen" },
  { name:"Raphael Varane", clubs:["Lens", "Real Madrid", "Manchester United"], diff:"moyen" },
  { name:"Marquinhos", clubs:["Roma", "PSG"], diff:"moyen" },
  { name:"Ruben Dias", clubs:["Benfica", "Manchester City"], diff:"moyen" },
  { name:"Kalidou Koulibaly", clubs:["Napoli", "Chelsea", "Al Hilal"], diff:"moyen" },
  { name:"David Alaba", clubs:["Bayern Munich", "Real Madrid"], diff:"moyen" },
  { name:"Andrew Robertson", clubs:["Hull City", "Liverpool"], diff:"moyen" },
  { name:"Frenkie de Jong", clubs:["Ajax", "Barcelona"], diff:"moyen" },
  { name:"Thiago Alcantara", clubs:["Barcelona", "Bayern Munich", "Liverpool"], diff:"moyen" },
  { name:"David Silva", clubs:["Valencia", "Manchester City", "Real Sociedad"], diff:"facile" },
  { name:"Lautaro Martinez", clubs:["Racing Club", "Inter Milan"], diff:"moyen" },
  { name:"Paulo Dybala", clubs:["Palermo", "Juventus", "Roma"], diff:"moyen" },
  { name:"Enzo Fernandez", clubs:["River Plate", "Benfica", "Chelsea"], diff:"moyen" },
  { name:"Alexis Mac Allister", clubs:["Brighton", "Liverpool"], diff:"moyen" },
  { name:"Angel Di Maria", clubs:["Benfica", "Real Madrid", "Manchester United", "PSG", "Juventus"], diff:"facile" },
  { name:"Carlos Tevez", clubs:["Boca Juniors", "Corinthians", "West Ham", "Manchester United", "Manchester City", "Juventus"], diff:"facile" },
  { name:"Radamel Falcao", clubs:["Porto", "Atletico Madrid", "Monaco", "Manchester United", "Chelsea"], diff:"facile" },
  { name:"James Rodriguez", clubs:["Monaco", "Real Madrid", "Bayern Munich", "Everton"], diff:"moyen" },
  { name:"Heung-min Son", clubs:["Bayer Leverkusen", "Tottenham"], diff:"facile" },
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
  { name:"Cesc Fabregas", clubs:["Arsenal", "Barcelona", "Chelsea", "Monaco"], diff:"facile" },
  { name:"Xabi Alonso", clubs:["Real Sociedad", "Liverpool", "Real Madrid", "Bayern Munich"], diff:"facile" },
  { name:"Andres Iniesta", clubs:["Barcelona", "Vissel Kobe"], diff:"facile" },
  { name:"Frank Lampard", clubs:["West Ham", "Chelsea", "Manchester City"], diff:"facile" },
  { name:"Steven Gerrard", clubs:["Liverpool"], diff:"facile" },
  { name:"Rio Ferdinand", clubs:["West Ham", "Leeds United", "Manchester United"], diff:"facile" },
  { name:"John Terry", clubs:["Chelsea", "Aston Villa"], diff:"facile" },
  { name:"Michael Owen", clubs:["Liverpool", "Real Madrid", "Newcastle", "Manchester United"], diff:"facile" },
  { name:"Miroslav Klose", clubs:["Werder Bremen", "Bayern Munich", "Lazio"], diff:"moyen" },
  { name:"Lucas Hernandez", clubs:["Atletico Madrid", "Bayern Munich", "PSG"], diff:"moyen" },
  { name:"Dayot Upamecano", clubs:["RB Leipzig", "Bayern Munich"], diff:"moyen" },
  { name:"Randal Kolo Muani", clubs:["Nantes", "Eintracht Frankfurt", "PSG", "Juventus"], diff:"moyen" },
  { name:"Matteo Guendouzi", clubs:["Arsenal", "Marseille", "Lazio"], diff:"expert" },
  { name:"Wissam Ben Yedder", clubs:["Toulouse", "Sevilla", "Monaco"], diff:"expert" },
  { name:"Jonathan Clauss", clubs:["Marseille", "Nice"], diff:"expert" },
  { name:"Dani Olmo", clubs:["Dinamo Zagreb", "RB Leipzig", "Barcelona"], diff:"moyen" },
  { name:"Mikel Oyarzabal", clubs:["Real Sociedad"], diff:"expert" },
  { name:"Alejandro Grimaldo", clubs:["Benfica", "Bayer Leverkusen"], diff:"expert" },
  { name:"Nico Williams", clubs:["Athletic Bilbao"], diff:"moyen" },
  { name:"Mikel Merino", clubs:["Borussia Dortmund", "Newcastle", "Real Sociedad", "Arsenal"], diff:"expert" },
  { name:"Granit Xhaka", clubs:["Borussia Monchengladbach", "Arsenal", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Marco Reus", clubs:["Borussia Monchengladbach", "Borussia Dortmund"], diff:"moyen" },
  { name:"Mats Hummels", clubs:["Borussia Dortmund", "Bayern Munich", "Roma"], diff:"moyen" },
  { name:"Mario Gotze", clubs:["Borussia Dortmund", "Bayern Munich", "PSV"], diff:"moyen" },
  { name:"Sami Khedira", clubs:["Real Madrid", "Juventus", "Arsenal"], diff:"moyen" },
  { name:"Leon Goretzka", clubs:["Schalke", "Bayern Munich"], diff:"moyen" },
  { name:"Diogo Jota", clubs:["Wolverhampton", "Liverpool"], diff:"moyen" },
  { name:"Pedro Neto", clubs:["Wolverhampton", "Chelsea"], diff:"moyen" },
  { name:"Vitinha", clubs:["Wolverhampton", "Porto", "PSG"], diff:"expert" },
  { name:"Marco Verratti", clubs:["PSG", "Al Arabi"], diff:"moyen" },
  { name:"Nicolo Zaniolo", clubs:["Roma", "Galatasaray"], diff:"expert" },
  { name:"Manuel Locatelli", clubs:["AC Milan", "Sassuolo", "Juventus"], diff:"expert" },
  { name:"Giacomo Raspadori", clubs:["Sassuolo", "Napoli"], diff:"expert" },
  { name:"Gianluca Scamacca", clubs:["Sassuolo", "West Ham", "Atalanta"], diff:"expert" },
  { name:"Xavi", clubs:["Barcelona", "Al-Sadd"], diff:"facile" },
  { name:"Sergio Busquets", clubs:["Barcelona", "Inter Miami"], diff:"moyen" },
  { name:"Giorgio Chiellini", clubs:["Juventus", "Los Angeles FC"], diff:"moyen" },
  { name:"Leonardo Bonucci", clubs:["Juventus", "AC Milan", "Union Berlin"], diff:"moyen" },
  { name:"Dani Carvajal", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Jerome Boateng", clubs:["Manchester City", "Bayern Munich"], diff:"moyen" },
  { name:"Jordi Alba", clubs:["Valencia", "Barcelona", "Inter Miami"], diff:"moyen" },
  { name:"Luke Shaw", clubs:["Southampton", "Manchester United"], diff:"moyen" },
  { name:"Benjamin Pavard", clubs:["Stuttgart", "Bayern Munich", "Inter Milan"], diff:"moyen" },
  { name:"Presnel Kimpembe", clubs:["PSG"], diff:"expert" },
  { name:"John Stones", clubs:["Everton", "Manchester City"], diff:"moyen" },
  { name:"Arturo Vidal", clubs:["Juventus", "Bayern Munich", "Barcelona", "Inter Milan"], diff:"moyen" },
  { name:"Nemanja Matic", clubs:["Chelsea", "Manchester United", "Roma"], diff:"expert" },
  { name:"Aaron Ramsey", clubs:["Arsenal", "Juventus"], diff:"expert" },
  { name:"Blaise Matuidi", clubs:["PSG", "Juventus"], diff:"moyen" },
  { name:"Roberto Firmino", clubs:["Hoffenheim", "Liverpool"], diff:"moyen" },
  { name:"Jamie Vardy", clubs:["Leicester City"], diff:"moyen" },
  { name:"Divock Origi", clubs:["Liverpool", "AC Milan"], diff:"expert" },
  { name:"Thomas Lemar", clubs:["Monaco", "Atletico Madrid"], diff:"expert" },
  { name:"Kingsley Coman", clubs:["PSG", "Juventus", "Bayern Munich"], diff:"moyen" },
  { name:"Ciro Immobile", clubs:["Juventus", "Torino", "Borussia Dortmund", "Lazio"], diff:"moyen" },
  { name:"Lorenzo Insigne", clubs:["Napoli", "Toronto FC"], diff:"moyen" },
  { name:"Dries Mertens", clubs:["PSV", "Napoli"], diff:"moyen" },
  { name:"Hakim Ziyech", clubs:["Ajax", "Chelsea", "Galatasaray"], diff:"moyen" },
  { name:"Wilfried Zaha", clubs:["Crystal Palace", "Manchester United"], diff:"expert" },
  { name:"Idrissa Gueye", clubs:["Aston Villa", "Everton", "PSG"], diff:"expert" },
  { name:"Ashley Cole", clubs:["Arsenal", "Chelsea", "Roma"], diff:"moyen" },
  { name:"David de Gea", clubs:["Atletico Madrid", "Manchester United"], diff:"moyen" },
  { name:"Fernando Llorente", clubs:["Athletic Bilbao", "Juventus", "Sevilla", "Tottenham"], diff:"expert" },
  { name:"Santi Cazorla", clubs:["Villarreal", "Malaga", "Arsenal"], diff:"moyen" },
  { name:"Iker Casillas", clubs:["Real Madrid", "Porto"], diff:"facile" },
  { name:"Juan Mata", clubs:["Valencia", "Chelsea", "Manchester United"], diff:"moyen" },
  { name:"Figo", clubs:["Sporting CP", "Barcelona", "Real Madrid", "Inter Milan"], diff:"facile" },
  { name:"Ricardo Carvalho", clubs:["Porto", "Chelsea", "Real Madrid", "Monaco"], diff:"expert" },
  { name:"Pepe", clubs:["Porto", "Real Madrid", "Besiktas"], diff:"moyen" },
  { name:"Ruud van Nistelrooy", clubs:["PSV", "Manchester United", "Real Madrid"], diff:"facile" },
  { name:"Patrick Kluivert", clubs:["Ajax", "Barcelona", "Roma", "Valencia", "Newcastle"], diff:"moyen" },
  { name:"Dirk Kuyt", clubs:["Liverpool", "Fenerbahce"], diff:"expert" },
  { name:"Diego Forlan", clubs:["Manchester United", "Atletico Madrid", "Inter Milan"], diff:"moyen" },
  { name:"Hernan Crespo", clubs:["Lazio", "Inter Milan", "Chelsea", "AC Milan"], diff:"moyen" },
  { name:"Juan Sebastian Veron", clubs:["Lazio", "Manchester United", "Inter Milan", "Chelsea"], diff:"expert" },
  { name:"Clarence Seedorf", clubs:["Ajax", "Sampdoria", "Real Madrid", "Inter Milan", "AC Milan"], diff:"moyen" },
  { name:"Patrick Vieira", clubs:["AC Milan", "Arsenal", "Juventus", "Inter Milan", "Manchester City"], diff:"facile" },
  { name:"Emmanuel Petit", clubs:["Monaco", "Arsenal", "Barcelona", "Chelsea"], diff:"expert" },
  { name:"Peter Crouch", clubs:["Aston Villa", "Southampton", "Liverpool", "Tottenham"], diff:"expert" },
  { name:"Gennaro Gattuso", clubs:["AC Milan", "Tottenham"], diff:"expert" },
  { name:"Roberto Baggio", clubs:["Fiorentina", "Juventus", "AC Milan", "Inter Milan", "Bologna"], diff:"facile" },
  { name:"Christian Vieri", clubs:["Lazio", "Inter Milan", "AC Milan"], diff:"moyen" },
  { name:"Filippo Inzaghi", clubs:["Juventus", "AC Milan"], diff:"moyen" },
  { name:"Fabio Cannavaro", clubs:["Napoli", "Parma", "Inter Milan", "Juventus", "Real Madrid"], diff:"facile" },
  { name:"Luca Toni", clubs:["Fiorentina", "Bayern Munich", "Roma", "Juventus"], diff:"expert" },
  { name:"Antonio Cassano", clubs:["Roma", "Real Madrid", "Sampdoria", "Inter Milan", "AC Milan"], diff:"expert" },
  { name:"Rui Costa", clubs:["Fiorentina", "AC Milan"], diff:"expert" },
  { name:"Deco", clubs:["Porto", "Barcelona", "Chelsea"], diff:"moyen" },
  { name:"Nani", clubs:["Sporting CP", "Manchester United", "Valencia"], diff:"moyen" },
  { name:"Wesley Sneijder", clubs:["Ajax", "Real Madrid", "Inter Milan", "Galatasaray"], diff:"facile" },
  { name:"Arjen Robben", clubs:["PSV", "Chelsea", "Real Madrid", "Bayern Munich"], diff:"facile" },
  { name:"Mark van Bommel", clubs:["PSV", "Barcelona", "Bayern Munich", "AC Milan"], diff:"expert" },
  { name:"Antony", clubs:["Ajax", "Manchester United"], diff:"moyen" },
  { name:"Gleison Bremer", clubs:["Torino", "Juventus"], diff:"expert" },
  { name:"Alejandro Garnacho", clubs:["Manchester United"], diff:"moyen" },
  { name:"Kobbie Mainoo", clubs:["Manchester United"], diff:"moyen" },
  { name:"Dean Huijsen", clubs:["Juventus", "Roma", "Bournemouth", "Real Madrid"], diff:"expert" },
  { name:"Savinho", clubs:["Girona", "Manchester City"], diff:"expert" },
  { name:"Rayan Cherki", clubs:["Lyon", "Manchester City"], diff:"moyen" },
  { name:"Warren Zaire-Emery", clubs:["PSG"], diff:"expert" },
  { name:"Desire Doue", clubs:["Rennes", "PSG"], diff:"expert" },
  { name:"Khephren Thuram", clubs:["Nice", "Juventus"], diff:"expert" },
  { name:"Manu Kone", clubs:["Borussia Monchengladbach", "Roma"], diff:"expert" },
  { name:"Youssouf Fofana", clubs:["Monaco", "AC Milan"], diff:"expert" },
  { name:"Adam Wharton", clubs:["Crystal Palace"], diff:"expert" },
  { name:"Jarrod Bowen", clubs:["West Ham"], diff:"expert" },
  { name:"Morgan Gibbs-White", clubs:["Wolverhampton", "Nottingham Forest"], diff:"expert" },
  { name:"Marcus Thuram", clubs:["Borussia Monchengladbach", "Inter Milan"], diff:"moyen" },
  { name:"Endrick", clubs:["Palmeiras", "Real Madrid"], diff:"expert" },
  { name:"Diogo Dalot", clubs:["Porto", "AC Milan", "Manchester United"], diff:"expert" },
  { name:"Naby Keita", clubs:["RB Leipzig", "Liverpool", "Werder Bremen"], diff:"expert" },
  { name:"Thomas Partey", clubs:["Atletico Madrid", "Arsenal"], diff:"expert" },
  { name:"Fabinho", clubs:["Monaco", "Liverpool", "Al Ittihad"], diff:"moyen" },
  { name:"Ivan Rakitic", clubs:["Sevilla", "Barcelona"], diff:"moyen" },
  { name:"Christian Eriksen", clubs:["Tottenham", "Inter Milan", "Manchester United"], diff:"moyen" },
  { name:"Matthijs de Ligt", clubs:["Ajax", "Juventus", "Bayern Munich", "Manchester United"], diff:"moyen" },
  { name:"Diego Costa", clubs:["Atletico Madrid", "Chelsea"], diff:"moyen" },
  { name:"Sacha Boey", clubs:["Galatasaray", "Bayern Munich"], diff:"expert" },
  { name:"Gerard Pique", clubs:["Manchester United", "Barcelona"], diff:"facile" },
  { name:"Lukas Podolski", clubs:["Bayern Munich", "Arsenal", "Inter Milan", "Galatasaray"], diff:"moyen" },
  { name:"Michael Ballack", clubs:["Bayer Leverkusen", "Bayern Munich", "Chelsea"], diff:"facile" },
  { name:"Bastian Schweinsteiger", clubs:["Bayern Munich", "Manchester United"], diff:"facile" },
  { name:"Serge Gnabry", clubs:["Arsenal", "Bayern Munich"], diff:"moyen" },
  { name:"Timo Werner", clubs:["RB Leipzig", "Chelsea", "Tottenham"], diff:"moyen" },
  { name:"Andre Schurrle", clubs:["Bayer Leverkusen", "Chelsea", "Borussia Dortmund", "Wolfsburg"], diff:"expert" },
  // ── 2016-2026 ──
  { name:"Ederson", clubs:["Benfica", "Manchester City"], diff:"moyen" },
  { name:"Alisson Becker", clubs:["Roma", "Liverpool"], diff:"moyen" },
  { name:"Marc-Andre ter Stegen", clubs:["Borussia Monchengladbach", "Barcelona"], diff:"moyen" },
  { name:"Kepa Arrizabalaga", clubs:["Athletic Bilbao", "Chelsea", "Real Madrid"], diff:"expert" },
  { name:"Andre Onana", clubs:["Ajax", "Inter Milan", "Manchester United"], diff:"moyen" },
  { name:"Mike Maignan", clubs:["Lille", "AC Milan"], diff:"moyen" },
  { name:"Gregor Kobel", clubs:["Stuttgart", "Borussia Dortmund"], diff:"expert" },
  { name:"Trent Alexander-Arnold", clubs:["Liverpool", "Real Madrid"], diff:"moyen" },
  { name:"Reece James", clubs:["Chelsea"], diff:"moyen" },
  { name:"Achraf Hakimi", clubs:["Real Madrid", "Borussia Dortmund", "Inter Milan", "PSG"], diff:"moyen" },
  { name:"Ferland Mendy", clubs:["Lyon", "Real Madrid"], diff:"moyen" },
  { name:"Alphonso Davies", clubs:["Vancouver Whitecaps", "Bayern Munich"], diff:"moyen" },
  { name:"Josko Gvardiol", clubs:["Dinamo Zagreb", "RB Leipzig", "Manchester City"], diff:"moyen" },
  { name:"Ibrahima Konate", clubs:["RC Lens", "RB Leipzig", "Liverpool"], diff:"moyen" },
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
  { name:"Vinicius Jr", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Bukayo Saka", clubs:["Arsenal"], diff:"facile" },
  { name:"Federico Valverde", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Thibaut Courtois", clubs:["Chelsea", "Real Madrid"], diff:"facile" },
  { name:"Alisson", clubs:["Roma", "Liverpool"], diff:"moyen" },
  { name:"Joshua Kimmich", clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Romelu Lukaku", clubs:["Manchester United", "Chelsea", "Inter Milan", "Roma", "Napoli"], diff:"facile" },
  { name:"Son Heung-min", clubs:["Tottenham"], diff:"facile" },
  { name:"Carles Puyol", clubs:["Barcelona"], diff:"moyen" },
  { name:"Radamel Falcao", clubs:["Porto", "Atletico Madrid", "Monaco", "Manchester United", "Chelsea"], diff:"facile" },
  { name:"Samir Nasri", clubs:["Marseille", "Arsenal", "Manchester City"], diff:"moyen" },
  { name:"Bacary Sagna", clubs:["Arsenal", "Manchester City"], diff:"moyen" },
  { name:"Nicolas Anelka", clubs:["Arsenal", "Real Madrid", "PSG", "Manchester City", "Chelsea", "Bolton"], diff:"moyen" },
  { name:"Sylvain Wiltord", clubs:["Bordeaux", "Arsenal"], diff:"moyen" },
  { name:"Marc Overmars", clubs:["Ajax", "Arsenal", "Barcelona"], diff:"moyen" },
  { name:"Robert Pires", clubs:["Arsenal", "Marseille", "Villarreal"], diff:"moyen" },
  { name:"Claude Makelele", clubs:["Nantes", "Marseille", "Celta Vigo", "Real Madrid", "Chelsea", "PSG"], diff:"moyen" },
  { name:"Peter Cech", clubs:["Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Didier Deschamps", clubs:["Juventus", "Chelsea", "Monaco"], diff:"moyen" },
  { name:"Marcel Desailly", clubs:["Marseille", "AC Milan", "Chelsea"], diff:"moyen" },
  { name:"Lilian Thuram", clubs:["Monaco", "Parma", "Juventus", "Barcelona"], diff:"moyen" },
  { name:"William Gallas", clubs:["Chelsea", "Arsenal", "Tottenham"], diff:"moyen" },
  { name:"Frederic Kanoute", clubs:["West Ham", "Tottenham", "Sevilla"], diff:"moyen" },
  { name:"Yaya Toure", clubs:["Monaco", "Barcelona", "Manchester City"], diff:"facile" },
  { name:"Kolo Toure", clubs:["Arsenal", "Manchester City", "Liverpool"], diff:"moyen" },

  { name:"Oliver Kahn", clubs:["Bayern Munich"], diff:"facile" },
  { name:"Karl-Heinz Riedle", clubs:["Borussia Dortmund", "Liverpool"], diff:"moyen" },
  { name:"Stefan Effenberg", clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Lothar Matthaus", clubs:["Bayern Munich", "Inter Milan"], diff:"facile" },
  { name:"Jürgen Klinsmann", clubs:["Bayern Munich", "Tottenham"], diff:"moyen" },
  { name:"Alessandro Nesta", clubs:["Lazio", "AC Milan"], diff:"moyen" },
  { name:"Paolo Maldini", clubs:["AC Milan"], diff:"facile" },
  { name:"Franco Baresi", clubs:["AC Milan"], diff:"facile" },
  { name:"Andrea Pirlo", clubs:["Inter Milan", "AC Milan", "Juventus", "New York City FC"], diff:"facile" },
  { name:"Dida", clubs:["AC Milan"], diff:"moyen" },
  { name:"Rivaldo", clubs:["Deportivo", "Barcelona", "AC Milan"], diff:"facile" },
  { name:"Cafu", clubs:["Roma", "AC Milan"], diff:"facile" },
  { name:"Roberto Carlos", clubs:["Palmeiras", "Inter Milan", "Real Madrid", "Fenerbahce"], diff:"facile" },
  { name:"Lucio", clubs:["Bayer Leverkusen", "Bayern Munich", "Inter Milan"], diff:"moyen" },
  { name:"Figo", clubs:["Sporting CP", "Barcelona", "Real Madrid", "Inter Milan"], diff:"facile" },
  { name:"Simao Sabrosa", clubs:["Barcelona", "Atletico Madrid", "Besiktas"], diff:"moyen" },
  { name:"Raul", clubs:["Real Madrid", "Schalke"], diff:"facile" },
  { name:"Fernando Hierro", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Emilio Butragueno", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Jamie Carragher", clubs:["Liverpool"], diff:"moyen" },
  { name:"Robbie Fowler", clubs:["Liverpool", "Manchester City"], diff:"moyen" },
  { name:"Kevin Keegan", clubs:["Liverpool", "Newcastle"], diff:"moyen" },
  { name:"Peter Schmeichel", clubs:["Manchester United"], diff:"facile" },
  { name:"Roy Keane", clubs:["Manchester United", "Celtic"], diff:"facile" },
  { name:"Paul Scholes", clubs:["Manchester United"], diff:"facile" },
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
  { name:"Alessandro Del Piero", clubs:["Juventus"], diff:"facile" },
  { name:"Francesco Totti", clubs:["Roma"], diff:"facile" },
  { name:"Javier Zanetti", clubs:["Inter Milan"], diff:"moyen" },
  { name:"Nicola Ventola", clubs:["Bari", "Inter Milan", "Atalanta"], diff:"moyen" },
  { name:"Boudewijn Zenden", clubs:["Barcelona", "Chelsea", "Liverpool", "Marseille"], diff:"moyen" },
  { name:"Marc Wilmots", clubs:["Schalke", "Inter Milan"], diff:"moyen" },
  { name:"Johan Cruyff", clubs:["Ajax", "Barcelona"], diff:"facile" },
  { name:"Marco van Basten", clubs:["Ajax", "AC Milan"], diff:"facile" },
  { name:"Ruud Gullit", clubs:["AC Milan", "Chelsea"], diff:"facile" },
  { name:"Frank Rijkaard", clubs:["Ajax", "AC Milan"], diff:"moyen" },
  { name:"Ronald Koeman", clubs:["Ajax", "Barcelona"], diff:"moyen" },
  { name:"Romario", clubs:["Barcelona", "PSV"], diff:"facile" },
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
  { name:"Lassana Diarra", clubs:["Chelsea", "Arsenal", "Portsmouth", "Real Madrid", "Atletico Madrid", "Marseille", "PSG"], diff:"moyen" },
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
  { name:"Ben White", clubs:["Arsenal"], diff:"moyen" },
  { name:"Gabriel Magalhaes", clubs:["Lille", "Arsenal"], diff:"moyen" },
  { name:"David Raya", clubs:["Brentford", "Arsenal"], diff:"facile" },
  { name:"Alexander Isak", clubs:["Borussia Dortmund", "Real Sociedad", "Newcastle"], diff:"moyen" },
  { name:"Darwin Nunez", clubs:["Benfica", "Liverpool"], diff:"moyen" },
  { name:"Luis Diaz", clubs:["Porto", "Liverpool"], diff:"moyen" },
  { name:"Cody Gakpo", clubs:["PSV", "Liverpool"], diff:"facile" },
  { name:"Ryan Gravenberch", clubs:["Ajax", "Bayern Munich", "Liverpool"], diff:"facile" },
  { name:"Antonio Rudiger", clubs:["Stuttgart", "Roma", "Chelsea", "Real Madrid"], diff:"moyen" },
  { name:"Fabian Ruiz", clubs:["Napoli", "PSG"], diff:"facile" },
  { name:"Marco Asensio", clubs:["Real Madrid", "PSG"], diff:"facile" },
  { name:"Milan Skriniar", clubs:["Inter Milan", "PSG"], diff:"facile" },
  { name:"Hakan Calhanoglu", clubs:["AC Milan", "Inter Milan"], diff:"moyen" },
  { name:"Stefan de Vrij", clubs:["Lazio", "Inter Milan"], diff:"facile" },
  { name:"Alessandro Bastoni", clubs:["Inter Milan"], diff:"facile" },
  { name:"Ansu Fati", clubs:["Barcelona"], diff:"facile" },
  { name:"Ferran Torres", clubs:["Valencia", "Manchester City", "Barcelona"], diff:"facile" },
  { name:"Alexis Sanchez", clubs:["Udinese","Barcelona","Arsenal","Manchester United","Inter Milan","Marseille","Sevilla"], diff:"facile" },
  { name:"Mesut Ozil", clubs:["Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahce"], diff:"facile" },
  { name:"Per Mertesacker", clubs:["Werder Bremen", "Arsenal"], diff:"moyen" },
  { name:"Lars Bender", clubs:["Bayer Leverkusen"], diff:"moyen" },
  { name:"Sven Bender", clubs:["Borussia Dortmund", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Sergio Aguero", clubs:["Atletico Madrid", "Manchester City", "Barcelona"], diff:"facile" },
  { name:"Javier Mascherano", clubs:["Liverpool", "Barcelona"], diff:"moyen" },
  { name:"Goran Pandev", clubs:["Lazio", "Inter Milan", "Napoli", "Genoa"], diff:"moyen" },
  { name:"Diego Milito", clubs:["Genoa", "Inter Milan"], diff:"moyen" },
  { name:"Esteban Cambiasso", clubs:["Real Madrid", "Inter Milan"], diff:"moyen" },
  { name:"Julio Cesar", clubs:["Inter Milan"], diff:"moyen" },
  { name:"Maicon", clubs:["Monaco", "Inter Milan"], diff:"moyen" },

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
  { name:"Hugo Lloris", clubs:["Lyon", "Tottenham"], diff:"facile" },
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
  { name:"Andriy Shevchenko", clubs:["Dynamo Kyiv", "AC Milan", "Chelsea"], diff:"facile" },
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
  { name:"Scott Parker", clubs:["Charlton Athletic", "Chelsea", "Newcastle", "West Ham", "Tottenham", "Fulham"], diff:"expert" },
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
  { name:"Nacer Barazite", clubs:["Arsenal", "Twente"], diff:"expert" },
  { name:"David Villa", clubs:["Valencia","Barcelona","Atletico Madrid","New York City FC","Vissel Kobe"], diff:"facile" },
  { name:"Jordan Veretout", clubs:["Nantes","Aston Villa","Saint-Etienne","Fiorentina","Roma","Marseille","Lyon","Al Arabi"], diff:"moyen" },
  { name:"Bafetimbi Gomis", clubs:["Saint-Etienne","Lyon","Swansea","Marseille","Galatasaray","Al Hilal"], diff:"moyen" },
  { name:"Benjamin Mendy", clubs:["Le Havre","Marseille","Monaco","Manchester City"], diff:"moyen" },
  { name:"Aymen Abdennour", clubs:["Toulouse","Monaco","Valencia","Marseille"], diff:"expert" },
  { name:"Patrice Evra", clubs:["Nice","Monaco","Manchester United","Juventus","Marseille","West Ham"], diff:"facile" },
  { name:"Alexandre Lacazette", clubs:["Lyon","Arsenal"], diff:"moyen" },
  { name:"Emre Can", clubs:["Bayern Munich","Bayer Leverkusen","Liverpool","Juventus","Borussia Dortmund"], diff:"moyen" },
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

  for (const p of PLAYERS_CLEAN) {
    if(!p||!p.clubs)continue;
    const bigClubs = p.clubs.filter(c => PONT_CLUBS.has(c));
    if (bigClubs.length < 2) continue;

    // Toutes les paires possibles pour ce joueur — sans limite
    for (let i = 0; i < bigClubs.length; i++) {
      for (let j = i+1; j < bigClubs.length; j++) {
        const key = [bigClubs[i],bigClubs[j]].sort().join("|||");
        if (!pairMap[key]) pairMap[key] = { players:[], diff:p.diff };
        if (!pairMap[key].players.includes(p.name)) {
          pairMap[key].players.push(p.name);
        }
        // La difficulté de la question = le joueur le plus facile qui relie les deux clubs
        const ord = {facile:0,moyen:1,expert:2};
        if (ord[p.diff] < ord[pairMap[key].diff]) pairMap[key].diff = p.diff;
      }
    }
  }

  const db = {facile:[],moyen:[],expert:[]};
  for (const [key,val] of Object.entries(pairMap)) {
    const [c1,c2] = key.split("|||");
    db[val.diff].push({c1,c2,p:val.players});
  }
  for (const diff of ["facile","moyen","expert"]) {
    for (let i = db[diff].length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [db[diff][i],db[diff][j]] = [db[diff][j],db[diff][i]];
    }
  }
  return db;
}
const PLAYERS_CLEAN = PLAYERS.filter(function(p){return p&&p.name&&p.clubs&&Array.isArray(p.clubs);});
const DB = buildPontDB();

const CLUB_INDEX = {};
for (const p of PLAYERS_CLEAN) {
  if(!p||!p.clubs)continue;
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

  const playerEntry = PLAYERS_CLEAN.find(p => p.name === name);
  const mainClub = (playerEntry&&playerEntry.clubs&&playerEntry.clubs[0]) || "";
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
  "Napoli": "data:image/png;base64,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",
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
  "Monaco": "data:image/png;base64,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",
  "Lille": "https://crests.football-data.org/521.svg",
  "Benfica": "data:image/png;base64,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",
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
    <img src={logo} alt={club} style={{width:size,height:size,objectFit:"contain",filter:"drop-shadow(0 2px 6px rgba(0,0,0,.3))"}}
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
    const pageTitle = searchData&&searchData.query&&searchData.query.search&&searchData.query.search[0]&&searchData.query.search[0].title;
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
  const [ca, cb] = fallbackColors || ["#2d6a4f","#1b4332"];

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
function getPlayerClubs(name){const p=PLAYERS_CLEAN.find(x=>x.name===name);return p?p.clubs:[];}
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
    @keyframes splashRoll{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes dropIn{from{opacity:0;transform:translateY(-70px) scale(1.3)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes lineExpand{from{width:0}to{width:260px}}
    @keyframes splashLoad{0%{width:0%}100%{width:100%}}
    @keyframes splashBounceIn{0%{opacity:0;transform:scale(0.3) translateY(-80px)}60%{opacity:1;transform:scale(1.15) translateY(10px)}80%{transform:scale(0.95) translateY(-5px)}100%{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes splashPulse{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.08) rotate(2deg)}}
    @keyframes splashTitle{0%{opacity:0;transform:translateY(30px) scale(0.8)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes splashFadeOut{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.15)}}
    @keyframes splashGlow{0%,100%{box-shadow:0 0 40px rgba(0,230,118,.3),0 0 80px rgba(0,230,118,.1)}50%{box-shadow:0 0 60px rgba(0,230,118,.6),0 0 120px rgba(0,230,118,.2)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes popIn{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
    @keyframes scoreUp{0%{transform:scale(1)}50%{transform:scale(1.5);color:#4ade80}100%{transform:scale(1)}}
    @keyframes scoreDn{0%{transform:scale(1)}50%{transform:scale(1.3);color:#ef4444}100%{transform:scale(1)}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes comboFire{0%{transform:scale(1) rotate(0)}25%{transform:scale(1.3) rotate(-3deg)}50%{transform:scale(1.1) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
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
    @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:.6}} @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    html,body,#root{background:#1E5C2A!important;min-height:100vh;min-height:100dvh;}
    html{background:#1E5C2A!important;}
    #root{background-image:repeating-linear-gradient(90deg,#1E5C2A 0,#1E5C2A 14.28%,#276B34 14.28%,#276B34 28.57%,#1E5C2A 28.57%,#1E5C2A 42.86%,#276B34 42.86%,#276B34 57.14%,#1E5C2A 57.14%,#1E5C2A 71.43%,#276B34 71.43%,#276B34 85.71%,#1E5C2A 85.71%)!important;padding-top:env(safe-area-inset-top);}
  `;
  document.head.appendChild(s);
}

// ── NOTIFICATIONS ──
const NOTIF_MESSAGES = [
  { title:"⚽ GOAT FC t'attend !", body:"Tu connais tous les transferts ? Prouve-le !" },
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
      tag: "goatfc-reminder",
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
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState("home");
  const [gameMode, setGameMode] = useState("pont");
  const [diff, setDiff] = useState("facile");
  const [totalRounds, setTotalRounds] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundScores, setRoundScores] = useState([]);
  const [roomRoundSnapshot, setRoomRoundSnapshot] = useState(null); // scores adversaires fin de manche
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

  const [myLastPts, setMyLastPts] = useState(null);
  const [wasAway, setWasAway] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [lbMode, setLbMode] = useState("global");
  const [lbDiff, setLbDiff] = useState("facile");
  const [playerName, setPlayerName] = useState("");
  const [showInstructions, setShowInstructions] = useState(null);
  // Friends
  const [playerId] = useState(() => getPlayerId());
  const [showFriends, setShowFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null); // {id, name}
  const [confirmRemove, setConfirmRemove] = useState(null); // {id, name}
  const [friendInput, setFriendInput] = useState("");
  const [friendsList, setFriendsList] = useState([]);
  const [friendScores, setFriendScores] = useState([]);
  const [friendMsg, setFriendMsg] = useState("");
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]); // incoming pending requests
  const [sentRequests, setSentRequests] = useState(function(){ try { return JSON.parse(localStorage.getItem("bb_pending_sent") || "[]"); } catch { return []; } });     // requests I sent
  // Duels
  const [duels, setDuels] = useState([]);
  const [duelLoading, setDuelLoading] = useState(false);
  const [showDuelCreate, setShowDuelCreate] = useState(null); // friend object
  const [duelMode, setDuelMode] = useState("pont");
  const [duelDiff, setDuelDiff] = useState("facile");
  const [duelRounds, setDuelRounds] = useState(1);
  const [activeDuel, setActiveDuel] = useState(null); // duel being played
  const activeDuelRef = useRef(null);
  const [duelResult, setDuelResult] = useState(null); // completed duel for result screen
  const [waitingDuel, setWaitingDuel] = useState(null); // duel in waiting room
  // Room system (multi-player up to 8)
  const [room, setRoom] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const [roomMsg, setRoomMsg] = useState("");
  const [showRoomCreate, setShowRoomCreate] = useState(false);
  const roomPollRef = useRef(null);
  const [duelCountdown, setDuelCountdown] = useState(null); // 3..2..1 before launch
  const duelPollRef = useRef(null);
  const countdownRef = useRef(null);

  const [qTimeLeft, setQTimeLeft] = useState(5);
  const [pseudoScreen, setPseudoScreen] = useState(false); // show pseudo creation screen
  const [pseudoInput, setPseudoInput] = useState("");
  const [pseudoChecking, setPseudoChecking] = useState(false);
  const [pseudoMsg, setPseudoMsg] = useState("");
  const [pseudoConfirmed, setPseudoConfirmed] = useState(() => { try { const n = localStorage.getItem("bb_name"); return !!(n && n.trim().length >= 2); } catch { return false; } });
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [gameConfigModal, setGameConfigModal] = useState(null);
  const [activeCard, setActiveCard] = useState("pont");
  const [swipeDelta, setSwipeDelta] = useState(0); // "pont" | "chaine" | "room-pont" | "room-chaine"
  const [waitingForRoom, setWaitingForRoom] = useState(false);
  const qTimerRef = useRef(null);
  const chainPassedRef = useRef(false);
  const handlePassRef = useRef(null);
  const handleChainPassRef = useRef(null);
  const roundStartTime = useRef(null);
  const seenInstructions = useRef(new Set());
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const scoreRef = useRef(0);
  const chainScoreRef = useRef(0);
  const comboRef = useRef(0);
  const lastAnswerTime = useRef(Date.now());
  const historyEndRef = useRef(null);
  const hasEndedRef = useRef(false);
  const queueRef = useRef([]);
  const chainLogoRef = useRef({});


  useEffect(() => {
    try {
      const r = localStorage.getItem("bb_record"); if(r) setRecord(JSON.parse(r));
      const cr = localStorage.getItem("bb_chain_record"); if(cr) setChainRecord(JSON.parse(cr));
      const n = localStorage.getItem("bb_name"); if(n) setPlayerName(n);
      const seen = localStorage.getItem("bb_seen"); if(seen) JSON.parse(seen).forEach(s=>seenInstructions.current.add(s));
    } catch {}
    loadLeaderboard("pont");
    loadFriends().then(function(ids){fetchFriendScores(ids);});
    loadDuels();
    loadFriendRequests();
    // Fermer le splash après 2.5s
    setTimeout(function(){setShowSplash(false);}, 2500);
  }, []);



  // Load pseudo silently on mount
  useEffect(() => {
    (async function() {
      try {
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
        if (Array.isArray(mine) && mine.length > 0) {
          setPlayerName(mine[0].pseudo);
          try { localStorage.setItem("bb_name", mine[0].pseudo); } catch {}
          setPseudoConfirmed(true);
        } else {
          const saved = localStorage.getItem("bb_name");
          if (saved && saved.trim().length >= 2) setPlayerName(saved);
        }
      } catch {}
    })();
  }, []);

  // Poll for friend requests and duels every 15s
  useEffect(() => {
    const poll = setInterval(function() {
      loadFriendRequests();
      loadDuels();
    }, 15000);
    return () => {
      clearInterval(poll);
      clearInterval(duelPollRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(()=>{scoreRef.current=score;},[score]);
  useEffect(()=>{comboRef.current=combo;},[combo]);
  useEffect(()=>{if(historyEndRef.current)historyEndRef.current.scrollIntoView({behavior:"smooth"});},[chainHistory]);

  // Timer

  // Question timer (Le Pont + La Chaîne)
  useEffect(()=>{
    chainPassedRef.current = false;
    clearInterval(qTimerRef.current);
    if(screen!=="game"&&screen!=="chainGame"){clearInterval(qTimerRef.current);return;}
    const duration = screen==="chainGame" ? CHAIN_QUESTION_DURATION : QUESTION_DURATION;
    const qStart = Date.now();
    const capturedChainCount = chainCount;
    chainPassedRef.current = false;
    setQTimeLeft(duration);
    clearInterval(qTimerRef.current);
    qTimerRef.current=setInterval(()=>{
      const elapsed = Math.floor((Date.now() - qStart) / 1000);
      const remaining = Math.max(duration - elapsed, 0);
      setQTimeLeft(remaining);
      if(remaining <= 0){
        clearInterval(qTimerRef.current);
        if(screen==="chainGame"){
          if(!chainPassedRef.current && capturedChainCount === chainCount){
            handleChainPassRef.current && handleChainPassRef.current();
          }
        } else {
          handlePassRef.current && handlePassRef.current();
        }
      }
    },300);
    return()=>clearInterval(qTimerRef.current);
  },[screen,animKey,chainCount]);

  useEffect(()=>{
    if(screen!=="game"&&screen!=="chainGame"){hasEndedRef.current=false;return;}
    hasEndedRef.current=false;
    clearInterval(timerRef.current);
    const duration = screen==="chainGame" ? CHAIN_DURATION : ROUND_DURATION;
    roundStartTime.current = Date.now();
    timerRef.current=setInterval(()=>{
      if(!roundStartTime.current) roundStartTime.current = Date.now();
      const elapsed = Math.floor((Date.now() - roundStartTime.current) / 1000);
      const remaining = Math.max(duration - elapsed, 0);
      setTimeLeft(remaining);
    },500);
    return()=>clearInterval(timerRef.current);
  },[screen,currentRound]);

  useEffect(()=>{
    if((screen!=="game"&&screen!=="chainGame")||timeLeft>0||hasEndedRef.current)return;
    hasEndedRef.current=true;
    
    if(screen==="game")endRound();
    else endChain();
  },[screen,timeLeft]);


  // Leaderboard (localStorage)
  // ── DUEL FUNCTIONS ──
  async function loadDuels() {
    try {
      const data = await sbFetch("bb_duels?or=(challenger_id.eq." + playerId + ",opponent_id.eq." + playerId + ")&order=created_at.desc&limit=20");
      setDuels(Array.isArray(data) ? data : []);
    } catch(e) { setDuels([]); }
  }

  async function createDuel(friend) {
    const name = (playerName || "Anonyme").trim();
    try {
      await sbFetch("bb_duels", {
        method: "POST",
        body: JSON.stringify({
          challenger_id: playerId,
          challenger_name: name,
          opponent_id: friend.id,
          opponent_name: friend.name,
          mode: duelMode,
          diff: duelDiff,
          rounds: duelRounds,
          status: "waiting",
        })
      });
      setShowDuelCreate(null);
      // Enter waiting room
      const data = await sbFetch("bb_duels?challenger_id=eq."+playerId+"&status=eq.waiting&order=created_at.desc&limit=1");
      if (Array.isArray(data) && data.length > 0) {
        setWaitingDuel(data[0]);
        startDuelPolling(data[0]);
      } else {
        loadDuels();
      }
    } catch(e) { console.error(e); }
  }

  function startDuelPolling(duel) {
    clearInterval(duelPollRef.current);
    duelPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_duels?id=eq."+duel.id+"&select=id,status,challenger_id,opponent_id,challenger_name,opponent_name,mode,diff,rounds,challenger_score,opponent_score");
        if (!Array.isArray(data) || data.length === 0) return;
        const updated = data[0];
        setWaitingDuel(updated);
        if (updated.status === "ready") {
          clearInterval(duelPollRef.current);
          startCountdown(updated);
        }
      } catch(e) {}
    }, 3000);
  }

  function startCountdown(duel) {
    setDuelCountdown(3);
    let count = 3;
    countdownRef.current = setInterval(function() {
      count--;
      setDuelCountdown(count);
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setDuelCountdown(null);
        setWaitingDuel(null);
        playDuel(duel);
      }
    }, 1000);
  }

  async function joinDuel(duel) {
    try {
      await sbFetch("bb_duels?id=eq."+duel.id, {
        method: "PATCH",
        body: JSON.stringify({status: "ready"}),
        headers: {"Prefer": "return=minimal"}
      });
      const readyDuel = Object.assign({}, duel, {status: "ready"});
      setWaitingDuel(readyDuel);
      // Opponent starts countdown immediately (they just set status to ready)
      startCountdown(readyDuel);
    } catch(e) { console.error(e); }
  }

  function cancelWaiting() {
    clearInterval(duelPollRef.current);
    clearInterval(countdownRef.current);
    if (waitingDuel) {
      sbFetch("bb_duels?id=eq."+waitingDuel.id, {
        method: "PATCH",
        body: JSON.stringify({status: "cancelled"}),
        headers: {"Prefer": "return=minimal"}
      }).catch(function(){});
    }
    setWaitingDuel(null);
    setDuelCountdown(null);
    loadDuels();
  }
  async function playDuel(duel) {
    setActiveDuel(duel);
    activeDuelRef.current = duel;
    setTotalRounds(duel.rounds || 1);
    setShowFriends(false);
    const isChallenger = duel.challenger_id === playerId;
    if (duel.mode === "chaine") {
      if (duel.diff) setDiff(duel.diff);
      startChain();
    } else {
      const duelDiffVal = duel.diff || "facile";
      setDiff(duelDiffVal);
      setCombo(0); setMaxCombo(0); comboRef.current = 0;
      lastAnswerTime.current = Date.now();
      setRoundScores([]); setCurrentRound(1);
      setIsNewRecord(false); setMyLbRank(null);
      setTimeout(function() { startRound(1); }, 50);
    }
    // Poll pour détecter si l'adversaire abandonne
    clearInterval(duelPollRef.current);
    duelPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_duels?id=eq."+duel.id+"&select=status,abandoned_by,challenger_score,opponent_score");
        if (!Array.isArray(data) || data.length === 0) return;
        const updated = data[0];
        if (updated.status === "complete" && updated.abandoned_by && updated.abandoned_by !== playerId) {
          clearInterval(duelPollRef.current);
          clearInterval(timerRef.current);
          clearInterval(qTimerRef.current);
          setActiveDuel(null);
          // Adversaire a abandonné — on est vainqueur
          const myScore = isChallenger ? (updated.challenger_score ?? 1) : (updated.opponent_score ?? 1);
          const theirScore = isChallenger ? (updated.opponent_score ?? 0) : (updated.challenger_score ?? 0);
          const oppName = isChallenger ? duel.opponent_name : duel.challenger_name;
          setDuelResult({ myScore, theirScore, oppName, mode: duel.mode, opponentAbandoned: true });
        }
      } catch(e) {}
    }, 3000);
  }

  async function abandonDuel() {
    if (!activeDuel) return;
    const duelId = activeDuel.id;
    const isChallenger = activeDuel.challenger_id === playerId;
    // Abandonner = score 0 pour moi, score garanti > 0 pour l'adversaire
    const update = isChallenger
      ? { challenger_score: 0, opponent_score: activeDuel.opponent_score ?? 1, status: "complete", abandoned_by: playerId }
      : { opponent_score: 0, challenger_score: activeDuel.challenger_score ?? 1, status: "complete", abandoned_by: playerId };
    setActiveDuel(null);
    try {
      await sbFetch("bb_duels?id=eq." + duelId, {
        method: "PATCH",
        body: JSON.stringify(update),
        headers: {"Prefer": "return=minimal"}
      });
      loadDuels();
    } catch(e) { console.error("Abandon error:", e); }
  }

  async function submitDuelScore(sc) {
    if (!activeDuel) return;
    const duelId = activeDuel.id;
    const duelCopy = Object.assign({}, activeDuel);
    const isChallenger = activeDuel.challenger_id === playerId;
    const otherScore = isChallenger ? activeDuel.opponent_score : activeDuel.challenger_score;
    const newStatus = (otherScore !== null && otherScore !== undefined) ? "complete" : (isChallenger ? "challenger_played" : "opponent_played");
    const update = isChallenger ? { challenger_score: sc, status: newStatus } : { opponent_score: sc, status: newStatus };
    setActiveDuel(null);
    try {
      await sbFetch("bb_duels?id=eq." + duelId, {
        method: "PATCH",
        body: JSON.stringify(update),
        headers: {"Prefer": "return=minimal"}
      });
      // If duel is now complete, build result object and show result screen
      if (newStatus === "complete") {
        const myScore = sc;
        const theirScore = otherScore;
        const oppName = isChallenger ? duelCopy.opponent_name : duelCopy.challenger_name;
        setDuelResult({ myScore, theirScore, oppName, mode: duelCopy.mode });
      }
      loadDuels();
    } catch(e) { console.error("Duel score submit error:", e); }
  }

  function getPendingDuels() {
    // For opponent: show duels where challenger is waiting for them to join
    return duels.filter(function(d) {
      if (d.challenger_id === playerId) return false; // challenger handles via waitingDuel state
      return d.status === "waiting"; // opponent sees "join" invite
    });
  }


  // ── ROOM FUNCTIONS (multi up to 8) ──
  function makeRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:6}, function(){return chars[Math.floor(Math.random()*chars.length)];}).join("");
  }

  async function createRoom() {
    const name = (playerName||"Anonyme").trim();
    const code = makeRoomCode();
    const me = [{id:playerId, name:name, score:null, status:"waiting"}];
    setRoomMsg("Création en cours...");
    try {
      const created = await sbFetch("bb_rooms", {
        method: "POST",
        body: JSON.stringify({
          code: code,
          host_id: playerId,
          host_name: name,
          mode: duelMode,
          diff: duelDiff,
          rounds: duelRounds,
          status: "waiting",
          players: me
        }),
        headers: {"Prefer": "return=representation"}
      });
      const roomData = Array.isArray(created) ? created[0] : null;
      if (roomData && roomData.id) {
        setRoom(roomData);
        setShowRoomCreate(false);
        setRoomMsg("");
        startRoomPolling(roomData.id);
      } else {
        // Fallback: fetch by code
        const data = await sbFetch("bb_rooms?code=eq."+code+"&limit=1");
        if (Array.isArray(data) && data.length > 0) {
          setRoom(data[0]);
          setShowRoomCreate(false);
          setRoomMsg("");
          startRoomPolling(data[0].id);
        } else {
          setRoomMsg("Erreur: impossible de créer la salle");
        }
      }
    } catch(e) {
      setRoomMsg("Erreur: "+e.message);
    }
  }


  async function joinRoom(code) {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) { setRoomMsg("Code invalide"); return; }
    const name = (playerName||"Anonyme").trim();
    try {
      const data = await sbFetch("bb_rooms?code=eq."+clean+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) { setRoomMsg("Salle introuvable"); return; }
      const r = data[0];
      if (r.status !== "waiting") { setRoomMsg("Partie déjà lancée !"); return; }
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      if (players.length >= 8) { setRoomMsg("Salle pleine (8/8)"); return; }
      if (players.find(function(p){return p.id===playerId;})) {
        setRoom(r); startRoomPolling(r.id); return;
      }
      const newPlayers = [...players, {id:playerId, name:name, score:null, status:"waiting"}];
      await sbFetch("bb_rooms?id=eq."+r.id, {
        method:"PATCH",
        body:JSON.stringify({players:JSON.stringify(newPlayers)}),
        headers:{"Prefer":"return=minimal"}
      });
      const updated = await sbFetch("bb_rooms?id=eq."+r.id+"&limit=1");
      if (Array.isArray(updated) && updated.length > 0) {
        setRoom(updated[0]);
        setRoomInput("");
        setRoomMsg("");
        startRoomPolling(r.id);
      }
    } catch(e) { console.error(e); setRoomMsg("Erreur connexion"); }
  }

  function startRoomPolling(roomId) {
    clearInterval(roomPollRef.current);
    let gameStarted = false;
    roomPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const r = data[0];
        setRoom(r);
        if (r.status === "playing" && !gameStarted) {
          gameStarted = true;
          clearInterval(roomPollRef.current);
          setRoom(r);
          startRoomCountdown(r);
        } else if (r.status === "complete" || r.status === "scoring") {
          clearInterval(roomPollRef.current);
        }
      } catch(e) {}
    }, 2000);
  }

  function startRoomCountdown(r) {
    setDuelCountdown(3);
    let count = 3;
    countdownRef.current = setInterval(function() {
      count--;
      setDuelCountdown(count);
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setDuelCountdown(null);
        launchRoomGame(r);
      }
    }, 1000);
  }

  function launchRoomGame(r) {
    clearInterval(roomPollRef.current); // stopper le polling lobby
    setRoom(null);
    const roomDuel = {id:r.id, isRoom:true, challenger_id:r.host_id, mode:r.mode, diff:r.diff, rounds:r.rounds};
    setActiveDuel(roomDuel);
    activeDuelRef.current = roomDuel;
    setTotalRounds(r.rounds || 1);
    if (r.mode === "chaine") {
      if (r.diff) setDiff(r.diff);
      startChain();
    } else {
      setDiff(r.diff || "facile");
      setCombo(0); setMaxCombo(0); comboRef.current = 0;
      lastAnswerTime.current = Date.now();
      setRoundScores([]); setCurrentRound(1);
      setIsNewRecord(false); setMyLbRank(null);
      setTimeout(function(){ startRound(1); }, 50);
    }
  }

  async function startRoomGame() {
    if (!room) return;
    clearInterval(roomPollRef.current); // stopper le polling AVANT le patch
    try {
      await sbFetch("bb_rooms?id=eq."+room.id, {
        method:"PATCH",
        body:JSON.stringify({status:"playing"}),
        headers:{"Prefer":"return=minimal"}
      });
      startRoomCountdown(room);
    } catch(e) { console.error(e); }
  }

  async function pushRoundScore(roundScore) {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    try {
      const data = await sbFetch("bb_rooms?id=eq."+duel.id+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) return;
      const r = data[0];
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      const updated = players.map(function(p) {
        return p.id === playerId
          ? Object.assign({}, p, {partial_score: scoreRef.current})
          : p;
      });
      await sbFetch("bb_rooms?id=eq."+duel.id, {
        method: "PATCH",
        body: JSON.stringify({players: JSON.stringify(updated)}),
        headers: {"Prefer": "return=minimal"}
      });
      // Attendre un peu que les autres envoient leur score partiel, puis fetch
      setTimeout(async function() {
        try {
          const snap = await sbFetch("bb_rooms?id=eq."+duel.id+"&limit=1");
          if (Array.isArray(snap) && snap.length > 0) {
            const snapPlayers = typeof snap[0].players === "string" ? JSON.parse(snap[0].players) : snap[0].players;
            const sorted = [...snapPlayers].sort(function(a,b){return (b.partial_score||0)-(a.partial_score||0);});
            setRoomRoundSnapshot(sorted);
          }
        } catch(e) {}
      }, 2000);
    } catch(e) {}
  }


  async function submitRoomScore(sc) {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    const roomId = duel.id;
    setWaitingForRoom(true);
    setActiveDuel(null);
    activeDuelRef.current = null;
    try {
      const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) { setWaitingForRoom(false); return; }
      const r = data[0];
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      const updated = players.map(function(p){
        return p.id === playerId ? Object.assign({}, p, {score:sc, status:"done"}) : p;
      });
      const allDone = updated.every(function(p){return p.status==="done";});
      await sbFetch("bb_rooms?id=eq."+roomId, {
        method:"PATCH",
        body:JSON.stringify({players:JSON.stringify(updated), status:allDone?"complete":"scoring"}),
        headers:{"Prefer":"return=minimal"}
      });
      if (allDone) {
        // On est le dernier — afficher les résultats directement
        const finalData = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (Array.isArray(finalData) && finalData.length > 0) {
          showRoomResults(finalData[0]);
        }
      } else {
        // Attendre les autres via polling
        startRoomResultPolling(roomId);
      }
    } catch(e) { console.error(e); setWaitingForRoom(false); }
  }

  function startRoomResultPolling(roomId) {
    const poll = setInterval(async function() {
      try {
        const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const r = data[0];
        const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
        const allDone = players.every(function(p){return p.status==="done";});
        if (allDone) {
          clearInterval(poll);
          // S'assurer que le status est bien complete dans Supabase
          await sbFetch("bb_rooms?id=eq."+roomId, {
            method:"PATCH",
            body:JSON.stringify({status:"complete"}),
            headers:{"Prefer":"return=minimal"}
          });
          showRoomResults(r);
        }
      } catch(e) {}
    }, 2000);
  }

  function showRoomResults(r) {
    setWaitingForRoom(false);
    setScreen("home");
    const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
    const sorted = [...players].sort(function(a,b){return (b.score||0)-(a.score||0);});
    setDuelResult({isRoom:true, players:sorted, mode:r.mode});
    setActiveDuel(null);
    activeDuelRef.current = null;
    setRoom(null);
  }

  function leaveRoom() {
    clearInterval(roomPollRef.current);
    clearInterval(countdownRef.current);
    setRoom(null);
    setRoomMsg("");
    setDuelCountdown(null);
  }


  // ── PSEUDO FUNCTIONS ──
  async function checkAndSavePseudo(pseudo) {
    const clean = pseudo.trim();
    if (clean.length < 2) { setPseudoMsg("Minimum 2 caractères"); return; }
    if (clean.length > 20) { setPseudoMsg("Maximum 20 caractères"); return; }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(clean)) { setPseudoMsg("Lettres, chiffres, _ - . uniquement"); return; }
    setPseudoChecking(true);
    setPseudoMsg("Vérification...");
    try {
      // Check if pseudo already taken
      const existing = await sbFetch("bb_pseudos?pseudo=eq."+encodeURIComponent(clean)+"&limit=1");
      if (Array.isArray(existing) && existing.length > 0) {
        if (existing[0].player_id === playerId) {
          // It's mine - confirm it
          setPseudoConfirmed(true);
          setPseudoScreen(false);
          setPlayerName(clean);
          try { localStorage.setItem("bb_name", clean); } catch {}
          setPseudoMsg("");
        } else {
          setPseudoMsg("❌ Ce pseudo est déjà pris !");
        }
        setPseudoChecking(false);
        return;
      }
      // Check if I already have a pseudo
      const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
      if (Array.isArray(mine) && mine.length > 0) {
        // Update existing pseudo
        await sbFetch("bb_pseudos?player_id=eq."+playerId, {
          method: "PATCH",
          body: JSON.stringify({pseudo: clean}),
          headers: {"Prefer": "return=minimal"}
        });
      } else {
        // Create new pseudo
        await sbFetch("bb_pseudos", {
          method: "POST",
          body: JSON.stringify({player_id: playerId, pseudo: clean})
        });
      }
      setPlayerName(clean);
      try { localStorage.setItem("bb_name", clean); } catch {}
      setPseudoConfirmed(true);
      setPseudoScreen(false);
      setPseudoMsg("✓ Pseudo réservé !");
    } catch(e) {
      setPseudoMsg("Erreur: "+e.message);
    }
    setPseudoChecking(false);
  }

  async function initPseudo() {
    // Check if player already has a confirmed pseudo
    const saved = (() => { try { return localStorage.getItem("bb_name"); } catch { return null; } })();
    if (saved && saved.trim().length >= 2) {
      // Verify it's still valid in DB
      try {
        const mine = await sbFetch("bb_pseudos?player_id=eq."+playerId+"&limit=1");
        if (Array.isArray(mine) && mine.length > 0) {
          setPlayerName(mine[0].pseudo);
          localStorage.setItem("bb_name", mine[0].pseudo);
          setPseudoConfirmed(true);
          return;
        }
      } catch {}
    }
    // No pseudo yet - show pseudo screen
    setPseudoScreen(true);
  }


  // ── FRIEND FUNCTIONS ──
  async function loadFriends() {
    try {
      const stored = localStorage.getItem("bb_friends");
      let ids = stored ? JSON.parse(stored) : [];
      // Blacklist des amis supprimés explicitement
      const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
      // Sync depuis Supabase : demandes acceptées envoyées par moi
      const accepted = await sbFetch("bb_friend_requests?from_id=eq."+playerId+"&status=eq.accepted&select=to_id,to_name");
      if (Array.isArray(accepted)) {
        const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
        accepted.forEach(function(r) {
          if (!ids.includes(r.to_id) && !removed.includes(r.to_id)) {
            ids.push(r.to_id);
            if (r.to_name) names[r.to_id] = r.to_name;
          }
        });
        localStorage.setItem("bb_friend_names", JSON.stringify(names));
      }
      // Sync depuis Supabase : demandes acceptées reçues par moi
      const received = await sbFetch("bb_friend_requests?to_id=eq."+playerId+"&status=eq.accepted&select=from_id,from_name");
      if (Array.isArray(received)) {
        const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
        received.forEach(function(r) {
          if (!ids.includes(r.from_id) && !removed.includes(r.from_id)) {
            ids.push(r.from_id);
            if (r.from_name) names[r.from_id] = r.from_name;
          }
        });
        localStorage.setItem("bb_friend_names", JSON.stringify(names));
      }
      // Filtrer aussi les ids existants qui auraient été supprimés
      ids = ids.filter(function(id){ return !removed.includes(id); });
      localStorage.setItem("bb_friends", JSON.stringify(ids));
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

  async function addFriend(pseudo) {
    const clean = pseudo.trim();
    if (clean.length < 2) { setFriendMsg("Pseudo trop court"); return; }
    if (clean.toLowerCase() === (playerName||"").toLowerCase()) { setFriendMsg("C'est ton propre pseudo !"); return; }
    setFriendMsg("🔍 Recherche...");
    try {
      // Chercher le player_id correspondant au pseudo
      const result = await sbFetch("bb_pseudos?pseudo=ilike."+encodeURIComponent(clean)+"&limit=1");
      if (!Array.isArray(result) || result.length === 0) {
        setFriendMsg("❌ Pseudo introuvable. Vérifie l'orthographe.");
        return;
      }
      const targetId = result[0].player_id;
      const targetName = result[0].pseudo;
      if (targetId === playerId) { setFriendMsg("C'est ton propre pseudo !"); return; }
      if (friendsList.includes(targetId)) { setFriendMsg("Vous êtes déjà amis !"); return; }
      const alreadySent = sentRequests.find(function(r){return r.to_id===targetId && r.status==="pending";});
      if (alreadySent) { setFriendMsg("Demande déjà envoyée à "+targetName+" !"); return; }
      const name = (playerName||"Anonyme").trim();
      // Upsert la demande
      const res = await fetch(SB_URL + "/rest/v1/bb_friend_requests", {
        method: "POST",
        headers: {
          "apikey": SB_KEY,
          "Authorization": "Bearer " + SB_KEY,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({from_id:playerId, from_name:name, to_id:targetId, to_name:targetName, status:"pending"})
      });
      if (!res.ok && res.status !== 201) {
        setFriendMsg("❌ Erreur. Réessaie.");
        return;
      }
      setFriendMsg("✓ Demande envoyée à "+targetName+" !");
      setFriendInput("");
      // Retirer de la blacklist si besoin
      try {
        const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
        localStorage.setItem("bb_removed_friends", JSON.stringify(removed.filter(function(id){return id!==targetId;})));
      } catch {}
      // Persister localement
      try {
        const pending = JSON.parse(localStorage.getItem("bb_pending_sent") || "[]");
        if (!pending.find(function(p){return p.to_id===targetId;})) {
          pending.push({id:"tmp-"+Date.now(), from_id:playerId, to_id:targetId, status:"pending"});
          localStorage.setItem("bb_pending_sent", JSON.stringify(pending));
        }
      } catch {}
      setSentRequests(function(prev){return [...prev, {id:"tmp-"+Date.now(), from_id:playerId, to_id:targetId, to_name:targetName, status:"pending"}];});
    } catch(e) { setFriendMsg("❌ Erreur réseau. Réessaie."); }
  }

  async function acceptRequest(req) {
    try {
      await sbFetch("bb_friend_requests?id=eq."+req.id, {
        method: "PATCH",
        body: JSON.stringify({status:"accepted"}),
        headers: {"Prefer":"return=minimal"}
      });
      // Add to local friends list (save id and name)
      const newList = [...friendsList, req.from_id];
      localStorage.setItem("bb_friends", JSON.stringify(newList));
      // Save friend name
      try {
        const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
        names[req.from_id] = req.from_name;
        localStorage.setItem("bb_friend_names", JSON.stringify(names));
        // Retirer de la blacklist si l'ami avait été supprimé avant
        const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
        localStorage.setItem("bb_removed_friends", JSON.stringify(removed.filter(function(id){return id!==req.from_id;})));
      } catch {}
      setFriendsList(newList);
      fetchFriendScores(newList);
      loadFriendRequests();
    } catch(e) { console.error(e); }
  }

  async function declineRequest(req) {
    try {
      await sbFetch("bb_friend_requests?id=eq."+req.id, {
        method: "PATCH",
        body: JSON.stringify({status:"declined"}),
        headers: {"Prefer":"return=minimal"}
      });
      loadFriendRequests();
    } catch(e) { console.error(e); }
  }

  async function removeFriend(fid) {
    const newList = friendsList.filter(function(id){return id !== fid;});
    localStorage.setItem("bb_friends", JSON.stringify(newList));
    // Ajouter à la blacklist pour éviter la re-sync depuis Supabase
    try {
      const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
      if (!removed.includes(fid)) removed.push(fid);
      localStorage.setItem("bb_removed_friends", JSON.stringify(removed));
      // Nettoyer aussi les demandes pending locales
      const pending = JSON.parse(localStorage.getItem("bb_pending_sent") || "[]");
      localStorage.setItem("bb_pending_sent", JSON.stringify(pending.filter(function(p){return p.to_id!==fid;})));
    } catch {}
    setFriendsList(newList);
    fetchFriendScores(newList);
    // Nettoie les demandes dans Supabase dans les deux sens
    try {
      await sbFetch("bb_friend_requests?from_id=eq."+playerId+"&to_id=eq."+fid, {method:"DELETE"});
      await sbFetch("bb_friend_requests?from_id=eq."+fid+"&to_id=eq."+playerId, {method:"DELETE"});
      loadFriendRequests();
    } catch(e) { console.error(e); }
  }

  async function loadFriendRequests() {
    try {
      const incoming = await sbFetch("bb_friend_requests?to_id=eq."+playerId+"&status=eq.pending&order=created_at.desc");
      if (Array.isArray(incoming)) setFriendRequests(incoming);
      const sent = await sbFetch("bb_friend_requests?from_id=eq."+playerId+"&order=created_at.desc&limit=20");
      // Charger les demandes en attente persistées localement
      let localPending = [];
      try { localPending = JSON.parse(localStorage.getItem("bb_pending_sent") || "[]"); } catch {}
      if (Array.isArray(sent)) {
        // Retirer du localStorage les demandes qui ont été traitées (acceptée/refusée/trouvée dans Supabase)
        const updatedLocal = localPending.filter(function(p) {
          const found = sent.find(function(s){return s.to_id===p.to_id;});
          return !found; // garder seulement celles absentes de Supabase
        });
        try { localStorage.setItem("bb_pending_sent", JSON.stringify(updatedLocal)); } catch {}
        // Merger : entrées locales + résultats Supabase
        const merged = [...updatedLocal, ...sent];
        setSentRequests(merged);
      } else {
        // Supabase inaccessible : afficher au moins les locales
        setSentRequests(function(prev) {
          const existingIds = prev.map(function(r){return r.to_id;});
          const toAdd = localPending.filter(function(p){return !existingIds.includes(p.to_id);});
          return [...prev, ...toAdd];
        });
      }
    } catch(e) { console.error(e); }
  }

  async function submitScore(name, sc, mode, d) {
    try {
      await sbFetch("bb_scores", {
        method: "POST",
        body: JSON.stringify({player_id:playerId, player_name:(name||"Anonyme").trim(), score:sc, mode:mode, diff:d||null})
      });
    } catch(e) { console.error(e); }
  }


  async function loadLeaderboard(mode) {
    try {
      const isGlobal = mode === "global";
      const filter = (!mode || isGlobal) ? "" : "mode=eq."+mode+"&";
      const data = await sbFetch("bb_scores?"+filter+"order=score.desc&limit=1000&select=player_id,player_name,score,mode");
      if (!Array.isArray(data)) { setLeaderboard([]); return; }
      const stats = {};
      data.forEach(function(row) {
        if (!stats[row.player_id]) stats[row.player_id] = { name:row.player_name, pid:row.player_id, best:row.score, played:0, bestPont:0, bestChaine:0 };
        if (row.score > stats[row.player_id].best) stats[row.player_id].best = row.score;
        stats[row.player_id].played += 1;
        if (row.mode === "pont" && row.score > stats[row.player_id].bestPont) stats[row.player_id].bestPont = row.score;
        if (row.mode === "chaine" && row.score > stats[row.player_id].bestChaine) stats[row.player_id].bestChaine = row.score;
      });
      const duels = await sbFetch("bb_duels?status=eq.complete"+((!mode||isGlobal)?"":"&mode=eq."+mode)+"&select=challenger_id,opponent_id,challenger_score,opponent_score&limit=500");
      if (Array.isArray(duels)) {
        duels.forEach(function(d) {
          [d.challenger_id, d.opponent_id].forEach(function(pid) {
            if (!stats[pid]) return;
            if (!stats[pid].wins) stats[pid].wins = 0;
            if (!stats[pid].draws) stats[pid].draws = 0;
            if (!stats[pid].losses) stats[pid].losses = 0;
            const myScore = pid === d.challenger_id ? d.challenger_score : d.opponent_score;
            const theirScore = pid === d.challenger_id ? d.opponent_score : d.challenger_score;
            if (myScore > theirScore) stats[pid].wins++;
            else if (myScore === theirScore) stats[pid].draws++;
            else stats[pid].losses++;
          });
        });
      }
      const sorted = Object.values(stats)
        .map(function(r){ return {name:r.name, pid:r.pid||"", score:isGlobal?(r.bestPont+r.bestChaine):r.best, bestPont:r.bestPont, bestChaine:r.bestChaine, played:r.played, wins:r.wins||0, draws:r.draws||0, losses:r.losses||0}; })
        .sort(function(a,b){ return b.score - a.score; })
        .slice(0,50)
        .map(function(r,i){ return {...r, rank:i+1}; });
      setLeaderboard(sorted);
    } catch(e) { setLeaderboard([]); }
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
        if(activeDuelRef.current&&activeDuelRef.current.isRoom){setScreen("waitingRoom");submitRoomScore(total);}else if(activeDuel){submitDuelScore(total); setScreen("final");}else{setScreen("final");}
      } else {
        // Manche intermédiaire — envoyer score partiel et afficher classement
        setRoomRoundSnapshot(null); // reset le temps de fetch
        if(activeDuelRef.current&&activeDuelRef.current.isRoom) pushRoundScore(rs);
        setScreen("roundEnd");
      }
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
    if(activeDuelRef.current&&activeDuelRef.current.isRoom){setScreen("waitingRoom");submitRoomScore(sc);}else if(activeDuel){submitDuelScore(sc); setScreen("chainEnd");}else{setScreen("chainEnd");}
  }

  function startRound(round) {
    roundStartTime.current = null; // timer will set on next tick
    const dbPool = DB[diff] || DB["facile"] || [];
    if (dbPool.length === 0) { console.error("DB empty for diff:", diff); return; }
    const q=shuffle([...dbPool]);
    queueRef.current = q;
    setQueue(q); setQIdx(0); setScore(0); scoreRef.current=0;
    setTimeLeft(ROUND_DURATION); setGuess(""); setFlash(null); setFeedback(null);
    if(diff==="facile") setOptions(generateOptions(q[0].p, DB[diff]||[]));
    setCurrentRound(round); setAnimKey(0); setScreen("game");
    setTimeout(()=>inputRef.current?.focus(),200);
  }

  function startChain() {
    roundStartTime.current = null; // reset so timer reinits on screen change
    setIsNewRecord(false); setMyLastPts(null); setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    const eligible=PLAYERS_CLEAN.filter(p=>p.clubs.length>=2);
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
    const cur=queue[qIdx%Math.max(queue.length,1)];
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
  handlePassRef.current = handlePass;

  function handleOptionClick(opt) {
    if(flash) return;
    const cur=queue[qIdx%Math.max(queue.length,1)];
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
    if(chainPassedRef.current) return; // already passed this question
    clearInterval(qTimerRef.current);
    chainPassedRef.current = true;
    setChainScore(s=>{chainScoreRef.current=s-.5;return s-.5;});
    const validClubs=(PLAYERS_CLEAN.find(p=>p.name===chainPlayer)?.clubs||[]).filter(c=>!chainUsedClubs.has(c));
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
    setAnimKey(k=>k+1); // relance le timer de question pour le nouveau joueur
  }
  handleChainPassRef.current = handleChainPass;

  function requirePseudo(callback) {
    if (!pseudoConfirmed || !playerName.trim()) {
      setPseudoScreen(true);
      return;
    }
    callback();
  }

  function tryStart(mode) {
    if (!pseudoConfirmed || !playerName.trim()) {
      setPseudoScreen(true);
      return;
    }
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

  const activeQueue = queue.length > 0 ? queue : queueRef.current;
  const cur = activeQueue[qIdx % Math.max(activeQueue.length, 1)];
  const total = roundScores.length > 0 ? roundScores.reduce(function(a,b){return a+b;},0) : 0;
  const duration = gameMode === "chaine" ? CHAIN_DURATION : ROUND_DURATION;
  const tPct = timeLeft / duration;
  const urgent = timeLeft <= 10 && timeLeft > 0;
  // Design system
  const G = {
    bg:"#1E5C2A",bgPanel:"rgba(0,0,0,.5)",bgCard:"#141414",dark:"#0a0a0a",white:"#ffffff",
    offWhite:"#F5F5F5",accent:"#00E676",gold:"#FFD600",red:"#FF3D57",
    font:"'Inter',system-ui,sans-serif",heading:"'Bebas Neue',cursive,sans-serif",
  };
  const shell = {
    minHeight:"100vh",display:"flex",flexDirection:"column",
    background:"transparent",
    fontFamily:G.font,position:"relative",overflow:"hidden",
  };
  const stripes = {position:"absolute",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse at 50% 0%,rgba(0,230,118,.06) 0%,transparent 70%)"};
  const sheet = {background:"rgba(0,0,0,.55)",backdropFilter:"blur(2px)",borderRadius:"32px 32px 0 0",flex:1,display:"flex",flexDirection:"column",gap:10,padding:"20px 18px 28px",display:"flex",flexDirection:"column",gap:14,zIndex:1,boxShadow:"0 -2px 40px rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.08)",borderBottom:"none"};

  const backBtn = (onClick) => (
    <button onClick={onClick} style={{background:"rgba(255,255,255,.07)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10,color:G.white,fontSize:18,fontWeight:700,flexShrink:0}}>←</button>
  );

  const timerCircle = (size=76) => {
    const r=(size/2)-5; const circ=2*Math.PI*r;
    return (
      <div style={{position:"relative",width:size,height:size,animation:urgent?"heartbeat .8s ease infinite":"none"}}>
        <svg style={{width:size,height:size,transform:"rotate(-90deg)"}} viewBox={`0 0 ${size} ${size}`}>
          <circle fill={urgent?"rgba(255,61,87,.12)":"rgba(255,255,255,.04)"} cx={size/2} cy={size/2} r={size/2}/>
          <circle fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={4} cx={size/2} cy={size/2} r={r}/>
          <circle fill="none" stroke={timeLeft<=20?"#FF3D57":timeLeft<=40?"#FFD600":G.accent} strokeWidth={urgent?6:4}
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
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:50,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 16px",
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
          {showInstructions==="pont"?"THE PLUG":"THE MERCATO"}
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
          <button onClick={()=>setShowNotifPrompt(false)} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:600}}>
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
  // ── FRIENDS SCREEN ──
  if (showFriends) {
    // ── VUE DÉTAIL AMI ──
    if (selectedFriend) {
      const friendDuels = duels.filter(function(d){
        return d.status==="complete" && (d.challenger_id===selectedFriend.id || d.opponent_id===selectedFriend.id);
      });
      let wins=0, losses=0, draws=0;
      friendDuels.forEach(function(d){
        const myScore = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
        const theirScore = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
        if(myScore>theirScore) wins++;
        else if(myScore===theirScore) draws++;
        else losses++;
      });
      return (
        <div style={{...shell,overflow:"auto"}} key="friendDetail">
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
            {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
            <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
          </div>
          <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {backBtn(function(){setSelectedFriend(null);})}
            <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>{selectedFriend.name}</div>
            <button onClick={function(){setShowDuelCreate({id:selectedFriend.id,name:selectedFriend.name});}} style={{padding:"8px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>⚡ Défier</button>
          </div>
          <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
            {/* Bilan */}
            {friendDuels.length > 0 && (
              <div style={{display:"flex",gap:8,marginBottom:4}}>
                <div style={{flex:1,background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#00E676"}}>{wins}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Victoires</div>
                </div>
                <div style={{flex:1,background:"rgba(255,214,0,.06)",border:"1px solid rgba(255,214,0,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:G.gold}}>{draws}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Nuls</div>
                </div>
                <div style={{flex:1,background:"rgba(255,61,87,.06)",border:"1px solid rgba(255,61,87,.2)",borderRadius:16,padding:"14px 0",textAlign:"center"}}>
                  <div style={{fontFamily:G.heading,fontSize:32,color:"#FF3D57"}}>{losses}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Défaites</div>
                </div>
              </div>
            )}
            {/* Historique */}
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8,marginTop:4}}>Historique</div>
            {friendDuels.length===0 && (
              <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>Aucun duel encore joué avec {selectedFriend.name} 👀</div>
            )}
            {friendDuels.map(function(d,i){
              const myScore = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
              const theirScore = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
              const won = myScore>theirScore; const draw = myScore===theirScore;
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,255,255,.06)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:won?"#00E676":draw?G.gold:"#FF3D57"}}>{won?"🏆 Victoire":draw?"🤝 Égalité":"😅 Défaite"}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{d.mode==="pont"?"The Plug":"The Mercato"}{d.diff?" · "+d.diff:""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:G.heading,fontSize:22,color:G.white}}>{myScore} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{selectedFriend.name}: {theirScore}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── VUE LISTE AMIS ──
    return (
      <div style={{...shell,overflow:"auto"}} key="friends">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        {showDuelCreate && (
          <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:340,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)"}}>
              <div style={{fontFamily:G.heading,fontSize:28,color:G.white,marginBottom:4}}>DÉFIER</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:20}}>vs <strong style={{color:G.gold}}>{showDuelCreate.name}</strong></div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Mode</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {["pont","chaine"].map(function(m){return(
                  <button key={m} onClick={function(){setDuelMode(m);}} style={{flex:1,padding:"10px",borderRadius:12,border:"1.5px solid "+(duelMode===m?G.accent:"rgba(255,255,255,.15)"),background:duelMode===m?"rgba(0,230,118,.1)":"transparent",color:duelMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                    {m==="pont"?"The Plug":"The Mercato"}
                  </button>
                );})}
              </div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Difficulté</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {["facile","moyen","expert"].map(function(d){return(
                  <button key={d} onClick={function(){setDuelDiff(d);}} style={{flex:1,padding:"8px",borderRadius:10,border:"1.5px solid "+(duelDiff===d?G.gold:"rgba(255,255,255,.15)"),background:duelDiff===d?"rgba(255,214,0,.1)":"transparent",color:duelDiff===d?G.gold:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12,textTransform:"capitalize"}}>
                    {d}
                  </button>
                );})}
              </div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Manches</div>
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                {[1,2,3].map(function(r){return(
                  <button key={r} onClick={function(){setDuelRounds(r);}} style={{flex:1,padding:"10px",borderRadius:12,border:"1.5px solid "+(duelRounds===r?"#fff":"rgba(255,255,255,.15)"),background:duelRounds===r?"rgba(255,255,255,.1)":"transparent",color:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:15}}>{r}</button>
                );})}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={function(){setShowDuelCreate(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>Annuler</button>
                <button onClick={function(){createDuel(showDuelCreate);}} style={{flex:2,padding:"12px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>Envoyer le défi ⚡</button>
              </div>
            </div>
          </div>
        )}
        {/* Modal confirmation suppression ami */}
        {confirmRemove && (
          <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"rgba(15,20,15,.97)",borderRadius:24,padding:"28px 24px",maxWidth:320,width:"calc(100% - 40px)",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>👋</div>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,marginBottom:8}}>Supprimer {confirmRemove.name} ?</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>Il devra renvoyer une demande pour être à nouveau dans ta liste.</div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.6)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Annuler</button>
                <button onClick={function(){removeFriend(confirmRemove.id);setConfirmRemove(null);}} style={{flex:1,padding:"12px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(function(){setShowFriends(false);setFriendMsg("");setSelectedFriend(null);})}
          <div style={{fontFamily:G.heading,fontSize:26,color:G.white,letterSpacing:2}}>AMIS</div>
          <div style={{width:40}}/>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          {/* Demandes reçues */}
          {friendRequests.length > 0 && (
            <div style={{background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.25)",borderRadius:16,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:10}}>👋 Demandes reçues</div>
              {friendRequests.map(function(req){return(
                <div key={req.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:G.white}}>{req.from_name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>veut être ton ami · {req.from_id}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={function(){acceptRequest(req);}} style={{padding:"8px 14px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>✓</button>
                    <button onClick={function(){declineRequest(req);}} style={{padding:"8px 12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.4)",border:"none",borderRadius:20,cursor:"pointer",fontSize:13}}>✕</button>
                  </div>
                </div>
              );})}
            </div>
          )}
          {/* Ajouter un ami */}
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Ajouter un ami</div>
            <div style={{display:"flex",gap:8}}>
              <input value={friendInput} onChange={function(e){setFriendInput(e.target.value);setFriendMsg("");}}
                placeholder="Pseudo de ton ami..." maxLength={20}
                style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.15)",background:"#141414",color:G.white,fontFamily:G.font,fontSize:15,fontWeight:600,outline:"none"}}/>
              <button onClick={function(){addFriend(friendInput);}}
                style={{padding:"10px 16px",background:G.accent,color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>+</button>
            </div>
            {friendMsg && <div style={{fontSize:12,marginTop:6,color:friendMsg.startsWith("✓")?"#00E676":friendMsg.startsWith("🔍")?"rgba(255,255,255,.5)":"#FF3D57",fontWeight:700}}>{friendMsg}</div>}
          </div>
          {/* Liste des amis + demandes en attente */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              Mes amis {friendsList.length>0&&<span style={{color:G.accent}}>({friendsList.length})</span>}
            </div>
            {friendsList.length===0 && sentRequests.filter(function(r){return r.status==="pending";}).length===0 && (
              <div style={{textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>Aucun ami pour l'instant 👋</div>
            )}
            {/* Demandes en attente intégrées dans la liste */}
            {sentRequests.filter(function(r){return r.status==="pending";}).map(function(r,i){return(
              <div key={"pending-"+i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,214,0,.04)",borderRadius:14,marginBottom:8,border:"1px dashed rgba(255,214,0,.25)"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:"rgba(255,255,255,.5)"}}>{r.to_name || r.to_id}</div>
                  <div style={{fontSize:11,color:G.gold}}>⏳ En attente d'acceptation</div>
                </div>
              </div>
            );})}
            {friendsList.map(function(fid, i) {
              let fname = fid;
              try {
                const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
                const fscores = friendScores.filter(function(s){return s.player_id===fid;});
                fname = names[fid] || (fscores.length > 0 ? fscores[0].player_name : fid);
              } catch { }
              const friendDuelCount = duels.filter(function(d){return d.status==="complete"&&(d.challenger_id===fid||d.opponent_id===fid);}).length;
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRadius:14,marginBottom:8,border:"1px solid rgba(255,255,255,.06)",cursor:"pointer"}}
                  onClick={function(){setSelectedFriend({id:fid,name:fname});loadDuels();}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:G.white}}>{fname}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{friendDuelCount>0?friendDuelCount+" duel"+(friendDuelCount>1?"s":"")+" joué"+(friendDuelCount>1?"s":""):"Aucun duel encore"}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button onClick={function(e){e.stopPropagation();setShowDuelCreate({id:fid,name:fname});}} style={{padding:"7px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>⚡ Défier</button>
                    <button onClick={function(e){e.stopPropagation();setConfirmRemove({id:fid,name:fname});}} style={{padding:"7px 10px",background:"transparent",border:"1px solid rgba(255,255,255,.15)",borderRadius:20,cursor:"pointer",color:"rgba(255,255,255,.4)",fontSize:12}}>✕</button>
                    <span style={{color:"rgba(255,255,255,.3)",fontSize:18}}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={function(){setShowFriends(false);setSelectedFriend(null);}} style={{width:"100%",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,padding:"10px",marginTop:4}}>↩ Retour</button>
        </div>
      </div>
    );
  }

  if(showLeaderboard) {
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:"auto"}} key="lb">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{zIndex:1,padding:"12px 20px 12px",display:"flex",alignItems:"center",gap:12}}>
          {backBtn(function(){setShowLeaderboard(false);})}
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7vw,46px)",color:G.white,letterSpacing:3}}>CLASSEMENT</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Top 50 mondial</div>
          </div>
          <div style={{width:40}}/>{/* spacer pour centrer le titre */}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          <div style={{display:"flex",gap:8}}>
            {["global","pont","chaine"].map(function(m){return(
              <button key={m} onClick={function(){setLbMode(m);loadLeaderboard(m);}} style={{flex:1,padding:"11px",borderRadius:12,border:"1.5px solid "+(lbMode===m?G.accent:"rgba(255,255,255,.12)"),background:lbMode===m?"rgba(0,230,118,.1)":"transparent",color:lbMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                {m==="global"?"🌍 Global":m==="pont"?"🏟 Pont":"⛓ Chaîne"}
              </button>
            );})}
          </div>
          {leaderboard.length === 0 && (
            <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>Aucun score pour le moment</div>
          )}
          {leaderboard.map(function(entry, i){
            const isMe = entry.pid === playerId;
            const medals = ["🥇","🥈","🥉"];
            return(
              <div key={i} style={{borderRadius:14,background:isMe?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:isMe?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}}>
                  <div style={{fontFamily:G.heading,fontSize:22,width:32,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>
                    {i<3?medals[i]:(i+1)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:isMe?G.accent:G.white}}>{entry.name}{isMe?" (toi)":""}</div>
                    {lbMode==="global"
                      ? <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>🏟 {entry.bestPont} pts &nbsp;·&nbsp; ⛓ {entry.bestChaine} pts</div>
                      : <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{entry.played} partie{entry.played>1?"s":""} · <span style={{fontFamily:G.heading,letterSpacing:2,fontSize:10}}>{entry.pid}</span></div>
                    }
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{entry.score} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                </div>
                {(entry.wins>0||entry.draws>0||entry.losses>0) && (
                  <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,.06)"}}>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:"#00E676"}}>{entry.wins}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Victoires</div>
                    </div>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:G.gold}}>{entry.draws}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Nuls</div>
                    </div>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:"#FF3D57"}}>{entry.losses}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Défaites</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── HOME ──

  // ── ROOM LOBBY ──
  if (room) {
    const players = typeof room.players === "string" ? JSON.parse(room.players) : (room.players || []);
    const isHost = room.host_id === playerId;
    const me = players.find(function(p){return p.id===playerId;});
    if (duelCountdown !== null) {
      const oppName = players.filter(function(p){return p.id!==playerId;}).map(function(p){return p.name;}).join(", ");
      return (
        <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="countdown">
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
          <div style={{textAlign:"center",zIndex:1}}>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>C'est parti !</div>
            <div style={{fontFamily:G.heading,fontSize:120,color:G.accent,lineHeight:1,animation:"popIn .3s ease"}} key={duelCountdown}>{duelCountdown}</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:16}}>{players.length} joueurs</div>
          </div>
        </div>
      );
    }
    return (
      <div style={{...shell,overflow:"auto"}} key="room">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{zIndex:1,padding:"20px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {backBtn(leaveRoom)}
          <div style={{fontFamily:G.heading,fontSize:24,color:G.white,letterSpacing:2}}>SALLE</div>
          <div style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"6px 14px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>Code</div>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.gold,letterSpacing:4}}>{room.code}</div>
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:16}}>
          <div style={{background:"rgba(255,255,255,.04)",borderRadius:14,padding:"10px 14px",marginBottom:4}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>Mode</div>
            <div style={{fontSize:15,fontWeight:800,color:G.white}}>{room.mode==="pont"?"The Plug":"The Mercato"}{room.diff?" · "+room.diff:""} · {room.rounds||1} manche{(room.rounds||1)>1?"s":""}</div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>
              Joueurs ({players.length}/8)
            </div>
            {players.map(function(p, i){return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.04)",borderRadius:12,marginBottom:6,border:p.id===playerId?"1px solid rgba(0,230,118,.3)":"1px solid rgba(255,255,255,.05)"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#1E5C2A,#00E676)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===room.host_id?" 👑":""}{p.id===playerId?" (toi)":""}</div>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>✓ Prêt</div>
              </div>
            );})}
          </div>
          {players.length < 2 && (
            <div style={{textAlign:"center",padding:"8px 0",fontSize:13,color:"rgba(255,255,255,.3)"}}>
              Partage le code <strong style={{color:G.gold}}>{room.code}</strong> à tes amis
            </div>
          )}
          {isHost ? (
            <button onClick={startRoomGame} disabled={players.length < 2}
              style={{width:"100%",padding:"16px",background:players.length>=2?G.accent:"rgba(255,255,255,.1)",color:players.length>=2?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:players.length>=2?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:4}}>
              {players.length < 2 ? "En attente de joueurs..." : "🚀 Lancer la partie ("+players.length+" joueurs)"}
            </button>
          ) : (
            <div style={{textAlign:"center",padding:"14px",fontSize:13,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.04)",borderRadius:16}}>
              ⏳ En attente que {room.host_name} lance la partie...
            </div>
          )}
        </div>
      </div>
    );
  }


  // ── PSEUDO MODAL (first time only) ──
  if (showSplash) {
    return (
      <div style={{position:"fixed",inset:0,background:"#080f08",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999}} key="splash">
        <div style={{position:"absolute",inset:0,overflow:"hidden",opacity:.12}}>
          {[0,1,2,3,4,5,6].map(function(i){return(
            <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
          );})}
        </div>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 40%, rgba(0,230,118,.10) 0%, transparent 65%)"}}/>

        {/* Lettres GOAT et FC qui tombent une par une */}
        <div style={{display:"flex",alignItems:"baseline",gap:18,zIndex:1,marginBottom:14}}>
          <div style={{display:"flex"}}>
            {["G","O","A","T"].map(function(l,i){return(
              <span key={i} style={{
                display:"inline-block",
                fontFamily:"'Bebas Neue',cursive,sans-serif",
                fontSize:"clamp(76px,19vw,112px)",
                color:"#fff",
                letterSpacing:3,
                animation:"dropIn 0.45s cubic-bezier(.22,1,.36,1) "+(0.08+i*0.09)+"s both"
              }}>{l}</span>
            );})}
          </div>
          <div style={{display:"flex"}}>
            {["F","C"].map(function(l,i){return(
              <span key={i} style={{
                display:"inline-block",
                fontFamily:"'Bebas Neue',cursive,sans-serif",
                fontSize:"clamp(76px,19vw,112px)",
                color:"#00E676",
                animation:"dropIn 0.45s cubic-bezier(.22,1,.36,1) "+(0.52+i*0.1)+"s both"
              }}>{l}</span>
            );})}
          </div>
        </div>

        {/* Ligne verte qui s'étend */}
        <div style={{zIndex:1,height:2,background:"#00E676",borderRadius:1,animation:"lineExpand 0.4s ease 0.85s both"}}/>

        {/* Tagline */}
        <div style={{zIndex:1,fontSize:12,letterSpacing:5,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginTop:14,animation:"fadeIn 0.5s ease 1.1s both"}}>
          T'as le niveau ?
        </div>

        {/* Barre de chargement */}
        <div style={{position:"absolute",bottom:55,left:"50%",transform:"translateX(-50%)",width:100}}>
          <div style={{height:2,background:"rgba(255,255,255,.1)",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#00E676",borderRadius:2,animation:"splashLoad 2.2s ease forwards"}}/>
          </div>
        </div>
      </div>
    );
  }

  const pseudoModal = pseudoScreen ? (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"calc(100% - 40px)",maxWidth:360,background:"rgba(10,20,10,.97)",borderRadius:28,padding:"32px 24px",border:"1px solid rgba(255,255,255,.1)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontFamily:G.heading,fontSize:52,color:G.white,lineHeight:.9}}>GOAT<span style={{color:G.accent}}>FC</span></div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:8,letterSpacing:2}}>{playerName?"CHANGER TON PSEUDO":"CHOISIS TON PSEUDO"}</div>
        </div>
        <input
          value={pseudoInput}
          onChange={function(e){setPseudoInput(e.target.value);setPseudoMsg("");}}
          onKeyDown={function(e){if(e.key==="Enter")checkAndSavePseudo(pseudoInput);}}
          placeholder="Ton pseudo unique..."
          maxLength={20}
          autoFocus
          style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:14,padding:"14px 16px",fontFamily:G.font,fontSize:17,color:G.white,outline:"none",boxSizing:"border-box",marginBottom:8,textAlign:"center"}}
        />
        {pseudoMsg && <div style={{fontSize:13,fontWeight:700,color:pseudoMsg.startsWith("❌")?"#FF3D57":"rgba(255,255,255,.4)",marginBottom:8,textAlign:"center"}}>{pseudoMsg}</div>}
        <div style={{fontSize:11,color:"rgba(255,255,255,.2)",marginBottom:16,textAlign:"center"}}>2-20 caractères · unique · définitif</div>
        <button
          onClick={function(){checkAndSavePseudo(pseudoInput);}}
          disabled={pseudoChecking||pseudoInput.trim().length<2}
          style={{width:"100%",padding:"15px",background:pseudoInput.trim().length>=2?G.accent:"rgba(255,255,255,.08)",color:pseudoInput.trim().length>=2?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:pseudoInput.trim().length>=2?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800}}
        >
          {pseudoChecking?"Vérification...":"Confirmer →"}
        </button>
      </div>
    </div>
  ) : null;


  // ── WAITING ROOM ──
  if (waitingDuel) {
    const isChal = waitingDuel.challenger_id === playerId;
    const oppName = isChal ? waitingDuel.opponent_name : waitingDuel.challenger_name;
    const isReady = waitingDuel.status === "ready";
    if (duelCountdown !== null) {
      return (
        <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="countdown">
          <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
          <div style={{textAlign:"center",zIndex:1}}>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>Adversaire trouvé !</div>
            <div style={{fontFamily:G.heading,fontSize:120,color:G.accent,lineHeight:1,animation:"popIn .3s ease"}} key={duelCountdown}>{duelCountdown}</div>
            <div style={{fontSize:16,color:"rgba(255,255,255,.5)",marginTop:16}}>vs <strong style={{color:G.white}}>{oppName}</strong></div>
          </div>
        </div>
      );
    }
    return (
      <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="waiting">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{textAlign:"center",zIndex:1,padding:"0 32px"}}>
          <div style={{fontSize:48,marginBottom:16,animation:"spin 2s linear infinite",display:"inline-block"}}>⚽</div>
          <div style={{fontFamily:G.heading,fontSize:32,color:G.white,marginBottom:8}}>
            {isReady ? "PRÊT !" : "EN ATTENTE..."}
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:32}}>
            {isReady ? "La partie va commencer !" : "En attente de "+oppName+"..."}
          </div>
          <div style={{background:"rgba(255,255,255,.06)",borderRadius:20,padding:"16px 24px",marginBottom:24,border:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Mode</div>
            <div style={{fontSize:16,fontWeight:800,color:G.white}}>{waitingDuel.mode==="pont"?"The Plug":"The Mercato"}{waitingDuel.diff?" · "+waitingDuel.diff:""}</div>
          </div>
          {!isReady && (
            <button onClick={cancelWaiting} style={{padding:"12px 28px",background:"rgba(255,61,87,.15)",color:"#FF3D57",border:"1px solid rgba(255,61,87,.3)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
              Annuler
            </button>
          )}
        </div>
      </div>
    );
  }


  // ── ROOM RESULT (priorité sur l'écran d'attente) ──
  if (duelResult && duelResult.isRoom) {
    const medals = ["🥇","🥈","🥉"];
    const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
    const myRank = duelResult.players.findIndex(function(p){return p.id===playerId;}) + 1;
    const winner = duelResult.players[0];
    const winMessages = [
      "T'as les crampons ET le niveau frère 👑",
      "T'as mis la misère à tout le monde 💀",
      "T'es chaud comme Mbappé un soir de CL 🔥",
      "LA COUPE IL RESTE AU MAROOOC, T'ES UN JNOUN OU QUOI?! 🏆",
      "On joue pas dans la même cour frère 🐐",
    ];
    const loseMessages = [
      "Même pas un but ! Même pas un but ! 😂",
      "T'as les crampons mais pas le niveau frère 💀",
      "Retourne jouer à la Playstation 🎮",
      "Même en Division 5 tu ferais banc 🤡",
      "T'as cru quoi, que c'était FIFA ? 😭",
    ];
    const msg = myRank === 1
      ? winMessages[Math.floor((myEntry?.score||0) * 7) % 5]
      : loseMessages[Math.floor(myRank * 3) % 5];
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:"auto"}} key="roomResult2">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{zIndex:1,padding:"32px 20px 12px",textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:8}}>{myRank<=3?medals[myRank-1]:myRank+"ème"}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:myRank===1?G.gold:G.white,letterSpacing:2}}>
            {myRank===1?"VICTOIRE !":myRank===2?"2ÈME PLACE":myRank===3?"3ÈME PLACE":"RÉSULTATS"}
          </div>
          <div style={{fontSize:18,color:myRank===1?G.gold:"#fff",marginTop:12,fontWeight:800,padding:"0 16px",lineHeight:1.4,textAlign:"center",animation:"popIn .6s cubic-bezier(.22,1,.36,1) .4s both",textShadow:myRank===1?"0 0 20px rgba(255,214,0,.4)":"none"}}>{msg}</div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,background:p.id===playerId?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:p.id===playerId?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6}}>
              <div style={{fontFamily:G.heading,fontSize:22,width:32,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>{i<3?medals[i]:i+1}</div>
              <div style={{flex:1,fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{p.score||0} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
            </div>
          );})}
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:8}}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // ── WAITING FOR ROOM RESULTS ──
  if (waitingForRoom || screen==="waitingRoom") {
    return (
      <div style={{...shell,alignItems:"center",justifyContent:"center"}} key="waitingRoom">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(i/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
          <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
          <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
        </div>
        <div style={{textAlign:"center",zIndex:1,padding:"0 32px"}}>
          <div style={{fontSize:48,marginBottom:16,animation:"spin 2s linear infinite",display:"inline-block"}}>⏳</div>
          <div style={{fontFamily:G.heading,fontSize:28,color:G.white,marginBottom:8}}>EN ATTENTE</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)"}}>En attente des autres joueurs...</div>
        </div>
      </div>
    );
  }

  // ── HOME ──
  if(screen==="home") return (
    <div style={{...shell,animation:"fadeUp .5s ease",overflow:"auto"}} key="home">
      {showDuelCreate && (
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:340,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.white,marginBottom:4}}>DÉFIER</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:20}}>vs <strong style={{color:G.gold}}>{showDuelCreate.name}</strong></div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Mode</div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {["pont","chaine"].map(function(m){return(
                <button key={m} onClick={function(){setDuelMode(m);}} style={{flex:1,padding:"10px",borderRadius:12,border:"1.5px solid "+(duelMode===m?G.accent:"rgba(255,255,255,.15)"),background:duelMode===m?"rgba(0,230,118,.1)":"transparent",color:duelMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                  {m==="pont"?"The Plug":"The Mercato"}
                </button>
              );})}
            </div>
            {duelMode==="pont" && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:8}}>Difficulté</div>
                <div style={{display:"flex",gap:8}}>
                  {["facile","moyen","expert"].map(function(d){return(
                    <button key={d} onClick={function(){setDuelDiff(d);}} style={{flex:1,padding:"8px",borderRadius:10,border:"1.5px solid "+(duelDiff===d?G.gold:"rgba(255,255,255,.15)"),background:duelDiff===d?"rgba(255,214,0,.1)":"transparent",color:duelDiff===d?G.gold:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12,textTransform:"capitalize"}}>
                      {d}
                    </button>
                  );})}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={function(){setShowDuelCreate(null);}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>Annuler</button>
              <button onClick={function(){createDuel(showDuelCreate);}} style={{flex:2,padding:"12px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800}}>Envoyer le défi ⚡</button>
            </div>
          </div>
        </div>
      )}
      {showRoomCreate && (
        <div
          style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end"}}
          onClick={function(e){if(e.target===e.currentTarget)setShowRoomCreate(false);}}
        >
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)"}} onClick={function(){setShowRoomCreate(false);}}/>
          <div style={{position:"relative",zIndex:1,width:"100%",background:"rgba(10,25,10,.96)",backdropFilter:"blur(20px)",borderRadius:"28px 28px 0 0",padding:"16px 20px 48px",border:"1px solid rgba(255,255,255,.1)",borderBottom:"none",animation:"slideUp .35s cubic-bezier(.22,1,.36,1)"}}>
            <div style={{width:40,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.white,letterSpacing:2,marginBottom:6}}>CRÉER UNE SALLE</div>
            {/* Recap config */}
            <div style={{background:"rgba(255,255,255,.06)",borderRadius:16,padding:"14px 16px",marginBottom:20,border:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:G.white}}>{duelMode==="pont"?"The Plug":"The Mercato"}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{duelDiff} · {duelRounds} manche{duelRounds>1?"s":""}</div>
                </div>
                <div style={{fontFamily:G.heading,fontSize:32,color:G.accent}}>2-8 👥</div>
              </div>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:20,textAlign:"center"}}>
              Un code sera généré pour que tes amis puissent rejoindre
            </div>
            {roomMsg && <div style={{fontSize:13,color:"#FF3D57",fontWeight:700,marginBottom:12,textAlign:"center"}}>{roomMsg}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowRoomCreate(false);}} style={{flex:1,padding:"15px",background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.5)",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14}}>Annuler</button>
              <button onClick={createRoom} style={{flex:2,padding:"15px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>Créer la salle 🚀</button>
            </div>
          </div>
        </div>
      )}
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>

      {/* ── HEADER compact ── */}
      <div style={{zIndex:1,padding:"18px 20px 10px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div style={{flex:1}}/>
          <div style={{textAlign:"center",flex:2}}>
            <div style={{fontSize:9,letterSpacing:5,textTransform:"uppercase",color:"rgba(255,255,255,.35)"}}>T'as le niveau ?</div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(42px,11vw,68px)",lineHeight:.9,letterSpacing:2,color:G.white}}>GOAT<span style={{color:G.accent}}>FC</span></div>
          </div>
          <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}>
            <div onClick={function(){}} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"7px 12px",display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:13}}>👤</span>
              <span style={{fontSize:12,fontWeight:700,color:playerName?G.white:"rgba(255,255,255,.4)",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {playerName||"Pseudo"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{...sheet,gap:10}}>

        {/* Bandeau demandes d'amis */}
        {friendRequests.length > 0 && (
          <div style={{background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.25)",borderRadius:12,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,fontWeight:700,color:G.accent}}>👋 {friendRequests.length} demande{friendRequests.length>1?"s":""} d'ami</div>
              <button onClick={function(){setShowFriends(true);loadFriendRequests();}} style={{padding:"5px 12px",background:G.accent,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>Voir</button>
            </div>
          </div>
        )}

        {/* Défis en attente */}
        {getPendingDuels().length > 0 && (
          <div style={{background:"rgba(255,214,0,.08)",border:"1px solid rgba(255,214,0,.25)",borderRadius:12,padding:"10px 14px"}}>
            {getPendingDuels().slice(0,2).map(function(d){
              const oppName = d.challenger_id===playerId?d.opponent_name:d.challenger_name;
              return(
                <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,fontWeight:700,color:G.gold}}>⚡ Défi de {oppName}</div>
                  <button onClick={function(){joinDuel(d);}} style={{padding:"5px 12px",background:G.gold,color:"#000",border:"none",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800}}>Rejoindre</button>
                </div>
              );})}
          </div>
        )}

        {/* ── GAME CARDS (côte à côte) ── */}
        <div style={{flex:1,display:"flex",gap:10,minHeight:0}}>
          {/* ── Carte THE PLUG ── */}
          <div
            onClick={function(){setGameConfigModal("pont");}}
            style={{flex:1,borderRadius:22,cursor:"pointer",overflow:"hidden",position:"relative",
              background:"linear-gradient(145deg,#0B1624 0%,#1C3D73 50%,#0B2644 100%)",
              border:"1px solid rgba(255,255,255,.15)",boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}
          >
            <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,150,255,.2) 0%,transparent 70%)"}}/>
            <div style={{padding:"16px 12px",position:"relative",zIndex:1,height:"100%",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:0}}>
              <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:4}}>Mode 1</div>
              <div style={{fontFamily:G.heading,fontSize:"clamp(18px,4.2vw,22px)",color:G.white,letterSpacing:1,lineHeight:1,marginBottom:14}}>THE PLUG</div>
              {/* Règle 1 */}
              <div style={{background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 10px",marginBottom:8,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:28}}>🏟️</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.9)",fontWeight:800,textAlign:"center",lineHeight:1.3}}>2 clubs donnés</span>
              </div>
              {/* Règle 2 */}
              <div style={{background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 10px",marginBottom:8,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:28}}>🔗</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.9)",fontWeight:800,textAlign:"center",lineHeight:1.3}}>Trouve le joueur qui les relie</span>
              </div>
              {/* Règle 3 */}
              <div style={{background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 10px",marginBottom:10,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:28}}>⚡</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.9)",fontWeight:800,textAlign:"center",lineHeight:1.3}}>Vite et bien = max de points</span>
              </div>
              <div style={{flex:1}}/>
              {record&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
                <span style={{fontSize:12,color:G.gold}}>🏆</span>
                <span style={{fontFamily:G.heading,fontSize:15,color:G.gold}}>{record.score} pts</span>
              </div>}
              <div style={{background:G.accent,borderRadius:50,padding:"11px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:14,textAlign:"center"}}>▶ Jouer</div>
            </div>
          </div>

          {/* ── Carte THE MERCATO ── */}
          <div
            onClick={function(){setGameConfigModal("chaine");}}
            style={{flex:1,borderRadius:22,cursor:"pointer",overflow:"hidden",position:"relative",
              background:"linear-gradient(145deg,#0F2A1A 0%,#1A6B3C 50%,#0C3320 100%)",
              border:"1px solid rgba(255,255,255,.15)",boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}
          >
            <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,230,118,.2) 0%,transparent 70%)"}}/>
            <div style={{padding:"16px 12px",position:"relative",zIndex:1,height:"100%",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:0}}>
              <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:4}}>Mode 2</div>
              <div style={{fontFamily:G.heading,fontSize:"clamp(18px,4.2vw,22px)",color:G.white,letterSpacing:1,lineHeight:1,marginBottom:14}}>THE MERCATO</div>              {/* Règle 1 */}
              <div style={{background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 10px",marginBottom:8,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:28}}>⛓️</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.9)",fontWeight:800,textAlign:"center",lineHeight:1.3}}>Enchaîne joueur → club</span>
              </div>
              {/* Règle 2 */}
              <div style={{background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 10px",marginBottom:8,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:28}}>♾️</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.9)",fontWeight:800,textAlign:"center",lineHeight:1.3}}>Le plus longtemps possible</span>
              </div>
              {/* Règle 3 */}
              <div style={{background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 10px",marginBottom:10,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:28}}>📈</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.9)",fontWeight:800,textAlign:"center",lineHeight:1.3}}>+2 pts par bon lien</span>
              </div>
              <div style={{flex:1}}/>
              {chainRecord&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
                <span style={{fontSize:12,color:G.accent}}>⛓</span>
                <span style={{fontFamily:G.heading,fontSize:15,color:G.accent}}>{chainRecord.score} pts</span>
              </div>}
              <div style={{background:G.accent,borderRadius:50,padding:"11px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:14,textAlign:"center"}}>▶ Jouer</div>
            </div>
          </div>
        </div>

        {/* ── CONFIG MODAL ── */}
        {gameConfigModal && (
          <div
            style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"flex-end"}}
            onClick={function(e){if(e.target===e.currentTarget)setGameConfigModal(null);}}
          >
            {/* Backdrop */}
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(4px)"}} onClick={function(){setGameConfigModal(null);}}/>
            {/* Sheet */}
            <div style={{
              position:"relative",zIndex:1,
              width:"100%",
              background:gameConfigModal==="pont"
                ?"linear-gradient(180deg,#0B1624 0%,#1C3D73 100%)"
                :"linear-gradient(180deg,#0F2A1A 0%,#1A5C34 100%)",
              backdropFilter:"blur(20px)",
              borderRadius:"28px 28px 0 0",
              padding:"16px 20px 48px",
              border:"1px solid rgba(255,255,255,.1)",
              borderBottom:"none",
              animation:"slideUp .35s cubic-bezier(.22,1,.36,1)"
            }}>
              {/* Handle */}
              <div style={{width:40,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"0 auto 20px"}}/>
              {/* Mode name */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
                <div style={{opacity:.8}}>{gameConfigModal==="pont"?Icon.pitch(28,"#fff"):Icon.transfer(28,"#fff")}</div>
                <div style={{fontFamily:G.heading,fontSize:36,color:G.white,letterSpacing:2}}>
                  {gameConfigModal==="pont"?"THE PLUG":"THE MERCATO"}
                </div>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:20,paddingLeft:40}}>
                {gameConfigModal==="pont"?"2 clubs → trouve le joueur commun":"joueur → club → joueur..."}
              </div>
              {/* Difficulté */}
              <div style={{fontSize:10,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>Difficulté</div>
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                {["facile","moyen","expert"].map(function(d){return(
                  <button key={d} onClick={function(){setDiff(d);}} style={{flex:1,padding:"12px 4px",borderRadius:14,border:"1.5px solid "+(diff===d?G.accent:"rgba(255,255,255,.1)"),background:diff===d?"rgba(0,230,118,.12)":"rgba(255,255,255,.04)",color:diff===d?G.accent:"rgba(255,255,255,.5)",fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:13,textTransform:"capitalize",transition:"all .15s"}}>
                    {d}
                  </button>
                );})}
              </div>
              {/* Manches */}
              <div style={{fontSize:10,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:8}}>Manches</div>
              <div style={{display:"flex",gap:8,marginBottom:24}}>
                {[1,2,3].map(function(n){return(
                  <button key={n} onClick={function(){setTotalRounds(n);}} style={{flex:1,padding:"12px",borderRadius:14,border:"1.5px solid "+(totalRounds===n?"rgba(255,255,255,.7)":"rgba(255,255,255,.1)"),background:totalRounds===n?"rgba(255,255,255,.1)":"rgba(255,255,255,.04)",color:totalRounds===n?G.white:"rgba(255,255,255,.35)",fontFamily:G.heading,fontWeight:700,cursor:"pointer",fontSize:22,transition:"all .15s"}}>
                    {n}
                  </button>
                );})}
              </div>
              {/* Boutons */}
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){const m=gameConfigModal;setGameConfigModal(null);setTimeout(function(){tryStart(m);},50);}} style={{flex:2,padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800,letterSpacing:.5}}>
                  ▶ Jouer seul
                </button>
                <button onClick={function(){setDuelMode(gameConfigModal);setDuelDiff(diff);setDuelRounds(totalRounds);setGameConfigModal(null);setTimeout(function(){setShowRoomCreate(true);},100);}} style={{flex:1,padding:"16px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.12)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}>
                  👥 Multi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multijoueur - rejoindre */}
        <div style={{display:"flex",gap:8}}>
          <input value={roomInput} onChange={function(e){setRoomInput(e.target.value.toUpperCase());setRoomMsg("");}}
            placeholder="Code salle" maxLength={6}
            style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:G.white,fontFamily:G.font,fontSize:14,fontWeight:700,letterSpacing:3,textTransform:"uppercase",outline:"none"}}/>
          <button onClick={function(){requirePseudo(function(){joinRoom(roomInput);});}} style={{padding:"10px 14px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.12)",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}>Rejoindre</button>
        </div>
        {roomMsg && <div style={{fontSize:12,color:"#FF3D57",fontWeight:700,marginTop:-4}}>{roomMsg}</div>}
        {/* Actions */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={function(){requirePseudo(function(){loadLeaderboard(lbMode);setShowLeaderboard(true);});}} style={{flex:1,padding:"12px",background:"rgba(0,230,118,.08)",color:G.accent,border:"1px solid rgba(0,230,118,.2)",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {Icon.trophy(14,G.accent)} Classement
          </button>
          <button onClick={function(){requirePseudo(function(){setShowFriends(true);loadFriends().then(function(ids){fetchFriendScores(ids);});loadDuels();loadFriendRequests();});}} style={{flex:1,padding:"12px",background:"rgba(255,255,255,.05)",color:G.white,border:"1px solid rgba(255,255,255,.1)",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,position:"relative"}}>
            👥 Amis{friendRequests.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#FF3D57",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900}}>{friendRequests.length}</span>}
          </button>
        </div>

      </div>
    </div>
  );


  if(screen==="game"&&cur) {
    const [ca1,cb1]=getClubColors(cur.c1);
    const [ca2,cb2]=getClubColors(cur.c2);
    const tc1=textColor(ca1); const tc2=textColor(ca2);
    return (
      <div style={{...shell,animation:"fadeIn .2s ease"}} key={"game-"+currentRound}>
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        {showQuitConfirm && (
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:320,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>🏳️</div>
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>ABANDONNER ?</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>
              {activeDuel ? "Ton adversaire sera déclaré vainqueur." : "Ta partie sera perdue et ton score sera de 0."}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Continuer</button>
              <button onClick={function(){
                setShowQuitConfirm(false);
                clearInterval(timerRef.current);
                clearInterval(qTimerRef.current);
                if(activeDuel){ abandonDuel(); } 
                setScreen("home");
              }} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Abandonner</button>
            </div>
          </div>
        </div>
      )}

        {floatingPoints}
        {/* Screen flash */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10,animation:feedback==="ok"?"flashOk .6s ease":feedback==="ko"?"flashKo .6s ease":"none"}}/>

        {/* Top bar */}
        <div style={{zIndex:3,padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexShrink:0}}>
          {backBtn(()=>{setShowQuitConfirm(true);})}
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
          <div style={{flex:1,margin:"0 14px 0 14px",borderRadius:28,background:"linear-gradient(145deg,"+ca1+" 0%,"+cb1+" 100%)",boxShadow:"0 12px 40px "+ca1+"55",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",animation:"clubSlideLeft .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            <div style={{position:"absolute",width:220,height:220,borderRadius:"50%",border:("3px solid rgba(255,255,255,.12)"),top:-40,right:-40}}/>
            <div style={{position:"absolute",width:120,height:120,borderRadius:"50%",border:("2px solid rgba(255,255,255,.07)"),bottom:20,left:-20}}/>
            <div style={{fontSize:10,letterSpacing:5,textTransform:"uppercase",color:"rgba(255,255,255,.55)",fontWeight:700,marginBottom:8,zIndex:1}}>Club 1</div>
            <div style={{marginBottom:8,display:"flex",justifyContent:"center",zIndex:1}}><ClubLogo club={cur.c1} size={52}/></div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(20px,5.5vw,36px)",color:"#ffffff",lineHeight:1.05,textAlign:"center",padding:"0 20px",zIndex:1,textShadow:"0 3px 12px rgba(0,0,0,.4)",letterSpacing:1}}>{cur.c1}</div>
          </div>

          {/* VS */}
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:44,zIndex:2,flexShrink:0}}>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.white,letterSpacing:4,background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:30,padding:"5px 18px",border:"1.5px solid rgba(255,255,255,.15)",animation:"vsAppear .5s cubic-bezier(.22,1,.36,1) .3s both"}}>VS</div>
          </div>

          {/* Club 2 */}
          <div style={{flex:1,margin:"0 14px 10px 14px",borderRadius:28,background:"linear-gradient(145deg,"+ca2+" 0%,"+cb2+" 100%)",boxShadow:"0 12px 40px "+ca2+"55",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",animation:"clubSlideRight .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:("3px solid rgba(255,255,255,.12)"),bottom:-30,left:-30}}/>
            <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",border:("2px solid rgba(255,255,255,.07)"),top:10,right:-10}}/>
            <div style={{fontSize:10,letterSpacing:5,textTransform:"uppercase",color:"rgba(255,255,255,.55)",fontWeight:700,marginBottom:8,zIndex:1}}>Club 2</div>
            <div style={{marginBottom:8,display:"flex",justifyContent:"center",zIndex:1}}><ClubLogo club={cur.c2} size={52}/></div>
            <div style={{fontFamily:G.heading,fontSize:"clamp(20px,5.5vw,36px)",color:"#ffffff",lineHeight:1.05,textAlign:"center",padding:"0 20px",zIndex:1,textShadow:"0 3px 12px rgba(0,0,0,.4)",letterSpacing:1}}>{cur.c2}</div>
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
                  const playerEntry = PLAYERS_CLEAN.find(p=>p.name===opt);
                  const mainClub = (playerEntry&&playerEntry.clubs&&playerEntry.clubs[0]) || "";
                  const [oca,ocb] = getClubColors(mainClub);
                  const otc = textColor(oca);
                  return(
                    <button key={opt} onClick={()=>handleOptionClick(opt)} disabled={!!flash}
                      style={{
                        padding:"14px 10px", borderRadius:18, cursor:"pointer",
                        fontFamily:G.font, fontSize:"clamp(12px,3vw,16px)", fontWeight:800,
                        lineHeight:1.3, transition:"all .15s", position:"relative", overflow:"hidden",
                        border: isOk?"2px solid #00E676": isKo?"2px solid #FF3D57":"1.5px solid "+oca+"88",
                        background: isOk?"#052e16": isKo?"#2d0a0a": ("linear-gradient(145deg,"+oca+"33 0%,"+ocb+"22 100%)"),
                        color: isOk?"#00E676": isKo?G.red: G.white,
                        boxShadow: isOk?"0 0 20px rgba(74,222,128,.4)": isKo?"0 0 20px rgba(239,68,68,.3)": "0 3px 12px "+oca+"22",
                        animation: isOk?"answerOk .4s ease": isKo?"answerKo .4s ease": "optionIn .4s cubic-bezier(.22,1,.36,1) "+(oi*.07)+"s both",
                      }}>
                      {/* Club color strip */}
                      {!isOk&&!isKo&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,"+oca+","+ocb+")",borderRadius:"18px 18px 0 0"}}/>}
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
                      {!isOk&&!isKo&&<PlayerAvatarMini name={opt} size={30}/>}
                      {isOk&&<span style={{fontSize:16}}>✓</span>}
                      {isKo&&<span style={{fontSize:16}}>✗</span>}
                      <span style={{fontSize:"clamp(12px,3vw,16px)",fontWeight:800,color:isOk?"#00E676":isKo?G.red:G.white}}>{opt}</span>
                    </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={handlePass} disabled={!!flash} style={{padding:"12px",pointerEvents:flash?"none":"auto",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer → (−0.5 pt)</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input ref={inputRef} value={guess} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                placeholder="Nom du joueur..." autoComplete="off"
                style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:("2px solid "+(flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0")+""),borderRadius:18,padding:"15px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s",animation:flash==="ko"?"answerKo .4s ease":flash==="ok"?"answerOk .4s ease":"none"}}/>
              <div style={{display:"flex",gap:10}}>
                <button onClick={handlePass} disabled={!!flash} style={{flex:1,padding:15,pointerEvents:flash?"none":"auto",background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer →</button>
                <button onClick={handleSubmit} style={{flex:2,padding:"15px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>Valider</button>
              </div>
            </div>
          )}
      {/* Question timer bar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:25,background:"rgba(255,255,255,.08)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div key={animKey} style={{position:"absolute",inset:0,background:qTimeLeft>3?"#00E676":qTimeLeft>1?"#FFD600":"#FF3D57",width:(qTimeLeft/QUESTION_DURATION*100)+"%",transition:"width 0.3s linear",borderRadius:"4px 0 0 4px",marginLeft:"auto"}}/>
        <span style={{position:"relative",zIndex:1,fontFamily:G.heading,fontSize:14,fontWeight:800,color:"rgba(255,255,255,.9)",letterSpacing:1}}>{qTimeLeft}s</span>
      </div>
    </div>
    </div>
    );
  }

  // ── CHAIN GAME ──
  if(screen==="chainGame") {
    const chainPlayerEntry = PLAYERS_CLEAN.find(p => p.name === chainPlayer);
    const chainPlayerClubs = chainPlayerEntry ? chainPlayerEntry.clubs : [];
    const chainMainClub = chainPlayerClubs[0] || "";
    const [pca, pcb] = getClubColors(chainMainClub);
    const ptc = textColor(pca);
    const chainAvailableClubs = chainPlayerClubs.filter(cl => !chainUsedClubs.has(cl));
    const [cla, clb] = chainLastClub ? getClubColors(chainLastClub) : ["#1a7a3a","#fff"];
    const clTagColor = chainLastClub ? textColor(cla) : "#fff";
    return (
    <div style={{...shell,animation:"fadeIn .3s ease",overflow:"auto"}} key={"chain-"+chainCount}>
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
      {showQuitConfirm && (
        <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"rgba(15,25,15,.95)",borderRadius:24,padding:"28px 24px",maxWidth:320,width:"calc(100% - 32px)",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>🏳️</div>
            <div style={{fontFamily:G.heading,fontSize:26,color:G.white,marginBottom:8}}>ABANDONNER ?</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>Ta partie sera perdue et ton score sera de 0.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){setShowQuitConfirm(false);}} style={{flex:1,padding:"13px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Continuer</button>
              <button onClick={function(){setShowQuitConfirm(false);clearInterval(timerRef.current);clearInterval(qTimerRef.current);if(activeDuel){abandonDuel();}setChainPlayer("");setScreen("home");}} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Abandonner</button>
            </div>
          </div>
        </div>
      )}

      {floatingPoints}
      <div style={{zIndex:2,padding:"12px 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,position:"sticky",top:0}}>
        {backBtn(()=>{setShowQuitConfirm(true);})}
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
          style={{width:"100%",background:flash==="ko"?"#fee2e2":flash==="ok"?"#dcfce7":G.offWhite,border:("2px solid "+(flash==="ko"?G.red:flash==="ok"?G.accent:"#e5e5e0")+""),borderRadius:18,padding:"16px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:G.dark,outline:"none",textAlign:"center",transition:"all .15s"}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={handleChainPass} disabled={!!flash} style={{flex:1,padding:16,background:G.offWhite,color:"#aaa",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,opacity:flash ? 0.3 : 1}}>Passer →</button>
          <button onClick={handleChainSubmit} style={{flex:2,padding:"16px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>Valider</button>
        </div>
        {chainHistory.length>0 && (
          <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#ccc",textAlign:"center"}}>Chaîne</div>
            {[...chainHistory].reverse().map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:G.offWhite,borderRadius:12,animation:`slideIn .3s ease ${i*.04}s both`,opacity:h.passed ? 0.7 : 1}}>
                <span style={{fontSize:10,color:"#bbb",fontWeight:700,minWidth:18}}>{i+1}.</span>
                <PlayerAvatarMini name={h.player} size={26}/>
                <span style={{fontSize:12,color:G.dark,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.player}</span>
                <span style={{display:"flex",alignItems:"center",flexShrink:0}}>{Icon.transfer(11,"#ccc")}</span>
                <span style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}><ClubLogo club={h.club} size={18}/><span style={{fontSize:12,color:h.passed?"#aaa":G.bg,fontWeight:700}}>{h.club}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Chain question timer bar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,height:25,background:"rgba(255,255,255,.08)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div key={chainCount} style={{position:"absolute",inset:0,background:qTimeLeft>8?"#00E676":qTimeLeft>4?"#FFD600":"#FF3D57",width:(qTimeLeft/CHAIN_QUESTION_DURATION*100)+"%",borderRadius:"4px 0 0 4px",marginLeft:"auto"}}/>
        <span style={{position:"relative",zIndex:1,fontFamily:G.heading,fontSize:14,fontWeight:800,color:"rgba(255,255,255,.9)",letterSpacing:1}}>{qTimeLeft}s</span>
      </div>
    </div>
    );
  }


  // ── CHAIN GAME TIMER BAR (injected via CSS position:fixed, already in game screen) ──
  // ── ROUND END ──
  if(screen==="roundEnd") return (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key="roundEnd">
      <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
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
        {/* Classement multi intermédiaire */}
        {activeDuelRef.current&&activeDuelRef.current.isRoom&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:10,textAlign:"center"}}>Classement en cours</div>
            {roomRoundSnapshot ? roomRoundSnapshot.map(function(p,i){
              const medals=["🥇","🥈","🥉"];
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:p.id===playerId?"rgba(0,230,118,.1)":"rgba(255,255,255,.04)",border:p.id===playerId?"1px solid rgba(0,230,118,.3)":"1px solid rgba(255,255,255,.06)",marginBottom:6}}>
                  <span style={{fontSize:18,width:28}}>{i<3?medals[i]:i+1}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}</span>
                  <span style={{fontFamily:G.heading,fontSize:22,color:G.white}}>{p.partial_score||0} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></span>
                </div>
              );
            }) : (
              <div style={{textAlign:"center",padding:"16px",color:"rgba(255,255,255,.35)",fontSize:13}}>⏳ Chargement des scores...</div>
            )}
          </div>
        )}
        <button onClick={()=>startRound(currentRound+1)} style={{width:"100%",padding:"18px",background:totalRounds===2&&currentRound===1?"#16a34a":G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,marginTop:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.whistle(18,G.white)} {totalRounds===2&&currentRound===1?"REPRENDRE LA PARTIE →":"MANCHE "+(currentRound+1)}</button>
      </div>
    </div>
  );

  // ── FINAL ──
  const makeResultScreen = (sc, mode, isChain) => (
    <div style={{...shell,animation:"fadeUp .4s ease"}} key={isChain?"chainEnd":"final"}>
      {confettiOverlay}<div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
      <div style={{zIndex:1,padding:"32px 20px 16px",textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:8,animation:"popIn .6s ease",display:"flex",justifyContent:"center"}}>{isNewRecord?Icon.trophy(60,G.gold):sc>=20?<span style={{fontSize:52}}>🔥</span>:Icon.ball(56,G.white)}</div>
        <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:isNewRecord?G.gold:G.white,letterSpacing:2,animation:"fadeUp .5s ease .1s both"}}>{isNewRecord?"NOUVEAU RECORD !":isChain?"TEMPS ÉCOULÉ !":"RÉSULTATS FINAUX"}</div>
      </div>
      <div style={sheet}>
        <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:"20px",textAlign:"center",border:"1.5px solid #eee"}}>
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
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{myLastPts===10?Icon.trophy(24,"#16a34a"):myLastPts===5?Icon.ball(24,"#92400e"):Icon.whistle(24,"#dc2626")} {myLastPts===10?"NOUVEAU RECORD ! 🏆":myLastPts===5?"BONNE PARTIE ! 👍":"PEUT MIEUX FAIRE 💪"}</span>
            </div>
            <div style={{fontSize:11,color:"#888",marginTop:2}}>{myLastPts===10?"Tu bats ton record perso !":myLastPts===5?"Proche de ton meilleur !":"Continue de t'améliorer !"}</div>
          </div>
        )}
        <button onClick={()=>{setLbMode(mode);setLbDiff(diff);loadLeaderboard(lbMode);setShowLeaderboard(true);}}
          style={{width:"100%",padding:"14px",background:"#f0f9f4",color:"#16a34a",border:"2px solid #86efac",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>
          <span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>{Icon.stadium(16,"#16a34a")} Voir le classement{myLbRank?` · #${myLbRank}`:""}</span>
        </button>
        <button onClick={()=>{if(isChain)startChain();else startCompetition();}} style={{width:"100%",padding:"18px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.ball(18,G.white)} Rejouer</button>
        <button onClick={()=>setScreen("home")} style={{width:"100%",padding:"14px",background:"transparent",color:"#bbb",border:"2px solid #e5e5e0",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:700}}>↩ Accueil</button>
      </div>
    </div>
  );


  // ── WAITING FOR ROOM RESULTS ──
  // ── DUEL RESULT SCREEN ──
  if (duelResult && duelResult.isRoom) {
    const medals = ["🥇","🥈","🥉"];
    const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
    const myRank = duelResult.players.findIndex(function(p){return p.id===playerId;}) + 1;
    return (
      <div style={{...shell,animation:"fadeUp .4s ease",overflow:"auto"}} key="roomResult">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{zIndex:1,padding:"32px 20px 16px",textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:8}}>{myRank<=3?medals[myRank-1]:myRank+"ème"}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(30px,8vw,50px)",color:myRank===1?G.gold:G.white,letterSpacing:2}}>
            {myRank===1?"VICTOIRE !":myRank===2?"2ÈME PLACE":myRank===3?"3ÈME PLACE":"RÉSULTATS"}
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {duelResult.players.map(function(p,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,background:p.id===playerId?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:p.id===playerId?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6}}>
              <div style={{fontFamily:G.heading,fontSize:22,width:32,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>{i<3?medals[i]:i+1}</div>
              <div style={{flex:1,fontSize:14,fontWeight:800,color:p.id===playerId?G.accent:G.white}}>{p.name}{p.id===playerId?" (toi)":""}</div>
              <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{p.score||0} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
            </div>
          );})}
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:8}}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }
  if (duelResult) {
    const won = duelResult.myScore > duelResult.theirScore;
    const draw = duelResult.myScore === duelResult.theirScore;
    const abandoned = duelResult.opponentAbandoned;
    const emoji = abandoned ? "🏃" : won ? "🏆" : draw ? "🤝" : "😅";
    const label = abandoned ? "ABANDON !" : won ? "VICTOIRE !" : draw ? "ÉGALITÉ !" : "DÉFAITE";
    const labelColor = won || abandoned ? G.accent : draw ? G.gold : "#FF3D57";
    return (
      <div style={{...shell,animation:"fadeUp .4s ease"}} key="duelResult">
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        {/* Bandes pelouse */}
        {[0,1,2,3,4,5,6].map(function(i){return(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>
        );})}
        {/* Ligne médiane */}
        <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
        {/* Cercle central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
        {/* Point central */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.2)"}}/>
        {/* Overlay sombre pour lisibilité */}
        <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.45)"}}/>
      </div>
        <div style={{zIndex:1,padding:"40px 20px 16px",textAlign:"center"}}>
          <div style={{fontSize:72,marginBottom:8,animation:"popIn .6s ease"}}>{emoji}</div>
          <div style={{fontFamily:G.heading,fontSize:"clamp(36px,9vw,56px)",color:labelColor,letterSpacing:2}}>{label}</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:4}}>
            {abandoned ? duelResult.oppName+" a abandonné 🏃" : "Duel "+(duelResult.mode==="pont"?"The Plug":"The Mercato")}
          </div>
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {/* Scores */}
          <div style={{display:"flex",gap:12,marginBottom:8}}>
            <div style={{flex:1,background:"rgba(0,230,118,.08)",border:"2px solid "+(won?"#00E676":"rgba(255,255,255,.08)"),borderRadius:20,padding:"20px 12px",textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:6}}>Toi</div>
              <div style={{fontFamily:G.heading,fontSize:52,color:won?G.accent:G.white,lineHeight:1}}>{duelResult.myScore}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>pts</div>
            </div>
            <div style={{display:"flex",alignItems:"center",fontFamily:G.heading,fontSize:24,color:"rgba(255,255,255,.3)"}}>VS</div>
            <div style={{flex:1,background:"rgba(255,255,255,.04)",border:"2px solid "+(!won&&!draw?"#FF3D57":"rgba(255,255,255,.08)"),borderRadius:20,padding:"20px 12px",textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:6}}>{duelResult.oppName}</div>
              <div style={{fontFamily:G.heading,fontSize:52,color:(!won&&!draw)?"#FF3D57":G.white,lineHeight:1}}>{duelResult.theirScore}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>pts</div>
            </div>
          </div>
          <div style={{fontSize:15,color:"rgba(255,255,255,.85)",textAlign:"center",padding:"10px 0",fontWeight:700,lineHeight:1.4}}>
            {abandoned
              ? "T'as même pas eu le courage de finir 😂"
              : won
              ? [
                  "T'as mis la misère à "+duelResult.oppName+" 💀",
                  "T'es chaud comme Mbappé un soir de CL 🔥",
                  duelResult.oppName+" vient de prendre une leçon 😤",
                  "LA COUPE IL RESTE AU MAROOOC, T'ES UN JNOUN OU QUOI?! 🏆",
                  "On joue pas dans la même cour frère 🐐",
                ][Math.floor(duelResult.myScore * 7) % 5]
              : draw
              ? "Match nul, mais on sait qui était le meilleur 👀"
              : [
                  "Même pas un but ! Même pas un but ! 😂",
                  "T'as les crampons mais pas le niveau frère 💀",
                  "Retourne jouer à la Playstation 🎮",
                  duelResult.oppName+" t'a mis dans sa poche 😭",
                  "T'as cru quoi, que c'était FIFA ? 🤡",
                ][Math.floor(duelResult.theirScore * 7) % 5]
            }
          </div>
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:8}}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if(screen==="chainEnd") return makeResultScreen(chainScore,"chaine",true);
  if(screen==="final") return makeResultScreen(total,"pont",false);

  return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white}}>Chargement…</div></div>;
}
