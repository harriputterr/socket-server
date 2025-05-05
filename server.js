const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
require('dotenv').config();

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Map to store users in rooms
const roomUsers = new Map()

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Handle room join
  socket.on("room:join", (data) => {
    const { roomId, username } = data

    // Join the socket to the room
    socket.join(roomId)

    // Store user in room map
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, [])
    }
    roomUsers.get(roomId).push({ id: socket.id, username })

    // Notify the user they've joined
    socket.emit("room:join", { roomId, username })

    // Notify other users in the room
    socket.to(roomId).emit("user:joined", { id: socket.id, username })

    console.log(`${username} joined room ${roomId}`)
  })

  // Handle call initiation
  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incoming:call", { from: socket.id, offer })
  })

  // Handle call acceptance
  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans })
  })

  // Handle ICE candidates
  socket.on("ice:candidate", ({ to, candidate }) => {
    io.to(to).emit("ice:candidate", { from: socket.id, candidate })
  })

  // Handle call end
  socket.on("call:end", ({ to }) => {
    io.to(to).emit("call:ended", { from: socket.id })
  })

  // Handle negotiation needed
  socket.on("peer:nego:needed", ({ to, offer }) => {
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer })
  })

  // Handle negotiation done
  socket.on("peer:nego:done", ({ to, ans }) => {
    io.to(to).emit("peer:nego:final", { from: socket.id, ans })
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // Remove user from all rooms
    roomUsers.forEach((users, roomId) => {
      const userIndex = users.findIndex((user) => user.id === socket.id)
      if (userIndex !== -1) {
        const user = users[userIndex]
        users.splice(userIndex, 1)

        // Notify others in the room
        socket.to(roomId).emit("user:left", { id: socket.id, username: user.username })

        console.log(`${user.username} left room ${roomId}`)
      }
    })
  })
})

const PORT = process.env.PORT || 8000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
