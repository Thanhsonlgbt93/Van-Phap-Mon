import express from "express";
import http from "http";
import { Server } from "socket.io";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const PORT = process.env.PORT || 10000;
const TIKTOK_USERNAME = (process.env.TIKTOK_USERNAME || "thanhsonlgbt").replace(/^@/, "");

const members = new Map();
let liveConnection = null;
let connectionStatus = "waiting";

app.get("/", (_req, res) => {
  res.json({
    service: "Van Tien Mon LIVE bridge",
    status: connectionStatus,
    tiktokUsername: TIKTOK_USERNAME,
    membersInThisSession: members.size
  });
});

app.get("/api/members", (_req, res) => {
  res.json([...members.values()]);
});

function publishMember(user) {
  const uniqueId = user?.uniqueId;
  if (!uniqueId) return;

  if (!members.has(uniqueId)) {
    const member = {
      uniqueId,
      nickname: user.nickname || uniqueId,
      realm: "Phàm Nhân",
      spiritPower: 100,
      joinedAt: new Date().toISOString()
    };
    members.set(uniqueId, member);
    io.emit("sect:member", member);
    console.log(`Nhập môn: ${member.nickname} (@${uniqueId})`);
  }
}

async function connectToLive() {
  if (liveConnection) return;
  liveConnection = new TikTokLiveConnection(TIKTOK_USERNAME);
  liveConnection.on("connected", () => {
    connectionStatus = "connected";
    io.emit("live:status", { status: connectionStatus });
    console.log(`Đã kết nối LIVE @${TIKTOK_USERNAME}`);
  });
  liveConnection.on(WebcastEvent.MEMBER, (data) => {
    publishMember(data.user);
  });
  liveConnection.on("disconnected", () => {
    connectionStatus = "disconnected";
    io.emit("live:status", { status: connectionStatus });
    liveConnection = null;
  });
  liveConnection.on("error", (err) => {
    connectionStatus = "error";
    io.emit("live:status", { status: connectionStatus, message: String(err?.message || err) });
    console.error("TikTok LIVE error:", err);
  });

  try {
    connectionStatus = "connecting";
    io.emit("live:status", { status: connectionStatus });
    await liveConnection.connect();
  } catch (err) {
    connectionStatus = "offline";
    io.emit("live:status", { status: connectionStatus, message: String(err?.message || err) });
    console.error("Không thể kết nối LIVE:", err);
    liveConnection = null;
  }
}

io.on("connection", (socket) => {
  socket.emit("live:status", { status: connectionStatus });
  socket.emit("sect:initial", [...members.values()]);
});

httpServer.listen(PORT, () => {
  console.log(`Vạn Tiên Môn server listening on ${PORT}`);
  connectToLive();
});
