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
const SEASON_START = new Date("2026-04-13T00:00:00Z");
const SEASON_DURATION_DAYS = 14;

function getCurrentSeason() {
  const now = new Date();
  const elapsed = now - SEASON_START;
  const seasonMs = SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const num = Math.floor(elapsed / seasonMs);
  const start = new Date(SEASON_START.getTime() + num * seasonMs);
  const end = new Date(start.getTime() + seasonMs);
  const remaining = end - now;
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { num: num + 1, start, end, days, hours };
}

const GRADES = [
  { min:500, label:"GOAT",    emoji:"🐐", color:"#FFD700" },
  { min:300, label:"Légende", emoji:"⭐", color:"#FF6B35" },
  { min:200, label:"Elite",   emoji:"💎", color:"#00B4D8" },
  { min:150, label:"Expert",  emoji:"🔥", color:"#E63946" },
  { min:100, label:"Pro",     emoji:"⚡", color:"#2EC4B6" },
  { min:50,  label:"Amateur", emoji:"🎯", color:"#A8DADC" },
  { min:0,   label:"Rookie",  emoji:"👶", color:"#8D99AE" },
];

function getGrade(score) {
  return GRADES.find(function(g){ return score >= g.min; }) || GRADES[GRADES.length-1];
}
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
  { name:"Joaquín Panichelli", clubs:["Deportivo Alavés", "CD Mirandés", "RC Strasbourg"], diff:"expert" },
  { name:"Micky van de Ven", clubs:["Volendam", "Wolfsburg", "Tottenham"], diff:"moyen" },
  { name:"Mike Penders", clubs:["Chelsea"], diff:"expert" },
  { name:"Nilson Angulo", clubs:["Sunderland"], diff:"expert" },
  { name:"Taiwo Awoniyi", clubs:["Liverpool", "Union Berlin", "Nottingham Forest"], diff:"moyen" },
  { name:"Omar Marmoush", clubs:["Stuttgart", "Wolfsburg", "Eintracht Frankfurt", "Manchester City"], diff:"moyen" },
  { name:"Patrick Dorgu", clubs:["Lecce", "Manchester United"], diff:"moyen" },
  { name:"Cristian Romero", clubs:["Juventus", "Atalanta", "Tottenham"], diff:"moyen" },
  { name:"Danny Welbeck", clubs:["Manchester United", "Sunderland", "Arsenal", "Watford", "Brighton"], diff:"moyen" },
  { name:"Senne Lammens", clubs:["Antwerp", "Manchester United"], diff:"expert" },
  { name:"Nick Woltemade", clubs:["Werder Bremen", "Stuttgart", "Newcastle"], diff:"expert" },
  { name:"Piero Hincapié", clubs:["Talleres", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Raúl Jiménez", clubs:["Atletico Madrid", "Benfica", "Wolverhampton", "Fulham"], diff:"moyen" },
  { name:"Amad Diallo", clubs:["Atalanta", "Manchester United", "Sunderland"], diff:"moyen" },
  { name:"Harry Wilson", clubs:["Liverpool", "Bournemouth", "Fulham"], diff:"expert" },
  { name:"Estêvão Willian", clubs:["Palmeiras", "Chelsea"], diff:"moyen" },
  { name:"Brennan Johnson", clubs:["Nottingham Forest", "Tottenham"], diff:"moyen" },
  { name:"Robert Sánchez", clubs:["Brighton", "Chelsea"], diff:"moyen" },
  { name:"Marcos Senesi", clubs:["Feyenoord", "Bournemouth"], diff:"expert" },
  { name:"Igor Thiago", clubs:["Club Brugge", "Brentford"], diff:"expert" },
  { name:"Antoine Semenyo", clubs:["Bristol City", "Bournemouth"], diff:"expert" },
  { name:"Benjamin Šeško", clubs:["Salzburg", "RB Leipzig", "Manchester United"], diff:"moyen" },
  { name:"Bryan Mbeumo", clubs:["Troyes", "Brentford", "Manchester United"], diff:"moyen" },
  { name:"Hugo Ekitiké", clubs:["Reims", "PSG", "Eintracht Frankfurt", "Liverpool"], diff:"moyen" },
  { name:"João Pedro", clubs:["Watford", "Brighton", "Chelsea"], diff:"moyen" },
  { name:"Max Dowman", clubs:["Arsenal"], diff:"expert" },
  { name:"Marc Guéhi", clubs:["Chelsea", "Swansea", "Crystal Palace"], diff:"moyen" },
  { name:"James Milner", clubs:["Leeds United", "Newcastle", "Aston Villa", "Manchester City", "Liverpool", "Brighton"], diff:"moyen" },
  { name:"Matheus Cunha", clubs:["Leipzig", "Hertha Berlin", "Atletico Madrid", "Wolverhampton"], diff:"moyen" },
  { name:"Eberechi Eze", clubs:["Crystal Palace", "Arsenal"], diff:"moyen" },
  { name:"Diego Moreira", clubs:["RC Strasbourg"], diff:"expert" },
  { name:"Sidiki Chérif", clubs:["Angers"], diff:"expert" },
  { name:"Senny Mayulu", clubs:["PSG"], diff:"expert" },
  { name:"Malick Fofana", clubs:["Gent", "Lyon", "PSG"], diff:"moyen" },
  { name:"Ibrahim Mbaye", clubs:["PSG"], diff:"expert" },
  { name:"Lucas Beraldo", clubs:["Flamengo", "PSG"], diff:"expert" },
  { name:"Pierre-Emile Højbjerg", clubs:["Bayern Munich", "Southampton", "Tottenham", "Marseille"], diff:"moyen" },
  { name:"Mason Greenwood", clubs:["Manchester United", "Getafe", "Marseille"], diff:"moyen" },
  { name:"Désiré Doué", clubs:["Rennes", "PSG"], diff:"moyen" },
  { name:"Luis Díaz", clubs:["Porto", "Liverpool", "Bayern Munich"], diff:"moyen" },
  { name:"Deniz Undav", clubs:["Brighton", "Stuttgart"], diff:"moyen" },
  { name:"Can Uzun", clubs:["Nuremberg", "Eintracht Frankfurt"], diff:"expert" },
  { name:"Lennart Karl", clubs:["Bayern Munich"], diff:"expert" },
  { name:"Serhou Guirassy", clubs:["Stuttgart", "Borussia Dortmund"], diff:"moyen" },
  { name:"Haris Tabaković", clubs:["Borussia Monchengladbach"], diff:"expert" },
  { name:"Nico Schlotterbeck", clubs:["Freiburg", "Borussia Dortmund"], diff:"moyen" },
  { name:"Julian Ryerson", clubs:["Union Berlin", "Borussia Dortmund"], diff:"expert" },
  { name:"Kevin Diks", clubs:["Fiorentina", "Borussia Monchengladbach"], diff:"expert" },
  { name:"Younes Ebnoutalib", clubs:["Eintracht Frankfurt"], diff:"expert" },
  { name:"Ozan Kabak", clubs:["Schalke", "Liverpool", "Hoffenheim"], diff:"moyen" },
  { name:"Saïd El Mala", clubs:["Cologne"], diff:"expert" },
  { name:"Jonathan Burkardt", clubs:["Mainz", "Eintracht Frankfurt"], diff:"moyen" },
  { name:"Luka Vušković", clubs:["Hamburger SV"], diff:"expert" },
  { name:"Nicolas Jackson", clubs:["Chelsea"], diff:"moyen" },
  { name:"Julian Brandt", clubs:["Bayer Leverkusen", "Borussia Dortmund"], diff:"moyen" },
  { name:"Jonas Urbig", clubs:["Bayern Munich"], diff:"expert" },
  { name:"Jobe Bellingham", clubs:["Sunderland", "Borussia Dortmund"], diff:"moyen" },
  { name:"Fábio Vieira", clubs:["Porto", "Arsenal", "Hamburger SV"], diff:"expert" },
  { name:"Albian Hajdari", clubs:["Lugano", "Hoffenheim"], diff:"expert" },
  { name:"Farès Chaïbi", clubs:["Toulouse", "Eintracht Frankfurt"], diff:"expert" },
  { name:"Karim Adeyemi", clubs:["Salzburg", "Borussia Dortmund"], diff:"moyen" },
  { name:"Mario Götze", clubs:["Borussia Dortmund", "Bayern Munich", "PSV Eindhoven", "Eintracht Frankfurt"], diff:"moyen" },
  { name:"Ritsu Doan", clubs:["PSV Eindhoven", "Freiburg", "Eintracht Frankfurt"], diff:"moyen" },
  { name:"Jonathan Tah", clubs:["Bayer Leverkusen", "Bayern Munich"], diff:"moyen" },
  { name:"Victor Boniface", clubs:["Bayer Leverkusen", "Werder Bremen"], diff:"moyen" },
  { name:"Angelo Stiller", clubs:["Stuttgart"], diff:"expert" },
  { name:"Maximilian Beier", clubs:["Hoffenheim", "Borussia Dortmund"], diff:"expert" },
  { name:"Konrad Laimer", clubs:["Salzburg", "RB Leipzig", "Bayern Munich"], diff:"moyen" },
  { name:"Patrik Schick", clubs:["Roma", "Sampdoria", "RB Leipzig", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Álex Grimaldo", clubs:["Barcelona", "Benfica", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Marcel Sabitzer", clubs:["RB Leipzig", "Bayern Munich", "Manchester United", "Borussia Dortmund"], diff:"moyen" },
  { name:"Niklas Süle", clubs:["Hoffenheim", "Bayern Munich", "Borussia Dortmund"], diff:"moyen" },
  { name:"Péter Gulácsi", clubs:["Liverpool", "RB Leipzig"], diff:"moyen" },
  { name:"Raphaël Guerreiro", clubs:["Lorient", "Borussia Dortmund", "Bayern Munich"], diff:"moyen" },
  { name:"Aleksandar Pavlović", clubs:["Bayern Munich"], diff:"expert" },
  { name:"Josip Stanišić", clubs:["Bayern Munich", "Bayer Leverkusen"], diff:"expert" },
  { name:"Nadiem Amiri", clubs:["Hoffenheim", "Bayer Leverkusen", "Mainz"], diff:"expert" },
  { name:"Alexander Nübel", clubs:["Schalke", "Bayern Munich", "Stuttgart"], diff:"expert" },
  { name:"Hiroki Itō", clubs:["Stuttgart", "Bayern Munich"], diff:"expert" },
  { name:"Ayase Ueda", clubs:["Cercle Bruges", "Feyenoord"], diff:"expert" },
  { name:"Mika Godts", clubs:["Ajax Amsterdam"], diff:"expert" },
  { name:"Troy Parrott", clubs:["Tottenham", "AZ"], diff:"expert" },
  { name:"Ismael Saibari", clubs:["PSV Eindhoven"], diff:"expert" },
  { name:"Jizz Hornkamp", clubs:["AZ"], diff:"expert" },
  { name:"Guus Til", clubs:["Feyenoord", "PSV Eindhoven"], diff:"expert" },
  { name:"Justin Hubner", clubs:["PSV Eindhoven", "Fortuna Sittard"], diff:"expert" },
  { name:"Maarten Paes", clubs:["Ajax Amsterdam", "FC Dallas"], diff:"expert" },
  { name:"Mohamed Ihattaren", clubs:["PSV Eindhoven", "Juventus", "Ajax Amsterdam", "Fortuna Sittard"], diff:"expert" },
  { name:"Mees Hilgers", clubs:["Twente"], diff:"expert" },
  { name:"Shaqueel van Persie", clubs:["Feyenoord"], diff:"expert" },
  { name:"Miliano Jonathans", clubs:["Utrecht"], diff:"expert" },
  { name:"Oleksandr Zinchenko", clubs:["Manchester City", "Arsenal", "Ajax Amsterdam"], diff:"moyen" },
  { name:"Sem Steijn", clubs:["Twente", "Feyenoord"], diff:"expert" },
  { name:"Ricardo Pepi", clubs:["FC Dallas", "Augsburg", "PSV Eindhoven"], diff:"expert" },
  { name:"Wout Weghorst", clubs:["Wolfsburg", "Burnley", "Manchester United", "Ajax Amsterdam"], diff:"moyen" },
  { name:"Bryan Linssen", clubs:["Feyenoord", "NEC Nijmegen"], diff:"expert" },
  { name:"Mats Deijl", clubs:["Feyenoord"], diff:"expert" },
  { name:"Dean James", clubs:["Go Ahead Eagles"], diff:"expert" },
  { name:"Calvin Verdonk", clubs:["Feyenoord", "NEC Nijmegen", "Lille"], diff:"expert" },
  { name:"Kōdai Sano", clubs:["NEC Nijmegen"], diff:"expert" },
  { name:"Sean Steur", clubs:["Ajax Amsterdam"], diff:"expert" },
  { name:"Remko Pasveer", clubs:["Heracles", "Ajax Amsterdam"], diff:"expert" },
  { name:"Ivan Perišić", clubs:["Borussia Dortmund", "Bayern Munich", "Inter Milan", "Tottenham", "PSV Eindhoven"], diff:"moyen" },
  { name:"Stije Resink", clubs:["Groningen"], diff:"expert" },
  { name:"Joey Veerman", clubs:["PSV Eindhoven"], diff:"expert" },
  { name:"Wouter Goes", clubs:["AZ"], diff:"expert" },
  { name:"Luciano Valente", clubs:["Feyenoord"], diff:"expert" },
  { name:"Takehiro Tomiyasu", clubs:["Bologna", "Arsenal", "Ajax Amsterdam"], diff:"moyen" },
  { name:"Mateo Chávez", clubs:["AZ"], diff:"expert" },
  { name:"Souffian El Karouani", clubs:["Utrecht"], diff:"expert" },
  { name:"Kees Smit", clubs:["AZ"], diff:"expert" },
  { name:"Tjaronn Chery", clubs:["NEC Nijmegen"], diff:"expert" },
  { name:"Steven Berghuis", clubs:["Feyenoord", "Ajax Amsterdam"], diff:"expert" },
  { name:"Lequincio Zeefulk", clubs:["Heracles"], diff:"expert" },
  { name:"Anis Hadj Moussa", clubs:["Feyenoord"], diff:"expert" },
  { name:"Kay Tejan", clubs:["Telstar"], diff:"expert" },
  { name:"Maher Carrizo", clubs:["Ajax Amsterdam"], diff:"expert" },
  { name:"Timon Wellenreuther", clubs:["Feyenoord"], diff:"expert" },
  { name:"Jasper Cillessen", clubs:["Ajax Amsterdam", "Valencia", "NEC Nijmegen"], diff:"moyen" },
  { name:"Rayane Bounida", clubs:["Ajax Amsterdam"], diff:"expert" },
  { name:"Niek Schiks", clubs:["PSV Eindhoven"], diff:"expert" },
  { name:"André Ayew", clubs:["Marseille", "Swansea", "West Ham", "Fenerbahce", "NAC Breda"], diff:"moyen" },
  { name:"Davy Klaassen", clubs:["Ajax Amsterdam", "Everton", "Werder Bremen", "Inter Milan"], diff:"moyen" },
  { name:"Oscar Gloukh", clubs:["Salzburg", "Ajax Amsterdam"], diff:"expert" },
  { name:"Sergiño Dest", clubs:["Ajax Amsterdam", "Barcelona", "AC Milan", "PSV Eindhoven"], diff:"moyen" },
  { name:"Sébastien Haller", clubs:["Ajax Amsterdam", "Borussia Dortmund", "Utrecht"], diff:"moyen" },
  { name:"Kasper Dolberg", clubs:["Ajax Amsterdam", "Nice", "Sevilla"], diff:"moyen" },
  { name:"Ko Itakura", clubs:["Manchester City", "Schalke", "Borussia Monchengladbach", "Ajax Amsterdam"], diff:"expert" },
  { name:"Ruben van Bommel", clubs:["PSV Eindhoven"], diff:"expert" },
  { name:"Luis Suárez", clubs:["Sporting CP"], diff:"expert" },
  { name:"Vangélis Pavlídis", clubs:["AZ", "Benfica"], diff:"moyen" },
  { name:"Yanis Begraoui", clubs:["Estoril"], diff:"expert" },
  { name:"Samu Aghehowa", clubs:["Porto"], diff:"expert" },
  { name:"Jesús Andrés", clubs:["Nacional"], diff:"expert" },
  { name:"Francisco Trincão", clubs:["Barcelona", "Sporting CP"], diff:"moyen" },
  { name:"Rafa Silva", clubs:["Braga", "Benfica"], diff:"expert" },
  { name:"Gianluca Prestianni", clubs:["Benfica"], diff:"expert" },
  { name:"Ricardo Horta", clubs:["Braga", "Benfica"], diff:"expert" },
  { name:"Rodrigo Zalazar", clubs:["Braga"], diff:"expert" },
  { name:"Geny Catamo", clubs:["Sporting CP"], diff:"expert" },
  { name:"Dinis Pinto", clubs:["Sporting CP", "Moreirense"], diff:"expert" },
  { name:"João Carvalho", clubs:["Benfica", "Nottingham Forest", "Estoril"], diff:"expert" },
  { name:"Rodrigo Mora", clubs:["Porto"], diff:"expert" },
  { name:"Alisson Santos", clubs:["Sporting CP"], diff:"expert" },
  { name:"Bruma", clubs:["Sporting CP", "Galatasaray", "RB Leipzig"], diff:"moyen" },
  { name:"Richard Ríos", clubs:["Palmeiras", "Benfica"], diff:"expert" },
  { name:"Anísio Cabral", clubs:["Benfica"], diff:"expert" },
  { name:"Seko Fofana", clubs:["Lens", "Porto"], diff:"moyen" },
  { name:"Deniz Gül", clubs:["Porto"], diff:"expert" },
  { name:"Nicolás Otamendi", clubs:["Valencia", "Manchester City", "Benfica"], diff:"moyen" },
  { name:"Pedro Gonçalves", clubs:["Sporting CP"], diff:"expert" },
  { name:"Diogo Costa", clubs:["Porto"], diff:"moyen" },
  { name:"Morten Hjulmand", clubs:["Lecce", "Sporting CP"], diff:"expert" },
  { name:"Anatolii Trubin", clubs:["Shakhtar", "Benfica"], diff:"expert" },
  { name:"António Silva", clubs:["Benfica"], diff:"moyen" },
  { name:"Gonçalo Inácio", clubs:["Sporting CP"], diff:"expert" },
  { name:"Orkun Kökçü", clubs:["Feyenoord", "Benfica"], diff:"moyen" },
  { name:"Georgiy Sudakov", clubs:["Shakhtar", "Benfica"], diff:"expert" },
  { name:"Andreas Schjelderup", clubs:["Nordsjaelland", "Benfica"], diff:"expert" },
  { name:"Hidemasa Morita", clubs:["Sporting CP"], diff:"expert" },
  { name:"Geovany Quenda", clubs:["Sporting CP"], diff:"expert" },
  { name:"Ousmane Diomande", clubs:["Sporting CP"], diff:"expert" },
  { name:"Leandro Barreiro", clubs:["Benfica"], diff:"expert" },
  { name:"Fredrik Aursnes", clubs:["Molde", "Feyenoord", "Benfica"], diff:"expert" },
  { name:"Nuno Santos", clubs:["Sporting CP"], diff:"expert" },
  { name:"João Moutinho", clubs:["Sporting CP", "Porto", "Monaco", "Wolverhampton"], diff:"moyen" },
  { name:"Maximiliano Araújo", clubs:["Sporting CP", "Braga"], diff:"expert" },
  { name:"Fótis Ioannídis", clubs:["Sporting CP"], diff:"expert" },
  { name:"Dodi Lukébakio", clubs:["Watford", "Hertha Berlin", "Sevilla", "Benfica"], diff:"moyen" },
  { name:"Florentino Luís", clubs:["Benfica", "Monaco"], diff:"expert" },
  { name:"Victor Froholdt", clubs:["Porto"], diff:"expert" },
  { name:"Rui Silva", clubs:["Granada", "Real Betis", "Sporting CP"], diff:"expert" },
  { name:"Jakub Kiwior", clubs:["Spezia", "Arsenal", "Porto"], diff:"moyen" },
  { name:"Tomás Araújo", clubs:["Benfica"], diff:"expert" },
  { name:"Jan Bednarek", clubs:["Southampton", "Porto"], diff:"moyen" },
  { name:"Luuk de Jong", clubs:["Borussia Monchengladbach", "Newcastle", "PSV Eindhoven", "Barcelona", "Sevilla", "Porto"], diff:"moyen" },
  { name:"Ricardo Mangas", clubs:["Sporting CP"], diff:"expert" },
  { name:"Paul Onuachu", clubs:["Genk", "Southampton", "Trabzonspor"], diff:"expert" },
  { name:"Eldor Shomurodov", clubs:["Roma", "İstanbul Başakşehir"], diff:"expert" },
  { name:"Mauro Icardi", clubs:["Inter Milan", "PSG", "Galatasaray"], diff:"moyen" },
  { name:"Talisca", clubs:["Benfica", "Besiktas", "Guangzhou", "Al Nassr", "Fenerbahce"], diff:"moyen" },
  { name:"N'Golo Kanté", clubs:["Leicester City", "Chelsea", "Al Ittihad", "Fenerbahce"], diff:"facile" },
  { name:"Barış Alper Yılmaz", clubs:["Galatasaray"], diff:"expert" },
  { name:"Noa Lang", clubs:["Ajax Amsterdam", "Club Brugge", "PSV Eindhoven", "Galatasaray"], diff:"moyen" },
  { name:"Yáser Asprilla", clubs:["Watford", "Fenerbahce"], diff:"expert" },
  { name:"Ernest Muçi", clubs:["Besiktas"], diff:"expert" },
  { name:"Göktan Gürpüz", clubs:["Trabzonspor", "Besiktas"], diff:"expert" },
  { name:"Mohamed Bayo", clubs:["Clermont", "Galatasaray", "Gaziantep"], diff:"expert" },
  { name:"Felipe Augusto", clubs:["Trabzonspor"], diff:"expert" },
  { name:"Kerem Aktürkoğlu", clubs:["Galatasaray", "Fenerbahce"], diff:"moyen" },
  { name:"Renato Nhaga", clubs:["Galatasaray"], diff:"expert" },
  { name:"Václav Černý", clubs:["Twente", "Wolfsburg", "Besiktas"], diff:"expert" },
  { name:"Mattéo Guendouzi", clubs:["Arsenal", "Marseille", "Fenerbahce"], diff:"moyen" },
  { name:"Emmanuel Agbadou", clubs:["Reims", "Wolfsburg", "Besiktas"], diff:"expert" },
  { name:"Nene Dorgeles", clubs:["Fenerbahce"], diff:"expert" },
  { name:"Yunus Akgün", clubs:["Galatasaray", "Leicester City"], diff:"expert" },
  { name:"Leroy Sané", clubs:["Manchester City", "Bayern Munich", "Galatasaray"], diff:"facile" },
  { name:"Christ Inao Oulaï", clubs:["Trabzonspor"], diff:"expert" },
  { name:"Milan Škriniar", clubs:["Inter Milan", "PSG", "Fenerbahce"], diff:"moyen" },
  { name:"Uğurcan Çakır", clubs:["Trabzonspor", "Galatasaray"], diff:"expert" },
  { name:"Lucas Torreira", clubs:["Sampdoria", "Arsenal", "Atletico Madrid", "Galatasaray"], diff:"moyen" },
  { name:"Junior Olaitan", clubs:["Besiktas"], diff:"expert" },
  { name:"Anthony Musaba", clubs:["Feyenoord", "Fenerbahce"], diff:"expert" },
  { name:"İrfan Can Kahveci", clubs:["Fenerbahce", "Kasımpaşa"], diff:"expert" },
  { name:"Umut Nayir", clubs:["Trabzonspor"], diff:"expert" },
  { name:"Alexandru Maxim", clubs:["Stuttgart", "Mainz", "Gaziantep"], diff:"expert" },
  { name:"Bartuğ Elmaz", clubs:["Karagümrük"], diff:"expert" },
  { name:"Cenk Tosun", clubs:["Besiktas", "Everton", "Kasımpaşa"], diff:"moyen" },
  { name:"Yasin Özcan", clubs:["Besiktas"], diff:"expert" },
  { name:"Kristjan Asllani", clubs:["Empoli", "Inter Milan", "Club Brugge"], diff:"expert" },
  { name:"Wilfried Singo", clubs:["Torino", "Monaco", "Galatasaray"], diff:"moyen" },
  { name:"Yiğit Efe Demir", clubs:["Fenerbahce"], diff:"expert" },
  { name:"Oh Hyeon-gyu", clubs:["Celtic", "RC Strasbourg", "Besiktas"], diff:"expert" },
  { name:"Armando Güner", clubs:["Galatasaray"], diff:"expert" },
  { name:"Semih Kılıçsoy", clubs:["Besiktas"], diff:"expert" },
  { name:"Kerem Demirbay", clubs:["Bayer Leverkusen", "Galatasaray", "Kasımpaşa"], diff:"moyen" },
  { name:"Güven Yalçın", clubs:["Alanyaspor"], diff:"expert" },
  { name:"El Bilal Touré", clubs:["Almeria", "Atalanta", "Besiktas"], diff:"moyen" },
  { name:"Gabriel Sara", clubs:["Norwich City", "Galatasaray"], diff:"expert" },
  { name:"Amir Murillo", clubs:["Anderlecht", "Besiktas"], diff:"expert" },
  { name:"Davinson Sánchez", clubs:["Ajax Amsterdam", "Tottenham", "Galatasaray"], diff:"moyen" },
  { name:"Julián Quiñones", clubs:["Club América", "Al Qadsiah"], diff:"expert" },
  { name:"Roger Martínez", clubs:["Club América", "Al Taawon"], diff:"expert" },
  { name:"João Félix", clubs:["Atletico Madrid", "Chelsea", "Barcelona", "Al Nassr"], diff:"moyen" },
  { name:"Joshua King", clubs:["Manchester United", "Bournemouth", "Everton", "Al Qadsiah"], diff:"moyen" },
  { name:"Kóstas Fortoúnis", clubs:["Bayer Leverkusen", "Olympiacos", "Al Qadsiah"], diff:"expert" },
  { name:"Mateo Retegui", clubs:["Tigre", "Genoa", "Atalanta", "Al Qadsiah"], diff:"moyen" },
  { name:"Sadio Mané", clubs:["Liverpool", "Bayern Munich", "Al Nassr"], diff:"facile" },
  { name:"Georginio Wijnaldum", clubs:["PSV Eindhoven", "Newcastle", "Liverpool", "PSG", "Al-Ettifaq"], diff:"moyen" },
  { name:"Darwin Núñez", clubs:["Almeria", "Benfica", "Liverpool", "Al Hilal"], diff:"moyen" },
  { name:"Marcos Leonardo", clubs:["Santos", "Al Hilal"], diff:"expert" },
  { name:"Merih Demiral", clubs:["Juventus", "Atalanta", "Al Ahli"], diff:"moyen" },
  { name:"Angelo Fulgini", clubs:["Angers", "Mainz", "Al Taawon"], diff:"expert" },
  { name:"Youssef En-Nesyri", clubs:["Sevilla", "Fenerbahce", "Al Ittihad"], diff:"moyen" },
  { name:"Moussa Diaby", clubs:["PSG", "Bayer Leverkusen", "Aston Villa", "Al Ittihad"], diff:"moyen" },
  { name:"Yusuf Akçiçek", clubs:["Al Hilal"], diff:"expert" },
  { name:"Théo Hernandez", clubs:["Real Madrid", "AC Milan", "Al Hilal"], diff:"moyen" },
  { name:"Saïmon Bouabré", clubs:["Al Hilal"], diff:"expert" },
  { name:"Ângelo", clubs:["Santos", "Chelsea", "Al Nassr"], diff:"expert" },
  { name:"Pablo Marí", clubs:["Arsenal", "Monza", "Al Hilal"], diff:"expert" },
  { name:"Salem Al-Dawsari", clubs:["Al Hilal"], diff:"expert" },
  { name:"Otávio Edmilson", clubs:["Porto", "Al Nassr", "Al Qadsiah"], diff:"expert" },
  { name:"João Cancelo", clubs:["Juventus", "Manchester City", "Barcelona", "Bayern Munich", "Al Hilal"], diff:"moyen" },
  { name:"Rúben Neves", clubs:["Porto", "Wolverhampton", "Al Hilal"], diff:"moyen" },
  { name:"Abderrazak Hamed Allah", clubs:["Al Shabab"], diff:"expert" },
  { name:"Jhon Durán", clubs:["Chicago Fire", "Aston Villa", "Al Nassr"], diff:"moyen" },
  { name:"Yassine Bounou", clubs:["Girona", "Sevilla", "Al Hilal"], diff:"moyen" },
  { name:"Marcelo Brozović", clubs:["Inter Milan", "Al Nassr"], diff:"moyen" },
  { name:"Sergej Milinković-Savić", clubs:["Lazio", "Al Hilal"], diff:"moyen" },
  { name:"Malcom", clubs:["Barcelona", "Zenit Saint Petersburg", "Al Hilal"], diff:"moyen" },
  { name:"Omar Al Somah", clubs:["Al Ahli", "Al Hazm"], diff:"expert" },
  { name:"Íñigo Martínez", clubs:["Athletic Bilbao", "Barcelona", "Al Nassr"], diff:"moyen" },
  { name:"Nawaf Al-Aqidi", clubs:["Al Nassr"], diff:"expert" },
  { name:"Franck Kessié", clubs:["Atalanta", "AC Milan", "Barcelona", "Al Ahli"], diff:"moyen" },
  { name:"Édouard Mendy", clubs:["Chelsea", "Al Ahli"], diff:"moyen" },
  { name:"Mohamed Simakan", clubs:["Strasbourg", "RB Leipzig", "Al Nassr"], diff:"moyen" },
  { name:"Houssem Aouar", clubs:["Lyon", "Roma", "Al Ittihad"], diff:"moyen" },
  { name:"Ali Al-Bulaihi", clubs:["Al Hilal"], diff:"expert" },
  { name:"Steven Bergwijn", clubs:["PSV Eindhoven", "Tottenham", "Ajax Amsterdam", "Al Ittihad"], diff:"moyen" },
  { name:"Abdulelah Al-Amri", clubs:["Al Nassr"], diff:"expert" },
  { name:"Roger Ibañez", clubs:["Atalanta", "Roma", "Al Ahli"], diff:"moyen" },
  { name:"Bento", clubs:["Athletico Paranaense", "Al Nassr"], diff:"expert" },
  { name:"Firas Al-Buraikan", clubs:["Al Ahli"], diff:"expert" },
  { name:"Abdulrahman Ghareeb", clubs:["Al Nassr"], diff:"expert" },
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
  { name:"Luis Suarez", clubs:["Ajax Amsterdam", "Liverpool", "Barcelona", "Atletico Madrid"], diff:"facile" },
  { name:"Zlatan Ibrahimovic", clubs:["Malmo", "Ajax Amsterdam", "Juventus", "Inter Milan", "Barcelona", "AC Milan", "PSG", "Manchester United", "LA Galaxy"], diff:"facile" },
  { name:"Gareth Bale", clubs:["Southampton", "Tottenham", "Real Madrid"], diff:"facile" },
  { name:"Wayne Rooney", clubs:["Everton", "Manchester United", "DC United"], diff:"facile" },
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
  { name:"Frenkie de Jong", clubs:["Ajax Amsterdam", "Barcelona"], diff:"moyen" },
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
  { name:"Jordan Henderson", clubs:["Sunderland", "Liverpool", "Al Ettifaq", "Ajax Amsterdam"], diff:"moyen" },
  { name:"Harry Maguire", clubs:["Leicester City", "Manchester United", "West Ham"], diff:"moyen" },
  { name:"Kieran Trippier", clubs:["Tottenham", "Atletico Madrid", "Newcastle"], diff:"moyen" },
  { name:"Nicolas Otamendi", clubs:["Valencia", "Manchester City", "Benfica"], diff:"moyen" },
  { name:"Lisandro Martinez", clubs:["Ajax Amsterdam", "Manchester United"], diff:"moyen" },
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
  { name:"Memphis Depay", clubs:["PSV Eindhoven", "Manchester United", "Lyon", "Barcelona", "Atletico Madrid"], diff:"moyen" },
  { name:"Jadon Sancho", clubs:["Borussia Dortmund", "Manchester United", "Chelsea"], diff:"moyen" },
  { name:"Mason Mount", clubs:["Chelsea", "Manchester United"], diff:"moyen" },
  { name:"Pierre-Emerick Aubameyang", clubs:["Borussia Dortmund", "Arsenal", "Barcelona", "Chelsea", "Marseille"], diff:"moyen" },
  { name:"Olivier Giroud", clubs:["Montpellier", "Arsenal", "Chelsea", "AC Milan", "LAFC", "Lille"], diff:"moyen" },
  { name:"Edinson Cavani", clubs:["Napoli", "PSG", "Manchester United"], diff:"moyen" },
  { name:"Gonzalo Higuain", clubs:["Real Madrid", "Napoli", "Juventus", "AC Milan", "Chelsea"], diff:"moyen" },
  { name:"Alvaro Morata", clubs:["Real Madrid", "Juventus", "Chelsea", "Atletico Madrid", "AC Milan"], diff:"moyen" },
  { name:"Cesc Fabregas", clubs:["Arsenal", "Barcelona", "Chelsea", "Monaco"], diff:"facile" },
  { name:"Xabi Alonso", clubs:["Real Sociedad", "Liverpool", "Real Madrid", "Bayern Munich"], diff:"facile" },
  { name:"Andres Iniesta", clubs:["Barcelona", "Vissel Kobe"], diff:"facile" },
  { name:"Frank Lampard", clubs:["West Ham", "Chelsea", "Manchester City", "New York City FC"], diff:"facile" },
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
  { name:"Mario Gotze", clubs:["Borussia Dortmund", "Bayern Munich", "PSV Eindhoven"], diff:"moyen" },
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
  { name:"Giorgio Chiellini", clubs:["Juventus", "LAFC"], diff:"moyen" },
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
  { name:"Roberto Firmino", clubs:["Hoffenheim", "Liverpool", "Al Ahli"], diff:"moyen" },
  { name:"Jamie Vardy", clubs:["Leicester City"], diff:"moyen" },
  { name:"Divock Origi", clubs:["Liverpool", "AC Milan"], diff:"expert" },
  { name:"Thomas Lemar", clubs:["Monaco", "Atletico Madrid"], diff:"expert" },
  { name:"Kingsley Coman", clubs:["PSG", "Juventus", "Bayern Munich"], diff:"moyen" },
  { name:"Ciro Immobile", clubs:["Juventus", "Torino", "Borussia Dortmund", "Lazio"], diff:"moyen" },
  { name:"Lorenzo Insigne", clubs:["Napoli", "Toronto FC"], diff:"moyen" },
  { name:"Dries Mertens", clubs:["PSV Eindhoven", "Napoli"], diff:"moyen" },
  { name:"Hakim Ziyech", clubs:["Ajax Amsterdam", "Chelsea", "Galatasaray"], diff:"moyen" },
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
  { name:"Ruud van Nistelrooy", clubs:["PSV Eindhoven", "Manchester United", "Real Madrid"], diff:"facile" },
  { name:"Patrick Kluivert", clubs:["Ajax Amsterdam", "Barcelona", "Roma", "Valencia", "Newcastle"], diff:"moyen" },
  { name:"Dirk Kuyt", clubs:["Liverpool", "Fenerbahce"], diff:"expert" },
  { name:"Diego Forlan", clubs:["Manchester United", "Atletico Madrid", "Inter Milan"], diff:"moyen" },
  { name:"Hernan Crespo", clubs:["Lazio", "Inter Milan", "Chelsea", "AC Milan"], diff:"moyen" },
  { name:"Juan Sebastian Veron", clubs:["Lazio", "Manchester United", "Inter Milan", "Chelsea"], diff:"expert" },
  { name:"Clarence Seedorf", clubs:["Ajax Amsterdam", "Sampdoria", "Real Madrid", "Inter Milan", "AC Milan"], diff:"moyen" },
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
  { name:"Wesley Sneijder", clubs:["Ajax Amsterdam", "Real Madrid", "Inter Milan", "Galatasaray"], diff:"facile" },
  { name:"Arjen Robben", clubs:["PSV Eindhoven", "Chelsea", "Real Madrid", "Bayern Munich"], diff:"facile" },
  { name:"Mark van Bommel", clubs:["PSV Eindhoven", "Barcelona", "Bayern Munich", "AC Milan"], diff:"expert" },
  { name:"Antony", clubs:["Ajax Amsterdam", "Manchester United"], diff:"moyen" },
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
  { name:"Matthijs de Ligt", clubs:["Ajax Amsterdam", "Juventus", "Bayern Munich", "Manchester United"], diff:"moyen" },
  { name:"Diego Costa", clubs:["Atletico Madrid", "Chelsea"], diff:"moyen" },
  { name:"Sacha Boey", clubs:["Galatasaray", "Bayern Munich"], diff:"expert" },
  { name:"Gerard Pique", clubs:["Manchester United", "Barcelona"], diff:"facile" },
  { name:"Lukas Podolski", clubs:["Bayern Munich", "Arsenal", "Inter Milan", "Galatasaray"], diff:"moyen" },
  { name:"Michael Ballack", clubs:["Bayer Leverkusen", "Bayern Munich", "Chelsea"], diff:"facile" },
  { name:"Bastian Schweinsteiger", clubs:["Bayern Munich", "Manchester United", "Chicago Fire"], diff:"facile" },
  { name:"Serge Gnabry", clubs:["Arsenal", "Bayern Munich"], diff:"moyen" },
  { name:"Timo Werner", clubs:["RB Leipzig", "Chelsea", "Tottenham"], diff:"moyen" },
  { name:"Andre Schurrle", clubs:["Bayer Leverkusen", "Chelsea", "Borussia Dortmund", "Wolfsburg"], diff:"expert" },
  // ── 2016-2026 ──
  { name:"Ederson", clubs:["Benfica", "Manchester City"], diff:"moyen" },
  { name:"Alisson Becker", clubs:["Roma", "Liverpool"], diff:"moyen" },
  { name:"Marc-Andre ter Stegen", clubs:["Borussia Monchengladbach", "Barcelona"], diff:"moyen" },
  { name:"Kepa Arrizabalaga", clubs:["Athletic Bilbao", "Chelsea", "Real Madrid"], diff:"expert" },
  { name:"Andre Onana", clubs:["Ajax Amsterdam", "Inter Milan", "Manchester United"], diff:"moyen" },
  { name:"Mike Maignan", clubs:["Lille", "AC Milan"], diff:"moyen" },
  { name:"Gregor Kobel", clubs:["Stuttgart", "Borussia Dortmund"], diff:"expert" },
  { name:"Trent Alexander-Arnold", clubs:["Liverpool", "Real Madrid"], diff:"moyen" },
  { name:"Reece James", clubs:["Chelsea"], diff:"moyen" },
  { name:"Achraf Hakimi", clubs:["Real Madrid", "Borussia Dortmund", "Inter Milan", "PSG"], diff:"moyen" },
  { name:"Ferland Mendy", clubs:["Lyon", "Real Madrid"], diff:"moyen" },
  { name:"Alphonso Davies", clubs:["Vancouver Whitecaps", "Bayern Munich"], diff:"moyen" },
  { name:"Josko Gvardiol", clubs:["Dinamo Zagreb", "RB Leipzig", "Manchester City"], diff:"moyen" },
  { name:"Ibrahima Konate", clubs:["Lens", "RB Leipzig", "Liverpool"], diff:"moyen" },
  { name:"Kim Min-jae", clubs:["Fenerbahce", "Napoli", "Bayern Munich"], diff:"expert" },
  { name:"Pau Torres", clubs:["Villarreal", "Aston Villa"], diff:"expert" },
  { name:"Jurrien Timber", clubs:["Ajax Amsterdam", "Arsenal"], diff:"expert" },
  { name:"Leny Yoro", clubs:["Lille", "Manchester United"], diff:"expert" },
  { name:"Dominik Szoboszlai", clubs:["Salzburg", "RB Leipzig", "Liverpool"], diff:"moyen" },
  { name:"Phil Foden", clubs:["Manchester City"], diff:"facile" },
  { name:"Bruno Guimaraes", clubs:["Athletico Paranaense", "Lyon", "Newcastle"], diff:"expert" },
  { name:"Xavi Simons", clubs:["PSG", "PSV Eindhoven", "RB Leipzig"], diff:"moyen" },
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
  { name:"Romelu Lukaku", clubs:["Anderlecht", "Chelsea", "West Brom", "Everton", "Manchester United", "Inter Milan", "Roma", "Napoli"], diff:"facile" },
  { name:"Son Heung-min", clubs:["Tottenham"], diff:"facile" },
  { name:"Carles Puyol", clubs:["Barcelona"], diff:"moyen" },
  { name:"Radamel Falcao", clubs:["Porto", "Atletico Madrid", "Monaco", "Manchester United", "Chelsea"], diff:"facile" },
  { name:"Samir Nasri", clubs:["Marseille", "Arsenal", "Manchester City", "Sevilla"], diff:"moyen" },
  { name:"Bacary Sagna", clubs:["Arsenal", "Manchester City"], diff:"moyen" },
  { name:"Nicolas Anelka", clubs:["Arsenal", "Real Madrid", "PSG", "Manchester City", "Chelsea", "Fenerbahce"], diff:"moyen" },
  { name:"Sylvain Wiltord", clubs:["Bordeaux", "Arsenal"], diff:"moyen" },
  { name:"Marc Overmars", clubs:["Ajax Amsterdam", "Arsenal", "Barcelona"], diff:"moyen" },
  { name:"Robert Pires", clubs:["Arsenal", "Marseille", "Villarreal"], diff:"moyen" },
  { name:"Claude Makelele", clubs:["Nantes", "Marseille", "Celta Vigo", "Real Madrid", "Chelsea", "PSG"], diff:"moyen" },
  { name:"Peter Cech", clubs:["Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Didier Deschamps", clubs:["Marseille", "Juventus", "Chelsea", "Monaco"], diff:"moyen" },
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
  { name:"Nwankwo Kanu", clubs:["Ajax Amsterdam", "Inter Milan", "Arsenal", "West Brom"], diff:"moyen" },
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
  { name:"Johan Cruyff", clubs:["Ajax Amsterdam", "Barcelona"], diff:"facile" },
  { name:"Marco van Basten", clubs:["Ajax Amsterdam", "AC Milan"], diff:"facile" },
  { name:"Ruud Gullit", clubs:["AC Milan", "Chelsea"], diff:"facile" },
  { name:"Frank Rijkaard", clubs:["Ajax Amsterdam", "AC Milan"], diff:"moyen" },
  { name:"Ronald Koeman", clubs:["Ajax Amsterdam", "Barcelona"], diff:"moyen" },
  { name:"Romario", clubs:["Barcelona", "PSV Eindhoven"], diff:"facile" },
  { name:"Bebeto", clubs:["Deportivo", "Sevilla"], diff:"moyen" },
  { name:"Denilson", clubs:["Real Betis", "Bordeaux"], diff:"moyen" },
  { name:"Rui Patricio", clubs:["Sporting CP", "Wolverhampton", "Roma"], diff:"moyen" },
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
  { name:"Vikash Dhorasoo", clubs:["Lyon", "AC Milan", "PSG"], diff:"expert" },
  { name:"Lassana Diarra", clubs:["Chelsea", "Arsenal", "Portsmouth", "Real Madrid", "Atletico Madrid", "Marseille", "PSG"], diff:"moyen" },

  // Pays-Bas
  { name:"Robin van Persie", clubs:["Feyenoord", "Arsenal", "Manchester United"], diff:"facile" },
  { name:"Dennis Bergkamp", clubs:["Ajax Amsterdam", "Inter Milan", "Arsenal"], diff:"facile" },
  { name:"Edgar Davids", clubs:["Ajax Amsterdam", "Juventus", "Barcelona", "Inter Milan"], diff:"moyen" },
  { name:"Klaas-Jan Huntelaar", clubs:["Ajax Amsterdam", "Real Madrid", "AC Milan"], diff:"moyen" },
  { name:"Ryan Babel", clubs:["Ajax Amsterdam", "Liverpool", "Galatasaray"], diff:"moyen" },
  // Russie
  { name:"Axel Witsel", clubs:["Benfica", "Zenit Saint Petersburg", "Borussia Dortmund", "Atletico Madrid"], diff:"moyen" },
  { name:"Hulk", clubs:["Porto", "Zenit Saint Petersburg"], diff:"moyen" },
  // MLS
  { name:"Sebastian Giovinco", clubs:["Juventus", "Toronto FC"], diff:"moyen" },
  { name:"Javier Hernandez", clubs:["Manchester United", "Real Madrid", "LA Galaxy"], diff:"moyen" },
  { name:"Carlos Vela", clubs:["Arsenal", "Real Sociedad", "LAFC"], diff:"expert" },
  { name:"Xherdan Shaqiri", clubs:["Bayern Munich", "Inter Milan", "Liverpool", "Chicago Fire"], diff:"moyen" },
  // Turquie supplémentaires
  { name:"Didier Drogba", clubs:["Le Mans", "Guingamp", "Marseille", "Chelsea", "Galatasaray"], diff:"facile" },
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
  { name:"Bogdan Lobont", clubs:["Ajax Amsterdam", "Roma"], diff:"expert" },
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
  { name:"Cody Gakpo", clubs:["PSV Eindhoven", "Liverpool"], diff:"facile" },
  { name:"Ryan Gravenberch", clubs:["Ajax Amsterdam", "Bayern Munich", "Liverpool"], diff:"facile" },
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
  { name:"Jan Vertonghen", clubs:["Ajax Amsterdam", "Tottenham", "Benfica"], diff:"moyen" },
  { name:"Toby Alderweireld", clubs:["Ajax Amsterdam", "Atletico Madrid", "Tottenham"], diff:"moyen" },
  { name:"Mousa Dembele", clubs:["Tottenham", "Fulham"], diff:"moyen" },
  { name:"Victor Wanyama", clubs:["Celtic", "Southampton", "Tottenham"], diff:"moyen" },
  { name:"Dele Alli", clubs:["Tottenham", "Everton"], diff:"moyen" },
  { name:"Eric Dier", clubs:["Sporting CP", "Tottenham", "Bayern Munich"], diff:"moyen" },
  { name:"Moussa Sissoko", clubs:["Newcastle", "Tottenham"], diff:"moyen" },
  { name:"Rafael van der Vaart", clubs:["Ajax Amsterdam", "Real Madrid", "Tottenham"], diff:"moyen" },
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
  { name:"Robert Huth", clubs:["Chelsea", "Stoke", "Leicester City"], diff:"moyen" },
  { name:"Paulo Ferreira", clubs:["Porto", "Chelsea"], diff:"moyen" },
  { name:"Steve Sidwell", clubs:["Chelsea", "Aston Villa", "Fulham"], diff:"moyen" },
  { name:"Freddy Adu", clubs:["DC United", "Real Sociedad", "Benfica"], diff:"expert" },
  { name:"Jaroslaw Bieniuk", clubs:["Legia Warsaw"], diff:"expert" },
  { name:"Eidur Gudjohnsen", clubs:["Chelsea", "Barcelona", "Monaco"], diff:"expert" },
  { name:"Celestine Babayaro", clubs:["Ajax Amsterdam", "Newcastle"], diff:"expert" },
  { name:"Nii Lamptey", clubs:["PSV Eindhoven", "Aston Villa"], diff:"expert" },
  { name:"Paul Furlong", clubs:["Chelsea", "Birmingham City"], diff:"expert" },
  { name:"Scott Parker", clubs:["Charlton Athletic", "Chelsea", "Newcastle", "West Ham", "Tottenham", "Fulham"], diff:"expert" },
  { name:"Glen Johnson", clubs:["Chelsea", "Liverpool"], diff:"expert" },
  { name:"Carlton Cole", clubs:["Chelsea", "West Ham"], diff:"expert" },
  { name:"Mikael Forssell", clubs:["Chelsea", "Birmingham City"], diff:"expert" },
  { name:"Jimmy Floyd Hasselbaink", clubs:["Atletico Madrid", "Chelsea"], diff:"expert" },
  { name:"Slavisa Jokanovic", clubs:["Chelsea", "Deportivo"], diff:"expert" },
  { name:"Winston Bogarde", clubs:["Ajax Amsterdam", "AC Milan", "Chelsea"], diff:"expert" },
  { name:"Mario Melchiot", clubs:["Ajax Amsterdam", "Chelsea"], diff:"expert" },
  { name:"Enrique De Lucas", clubs:["Chelsea", "Espanyol"], diff:"expert" },
  { name:"Jody Morris", clubs:["Chelsea"], diff:"expert" },
  { name:"Samassi Abou", clubs:["West Ham", "Chelsea"], diff:"expert" },
  { name:"Muzzy Izzet", clubs:["Chelsea", "Leicester City"], diff:"expert" },
  { name:"Neil Clement", clubs:["Chelsea", "West Brom"], diff:"expert" },
  { name:"Thor Gudjonsson", clubs:["Leicester City", "Bayer Leverkusen"], diff:"expert" },
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
  "Ajax Amsterdam":["ajax amsterdam"],
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
  "Ajax Amsterdam":["#D2122E","#FFFFFF"],"PSV Eindhoven":["#E1002A","#FFFFFF"],"Feyenoord":["#C8102E","#FFFFFF"],"AZ Alkmaar":["#E31B23","#FFFFFF"],
  "Al Nassr":["#F5C518","#0B4EA2"],"Al Hilal":["#0046AD","#FFFFFF"],"Al Ittihad":["#F5C518","#000000"],"Al Ahli":["#007A3D","#FFFFFF"],
  "LA Galaxy":["#00245D","#FFD700"],"DC United":["#000000","#EF3E42"],"Toronto FC":["#B81137","#FFFFFF"],"Inter Miami":["#F7B5CD","#000000"],"New York City FC":["#6CACE4","#003087"],"New York Red Bulls":["#ED1E36","#003087"],"Seattle Sounders":["#5D9732","#003DA5"],"Atlanta United":["#80000A","#9DC2B6"],"LAFC":["#000000","#C39E6D"],"Toronto FC":["#B81137","#FFFFFF"],"Portland Timbers":["#004812","#EBE72B"],"Chicago Fire":["#73000A","#6CACE4"],
  "Spartak Moscow":["#CE1126","#FFFFFF"],"CSKA Moscow":["#C8102E","#003F87"],"Zenit Saint Petersburg":["#003F87","#FFFFFF"],"Lokomotiv Moscow":["#007A3D","#E31B23"],
  "Fenerbahce":["#003F7F","#FFFF00"],"Besiktas":["#000000","#FFFFFF"],"Trabzonspor":["#A41E34","#004B8D"],
  "Celtic":["#138a3e","#FFFFFF"],
  "Galatasaray":["#FFA500","#D40000"],"Lens":["#EE1C25","#F5C842"],
  "RC Strasbourg":["#003B8E","#FFFFFF"],"Sparta Rotterdam":["#CC0000","#FFFFFF"],
  "Deportivo Alavés":["#003DA5","#FFFFFF"],"CD Mirandés":["#FF0000","#000000"],
};

// ── BUILD DATABASES ──
const PONT_CLUBS = new Set([
  "Manchester City","Arsenal","Liverpool","Chelsea","Manchester United",
  "Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia",
  "Juventus","AC Milan","Inter Milan","Napoli","Roma",
  "Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen","Eintracht Frankfurt",
  "PSG","Marseille","Lyon","Monaco","Lille",
  "Benfica","Porto","Sporting CP",
  // MLS
  "LA Galaxy","Inter Miami","New York City FC","New York Red Bulls","Seattle Sounders",
  "Atlanta United","LAFC","Toronto FC","Portland Timbers","Chicago Fire","DC United",
  // Arabie Saoudite
  "Al Nassr","Al Hilal","Al Ittihad","Al Ahli",
  // Pays-Bas
  "Ajax Amsterdam","PSV Eindhoven","Feyenoord","AZ Alkmaar",
  // Turquie
  "Galatasaray","Fenerbahce","Besiktas","Trabzonspor",
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

// ── DAILY CHALLENGE ──
function getDailyPlayer() {
  const today = new Date().toISOString().slice(0,10);
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);
  const pool = PLAYERS_CLEAN.filter(function(p){ return p.clubs && p.clubs.length >= 2; });
  if (pool.length === 0) return null;
  return pool[hash % pool.length];
}

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

function ClubLogo({ club, size = 48 }) {
  const [ca, cb] = getClubColors(club);
  const initials = club.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
  const fontSize = size < 36 ? size * 0.32 : size * 0.28;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${ca} 0%, ${ca}cc 100%)`,
      border: `${Math.max(1.5, size * 0.04)}px solid ${cb}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 2px 8px rgba(0,0,0,.4), inset 0 1px 0 ${cb}33`,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize, fontWeight: 900, color: cb,
        fontFamily: "Arial Black, Arial, sans-serif",
        letterSpacing: initials.length > 2 ? -1 : 0,
        textShadow: `0 1px 2px rgba(0,0,0,.5)`,
        lineHeight: 1,
      }}>{initials}</span>
    </div>
  );
}

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
    @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
    @keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
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
  const [hallOfFame, setHallOfFame] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [myLbRank, setMyLbRank] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [myLastPts, setMyLastPts] = useState(null);
  const [winStreak, setWinStreak] = useState(0);
  const [wasAway, setWasAway] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [lbMode, setLbMode] = useState("global");
  const [dailyPlayer] = useState(() => getDailyPlayer());
  const [dailyDone, setDailyDone] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_result")||"{}");
      return d.date === new Date().toISOString().slice(0,10);
    } catch { return false; }
  });
  const [dailyAbandoned, setDailyAbandoned] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_result")||"{}");
      return d.date === new Date().toISOString().slice(0,10) && d.abandoned === true;
    } catch { return false; }
  });
  const [dailyTries, setDailyTries] = useState(0);
  const [dailyGuess, setDailyGuess] = useState("");
  const [dailyFlash, setDailyFlash] = useState(null);
  const [showDailyGame, setShowDailyGame] = useState(false);
  const [dayStreak, setDayStreak] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
      const today = new Date().toISOString().slice(0,10);
      const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
      if (s.lastDate === today || s.lastDate === yesterday) return s.count || 0;
      return 0;
    } catch { return 0; }
  });
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
  const [abandonNotif, setAbandonNotif] = useState("");
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
    loadSeasons();
    checkAndCloseSeason();
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

  async function abandonRoom() {
    const duel = activeDuelRef.current;
    if (!duel || !duel.isRoom) return;
    const roomId = duel.id;
    try {
      const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
      if (!Array.isArray(data) || data.length === 0) return;
      const r = data[0];
      const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
      const updated = players.map(function(p) {
        return p.id === playerId ? Object.assign({}, p, {score:0, status:"done", abandoned:true}) : p;
      });
      const allDone = updated.every(function(p){return p.status==="done";});
      await sbFetch("bb_rooms?id=eq."+roomId, {
        method:"PATCH",
        body:JSON.stringify({players:JSON.stringify(updated), status:allDone?"complete":"scoring"}),
        headers:{"Prefer":"return=minimal"}
      });
    } catch(e) { console.error("Abandon room error:", e); }
    activeDuelRef.current = null;
    setActiveDuel(null);
    clearInterval(roomPollRef.current);
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
        const won = myScore > theirScore;
        // Calculer le streak depuis Supabase
        try {
          const history = await sbFetch("bb_duels?status=eq.complete&or=(challenger_id.eq."+playerId+",opponent_id.eq."+playerId+")&order=created_at.asc&select=challenger_id,challenger_score,opponent_score");
          if (Array.isArray(history)) {
            let streak = 0;
            const results = history.map(function(d){
              const ms = d.challenger_id===playerId ? d.challenger_score : d.opponent_score;
              const ts = d.challenger_id===playerId ? d.opponent_score : d.challenger_score;
              return ms > ts ? "W" : "L";
            });
            // Ajouter le résultat courant
            results.push(won ? "W" : "L");
            for (let i = results.length-1; i >= 0; i--) {
              if (results[i]==="W") streak++;
              else break;
            }
            setWinStreak(streak);
          }
        } catch(e){}
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
    // Polling en cours de partie pour détecter les abandons
    roomPollRef.current = setInterval(async function() {
      const duel = activeDuelRef.current;
      if (!duel || !duel.isRoom) { clearInterval(roomPollRef.current); return; }
      try {
        const data = await sbFetch("bb_rooms?id=eq."+r.id+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const room = data[0];
        const players = typeof room.players === "string" ? JSON.parse(room.players) : room.players;
        const abandoned = players.filter(function(p){ return p.abandoned && p.id !== playerId; });
        if (abandoned.length > 0) {
          const names = abandoned.map(function(p){return p.name||"Un joueur";}).join(", ");
          setAbandonNotif(names + (abandoned.length > 1 ? " ont abandonné 🏃" : " a abandonné 🏃"));
          setTimeout(function(){setAbandonNotif("");}, 5000);
        }
      } catch(e) {}
    }, 3000);
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
        startRoomResultPolling(roomId, duel.rounds||1);
      }
    } catch(e) { console.error(e); setWaitingForRoom(false); }
  }

  function startRoomResultPolling(roomId, rounds) {
    clearInterval(roomPollRef.current);
    const maxWait = ((rounds||1) * ROUND_DURATION + 120) * 1000; // timeout = durée théorique + 2 min
    const startedAt = Date.now();
    roomPollRef.current = setInterval(async function() {
      try {
        const data = await sbFetch("bb_rooms?id=eq."+roomId+"&limit=1");
        if (!Array.isArray(data) || data.length === 0) return;
        const r = data[0];
        const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
        const abandoned = players.filter(function(p){return p.abandoned && p.id !== playerId;});
        if (abandoned.length > 0) {
          const names = abandoned.map(function(p){return p.name||"Un joueur";}).join(", ");
          setAbandonNotif(names + (abandoned.length > 1 ? " ont abandonné 🏃" : " a abandonné 🏃"));
          setTimeout(function(){setAbandonNotif("");}, 5000);
        }
        const allDone = players.every(function(p){return p.status==="done";});
        const timedOut = Date.now() - startedAt > maxWait;
        if (allDone || timedOut) {
          clearInterval(roomPollRef.current);
          // Marquer les joueurs non-finis comme done avec score 0
          if (timedOut && !allDone) {
            const fixed = players.map(function(p){
              return p.status !== "done" ? Object.assign({}, p, {score:p.score||0, status:"done", abandoned:true}) : p;
            });
            await sbFetch("bb_rooms?id=eq."+roomId, {
              method:"PATCH",
              body:JSON.stringify({players:JSON.stringify(fixed), status:"complete"}),
              headers:{"Prefer":"return=minimal"}
            });
            showRoomResults(Object.assign({}, r, {players: JSON.stringify(fixed)}));
          } else {
            await sbFetch("bb_rooms?id=eq."+roomId, {
              method:"PATCH",
              body:JSON.stringify({status:"complete"}),
              headers:{"Prefer":"return=minimal"}
            });
            showRoomResults(r);
          }
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
    // Sauvegarder V/N/D en local pour le classement
    const me = players.find(function(p){return p.id===playerId;});
    if(me){
      const myScore = me.score||0;
      const myRank = sorted.findIndex(function(p){return p.id===playerId;});
      const isWin = myRank === 0;
      const isDraw = sorted.filter(function(p){return (p.score||0)===myScore;}).length > 1 && myRank === 0;
      const mode = r.mode || "pont";
      const d = r.diff || diff;
      const key = `bb_lb_${mode}_${d}`;
      try {
        const data = localStorage.getItem(key);
        const list = data ? JSON.parse(data) : [];
        const displayName = (playerName||"").trim()||"Anonyme";
        const existingIdx = list.findIndex(e => e.name === displayName);
        const wdlPts = isWin ? 3 : isDraw ? 1 : 0;
        if(existingIdx >= 0){
          list[existingIdx].wins = (list[existingIdx].wins||0) + (isWin?1:0);
          list[existingIdx].draws = (list[existingIdx].draws||0) + (isDraw?1:0);
          list[existingIdx].losses = (list[existingIdx].losses||0) + (!isWin&&!isDraw?1:0);
          list[existingIdx].pts = (list[existingIdx].pts||0) + wdlPts;
          list[existingIdx].played = (list[existingIdx].played||0) + 1;
        }
        localStorage.setItem(key, JSON.stringify(list));
      } catch(e){}
    }
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


  async function loadSeasons() {
    try {
      const data = await sbFetch("bb_seasons?order=season_number.desc&limit=20");
      if (Array.isArray(data)) setSeasons(data);
    } catch(e) {}
  }

  async function checkAndCloseSeason() {
    const { seasonNumber, seasonStartDate, seasonEndDate } = getCurrentSeason();
    const now = new Date();
    // Vérifier si la saison précédente a déjà été clôturée
    try {
      const prev = await sbFetch("bb_seasons?season_number=eq."+(seasonNumber-1)+"&limit=1");
      if (Array.isArray(prev) && prev.length > 0) return; // déjà clôturée
      if (seasonNumber <= 1) return; // pas encore de saison à clôturer
      // Récupérer le champion de la saison précédente
      const prevStart = new Date(SEASON_START.getTime() + (seasonNumber - 2) * SEASON_DURATION_DAYS * 86400000);
      const prevEnd = seasonStartDate;
      const scores = await sbFetch("bb_scores?order=score.desc&limit=1000&select=player_id,player_name,score,mode&created_at=gte."+prevStart.toISOString()+"&created_at=lt."+prevEnd.toISOString());
      if (!Array.isArray(scores) || scores.length === 0) return;
      // Calculer le meilleur score par joueur
      const stats = {};
      scores.forEach(function(r) {
        if (!stats[r.player_id]) stats[r.player_id] = { name: r.player_name, bestPont: 0, bestChaine: 0 };
        if (r.mode === "pont" && r.score > stats[r.player_id].bestPont) stats[r.player_id].bestPont = r.score;
        if (r.mode === "chaine" && r.score > stats[r.player_id].bestChaine) stats[r.player_id].bestChaine = r.score;
      });
      const ranked = Object.entries(stats).map(function([pid, s]) {
        return { pid, name: s.name, score: s.bestPont + s.bestChaine };
      }).sort(function(a, b) { return b.score - a.score; });
      if (ranked.length === 0) return;
      const champion = ranked[0];
      await sbFetch("bb_seasons", {
        method: "POST",
        body: JSON.stringify({ season_number: seasonNumber - 1, champion_name: champion.name, champion_score: champion.score, champion_id: champion.pid })
      });
      loadSeasons();
    } catch(e) {}
  }

  async function loadLeaderboard(mode) {
    try {
      const isAmis = mode === "amis";
      const isGlobal = mode === "global" || isAmis;
      const season = getCurrentSeason();

      // Couronner le champion de la saison précédente si pas encore fait
      if (season.num > 1) {
        try {
          const prevSeason = season.num - 1;
          const existing = await sbFetch("bb_seasons?season_number=eq."+prevSeason+"&limit=1");
          if (Array.isArray(existing) && existing.length === 0) {
            const prevStart = new Date(SEASON_START.getTime() + (prevSeason-1) * SEASON_DURATION_DAYS * 24*60*60*1000);
            const prevEnd = new Date(prevStart.getTime() + SEASON_DURATION_DAYS * 24*60*60*1000);
            const prevScores = await sbFetch("bb_scores?order=score.desc&limit=1000&select=player_id,player_name,score&created_at=gte."+prevStart.toISOString()+"&created_at=lt."+prevEnd.toISOString());
            if (Array.isArray(prevScores) && prevScores.length > 0) {
              const best = {};
              prevScores.forEach(function(r){ if(!best[r.player_id]||r.score>best[r.player_id].score) best[r.player_id]=r; });
              const champ = Object.values(best).sort(function(a,b){return b.score-a.score;})[0];
              if (champ) await sbFetch("bb_seasons", {method:"POST", body:JSON.stringify({season_number:prevSeason, champion_name:champ.player_name, champion_score:champ.score, champion_id:champ.player_id})});
            }
          }
        } catch(e){}
      }

      // Filtre par saison sauf pour l'onglet Amis
      // Saison 1 = pas de filtre date (tous les scores historiques) — filtre actif dès saison 2
      const seasonFilter = (!isAmis && season.num > 1) ? "&created_at=gte."+season.start.toISOString()+"&created_at=lt."+season.end.toISOString() : "";
      const modeFilter = (!mode || isGlobal) ? "" : "mode=eq."+mode+"&";
      const data = await sbFetch("bb_scores?"+modeFilter+"order=score.desc&limit=1000&select=player_id,player_name,score,mode"+seasonFilter);
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
      // Inclure aussi les parties en salle
      const rooms = await sbFetch("bb_rooms?status=eq.complete&select=players,mode&limit=500");
      if (Array.isArray(rooms)) {
        rooms.forEach(function(r) {
          try {
            const players = typeof r.players === "string" ? JSON.parse(r.players) : r.players;
            if (!Array.isArray(players) || players.length < 2) return;
            const sorted = [...players].sort(function(a,b){return (b.score||0)-(a.score||0);});
            const topScore = sorted[0].score || 0;
            players.forEach(function(p) {
              const pid = p.id;
              if (!pid || !stats[pid]) return;
              if (!stats[pid].wins) stats[pid].wins = 0;
              if (!stats[pid].draws) stats[pid].draws = 0;
              if (!stats[pid].losses) stats[pid].losses = 0;
              const myScore = p.score || 0;
              const winners = players.filter(function(x){return (x.score||0)===topScore;});
              if (myScore === topScore && winners.length === 1) stats[pid].wins++;
              else if (myScore === topScore && winners.length > 1) stats[pid].draws++;
              else stats[pid].losses++;
            });
          } catch(e){}
        });
      }
      // Calculer les streaks depuis les duels triés par date
      const duelsDated = await sbFetch("bb_duels?status=eq.complete&select=challenger_id,opponent_id,challenger_score,opponent_score,created_at&order=created_at.asc&limit=1000");
      if (Array.isArray(duelsDated)) {
        // Grouper les résultats par joueur dans l'ordre chronologique
        const playerResults = {};
        duelsDated.forEach(function(d) {
          [d.challenger_id, d.opponent_id].forEach(function(pid) {
            if (!pid) return;
            if (!playerResults[pid]) playerResults[pid] = [];
            const myScore = pid === d.challenger_id ? d.challenger_score : d.opponent_score;
            const theirScore = pid === d.challenger_id ? d.opponent_score : d.challenger_score;
            const result = myScore > theirScore ? "W" : myScore === theirScore ? "D" : "L";
            playerResults[pid].push(result);
          });
        });
        // Calculer le streak actuel (compter depuis la fin)
        Object.keys(playerResults).forEach(function(pid) {
          if (!stats[pid]) return;
          const results = playerResults[pid];
          let streak = 0;
          for (let i = results.length - 1; i >= 0; i--) {
            if (results[i] === "W") streak++;
            else break;
          }
          stats[pid].streak = streak;
        });
      }
      const sorted = Object.values(stats)
        .map(function(r){ return {name:r.name, pid:r.pid||"", score:isGlobal?(r.bestPont+r.bestChaine):r.best, bestPont:r.bestPont, bestChaine:r.bestChaine, played:r.played, wins:r.wins||0, draws:r.draws||0, losses:r.losses||0, streak:r.streak||0}; })
        .sort(function(a,b){ return b.score - a.score; })
        .slice(0,50)
        .map(function(r,i){ return {...r, rank:i+1}; });
      setLeaderboard(sorted);
      // Charger le Hall of Fame
      try {
        const hof = await sbFetch("bb_seasons?order=season_number.desc&limit=10");
        if (Array.isArray(hof)) setHallOfFame(hof);
      } catch(e){}
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
    if (!pseudoConfirmed || !playerName.trim()) return; // pas de pseudo = pas de classement
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
        updateDayStreak();
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
    updateDayStreak();
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
    roundStartTime.current = null;
    setIsNewRecord(false); setMyLastPts(null); setCombo(0); setMaxCombo(0); comboRef.current=0; lastAnswerTime.current=Date.now();
    // Filtrer par difficulté — en facile on commence par des stars connues
    const eligible = PLAYERS_CLEAN.filter(p => {
      if (p.clubs.length < 2) return false;
      if (diff === "facile") return p.diff === "facile";
      if (diff === "moyen") return p.diff === "facile" || p.diff === "moyen";
      return true; // expert = tous
    });
    const pool = eligible.length > 0 ? eligible : PLAYERS_CLEAN.filter(p => p.clubs.length >= 2);
    const start = pool[Math.floor(Math.random() * pool.length)];
    const usedP = new Set([start.name]);
    
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

  function updateDayStreak() {
    try {
      const today = new Date().toISOString().slice(0,10);
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
      if (s.lastDate === today) return; // déjà compté aujourd'hui
      const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
      const newCount = s.lastDate === yesterday ? (s.count||0) + 1 : 1;
      const updated = { count: newCount, lastDate: today };
      localStorage.setItem("bb_day_streak", JSON.stringify(updated));
      setDayStreak(newCount);
    } catch(e){}
  }

  function handleDailySubmit() {
    if (!dailyGuess.trim() || !dailyPlayer) return;
    const guess = dailyGuess.trim().toLowerCase();
    const answer = dailyPlayer.name.toLowerCase();
    const newTries = dailyTries + 1;
    setDailyTries(newTries);
    const answerParts = answer.split(" ");
    const isCorrect = guess === answer
      || answerParts.some(function(p){ return p.length > 3 && guess === p; })
      || (answer.includes(guess) && guess.length > 4);
    if (isCorrect) {
      setDailyFlash("ok");
      const today = new Date().toISOString().slice(0,10);
      try {
        localStorage.setItem("bb_daily_result", JSON.stringify({date:today, abandoned:false, tries:newTries}));
        localStorage.setItem("bb_daily_tries", String(newTries));
      } catch{}
      setTimeout(function(){
        setShowDailyGame(false);
        setDailyDone(true);
        setDailyAbandoned(false);
        updateDayStreak();
      }, 2000);
    } else {
      setDailyFlash("ko");
      setTimeout(function(){ setDailyFlash(null); setDailyGuess(""); }, 800);
    }
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
      // Favoriser les joueurs de la bonne difficulté
      const preferred = clubPlayers.filter(p => {
        const pd = PLAYERS_CLEAN.find(x=>x.name===p)?.diff;
        if(diff==="facile") return pd==="facile";
        if(diff==="moyen") return pd==="facile"||pd==="moyen";
        return true;
      });
      const nextPool = preferred.length > 0 ? preferred : clubPlayers;
      const next=nextPool[Math.floor(Math.random()*nextPool.length)];
      const newUsedP=new Set(chainUsedPlayers); newUsedP.add(next);
      // Prefetch logos for next player
      
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
    const preferred2 = clubPlayers.filter(p => {
      const pd = PLAYERS_CLEAN.find(x=>x.name===p)?.diff;
      if(diff==="facile") return pd==="facile";
      if(diff==="moyen") return pd==="facile"||pd==="moyen";
      return true;
    });
    const next=preferred2.length>0 ? preferred2[Math.floor(Math.random()*preferred2.length)] : clubPlayers[Math.floor(Math.random()*clubPlayers.length)];
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
      const isUnbeaten = friendDuels.length >= 1 && losses === 0;
      const theyDominate = friendDuels.length >= 1 && wins === 0;
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
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontFamily:G.heading,fontSize:22,color:G.white,letterSpacing:2}}>{selectedFriend.name}</div>
              {isUnbeaten && <div style={{fontSize:11,fontWeight:800,color:"#FFD700",background:"rgba(255,215,0,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>😤 T'es invaincu contre lui</div>}
              {theyDominate && <div style={{fontSize:11,fontWeight:800,color:"#FF3D57",background:"rgba(255,61,87,.15)",borderRadius:20,padding:"3px 10px",letterSpacing:.5}}>💀 Il t'a jamais perdu contre toi</div>}
            </div>
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
            {(()=>{ const s=getCurrentSeason(); return lbMode==="amis"
              ? <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Classement entre amis · Cumulatif</div>
              : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:13,fontWeight:800,color:G.gold}}>⚽ Saison {s.num}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>⏳ J-{s.days} {s.hours}h avant reset</div>
                </div>;
            })()}
          </div>
          <div style={{width:40}}/>{/* spacer pour centrer le titre */}
        </div>
        <div style={{...sheet,borderRadius:"28px 28px 0 0"}}>
          {/* Saison info */}
          {lbMode!=="amis" && (()=>{
            const {seasonNumber, seasonEndDate} = getCurrentSeason();
            const msLeft = seasonEndDate - new Date();
            const daysLeft = Math.floor(msLeft / 86400000);
            const hoursLeft = Math.floor((msLeft % 86400000) / 3600000);
            return (
              <div style={{marginBottom:8,padding:"10px 14px",background:"rgba(255,214,0,.08)",borderRadius:14,border:"1px solid rgba(255,214,0,.2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,fontWeight:800,color:G.gold,letterSpacing:1}}>🏆 SAISON {seasonNumber}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>
                    {daysLeft > 0 ? `J-${daysLeft} (${hoursLeft}h)` : `Finit dans ${hoursLeft}h`}
                  </div>
                </div>
                <button onClick={function(){setShowHallOfFame(true);}} style={{padding:"6px 12px",background:"rgba(255,214,0,.15)",color:G.gold,border:"1px solid rgba(255,214,0,.3)",borderRadius:20,cursor:"pointer",fontFamily:G.font,fontSize:11,fontWeight:800}}>
                  🏅 Hall of Fame
                </button>
              </div>
            );
          })()}
          {/* Hall of Fame Modal */}
          {showHallOfFame && (
            <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end"}}
              onClick={function(e){if(e.target===e.currentTarget)setShowHallOfFame(false);}}>
              <div style={{width:"100%",background:"rgba(10,20,10,.97)",borderRadius:"28px 28px 0 0",padding:"20px 20px 48px",border:"1px solid rgba(255,255,255,.1)",borderBottom:"none",maxHeight:"80vh",overflowY:"auto"}}>
                <div style={{fontFamily:G.heading,fontSize:28,color:G.gold,letterSpacing:2,marginBottom:4,textAlign:"center"}}>🏅 HALL OF FAME</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.4)",textAlign:"center",marginBottom:16}}>Champions des saisons passées</div>
                {seasons.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0",fontSize:14}}>Pas encore de champion — la première saison est en cours !</div>}
                {seasons.map(function(s, i){
                  const grade = getGrade(s.champion_score||0);
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",background:"rgba(255,214,0,.06)",borderRadius:14,border:"1px solid rgba(255,214,0,.15)",marginBottom:8}}>
                      <div style={{fontSize:32}}>🏆</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,color:"rgba(255,255,255,.4)",letterSpacing:1}}>SAISON {s.season_number}</div>
                        <div style={{fontSize:16,fontWeight:800,color:G.gold}}>{s.champion_name}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2}}>{grade.emoji} {grade.label}</div>
                      </div>
                      <div style={{fontFamily:G.heading,fontSize:28,color:G.gold}}>{s.champion_score} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                    </div>
                  );
                })}
                <button onClick={function(){setShowHallOfFame(false);}} style={{width:"100%",padding:"14px",background:"rgba(255,255,255,.07)",color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700,marginTop:8}}>Fermer</button>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
            {["global","pont","chaine","amis"].map(function(m){return(
              <button key={m} onClick={function(){
                setLbMode(m);
                if(m!=="amis") loadLeaderboard(m);
                else loadLeaderboard("global");
              }} style={{flex:1,minWidth:60,padding:"10px 6px",borderRadius:12,border:"1.5px solid "+(lbMode===m?G.accent:"rgba(255,255,255,.12)"),background:lbMode===m?"rgba(0,230,118,.1)":"transparent",color:lbMode===m?G.accent:G.white,fontFamily:G.font,fontWeight:700,cursor:"pointer",fontSize:12}}>
                {m==="global"?"🌍 Global":m==="pont"?"🏟 Plug":m==="chaine"?"⛓ Mercato":"👥 Amis"}
              </button>
            );})}
          </div>
          {leaderboard.length === 0 && (
            <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,.3)",fontSize:14}}>Aucun score pour le moment</div>
          )}
          {(lbMode==="amis"
            ? leaderboard.filter(function(e){ return e.pid===playerId || friendsList.includes(e.pid); })
            : leaderboard
          ).map(function(entry, i){
            const isMe = entry.pid === playerId;
            const medals = ["🥇","🥈","🥉"];
            const grade = getGrade(entry.score);
            return(
              <div key={i} style={{borderRadius:14,background:isMe?"rgba(0,230,118,.08)":"rgba(255,255,255,.03)",border:isMe?"1px solid rgba(0,230,118,.25)":"1px solid rgba(255,255,255,.05)",marginBottom:6,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}}>
                  <div style={{fontFamily:G.heading,fontSize:22,width:32,textAlign:"center",color:i<3?["#FFD600","#C0C0C0","#CD7F32"][i]:"rgba(255,255,255,.3)"}}>
                    {i<3?medals[i]:(i+1)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:800,color:isMe?G.accent:G.white}}>{entry.name}{isMe?" (toi)":""}</span>
                      <span style={{fontSize:10,fontWeight:800,color:grade.color,background:grade.color+"22",borderRadius:20,padding:"2px 7px",letterSpacing:.5}}>{grade.emoji} {grade.label}</span>
                      {entry.streak>=3 && <span style={{fontSize:10,fontWeight:800,color:"#FF6B35",background:"rgba(255,107,53,.15)",borderRadius:20,padding:"2px 7px"}}>🔥 {entry.streak}</span>}
                    </div>
                    {lbMode==="global"
                      ? <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>🏟 {entry.bestPont} pts &nbsp;·&nbsp; ⛓ {entry.bestChaine} pts</div>
                      : <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{entry.played} partie{entry.played>1?"s":""}</div>
                    }
                  </div>
                  <div style={{fontFamily:G.heading,fontSize:26,color:i===0?G.gold:G.white}}>{entry.score} <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                </div>
                <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,.06)"}}>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:"#00E676"}}>{entry.wins||0}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Victoires</div>
                    </div>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:G.gold}}>{entry.draws||0}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Nuls</div>
                    </div>
                    <div style={{flex:1,padding:"6px 0",textAlign:"center"}}>
                      <div style={{fontFamily:G.heading,fontSize:18,color:"#FF3D57"}}>{entry.losses||0}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:1,textTransform:"uppercase"}}>Défaites</div>
                    </div>
                  </div>
              </div>
            );
          })}
          {/* Hall of Fame */}
          {hallOfFame.length > 0 && lbMode !== "amis" && (
            <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:10,textAlign:"center"}}>🏛 Hall of Fame</div>
              {hallOfFame.map(function(s,i){
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,215,0,.05)",borderRadius:12,marginBottom:6,border:"1px solid rgba(255,215,0,.1)"}}>
                    <span style={{fontSize:20}}>👑</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800,color:G.gold}}>{s.champion_name}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>Saison {s.season_number}</div>
                    </div>
                    <div style={{fontFamily:G.heading,fontSize:20,color:G.gold}}>{s.champion_score} <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pts</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <div style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"6px 14px",textAlign:"center",display:"flex",alignItems:"center",gap:8}}>
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>Code</div>
              <div style={{fontFamily:G.heading,fontSize:20,color:G.gold,letterSpacing:4}}>{room.code}</div>
            </div>
            <button onClick={function(){navigator.clipboard.writeText(room.code).then(function(){alert("Code copié !");});}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"6px 10px",color:G.white,cursor:"pointer",fontSize:16,lineHeight:1}}>📋</button>
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
          <div style={{fontSize:56,marginBottom:20}}>⏳</div>
          <div style={{fontFamily:G.heading,fontSize:30,color:G.white,marginBottom:12,letterSpacing:1}}>PARTIE TERMINÉE !</div>
          <div style={{fontSize:16,color:G.accent,fontWeight:800,marginBottom:10}}>Tu as fini ta partie 💪</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.7,marginBottom:8}}>Les autres joueurs sont encore en train de jouer.</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.9)",fontWeight:700,lineHeight:1.7,marginBottom:24,background:"rgba(255,255,255,.07)",borderRadius:14,padding:"12px 16px"}}>👉 Reste sur cet écran — les résultats apparaîtront automatiquement dès que tout le monde aura terminé.</div>
          {abandonNotif && <div style={{fontSize:13,color:"#000",fontWeight:800,marginBottom:16,background:"rgba(255,214,0,.9)",borderRadius:12,padding:"10px 14px"}}>{abandonNotif}</div>}
          <div style={{display:"flex",justifyContent:"center",gap:6}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:8,height:8,borderRadius:"50%",background:G.accent,animation:`pulse 1.2s ease-in-out ${i*.3}s infinite`}}/>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── HOME ──
  if(screen==="home") return (
    <div style={{...shell,animation:"fadeUp .5s ease",overflow:"auto"}} key="home">
      {pseudoModal}
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
          <div style={{flex:1,display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
            {dayStreak >= 2 && (
              <div style={{background:"rgba(255,107,53,.15)",border:"1px solid rgba(255,107,53,.3)",borderRadius:12,padding:"6px 10px",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:14}}>🔥</span>
                <span style={{fontFamily:G.heading,fontSize:16,color:"#FF6B35"}}>{dayStreak}</span>
              </div>
            )}
            <div onClick={function(){setPseudoScreen(true);}} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"7px 12px",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
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
              background:"linear-gradient(160deg,#0d1f3c 0%,#1a3a6b 50%,#0d2040 100%)",
              boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}
          >
            <div style={{padding:"16px 12px",position:"relative",zIndex:1,height:"100%",boxSizing:"border-box",display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.7)",marginBottom:4}}>Mode 1</div>
              <div style={{fontFamily:G.heading,fontSize:"clamp(18px,4.2vw,22px)",color:G.white,letterSpacing:1,lineHeight:1,marginBottom:6}}>THE PLUG</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.9)",lineHeight:1.4,fontWeight:700}}>{"Trouve le joueur\nqui relie les\ndeux clubs"}</div>
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:44,lineHeight:1}}>🏟️</span>
                <span style={{fontSize:30,lineHeight:1}}>❓</span>
                <span style={{fontSize:44,lineHeight:1}}>🏟️</span>
              </div>
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
              background:"linear-gradient(160deg,#0c2218 0%,#1a5c34 50%,#0c2a1a 100%)",
              boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}
          >
            <div style={{padding:"16px 12px",position:"relative",zIndex:1,height:"100%",boxSizing:"border-box",display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:9,letterSpacing:3,textTransform:"uppercase",color:"rgba(255,255,255,.7)",marginBottom:4}}>Mode 2</div>
              <div style={{fontFamily:G.heading,fontSize:"clamp(16px,3.8vw,20px)",color:G.white,letterSpacing:1,lineHeight:1,marginBottom:6}}>THE MERCATO</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.9)",lineHeight:1.4,fontWeight:700}}>{"Enchaîne joueur\n→ club le plus\nlongtemps possible"}</div>
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <span style={{fontSize:38,lineHeight:1}}>⚽</span>
                <span style={{fontSize:24,lineHeight:1}}>⛓️</span>
                <span style={{fontSize:38,lineHeight:1}}>⚽</span>
                <span style={{fontSize:24,lineHeight:1}}>⛓️</span>
                <span style={{fontSize:38,lineHeight:1}}>⚽</span>
              </div>
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

        {/* Défi du jour */}
        {dailyPlayer && (
          <div style={{borderRadius:18,background:dailyDone?"rgba(255,255,255,.04)":"linear-gradient(135deg,rgba(255,214,0,.12),rgba(255,107,53,.12))",border:dailyDone?"1px solid rgba(255,255,255,.1)":"1.5px solid rgba(255,214,0,.3)",padding:"14px 16px",display:"flex",alignItems:"center",gap:12,opacity:dailyDone?.7:1}}>
            <div style={{fontSize:32}}>{dailyDone?(dailyAbandoned?"🔒":"✅"):"⚡"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:dailyDone?"rgba(255,255,255,.3)":"rgba(255,214,0,.7)",marginBottom:2}}>Défi du jour</div>
              <div style={{fontSize:14,fontWeight:800,color:dailyDone?"rgba(255,255,255,.4)":G.white}}>
                {dailyDone ? "Revenez demain 🔒" : "Devine le joueur mystère"}
              </div>
              {dailyDone && <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:2}}>{dailyAbandoned ? "Abandonné — "+dailyPlayer.name : "Trouvé en "+localStorage.getItem("bb_daily_tries")+" essai"+(parseInt(localStorage.getItem("bb_daily_tries")||"1")>1?"s":"")+" !"}</div>}
            </div>
            {!dailyDone && <button onClick={function(){setShowDailyGame(true);setDailyGuess("");setDailyFlash(null);}} style={{padding:"12px 16px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800,whiteSpace:"nowrap"}}>Jouer ⚡</button>}
          </div>
        )}

        {/* Modal défi du jour — Devine le joueur */}
        {showDailyGame && dailyPlayer && (
          <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.75)",backdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end"}}>
            <div style={{width:"100%",background:"rgba(10,20,10,.98)",borderRadius:"28px 28px 0 0",padding:"24px 20px 48px",border:"1px solid rgba(255,255,255,.1)",borderBottom:"none",maxHeight:"90vh",overflow:"auto"}}>
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div>
                  <div style={{fontFamily:G.heading,fontSize:22,color:G.gold,letterSpacing:1}}>⚡ Défi du jour</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Devine le joueur mystère</div>
                </div>
                <button onClick={function(){setShowDailyGame(false);}} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:32,height:32,color:G.white,cursor:"pointer",fontSize:18}}>✕</button>
              </div>
              {/* Clubs du joueur */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,.4)",marginBottom:10}}>Clubs dans sa carrière :</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {dailyPlayer.clubs.map(function(club,i){
                    const [ca,cb] = getClubColors(club);
                    return (
                      <div key={i} style={{borderRadius:20,overflow:"hidden",position:"relative",height:40,minWidth:90,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,.4)"}}>
                        <div style={{position:"absolute",inset:0,background:ca}}/>
                        <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
                        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.15)"}}/>
                        <span style={{position:"relative",zIndex:1,fontSize:13,fontWeight:800,color:"#fff",padding:"0 14px",textShadow:"0 1px 3px rgba(0,0,0,.6)"}}>{club}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Tentatives */}
              {dailyTries > 0 && !dailyFlash && <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:8,textAlign:"center"}}>Tentative{dailyTries>1?"s":""} : {dailyTries}</div>}

              {/* Écran bravo */}
              {dailyFlash==="ok" ? (
                <div style={{textAlign:"center",padding:"24px 0"}}>
                  <div style={{fontSize:56,marginBottom:12}}>🎉</div>
                  <div style={{fontFamily:G.heading,fontSize:36,color:"#00E676",letterSpacing:2,marginBottom:8}}>BRAVO !</div>
                  <div style={{fontSize:16,color:"rgba(255,255,255,.8)",fontWeight:700,marginBottom:6}}>
                    C'était <span style={{color:"#00E676"}}>{dailyPlayer.name}</span>
                  </div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginTop:4}}>
                    {dailyTries === 1 ? "Trouvé du premier coup 🐐" : `Trouvé en ${dailyTries} essai${dailyTries>1?"s":""}`}
                  </div>
                </div>
              ) : (
                <>
                  {/* Input */}
                  <input
                    value={dailyGuess}
                    onChange={function(e){setDailyGuess(e.target.value);setDailyFlash(null);}}
                    onKeyDown={function(e){if(e.key==="Enter") handleDailySubmit();}}
                    placeholder="Nom du joueur..."
                    autoComplete="off"
                    style={{width:"100%",background:dailyFlash==="ko"?"rgba(255,61,87,.15)":"rgba(255,255,255,.08)",border:"2px solid "+(dailyFlash==="ko"?"#FF3D57":"rgba(255,255,255,.2)"),borderRadius:18,padding:"16px 18px",fontFamily:G.font,fontSize:18,fontWeight:700,color:"#ffffff",outline:"none",textAlign:"center",transition:"all .2s",boxSizing:"border-box"}}
                  />
                  {dailyFlash==="ko" && <div style={{textAlign:"center",fontSize:13,color:"#FF3D57",marginTop:8,fontWeight:700}}>Ce n'est pas ça... réessaie !</div>}
                  <div style={{display:"flex",gap:10,marginTop:12}}>
                    <button onClick={function(){
                      setShowDailyGame(false);
                      const today = new Date().toISOString().slice(0,10);
                      try { localStorage.setItem("bb_daily_result", JSON.stringify({date:today,abandoned:true})); } catch{}
                      setDailyDone(true); setDailyAbandoned(true); updateDayStreak();
                    }} style={{flex:1,padding:"14px",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                      Abandonner
                    </button>
                    <button onClick={handleDailySubmit} style={{flex:2,padding:"14px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800}}>
                      Valider ✓
                    </button>
                  </div>
                </>
              )}
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
              <button onClick={async function(){
                setShowQuitConfirm(false);
                clearInterval(timerRef.current);
                clearInterval(qTimerRef.current);
                if(activeDuelRef.current&&activeDuelRef.current.isRoom){ await abandonRoom(); }
                else if(activeDuel){ abandonDuel(); }
                setScreen("home");
              }} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Abandonner</button>
            </div>
          </div>
        </div>
      )}

        {floatingPoints}
        {/* Screen flash */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10,animation:feedback==="ok"?"flashOk .6s ease":feedback==="ko"?"flashKo .6s ease":"none"}}/>

        {/* Notification abandon en salle */}
        {abandonNotif && (
          <div style={{position:"fixed",top:60,left:16,right:16,zIndex:20,
            background:"rgba(255,214,0,.95)",backdropFilter:"blur(8px)",
            borderRadius:14,padding:"10px 16px",textAlign:"center",
            fontSize:13,fontWeight:800,color:"#000",
            boxShadow:"0 4px 20px rgba(255,214,0,.4)",
            animation:"slideDown .4s cubic-bezier(.22,1,.36,1)"}}>
            {abandonNotif}
          </div>
        )}
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
          <div style={{flex:1,margin:"0 14px 0 14px",borderRadius:28,position:"relative",overflow:"hidden",boxShadow:"0 12px 40px "+ca1+"55",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"clubSlideLeft .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            {/* Fond diagonal club 1 */}
            <div style={{position:"absolute",inset:0,background:ca1}}/>
            <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb1,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
            <div style={{position:"absolute",width:220,height:220,borderRadius:"50%",border:"3px solid rgba(255,255,255,.1)",top:-40,right:-40,pointerEvents:"none"}}/>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7.5vw,52px)",color:"#fff",lineHeight:1.05,textAlign:"center",padding:"0 16px",zIndex:1,textShadow:"0 3px 16px rgba(0,0,0,.6)",letterSpacing:1}}>{cur.c1}</div>
          </div>

          {/* VS */}
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:44,zIndex:2,flexShrink:0}}>
            <div style={{fontFamily:G.heading,fontSize:20,color:G.white,letterSpacing:4,background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:30,padding:"5px 18px",border:"1.5px solid rgba(255,255,255,.15)",animation:"vsAppear .5s cubic-bezier(.22,1,.36,1) .3s both"}}>VS</div>
          </div>

          {/* Club 2 */}
          <div style={{flex:1,margin:"0 14px 10px 14px",borderRadius:28,position:"relative",overflow:"hidden",boxShadow:"0 12px 40px "+ca2+"55",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"clubSlideRight .55s cubic-bezier(.22,1,.36,1)",animationFillMode:"both"}}>
            {/* Fond diagonal club 2 */}
            <div style={{position:"absolute",inset:0,background:ca2}}/>
            <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb2,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
            <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:"3px solid rgba(255,255,255,.1)",bottom:-30,left:-30,pointerEvents:"none"}}/>
            <div style={{fontFamily:G.heading,fontSize:"clamp(28px,7.5vw,52px)",color:"#fff",lineHeight:1.05,textAlign:"center",padding:"0 16px",zIndex:1,textShadow:"0 3px 16px rgba(0,0,0,.6)",letterSpacing:1}}>{cur.c2}</div>
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
                        border: isOk?"2px solid #00E676": isKo?"2px solid #FF3D57":"none",
                        background: isOk?"#052e16": isKo?"#2d0a0a": "rgba(255,255,255,.1)",
                        color: isOk?"#00E676": isKo?G.red: G.white,
                        boxShadow: isOk?"0 0 20px rgba(74,222,128,.4)": isKo?"0 0 20px rgba(239,68,68,.3)":"none",
                        animation: isOk?"answerOk .4s ease": isKo?"answerKo .4s ease": "optionIn .4s cubic-bezier(.22,1,.36,1) "+(oi*.07)+"s both",
                      }}>
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",position:"relative",zIndex:1}}>
                        {isOk&&<span style={{fontSize:16}}>✓</span>}
                        {isKo&&<span style={{fontSize:16}}>✗</span>}
                        <span style={{fontSize:"clamp(12px,3vw,16px)",fontWeight:800}}>{opt}</span>
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
              <button onClick={async function(){setShowQuitConfirm(false);clearInterval(timerRef.current);clearInterval(qTimerRef.current);if(activeDuelRef.current&&activeDuelRef.current.isRoom){await abandonRoom();}else if(activeDuel){abandonDuel();}setChainPlayer("");setScreen("home");}} style={{flex:1,padding:"13px",background:"#FF3D57",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>Abandonner</button>
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
        <div style={{zIndex:1,padding:"4px 16px",animation:"clubTagPop .4s cubic-bezier(.22,1,.36,1)"}}>
          <div style={{borderRadius:14,overflow:"hidden",position:"relative",height:36,boxShadow:`0 4px 16px ${cla}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{position:"absolute",inset:0,background:cla}}/>
            <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:clb,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.18)"}}/>
            <span style={{position:"relative",zIndex:1,fontSize:14,color:"#fff",fontWeight:800,textShadow:"0 1px 4px rgba(0,0,0,.5)",letterSpacing:.5}}>{chainLastClub}</span>
          </div>
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
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:G.heading,fontSize:"clamp(18px,5vw,34px)",color:ptc==="#FFF"?"#fff":"#111",lineHeight:1.05,textShadow:ptc==="#FFF"?"0 2px 10px rgba(0,0,0,.25)":"none",letterSpacing:1}}>{chainPlayer}</div>
            {chainUsedClubs.size>0 && <div style={{fontSize:10,color:ptc==="#FFF"?"rgba(255,255,255,.55)":"rgba(0,0,0,.35)",marginTop:3,fontWeight:600}}>{chainAvailableClubs.length} club{chainAvailableClubs.length!==1?"s":""} disponible{chainAvailableClubs.length!==1?"s":""}</div>}
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
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#ccc",textAlign:"center"}}>The Mercato</div>
            {[...chainHistory].reverse().map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:G.offWhite,borderRadius:12,animation:`slideIn .3s ease ${i*.04}s both`,opacity:h.passed ? 0.7 : 1}}>
                <span style={{fontSize:10,color:"#bbb",fontWeight:700,minWidth:18}}>{i+1}.</span>
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
          <div style={{fontFamily:G.heading,fontSize:"clamp(54px,13vw,80px)",color:G.white,lineHeight:1}}>{sc}</div>
          <div style={{fontSize:11,color:"#bbb"}}>pts{isChain?` · ${chainCount} lien${chainCount>1?"s":""}`:`  ·  ${totalRounds} manche${totalRounds>1?"s":""}`}</div>
          {maxCombo>=3&&<div style={{fontSize:13,color:"#f59e0b",marginTop:4,fontWeight:700}}>🔥 Meilleur combo : x{maxCombo}</div>}
          {isNewRecord&&<div style={{fontSize:12,color:G.accent,marginTop:6,fontStyle:"italic"}}>Ancien record battu 🎉</div>}
          {dayStreak>=2&&<div style={{fontSize:12,color:"#FF6B35",marginTop:6,fontWeight:700}}>🔥 {dayStreak} jours de suite !</div>}
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
        {!pseudoConfirmed && (
          <div style={{background:"rgba(255,200,0,.1)",border:"1px solid rgba(255,200,0,.3)",borderRadius:14,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:13,color:"#ffd600",fontWeight:700,marginBottom:6}}>⚠️ Score non enregistré</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:10}}>Crée un pseudo pour apparaître au classement</div>
            <button onClick={()=>setPseudoScreen(true)} style={{padding:"8px 20px",background:"#ffd600",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800}}>Créer mon pseudo</button>
          </div>
        )}
        <button onClick={()=>{if(isChain)startChain();else startCompetition();}} style={{width:"100%",padding:"18px",background:G.dark,color:G.white,border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:17,fontWeight:800,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{Icon.ball(18,G.white)} Rejouer</button>
        <button onClick={function(){
          const grade = getGrade(sc);
          const txt = `${grade.emoji} J'ai scoré ${sc} pts en mode ${isChain?"The Mercato":"The Plug"} sur GOAT FC !\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://bridgeball.vercel.app`;
          if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
          else{navigator.clipboard.writeText(txt).then(function(){alert("Copié ! Colle-le où tu veux 📋");});}
        }} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          📤 Partager mon score
        </button>
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
          <button onClick={function(){
            const myEntry = duelResult.players.find(function(p){return p.id===playerId;});
            const grade = getGrade(myEntry?.score||0);
            const rank = duelResult.players.findIndex(function(p){return p.id===playerId;})+1;
            const txt = rank===1
              ? `${grade.emoji} J'ai remporté la salle sur GOAT FC avec ${myEntry?.score||0} pts 🏆\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://bridgeball.vercel.app`
              : `J'ai terminé ${rank}ème sur GOAT FC avec ${myEntry?.score||0} pts\nGrade : ${grade.label}\nhttps://bridgeball.vercel.app`;
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert("Copié ! 📋");});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8,marginBottom:6}}>
            📤 Partager le résultat
          </button>
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:0}}>
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
          {(()=>{const grade=getGrade(duelResult.myScore||0); return <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,background:grade.color+"22",borderRadius:20,padding:"4px 12px"}}><span style={{fontSize:14}}>{grade.emoji}</span><span style={{fontSize:12,fontWeight:800,color:grade.color,letterSpacing:.5}}>{grade.label}</span></div>; })()}
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:8}}>
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
          {/* Streak banner */}
          {won && winStreak >= 2 && (
            <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"linear-gradient(135deg,rgba(255,107,53,.2),rgba(255,214,0,.2))",borderRadius:14,border:"1px solid rgba(255,107,53,.3)"}}>
              <span style={{fontSize:20}}>🔥</span>
              <span style={{fontFamily:G.heading,fontSize:18,color:"#FF6B35",marginLeft:8,letterSpacing:1}}>
                {winStreak} VICTOIRES D'AFFILÉE
              </span>
              {winStreak >= 5 && <div style={{fontSize:12,color:"rgba(255,107,53,.8)",marginTop:2}}>
                {winStreak >= 10 ? "T'es inarrêtable 🐐" : winStreak >= 7 ? "Personne peut t'arrêter 😤" : "T'es en feu frère 🔥"}
              </div>}
            </div>
          )}
          {/* Badge Invaincu */}
          {won && duelResult.oppName && (()=>{
            const h2h = duels.filter(function(d){return d.status==="complete"&&(d.challenger_id===playerId||d.opponent_id===playerId)&&(d.challenger_name===duelResult.oppName||d.opponent_name===duelResult.oppName);});
            const lost = h2h.some(function(d){const ms=d.challenger_id===playerId?d.challenger_score:d.opponent_score;const ts=d.challenger_id===playerId?d.opponent_score:d.challenger_score;return ms<ts;});
            return !lost && h2h.length >= 2 ? (
              <div style={{textAlign:"center",marginBottom:8,padding:"10px 16px",background:"rgba(255,215,0,.1)",borderRadius:14,border:"1px solid rgba(255,215,0,.3)"}}>
                <span style={{fontFamily:G.heading,fontSize:16,color:"#FFD700",letterSpacing:1}}>😤 INVAINCU CONTRE {duelResult.oppName.toUpperCase()}</span>
              </div>
            ) : null;
          })()}
          {/* Message auto du vainqueur au perdant */}
          {!won && !draw && !abandoned && duelResult.oppName && (
            <div style={{marginBottom:8,padding:"12px 16px",background:"rgba(255,255,255,.05)",borderRadius:14,border:"1px solid rgba(255,255,255,.1)"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>💬 Message de {duelResult.oppName}</div>
              <div style={{fontSize:14,fontWeight:700,color:G.white}}>
                {[
                  "Trop facile 😴 Reviens quand t'es prêt",
                  "T'as vu la différence ? C'est ce qu'on appelle le niveau 🐐",
                  "Même pas besoin de transpirer frère 😂",
                  "Merci pour les points 🙏",
                  "La next fois prépare-toi mieux 💀",
                  "J'ai joué les yeux fermés et t'as quand même perdu 😤",
                  "C'est dur hein ? Normal, t'as en face 😏",
                  "Viens on refait si t'as le courage 👀",
                ][Math.abs(Math.floor(duelResult.theirScore - duelResult.myScore + duelResult.theirScore)) % 8]}
              </div>
            </div>
          )}
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
          {won && !abandoned && (
            <div style={{marginBottom:8,padding:"10px 16px",background:"rgba(0,230,118,.05)",borderRadius:14,border:"1px solid rgba(0,230,118,.1)"}}>
              <div style={{fontSize:10,color:"rgba(0,230,118,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>💬 Message envoyé à {duelResult.oppName}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontStyle:"italic"}}>
                {[
                  "Trop facile 😴 Reviens quand t'es prêt",
                  "T'as vu la différence ? C'est ce qu'on appelle le niveau 🐐",
                  "Même pas besoin de transpirer frère 😂",
                  "Merci pour les points 🙏",
                  "La next fois prépare-toi mieux 💀",
                  "J'ai joué les yeux fermés et t'as quand même perdu 😤",
                  "C'est dur hein ? Normal, t'as en face 😏",
                  "Viens on refait si t'as le courage 👀",
                ][Math.abs(Math.floor(duelResult.myScore * 3 + duelResult.theirScore)) % 8]}
              </div>
            </div>
          )}
          <button onClick={function(){
            const grade = getGrade(duelResult.myScore||0);
            const result = won ? "victoire" : draw ? "nul" : "défaite";
            const txt = won
              ? `${grade.emoji} J'ai écrasé ${duelResult.oppName} ${duelResult.myScore}-${duelResult.theirScore} sur GOAT FC 😤\nGrade : ${grade.label}\nT'as le niveau ? 👇\nhttps://bridgeball.vercel.app`
              : `J'ai perdu ${duelResult.myScore}-${duelResult.theirScore} contre ${duelResult.oppName} sur GOAT FC 😤\nLa revanche arrive...\nhttps://bridgeball.vercel.app`;
            if(navigator.share){navigator.share({title:"GOAT FC",text:txt});}
            else{navigator.clipboard.writeText(txt).then(function(){alert("Copié ! 📋");});}
          }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",color:"#fff",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
            📤 Partager le résultat
          </button>
          <button onClick={function(){setDuelResult(null);setScreen("home");}} style={{width:"100%",padding:"16px",background:G.accent,color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:15,fontWeight:800,marginTop:2}}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }
  if(screen==="final") return makeResultScreen(total,"pont",false);

  return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white}}>Chargement…</div></div>;
}
