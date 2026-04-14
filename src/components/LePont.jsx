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
  { name:"Kerem Aktürkoğlu", clubs:["Galatasaray", "Benfica"], diff:"moyen" },
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

  { name:"Raheem Sterling", clubs:["Liverpool", "Manchester City", "Chelsea", "Arsenal"], diff:"moyen" },
  { name:"Ousmane Dembele", clubs:["Rennes", "Borussia Dortmund", "Barcelona", "PSG"], diff:"moyen" },
  { name:"Marcus Rashford", clubs:["Manchester United","Barcelona"], diff:"moyen" },
  { name:"Jack Grealish", clubs:["Aston Villa", "Manchester City"], diff:"moyen" },
  { name:"Declan Rice", clubs:["West Ham", "Arsenal"], diff:"moyen" },
  { name:"Bernardo Silva", clubs:["Monaco", "Manchester City"], diff:"moyen" },



  { name:"Kai Havertz", clubs:["Bayer Leverkusen", "Chelsea", "Arsenal"], diff:"moyen" },

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

  { name:"Lisandro Martinez", clubs:["Ajax Amsterdam", "Manchester United"], diff:"moyen" },
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
  { name:"Rasmus Hojlund", clubs:["Atalanta", "Manchester United", "Napoli"], diff:"moyen" },
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
  { name:"Divock Origi", clubs:["Lille", "Liverpool", "Wolfsburg", "AC Milan", "Nottingham Forest"], diff:"moyen" },
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

  { name:"Ricardo Carvalho", clubs:["Porto", "Chelsea", "Real Madrid", "Monaco"], diff:"expert" },
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

  { name:"Bukayo Saka", clubs:["Arsenal"], diff:"facile" },
  { name:"Federico Valverde", clubs:["Real Madrid"], diff:"moyen" },
  { name:"Thibaut Courtois", clubs:["Chelsea", "Real Madrid"], diff:"facile" },
  { name:"Alisson", clubs:["Roma", "Liverpool"], diff:"moyen" },
  { name:"Joshua Kimmich", clubs:["Bayern Munich"], diff:"moyen" },
  { name:"Romelu Lukaku", clubs:["Anderlecht", "Chelsea", "West Brom", "Everton", "Manchester United", "Inter Milan", "Roma", "Napoli"], diff:"facile" },

  { name:"Carles Puyol", clubs:["Barcelona"], diff:"moyen" },

  { name:"Samir Nasri", clubs:["Marseille", "Arsenal", "Manchester City", "Sevilla"], diff:"moyen" },
  { name:"Nicolas Anelka", clubs:["Arsenal", "Real Madrid", "PSG", "Manchester City", "Chelsea", "Fenerbahce"], diff:"moyen" },
  { name:"Sylvain Wiltord", clubs:["Bordeaux", "Arsenal", "Lyon", "Marseille", "Rennes"], diff:"moyen" },
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

  { name:"Juninho", clubs:["Lyon", "Atletico Madrid"], diff:"expert" },
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


  { name:"Cody Gakpo", clubs:["PSV Eindhoven", "Liverpool"], diff:"facile" },
  { name:"Ryan Gravenberch", clubs:["Ajax Amsterdam", "Bayern Munich", "Liverpool"], diff:"facile" },
  { name:"Antonio Rudiger", clubs:["Stuttgart", "Roma", "Chelsea", "Real Madrid"], diff:"moyen" },
  { name:"Fabian Ruiz", clubs:["Napoli", "PSG"], diff:"facile" },
  { name:"Marco Asensio", clubs:["Real Madrid", "PSG"], diff:"facile" },

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

  // Équipe nationale Pologne 2026
  { name:"Piotr Zieliński", clubs:["Napoli", "Inter Milan"], diff:"moyen" },
  { name:"Arkadiusz Milik", clubs:["Ajax Amsterdam", "Napoli", "Juventus"], diff:"moyen" },
  { name:"Sebastian Szymański", clubs:["Feyenoord", "Fenerbahçe"], diff:"moyen" },
  { name:"Matty Cash", clubs:["Nottingham Forest", "Aston Villa"], diff:"moyen" },
  { name:"Jakub Kamiński", clubs:["Wolfsburg", "FC Cologne"], diff:"moyen" },
  { name:"Przemysław Frankowski", clubs:["Lens", "Rennes"], diff:"expert" },

  // Équipe nationale Écosse 2026
  { name:"Scott McTominay", clubs:["Manchester United", "Napoli"], diff:"moyen" },
  { name:"Billy Gilmour", clubs:["Chelsea", "Brighton", "Napoli"], diff:"moyen" },
  { name:"Kieran Tierney", clubs:["Celtic", "Arsenal", "Real Sociedad"], diff:"moyen" },
  { name:"Aaron Hickey", clubs:["Bologna", "Brentford"], diff:"moyen" },
  { name:"John McGinn", clubs:["Aston Villa"], diff:"expert" },
  { name:"Lewis Ferguson", clubs:["Bologna"], diff:"expert" },
  { name:"Che Adams", clubs:["Birmingham City", "Southampton"], diff:"expert" },
  { name:"Ryan Christie", clubs:["Bournemouth"], diff:"expert" },

  // Équipe nationale Turquie 2026
  { name:"Kenan Yıldız", clubs:["Juventus"], diff:"expert" },
  { name:"Ferdi Kadıoğlu", clubs:["Fenerbahçe", "Brighton"], diff:"moyen" },
  { name:"Altay Bayındır", clubs:["Fenerbahçe", "Manchester United"], diff:"moyen" },
  { name:"Zeki Çelik", clubs:["Lille", "Roma"], diff:"moyen" },
  { name:"Çağlar Söyüncü", clubs:["Leicester City", "Atletico Madrid"], diff:"moyen" },

  // Équipe nationale Serbie
  { name:"Dušan Vlahović", clubs:["Fiorentina", "Juventus"], diff:"moyen" },
  { name:"Aleksandar Mitrović", clubs:["Fulham", "Al Hilal"], diff:"moyen" },
  { name:"Dušan Tadić", clubs:["Southampton", "Ajax Amsterdam", "Fenerbahçe"], diff:"moyen" },
  { name:"Luka Jović", clubs:["Real Madrid", "Fiorentina", "AC Milan"], diff:"moyen" },
  { name:"Filip Kostić", clubs:["Eintracht Frankfurt", "Juventus"], diff:"moyen" },
  { name:"Nikola Milenković", clubs:["Fiorentina", "Nottingham Forest"], diff:"moyen" },
  { name:"Strahinja Pavlović", clubs:["RB Salzburg", "AC Milan"], diff:"moyen" },

  // Équipe nationale Danemark 2026
  { name:"Mikkel Damsgaard", clubs:["Sampdoria", "Brentford"], diff:"moyen" },
  { name:"Joachim Andersen", clubs:["Lyon", "Crystal Palace", "Fulham"], diff:"moyen" },
  { name:"Andreas Christensen", clubs:["Chelsea", "Barcelona"], diff:"moyen" },
  { name:"Kasper Schmeichel", clubs:["Leicester City", "Nice", "Celtic"], diff:"moyen" },
  { name:"Christian Nørgaard", clubs:["Brentford", "Arsenal"], diff:"moyen" },
  { name:"Joakim Mæhle", clubs:["Atalanta", "Wolfsburg"], diff:"expert" },
  { name:"Gustav Isaksen", clubs:["Midtjylland", "Lazio"], diff:"expert" },
  { name:"Jesper Lindstrøm", clubs:["Eintracht Frankfurt", "Wolfsburg"], diff:"expert" },

  // Équipe nationale Corée du Sud 2026
  { name:"Son Heung-min", clubs:["Bayer Leverkusen", "Tottenham", "LAFC"], diff:"facile" },
  { name:"Lee Kang-in", clubs:["Valencia", "Mallorca", "PSG"], diff:"moyen" },
  { name:"Hwang Hee-chan", clubs:["RB Leipzig", "Wolverhampton"], diff:"moyen" },
  { name:"Hwang In-beom", clubs:["Schalke", "Feyenoord"], diff:"moyen" },
  { name:"Lee Jae-sung", clubs:["Mainz"], diff:"expert" },

  // Équipe nationale Japon 2026
  { name:"Kaoru Mitoma", clubs:["Union Saint-Gilloise", "Brighton"], diff:"moyen" },
  { name:"Takefusa Kubo", clubs:["Real Madrid", "Real Sociedad"], diff:"moyen" },
  { name:"Wataru Endo", clubs:["Stuttgart", "Liverpool"], diff:"moyen" },
  { name:"Daichi Kamada", clubs:["Eintracht Frankfurt", "Lazio", "Crystal Palace"], diff:"moyen" },
  { name:"Ao Tanaka", clubs:["Hamburg", "Leeds United"], diff:"moyen" },
  { name:"Hiroki Ito", clubs:["Stuttgart", "Bayern Munich"], diff:"moyen" },
  { name:"Koki Machida", clubs:["Union Saint-Gilloise", "Hoffenheim"], diff:"expert" },
  { name:"Zion Suzuki", clubs:["Sint-Truiden", "Parma"], diff:"expert" },

  // Équipe nationale États-Unis 2026
  { name:"Christian Pulisic", clubs:["Borussia Dortmund", "Chelsea", "AC Milan"], diff:"moyen" },
  { name:"Weston McKennie", clubs:["Schalke", "Juventus"], diff:"moyen" },
  { name:"Tyler Adams", clubs:["RB Leipzig", "Leeds United", "Bournemouth"], diff:"moyen" },
  { name:"Tim Weah", clubs:["Lille", "Juventus"], diff:"moyen" },
  { name:"Folarin Balogun", clubs:["Arsenal", "Monaco"], diff:"moyen" },
  { name:"Brenden Aaronson", clubs:["RB Salzburg", "Leeds United"], diff:"moyen" },
  { name:"Malik Tillman", clubs:["Bayern Munich", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Gio Reyna", clubs:["Borussia Dortmund", "Borussia Mönchengladbach"], diff:"moyen" },
  { name:"Chris Richards", clubs:["Hoffenheim", "Crystal Palace"], diff:"expert" },

  // Équipe nationale Croatie 2026
  { name:"Mateo Kovačić", clubs:["Inter Milan", "Chelsea", "Manchester City"], diff:"moyen" },
  { name:"Andrej Kramarić", clubs:["Leicester City", "Hoffenheim"], diff:"moyen" },
  { name:"Dominik Livaković", clubs:["Dinamo Zagreb", "Fenerbahçe"], diff:"moyen" },
  { name:"Nikola Vlašić", clubs:["Everton", "CSKA Moscow", "Torino"], diff:"moyen" },
  { name:"Mario Pašalić", clubs:["Chelsea", "Atalanta"], diff:"expert" },
  { name:"Duje Ćaleta-Car", clubs:["Marseille", "Southampton"], diff:"expert" },

  // Équipe nationale Uruguay 2026
  { name:"Manuel Ugarte", clubs:["Sporting CP", "PSG", "Manchester United"], diff:"moyen" },
  { name:"Rodrigo Bentancur", clubs:["Juventus", "Tottenham"], diff:"moyen" },
  { name:"Nicolás De La Cruz", clubs:["River Plate", "Liverpool"], diff:"moyen" },
  { name:"Ronald Araújo", clubs:["Barcelona"], diff:"expert" },
  { name:"José María Giménez", clubs:["Atletico Madrid"], diff:"expert" },

  // Équipe nationale Colombie 2026
  { name:"Dávinson Sánchez", clubs:["Ajax Amsterdam", "Tottenham", "Galatasaray"], diff:"moyen" },
  { name:"Jhon Duran", clubs:["Aston Villa", "Al Qadsiah"], diff:"moyen" },
  { name:"Yerry Mina", clubs:["Barcelona", "Everton"], diff:"moyen" },
  { name:"Daniel Muñoz", clubs:["Genk", "Crystal Palace"], diff:"moyen" },
  { name:"Jefferson Lerma", clubs:["Bournemouth", "Crystal Palace"], diff:"moyen" },
  { name:"David Ospina", clubs:["Arsenal", "Napoli"], diff:"moyen" },
  { name:"Jhon Lucumí", clubs:["Genk", "Bologna"], diff:"expert" },
  { name:"Rafael Borré", clubs:["River Plate", "Eintracht Frankfurt"], diff:"expert" },

  // Équipe nationale Mexique 2026
  { name:"Santiago Giménez", clubs:["Feyenoord", "AC Milan"], diff:"moyen" },
  { name:"Hirving Lozano", clubs:["PSV Eindhoven", "Napoli"], diff:"moyen" },
  { name:"Edson Álvarez", clubs:["Ajax Amsterdam", "West Ham"], diff:"moyen" },
  { name:"Jorge Sánchez", clubs:["Ajax Amsterdam", "Porto"], diff:"expert" },
  { name:"César Montes", clubs:["Almería"], diff:"expert" },
  { name:"Guillermo Ochoa", clubs:["Málaga", "Standard Liège"], diff:"expert" },

  // Équipe nationale Argentine 2026 (compléments)
  { name:"Emiliano Martínez", clubs:["Arsenal", "Aston Villa"], diff:"moyen" },
  { name:"Julián Álvarez", clubs:["River Plate", "Manchester City", "Atletico Madrid"], diff:"moyen" },
  { name:"Rodrigo De Paul", clubs:["Udinese", "Atletico Madrid"], diff:"moyen" },
  { name:"Cristian Romero", clubs:["Juventus", "Atalanta", "Tottenham"], diff:"moyen" },
  { name:"Nicolás Tagliafico", clubs:["Ajax Amsterdam", "Lyon"], diff:"moyen" },
  { name:"Giovani Lo Celso", clubs:["PSG", "Real Betis", "Tottenham"], diff:"moyen" },
  { name:"Nahuel Molina", clubs:["Udinese", "Atletico Madrid"], diff:"expert" },

  // Équipe nationale Brésil 2026 (compléments)
  { name:"Raphinha", clubs:["Leeds United", "Barcelona"], diff:"moyen" },
  { name:"Lucas Paquetá", clubs:["AC Milan", "Lyon", "West Ham"], diff:"moyen" },
  { name:"Éder Militão", clubs:["Porto", "Real Madrid"], diff:"moyen" },
  { name:"Alex Sandro", clubs:["Porto", "Juventus"], diff:"moyen" },
  { name:"Richarlison", clubs:["Everton", "Tottenham"], diff:"moyen" },

  // Équipe nationale Suisse 2026 (compléments)
  { name:"Manuel Akanji", clubs:["Borussia Dortmund", "Manchester City"], diff:"moyen" },
  { name:"Yann Sommer", clubs:["Borussia Mönchengladbach", "Bayern Munich", "Inter Milan"], diff:"moyen" },
  { name:"Breel Embolo", clubs:["Schalke", "Borussia Mönchengladbach", "Monaco"], diff:"moyen" },
  { name:"Dan Ndoye", clubs:["Bologna", "Nottingham Forest"], diff:"moyen" },
  { name:"Noah Okafor", clubs:["AC Milan", "Leeds United"], diff:"moyen" },
  { name:"Remo Freuler", clubs:["Atalanta", "Nottingham Forest"], diff:"expert" },
  { name:"Zeki Amdouni", clubs:["Burnley", "Benfica"], diff:"expert" },

  // Équipe nationale Pays-Bas 2026 (compléments)
  { name:"Tijjani Reijnders", clubs:["AZ Alkmaar", "AC Milan", "Manchester City"], diff:"moyen" },
  { name:"Donyell Malen", clubs:["PSV Eindhoven", "Borussia Dortmund"], diff:"moyen" },
  { name:"Denzel Dumfries", clubs:["PSV Eindhoven", "Inter Milan"], diff:"moyen" },
  { name:"Jeremie Frimpong", clubs:["Celtic", "Bayer Leverkusen"], diff:"moyen" },
  { name:"Joshua Zirkzee", clubs:["Bologna", "Manchester United"], diff:"moyen" },
  { name:"Nathan Aké", clubs:["Chelsea", "Manchester City"], diff:"moyen" },
  { name:"Bart Verbruggen", clubs:["Anderlecht", "Brighton"], diff:"expert" },

  // Équipe nationale Italie 2026 (compléments)
  { name:"Davide Frattesi", clubs:["Sassuolo", "Inter Milan"], diff:"moyen" },
  { name:"Riccardo Calafiori", clubs:["Bologna", "Arsenal"], diff:"moyen" },
  { name:"Giovanni Di Lorenzo", clubs:["Empoli", "Napoli"], diff:"moyen" },
  { name:"Andrea Cambiaso", clubs:["Genoa", "Juventus"], diff:"moyen" },
  { name:"Destiny Udogie", clubs:["Udinese", "Tottenham"], diff:"moyen" },
  { name:"Lorenzo Pellegrini", clubs:["Sassuolo", "Roma"], diff:"moyen" },

  // Équipe nationale Belgique 2026
  { name:"Jérémy Doku", clubs:["Rennes", "Manchester City"], diff:"moyen" },
  { name:"Leandro Trossard", clubs:["Genk", "Brighton", "Arsenal"], diff:"moyen" },
  { name:"Charles De Ketelaere", clubs:["Club Brugge", "AC Milan", "Atalanta"], diff:"moyen" },
  { name:"Youri Tielemans", clubs:["Monaco", "Leicester City", "Aston Villa"], diff:"moyen" },
  { name:"Amadou Onana", clubs:["Everton", "Aston Villa"], diff:"moyen" },
  { name:"Lois Openda", clubs:["Lens", "RB Leipzig"], diff:"moyen" },
  { name:"Alexis Saelemaekers", clubs:["AC Milan", "Bologna", "Roma"], diff:"moyen" },
  { name:"Wout Faes", clubs:["Reims", "Leicester City"], diff:"expert" },

  // Équipe nationale Angleterre 2026 (compléments)
  { name:"Jordan Pickford", clubs:["Sunderland", "Everton"], diff:"moyen" },
  { name:"Ezri Konsa", clubs:["Brentford", "Aston Villa"], diff:"moyen" },
  { name:"Elliot Anderson", clubs:["Newcastle United", "Nottingham Forest"], diff:"moyen" },
  { name:"Anthony Gordon", clubs:["Everton", "Newcastle United"], diff:"moyen" },

  // Équipe nationale Allemagne 2026 (compléments)
  { name:"Niclas Füllkrug", clubs:["Werder Bremen", "Borussia Dortmund", "West Ham"], diff:"moyen" },
  { name:"Robin Gosens", clubs:["Atalanta", "Inter Milan", "Union Berlin"], diff:"moyen" },
  { name:"Pascal Groß", clubs:["Brighton", "Borussia Dortmund"], diff:"expert" },
  { name:"David Raum", clubs:["Hoffenheim", "RB Leipzig"], diff:"expert" },

  // Équipe nationale Espagne 2026 (compléments)
  { name:"Pau Cubarsí", clubs:["Barcelona"], diff:"moyen" },
  { name:"Marc Cucurella", clubs:["Brighton", "Chelsea"], diff:"moyen" },
  { name:"Martín Zubimendi", clubs:["Real Sociedad", "Arsenal"], diff:"moyen" },
  { name:"Unai Simón", clubs:["Athletic Bilbao"], diff:"expert" },
  { name:"Fermín López", clubs:["Barcelona"], diff:"expert" },

  // Équipe nationale Portugal 2026 (compléments)
  { name:"Francisco Conceição", clubs:["Porto", "Juventus"], diff:"moyen" },
  { name:"João Palhinha", clubs:["Sporting CP", "Fulham", "Bayern Munich"], diff:"moyen" },
  { name:"Matheus Nunes", clubs:["Wolverhampton", "Manchester City"], diff:"moyen" },
  { name:"Nelson Semedo", clubs:["Barcelona", "Wolverhampton", "Fenerbahçe"], diff:"moyen" },

  // Équipe nationale Côte d'Ivoire 2026
  { name:"Evan Ndicka", clubs:["Eintracht Frankfurt", "Roma"], diff:"moyen" },
  { name:"Simon Adingra", clubs:["Union Saint-Gilloise", "Brighton"], diff:"moyen" },
  { name:"Ibrahim Sangaré", clubs:["PSV Eindhoven", "Nottingham Forest"], diff:"moyen" },
  { name:"Nicolas Pépé", clubs:["Lille", "Arsenal", "Nice"], diff:"moyen" },
  { name:"Hassane Kamara", clubs:["Nice", "Watford"], diff:"moyen" },
  { name:"Willy Boly", clubs:["Porto", "Wolverhampton", "Nottingham Forest"], diff:"moyen" },
  { name:"Hamed Traoré", clubs:["Sassuolo", "Bournemouth", "Napoli"], diff:"moyen" },
  { name:"Maxwel Cornet", clubs:["Lyon", "Burnley", "West Ham"], diff:"moyen" },

  // Équipe nationale Cameroun 2026
  { name:"André-Franck Zambo Anguissa", clubs:["Fulham", "Villarreal", "Napoli"], diff:"moyen" },
  { name:"Carlos Baleba", clubs:["Reims", "Brighton"], diff:"moyen" },
  { name:"Eric Maxim Choupo-Moting", clubs:["Stoke City", "PSG", "Bayern Munich"], diff:"moyen" },
  { name:"Vincent Aboubakar", clubs:["Porto", "Beşiktaş", "Al Nassr"], diff:"moyen" },
  { name:"Karl Toko Ekambi", clubs:["Angers", "Villarreal", "Lyon"], diff:"moyen" },
  { name:"Christopher Wooh", clubs:["Lens", "Rennes"], diff:"expert" },
  { name:"Nathan Ngoumou", clubs:["Toulouse", "Borussia Mönchengladbach"], diff:"expert" },
  { name:"Martin Hongla", clubs:["Hellas Verona", "Granada"], diff:"expert" },
  { name:"Jean Onana", clubs:["Bordeaux", "Genoa"], diff:"expert" },

  // Équipe nationale Afrique du Sud 2026
  { name:"Lyle Foster", clubs:["Monaco", "Burnley"], diff:"moyen" },
  { name:"Percy Tau", clubs:["Club Brugge", "Brighton", "Al Ahly"], diff:"moyen" },
  { name:"Bongani Zungu", clubs:["Amiens", "Rangers", "Kasımpaşa"], diff:"expert" },

  // Équipe nationale Égypte 2026
  { name:"Mohamed Elneny", clubs:["Basel", "Arsenal", "Beşiktaş"], diff:"moyen" },
  { name:"Mahmoud Trezeguet", clubs:["Kasımpaşa", "Aston Villa", "Trabzonspor"], diff:"moyen" },
  { name:"Mostafa Mohamed", clubs:["Nantes", "Galatasaray"], diff:"moyen" },
  { name:"Ahmed Hegazi", clubs:["Fiorentina", "West Brom", "Al Ittihad"], diff:"expert" },

  // Équipe nationale Nigeria 2026
  { name:"Ademola Lookman", clubs:["Everton", "RB Leipzig", "Atalanta"], diff:"moyen" },
  { name:"Alex Iwobi", clubs:["Arsenal", "Everton", "Fulham"], diff:"moyen" },
  { name:"Wilfred Ndidi", clubs:["Genk", "Leicester City", "Beşiktaş"], diff:"moyen" },
  { name:"Calvin Bassey", clubs:["Rangers", "Ajax Amsterdam", "Fulham"], diff:"moyen" },
  { name:"Ola Aina", clubs:["Chelsea", "Torino", "Nottingham Forest"], diff:"moyen" },
  { name:"Samuel Chukwueze", clubs:["Villarreal", "AC Milan", "Fulham"], diff:"moyen" },
  { name:"Moses Simon", clubs:["Porto", "Nantes"], diff:"expert" },
  { name:"Maduka Okoye", clubs:["Watford", "Udinese"], diff:"expert" },
  { name:"William Troost-Ekong", clubs:["Udinese", "Watford", "Fulham"], diff:"expert" },
  { name:"Terem Moffi", clubs:["Lorient", "Nice"], diff:"expert" },

  // Équipe nationale RD Congo 2026
  { name:"Yoane Wissa", clubs:["Lorient", "Brentford", "Newcastle United"], diff:"moyen" },
  { name:"Aaron Wan-Bissaka", clubs:["Crystal Palace", "Manchester United", "West Ham"], diff:"moyen" },
  { name:"Cédric Bakambu", clubs:["Sochaux", "Villarreal", "Real Betis"], diff:"moyen" },
  { name:"Chancel Mbemba", clubs:["Anderlecht", "Newcastle United", "Porto", "Marseille"], diff:"moyen" },
  { name:"Noah Sadiki", clubs:["Union Saint-Gilloise", "Sunderland"], diff:"expert" },
  { name:"Grady Diangana", clubs:["West Ham", "West Brom"], diff:"expert" },
  { name:"Théo Bongonda", clubs:["Genk", "Celta Vigo", "Spartak Moscow"], diff:"expert" },
  { name:"Arthur Masuaku", clubs:["West Ham", "Beşiktaş", "Crystal Palace"], diff:"expert" },

  // Équipe nationale Tunisie 2026
  { name:"Ellyes Skhiri", clubs:["Toulouse", "Cologne", "Eintracht Frankfurt"], diff:"moyen" },
  { name:"Hannibal Mejbri", clubs:["Manchester United", "Sevilla", "Southampton"], diff:"moyen" },
  { name:"Dylan Bronn", clubs:["Gent", "Villarreal", "Servette"], diff:"moyen" },
  { name:"Montassar Talbi", clubs:["Caen", "Lorient"], diff:"expert" },
  { name:"Yan Valery", clubs:["Southampton", "Young Boys"], diff:"expert" },
  { name:"Ali Abdi", clubs:["Charleroi", "Nice"], diff:"expert" },
  { name:"Youssef Msakni", clubs:["Espérance de Tunis", "Valenciennes", "Al Duhail"], diff:"expert" },
  { name:"Aymen Dahmen", clubs:["CS Sfaxien", "Reims"], diff:"expert" },

  // Équipe nationale France 2026 (compléments)
  { name:"Lucas Digne", clubs:["Lille", "Barcelona", "Everton", "Aston Villa"], diff:"moyen" },
  { name:"Malo Gusto", clubs:["Lyon", "Chelsea"], diff:"moyen" },
  { name:"Wesley Fofana", clubs:["Saint-Etienne", "Leicester City", "Chelsea"], diff:"moyen" },
  { name:"Maghnes Akliouche", clubs:["Monaco"], diff:"expert" },

  // Équipe nationale Sénégal 2026
  { name:"Pape Matar Sarr", clubs:["Metz", "Tottenham"], diff:"moyen" },
  { name:"Krépin Diatta", clubs:["Club Brugge", "Monaco"], diff:"moyen" },
  { name:"Moussa Niakhaté", clubs:["Metz", "Mainz", "Lyon"], diff:"moyen" },
  { name:"Iliman Ndiaye", clubs:["Sheffield United", "Marseille"], diff:"moyen" },
  { name:"Pape Gueye", clubs:["Le Havre", "Watford", "Marseille", "Villarreal"], diff:"expert" },
  { name:"El Hadji Malick Diouf", clubs:["Stoke City", "Southampton"], diff:"expert" },
  { name:"Ismail Jakobs", clubs:["FC Cologne", "Galatasaray"], diff:"expert" },

  // Équipe nationale Algérie 2026
  { name:"Ismaël Bennacer", clubs:["Empoli", "AC Milan", "Dinamo Zagreb"], diff:"moyen" },
  { name:"Ramy Bensebaini", clubs:["Nice", "Borussia Mönchengladbach", "Borussia Dortmund"], diff:"moyen" },
  { name:"Rayan Aït-Nouri", clubs:["Angers", "Wolverhampton", "Manchester City"], diff:"moyen" },
  { name:"Youcef Atal", clubs:["Nice", "Al-Sadd"], diff:"moyen" },
  { name:"Aïssa Mandi", clubs:["Reims", "Real Betis", "Villarreal", "Lille"], diff:"moyen" },
  { name:"Mohamed Amoura", clubs:["Union Saint-Gilloise", "Wolfsburg"], diff:"moyen" },
  { name:"Amine Gouiri", clubs:["Lyon", "Nice", "Rennes", "Marseille"], diff:"moyen" },
  { name:"Hicham Boudaoui", clubs:["Nice"], diff:"expert" },
  { name:"Baghdad Bounedjah", clubs:["Al Sadd", "Al Shamal"], diff:"expert" },

  // Équipe nationale Maroc 2026
  { name:"Nayef Aguerd", clubs:["West Ham", "Marseille"], diff:"moyen" },
  { name:"Noussair Mazraoui", clubs:["Ajax Amsterdam", "Bayern Munich", "Manchester United"], diff:"moyen" },
  { name:"Romain Saïss", clubs:["Wolverhampton", "Beşiktaş", "Al-Sadd"], diff:"moyen" },
  { name:"Jawad El Yamiq", clubs:["Real Valladolid", "Real Betis", "Real Zaragoza"], diff:"expert" },
  { name:"Sofyan Amrabat", clubs:["Feyenoord", "Fiorentina", "Manchester United", "Fenerbahce", "Real Betis"], diff:"moyen" },
  { name:"Neil El Aynaoui", clubs:["Nice", "Lens", "Roma"], diff:"moyen" },
  { name:"Bilal El Khannouss", clubs:["Genk", "Leicester City", "Stuttgart"], diff:"moyen" },
  { name:"Brahim Díaz", clubs:["Manchester City", "Real Madrid", "AC Milan", "PSG"], diff:"moyen" },
  { name:"Ayoub El Kaabi", clubs:["Wydad Casablanca", "Olympiacos"], diff:"expert" },
  { name:"Chemsdine Talbi", clubs:["Braga", "RC Strasbourg"], diff:"expert" },

  // Légendes manquantes
  { name:"Ronaldinho", clubs:["PSG", "Barcelona", "AC Milan", "Flamengo"], diff:"facile" },
  { name:"Zinedine Zidane", clubs:["Cannes", "Bordeaux", "Juventus", "Real Madrid"], diff:"facile" },
  { name:"Ronaldo Nazário", clubs:["Cruzeiro", "Barcelona", "Inter Milan", "Real Madrid", "AC Milan"], diff:"facile" },
  { name:"Kaká", clubs:["AC Milan", "Real Madrid", "Orlando City"], diff:"facile" },
  { name:"Franck Ribéry", clubs:["Marseille", "Bayern Munich", "Fiorentina"], diff:"facile" },
  { name:"Fernando Torres", clubs:["Atletico Madrid", "Liverpool", "Chelsea", "AC Milan"], diff:"facile" },
  { name:"Dani Alves", clubs:["Sevilla", "Barcelona", "Juventus", "Manchester City", "PSG"], diff:"moyen" },
  { name:"Gonçalo Ramos", clubs:["Benfica", "PSG"], diff:"moyen" },
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
  "Flamengo":["flamengo","fla","crf"],
  "Cruzeiro":["cruzeiro","cec"],
  "Cannes":["as cannes","cannes"],
  "Orlando City":["orlando","osc"],
  "Fulham":["fulham fc","the cottagers"],
  "Brentford":["brentford fc","the bees"],
  "Sampdoria":["uc sampdoria","samp"],
  "Midtjylland":["fc midtjylland","fcm"],
  "Sint-Truiden":["stvv","sint truiden","saint trond"],
  "Hamburg":["hamburger sv","hsv"],
  "Al Qadsiah":["al-qadsiah","qadsiah"],
  "Almería":["ud almeria","almerıa"],
  "Málaga":["malaga cf","los boquerones"],
  "Boca Juniors":["boca","los xeneizes","club atletico boca juniors"],
  "Racing Club":["racing","la academia"],
  "Santos":["santos fc","peixe"],
  "Empoli":["empoli fc","gli azzurri"],
  "Udinese":["udinese calcio","zebrette"],
  "Hoffenheim":["tsg hoffenheim","tsg 1899","1899 hoffenheim"],
  "Genoa":["genoa cfc","genova"],
  "Granada":["granada cf","los nazaríes"],
  "Amiens":["amiens sc","asc amiens"],
  "Torino":["torino fc","toro","granata"],
  "West Brom":["west bromwich","wba","west bromwich albion"],
  "Sunderland":["sunderland afc","safc","black cats"],
  "Sochaux":["fc sochaux","fcsm"],
  "Servette":["servette fc","servette geneve"],
  "Charleroi":["sporting charleroi","rsc charleroi"],
  "Espérance de Tunis":["esperance tunis","est","esperance sportive de tunis"],
  "CS Sfaxien":["sfaxien","csf","club sportif sfaxien"],
  "Caen":["sm caen","stade malherbe"],
  "Lorient":["fc lorient","les merlus"],
  "Valenciennes":["valenciennes fc","vafc"],
  "Gent":["kaa gent","aa gent"],
  "Stoke City":["stoke","the potters"],
  "FC Cologne":["cologne","koln","1. fc köln"],
  "Mainz":["mainz 05","fsv mainz"],
  "Reims":["stade de reims","stade reims"],
  "Angers":["angers sco","sco angers"],
  "Al Shamal":["al-shamal","shamal"],
  "Al-Sadd":["al sadd","sadd","al-sadd sc"],
  "Genk":["racing genk","krc genk"],
  "Real Valladolid":["valladolid"],
  "Real Zaragoza":["zaragoza"],
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
  "Fulham":["#FFFFFF","#000000"],"Brentford":["#CC0000","#FFFFFF"],
  "Sampdoria":["#0E4FA3","#FFFFFF"],"Midtjylland":["#CC0000","#FFFFFF"],
  "Parma":["#FFD700","#003082"],"Sint-Truiden":["#FFD700","#000000"],
  "Hamburg":["#001F5B","#FFFFFF"],"RB Salzburg":["#CC0000","#FFFFFF"],
  "Standard Liège":["#CC0000","#FFFFFF"],"Almería":["#CC0000","#FFFFFF"],
  "Málaga":["#003082","#FFFFFF"],"River Plate":["#FFFFFF","#CC0000"],"Boca Juniors":["#003399","#FFD700"],
  "Racing Club":["#1565C0","#FFFFFF"],"Palmeiras":["#006B3F","#FFFFFF"],"Santos":["#000000","#FFFFFF"],"Flamengo":["#E82020","#000000"],"Cruzeiro":["#003399","#FFFFFF"],
  "Cannes":["#E31B23","#FFFFFF"],"Orlando City":["#633492","#F7B024"],
  "Leeds United":["#FFFFFF","#FFD700"],"Empoli":["#1565C0","#FFFFFF"],"Udinese":["#000000","#FFFFFF"],"Bologna":["#CC0000","#003082"],
  "Granada":["#CC0000","#FFFFFF"],
  "Sunderland":["#E31B23","#000000"],"Sochaux":["#FABE00","#003082"],
  "Charleroi":["#000000","#FFFFFF"],"Espérance de Tunis":["#CC0000","#FFD700"],
  "CS Sfaxien":["#CC0000","#000000"],"Caen":["#003189","#FFFFFF"],
  "Lorient":["#F7700A","#000000"],"Valenciennes":["#CC0000","#FFFFFF"],
  "Gent":["#1B67B2","#FFFFFF"],
  "FC Cologne":["#ED1C24","#FFFFFF"],"Mainz":["#C8102E","#FFFFFF"],
  "Angers":["#000000","#FFFFFF"],"Al Shamal":["#006A4E","#FFFFFF"],
  "Genk":["#1B67B2","#FFFFFF"],"Real Valladolid":["#4B0082","#FFFFFF"],
  "Real Zaragoza":["#003399","#FFFFFF"],
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
  const [pendingRoomCode, setPendingRoomCode] = useState(null);
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
    // Auto-join depuis lien ?room=XXXXXX
    try {
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get("room");
      if (roomCode) {
        window.history.replaceState({}, "", window.location.pathname);
        setRoomInput(roomCode.toUpperCase());
        setPendingRoomCode(roomCode.toUpperCase());
      }
    } catch {}
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

  // Auto-join room une fois le pseudo confirmé
  useEffect(()=>{
    if(pseudoConfirmed && pendingRoomCode) {
      setPendingRoomCode(null);
      setTimeout(function(){ joinRoom(pendingRoomCode); }, 500);
    }
  },[pseudoConfirmed, pendingRoomCode]);
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
      if (Array.isArray(data)) setHallOfFame(data);
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
      <>
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
      {/* Hall of Fame Modal */}
      {showHallOfFame && (
        <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"flex-end"}}
          onClick={function(e){if(e.target===e.currentTarget)setShowHallOfFame(false);}}>
          <div style={{width:"100%",background:"rgba(10,20,10,.97)",borderRadius:"28px 28px 0 0",padding:"20px 20px 48px",border:"1px solid rgba(255,255,255,.1)",borderBottom:"none",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{fontFamily:G.heading,fontSize:28,color:G.gold,letterSpacing:2,marginBottom:4,textAlign:"center"}}>🏅 HALL OF FAME</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",textAlign:"center",marginBottom:16}}>Champions des saisons passées</div>
            {hallOfFame.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0",fontSize:14}}>Pas encore de champion — la première saison est en cours !</div>}
            {hallOfFame.map(function(s,i){
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
      </>
    );
  }
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
            <button onClick={function(){
              const link = "https://goatfc.fr?room="+room.code;
              if(navigator.share){navigator.share({title:"GOAT FC — Rejoins ma salle !",text:"Rejoins ma salle sur GOAT FC 🐐",url:link});}
              else{navigator.clipboard.writeText(link).then(function(){alert("Lien copié ! 📋");});}
            }} style={{background:"rgba(0,230,118,.15)",border:"1px solid rgba(0,230,118,.3)",borderRadius:8,padding:"6px 10px",color:G.accent,cursor:"pointer",fontSize:13,fontWeight:800,lineHeight:1}}>🔗 Inviter</button>
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

  const pseudoModal = (pseudoScreen && !pseudoConfirmed) ? (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"calc(100% - 40px)",maxWidth:360,background:"rgba(10,20,10,.97)",borderRadius:28,padding:"32px 24px",border:"1px solid rgba(255,255,255,.1)",position:"relative"}}>
        {/* Bouton fermer — seulement si pas encore de pseudo */}
        {!pseudoConfirmed && <button onClick={function(){setPseudoScreen(false);}} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:30,height:30,color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontFamily:G.heading,fontSize:52,color:G.white,lineHeight:.9}}>GOAT<span style={{color:G.accent}}>FC</span></div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:8,letterSpacing:2}}>CHOISIS TON PSEUDO</div>
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
            <div onClick={function(){if(!pseudoConfirmed) setPseudoScreen(true);}} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"7px 12px",display:"flex",alignItems:"center",gap:6,cursor:pseudoConfirmed?"default":"pointer"}}>
              <span style={{fontSize:13}}>👤</span>
              <span style={{fontSize:12,fontWeight:700,color:playerName?G.white:"rgba(255,255,255,.4)",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {playerName||"Pseudo"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{...sheet,gap:10}}>

        {/* Bandeau room en attente */}
        {pendingRoomCode && !pseudoConfirmed && (
          <div style={{background:"rgba(0,230,118,.1)",border:"1px solid rgba(0,230,118,.3)",borderRadius:12,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:800,color:G.accent}}>🔗 Salle {pendingRoomCode} en attente</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>Crée ton pseudo pour rejoindre automatiquement</div>
          </div>
        )}
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
        <div style={{display:"flex",gap:10,flexShrink:0}}>
          {/* ── Carte THE PLUG ── */}
          <div
            onClick={function(){setGameConfigModal("pont");}}
            style={{flex:1,aspectRatio:"1",borderRadius:22,cursor:"pointer",overflow:"hidden",position:"relative",
              boxShadow:"0 8px 24px rgba(0,0,0,.5)",display:"flex",flexDirection:"column"}}
          >
            {/* Image en fond, rogne le haut pour garder le visuel principal */}
            <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:22,background:"#000"}}>
              <img src={PLUG_CARD_IMG} style={{position:"absolute",width:"100%",top:0,pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:"30%",background:"linear-gradient(to top, rgba(0,0,0,.95) 0%, transparent 100%)"}}/>
            </div>
            {/* Record */}
            {record && <div style={{position:"absolute",top:10,left:12,display:"flex",alignItems:"center",gap:4,zIndex:2}}>
              <span style={{fontSize:12,color:G.gold}}>🏆</span>
              <span style={{fontFamily:G.heading,fontSize:15,color:G.gold}}>{record.score} pts</span>
            </div>}
            {/* Bouton jouer */}
            <div style={{position:"absolute",bottom:8,left:10,right:10,zIndex:2,background:G.accent,borderRadius:50,padding:"6px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:11,textAlign:"center"}}>▶ Jouer</div>
          </div>

          {/* ── Carte THE MERCATO ── */}
          <div
            onClick={function(){setGameConfigModal("chaine");}}
            style={{flex:1,aspectRatio:"1",borderRadius:22,cursor:"pointer",overflow:"hidden",position:"relative",
              boxShadow:"0 8px 24px rgba(0,0,0,.5)",display:"flex",flexDirection:"column"}}
          >
            <div style={{position:"absolute",inset:0,overflow:"hidden",borderRadius:22,background:"#000"}}>
              <img src={MERCATO_CARD_IMG} style={{position:"absolute",width:"100%",top:0,pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:"30%",background:"linear-gradient(to top, rgba(0,0,0,.95) 0%, transparent 100%)"}}/>
            </div>
            {chainRecord&&<div style={{position:"absolute",top:10,left:12,display:"flex",alignItems:"center",gap:4,zIndex:2}}>
              <span style={{fontSize:12,color:G.accent}}>⛓</span>
              <span style={{fontFamily:G.heading,fontSize:15,color:G.accent}}>{chainRecord.score} pts</span>
            </div>}
            <div style={{position:"absolute",bottom:8,left:10,right:10,zIndex:2,background:G.accent,borderRadius:50,padding:"6px 0",color:"#000",fontFamily:G.font,fontWeight:800,fontSize:11,textAlign:"center"}}>▶ Jouer</div>
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
                  👥 Entre potes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Défi du jour */}
        {dailyPlayer && (
          <div style={{borderRadius:14,background:dailyDone?"rgba(255,255,255,.04)":"linear-gradient(135deg,rgba(255,214,0,.12),rgba(255,107,53,.12))",border:dailyDone?"1px solid rgba(255,255,255,.1)":"1.5px solid rgba(255,214,0,.3)",padding:"10px 12px",display:"flex",alignItems:"center",gap:10,opacity:dailyDone?.7:1}}>
            <div style={{fontSize:22}}>{dailyDone?(dailyAbandoned?"🔒":"✅"):"⚡"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",color:dailyDone?"rgba(255,255,255,.3)":"rgba(255,214,0,.7)",marginBottom:1}}>Défi du jour</div>
              <div style={{fontSize:13,fontWeight:800,color:dailyDone?"rgba(255,255,255,.4)":G.white}}>
                {dailyDone ? "Revenez demain 🔒" : "Devine le joueur mystère"}
              </div>
              {dailyDone && <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:1}}>{dailyAbandoned ? "Abandonné — "+dailyPlayer.name : "Trouvé en "+localStorage.getItem("bb_daily_tries")+" essai"+(parseInt(localStorage.getItem("bb_daily_tries")||"1")>1?"s":"")+" !"}</div>}
            </div>
            {!dailyDone && <button onClick={function(){setShowDailyGame(true);setDailyGuess("");setDailyFlash(null);setDailySuccess(false);}} style={{padding:"9px 13px",background:"linear-gradient(135deg,#FFD600,#FF6B35)",color:"#000",border:"none",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>Jouer ⚡</button>}
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
            <div style={{...sheet,borderRadius:"28px 28px 0 0",marginTop:20,zIndex:1,flex:1,justifyContent:"center",overflowY:"auto",paddingBottom:40}}>
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
        <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 14px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:18}}>👥</span>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:G.white}}>Joue avec tes potes !</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>Crée une salle ou rejoins avec un code</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={roomInput} onChange={function(e){setRoomInput(e.target.value.toUpperCase());setRoomMsg("");}}
              placeholder="Code salle" maxLength={6}
              style={{flex:1,padding:"10px 12px",borderRadius:12,border:"1.5px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:G.white,fontFamily:G.font,fontSize:14,fontWeight:700,letterSpacing:3,textTransform:"uppercase",outline:"none"}}/>
            <button onClick={function(){requirePseudo(function(){joinRoom(roomInput);});}} style={{padding:"10px 14px",background:"rgba(255,255,255,.07)",color:G.white,border:"1px solid rgba(255,255,255,.12)",borderRadius:12,cursor:"pointer",fontFamily:G.font,fontSize:13,fontWeight:700}}>Rejoindre</button>
          </div>
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

        {/* WhatsApp communauté */}
        <a href="https://chat.whatsapp.com/GpKyFjaxixCJviQawGHNUp" target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(37,211,102,.1)",border:"1px solid rgba(37,211,102,.3)",borderRadius:14,textDecoration:"none"}}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#25D366"/>
            <path d="M16 7.5C11.306 7.5 7.5 11.306 7.5 16c0 1.76.504 3.4 1.376 4.785L7.5 24.5l3.837-1.356A8.463 8.463 0 0016 24.5c4.694 0 8.5-3.806 8.5-8.5S20.694 7.5 16 7.5z" fill="white"/>
            <path d="M20.844 18.68c-.248-.124-1.47-.725-1.698-.808-.228-.082-.394-.124-.56.124-.165.248-.64.808-.785.973-.144.166-.29.186-.537.062-.248-.124-1.047-.386-1.994-1.23-.737-.657-1.235-1.468-1.38-1.716-.144-.248-.015-.382.109-.505.111-.111.248-.29.372-.435.124-.145.165-.248.248-.414.082-.165.041-.31-.021-.434-.062-.124-.56-1.35-.767-1.848-.202-.485-.408-.42-.56-.427l-.477-.008c-.165 0-.434.062-.662.31-.227.248-.868.848-.868 2.068 0 1.22.889 2.398 1.013 2.563.124.165 1.748 2.67 4.236 3.745.592.255 1.054.407 1.414.521.594.189 1.135.162 1.562.098.476-.071 1.47-.6 1.677-1.18.207-.58.207-1.077.145-1.18-.062-.103-.228-.165-.476-.29z" fill="#25D366"/>
          </svg>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"#25D366"}}>Rejoins la communauté GOAT FC 🐐</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:1}}>Matchs · Discussions foot · Bugs & Idées</div>
          </div>
          <span style={{fontSize:16,color:"rgba(37,211,102,.6)"}}>›</span>
        </a>

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
  if(screen==="chainEnd") return makeResultScreen(chainScore,"chaine",true);

  return <div style={{...shell,justifyContent:"center",alignItems:"center"}}><div style={{color:G.white}}>Chargement…</div></div>;
}
