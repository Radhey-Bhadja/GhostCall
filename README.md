# 👻 GhostCall

> **Zero Login, Zero Database, Instant Multi-Party WebRTC Video Calling**  
> Modern, ultra-private, and designed for everyone — from kids to grandparents.

GhostCall is a lightning-fast, secure group video calling web application that requires no login, no registration, and no database. Built with pure browser WebRTC mesh networking, it enables you to create or join private video rooms instantly via simple 6-digit codes or direct invite links, supporting low-latency multi-party video calls with end-to-end data privacy.

![GhostCall Logo](logo.png)

---

## ✨ Features & Upgrades

- **No Logins & No Accounts**: Zero passwords, credentials, or tracking. Jump in and talk in 1 second.
- **Mesh Peer-to-Peer Architecture**: Direct browser-to-browser WebRTC connection powered by [PeerJS](https://peerjs.com/) and public STUN servers.
- **Deterministic Glare-Free WebRTC Mesh**: Eliminates call collision loops, audio echo, and duplicate video cards.
- **Active Speaker Detection**: Real-time Web Audio API frequency analysis highlighting current speakers with an emerald glow.
- **Live In-Call P2P Chat**: Private slide-out messaging drawer with unread badge counter, sent directly over DataChannels with zero server storage.
- **Floating Emoji Reactions**: Send live reactions (❤️, 👍, 😂, 👏, 🎉, 🔥) that float dynamically across peers' screens.
- **Camera Flip & Device Flexibility**: 1-tap camera toggle between front and environment cameras on mobile devices.
- **Draggable & Expandable PiP Self-View**: Move your local preview anywhere on screen or double-click to enlarge.
- **Smart Room Sharing**:
  - 1-click room creation generates a 6-digit room code and direct URL hash (`#room-582910`).
  - Native Web Share API integration on mobile.
  - Direct 1-tap WhatsApp sharing (`https://api.whatsapp.com/send?text=...`).
- **Essential Controls & Shortcuts**:
  - 🎙️ Mute / Unmute Microphone (`M`)
  - 📹 Turn Camera On / Off (`V`)
  - 💻 Screen Sharing with live track replacement (`S`)
  - 💬 Toggle In-Call Chat Drawer (`C`)
  - ⏱️ Live Call Duration Timer
  - 🔴 Smooth Leave Call confirmation dialog and instant **Rejoin Room** option.
- **Responsive & Accessible**: Optimized for mobile, tablet, and desktop screens with safe-area insets.

---

## 🚀 Live Deployment (Vercel)

GhostCall has zero backend dependencies. To deploy:

1. Import this repository into [Vercel](https://vercel.com/new).
2. Click **Deploy** (no build command or environment variables required).

Or deploy via terminal:
```bash
npx vercel
```

---

## 💻 Local Development

Run any static HTTP server in the repository root:

```bash
# Python
python -m http.server 8000

# or Node.js
npx serve .
```

Open `http://localhost:8000` in your browser.

---

## 🛠️ Tech Stack

- **HTML5 & CSS3** (Vanilla, responsive CSS Grid and Flexbox, Glassmorphism, animations)
- **Vanilla JavaScript (ES6+)**
- **WebRTC & PeerJS** (Signaling, MediaStreams, and DataChannels)
- **Web Audio API** (Real-time AnalyserNode for active speaker detection)
- **Google STUN** (`stun:stun.l.google.com:19302`) for NAT traversal
