"use client";

import { useEffect, useRef, useState } from "react";
import { createConsumer } from "@rails/actioncable";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/cable";

type User = {
  id: number;
  username: string;
};

type Room = {
  room_id: number;
  partner_id: number;
  partner_username: string;
  last_message: string | null;
};

type Message = {
  id: number;
  content: string;
  user_id: number;
  room_id: number;
  created_at: string;
};

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  const cableRef = useRef<any>(null);
  const subscriptionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check localStorage for saved user
  useEffect(() => {
    const saved = localStorage.getItem("chatUser");
    if (saved) {
      const user = JSON.parse(saved);
      setCurrentUser(user);
    }
  }, []);

  // Load users for dropdown
  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then((res) => res.json())
      .then(setAllUsers);
  }, []);

  // Connect ActionCable
  useEffect(() => {
    if (!currentUser) return;
    cableRef.current = createConsumer(WS_URL);
    return () => {
      cableRef.current?.disconnect();
    };
  }, [currentUser]);

  // Fetch rooms
  useEffect(() => {
    if (!currentUser) return;
    refreshRooms();
  }, [currentUser]);

  // Helper function untuk refresh rooms
  function refreshRooms() {
    if (!currentUser) return;
    fetch(`${API_URL}/api/rooms?user_id=${currentUser.id}`)
      .then((res) => res.json())
      .then(setRooms);
  }

  // Fetch + Subscribe room
  useEffect(() => {
    if (!activeRoom || !cableRef.current || !currentUser) return;

    fetch(`${API_URL}/api/messages?room_id=${activeRoom.room_id}`)
      .then((res) => res.json())
      .then(setMessages);

    subscriptionRef.current?.unsubscribe();

    subscriptionRef.current = cableRef.current.subscriptions.create(
      {
        channel: "RoomChannel",
        room_id: activeRoom.room_id,
      },
      {
        received(data: Message) {
          console.log("📩 Received:", data);
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
          refreshRooms();
        },
      }
    );

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [activeRoom, currentUser]);

  /* ========================= AUTH ========================= */
  function handleLoginDropdown(userId: number) {
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      localStorage.setItem("chatUser", JSON.stringify(user));
      setCurrentUser(user);
      setError("");
    }
  }

  async function handleRegister() {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    setError("");

    const res = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });

    if (res.ok) {
      const user = await res.json();
      localStorage.setItem("chatUser", JSON.stringify(user));
      setCurrentUser(user);
      setUsername("");

      // Refresh user list
      fetch(`${API_URL}/api/users`)
        .then((res) => res.json())
        .then(setAllUsers);
    } else {
      const errorData = await res.json();
      setError(errorData.errors?.join(", ") || "Registration failed");
    }
  }

  function handleLogout() {
    localStorage.removeItem("chatUser");
    setCurrentUser(null);
    setRooms([]);
    setActiveRoom(null);
    setMessages([]);
  }

  /* ========================= SEND MESSAGE ========================= */
  function sendMessage() {
    if (!text.trim() || !activeRoom || !currentUser) return;

    fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          content: text,
          sender_id: currentUser.id,
          receiver_id: activeRoom.partner_id,
          username: currentUser.username,
        },
      }),
    }).then(() => {
      refreshRooms();
    });

    setText("");
  }

  /* ========================= START NEW CHAT ========================= */
  function startNewChat(userId: number) {
    fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          content: "👋 Started a conversation",
          sender_id: currentUser!.id,
          receiver_id: userId,
          username: currentUser!.username,
        },
      }),
    }).then(() => {
      refreshRooms();
    });
  }

  /* ========================= LOGIN/REGISTER SCREEN ========================= */
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="w-96 p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">
            💬 Simple Chat
          </h1>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setError("");
                setUsername("");
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${isLogin
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                : "bg-slate-700 text-slate-400"
                }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError("");
                setUsername("");
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${!isLogin
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                : "bg-slate-700 text-slate-400"
                }`}
            >
              Register
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {isLogin ? (
            // ================= LOGIN TAB (Dropdown) =================
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Select User (for testing)
              </label>
              <select
                onChange={(e) => handleLoginDropdown(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="" disabled>
                  -- Choose User --
                </option>
                {allUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Quick login for testing/demo purposes
              </p>
            </div>
          ) : (
            // ================= REGISTER TAB (Input) =================
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="Enter unique username..."
                className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
              <button
                onClick={handleRegister}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Register
              </button>
              <p className="text-xs text-slate-500 mt-2">
                Username must be unique
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ========================= CHAT SCREEN ========================= */
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ================= SIDEBAR ================= */}
      <aside className="w-72 border-r border-slate-700 bg-slate-900/50 backdrop-blur-sm flex flex-col">
        <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between text-white">
            <div>
              <div className="font-bold text-lg">💬 Messages</div>
              <div className="text-sm text-blue-100">{currentUser.username}</div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-white/20 rounded-lg text-xs hover:bg-white/30 transition-all"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <button
              key={room.room_id}
              onClick={() => setActiveRoom(room)}
              className={`w-full px-5 py-4 text-left transition-all duration-200 border-b border-slate-800 ${activeRoom?.room_id === room.room_id
                ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-l-4 border-l-blue-500"
                : "hover:bg-slate-800/50"
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {room.partner_username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">
                    {room.partner_username}
                  </div>
                  <div className="text-sm text-slate-400 truncate">
                    {room.last_message ?? "No messages yet"}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-t border-slate-700">
          <details className="group">
            <summary className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold cursor-pointer hover:from-blue-700 hover:to-purple-700 transition-all text-center">
              + New Chat
            </summary>
            <div className="mt-2 max-h-48 overflow-y-auto bg-slate-800 rounded-lg border border-slate-700">
              {allUsers
                .filter((u) => u.id !== currentUser.id)
                .filter((u) => !rooms.some((r) => r.partner_id === u.id))
                .map((user) => (
                  <button
                    key={user.id}
                    onClick={() => startNewChat(user.id)}
                    className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 transition-all"
                  >
                    {user.username}
                  </button>
                ))}
            </div>
          </details>
        </div>
      </aside>

      {/* ================= CHAT ================= */}
      <main className="flex flex-col flex-1">
        {!activeRoom ? (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="text-6xl mb-4">👈</div>
              <div className="text-xl">Select a chat to start messaging</div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {activeRoom.partner_username[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {activeRoom.partner_username}
                  </div>
                  <div className="text-xs text-green-400">● Online</div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map((msg) => {
                const isMe = msg.user_id === currentUser.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-3 rounded-2xl shadow-lg ${isMe
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-sm"
                        : "bg-slate-700 text-white rounded-bl-sm"
                        }`}
                    >
                      <div className="break-words">{msg.content}</div>
                      <div
                        className={`text-xs mt-1 ${isMe ? "text-blue-100" : "text-slate-400"
                          }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm">
              <div className="flex gap-3">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 rounded-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}