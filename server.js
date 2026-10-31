const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const QUESTIONS = [
  { category:"Logic", level:"Easy", text:"A farmer has 17 sheep. All but 9 run away. How many remain?", answers:["9","nine"], display:"9" },
  { category:"Brain Teaser", level:"Medium", text:"What has cities but no houses, forests but no trees, and rivers but no water?", answers:["a map","map"], display:"A map" },
  { category:"Science", level:"Hard", text:"You overtake the person in second place during a race. What position are you in?", answers:["second","second place","2nd"], display:"Second place" },
  { category:"Tricky Thinking", level:"Very Hard", text:"A clock takes 5 seconds to strike 6 times. How long will it take to strike 12 times, assuming equal intervals?", answers:["11 seconds","eleven seconds","11"], display:"11 seconds" },
  { category:"Final Challenge", level:"Extreme", text:"I am an odd number. Remove one letter and I become even. What number am I?", answers:["seven"], display:"Seven" },
  { category:"Lateral Thinking", level:"Hard", text:"Two fathers and two sons go fishing. They catch three fish, and each person gets one. How many people were there?", answers:["3","three","three people","3 people"], display:"Three people: grandfather, father and son" },
  { category:"Wordplay", level:"Very Hard", text:"What five-letter word becomes shorter when you add two letters to it?", answers:["short"], display:"Short (add 'er' to make shorter)" },
  { category:"Logic", level:"Extreme", text:"A room has four corners. A cat sits in each corner. Each cat sees three cats. How many cats are in the room?", answers:["4","four"], display:"Four cats" },
  { category:"Science", level:"Medium", text:"Which weighs more: one kilogram of iron or one kilogram of feathers?", answers:["same","the same","equal","they weigh the same"], display:"They weigh the same" },
  { category:"Final Showdown", level:"Extreme", text:"If you have me, you want to share me. If you share me, you no longer have me. What am I?", answers:["a secret","secret"], display:"A secret" }
];

const rooms = new Map();
const norm = s => String(s || "").toLowerCase().trim().replace(/[.,!?]/g, "").replace(/\s+/g, " ");
const makeCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

function publicState(room) {
  const players = [...room.players.values()].map(p => ({
    id:p.id, name:p.name, alive:p.alive, score:p.score, connected:p.connected
  })).sort((a,b) => b.score-a.score);
  return {
    code:room.code, status:room.status, round:room.round+1,
    totalRounds:QUESTIONS.length, question:room.status === "question" ? {
      category:QUESTIONS[room.round].category,
      level:QUESTIONS[room.round].level,
      text:QUESTIONS[room.round].text,
      endsAt:room.endsAt
    } : null,
    players, answers:room.answers.map(a => ({
      name:a.name, correct:a.correct, points:a.points, rank:a.rank
    })),
    answerCount:room.answers.length, survivorCount:players.filter(p=>p.alive).length,
    winner:room.winner || null,
    reveal:room.revealed ? QUESTIONS[room.round].display : null
  };
}
function emitRoom(room) { io.to(room.code).emit("state", publicState(room)); }
function finishRound(room) {
  room.status = "roundEnd";
  room.revealed = true;
  emitRoom(room);
}
function maybeFinish(room) {
  const alive = [...room.players.values()].filter(p=>p.alive);
  const unanswered = alive.filter(p=>!room.answers.some(a=>a.id===p.id));
  if (alive.length <= 1) {
    room.winner = alive[0]?.name || null;
    room.status = "finished";
    room.revealed = true;
    emitRoom(room);
  } else if (unanswered.length === 0) finishRound(room);
}

io.on("connection", socket => {
  socket.on("createRoom", ({name}, cb) => {
    const hostName = String(name || "Host").trim().slice(0,24) || "Host";
    let code; do { code=makeCode(); } while(rooms.has(code));
    const room = { code, host:socket.id, hostName, players:new Map(), round:0, status:"lobby", answers:[], endsAt:null, timer:null, revealed:false, winner:null };
    rooms.set(code, room);
    socket.join(code);
    socket.data.room=code; socket.data.role="host";
    cb?.({ok:true, code});
    emitRoom(room);
  });

  socket.on("joinRoom", ({code,name}, cb) => {
    code=String(code||"").trim().toUpperCase();
    const room=rooms.get(code);
    const playerName=String(name||"").trim().slice(0,24);
    if(!room) return cb?.({ok:false,error:"Room not found. Check the code."});
    if(room.status!=="lobby") return cb?.({ok:false,error:"This game has already started."});
    if(!playerName) return cb?.({ok:false,error:"Enter a player name."});
    if(room.players.size>=10) return cb?.({ok:false,error:"This room is full (10 players maximum)."});
    if([...room.players.values()].some(p=>p.name.toLowerCase()===playerName.toLowerCase())) return cb?.({ok:false,error:"That name is already taken."});
    room.players.set(socket.id,{id:socket.id,name:playerName,alive:true,score:0,connected:true});
    socket.join(code); socket.data.room=code; socket.data.role="player";
    cb?.({ok:true});
    emitRoom(room);
  });

  socket.on("startGame", cb => {
    const room=rooms.get(socket.data.room);
    if(!room || room.host!==socket.id) return cb?.({ok:false,error:"Host only."});
    if(room.players.size<2) return cb?.({ok:false,error:"Add at least two players."});
    room.status="question"; room.round=0; room.answers=[]; room.revealed=false;
    emitRoom(room); cb?.({ok:true});
  });

  socket.on("submitAnswer", ({answer}, cb) => {
    const room=rooms.get(socket.data.room);
    const p=room?.players.get(socket.id);
    if(!room || !p || room.status!=="question") return cb?.({ok:false,error:"The question is not accepting answers."});
    if(!p.alive) return cb?.({ok:false,error:"You have been eliminated."});
    if(room.answers.some(a=>a.id===p.id)) return cb?.({ok:false,error:"Your answer has already been locked."});
    const correct=QUESTIONS[room.round].answers.some(a=>norm(a)===norm(answer));
    const correctRank=correct ? room.answers.filter(a=>a.correct).length+1 : null;
    const points=correct ? ([100,75,50,25][Math.min(correctRank-1,3)]) : 0;
    if(!correct) p.alive=false;
    else p.score+=points;
    room.answers.push({id:p.id,name:p.name,answer:String(answer||"").slice(0,200),correct,points,rank:correctRank,at:Date.now()});
    cb?.({ok:true,correct,points,rank:correctRank,eliminated:!correct});
    emitRoom(room); maybeFinish(room);
  });

  socket.on("nextRound", cb => {
    const room=rooms.get(socket.data.room);
    if(!room || room.host!==socket.id) return cb?.({ok:false,error:"Host only."});
    if(room.status!=="roundEnd") return cb?.({ok:false,error:"Finish the current round first."});
    const alive=[...room.players.values()].filter(p=>p.alive);
    if(alive.length<=1 || room.round>=QUESTIONS.length-1) {
      room.winner=alive[0]?.name || null; room.status="finished"; emitRoom(room);
      return cb?.({ok:true,finished:true});
    }
    room.round++; room.answers=[]; room.revealed=false; room.status="question";
    emitRoom(room); cb?.({ok:true});
  });

  socket.on("revealAnswer", cb => {
    const room=rooms.get(socket.data.room);
    if(!room || room.host!==socket.id) return cb?.({ok:false,error:"Host only."});
    room.revealed=true; emitRoom(room); cb?.({ok:true});
  });

  socket.on("disconnect", () => {
    const code=socket.data.room, room=rooms.get(code);
    if(!room) return;
    if(socket.data.role==="player" && room.players.has(socket.id)) {
      room.players.get(socket.id).connected=false;
      emitRoom(room);
    }
    if(room.host===socket.id) {
      io.to(code).emit("notice","The host disconnected. This room is no longer controlled.");
    }
  });
});

server.listen(PORT,()=>console.log(`Trivia Showdown listening on ${PORT}`));
