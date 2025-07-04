const express = require('express');
const app = express();
const connectDb = require('./config/mongo');
const authRouter = require('./Auth/authRouter');
const interviewJob = require("./interviewJob/interviewJobRouter");
const cors = require('cors');
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const morgan = require('morgan');
const { Server } = require("socket.io");
const http = require("http");
const InterviewJobs = require('./interviewJob/interviewJob');


connectDb();


app.use(morgan('dev'));

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
// 3. JSON Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// 4. Session middleware (for passport)
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true with HTTPS
      httpOnly: true,
    }
  })
);

// 5. Passport initialization
require("./passport/googleStrategy")(passport); // Load your strategy config
app.use(passport.initialize());
app.use(passport.session());

// 6. Routes
app.use('/api/auth', authRouter); // ✅ FIXED this line
app.use('/api/interviewJob', interviewJob);

// 7. Home route
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

// socket code 

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});






//socket logic//
const activeRooms = new Map();

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);
  const userAgent = socket.handshake.headers["user-agent"];
  console.log("📱 Device info:", userAgent);

  socket.on("check-password", async ({ roomId, password }) => {
    const job = await InterviewJobs.findOne({ interviewCode: roomId });
    if (!job) {
      socket.emit("error", { message: "Job not found" });
      return;
    }
    if (job.password !== password) {
      socket.emit("error", { message: "Password is incorrect" });
      return;
    }
    socket.emit("password-is-correct", { roomId });
  })



  socket.on("join-room", async ({ roomId, role }) => {
    console.log("join to room")
    let participants = activeRooms.get(roomId) || [];
    console.log("participants", participants);

    if (participants.includes(socket.id)) {
      console.log("🚫 Already joined:", socket.id);
      return;
    }

    if (participants.length === 0) {
      if (role !== "interviewer") {
        socket.emit("error", { message: "Please wait for the interviewer to join" });
      } else {
        socket.join(roomId);
        participants.push(socket.id);
        activeRooms.set(roomId, participants);
        console.log("✅ Interviewer joined:", socket.id);
        console.log(activeRooms)
      }
    } else if (participants.length == 1) {
      if (role !== "candidate") {
        socket.emit("error", { message: "only candidate can join this time" });
      } else {
        socket.join(roomId);
        participants.push(socket.id);
        activeRooms.set(roomId, participants);
        console.log("✅ Candidate joined:", socket.id);
         socket.to(roomId).emit("user-joined");
        console.log(activeRooms)
      }
    } else {
      if (participants.length == 2) {
        socket.emit("error", { message: "Room is full" });
      }
    }
  });

  socket.on("offer", ({ offer, roomId }) => {
    console.log("offer created ")
    socket.to(roomId).emit("offer", { offer });
  });

  socket.on("answer", ({ answer, roomId }) => {
    console.log("answer created ");
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    socket.to(roomId).emit("ice-candidate", { candidate });
  });


  // console.log("✅ User connected:", socket.id);
  // const userAgent = socket.handshake.headers["user-agent"];
  // console.log("📱 Device info:", userAgent);

  // // ✅ Validate job password
  // socket.on("check-password", async ({ formData }) => {
  //   const job = await InterviewJobs.findOne({ interviewCode: formData.id });

  //   if (!job) {
  //     socket.emit("error", "Job not found");
  //     return;
  //   }

  //   if (job.password !== formData.password) {
  //     socket.emit("error", "Password is incorrect");
  //     return;
  //   }

  // let participants = activeRooms.get(formData.id) || [];
  // console.log(participants.length)
  // if(participants.length == 2){
  //    socket.emit("error", "❌  room is full ");
  //     return;
  // }

  //   socket.emit("password-is-correct", { roomId: formData.id });
  // });

  // // ✅ Join room logic
  // socket.on("join-room", async ({ roomId, role }) => {
  //   let participants = activeRooms.get(roomId) || [];


  //   if (participants.includes(socket.id)) {
  //     console.log("🚫 Already joined:", socket.id);
  //     return;
  //   }

  //   if (participants.length === 0) {
  //     if (role !== "interviewer") {
  //       socket.emit("error", "❌ Only interviewer can join first.");
  //       console.log("❌ Candidate tried to join first.");
  //       return;
  //     }
  //     socket.join(roomId);
  //     participants.push(socket.id);
  //     activeRooms.set(roomId, participants);
  //     console.log("✅ Interviewer joined:", socket.id);
  //     socket.to(roomId).emit("candidate-joined");

  //   } else if (participants.length === 1) {
  //     if (role !== "candidate") {
  //       socket.emit("error", "❌ Only candidate can join now.");
  //       console.log("❌ Another interviewer tried to join.");
  //       return;
  //     }
  //     socket.join(roomId);
  //     participants.push(socket.id);
  //     activeRooms.set(roomId, participants);
  //     console.log("✅ Candidate joined:", socket.id);
  //     socket.to(roomId).emit("candidate-joined");

  //   } else {
  //     socket.emit("error", "❌ Room is full.");
  //     console.log("🚫 Room full:", roomId);
  //   }
  // });

  // // ✅ Forward offer to the other peer
  // socket.on("offer", ({ offer, roomId }) => {
  //   console.log("📡 Received offer from", socket.id);
  //   socket.to(roomId).emit("offer", { offer });
  // });

  // // ✅ Forward answer to the other peer
  // socket.on("answer", ({ answer, roomId }) => {
  //   console.log("📡 Received answer from", socket.id);
  //   socket.to(roomId).emit("answer", { answer });
  // });

  // // ✅ Forward ICE candidate to the other peer
  // socket.on("ice-candidate", ({ candidate, roomId }) => {
  //   socket.to(roomId).emit("ice-candidate", { candidate });
  // });

  // ✅ Disconnect cleanup
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    for (const [roomId, participants] of activeRooms.entries()) {
      const index = participants.indexOf(socket.id);
      if (index !== -1) {
        participants.splice(index, 1);
        console.log(`🧹 Removed ${socket.id} from room ${roomId}`);

        if (participants.length === 0) {
          activeRooms.delete(roomId);
          console.log(`🗑️ Deleted empty room ${roomId}`);
        } else {
          activeRooms.set(roomId, participants); // Update with remaining
        }
        break;
      }
    }
  });
});





// 8. Start server
server.listen(5000, () => {
  console.log(`🚀 Server is running on http://localhost:5000`);
});
