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
  { min:300, label:"Légende", emoji:"🦅", color:"#FF6B35" },
  { min:200, label:"Elite",   emoji:"🦁", color:"#00B4D8" },
  { min:150, label:"Expert",  emoji:"🐺", color:"#E63946" },
  { min:100, label:"Pro",     emoji:"🦊", color:"#2EC4B6" },
  { min:50,  label:"Amateur", emoji:"🐢", color:"#A8DADC" },
  { min:0,   label:"Rookie",  emoji:"🐣", color:"#8D99AE" },
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
  { name:"Taiwo Awoniyi", clubs:["Liverpool", "FSV Frankfurt", "NEC Nijmegen", "Royal Excel Mouscron", "Union Berlin", "Nottingham Forest"], diff:"moyen" },
  { name:"Omar Marmoush", clubs:["Stuttgart", "Wolfsburg", "Eintracht Frankfurt", "Manchester City"], diff:"moyen" },
  { name:"Patrick Dorgu", clubs:["Lecce", "Manchester United"], diff:"moyen" },
  { name:"Igor Paixão", clubs:["Coritiba", "Feyenoord", "Marseille"], diff:"moyen" },
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
const SPLASH_IMG = "data:image/webp;base64,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";
const GOAT_LOGO = "data:image/webp;base64,UklGRliSAABXRUJQVlA4IEySAAAQjAGdASqQAZABPj0YikOiIaKVusasKAPEsgC3AbQBGbw+q3iL6//Lfur7O/GfV/6C+6fr7+/e67/x93fX/05e/Vz//0f8B+QPzN/23/M/0vuz/TP+//PH6Av1P/2P+A/Jf4uf+v/kPfH+1//J/aP4G/0z/Af9n/K/v/8w//W/7v/L92f93/0v/C/u/+t+QL+v/5P/qeur7Gv7qf/b3B/6D/gv+T65v7gf875Qv7F/s//t/uf9z///oh/of+I/8n5//+P6AP/D7Wf8A/9/qAdcj+NPvJ8iPx/5Vf3P0x/I/o38H/eP8p/r/7h+3nyu5p+xj/S/YX2H/kn37/Jf3X/G/8T/CfvF9C/9nxJ+Uf+d91PyEfkH81/xH9u/cP+//uH9eX5f7ReJbw3+m/6/+i9gv3a+wf6b+/ful/jvgg+n/6XpJ9lv+T+bv9x+wH+gf1b/Mf4H9zf7v////F+Df83w7fyP/W+oD7Av6B/X/9H/fv9H+wf04f1X/d/y3+h/cH3AfS3/X/zH+r/bz7Df5h/XP9x/hP83/6f8r////t96//g9yP7ff/L3TP2E/8P5/qA/smoRbu01/oiOYKi4I3t5rsLoKcZpUhEXdfH1lIoqop2LB/02Ffv997MU8pzz7esTfHFJk9AwZS0CscLpxpNcQExLA0S/3/yMtlt0pr/ivxqZH2Tp9ouRlW+8bieDEc14PK7ZJrzdjmYzttR4Mg7TrPIYcrW6sMQbOXNQajNZwevcgkjLF1bfbMilwVcJBKHHos0GiEvH4glMzFnwPv9NiFydcwstVM7/0PbI2GiXuvcBf+rK9TlfWf+ePIMm9+sR9NsnjH7Ll4PHMLquUdA4nGI2ZRTE38ZysLUem9O0POAEDgtlBbUvVE9sCMWBmzZxrzr2x+TG1x6ApABOQa3a3+6p1b+Kn+rjXNnAhgv923dcOWrt/aBrDkY33QID0vf7+fLkdvp6jEc+vewfInEFCSYSBEE3MiOHVKv4Zw5/z02K+lbUTmh9Kvq45HKZMoah4dD+me2geAns/FAF8LsMDgT+4VcjHJo+9S1UBJU/OZ8iCGPcjCO3DV3REgZpIJBcR2mgwC/ahEyiUolGr5cm9bKjP9YF/m8BUCQhO9ofuwxEUQYX5N61scN445iGj/uwWZeFEl7rSTSjE9dDZkiL46wcmLD4pgPlA7Xzax6ip8j0YAZzXgxeMy5yfhawqWNELQ82K7mMSZ0wzZpyzoV6G6sUCJm+RacdVERlS+ZgQV+OBcxJuVe6P/zKWCpHGBc/U85bwoq693fLOo7Ospajd+5gSZURtssbLD0aD4Wc4fjSBWVlLiJj/1EF1JeM/GIPP/71wRq68xSMhZ6yp8Y3cVQdWKYMTVZR8qVvlF/thSaqdIvWRhNns3Ao7n3iLABgXcdeZJfbtst2LTISCstrOF9/5k5y8s8YvP8EtpgVgyBxulkvHO7lAuavYFX99FpubM0pPXo5Y4GGl9F9/F+8zjpOxHC1W3AVpuwfKgkjq7l2KuYEph3qMgyA9F5uW3ey5fpZloMMNKqFwyk9ct+j778aujuF69UmVgNVf3StfyzhqvCU3vUy6hIptEnn3biNYWdEuJ+fgr6tj/BmCZJoDumC8PbRYZCwHlDKS+JshpWNeb2LSOCwrqoiTO6ttoPcpzd2II7Y2eINg7NguJs8WXA+8+JnPwZt7YOS2yKpZ3T8KaBV1+74La1zAgBfTYIRLU9cyAkICKJqUIbwRWTEY/i3Fzavb5/0G5IvKHO6rDqzV/cFpUnm025hz/tmqz8wwk3MHeb5mCkWXlI/iEZnzttA+Pn/L1TQjVYevY4XtMZjcKaNLpnygrYXDS4qYU1OJAia6dHtIIWuMLJUqftKVX+N7DiB8cXsMvje1J06K4jApfA3/UgQyaJe6XA1W1spmBhTnscKK4O6srgNGKN8aXzemPavmepLRWtDM5v20EziDb/yUbA/mxMj/r3b4D0C3lcgIGLTvfvdhSiUyZjuwAkmv2Ywc7FR5wqsuD5tfjV6mSDTWkFzKgjDMGKR62qSR5KoRd4qYuqvcsoHdCpj6mM3oHpKo3tKuD+L+y04O4f6c2e68UFeKv870TcDUaDahG7F9eeJUbRj8qYX4o3JtNCI+/q3+zfD8/NtrNYIq6J34W2Z+EaInqJTCteeZQyevyTRb7XquPqwShRx5TSGlD7fQunl6C8Fg8jeXEcGkjH0ov4WIxTgcYaGeaRrEip+wwEiRkhmDekq2fH3RCWEs+VU8Gyhmd3TGvT6XZ/iMFoX52vgx2hbzr11LhyuYe1Jg9nH7dXcqotD1yGqhRcufjITVUKelXf04VrP/DOOSYlvNbI+xZXKX10GsX8Da1Xaw7PbA1WWmq7OQlHdTliHQeb7uKl0FJfTq8aIRukslL2YK+qeQmaNgf/0sXuJIDJTIPhXUJtGZJ3vkLSWPEmHf2QfbabJ3P/KY27p2XQTISsndOmSXRETd8k9HtpT8Rf+BBNe+/xcfFFYuXk4v0w3fTe0bsCBXAwgognU6xT5kvayQw887U9lgAzHQDSXqR8kG6w3IQPxCW3oUG/LE0INnz/z3t8HAjIf5MymIwymXlMQEm4merr9mfIcNon1i5vAhmFx80Y+dna2h7NkQxTQQB50oPYz0mHarYTSFB8Ff1HY8Lp8a23Ffcvh7C2gMZ3Xejjtqy5I8iPP9na1VK8GPnPcL+dh0qZ3WjjFfuyckzTi3naoNY4nfiCJfboTb5ioe021LhajJGj31jz97X569+SF81fztF5s8+wBSieAJYWf4fVfFmIwfkvKjQ2/gpr7MUuc1EhUPNZ6neTNUyaFOOXGovq3fDFl/P2/s+GkwdOAB8VZLA8mBEk/i8Obm5we8P74vtAzr/tzY67lTFKGUDG45sitq8F311NWXDtp0YLadvs2awv6MhM98rrTL2SDTAtXXIS9NdfcCoiqKoGtAJlbYW77nlJu3Tvt5GcqH7ApE+GCdquG7Omv70c3oyMrNeNt9iAXa/qykQBhkZ+VD60aHhEcfsdvLdS1qZZx/U5Bj3jHXdAmUx5XPFYieNLKsFSp5irR15wjah62OzC6zsd3EKFN5qQ8uNO9QXCenzvG14ApSZXWPI8oloYKmZT9ErBWl5G+V7laLk2iTrtgAMIu7IvcBVNWgAIumLf64JqyB/d81eR2vRNvn5bWE9LG4t2MGqB5jQClg2j251kii9yyAY29TpZ08aTGH6snHkDlpVEK20KZqlmtA0FA+W7cVYsBDpIFJXNX4aV9KT+nKKwvvDsHCRNv5VyNM2r5NmcgGsI2w5KNzrGcerhh89c9nMWQ6FBK1KFPjeZGNe2c2Dkivs8Epsg9ekYKW70cGx+Cg+CgaahhLj9RPGP2JhvmKm5zBCVgiXOC0M2EdRyTLmPvUUCcidijr7xFQOskEVdVd9L++IL70JmcfWyIgNVc5xOvrHxlXluhbL/fNGfmo9UHuPFcFw7g33LYJudVYyXlL/jO77oiJ5V1NUS14rkaR7W1WD3c6+H4tYnJUviPr8kmutX9GE/+g36IcnwMkNMxZjCE9c/5Ncsp7+jzx6nhifkmfJyvD8cQh5/seyn7Xjup+GErsG/sH5h4TmjyfEVe3dZuvSxNzo9hxjHk3jy7+8sZvnD8GhTqFR2HPIEbsM/OdCv10fKxV8hokwyu0/SeORu41/T7Idm8SU2iuYX5oLj1n5KJe2MXxFUhRv6/5AB5p5vbfOZR88V+ay9tNpGZWc+gvzsrg2jY7Mtcno1HldV/TbrS8M9VB6amgISt11itACZesj7nfh5Xo77NXfh0VXrgNJGIkQogYXn8ejAa8G5VGUIvMVKak67BAeFwfIA/vdQ9586/eHszEw8QC6KFJ8opHdZPKl80ivQRjDYvH6uXdecb/ySyRlqQnK+F73EDHxyWwSegBkcyreFuS/hsmg44/ttE4VcFYqIVNNva9KrpMh9xK7Tv+ZnBaySdzUPQ/NUpfGKPrEWsxtyiqQ1lsfm5gn2auUB9843096HHrr6GUtodCV60xbvdXhGlZJaTNb1gavI8lJpsDQ9KN22451xQtdFxND+D99jdMp3/uHv/qSWnkQ8RFf6V/d8wRRNsQzuVw9EFYcsjMiB7f7UlGU+FTKKUBINHwdXLY4pe6yQwHagRSSsjap+smot9rEp9uhj/oAft0E3+OhL8srJiYbaIHEpC3+03Jm8/BmJplwq/oD/63AAA/v7QHAFRcdrz0xr4Zu4Poa7nIRY+S8T6MnZd0/VfA/XoRDbmo2EVbIohXtZOv/c9y9JKjlznkHDoDQnNqlW1iHuq+xudlAM2Tzl2OY/Nwe/27W6S/e+SZdNno4q7lmBCgWwQueoPhZ9j7N1ZEqAvlVjtKj1/YNaGp2Bx/LLel+3Vl1dsEwuD4r+n0eb2ok+qNyeRgpnc1exYnHMDwpxJ09CdRCAJO4dPAytWEfnNv7mPX7zZBRvfbJBGhZfoIfOcN6B5ohMb8wjGGDClwSNW60V9pboxlbRgii3syN95VmeMtz02Zu1Nk954nI2qnRNywi/KxlFgE9I+YNYDyGn17VtGSVahhZKwI/l2mdm6cDPN6eyy12WPM/t0iO81KePcrzGc/D+oXQIy01uiE0wPg3Tuh0eAW7MwN5AAAUAMExmh4rpHxcV82XJWxok14HHxiMU5K3eAujC/KtLpsyXaNz3mjdbppfmhaTRnr+P3aVvr1dVHy9XpkAAHKHU2kf1csyX4f1JENffWdd5aMqUV7iGh4f0qTLl56BlnYcJWOxzoCAQKPY52bJz1T+mM3tABuFSIoPzbrfzvDDvtAzhdot51B8IPW/+PHB6joglL8KG5xfjDK1OM7prJeueyzKsTqF+PHUYFoIRqgqIV/aLF09EYSgKRIepbe72xL5yT+JGLC3rZKamRy9rkNF017PHGg4bKtCq5JoMJ+cRlxtHsXmFlP9N8ivebRL4z6/E6KKEdo5S7Xqd6NIoBhRH15Rdkjikvl3TNk/x7g2hSMUJjWM/FTqjyg1cshrwLJu9OUpJv7z+wSWYuXkJg/kPAt9hQz+O5Qv4tItJQ+UQy+gZx+9F1UwEc/nf3yLbby+qH/1DO3Wkn2LR5spE43rM7gD9aKUWsPoIKP2Nt4DA4PQMYCHPOBa6le0r6X+b1do4egJe9P6n7n80zrTzvhTdIkvUzTslhf03H87M+a3DclrskE2u3GnY+miNji+sfWIavdOpSfaM23R1jdCtfHPGsGcAlMYs+emV/0xu0kJqAwKmSwn5mCBQgiK8+B+yv8A3z0Qrsehd8CAFzUyj3ebukXcyZkYOUL4DxbH7obX+8D/RAaU/Fy0ZZ7IR8sBoflFTFKNsJN49ngJcxUs9U/6THY/85etzSH/l/3aCh8UM3SXXXsOdT/I1W+ZMDR5YObsBt1kPT76V7algyQf6tcRyE9JjwkHfpjkBv2L+Hq25k0xnIj9IeOvcXLbbpV02a3uk5RZCRa21TppXR3ZbkvB+RdGwPxcvdbBVRurtkQXoRA8UtuBE56yrqZQHitsmuFRz0HFj+k3AtmCCVFmihtyTfgHSuK8NSVdoLO9uTHZIugSCEuKZOoV+S6o/sIp8rMq05vytljXzDXyuJl9v1nfcHzpzxBnUGKZ2m2zzHoNMtPoiHBAujokDwyFsLBUCpsmA3FOADL2XXgWSK9EqVUVrhJu1ddiaWlaZouszZ5dC6pkc5JiIiDZrKA31Bd465Ed0CS13yGKl59nkGbINfA5dCii01BnP+I15+EHqgqrKMoFQQ5H15q7+R/LhYo3iF4oBK7oWCihwOi0hSIha6SyIj/m6kT3S/f8RsLF1RO5JB6svxdY2Y/XOf/w1gy45xf6I9sUIV2FsHwyanRWN44pfQ7mg+pRiKHiL61pkF4wHaNVXuoVxbbljVoU0PX/n1M4cczUxbpPKNa7FsNt3jLZnIa2mM0w37Z2DYjy74cygeDwu2DuWA6IvUhF+mTrIj3VAecXIbzRBXUBE3ICUPRkEBLCLLT4qAHPHFYWxFFIkDigDS6CzPEqcDFfhoHe3NM/M8eCUSJMzlOalAQppWrEw9SN0cQz5Y07KMWYT1h0Y8ztqWng5PnXy1WkKeTTrm8hgBpseYusgSBxQEiu6wnfLyHL4nhDmD5d2sgDOZtdEQAJrb6LeYOjuZiIKOzHdtwcyLAoY0E9Ws0QRQeWD7vJo3VXaY/yXthqKR4n0OpMg/p6HlQTzsdZ/D5+IZkBVK55cIQlIU4GDGN3+dSI9Vd3poMX5MFJniR+CGVcSGPmPe25j8Yx63SQWt54iS7Uo6Sz9um/gY2eklG3Qu83BgCsLiDfv+gdTRAApKEJysTVBsqOxM6JfPBi/KqP/9hob4ZYLI6Hx4oJ9YVqUO+y1BwvhZorD5uvtbHseXIg4uKMqnAje7M16fGnOfUiiH65IG/VDToWJkdbrPTGIje2oWE67ZnGQ3JcQ4E1akttlXYKDC8E1yQw43Kfn99MJfZ5fjVuFIlBSlfm/veWEExOniDOywyxbn/+aGbCJxdnwA8+HeXJUTgS6qMx8YFBZ/o5pcsV4IruSF/TOBZLFB/J1U5qhnk7N8/lfmjHUiR9HXX8PvrgF7FjurQBubgG3l2FTKW5bMU6RODQMR8dKoc2PZglse5w8CNwEGAPL1/+4cLh9AYSmywE5ts/NdsD/q18jR56BtWC9Zto471ClXh8BpzOCEmMrSP81fkuvZQZopJ3LY1BlH97fDRlflw4zIV8DPGob4SbPGMGCEgCapW+Zwoah0dzY+HGWmkuVtpgUlanLSp+oi7yuN0fH9RemKzkBYZbpTcYAQxMpa+xuf/VvIxTebDt+xCbxI3gnFhIvm9KJ/G4X51Bsh5TijCd8fMuCQ9DB2oYqB6shuJJtiIbalm5hkpoSPt0RUglfjHyl5D9qhjF9qPXQmwZhk4ZyZ+D6JPit2IAqQAbXTX9MOSJAvP31TrMFEOUrRzH8hWyfSFNwedJF2Md5zEPQuN9yJZ45737FLguw4Pu+Tu58t3SyOQzLtSMyRXg3w7TSfgnYYgepEgvMupJJA3NNX8OP59fVRxG3QfMRueZDe5YXRc2B706MXWgkcFWfOLPzfdany126L1a1m8iiA/K1xGrBewnkfbpAqZ63AsMzk5NtftDM5VNPpj3lvqZqzkvVXgfSj/YZUInZ4YCpdKrsqB6AKzvm/IkBguFrw5d0fr1CoGY+nJ4EET9SrjaNC5wUzHX81Ix8qokkgFj/Ra8aWnxSxCGrlPoFPhYa/Op7jJsit4W31x1RMXbsImgKhg3CeRMotzeS8XfhIHlqP93uquFMxWcIL8pHvsZcKl1xVnJ3d9HM7AWf4sgXxYqB9Gwn0/jDF56qatl5/Sy9OsH4GzwI7gKwmA2Pk1cUGc7TNVA+e1IwH98x8s0UiYwZwuycvEfeaFBPX/inomsb/uUNsgLNYzyTOC4rSzuMq4ONSqk7/hRrnFUp05CZmkTfqTL2HderuZEWqJJpeyfuNoudSKfeO7FfsPYJZhZLCjuGSZ4eti1zLCGeE5ZeShs9yA1xucoxwtsSDxjib6lgR0Rn/hAe0vJWVu+ILGnOLr49gM67qFjWsLYupGEoWs/WG6cZl3XKgsovrh+0JJALi/VpGY6SjP+VH5mXDlfFiKMMhvO3j/S9RqLJ3YOZgwFWFyh/OWOFDLbsVNpqEasUd+4pk8NxridpAX+6sqgaIUtvW47Qo3Ele4eAzBqYheHtwqV4TK9arQWi5q/auEPWV/NHcir9vpRcCeypu1/Qe+d5dhvIDa9bBIssjrZ3YeMzbss0WzhBXidF5PzBw0ZVwv43ZnONvzT/65J5jAl2DU5Djs8p1wK8mg2g6OctyBdDzeRurUfDFipuYMVVsE5CKxGd99YUyj/p5/nhfm0/SG2vOhXIDsnY1JPTBOBTJRDT0jyEsgjfMZBVd2lLQq2/dDraMSQmxZfhCB/b8RsynHo8gcCHyVMGpkN1RKgzsfyTmQL8h26EFduPWaDP5nAzxloo6HULKG89EE998S10VFcR/Fa2eQbbDeuGvQZRK9F/24to6TYgVZ3C9J5FWvC7ShxFOWrSfYDm7WHKB9cAFeUUkKYWP98GOJKU4GJPvgfkHfslLCPHulTx+a4QDY0J6E4JjUIuZmPSm9/fWMBimPU5Ux8Ac21vxucjXq8oqUI/Bz/vkED/jTl1dG3hZndms4ZxjIJGTn3qQEKhkCIr65EXTulZHuRSvSAhHFi9LlbJKEmME2CZuPh2R8y6z5nRJFdge0rdt2xYw73DrGtqp+6+87DGkNpMCaSj4cyKKhDsb3d6qBZn87eJOS0znVY63yVPvYeYFRlmKkkgV/BtE3dQcq3oQeWnMLF/wllnD9J/+2FzbrGcx2TN+rgKBV7Rn5zDNS8WdkChhY5pVC5B0CJrzJZgwe/c9E0AA2mTMxD+juj0FE37X3LuZcHoNJzZx3nrADLsAZIkEi1CreYg7i6Ce2v1B7lFK1kX/Nz6NDgaxOZaHn+N2nmLFlexodYUFcj4Dw6sgsGOzPCGwga6lf12W5m6im0kH5QvQFHGotNpMC7UTRbCyVQD2RXTp6JLV0jnlBO1rXzifcknq0KwDVA19lJcsfVQ77g9LzjY6/gEpQeVcorolR5Dvg2aO6NkwTDi1GHuLPcWVsQQStvXZHW5Qo4Ev7cbBvJRnesxUSTEUzxut6DyKx+fFMVhWM28I+Ssbpztd6fVenLBjIyhOvxhjc1ojtBGAl1mjD3PwOy3yK7JUGI2F8fepCphpJ23qjAtQHxEBrE6Mh8FZcW9EeLJ3Z5gOIVPDCrUpdPT0xttAx6c56Ixa2Pc9UPJe7ruUAqUq+Gt6dgCRtmqgyknVRWjXayNIuvh3Q+85SMkMVFoRnWgtfmUEmKcVnSmcM1gHv//tz8ymuDyVfJ3EeK0ZNve8wqqa0+hH9e+oczOOC5+AnglZcH7FxGrHu30962D4gSj4UAzCm+ur0HcTKwY6Q3m9hTgYnMLb2aC+Pt7WKgcrbSVHHrEN8qj/5oxRTT3iKggBGK6v9/Y8A24Onakx64SOrgJmP6DZLRwuae1zMwvXSEDdmk5m29yXAsboM7GdFG0fidI3oQx0FEqJP4imPytk4ITV6gEqStARcp4FVKdNrByQzh536tc2YIY8PQxegu/vYOmarIld4+/NQ60AwhV2gT6PLqEipAQcgyzvAPtcEzUAcx7gVdOiR1c63qKkTFCL3jfRM6alUTQja7nMsx0VOR8i61l11zQFsN35mgZ4vQwET56i02xBpExZAQwQP9wETVgMUKpUb4FvnpeBNqGtqG90orQW7BawZc6zHT3ifbcNDG3eplLTNWRbwrA2Us6eH7AXixA/Q6nPcsI/sD2TMeQ2TdO3+5RVxjY0Gr6hGZv9lTZVX/rWOnxnT64lpZxhlrT3H4u2SuCxzMljMldmfVznbkGZdtbpNqxd0efJX6oiW1eJrjvSgWNohl70YXbFBvm5vY+iQLKqCfsevj2B1EIb3miKMynsHHKUyXJ+Ts14fmRJDccE97w/N2p5nM0m5ggU9EHRl/RzyagUq5PCOQtOyQN8320oWHhjYqJL+G4f++GDlpFJBYkxOgA7rMT7XvlmPj/STyRApZ4WzyCI9C4T9IRZNJxa5H6BlIlAHtHFODaF9wJmceR6yY5N++Qtz6cdbIkIO9EvSebtiwkEVKVomee+5BijSWD4VAldefDkZeFGjvQXrfUFXQLBzWkrGQEr4W2ApWRLaKljnr2wg7LIJRPcTdtQIEe+WnDuHM24xhKiOqCSwIKAvUL40KcxVgUhTuJctyJDQWjsEpyP2t273VDsJ4EMh9sNjGBImCxieqprZWZpEB+5de3YY26oUXflAJIiBQlFfkNzlDt8it3YOQe/kS+2+Bqfunm7qL9bM5Uu7z2AAijQXn8g/59zSr4UvWXH8yVq287g9QgBIFHG1LR7DfMLbHtx+gu2qt/hFKTMzx67uLIZGVzE5l4jNHDdOSg80QA5Mo/rAKSYUG10PpSSovDWwcfMvx/uSIVPDVohBMKfZG5HBt40ivZ8OtaKvyLjl+n7j7Bh7Xr61QDYpY9msbUDV9K3N2OAN7vlCYhxgpliXZca5VL+CCXKvE6pcxmeYCVI7pfj+NcMcSi0NM7as2us1G4BZdAA2er+PdJxbjVgND03eCcQxhbxaar3epZ+X+LBbtPjwQaEc1+FfrDow2aBJUsGklk43UOtukf7BcFN9IIvEr0M2UKRoCtnFgmZEn5CcLqn7BdqZldoO6Ov5z2Ti4bgGMb+Cw6DMCqQroq/K6MdlnbpvXm0RjqofZ3xtkztyDwz8YFYA9OF/HzTpWvjtVk2/MAuK84wU9JGCzIjUXsgyajw5xMyXF11gLSno/rSoqL7Zu4ezCKBgxKUHWmpNiIWdOXnXpsMaj7HEkK2xVBWChm+utC73+dWX6RIQnWZ/eXPn6DPAbwLSbUTqQtCw84mZqqbuOcW6pIr9W9h1InjGbrAvwMiUZHmrn7a6N7aietUGozqyqM5gP+TyWmzj3OY7u3UblkYTXAtzpDRyr6Emg9qVWqM9VH/Kl98eaLC4LmYd7Cjzeg3urdty4xl25yVlykQ5pBSGGxhxFE1ZfA/DM5+ZulB4aqT0lXjbg10RIrumy0IUXgld7sk2CS5irqufJAiRLUkHOvtKGDxpgUhYusgWEn4ewBVfjJr/NFXHAM1LCDkVFqoPZTepoePZDJxzhH9vGFmp+/FiMWCtVwLr8UItrIEIn9gi2ANmnYlZg3G2bxF4iSM1k0XG/OBi70O8teFV1FZBqlMwAPnxQR7koz2U1dv3oP6GNmdPfSMDB3TMWAa7PjFCCoUspD2xiJl0ve+VL0XBxHFAfThUcxpGoGZYHqAIHsQ8DxJ9h/vEEfV1DZU8+hCbND5c2g93ItvcRQgTnNHfjPB5/7e11lNUVvgFCcTgSHfL7L82qMuila5hKwqW4zNWctLTlaig1d7wEzbogXlEKH0/Mrwy/fEkFvEUMxrO9moru1Gge1DvFUg2FwJBgiFmAHuaq6em/dm20t8rlFrxUPqSgScy0JLyB4xQRcrxIsi1xmjjdCzgo4Yl/nIqUhFYPnBzJnqS5sr1/kQ2IgyDiZBs8f3mrbQMMp3R/3P5ztaT9WoxPacI30wRH4B01g31zapHB8rcxC6URlo6I7ik1GarujH3iNRWYbFYca2dleVzwO8Lion6YO/Rg4pVNBPG+S8tDDGPr1g4v3zMTrR9Q7qi9Uyoq24wuwWnWFlZZoS+G72EcPvlFjaAPCNV1FlLb/Tb7HlKwy6tUASLD/sxgc1o/3V5CgvwXYXUPKrxYKiV+hzQWqncMXRk49kTxjEiog+vof/Zp5TNc12mYFm2kq3mwjl/1tCwYmsTrfScn4OyfIIQXNw0v36YrJPj9Pjiw408yD/2pkvg9AFcoBdR45R/XpDp5GsO7lDbqS5j+TFqwP+0X6FOVtw5PP0xQ6Th8pTiYfLCzaMvB6PBPojBf7UzRaS5TWQT9ldwlSPb2HLXhBdpC3VNWd3BxzMk7DyGRbQPaQPkWf6LzX1PPAtK7HYiNXcfS9Bpu+oEXbsFSBMgQ3244/2a8MOp8MSQNiOorPeXboDgVQhneBzcBEDTHpGVyQ/crVslCrBFC9rZra2tWh4F/mMBbgfhWAFxubANoHkvLRER86J/unk/yGf5zE+L2bdW8K9i0yVKhGKgbBBerVm7grN26XA2QMMuhMKfPon00StgFWQsCwBcffEaMhJ2dbF/RokNbp/4Krc7JsLgY8w1C8FdpP/ptSQmNkE4hrCW4Wjqlsk/+FlQKwd5Pousk9ZHsOaoL8dz52bRHl6UhO3kr9GhuUErDdUk5W1iB9oszphsgJ/Cv32kOftLJOCbs2HmwLoax5t0B9W3tAmPrIVqbAq7Csjz3U9W4aCB/R9zXsB+pM/VYcQRloNfDZfIQOu4VWSlHILbjEs3YlWcSxEP16eI3eFZAlSnQLPYBoHxKPAEnikXkcbynYIrQkA/v0ReXdBJVbf2xSguHD9HlYGU2bArDx5jTw8GGeotVQ+vnT5CDq4a9B5w/iinQVo/mAIme7GB851dfISnWZ5MTOH0DAiHw7dUB4mKWnVbfe+gINh3dlbPGWdDVx85CTzP2bqbMrwc869K2apCKAlfgav3L+Jh5zhVc38uufgQYw1eivvo/itFHQk8KXwUZm5Eyps44pVRb4caHOPXzlD3v1AnbFzrFRMAMFVwLDbVusd0roSuKRrC0tkMi1yDUoliFl3NbSS6/FdGissf89tgkmXFTf+Vo9pPwk947+YPGB2K51H5smP6RemD+fwQrIyESn4+emgiil9Izg+A4hGTCviUrNdsu3nWG/JfHUawfu1PbZkxxp5+3O3skzxrdAfX3FWx+2/sMaCgpZa3Mlc3iB0w86BmSd2VsU9hCUArtdfprGD4PGNKbn2GhWdSBgJNAka6b7P9GZD6nhamRxeRm7pJZC7Y4RMijpWmFXzwXxxu8u3XDX5nRuPDDWxSARRbttGxe6Yl4gHfRF8m6TS2CElAvMuHAqfk/T8hfucsxIHKcOSfl+mSqVrLiFkiI87ufB+v0+EPowdS41qpLGzMPretErkdGmn1fr888d1wYQatTV8oib0Sd+JO+0i6cgX+mJO2xfw7r6mIBdtBb8e9lGr7slrk3Ccv/GI4D+rl67qJoTdmVw6nLPGUfZd6LW8XxU6xz80Qwhh+xJK7iKmu54AjdMnhNTWtQ7jv/3nZSqDFTP0GznL4tYJpXXZvpwEZCYKmPO+cqtadWJ4gUGUltgyrZKLWEaoWvmS4Wgf+dHMd3cO3wu62giXkDZSxJwHzxs54tt0/jhyLbUFYcrm+/Hdgj8kFlDEjgg0zQVGNma1gnUBXlUEnU74nOx5VkOoQd0/MoFZVkkm4GwZIVdzQ+whL4wqJTIRiRf+fa0nv0dADRczU2JQLbn0hDlXdwBe521xv2kodkWSCcSRhhwMXpv3znvfGKa3dwnUZvZRzl/eLzYcmsF9dx9uQ3ZE63sz0R6770extlr0XNlYvAIdnQzl4GENzOe3tv3LBmXblAAxxaHH+lhwHHk3LkvSJxFcU9Ye8M70OvXMXYF2/VvngxXaerOCZVeFVoxdFdV+H32Esh754sAV/pdzCtOwIwwmaKJiYXpSx5Ho3xCiGoTBwPIeTjoSMGmFooCiOmPMovgzgqGJR/4eB8IINkrVatC8p04b1AjQwRl4VeA8WOKdeo2JgKmiF2oSrqGzaN0492kvzuPzwxZKJ8R9MAjY2rLVt2zoIney8sbS+iOHtBNF2LOlx4oSKOGaZztbQCqpLqd4/mZkilQ93QaMrkk1IVzIoKBmKSCFrss89uu0uqwObbQa90PZNvzVBE98aeINAK6KbAlGt3DzTnO5HdEIcwqpyzGt6aDZmcno7Ue462ITFyJZTSiV6d7abIr+g6AyDP0zwyHb8wSG9s43tUKT8YrJowwBZYjJWOa/CjhCgx3bw+1KLUXYpAYEEAOaBknUtmXsclGxGj+OeuwbbtyizRsFZH/GbvRAJX6veG2lyWvP2qC2qGotDLd3mTCdzwUum7Tg+KUr8C8fkfk5gIS9GXH1BdQeUmslhZWjtwWQVEkkOWjf5gI/VUGqvfVUC2d/rwgpVloHtKrnyqnT1+eKNL5+Jgg3KS7QDtZKIzBDtU21ktEyT9dvDZ6lb/GbpJVWo8zmjlvVkY77fV5QihzOvft7I2RgvzGd/rOM3dIUVA1b/Iigyjsea+Z8hgThOPiqgR4puTyILFInel6NtJCEHlQXin1pXE5Z11XDWzY3Z+lJ1YpAY24JzeR1pKHTuQgiSd4xp60NRqmdm4bCIgJ9gCWqLEjRRfrDQaUcHKYdDs3qbh9u85MXZYnOLvCRLBUejFmlAW6TK7yQtcaVtkF7xtq+MUkEONK9u/eLT3bX5HnvPz414qtUgTfatu1MKwub09pRmKXJibrNPyErZhwsWd2F6piWzIx3NB/Ekdqv3GStN8fuG5vrEapwhBwu/DHXeI1+Aj2bGCKgPCiuBauE9h8FXX/pUEWifhbaGYkba/4Ci3Cu+Wl41uClUtiofWYXua+SQQW/eXrlUqcu8Bua2+rjoMB8Pvrq7fE6ic1Kl+OjHbm2ZrtXJO5w/j0wXcmO46VMVwzrlwMR5HEsmk914pJ+dv434Vz8qmjt1dBvnKwd7fBZHYMJLgHJqUAhVP7JHVwaZuIGBcig0P8qWunWiWFjWFv+ONtuqGu7H6MN475MiB9SR4157oEgHQLHwkyC1XoqeFhBO4xpzGsgUEHGBqydvJCxtECz3zX7HVq9l+EzCtYdE5HbL9xRqeeSBAv1FNbCE4paE9slpSNWc3qRKbTHvpvwHh0JyeGI1KEUYicKVnHREquOHEkBJKZ58Bvogqre0Z246/CW9weK+e5GFUOUb0U+BtsxttHEp7LzTf5ycI5nx+OszMfIlfJdfS2gx/KYYf+lPJ0tOFRPDzGiNeWP5OJOKltisbKQfbchWO0DmcmxFdectDs8qZJ0HWrQDeW07nNMvIu8NBv/8jIormykkrUOBSsulXDkz37CjLtFm3nTIDuM0l3yRhX2IqqjZ3HHr09TBqtgeYvwiQe+72L/FMN0od0O3eWFu2dW2PCFqm+3blv2JYS6P7VaD9BEEGFANq0sxlyTz8RBVx4JG926FKX2uERdRVcqyADy0O/7KViFki7GU15StHRKEB4OEbo4GNpj4snScl0oIyarH2/Ge4wiofCGtfM4Yiw1Qwhni9zX4VrXthsPnIx2/v5/t7DuhSbSSQ5EylUdSKdRG+JInWbuKlH+ruGhxWOkTlJrukRlK9OlwtXWhtrxSF/0mkq2O31Sm6QFzkgeyuS0yK6OLd4C8RLL4qlwz3USUkE5wJJfYSAL/tA1ZPndvi0h6F6HtHV2TSE2hhhS1hLgWMpJLgqtFFcDTZZgCcujGbjYGfKLJAOUaljqtJQLdfd5+yr3Iersw7vAbUxcu3brEZN20UugWyfFT2WCa/DlPdcUppBCClGtiKw5n7AXI/dbkElrS0zki9MjgiymPZRHVp4lllEpwqAJvlGLcIwjsn8YcdtFCVrlXre+Rj+2NBwy9QCi07KPQZ4C1Czd9jFfpeBB0X6UhlicppgjKpoWiPk6NsDwyZl0LiDhgUnMJzYm1RIA5RTxJJWWA6nhEcO9OMMdYtrjrmXyptz1AcM7cvGZ2zhNDdeLARsFYmLLcBPo2BtJxlP2jXyQmOnMQX4cs6AhTk0zuTmxHRRI0fEwMCxuiQ3Ghz59XxP/MPZPc6mFsPY+JDhonyxD68h40xom20WsRcq3GbDgceIDGgljL67yDcie80OSkSiFKsDz+ATvlTGPlS8oQPUdmLUaHz09mkZjx+aIRRhjW8J2Qct0ahFSaTwjhwpKy/fvDVe5uGnbcMUKiX79Uk/3irG/f/llN1Fdy2NqywqH/xYZWTZHVn08o+LSNeNU65nlKOwUhbBYuriHMtYPcsgzYQawpEUXO+op12me9uZvEbzduAo9krGIggSxMCldXtwLl2tjmL9pdQ4AZTTnfKnTBfpTzox8WU0G41cvUEEnyQxmHnZEzdJRUrczXmL1SROIGgecs666hIuWj61goMKwhn4prgh46jYprSKxmvp4BQyiR1PnO1eNcfGsJCvDPwirs4r/OaXnuBnw5ouv5cNRqRUQXkSGD6B5SwKOfiIyEo1ub+zBiVIvVXsOCIuLuLEJ5gnKD/44MhUm9Kv4MyDYChYOEeEGVt33DiHa4/Yv7f/3mrZJzySRPPKM0L4RSIcoGkWA/PSO9cKN369HUg4vfTR0s87Qaq9mhiaGjrtR1mK840wY2ZVFWBxD8jTkR7gpMqMLlX/Ou2Pc/A5/ziv8Brn9whJjbOmJnBA3sDAUMyIsWC9V0FftveX3XReZu0zdIvWFP+1uZQDRsh+g19p2Da32jIFe/svrM9PNSDqfq40VFsB/jVSJfz0IzgaL8/Hb5/QkYPkfAWA9A4gZgYyDhk80AuchoeNcYFC/q69ZYlguqhbkwjAsbarmpGjG2OMfkvUUEtaN8t9YdbeDUlG4d+MO83m7COTaByQDF9zkZrtnx7vpxaasjl7l0Uv7ynsfwuLFONFQHeLZtkt6Ohl0WzsayIwBnKPKrJrjKZ2Juz8uPouhYOL0nnmMF+EPpiMMXGIxRzKGEqeeuld89jKkdTsegFfQiQU+Gr/Nx4pQBnrOZHoK/gF8lnWzCZ/tXsDpd0vGkDJh4Ba6VRqyrF0WJPn8fjbmb2BXt9a1A1gzl1NXwg0NvknpCEecn9qdd62pyAk+Q6BSJSl/sDdxEN7ZoH2gN/P+4n0h7lTAaKiq7TDJxQS93QdoqDXlMhY5BWsSQWbHicfjWbhSCuUD09n/+3koptBMKGrKr9NQVW5K3qA5WzA8DVbPKz/AuN/kJbuQxVm4/TULfwtba73qUlHIrNEiNKprcC3Rk1tfqw8KWqGiWU3ovGLN4satOxNdLqpAP11yAkJcMGDI5lyDed9caRxM1fUXE05/haJ6BB3uGZFrRq5YM/c1Rw5mm+HKOMZsEtS/2KHKWIfk0ZK4S8/urbhlHYrl8f6nrz9mp25uvmoSKf28jtbr/loKUTc9UsayQM64G8qaXn3jFsRj6isfx/9dHwp9d9oUJ40EbOBa0OwSVUxWEtUEYkZ7jF/UjHosJ9wtUGh1dBeaDMSiBwTyi5I75bedLFEev0/0H+Ais3W3BHI9MneKXGMb0fAv3tHgleulOHZUYWo0cgJ9It+dVNaUoYf2bzxmy+oXEHwXUCTNnsHboW2CHlGKmZZF77shX3UxkT1KPOKH+eCUieRt/QK782xEVddvqQCLtnMQMIcnZJWOne8UxIzLrzTS6S2/Qs8c8VGeyfGwF7rB6pT6JHUVrwigeyTM3bQERfioMU6UUfDgGGuKMYIZWTAVrooEsCZHrsbaG+XkSso1e/0PPyNcvXmz6rAJozxur8Ocd7Fey5TetSxCOdcYpIXXcJYUcGVTY9EWYnGevsfOGt6BqrdmLkJLcSxRG/DkyQSEW0fE+fGiNJngK9UcIIm7o9HYyJWp2NQwd4OR35eLIC35KRYrsmnb4FcKRhrRLgNCj9WFjaM+yjwuLLEvIinh7O59CPiyH4fc8x4YxhF1GqtyzmjI736Tla2meyNvKQvJ7E/k7p5RIdbpTg9exsRxy75cNzQ3ximG2x3LREoYo6YijojvKX1svck60EjJtTYU163m5YUI/1iWC1k9z9ljUc2FlaYmAzkxUb0/OgBPgKj47WQNKq/1SlXWthcnLXi3oA/8Tg3wT37NlCGXv0znXGZ1jHLBdpOG/X8sqfIUgFwA8MJkJU3HmcFoB9k2q0oi5nQXUasPlcecRf5qD+i/5MtiYtf3QXg8wmnoWDsrgb3VfFowNnMPNGXWykHtpMlkCCk8XpchQ/eVFj5sfkGC+k1rfUn1FvvAv9H1kdh78llroJPqdyshAwSkvECG5mlCMdl5teKvnyEg4Pxxa2G70uOmJnVBsvV8zUbL1kD1edIeit6qDQeIWIOGyB6DlfJn62PaD/nugPlJLowmsdEcNafu5t2NmLk4w3po+HvjUe3M1kBte4a5375FbLRZy1xIWQaiMxCOCAVAMAT1iKgwjO7+uPvibtqQBDBCPA0I6xMYF74GZvc9J5RacLD78VDfOX6SPjwCZ2Ykg5ck7vnnd0HDxhSOFcY4thO7sWZZAskbXaiH2y8LwjL0nCpzXnEl+2Qp5xMGLar3TbW5sWtn4491PwDAmFqqBiaPP7G/Xi4pELL0PsInKS/fB3f3P0Igr8/dHw+xdo03kfLTmj67EbkmF0hwTBQVqpOltAPKUnLar6xMskIHcUD4puZEzGMjkMhFIU9OagRX1vt2FPtPJ+8D1M6BEm2OXsYqBDwQxU+s89aslG7OBKM6qu6RfVPkgCYL9KpuIcg0w0VAj8SWM3OpTA3wSLF8dFgiLbWV8wXc7N607zJwwpGRDUQGeO9KClxUecIeItmlxmluwCGtFW6WINySOCUHKBHmY/8u6Guyj4dy1G6oSjUxm1mL1bdR7Iv/qdPeP9inDfxvmjBzgxN9FouFXYU2DhtIn/V82Es5TANkVZ1EwozFKG8oGwS3UQc/LFa4pFWYNqwV5RmL002DYCuEdDdAK5hUltKV3fn3wCfQDGrrd4Ncl+8usu5LAihJtMSBpJOTZNlvjmddKIIOgTwpDWIEWFzYNXhYUP7J1kwQA5vCOQtsVWPi3KHZ6L3gZDx5zBCNpnqB+Amslcs88KeYYDzy8OeMQzjYS/ojxBPJpOVP+pCGAH2UWj33aOfgyjsw/kHkry1VklUEQWAzkMCssq4QlyPMS8X4qw6XpDgq7JhQ3WSX+CumLpasHEg/vy05e8mDEKbjX3d/0VQy68o8s/tdztvHNxELLz1i6lai0WpUImS1vGUV7YBBVJkt/NIy8/rbjxmTUycYVgFt7AcDdHTzTA8SEAwBm0B00i7C/bTHMVNsheJbXgH6RcGsTajDFFSNSN6+SLC5upF6aVcTxu9f5ZxS/Ux5HHCwRvgeT5cD2OqP4J0X+xteZg3ueIiY5QhQ5nXWBIsou3KXIJTm2NU44U3KOoygpG6BY1Cp2ttLSd5uIJF5JXe5sNYMLeA5uPMyzWvGx1DQhY2/KTGtymoTdYUPLyDGzGl5OJCQbAUW9dSli/Am/i4mR16ZyXfHiuKOcIc/OqVpKoKFCzuOA6LLjcYadC6X3D0fYXxcyw/jfLnVwZSFo8FBauGzfC9iH4nLHXuw6ZmrRraLXLVYi+o2iDj2Y1a5eNPOlfNLct8JD1criLqZHWj9kqTnNQ8hMwOcmO+qE30btsfOPQckhMtTVjbZ/t8jq3v1jejFU8chtD/2hbedCaRYuLxFInud0AhRMduPK7tWXDVgUZSBJJtdSJJ4W0KV3gvTBIdsAllrFPEHVmJ6sx0EjwL4RGYojbabUAJseYP+yd52cBjYkqRW0gX2bggAihuA8s5jN4f4ZOBKBg7JkhTfXuLrDNepEgE9uwUCuM1hSQsJqFXereQ4lJt+Wn8r3r2At1XLPKpUAUh6YuUVdOrBFVHM3IvFtorb/FgnOTXaljNxJFHig+YXmc7dk39EQJ9Hu647kBIG+dVCht7bQ1IGnC/x28PchH2e+RyvWAa6/mYu6yM7aiU+WX2rbCn7U0vZNdF6USZLH5Qm+D8kAbNyriWD/9cDm8pwvtmMwqPTkV9ZA3C9uYzDQ2nviOQ4iDPi1Ou0w+wDisrOeDnqSUxkDpJhBDSiB+drxjnE27IU22tDd3GfoYIaQIEUUl3f89bUjC/kXe3tDe3Zy1bcOEuWhdHzPDfVv1OdmTkiZ4sIjkWv8QAgY1yoxloSel6clkI4I1ASIYB6KxCuhzRMKtNR1pdebCc3oBnVbUNYB/8RrhbhanU/BV2yD0S28qqppjsdR5ptrXg6WaBKfCdPZjEjsRexaUMMtcErBLZ6OleRY/Hli9VLxK3uByYBt8X7TowwhPCdoWrQR8Tm0zZf5Ph+OzZyI8Y/2s2alUyJYHz31pQTdNiUorMuSv2RXOXJxcJiMK95IVy/bReOmnMCvJ/6VDnDKRxfIBlTR+Ce57SM4U1hOQW9PMiFobOWCqKOEoRbMrdFZaNDOnhp/rmgmOdKhuF6qFiHDyb6SeOWZeOZm/N/VORIXZXMqnhCyWM+TI7KYR0BsrdrA7OKUdIv4goM91XH9AMpYtw+cxU2iKrdEciovHL3PWqukJ2ghi/EDUQvlBgDMWg1JdISvHo+b7rdTeIqaHp4GooFcC3tmajdNIRRioGntL7v70SXSxtOqQF78Qx3OBgZVL+z+Kyb9yMQog0vioNqagIUmAuJbY+EleUWu5kodB00Zcaa1g3lqpFKLIYLrGZ7Ox6eI6KO2JqY88Xxnu7zrG4/tEjO9xeslVlC2ZXUmDgUjvPk38Knk7FsTmTg/WskD3R1IUXYO+O9lMDTugl9XUQq+ROBrnh8n1128lqUjXQn/uQ3iRm9O9zGSuofkM+4GoxnNaTgSJcK7tEB2dywLGBE3dNNbdzqqSm/KpRcBLCWpMhzWCkH+kxfw6Td7wTJ2QZN8KyKDf0mzdgQadmtRUxia6AlDV4osMh4nzc+RJbkEpsf88CB8ScHAV14bvNDjveyw0v+BULgmQ5RfNOOk6GFMOItZXxBRRboPE6U6vyLIylrtyNmyR8eUxpkoIxBEE4jcnl/E7bflkRhcmsjuZ06Cu5y0aRx3ZhuWPB/7fC4ECBsgauD+t/LoPa84JPlEGCh0R7vqBtwOwUnB9JwdmQxGB6cnEvA1NrZD1kaIL++65ssf0M9aDJgU5ccYRc83XyUKgeAHBY0jPXvFfVMrvQ8wzXQbDcmOL3ZHRdZZCF9OSX0bAzeLRUWabUym1d8tz67LeJQW0tSNXg1hxCje7dXf+ex/KQu6fMOT6AY1wUSoUSCeqnE/ruJV+VKOQaxmo3+CyWltQS9WQcjrRCPnrEBn423R8gx8NT1acdvUcdWmeTliwiuokLVqO5ag/EtVigcVhG7P5T0t8CoRDxP5fR0jEPEV8kUfWPhY+VfJ+i8hSBx/3V48yjoKPhwvbyuxxvC8FyfCgV8JW7gvptrfgl6y4C70Ebke4HoIoDwyTleTPu9Lw7uEiKFRCuQMLzlFqGukUkbrwTCLzMI3WQX9z7Lsa3QQm6WZFvFv79B7OwrgRLoTox1UZHDMQa/L4S9tAXlMYw0B6+7H/f2oczsBl++4o4ED3cAeXxMl/DcCxth4ixeV1aMlKZ1YlrwbBg0nlZqqJ0S/irWPxlPfMYR3Ylnj8ElfLP7aoqvZojbmG4z1HXMWNjRubx6u7/Xbep1rfo3aCbBcEP5oA2Z42qqPJK9EKhu1bxxOoLY7+ckPrZ/5YJLUF3e/IHIRNz4HEExquOFFw1yOIn9BFavNP87eIMcymni/oT1EiyayVL5oQjiUj5F1KGevEU3G4Zb9TlQDCCw7oIpTunFM57Q7fmn7e0P/OMg0kSrq4TtbyNQqGdet2R+abiYOKtnsTxyRkej0PzzUenfiHW/KqhYq5u7ezbSKCbUEDOC95skPJzE/kCEH8vEAB2k+KhS5BZq8VgfpGn4uYolhMTY/J3JaYVtbEdViNH+pW3ts1EGR6r2GRxrMwvhcAKqDMHA1kuPT+OFcqQL8jm/kJV1Nepy7zqwTp1RO9tdkkAw1JWDn2F+t2426AVkCufrVnsUKFII6bXMKmw9SeHJvArUMsR8nFoWBafDytbDp54j7e2r+i++z817hhFkG4hXW3c845gKuzkdtW/73DMI5WYiCutKVPcWRpI+sLl0F7P35WH/oFuaGIWFl+1xPf/5q/hcj67YNonFbi7JHT7hhMSje6HzBjp/glgdOpykGd4T55NP/JorTOqpJU1uvinB6DPzTICpEgtcss8cX1/C6bWi8dE//eeCjTrlg5G17Z0ZBXCH5ePtdM252oNZaZ/q5l0pN4sJ5u1mXRHpkWPTTezPSu0E9GnvwAq0pMWTyVMIWgfiBHPODCy5uNcqOgXMquPgoa/f8WQ1wQNac0fG3L8AEhhi2fptI3aveQXcOhp9fdbi0fBLOYissy33jSFYJNHpYgJOT0B2AfpDN4uHS3hbG6qYXy3nzqZmNTS4hB42MWX4ujMNB6gIv8hzY/EsrOIVUUoW2rj3+qPFq/GA26dN398f5aseZhRbc0bQWe130f5C40vHewoMLkys/dHuOYM7Ypm38Snw1QHcnN0hB+BaIpnbNFwL+2ZkxB31uiNixBAIINGVPcoAyt8SM515asYWGEWXqxy7OO/XVG2Kka1zdMn5TI8nkmM8MzBi+uz9wLoO442EslZ9WeTUV4lErdnIBuL5HWXOo+GoK5sF++Q9nKFwpKbfepwndQYtjNqlADIp08VlyuZMt3ZIMmaMQuh4/WtBDR3fBuE4McbDt9ezyQYWXTVLaSOyNBvjyphlX2299VOFfRnVFW5HN2HkvQbo3o01mxHlFrYvQDMZ1r24nUsmMbFCugT4DsQ4PdRFjB3KK3bmuw/oE0YwcTVImWvsHhVpBt1io1RGAPCoy8UGRMOIAZk9+yUfE6Edh3RNliA+5HNXax9BJAVT8YCD9QvvBASH5Dsn2HvInpnZGtvEvtNtKBLCkIMx9a3OdTO+ctPSI+Zo9FrWxt4qtC0+P/9EFCJKgK6+pZKS3aod9J2uIkUHgIfILo1cBF8e6z9zUnox+yJx3cVPeJazaB0Sxzb+FJuZv7BmUIiPQQdeiGD9VIMJQriq0PUBOZ9Ins28JLEiZabHAx5wNpZFYN9yMjnf8RaMz+q50pHSmeZh4ljc/dawVJgRFrJl+BoP3M0bfkchRvYflJKFYZfQekba/3Y0EppKohXYXLlKlO/LAMBNM80foPw9TSvlf3V6wmBZD60tKPRK7wv9O4pl7TpJ2jB5203z1lYB0L6Fw9CdtBmhLXUpL7Zhls1y/o5wEmir4PUpqulF05dctkGlssnBFOO2hvzkj2wrAQN+CkZsqK8J3s9mCKRYQ1cd4IGt9QVWOcM+FZIM0J1SXGBSrLy/tJqGhQgL+DmQ+63a8upCGRW8DIcDYF9t94yOV4MOsDtiLNYDuJLKzh2f2rchVfoSeevC/UeXSNJj5hln+I8HwN78KF0ikiISZi7vMP/JlDlsgQI4aWB77O80r1rtqjYU7fJT80A6ZgStU7TUz9wxCGFKJ1OxzSsDpJl4H3JheCJUd9U91RjhWWg8ujdz/H+S996Adbjg1UO+vXkrGgpC6kkKYNgegLObUtYTUlpPNl4+BjEyKKKKe2bHBI5XyAKbh3f/DSZc0K9OgOcCFL63T08E8LWUYyPKZaDkUevK6RLilNqNsgvyVK+wDHyMxFigbwq3nIEw3OWDalBKsXoj/9eEMATix3eY3V3J6fn/PF4Kouf7a4G3TkUzBnCMJm1K5F8GaKkzJtRTTSixyxelIuObUVp6GBekUV2Biv8//IpSg6BH4CeoBdN/rSFFO0SNz6xvqhTaDe6O2ukLJArbUo1oi/nNBO107zFg2Gwe2EDGH8V7g6Ki3ki/DAdQxI0EK0p5tB+IXicb27pY+6AzLjJmMJm1DIGq63uoJ0+yhPugFVZ3obJsaBhBaT/ILA5IQ7xE3ZQHACGysPGfF1B5CyW782lI1F70ViTg0s9UovNuXJQI4aZm3LqujkOP+3ebPyVuBVtTCqUHScEyZ++cOcVf8F3D4sYo0S9CZsarBXaABEYrioubdiMm1Guwdr24l5Eh+E07rzMrYhAV8HRIuhZkfrO/1hui1ZyHA8A7FzyUBT7sYEeOFvWwtOmeqaWv0LYzVxsbNgLHjNfnV79k8BTpqPnhkq8VS2KB3aNqv+mvAbfHuKO7XitbzN4Jre5FwCmUbGklG10vMh/I671waPr2HP1ggOGhrc0ywFOJka7ecdYVPEYWngFaF36LoWWZbmDEObmXpF2jcf2YzBJ/z40CPq8x0nGhy86XiGglsMauMWiZMwK7FuLyKllvKLIp2+YVyXXZvMN3F76GnMYyK1WxPhaGk6oD8g01VqDdRyCJU8bKM8ifYcuPURbT0K0EIC2InritkceJocwtgNtxFpSivOWfcrgx7Qlq8VHzpm4qs9pYsqrehOXXq82cJiGndTbaayzBja1lSBW4N+AiaV6Y5WdZ1ZqHHKbu8oIzOGGxjdj+n0Iea0M+k9izRW7cBQ2cwrld5LXYLef8hlRsyio5CMpLQjbCWhCgMco+9nWu2i7s8D9yXxf0WnaDMVtRbT7u0UrQjZOtd2HPlLVw0efW44cyWk1g8VBtkxmgKn0jozPpVZL3E4IrLagf5qvmB+R098reLxA4O+XIxca+HcyVB9LuOM2Zop3f17aCtqoVJFsXywhfEboBPe1G0RVvjOI1WRWUsj8LOxLinWbV92Ar8OZwJiaKFKhaRaSzoZPJUBzEMmphekyt9xBBDQfKVXJYZEf4NO2BwnQkKLRI4NSd9mZopkHSS0cuO+VD10A4hJqQbqcYm/5ZG+Zcqp/cDKwhtjPh4/5THifAdb3MGYZZCPkPRGJRPN74dgExFSe4/uJebybpImTXNZ9zxpumzQRe/K7O9WolFgm96+Msk4soQlTVRj5J8ztdgiF0LB8XtJsKiT5Qk/Hf6wii3Y4JpE77n/QcJNM4r36mmggwEke9Leb3Kvh+dSCqBpRes6HhcjvaqxjmS7BtucjMsvtgCFDQ2Fmo5IpZwEPAg/7mv3NbYy0HjtCp0CsmG+R+mGsQJuGKdnK+avVSKcJSti0Oe8NvzXvdd5+BLluP8ztXt2LE6/xPN2MjVb6ydKw9aYz9/F1/iK4gIcoCs1O4FDdBy2RzclvwwxlmsM2Eb86XJwweOgW+bh2/PmgTVPG0+Rwojk3X+VU1fiW2COzy5QhsxVd1fH/OZ8ZzDaez3ngABpexRbqi+naiA481cSi5AiqcZPtIN6OItq7oBzGlfT/V2T7WR5fnqK9/pCsgrx7K71R6xNo5y7N9dEc6DWjSvz22ZzCITL02yS+qJxF5Ik2rPa0IsgiSmLS+4TMBIiEfkidLuwACaDCzvYd/K977/3NtYXvi/ftPKUr8l9st4R3V6l6FKRnxMMFRvLY08xXFjS8+kJ9YFZjEsnvhOELlhUnKUmLNq124vosFyNgpJyam9CdmTEa6TgvevsC8rd31E3oINwx0g07taboHozvU/C4HX23wvUghSmlEzQ63RoNrVQFsTVFKUcmKHB1L1Cq2wWplU7+rQdYYd4qzJeifI+lPob5R80lIdJa6YEoGR1GS/KVpY99iC9jXIDfN0GwX2nPNdj/8X4Q2Bvjy+4C3tkvjp44ljZLnmV9xBjsX81VU4/J8OxcxjW3CMTL2jwdGhWweLvbJbGSQMijFrvouAli1LOopvbMATd80iKZnm4X5qAfkAGjtK7DcqXlwVOPy+KaB2ExYyEOHeWNw2QYf5LrLrdoVpeP31fNj0M5QGr6JMc27Fnl77CRzwvngGk7hGXL6L73czmwAWY5ht4ErLKg5dJHt9VWzkTea+RBt6oT6woOIkF1x8s+2miG0eu9eiqc+lPrBM799vbAjvJmpgum9scuqXTNz3svuEUR+Oa1PrGk9qnFA99OfpGpEjRfc4B/jfxdJ2oHHiW2Q1UDIM9px0LXOuC9KbVHF563QgUPitZy+WH+tCB+KGO7Ou1Ds//goa986+sgk4OgGf6tOgsC4zrnjGxFciZKQp3uzOR6B4VlDFLrY5BS0gHgcSfFTTmBO1Sr3QvWZTBvhJ9AjTtiE58DufnpxZQqINcVpZUYp4gGQOLw8+qcR0ghR9oWk4syPfFoDnZH8z9pafGqjeVW1ZIgziUqio7EW4w7u/sl3Ta7IT8QQkneaX3ApGccEg/1ZxgACLuh5s26itSffJgNFzjF21UnxP8EPTd788rIl/y2G1Oim7DSlBxab/p/BPd/feFT+QAUqictmquQDZn+xtF/MNDUDv7dbOyn6uJEuzBzQjvUp+UuRdutXY7x0C3RyR2je9QSh+oyuRmdz982sKJKsPnZ9gLZOkGxD5YlhVWexJaMd9vwuxqG0ZHCPZZn4iO0TUHqKxUfzYtG+U4pGfxfxa9DSXyen1/HTmrJoyJrXEQo/yWsIIWOgUe2zr4k51xQNWxB9DhTQbwmZMfM43bYn+UwCbOhg3neMrHaZFxjeawgW3x+kvo8jetzvvNHwS9IrY1rXD4haZ4LCh5glo3nbTz19wv8K9qJz3Y3Z5Z0uiojuDBWP72e/HEst5wgroo6hrm4hrSO6aW+sHaIuxYX64+PpWkA4EsTY6eWxyGAA9+gmFiBcUy2sShD/1uf9bgiu7aAgQ+ZhzxYibQ8l9D8vW9CzogxIbMW27JbzuuUmWMXnp+1bwJDuWGGr9/PM4u+2hglvDgoIGFvcal/eS0U+c6LGC3viFyDnlFIEAbnQOmrw+NBOpaV2Yv7Y2NiJNHj0vPP9chcEs/E4qLdhHOC4WROsAe5rqmn3Jii9xaGUNg4Kyqw9xBJMHl8tied/gBPWpIzEW8jNzNshUMN25bk3zL71syeanzKW5qzU5jNJYUSQ6HrBhUgvQmbcMWYJtA8SGLqr9PEZvWPu1r9nOlYOEFrChVs2+iztD1NlAzGnX2sZ0Lmfl/oTQ0q89j99l32i4VQhjCkb2cNEwodos2rFqilJnyRNrBv1az5MqR+mGq4SrXA06f6gTR0GPDQaYVdj6dPcRGtr41oRXdGr2iwfeI9tyhxOzKkVfEf2rWS6yQxarDk+WCAKxS+m6/ZlcYuWl1TYbipDQxCWq8RtQiXfaMpbhMIEqYOIhh912CY30vDfoBBpUifcY7nGUAUjfUmzr4gS1vdip7NpPq7Ao/ej7oXsNAciEs5XDFAVwkoA6ffIxL+p/rAxN0QlzKDh2oZvzG74TNQ3G2+o99qcFHHjurEN5T3nMcbX6djZiwqkzvqpXHfc/fjh5EWRp1izBbjAUoyOsbIpjHMXDxaM3KyVX2BmoM6lL44sOzLRChzGtXesuErB+1LBPa2Fnq85kj7fpXkOR0onKY7u0VBYzyXT4tqWiUBitgodq7LwbhkRE2kKCdiMDtx0+1iDRprZOsLsZWVCsxDz1yhnxAFj3XR+wH8vi8rcMgIc7DwM5ukWhV6uoELsWdcJu6GyI+zRs0y9x7eWvunAGu2HwpblIi2imVrzUDjDlGvA5MOAg+hUMGO3J+aUJrk3L0pudmNGbaM5ctearSbr5Zz2JFPc8LYJwwRcF0j56bKRZmy6k7ryF3s12NC4fj7uJM2/MGj93SAfeLBV+ydy6+XyPhBL/a0ooBzB112KdCuuqRV/kb2utRHRmsURT0wiF5rQp5F+ZkpBcd3gzk5mrfNT26WTgdmuN7gVZdKqxolzaHQBnBd8y7dhA1Jl/3UBQhwkBGmrsFeebPhIwlHEUhb/AKCZba/aaEwUhU116zOfumiI+lzDQt7M3wajrLk0v2dFBD7vu7SuX7WZt22SGgImCBc0G8osezJO9EVftn/zm8LkaaGilijONI3nzJMyzSHBXNvyd3zHqYBK/S7jxKRnLotZ0bjAxLkfFVwZcPRQCmkNVK8HdqQ3N1P0ktacGIeJ1lH0eIQJhu3tIpoINyO8+5NZbszkXDgKrBwov6xhKSxbJlAsEX/VBwYMdYL3K5Tdux4W6LWPfpBw/n0pocUe3Ubv4hZObvaH2XEpYTuLzZNaVt3iYq4Pyjnw41sojJae81DtB0C3f5CkAY20uD8I3HlBy/EyklJHyTCJRW78JIih80YLYwrt7kbY9r6MkbePjmEeaDBUowqxRTLufnsWyw1i20nZ6tZmOAMnjwKxQxL1G1sFimjtTsPua6i6sxTJqybXZ5+a8jUO8ut2jxiIgh+vuTiWnjaNgW6r9I4FYJw0Nya8BIqXCy5EfZEUVFap3y2+kmyC6XvXPhss8slpRVpfYG7ADf+0JHVYIiHH8yXWQIhl5GrdkaVtRulhn50aUKUXAi68ygrmD0TZp07p4fv6kf72d5g46Qqql8J+RQnv8RVZCIv1cghD6ItphWhD+dWU2xkg/KH68Rs0I2nvDRvW7KA42UB2zOUov+tP3PCM22Cg4+fk4kKWc9XzxoMilW1+e2mDwG8HHg1e3TWsLYbVLBtV1cpc3sb405072RVWErQH4te+RXl1Gn4dVdM5zR+blZdcwx5SObiMv8fos/h/AXY7LqX9khr5G/IWBrto8je4qZqeOwwlio9bBTdO95M396PGssKhHVpypLz1U5167Ww3wC0mvTrXNNpGYW+YMAEBwtDndvwyPFLNbGPgwVXOHkpvq+Kgja179eCC0w7DZZ461CDfLu71xc1VIChgXKm3uwm7Qw/j47JKNKUI8TTr/6qsEG/F5GfHnjgTIsDOm/GvxtT+GagucKm/jWcFGwMLa+FDVLN2OVpm1t6YtFV+YRJx09OLwGFJ6BNcKwLvuk7uOcRFjqlwOZryC/eNE3lhAMv0I1Dr7WDRKk2kvHaj27lyQ2dhjNTK8d8ifiDtf65KF0bo2LOfc6Q+NKXmhuplgaCCIb/chZF+Xsp6iF7w8Jp8XqQQZfhTAJy6amLUprN0499i47YVdqbQ6JDNCmwKnnuW9mw1YPDyBBJ1XKXea3Ce9+6K638/iLi9Usw+50vWxoFFGCGq4aVuvs0qK+kGywUkMLe0VM9xGrn6WhDJnSHuIBNQgUaCj3Yv2lsstHEpg1V3trMtiBk9P/Vs2uq9zsGMJ0Iecjt+ZZXFCk+aw4/vx8effPlAzfZoVhkDojbpR1xfYy0H+jBEjjcT5YZ7xsvSSIbziNki1psg/5dkVQV7tGgBm3jzt6KD//KBbXNnd0ms83Ne2fHdIba1HVyrBBhANc5lwU9IMLprkeonv+0Bkfoq8+2Znke6ZaeEjDUv3WRARPhfJCkyzCVRKjAAJF0Q3/WlFGLU6Rrk1sNS/qzDFjoDJECJydKqJy8FtT0gvbHSw1xTzxsGxB9OUG/rBXp7iogX5s1H4ye+1xeTt+XUtYsf9YJClnhCmHrKXIhvglrepnR3cM7LrWvr3nNU2lAK4tbLnx6QtYmRrGzmxErE777/CPFLQN5GCwb833Yyu92Ggcqtu0n0bFD0nvpqPR0QfkUSisGRpG7UnwmH68Iiou46HHbVPmIEr2+EjcfJpNf4DUyUp8RP37ySn8Y3YYFRiOEcYDlLaCU1OsAYITCkCyUMiNRoteFzclnOmVZHiuA4VjFj6wvZqOG/PrDUWYq3tLvqAAwBGmc3hP7wJW5vxKO8eRjDIyw9hSdgpaM7qVg1BlHnJgMLOekmGe/Yd7LpIqa/vH2v9b/N4oR4jlSKnankkUZKfZGxH3sxAlA5SQtpfRJaYRIIOwzQxlfpuDSLjKzrg96oLhKVm4EvUy8G3ttUToJ6AWrdXwydwRyH2XPLBZL7HDu1y0ioSBA6l4KmJAsu2XXM+rJy/CiFmsDpHWLwaM/EM6rqEiGwqSc1W1d6NCyni7PAoN4BRg/mTVYmi1eRxL8FM4lAeruTNUqDPyeWurArkaniAzewRrHupGwGqjWILxVOA+3z3Xmraqd9J/I1GLcfhhwqlyRGcUGOWgkpDp/vz3QtotGvkEeW9jClbmqsgkV71XEhRDSpQVPQ+9JSHpUgAt3gfwspBY1Nw3Pe5IphUmHJLI2fruY5GMi0vvJxh0C0Bbz6Vxm4Lnz13LNGr6N9hfP4kcomKCQo2Cn+6axyPbl6ujTybA7jZCEUPeAU13z08cI/tjCmDCfrgNaXhZtl6vp9/+g9HgZ2IROlLLWwleZoDtrr8bW58lRUjYWq4FQooFSRVC/6+CfeM24JuTLZpbnNmAZHtw7aE7i1KcsOjK7JOWDGom+8/GM5sil0p+M6ROrVhPxvia+Tdq2LH83WBHq62TK0HYrqNL9majvTYveFB1NQDvEQlFVe9ZZi/PLNhEB/688KAoD5j/Rqvqo5YaFeeJTbIHiRPqY4pH0OtHKQynSK556bhBgBx03B8vVBj3rY2GIK+7qYm47JU9/59CYNVo61HcOI5Z0r82fSHMOS6xoxDvGmF+rQMjoeMBmpedvelezmM4y5VVEq1M8QFvaLuHyLaFQAGeAGZxtpvCNqkN9uByty+9qulnwWzbnCte0ZO+JRXfhQ2UaH6y7146GZq597NtyavrOEwS8Kh3wdFQguMFILlwMIRWu4n35ysU/4dYocsWDmgg7aERYt1e7SrPNcaobQJQH4ryjZLoE6zICI1LfCqSFuluvfBOsEaCznBgSPXdoPY3sJfS4IWWxn88yeQMU2l62nKJZFXEO6oqRmKvjLROQ4Y1jSQDQ8gLEGKahqQrHO6etXNsHQboBcjI6uSKxKft2kdJTMvmn3L4Vq0LLHb+r14xV2N2rpxx1mf13qyRvxtE7o4OxOTOYaqXwPRHLsPsTGVVu/cV+TWKEzhCZkFBV/gtvQiGc11zT6PwKBqYgmLuo1cwamzh83DcyTRcG4p+JVGH3xQdh3e5C0O9PWNmaxEwP4amfYrCzVaqczEBEfa4+DmLnFUo+AbkaMcczAvrVbfEugwRfC7SOoL+QdgHB7/nEOcx+T6FE0Ja/HDS1W2o6lMIyr6SzMhVWtppwEiv0n5E9evhI0CffX16REmYzBvBuM1XoMpd8/QM+KLDGE6E1+oYUQxZypd72gsbql2ERcM5lRwCLLoC6Uv1a8xkAq39FsYBlyWWewuVKTaV/7uEDpItFSvN4ExC0ivxsSiTvDopIfsR6dpOLh4BzcOKY0orVQ9xkcpxoTMf2sHJcARWxJO80kys9FMm5tBBtfakzM9dbwFbLbL1MiK6Dbq4aUMJ4B0E8cNbC/88a+qVXh23790umaFD9Ts9Vs8siamcYalSFHESPuQjiRDOk0anePIGH0Ktnk2RodfE9cUz0kvvXoEY9PLDJOHHsfeujcB9i6ncwCb8Ae76Kt01P22k+3micSEHxBznPFpLBAm3XKo9ETrJYrE1MpU3rNkJGeE0UHw1IkqesWoAIK2XlPaLcI4QqaRL3aaqPDmNoCM8/U53pAlo5TRaeaza1KW7mjqTQQx855hk3OjPBtV5Q6EFrz2yOmZHjdDCbtRizklSqO6HDwXwV1a4hH6DG6VggWRyaWJpju/X2Eao7dHbbL1E0SnEC3bGt87Vw58T4t51lRW5jOOUKyY+uW8y6a7nmJNyEzxwK+Tk6Gli5QCuhtZHyMFWnecf50IVlcvTZ/uIFXFyTYnulkATouLIqqnJN1AQHuX7+pA2+mBc8pKXuT2miieQ2Y6EYRYdgU925m4AuUgLqcA2e1p9h6/HALExstsliMvsANo0qhLQijHf5ADL4X8KErZxX5mH5oTwzB9UN4fH5pBe6hKv2+lxIb/0hvJ1RBpbtDv3AjLES/bMZF5vyZgycvj/H80G9PceOb2zQz+ZCf71BTq1qXrcW8qDOGYWvOI3Z2yYaUVz+2PrQfuBfyLTxxB7Ftx4cBt2PiUCcK5wrnQOYDUS8udw6VEDiwkUtNh6eLW6O4DQZav1wG9R0k4KeclHtH9ad3i0Y6R8AnYPbcSTkHkqcuyFFWpfGCJL2FzQ3bSYrg8MhHiqBgK3eofu+MiVJlYwE4GeATcidWMI8Eta5vZd9ANvEXbQsUOliVQhU7fb6FdaR0zdnJShAYmmC0ohzZq5V9iYzMGe9NG7cSmedc8UFAh19sehc4WDBdjxt2T7TUtUsO/mfAwNnAvdHmZJ/CPax98QCheInn5y1PFkrm5iDrJprjDv0LerCd7cUBd2bDjGLoLLyIApfUbO3C1WHa9urj+lS3cdgBzIG68CCDI0//W39U4X+T8H/MSRscylNcAbr0Z41FRqB0fdVLo4Q713Jd9tix0LhU577nEkoQoY5lZGtLVEt6UnLBr/DRaIhyGzx75BzLrA1yjJQVWtS0qpFHbz9E+tdpoJ2s5guIUB/th5g8ZBn0A6ZGGemiwrAyQJ+2Nyc8ruvnPVkzjqoksW4l3AALs5ZULykLvkDL4TLseCICIeC5oUWj36UFPxuBSzJwRRnP3Xik0Ve5f09k/bDjIq7fiwh0mjYbDz/7/CP5g3NEYD49sUVP10VgBERrqT+69v/v/XU5uxqt0qjJeE/cgJ6wJ/+8OQKnOMYbe9FxOIZ9qPGYRe5SuqAHbh8371qxD9z3EFEutMceWXpa0ff817NoWxSNRx00cfEEq+PLONAO83b01shbFmJ8HuM0T9i67h5WocKyomLRZ3G3IPrd5dqK/MN6FHD65YkIZYvi1TwDK9s4IY5BiNPqjlS8jyI9gVjDrXZVDppsW5VTBRR1PvPaTeqUwJJq+62R9ETRRJejcMguNtlbII+OLluAJDLkE4Cte8c+PifgfVyIdgqwroxYt6egKgWgO6qlJy4ltnz4Fon0j3cPGX8wTnwnqwJM+DAvBcokOFoWCsDE6WgM1p3RR2WV3VdSeNzTNOfb3a/dfL7s/RBIn0ccIZcFxA/4WwL3j/OjJ+iQ/4qgp59ZHAuupSykLUjAkdLTnotqNwW1n1Dx8eG9tD8d+BCZAyeyfitCzH/dmjeDYnUSceTXyRkp1vPI90EUWopco4cp2RcsZ4GGySxFXFqZUUqTc1k+pbzlqB2lHcO/zPVx8AYsCsRDr3575xTvXJLOjzxe7hdjUSrowmTthULWYsxV7kQ6AYCCl/QoGifnqebFpmiaS0RWub4uKJq4FCvs2Hae4x/VdvB3y/NneHyel7xMzqdfAwTKx6CTmmuQllcHQBRGIKVNTY1E5z214Hc/POe+u2k46qQNpeugTMRfaTNukEy1/hVclIe/haMj7hMD9vzr5SgqCXj9dAd2mVtCrBvDBUl3yAN+ubkPWVR+r3uZAekasS4CZHLtJyMcb8INgWpf20Uk1EYz25gP6O6LWEfm11QrLfnSmfTGSLZXnQI9HH7C+8E8v5ZAdXYMQ7UOYDXeMnyu0v9fxVDo4nfbZM6X/0sE+4DLqaDF7qzftKN9WZonRIi8+j0tvL9EO28SV7G30I1c0GcJ/23f5/32jIOn7z0Ub/qBDxJdaPIOVJ0G+oviT/r7pjRph0XylCWHLPfKEdO1qoJQBA9WSS1aYc/STdxLQTHacl2WAMsRaYeTkPFscGmi8cSmVDvIevWrtuW7roAIc6hEN0JBOIs/Fp55/TEwGg7IC3DWa8Tnj36lHuJScO4TJbsweA2DrdIhoGKedG5cxZejIA3L/ERxO8ExppFNGabCvDNwc1EywRERwgpTU0DxKBrpmC8w1yzb7xTDIgjsAPb3nDtYqPZGubOhpgVDkSd5CkRr4fOwOaEvCyX/DpQiA3rw9rLRYd5Acwr/v6V6FXCmNbx8d6wyBdHqoS50kKwbwri+DjnztLyEPez9xU2prqzEGW7iqh3/IG6/7yCPLtqXWoCrbOmSu4gI4/weizBryYZ4S6rvx0MPbtg65swGU2q577peS1OOXpZhAfNtnnmgpyfsUNHJwEN+K5DDEhmKELelwxJxvwwzZCq6NZSwIcC+ie+f3YnsLzV9tVAsITARpNE/sWH582EgAhuNVIcwMqo4Cwmvnr8WqgCMpV4CTeTT3bgXycoNz7xsJ/OEZLoHH2UOW2DehR9f5h+GkT9JlS5Uzs2IctFhRTpS5DdIg3hGcehRYRpWisjb5lTPb70UhWGpkQptTTB2SGRqxswc+MqkapZpKuX/PlkWkOtMsaXPPpMOwR+mAsiACakIBQVwsH9WY88m2mUT3/w95hDHc5lpAbsDQZAbp4BWsLNuHBKt7OoKn0K/EjVEsiQrZimNK/XT63mWC/hCynz/akJaewbSRHCfJ3h6xQB0bMIB/4MhT9jYEGNnkxBa9Z/NeRQ4+7VqkG93ZSli1abUvgM3ZkWKNR+FCv2dGPNrVPKKAitSHm0adZVgRtnpAkUlmnJ1+ltcVfrgblJSIvcmGUYe/HdwW0D0ttTdsYV0b5E81vynQy3Y55FaFy8W6ELVitUm1pdmIym47ikb4pmdaFEaeEFKCq155kJcUZjiqemP1XcqVxeS+6W5Dfpr1FJHSAZ2dqjdhT7zc7GyIZDzk+yvAwHkpo9FAkR/7+okHg5FKOKnRpbD1j2P7KduPiQKbXecbrd0T+8aec+JNBo97kxjERfhua1RY9t3gIrVzvJYKFqA9B+hk9HS+ZBqtX9ne4+nUly/O4V0yzV5Br9t5i4Qt59tUmXuZiFFAJGlvZQzLBCbliZrg1WSDs8sCjMCfrA99u05170LH9CUzYr5Nw9Cx8wH/aGnb3rS38KN8zSxWaqk9R4yGJ5aj56fM3HKtAkstJWpbz9FK3GPnSdwaKbT6/fDDMbjUE+CRtmWorgy5uf8AXIP0HNAZXDg8K7HZS5LrdGrKRnqhAwBwJDLL07XDX+OURgGyswbMymVan2jEXgP3MS/SJvjTtIX05Tmaa2uI8W4EetaSqL8Rn3/FnZ+hFYD4lqNtFmQtBhjY1Rz3uAXLVObV4JU42UktuHVLZWFgulpmMbpIScppxmWZQI5l6f4O3VEjhuBBLcZR2Ob1mVpnOkYpPLljwQOjJd77ANiWPs+6/a0+AbK2uyi/jqmStA1idfGqh44G3Y8q4PEVMPFADcZyTf9NPxckVYMg2Vb0vaDlbz3td7QvaFXkWGUCQVsKaWR0ihsAJ+GYFZhAfAxWffg529PUGxSTU5Z7KAqZ6eYdcZ3a6X+55I7/xzS6ISqjDtrH93CC5eC43VUA0GiGli4nbhcitxruInRv89JoQKxc09g4oYBAJTe5osefBeZtV5foew5iITvN2cl3NQZVoU8gHL7rO1N2qMrHIsvTg28HqAWCO3w12JVz1oRBJuPLDm96Go7cL1An1hRUzpZW6K7A2rQe6cKjEk62ThbZt6GfZfsT2SqQc7u2A3oB5iJbbm6waNcgzrdiJVLJf9eX6mhYmPAOpmN/LpFHkZii1cDuVKvbXgAaJPH0zrfjEWiIkz4aAQysAZrCj2sLRXfKU8nT52sl0h0Rtt3N5VWXCoU1VcSx0dKuTz5viV3l6AGgbQejZiaChnGmrCLnmwnje40La0ZCamq3CGLsiu43C11jgEKd8qPY/LvJNso+thfOXWQrFY/hr8TDu7fiZEzXo8R9CHvgaJlxg9v4L+NKVUwZKkjnkQt6GnfOqnABZ632E0Cn+q/73xPxO+KO2syFHSjBr1DFtDXjnoBchNCuC76zzvPcBwmddZLV5XYQuN7tBHLid2ataYVig+xjqhMqnx07a824OTyZ8xPpnmIzb2qQu50aTS7KTFQg/5zlQMWsvi+ZBg3VaqrW8bR+mH2tzf+gbPNs0Fkmw0kI0xe1v+POt9pKr4EGkhpgJtLtUInu4ugd1XCTuhnM6G0byCsAx+Sd4IETnaMM+J+RFP6/Xy4nTPAwFJ45orSJLQo21fcd1XCTrUsBn6xmFO/1RCDc6n/wJTvg83x3snpCWvJzQt/Gj7e0PgNfdpBnG45k5hTTNRMTzohsRbNkSTkSJ4JjMmaccesreoOPdHv+VWlz027TC1h/TdS9vgyjC6/lphuhUzi7pVDE9G4iqsk/wTkULz6RFXOweWVIkujqWgKdc/edzOCrRvCkCeZza3IhxEV/eAVwYFnLlaboSrdUFGV8F6vtPkAFnayV7f8leUDcDq3I1mHYAt/zHKzfCRKfq/a0GbIjKXHap5bno7RtDGiXniyovAOrv6XERFhQO5MfwtAljA6YbjzWdT6GylBOaJmsL9YtbE8f34buaQ6GweGv5/ZN1kb9oqtuhtQNd4x2HFchjbvi7ECo/Vd+jkUJrgs7Mn6qy2YPRVh3Oeq/5nP1BNpfVdbJRvSiRf9IRE8NLxjNlxVLEDDw7aASwe6YffcdcOkA107ir5Oc0rjI+SNGntsJsSUu16AxXDJ0wWX/OHrXnQSip8umoJgqkyhol0wot85qfvHUBbx9IwkpVnuCBP5tI5wHtpURmNmLrz9pwNm5MWSJgrpvYMXATi+6JqD4Pf/ITLZFpUVDFHl7NGUpj1EU9pFQw4kWuI+b8y4IQSlzn1GJ9B6pPkwIZvWaHEcdzcUBWSbTgsDY41kNxQ1dt2YT0XsWJLb/dOjXxiT41bb1VwhHc7O/lVvciK4TrQb67DO6WLL/ndqCwBEqxvvFNGhlcfifOSnMyDI+gizzr1aohVEFWGsQPezfU+/8pjQb0KSGJXYPLMH/wUncTkbFkjDc/0qFrzOEWfkDiE0yyvde5oMUBUFdnCB7VoUDEu6goOC+fCH4bW0UKLkvMSAFKMGtwECiw7beSkz5nC6rRYGQHY7/yHK8cZOijJw9UMLnovX628DCLkGNYs69IkQ52Ey3QThUUX9Xki2aqTtCnIU1RBP+Goz/5jR55u2hazrN5tyNWEyShF8g6etzpRD/cVB50DPh8Wgb/pHblxGI1qWh7YKVa87q4ijiu3Z3m1XbtG2qAwifqsNjvLTWmFyBFXvn/v2BsHm5b3d9ZQHHfS3T2/sZ4WcCUEo9m3rwAz1zLregkk4CY79wP3IZH1Y502SUlDoE32u7flcgx0db0lgQYLGYP4kgsHqPY9Tn2hQYy/ftb9pLQd/2Gk1A9V1aBHJYa2YSiMhHe5qsfNo7F2L7bwCyfrH2nXbCIt6nlDl4Sy4Vb0awadE1niNLtnsfYcvwDCvKlqGL/NVw4B+vLygQbNTg6Fn+GBWogOm/IqCSmI1rCm9c+Iw9CtdV12hUrne1gAXmMOHUHdzQ82EGDVrI2vd0MydrkwebkT+D1brhaDT2BgiZB/q4zb+fboCuwNDGMatt7k6NAijtELChJz2qJgnCZVN+0T1uevhvafEOJQnXDUtiTYNlrS6rjorSQCXRv0EDEcfKaej2vdAkRnQPPw0xaJnkh4dspktrNOKVuP5IElQEkfB4WLavwo+9YgK6ciHgUKNa+VaZ9WhV+BxHFXVMxYmvoqsTGoOBwxHZ/OrN5Fv6bIFpklW1mvwH2EpmGSGRbisc99wZiD0mrRp7gDqmpz9l9lGc8Ubvcxn5ekLS+iLEUuyRVnUFRIC3BLmfCLPh1fZROfM6v2C8anGz9mtSkFp6aNvnKhl0dpwGfwprEayw3LgmN8iM42i5sNZi/L/EWm1Al105J1WRYJedvuLdbaUIfmbVIBo7OEpKUjIOx8R/FUgZXYHu6UUFyMbqc4/TuLq0AcMSz7A/BnkDcWvhAopt9xla4UyH6BK38q5a3gNrEvKwAJ4zmf0t3Fis6BB8YzKAzMp4Zoy1SW9L2j/OHHPEmhCjAwBncrSbAweNFRETSWoluERBAj6/U570WXcCcUbvy8Yty45yYhG/qvbb3wNLe0JltcocFVLashvRVZShlTzvbL+wC7eB/LW0Hb+lzE5DM6OGV/+530mwyxO6ZgQk2+25ARsBriOpyuVvOth5C0ig7HfQW5WOtBuMLFeCmphnVbFuS5+0NEK5RyF6DGMq1omUm7o+nNfcvvnRhPlGPZE1xRJohejCgU1ES6WmRb7Ig0YhLeMJn81Zs8cX1lF7217olA2FOCkMuaozo1PVaQ26oqXWe0kHeFS9HRnmwTVSriswNZK+r4eyQ67q2L7m9dy3EDCSvdP+IrNo06Rlxlyn7p6f0vFF3gNv+KDGRv2ojRPh7G+3MvvEYy4tJ/1xQXTq2P1IAmtPjbdDSi9SzCUsUF1yeKmpH3rvXS6lMS+b/Ink+VP5RmizWGiMNKSdr2ltg6n5woKHAw2RWYWlx9S8nzFx70G/T9qWzjEUYDwAgQb1hh0j0a/6DQ0MjBnccCwacAcOWlZNDwJuhnuI/6af8Lg1FmI2jd5iG5pi6rU+bjZClWObaGhDWWzBHMmvhEsmdO8v2lDvDBXlSUzjQsUlX5XHpLrQahX0knrdj8GUc+c6R8Hzv8MAA4viV/FPgF5TQSkBIT9c8MUvxgKwXgF9hOFl5VdF3kq8bfNFPzAStY7jk4Ot3GakcuzOkWexZCj7uUmdHRZwtUC5yR1MkCcPvKWLGPLC8HAN5N7Tg5ValFDO5d+zREjEWkaP1fAFas/p8JKz388EPsFIP502LjtQN9A8C/fyQkcdH4u305939cWrzECwXayzDjFP8CS2FQjAc1IbI68UDaNEZFTU594QrL78caiax8zPrKPPPnReLTyDnwFjOraegIZkzcb8Ge2NBhBSMVZyU3WX1/6PEOmCrQ8Ss63YcFMzhEnqiBWD/LrXdS77GJ1vt0fBfp05hcDCysTYNV/9p1ibydiwr2wmi9klmLGxy++tICJLrDcAobAY0BGyQIKKs+h82+8NRKUZdrO7FpHMJ92W+ljLAqAYIGVF/VdEc5QEHdt9wbDdhP+P3VA6abIMeOipzMhfQrGwtUF1Jcs6so/AKcktwii5ulTD1RjFV7Td/CjULRU6B7Ap7COlEGs7KvlPRYbEAjRZn2uVrqdQRKXF1sII/Imu1Ft/7bFOwsCzVxW1iW4pmpfJISorhIuOlx7Nk9lAOxT5N71q98kDYBcDaKZyM8yeNBiVWI0/CihqhgvSX7jqg6oeyqPLBbHq2LKw9IQSTQuxVdPsl43qax6iHD/RrfnvGlOv3wK2K3n4IlbGYP5QrX0YHYuV2fkHi5noXG5bpe2iM6/BDcYN1lIEyi+HjzhO2VD70UzEL8Vg2++ytpkVEIjKK743jJzJVYX/pucPgjh+psVam08Aq7vfaOmg6WHQrrwjv1ZcdP7iJkmKvoJHDRTRyDAir8lUludNHWz03+sL1em8N5VaJNnurJUjwOagATJyvSEi/mg48rX4lg9zAz4NrMAd8aiDFQh2PLRBtO0H0s9VufrR3JrHWn/gqAbPubRxJ7qGO3c5osZ0cxQC0/dzmKoSyDla7Hv42Uv+jrjwZXU5sgmnmvhBNgw6xp5ysI5qWvDJGhz11B1YsRE0lpGOmlwXacgY1WwE4zi+sZt1bGGGKT1I7EGayjkC8z5jgs2GHa5pbVubqlVNOdgw4rEcVG/Fhxm9+Ge6xlVpTu1DcZR7QBx2jrMQKzGuQrb7Tot3pdnMx6EGNNo6BUTuyJpM/6U3t8iNCXc7k90Xs4NDpxEI2GIlAjXaiIBm0TifRCNYws3DlIYuv9kbqMMKIUeVVN15GhL6c2IO8aee4llKej2+4o6Heevc757mINRGHt8P9773Phuz+5vQmcSNalalcHwpgiJkv1ASRgtTKEuq9VDh95gr2Wm/A+0TJxo3Ng39zxsFK/q3JNhv/wqw/6+r+rYv69za+K+nltJZ/2E7JRTmToQmKrzyj8tCq88oOZ0zClfmavS0LV4wEg9YN/SkU21u+jDTYjPQx+Z0H2Oky4nqABtb57Fqj2M6R/agtmi1B4tljC01gSdVjI/zGujKGs/K4hyr250FmNMMT4SGPQUUvhwvA5vw/QdUzzPwv/JwndLlMc3++1To2yqTkOIpv2XNoRYB0naRlBYFpEU5fz87DQZ5bRGL/C/8ntLnpi6nKpCzvHlqPHM7QdEfgEAjoIPQngk5vCoDuCwHkcg/5FlH0UdZL0Q7lrP7idTgPqowwi3m03dL5dSA2wSkG4J5ixTWRk/nxYXTpIGoRO+9TnPvtuAud/bWWzNJsF8dtK7moFlJRmY9UqxOLVXJe8YGdd9VCsoUIHOsi1GKCPCnuRa9Uw/96VCkENbtq+TeyfzlgBH2I76NBYtBHSAgvS9PUsCJE3/GHZBIG0sNrMB6G/DCmhd2MI7jVeIHEoQfTWREME+q7BWcdHGVlHU1h0yjByQIGWOCvBtJhV0tCQ0PNRsCnPi43zH/Mxk7tLSKjG+5VipjgLUq2Af6wf77RUcyqmuuVQ9yZ+lYwd5F1+JOlHyq4fR0ReX5TVaNX0z84RDRgUKWoygb/FlMhOtyhiax79kJFKr0wzSYlusfoq6HqifPwZ/YiA8+9qxq1eaB5xIivEHpKUCAQSztr7t8N3u8URW1TsPcx6+vVii59TPs+ULOJ4tsTqbDuNlU7C5j7ixDMnV7q87UGNFHpxmatzJeDpZlhX9EGn8gLibPgUYaVOjz4W5qBKUSFfZLTGUhDP2kqo27wTUlfJ3ugYJ7ixQjGI8XRkYbZv7zoobKIQOgh0G72kTfWFjlQUlu5WnD4OmkhIzXXmI4c9rRAqJat9XO4R8J43brDxwgllwqycHHuQniiYKfqOgZplbGND2M4cRdZcLC/dyxylIP2nszm0G4qgz4fQa4/f/P9lPxpxr4VKFHVv/8McKU/ovb39GQDQZL4Pto7AbxQ0dhVvgXE7o+jHdGLz909u42BgNI/h2Yge4P+JX1e/XxjL0m5Mv+tMAH7jAFIuWp+iQrg0OYXKh99wpU8ehXe3ke5XV0/hWSolW7RZ55sa6ThDNvZyP0w4FSUV5gxm/0oCR/hVYT6sB1Wu0bTwPXFr24EhcwWBriWXt5gQvCYjP2IcTlVxj7lprJknKjw7qlQ7JY5JiT+oGXSZGzHk+RHFoxnkudDTYRwsrhqIY0OZ+IFCwPEWzOXVKMPNmzhucxBYACsfTochF5WZGjX1UvM+0hqwfIqdYNMCA8sJN7/LGBxSscKwmcrCgdeDBcheeoOMPTbr8sUnvz5geMYQDfwkZzCd/tPyraEJQ5fBUJopGL6/WYJKO1fvvC+/4ktFCJpSRUXqKFl+6FNm03ctVpW027ScF+w3CdQIUyu5/P8q0cxYUcdG2yAhbvbJHeKbfgEBEq4tq4uH+VOwtfH8gZt/8JWyXnoxFwM1ZYDVsuV/EmWuIqCVM7XPD02Tv8q8IhdinB2Ok+SLwScR5JMzDaxCA16YQyJae50zrXnu2oBHWguqJDN9FRtNWC3s+yaMnI6Xab9FdHaRrWru8rBQF5jpCM+E8GVxAc1sewnX5oNPJidiAF2BK0egoFX/WskNLC57D5HglDC+zmn/8LjUNJf//t0CxbBXA1wJucMXRTPl4p3Sq+JFavp4wkl3t7rlrZYrEKRHkmbdXasz0y9xJoj+YQSxu6tm8fAp0to+6fWZ9Nk9B1iWdFs1aq0NsESkJw6CGyCKGy5m4zrpvmUE3kGRKo3+0f8G+1Kw5Wiqc2+rxSY0U89OKKJlhJB49OsMWFXadAlXWVK4xhONk5loZTh5tdNo3E/0aNpsCFcDMI+P6+6lL7zgzrf0n9x92xdVdo6CNtnGoz8kX4M1HiFFK5ICmlJ68O0akEQ687Kc5lWvsBL73/pAMGPKt2RWkzbvDSokK8uv3FfbKOfvWjGJBNA9eOM8y++2SXciZFciCc3NdJAgr3gcVNWFnFJa2JmxALrW7S+6dtEbhNlX1+E6AkP6gD9+sFQLYCfFt10646iuKtYanSnBkDUGn27koWiPxWrWgsIRPi9M4M06GC7jfMR73tyvrGdvmh4uLn4Q/y1duhy+aAyGtk+TAMjE8zPE6GVTy/UmOuSXZcnavegOsEF/O1FRIL/Oxklo8aYoTIZO8ZSo34B3vKMsafWGd242nLIbomixYlxuowpxaYrRV3P4ZMIV90pseHy+fwY9xAM5EuU6lJNV3JGu3JJL3dJZZPwFMFVg1iTwWx+D9kTwWFv0qQrRFa8GzK8frM5+sQUTp1SS6jF0pRA0Q0kXK2obG5J7QTRoapSXyhMYsk+FBFtb7RZ2BW8SX7PKH46LeTHoFArLx0IlqzErJ9LaRH93q8lIv8d4P2fGxuq596Bmz9gdaANlKTdEvWvcZG8Zh/cWod73iJkpJjrgdeMV0Y/KNYPS2k3aWgGY+fcls1kbW6aTUrC+ZS/r/MrYM0qBvF9QgaoNUjGiTBbEUZcyuh5J5dlUChpNUBozarcXGWDvmQtrYEx0Wpp0TBLQov8Gw98judAOpqNM73Sjf4ugAdM37hGN5XdeB1oOQf2qEvM5O0hIZXLa5yk7dmdrAXg71frcMEJmJaickfPZtERWyqI3d4HHOpD8SfTF0H3gkRUZo4G3NIKrQc9LWnzgjJFRzH4OEdCzucVGZdwQzAIcGLnGhy0BZ7DdwahEDe4jECrJ2JpRssy0mzIDtQ9O1Jyzgjdis0xnAzhXJze5v86ZegfeOHWKYsUh7V2CviHPGne02NhaSuMtTdrsxwKIO+GJYiEc/rT0aupougGVfv4RL5RCE/JONRQhIzycOgmkJcjsH8hJfeRmdVX8QOZrT2zqj2cTKwdqd1TpxJNq5ZgHOEYGm+PT7rWvGaihkUKfiE0ROclvKUqoNevik4GXuENBbtN05cQeJQA3bRG6qx0Vq1uy5/gAfpAJEqEf33SRdOwMGxG4Uy/FOdsusWaAFDM1JfPlpxcMKmTun/fQLuUMjKHfw9VwtnaV+qaXbJJFzlzA/7dma/a3ce3fuBSqDy1JVllcP3/dVm1Jp3saaPFqrCWtVJjbABBhJEqzLAqA4IsSrI7CpF88SHo9RJ7qkmA39HAbqzkhEQ7OCKL/u87uBiXQq3P3WkRLBJKMMhhl4gqThDF+Nxz2rJdtVxNeUTjvkxHHMrswl3RfstTcFRtyfg9mikawfpz8vb3W/HxFmO3AMNaYp59MLPG3S6xfMisq+4wOTcDAbznJ5qvuBpuRLBinYFM1dS9URHbZsx6G8gkbLwdD6cI7GyYRT0Udbqgn6+g68TAAFT+iZZiuqChzYkSfpf8vK6qvQNDtiFMZEKAuz3AjjdirRCWGk1V8rf3RJeqdi74iAIFbk+BAj7k/iZvSsyapuE4FFCBppTi/fr/0qRfRi7RhpnxkmuJUido6Sos9kylyMgfUVVHHu+NO+Zp27+W7CCvhZfXpC33OPO7WRBaiiMthOooZnZGXitc5I6JvRLO6LjhziphQ1Q89y6AEXsp9HDRmEdfK82M295ZguAiOQ3X9yM0SPhSEbpGxxmrfvFQIIoLTQi/fSffRU7ZtwOMDZkx/mAY3XJAMFwJmVtPxXxes6t0j6TmcDVOM0DRjteUQF/C+6pFY1aAeYEKSyA74p+/LUA3+sD0pTbSnL80dGqBHt3PycL1ywBVOd1bRsBGhKgbVTSjNByii79JustjlZ8FD5tpFU6Lg2FOv+JuPf0RwBN+O8A4owKw1KvLXaNo2wQXLS61H46GXUYukRVwbBtwH3jWWhi3iPfIh92Jp4F+xelDIYG+Dsk3smRBgyGBey5qDyC0xyI2WePmISlciZnCpRayTB9oB82sucK9iJ1FstnYJgxuTe1m55/apj+XiOKXxq0GHIyvIubHf7lc3BJGJQcFrP0mx+/SY7XI64HHqkAMIeVu8ze8Z7ahuw6Qfesnsjdqa1KvzNuUF40VxfIqmQemVWfw8kor67S/BNpEtwsZdGMw//R5jZ1Z3/AlXXgy5+mZKf96/MJjxMQlZ7TqLIJEJJ0YXsG2fWFCkK/A6eCPPo0MBt/Rdn6hpnUjHZupJxpkd0DPiFERd/dfrbZnMbuCBb8mk904azhbfkDQoY5R0fYupIS5ZEUWEjD/JSksNXgtq7T/Bg6rNRS5KbtkgoDWxrN/0kZg35TY/bZh8AMUC3H/BgkwOjxgkCQ1yk/d0yMoRvxyHO5Xyc30MY8LuA9lAMQ55ruRYQH6VxBZzDjbDjC2rQCo3a9Pzw4v37+ignGAYQ4ZCX0LCedSZzCVYIPNCOR5aVcWJxKgk5tTtSH62TrAHu5pmBcc8+FlxyOumqkQ4HPvTu1zyaV85x5gam2q6D80zP5hc2jncsdxrmF1vsRsSUcw2RtfHBM33Wki4UY8ltiNe2sbomphvlh0lo+KQ7MqqHn4NHMQUzg9wbrLPR9Y1Gw+YkaHAv16/MGbFRmJSUQx3zDb0fzZ1W2C8F526m+O4m5WHfc2hL1liqDfQdhspCXMxfN76FkPp1QWMriHYSTbq+KQ8pVfQEcVH5gAYyXgCDlokYsZA2/1ZJ1KNsnOS4yuNZ+h3Xfm+UFuzB5DRHylgwEahPPfAnPAjukUtvn2IoYgg7W3rmDd8KuoPjMM4YL8dYcD3PTSPD9eI5Yj1g0om8KfSwA4+4jkQ+lsALOYL61U8vXgSnGhCwfzi+t0OU0Jts6YUdKvqS0c4FyTPB5pGMKj/J6ghfQcu/KcwvtKiyPuxgHPn9nWm6x6KfabOYsbVGZqOpCVfcYGooBm+OYPFCIZD3C5pyfVntuWHvmyD8bgrIzrdSB8rkZRnfsJbPsWTqLj2mTF6e9r+QNSkVa3yi8Mth1UNKMeN6fW2gDbnvzW6c22goETubZoeXJdRBMoPyjM2+ExevfuqvURpOtbQy31NtDUHJcWOXVuvqJWaNMVoqAhvxEHTuwN/F1lDP3EN8sUx0ktW1H6glpZJXSvjOYZPKD/4R4hkK1RHDgm5fEkI1vLOjNd6pv8A1QAQ/XUnisbN6DwFkbJ6gA4X/xUpA/UDPYwt+SxUUaR01QCmMhnCe84UqWJDWFiUuXR3I7c7XUZnufMoRP9nD4IA9LeWHUk30tM8+XYo8r8l+vCjXO4s49hE1K3CZ0wj1cd22uYCqPFsJo9uzZWaaTDljzm04pnEHy6F8qXcjUJCTjfH3ld+6TYW9Cm9qff111pRqJKjkSYDAUKJe7i2eDMIDlc8h6hoG8bVyifCa/oyQTfdwwEcNOUoeBtKObh8d0tMplvHmd81vZerG+A/ThWvZ9rVf5/q70b4TAnlcOtZbiNH1FsAFjD2mFzY0KbYdNteehux2GKuYswztBdZ9Lki84id9LO/EueVvB31nsuv3CaFaL6Y3pL9QlJLMOGFQg5Du3Z/oHLZ/VmOqzH8Dr9OyPXbpBx4mf1r1E25kim6yzoppdZYp7HET1FlA4IbKAzateh8vdo4SO30HrnTbcBSNPC2cY7qnHqEXL6v7Gfb38/Yhl4yrQzTn/UR9aa4jdDqMWOqLa41aGKTub7TNTi+LZ/xlTmT0bqi8P/t9D9H3G5nd/eJVZ6nlBVLjccirQ1JZHeLOm/AJcHVtRCnJB4RY1SyMTnu+nNXP4/42BBsemEpdsbj//55xyXFYf5i71NyVfWyBo3ClKlQXdBlVLPQ7ZuTdXrfnTRLeRFxb7Q+5UOwlSlClEODuDJ6QaGMTD+WNKPMXV6ahO/OK6XAAzegznEkzZS/+/cHBop+ok2ZWdwPzb5l3RycADZ1O2p4NBDzDudkCWxv6S9IvyHlGYBNSIIXwDo3CwRlHP323bo23DnzbH7BuA6Bvs6Xbr0dbFRadqwhNzN896gyoH/4B66eMepRq15UBzI88tSGPDJHaGgeUEqb0TmqU7QnO3E0biqUw8YRl9s62iew8QAm+scitYdE505VKMrvAPbPzte98yNyaltbBGVreiK7iTd6VIWxyaqmXNATq0ox9GI8zOswAjPxy6qbLD1dSAqwzUJLEzN8YcGalRFXi0Wts9E66z1XopFCYYjILiJhgIf45regvUIVhF/2rIEgPj70bMwtsud2ZBD17d6T90O6x67hutPAhszso7e6DDumZVb8x07pB6PinNC74s+pR6JrWT6XShwbqDIX3UYW/lq5vPKXDPLpBGk27pRKLomKiUXWvpdI6VoNK5YNqzkX/LeBHLsTgy97ay7JRplpZERMGPiZnzrEOJw/vR2I0bxUrcc4s5mfqmsJm5KYibTsl04swnDfQw977VGrHpTY0zb+M2X6jlv6pPZ+9GNZl7eAKmvv1ZlGXqU07ZifHcwYTXDxlPrLbDHy1S6sxxyyhH2fgmsyjXwduQWmxGbwoPJaq8xQ6e3XujkLQ8qq2nBCHiQXjvEgRG7TYZIRUS9BxgrGTbyW6iTiK2JHkqdegHcOvqAuTfZ7JAuE16XxKBeh7Ib08eXwQY/nePDZ/sU08irqo8bgP6aY4Ey/WZFEXKVZOrhABhgLt+4xdruXDz8zIiCfovgACKw4MSzKthldGd3F6xLvL/cxxVmgzI/hxuY39oDOs4/J/tB1V7kzMoyhhyB+dpTxb/K22QiwOabvmJzWhddcFgItTcRw5A639wXLvZBxTwR+HbiYV5+JvEEO3eCr5n25KM8EBs6bdKntZ/6l8aBQy94pRNvTT6Z/rpAgUah4PT9/D4ci26Eb0qZbplLHysxuic+eYGQfU5AHGmS9kv4cxnipsH9esUcaA+wkHXAazux95WvuYs6ys/yCtX1OTEfnG7Vp2NoVtCohAZ6S00WQrp3gugS5E14cY4z5tNQTSo5KIUAE/0BjR7ZGPChYm7SL/iuSx9RzXxB4/9eHrFoG3V8+fa/oul4B+REAiuZJI+vKoVVBwEEJom3kdFt/m1SgAlucL4nJhaLw0Z7zLgVITqPdi8Fw2I4ZJTmc5TconnKCqVRPDQmX9kJ+UPWIASXrAL8VHK9T3wEsVq4rMbJq3YP8vkioH+y7/reIya1mTwTElH+cj6T4kubfo3JtfpVk3JOI51DfyQoaVlt9sdGPNZREkPZ4/q62bmtXfcToEuaDESHEamRHfJGbDzB//UW5aP+nChBTDeCqaoteYxyJmQTe4xmnJPbp7MuNabNQNi73P29C7RkHCxAf4jp43FVft9RIiq5QN5cS/dn8cVoPjYOddc1GGKRyznpUkvQ4kbQSkAIikBr9UpCaP21uCHLcJKBA2RJ4F9JcxBzJgnvf70E4HEmMBiCMIcFP7e2gA0qx78cnNN5dNmkv4w5woCYPyd7Hx+GW0g0s1zI+z80GTnkdLIfL3FdR4BCw5TxKb0oRBjDevux/KUNarTUo5zVDv00ofVXpkevmbo/gqcTpTTgkAkNLCmgn4GcN5gpVf9GpG9nSafcpA7kwlRSpBUe/qT+GGKSqaRlG70DqgGGbYRWS6xTTHjMBgakq/DDPQAK87nP19qpnXE2tpZj2eR/YoChB4Rdei83rGMnoSQrs+Bk6NyAtj29AXG67KwEiglm3HKrwU9GaV/UH/VkC+6PElry8TThFcznxxYEHtxfLyND/PjzbhpsPMhwWtnr+cx4iZSBmBOHkfo4fSsEcKx8C4kYusYEnePrtseHzsz7+GsoGtUWGUmFQ0IzDqKMkRz6YOdBfyPPId3pBj0p/2ygfqURGs3mkJp53RLxhpWVh0k5vQxlCEJnJGJWekF1aqDLu/499dgj6ZehOYi9eOHW39yGzZLWACUkl0p6pqP7FfBx140n3R/FwusIC18b141+DHo+n8C0/BQMrFc80yWSueH81qlgIBnFFiWgPWl/yfbNUIHxj2HhIjQfmXCFsqkFvpQh8CLNgYfBjTvMw1lZD0OJiAARmI+D5RR0loBnC0jRMaN80UWgAIKz9RjZtKxjFpWdtuHZ/sM7n3K6PKn59LmhqyO/0RXFC7ke9tx+SvEcKGTSKcGGE75DI+BuB1p5SPn41B40Vgiu/otD2kxdAnWat9eOYF3JH2Uyv9n2B+ZBGOqJPaHZaOZ8rK0b73N+dJrBFv2ejOVMpxxjqE7JYQ2T4ZubcWUeRvVmvORFeLmoLRMQf2kI7EORPJWaP+AHMpYwuVjl7nmjKKhXLhX10UkrhPqQ/sJgmPTG8AYTVgwYbE6I3kcSQvXw0icClUAD6dwYy7piYPPzx1548Aj21KY1OJNCR21gLN15PVYre3UOyxHCmUHr5UFRDbjlozEhrtUZG+Mfk1yo09GLIgvep8ryjDf7Redarta9C1KTv2eH+cdONSjZ6okCKoBc/JlMaFy/YpfIOOEu1t9rsQCNYwXrH3hFAMye/0ptvU+afMW/jQJpU5UIzJlDDS6Yyd3F6/koZYv5lLoD6ZSVgnrE6rx2AOFUmQ0RyQASDXkJyUERGXkCgSQeny8EgFkTVD9s+Q4yw9Bzwpvwce6kPqQCNsCbgAjHmMVz+OLebP1KtC0l7goUX4D1lMRSc4XjvVzLGstJ3trngKuInqAn0LGwwFVddKfCXs9D2RJP7cUiT9dH9b4e9bEZUSeIsadHPljWL0CDxgV4cjCLyRyrZmPMkIJhGdc1KgtMm02QgK1iDWAj6YGDcVLHNYebT7cY6Y7cyUqAf8ZNjZpksApy2olw0/aJKvMAHiwQi5xxz9o9pxNJZPf3gji8KOT15pdugjX+D1cbBhW+v2nCLaR5zIYkPEQA8mIajKgSFLWwfJoeOnOCI4Ag+VjjYL9vQQmNc7V345H2QklsmafAuULv84FtfUYkGZzulwFoJkO1GA5Ltu2t7hTbVGhWRVwfcODX7c9dekXXGL/S4V714eab8HFM5jX2WuVaLHAHO0Lbawf8WsOMZRAdWWKJJAB35nV/BT261ijiKjJZBUj9ey6wEhODyMcMZtZ7kTmZFXoiw4He92nEy/RcdId0SEsGw+z6tc6p0wG5N0/t6t0PtnEld2RRnBfwoFUZ8g471M8SA2tJ46hmK+OrijSuTByhueheoL60jqek0PiIebUV7+9MkvnubM5NgwyWZJuvUV2BQjJNE2K24wKC4LI3bFG4PL62BtmAUm8QBWnDCX4aWPlKgG23p1IIKJcgc7rQjVM7WQUavyzfmDV4+JW7owOILW4Sc0gR9+Jcq64viXnSZvkITl0YcMk3imFL4nYCjSgjC2o8KbBZ2Dd7Z7P5fKVfeJnN2Ce8d6yDL4Rsv2MycPIAIjQI7Jl+C7dENgLm3F9E/4zPZWHTMLz4Tf/Z2XEcm6weWwqUbxeT9xKLa0Sdy8KKj8ZYWOAGIO7rUT2XamV1SJIS8BX0ET1L1q4DUjGaHhamuDdogtG9i6Y+3U03IcOP+o/Ni6NPFGSizWCrGUJJtChZESkSu1QOrdwas2a65RH/8VMGAO9CP7oH/QOATPLTzjwERyXh4fER254Ub6wbVFQPsfGrcIloim9Hq4GK4Nq8hdsA1ttIxwTrC6l+veGMbQJzE5VWuqrLtZ/5dhlwch9KhaVWHjmAhrm9V0z97kwbCWBmha2mxgWqG9EjvbhDs0On76Kg+wfVbLyCcfLJgO7sSXKLFVhLWyZ+q/F4tKR1IzRIX0AmZit+6hO1SFTAFWXRv0CQKu6iNWjZhy0G/QALm/TSoe9Z4XQQ8Kjd6ohHgOxLoXMxvaHYQVk+0ULFcdYaCbUGF6kxaxoJ0Y3Wm/IW6XEfMPRPaX7lPycKQIygdMtr69tC/HK7ekO829kVXHIB8kCyaGGOkegkCoRwDY7+6/UCEWi1IxF2sYUcLco593OoVQuTeHGXPASIKOzvlvEV0bNgAOkEm9ROv3P18rIJdmBJVGSgdhrKdHqUdeQyPqusvhcfuj0ecxUNbwgEinKdFCw3biPcbYPVQVgYGakrC6ACearhl6nA8GmAAALi+NEr8Y9NZinIvrnI8C5ezkcflZASr7hBTOFRGIju/0JvcJQTgv4jE5mawm50UoUVFnaeTHqvw1Pe/tBC8eDMDPMcKKQx3bawajL8VFYTq00mx9GaJqczp4ceyYt7C+j9xMvao3uxfBmpeWaCNkUdT2TFQrTNWT+wWgkVttH/QH3x+AMpZ3qPbMybHe5Vu2mIUGhmyyIKESkhsEbwrUxzkcCx3o7xyZZW9TNhA6FDZvlW0GnU5z6lIeLIU8Nw4wkQ1iS+yjL86y23x1zGnqAh0Lw4Bz+/t5FYtHQSvsf9LhlGcn24aHBjHGzaQIdqIAAx7/BI4cWq/AxQN/PFKmhGWLZYyEi4zK1H6YUrwKShUScsS3UUKIexmZz4SLqb9S+nq8GE/yawshWnOMqCaEvkcIHgWCUeI2I1ID/1hmmpxy5+gdjfqnoJ2wxJvXRw/h5Jpx3aPstDNyeHtKCLcgrN2UVNvul9+kFLMvhHXjNTuNH7OVn5A2I5uTT0RLKDCvAHeE9Zprd/xSZI+vwtetoDUHytE0leXpJZKFQQgwJYB3KR/lqYXZxw5RVZKcTT0FZuHS7Qf/B2i2FaN7MPxGdwum4CT/KexSxRuygHruqJv8pzRYf/EPhDY+nWujIsi9cEeuQt4Jk4VUjzWOjW6mxjIFCXZHpITJph8zCMu1ABXc3umaCfUgXxLrQUpH5X1ISyJ8pR9+/z/wzzDycD0VvI2EMsY3AGNkIGJ9QmYbYT+8CuDLy2SIJUyyVI0aRAQo73mBAAIoRWPI6HG/cQQZr1kRoaYpl1ygD8vkG80smttFfvVq8vgCLY5YUPsWZT26sRyyDJ4SzqYAN0mNB6OrtOr2q+5LnhFdTvAp/IfQ+OsUactq7CaKYnA0yeGeTSOKBpujG/Ig9E/rxqsDPi/P7Rk0cG0pjO1IA31rbmAk63gS9plNsB5bSjxgjeRvPaCHuildsm7KZRNW6eKNp/oGIA68bWAsuvefCV2G4HRg0kWd0DjqVtMylS+L1yfXqAiV4+kPoHDZn7tvFFtvdgg1/7ADH6v1cjDZUI/1Y6NXSAdp4T54ZJ7O4xetGp3IsWm6QqpeQ4HD9vdCzn3cSgg1grwAAAAAAAA=";
const MERCATO_CARD_IMG = "data:image/webp;base64,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";
const PLUG_CARD_IMG = "data:image/webp;base64,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";
const DB = buildPontDB();

// ── DAILY CHALLENGE ──
function getDailyPlayer() {
  const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
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
    @keyframes goatCrash{
      0%{transform:translateY(-900px) scale(2.5) rotate(-15deg);opacity:0;}
      60%{transform:translateY(18px) scale(1.1) rotate(3deg);opacity:1;}
      72%{transform:translateY(-8px) scale(0.95) rotate(-2deg);}
      80%{transform:translateY(10px) scale(1.05) rotate(1deg);}
      88%{transform:translateY(-4px) scale(0.98) rotate(-1deg);}
      100%{transform:translateY(0px) scale(1) rotate(0deg);opacity:1;}
    }
    @keyframes crackAppear{0%{opacity:0;transform:scale(0)}60%{opacity:0}65%{opacity:1;transform:scale(1.3)}100%{opacity:1;transform:scale(1)}}
    @keyframes shockwave{0%{transform:scale(0);opacity:.8}100%{transform:scale(3);opacity:0}}
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
  // Favicon dynamique
const favLink = document.querySelector("link[rel*='icon']") || document.createElement('link');
favLink.type = 'image/png'; favLink.rel = 'icon';
favLink.href = 'data:image/png;base64,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';
document.head.appendChild(favLink);
document.title = 'GOAT FC';
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
      return d.date === (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
    } catch { return false; }
  });
  const [dailyAbandoned, setDailyAbandoned] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("bb_daily_result")||"{}");
      return d.date === (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })() && d.abandoned === true;
    } catch { return false; }
  });
  const [dailyTries, setDailyTries] = useState(0);
  const [dailyGuess, setDailyGuess] = useState("");
  const [dailyFlash, setDailyFlash] = useState(null);
  const [dailySuccess, setDailySuccess] = useState(false);
  const [showDailyGame, setShowDailyGame] = useState(false);
  const [dayStreak, setDayStreak] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("bb_day_streak")||"{}");
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
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
    if (clean.length < 3) { setPseudoMsg("❌ Minimum 3 caractères"); return; }
    if (clean.length > 16) { setPseudoMsg("❌ Maximum 16 caractères"); return; }
    if (/\s/.test(clean)) { setPseudoMsg("❌ Pas d'espaces"); return; }
    if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) { setPseudoMsg("❌ Lettres, chiffres, _ et - uniquement"); return; }
    if (/^[_\-]/.test(clean) || /[_\-]$/.test(clean)) { setPseudoMsg("❌ Ne peut pas commencer ou finir par _ ou -"); return; }
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
      const removed = JSON.parse(localStorage.getItem("bb_removed_friends") || "[]");
      const names = JSON.parse(localStorage.getItem("bb_friend_names") || "{}");
      let ids = [];

      // Source principale : Supabase (demandes acceptées dans les deux sens)
      const [accepted, received] = await Promise.all([
        sbFetch("bb_friend_requests?from_id=eq."+playerId+"&status=eq.accepted&select=to_id,to_name"),
        sbFetch("bb_friend_requests?to_id=eq."+playerId+"&status=eq.accepted&select=from_id,from_name")
      ]);

      if (Array.isArray(accepted)) {
        accepted.forEach(function(r) {
          if (!ids.includes(r.to_id) && !removed.includes(r.to_id)) {
            ids.push(r.to_id);
            if (r.to_name) names[r.to_id] = r.to_name;
          }
        });
      }
      if (Array.isArray(received)) {
        received.forEach(function(r) {
          if (!ids.includes(r.from_id) && !removed.includes(r.from_id)) {
            ids.push(r.from_id);
            if (r.from_name) names[r.from_id] = r.from_name;
          }
        });
      }

      localStorage.setItem("bb_friend_names", JSON.stringify(names));
      localStorage.setItem("bb_friends", JSON.stringify(ids));
      setFriendsList(ids);
      return ids;
    } catch {
      // Fallback localStorage si Supabase inaccessible
      try {
        const stored = JSON.parse(localStorage.getItem("bb_friends") || "[]");
        setFriendsList(stored);
        return stored;
      } catch { return []; }
    }
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
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
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
    const normalize = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
    const guess = normalize(dailyGuess);
    const answer = normalize(dailyPlayer.name);
    const newTries = dailyTries + 1;
    setDailyTries(newTries);
    const answerParts = answer.split(" ");
    const isCorrect = guess === answer
      || answerParts.some(function(p){ return p.length > 3 && guess === p; })
      || (answer.includes(guess) && guess.length > 4);
    if (isCorrect) {
      setDailySuccess(true);
      setDailyFlash("ok");
      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
      try {
        localStorage.setItem("bb_daily_result", JSON.stringify({date:today, abandoned:false, tries:newTries}));
        localStorage.setItem("bb_daily_tries", String(newTries));
      } catch{}
      setTimeout(function(){
        setShowDailyGame(false);
        setDailyDone(true);
        setDailyAbandoned(false);
        setDailySuccess(false);
        updateDayStreak();
      }, 3000);
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
    // Marquer les instructions comme vues directement
    seenInstructions.current.add(mode);
    try{localStorage.setItem("bb_seen",JSON.stringify([...seenInstructions.current]));}catch{}
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
            const s = getCurrentSeason();
            const msLeft = s.end - new Date();
            const daysLeft = Math.max(0, Math.floor(msLeft / 86400000));
            const hoursLeft = Math.max(0, Math.floor((msLeft % 86400000) / 3600000));
            return (
              <div style={{marginBottom:8,padding:"10px 14px",background:"rgba(255,214,0,.08)",borderRadius:14,border:"1px solid rgba(255,214,0,.2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,fontWeight:800,color:G.gold,letterSpacing:1}}>🏆 SAISON {s.num}</div>
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
                {hallOfFame.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0",fontSize:14}}>Pas encore de champion — la première saison est en cours !</div>}
                {hallOfFame.map(function(s, i){
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
      <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000"}} key="splash">
        {/* Image plein écran */}
        <img src={SPLASH_IMG} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block"}}/>
        {/* Barre de chargement */}
        <div style={{position:"absolute",bottom:55,left:"50%",transform:"translateX(-50%)",width:120}}>
          <div style={{height:3,background:"rgba(255,255,255,.15)",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#00E676",borderRadius:2,animation:"splashLoad 2.2s ease forwards"}}/>
          </div>
        </div>
      </div>
    );
  }

  const pseudoModal = pseudoScreen ? (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"calc(100% - 40px)",maxWidth:360,background:"rgba(10,20,10,.97)",borderRadius:28,padding:"32px 24px",border:"1px solid rgba(255,255,255,.1)",position:"relative"}}>
        {/* Bouton fermer — seulement si pas obligatoire */}
        {!playerName && <button onClick={function(){setPseudoScreen(false);}} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:30,height:30,color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontFamily:G.heading,fontSize:52,color:G.white,lineHeight:.9}}>GOAT<span style={{color:G.accent}}>FC</span></div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:8,letterSpacing:2}}>{playerName?"CHANGER TON PSEUDO":"CHOISIS TON PSEUDO"}</div>
        </div>
        <input
          value={pseudoInput}
          onChange={function(e){setPseudoInput(e.target.value.replace(/\s/g,""));setPseudoMsg("");}}
          onKeyDown={function(e){if(e.key==="Enter")checkAndSavePseudo(pseudoInput);}}
          placeholder="Ton pseudo unique..."
          maxLength={16}
          autoFocus
          style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.15)",borderRadius:14,padding:"14px 16px",fontFamily:G.font,fontSize:17,color:G.white,outline:"none",boxSizing:"border-box",marginBottom:8,textAlign:"center"}}
        />
        {pseudoMsg && <div style={{fontSize:13,fontWeight:700,color:pseudoMsg.startsWith("❌")?"#FF3D57":"#00E676",marginBottom:8,textAlign:"center"}}>{pseudoMsg}</div>}
        <div style={{fontSize:11,color:"rgba(255,255,255,.2)",marginBottom:16,textAlign:"center"}}>3–16 caractères · lettres, chiffres, _ et - · pas d'espaces</div>
        <button
          onClick={function(){checkAndSavePseudo(pseudoInput);}}
          disabled={pseudoChecking||pseudoInput.trim().length<3}
          style={{width:"100%",padding:"15px",background:pseudoInput.trim().length>=3?G.accent:"rgba(255,255,255,.08)",color:pseudoInput.trim().length>=3?"#000":"rgba(255,255,255,.3)",border:"none",borderRadius:50,cursor:pseudoInput.trim().length>=3?"pointer":"not-allowed",fontFamily:G.font,fontSize:15,fontWeight:800}}
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
            <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontFamily:G.heading,fontSize:"clamp(52px,13vw,80px)",lineHeight:.9,letterSpacing:2,color:G.white}}>GOAT<span style={{color:G.accent}}>FC</span></div>
            </div>
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
              boxShadow:"0 8px 24px rgba(0,0,0,.5)",display:"flex",flexDirection:"column"}}
          >
            {/* Image en fond, rogne le haut pour garder le visuel principal */}
            <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:22,background:"#000"}}>
              <img src={PLUG_CARD_IMG} style={{position:"absolute",width:"100%",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:"30%",background:"linear-gradient(to top, rgba(0,0,0,.95) 0%, transparent 100%)"}}/>
            </div>
            {/* Record */}
            {record && <div style={{position:"absolute",top:10,left:12,display:"flex",alignItems:"center",gap:4,zIndex:2}}>
              <span style={{fontSize:12,color:G.gold}}>🏆</span>
              <span style={{fontFamily:G.heading,fontSize:15,color:G.gold}}>{record.score} pts</span>
            </div>}
            {/* Bouton jouer */}
            <div style={{position:"absolute",bottom:12,left:12,right:12,zIndex:2,background:G.accent,borderRadius:50,padding:"11px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:14,textAlign:"center"}}>▶ Jouer</div>
          </div>

          {/* ── Carte THE MERCATO ── */}
          <div
            onClick={function(){setGameConfigModal("chaine");}}
            style={{flex:1,borderRadius:22,cursor:"pointer",overflow:"hidden",position:"relative",
              boxShadow:"0 8px 24px rgba(0,0,0,.5)",display:"flex",flexDirection:"column"}}
          >
            <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:22,background:"#000"}}>
              <img src={MERCATO_CARD_IMG} style={{position:"absolute",width:"100%",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:"30%",background:"linear-gradient(to top, rgba(0,0,0,.95) 0%, transparent 100%)"}}/>
            </div>
            {chainRecord&&<div style={{position:"absolute",top:10,left:12,display:"flex",alignItems:"center",gap:4,zIndex:2}}>
              <span style={{fontSize:12,color:G.accent}}>⛓</span>
              <span style={{fontFamily:G.heading,fontSize:15,color:G.accent}}>{chainRecord.score} pts</span>
            </div>}
            <div style={{position:"absolute",bottom:12,left:12,right:12,zIndex:2,background:G.accent,borderRadius:50,padding:"11px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:14,textAlign:"center"}}>▶ Jouer</div>
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
            {!dailyDone && <button onClick={function(){setShowDailyGame(true);setDailyGuess("");setDailyFlash(null);setDailySuccess(false);}} style={{padding:"12px 16px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:14,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:800,whiteSpace:"nowrap"}}>Jouer ⚡</button>}
          </div>
        )}

        {/* Modal défi du jour — Devine le joueur */}
        {showDailyGame && dailyPlayer && (
          <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",flexDirection:"column"}}>
            {/* Fond pelouse */}
            <div style={{position:"absolute",inset:0,zIndex:0,overflow:"hidden"}}>
              {[0,1,2,3,4,5,6].map(function(i){return(<div key={i} style={{position:"absolute",top:0,bottom:0,left:(i/7*100)+"%",width:(1/7*100)+"%",background:i%2===0?"#1E5C2A":"#276B34"}}/>);})}
              <div style={{position:"absolute",left:0,right:0,top:"50%",height:2,background:"rgba(255,255,255,.15)",transform:"translateY(-50%)"}}/>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:180,borderRadius:"50%",border:"2px solid rgba(255,255,255,.15)"}}/>
              <div style={{position:"absolute",inset:0,background:"rgba(0,15,0,.82)"}}/>
            </div>
            {/* Header */}
            <div style={{zIndex:1,padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:G.heading,fontSize:26,color:G.gold,letterSpacing:2}}>⚡ DÉFI DU JOUR</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>Devine le joueur mystère</div>
              </div>
              <button onClick={function(){setShowDailyGame(false);}} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"50%",width:36,height:36,color:G.white,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            {/* Contenu */}
            <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:20,zIndex:1,flex:1,justifyContent:"center"}}>
              {/* Clubs */}
              <div>
                <div style={{fontSize:80,textAlign:"center",marginBottom:8}}>🤔</div>
                <div style={{textAlign:"center",marginBottom:12}}>
                  <span style={{
                    fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",padding:"4px 12px",borderRadius:20,
                    color: dailyPlayer.diff==="facile"?"#00E676":dailyPlayer.diff==="moyen"?"#FFD600":"#FF3D57",
                    background: dailyPlayer.diff==="facile"?"rgba(0,230,118,.15)":dailyPlayer.diff==="moyen"?"rgba(255,214,0,.15)":"rgba(255,61,87,.15)",
                    border: `1px solid ${dailyPlayer.diff==="facile"?"rgba(0,230,118,.3)":dailyPlayer.diff==="moyen"?"rgba(255,214,0,.3)":"rgba(255,61,87,.3)"}`
                  }}>
                    {dailyPlayer.diff==="facile"?"⭐ Facile":dailyPlayer.diff==="moyen"?"⭐⭐ Moyen":"⭐⭐⭐ Expert"}
                  </span>
                </div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:G.accent,marginBottom:12,textAlign:"center"}}>Clubs dans sa carrière</div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,marginBottom:24}}>
                  {dailyPlayer.clubs.map(function(club,i){
                    const [ca,cb] = getClubColors(club);
                    return (
                      <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
                        <div style={{borderRadius:24,overflow:"hidden",position:"relative",height:44,width:"80%",maxWidth:260,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,.5)"}}>
                          <div style={{position:"absolute",inset:0,background:ca}}/>
                          <div style={{position:"absolute",top:0,right:0,width:"55%",bottom:0,background:cb,clipPath:"polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)"}}/>
                          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.1)"}}/>
                          <span style={{position:"relative",zIndex:1,fontSize:14,fontWeight:800,color:"#fff",padding:"0 16px",textShadow:"0 1px 4px rgba(0,0,0,.7)"}}>{club}</span>
                        </div>
                        {i < dailyPlayer.clubs.length - 1 && (
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",margin:"2px 0"}}>
                            <div style={{width:2,height:8,background:G.accent,borderRadius:1,opacity:.6}}/>
                            <div style={{fontSize:16,color:G.accent,lineHeight:1}}>▼</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tentatives */}
              {dailyTries > 0 && !dailySuccess && (
                <div style={{textAlign:"center",marginBottom:12}}>
                  <span style={{fontSize:13,color:"rgba(255,255,255,.4)",fontWeight:700}}>Tentative{dailyTries>1?"s":""} : {dailyTries}</span>
                </div>
              )}

              {/* Bravo ou input */}
              {dailySuccess ? (
                <div style={{textAlign:"center",padding:"16px 0",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:72,marginBottom:12}}>🎉</div>
                  <div style={{fontFamily:G.heading,fontSize:42,color:"#00E676",letterSpacing:2,marginBottom:8}}>BRAVO !</div>
                  <div style={{fontSize:17,color:"rgba(255,255,255,.85)",fontWeight:700,marginBottom:6}}>
                    C'était <span style={{color:"#00E676"}}>{dailyPlayer.name}</span>
                  </div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginTop:4}}>
                    {dailyTries === 1 ? "Trouvé du premier coup 🐐" : `Trouvé en ${dailyTries} essai${dailyTries>1?"s":""}`}
                  </div>
                </div>
              ) : (
                <>
                  <input
                    value={dailyGuess}
                    onChange={function(e){setDailyGuess(e.target.value);setDailyFlash(null);}}
                    onKeyDown={function(e){if(e.key==="Enter") handleDailySubmit();}}
                    placeholder="Nom du joueur..."
                    autoComplete="off"
                    style={{width:"100%",background:dailyFlash==="ko"?"rgba(255,61,87,.15)":"rgba(255,255,255,.08)",border:"2px solid "+(dailyFlash==="ko"?"#FF3D57":"rgba(255,255,255,.2)"),borderRadius:18,padding:"18px",fontFamily:G.font,fontSize:19,fontWeight:700,color:"#ffffff",outline:"none",textAlign:"center",transition:"all .2s",boxSizing:"border-box",marginBottom:8}}
                  />
                  {dailyFlash==="ko" && <div style={{textAlign:"center",fontSize:13,color:"#FF3D57",marginBottom:8,fontWeight:700}}>Ce n'est pas ça... réessaie !</div>}
                  <div style={{display:"flex",gap:10,marginTop:8}}>
                    <button onClick={function(){
                      setShowDailyGame(false);
                      const today = (()=>{ const d=new Date(); const paris=new Date(d.toLocaleString('en-US',{timeZone:'Europe/Paris'})); return paris.getFullYear()+'-'+String(paris.getMonth()+1).padStart(2,'0')+'-'+String(paris.getDate()).padStart(2,'0'); })();
                      try { localStorage.setItem("bb_daily_result", JSON.stringify({date:today,abandoned:true})); } catch{}
                      setDailyDone(true); setDailyAbandoned(true); updateDayStreak();
                    }} style={{flex:1,padding:"16px",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.5)",border:"1px solid rgba(255,255,255,.1)",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:14,fontWeight:700}}>
                      Abandonner
                    </button>
                    <button onClick={handleDailySubmit} style={{flex:2,padding:"16px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:50,cursor:"pointer",fontFamily:G.font,fontSize:16,fontWeight:800}}>
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
          {(()=>{const grade=getGrade(duelResult.myScore||0); return <div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:8,background:grade.color+"22",borderRadius:20,padding:"6px 14px"}}><span style={{fontSize:13,fontWeight:800,color:grade.color,letterSpacing:.5}}>{grade.label}</span></div>; })()}
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
