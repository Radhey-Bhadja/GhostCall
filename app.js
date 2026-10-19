/* ==========================================================================
   MeetWave / WhatsApp-Style WebRTC Mesh Calling App
   Pure Browser Peer-to-Peer Mesh Networking via PeerJS
   Zero Database - Zero Accounts - 100% Client-Side
   ========================================================================== */

// 1. Multi-provider STUN configuration for reliable firewall traversal & NAT routing
const rtcConfiguration = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 10
  }
};

// 2. Application State
const AppState = {
  currentRoomId: null,
  myPeerId: null,
  isRoomHost: false,
  peer: null,

  localStream: null,
  displayStream: null,
  isSharingScreen: false,

  // Active video/audio calls: peerId -> MediaConnection
  peerCalls: new Map(),
  // Active data channels: peerId -> DataConnection
  peerDataChannels: new Map(),
  // Host tracking set of joined peers
  activeParticipants: new Set()
};

// 3. UI References
const UI = {
  heroView: document.getElementById('hero-view'),
  callView: document.getElementById('call-view'),
  videoGrid: document.getElementById('video-grid'),
  waitingScreen: document.getElementById('waiting-screen'),
  localVideo: document.getElementById('local-video'),
  localVideoBox: document.getElementById('local-video-box'),

  // Header info
  roomInfoPill: document.getElementById('header-room-pill'),
  displayRoomId: document.getElementById('display-room-id'),
  participantCountText: document.getElementById('participant-count-text'),
  btnHeaderShare: document.getElementById('btn-header-share'),

  // Controls
  btnMic: document.getElementById('btn-mic'),
  btnCam: document.getElementById('btn-cam'),
  btnScreen: document.getElementById('btn-screen'),
  iconMicOn: document.getElementById('icon-mic-on'),
  iconMicOff: document.getElementById('icon-mic-off'),
  labelMic: document.getElementById('label-mic'),
  iconCamOn: document.getElementById('icon-cam-on'),
  iconCamOff: document.getElementById('icon-cam-off'),
  labelCam: document.getElementById('label-cam'),

  // Banners & Notifications
  alertBanner: document.getElementById('alert-banner'),
  alertText: document.getElementById('alert-text'),
  toastMsg: document.getElementById('toast-msg'),

  // Inputs
  roomInput: document.getElementById('input-room-code')
};

// 4. Lifecycle: Check URL hash on page load
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.replace('#', '').trim();

  if (hash.startsWith('room-')) {
    const extractedId = hash.replace('room-', '').trim();
    if (extractedId.length >= 3) {
      // User arrived directly via a room link! Open room immediately.
      startVideoCallRoom(extractedId);
      return;
    }
  }

  // Otherwise stay on Hero Welcome view
  showHeroView();
});

// Watch URL hash changes (e.g. user pressing back button or pasting link)
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('room-')) {
    const extractedId = hash.replace('room-', '').trim();
    if (extractedId !== AppState.currentRoomId) {
      startVideoCallRoom(extractedId);
    }
  } else if (!hash) {
    if (AppState.currentRoomId) {
      exitCallToHero(false);
    }
  }
});

/* ==========================================================================
   Navigation Views (Hero Page vs Video Calling Room)
   ========================================================================== */
function showHeroView() {
  UI.heroView.style.display = 'flex';
  UI.callView.style.display = 'none';
  UI.roomInfoPill.style.display = 'none';
  UI.btnHeaderShare.style.display = 'none';
  UI.participantCountText.textContent = 'Instant & Free Group Calls';
}

function showCallView() {
  UI.heroView.style.display = 'none';
  UI.callView.style.display = 'flex';
  UI.roomInfoPill.style.display = 'flex';
  UI.btnHeaderShare.style.display = 'inline-flex';
}

// User clicks "Create New Instant Room" on Hero
function createNewRoom() {
  // Generate friendly 6-digit room code
  const randomRoomId = String(Math.floor(100000 + Math.random() * 900000));
  startVideoCallRoom(randomRoomId);
}

// User enters 6-digit code or paste link to join
function joinExistingRoom() {
  let val = UI.roomInput.value.trim();
  if (!val) {
    showToast('Please type a 6-digit room code to join');
    UI.roomInput.focus();
    return;
  }

  // Handle if user pasted full URL
  if (val.includes('#room-')) {
    val = val.split('#room-')[1];
  } else if (val.includes('#')) {
    val = val.split('#')[1];
  }

  // Clean non-alphanumeric
  val = val.replace(/[^a-zA-Z0-9_-]/g, '');

  if (val.length < 3) {
    showToast('Room code must be at least 3 characters');
    return;
  }

  startVideoCallRoom(val);
}

/* ==========================================================================
   Room Initialization & Media Setup
   ========================================================================== */
async function startVideoCallRoom(roomId) {
  AppState.currentRoomId = roomId;
  window.location.hash = `room-${roomId}`;
  UI.displayRoomId.textContent = roomId;
  showCallView();

  UI.participantCountText.textContent = 'Starting camera & connecting...';

  // Step 1: Start Camera & Mic
  await initLocalMediaStream();

  // Step 2: Connect to PeerJS Mesh Network
  initPeerMesh();
}

async function initLocalMediaStream() {
  // Studio-grade audio & sharp video constraints with smart degradation
  const primaryConstraints = {
    video: {
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      frameRate: { ideal: 30, min: 15 },
      facingMode: 'user'
    },
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 1 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
    AppState.localStream = stream;
    UI.localVideo.srcObject = stream;
    dismissAlert();
  } catch (err) {
    console.warn('Primary media constraints failed, attempting basic fallback:', err);
    try {
      // Graceful fallback for basic or mobile devices
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      AppState.localStream = fallbackStream;
      UI.localVideo.srcObject = fallbackStream;
      dismissAlert();
    } catch (fallbackErr) {
      console.warn('Fallback media failed:', fallbackErr);
      AppState.localStream = createFallbackMediaStream();
      UI.localVideo.srcObject = AppState.localStream;

      if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
        showAlert('Camera/Microphone access was blocked. Tap the lock icon in your address bar to allow access.', true);
      } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
        showAlert('No camera or microphone found. You can still watch and hear others.', true);
      } else {
        showAlert('Could not access media devices: ' + (fallbackErr.message || 'Unknown error'), true);
      }
    }
  }
}

// Fallback dummy stream with black canvas and silent audio
function createFallbackMediaStream() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const dst = osc.connect(audioCtx.createMediaStreamDestination());
  osc.start();
  const dummyAudio = dst.stream.getAudioTracks()[0];
  dummyAudio.enabled = false;

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1f2c34';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const canvasStream = canvas.captureStream(10);
  const dummyVideo = canvasStream.getVideoTracks()[0];

  return new MediaStream([dummyAudio, dummyVideo]);
}

/* ==========================================================================
   WebRTC Mesh Networking Logic (PeerJS)
   ========================================================================== */
function initPeerMesh() {
  const hostPeerId = `ghostcall-${AppState.currentRoomId}-host`;

  // First, attempt to claim host peer ID
  AppState.peer = new Peer(hostPeerId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    // Registered successfully as room host!
    AppState.isRoomHost = true;
    AppState.myPeerId = id;
    AppState.activeParticipants.add(myPeerIdOrHost(id));
    console.log('✅ Registered as Room Host:', id);
    updateParticipantsDisplay();
    bindPeerListeners();
  });

  AppState.peer.on('error', (err) => {
    // If ID is already taken, someone is already hosting this room. Join as guest!
    if (err.type === 'unavailable-id') {
      console.log('ℹ️ Host exists in room. Joining as guest participant...');
      joinAsMeshGuest(hostPeerId);
    } else {
      console.error('Peer connection error:', err);
      if (err.type !== 'peer-unavailable') {
        showAlert('Network note: ' + err.type + '. Retrying...', false);
      }
    }
  });
}

function myPeerIdOrHost(id) {
  return id || AppState.myPeerId;
}

function joinAsMeshGuest(hostPeerId) {
  AppState.isRoomHost = false;
  // Generate random guest peer ID
  const guestId = `ghostcall-${AppState.currentRoomId}-guest-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString(36)}`;

  AppState.peer = new Peer(guestId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    AppState.myPeerId = id;
    console.log('✅ Registered as Guest Participant:', id);
    updateParticipantsDisplay();
    bindPeerListeners();

    // 1. Connect to Host via Data Channel to register in room
    connectDataChannelToHost(hostPeerId);

    // 2. Call the Host with our media stream
    establishMediaCall(hostPeerId);
  });

  AppState.peer.on('error', (err) => {
    console.warn('Guest peer error:', err);
  });
}

function bindPeerListeners() {
  // Listen for incoming calls from other peers
  AppState.peer.on('call', (incomingCall) => {
    console.log('📞 Incoming call from:', incomingCall.peer);

    const streamToSend = AppState.isSharingScreen && AppState.displayStream 
      ? AppState.displayStream 
      : AppState.localStream;

    incomingCall.answer(streamToSend);

    // Apply adaptive bitrate and smooth framerate parameters to peer connection
    configureCallParameters(incomingCall);

    incomingCall.on('stream', (remoteStream) => {
      renderRemoteVideoTile(incomingCall.peer, remoteStream);
    });

    incomingCall.on('close', () => {
      removeRemoteVideoTile(incomingCall.peer);
    });

    incomingCall.on('error', (err) => {
      console.warn('Call error with:', incomingCall.peer, err);
      removeRemoteVideoTile(incomingCall.peer);
    });

    AppState.peerCalls.set(incomingCall.peer, incomingCall);
    updateParticipantsDisplay();
  });

  // Listen for data channel connections
  AppState.peer.on('connection', (conn) => {
    setupDataConnection(conn);
  });
}

function setupDataConnection(conn) {
  conn.on('open', () => {
    AppState.peerDataChannels.set(conn.peer, conn);

    if (AppState.isRoomHost) {
      // Send the newly joined guest the list of all peers in room
      conn.send({
        type: 'ROOM_MEMBERS',
        peers: Array.from(AppState.activeParticipants)
      });

      // Add to host's registry
      AppState.activeParticipants.add(conn.peer);

      // Broadcast to all existing peers that a new friend arrived
      broadcastMeshMessage({
        type: 'PEER_JOINED',
        newPeerId: conn.peer
      }, conn.peer);

      updateParticipantsDisplay();
    }
  });

  conn.on('data', (data) => {
    handleMeshSignaling(data, conn.peer);
  });

  conn.on('close', () => {
    AppState.peerDataChannels.delete(conn.peer);
    if (AppState.isRoomHost) {
      AppState.activeParticipants.delete(conn.peer);
      broadcastMeshMessage({
        type: 'PEER_LEFT',
        peerId: conn.peer
      });
    }
    removeRemoteVideoTile(conn.peer);
  });
}

function connectDataChannelToHost(hostId) {
  const conn = AppState.peer.connect(hostId, { reliable: true });

  conn.on('open', () => {
    AppState.peerDataChannels.set(hostId, conn);
    conn.send({ type: 'GUEST_JOINED', peerId: AppState.myPeerId });
  });

  conn.on('data', (data) => {
    handleMeshSignaling(data, hostId);
  });

  conn.on('close', () => {
    console.log('Host connection closed');
    removeRemoteVideoTile(hostId);
  });
}

function handleMeshSignaling(data, fromPeerId) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'ROOM_MEMBERS':
      // The host sent us the list of everyone in the room. Call them!
      if (Array.isArray(data.peers)) {
        data.peers.forEach((peerId) => {
          if (peerId !== AppState.myPeerId && !AppState.peerCalls.has(peerId)) {
            establishMediaCall(peerId);
          }
        });
      }
      break;

    case 'PEER_JOINED':
      // A new participant entered. Call them to complete mesh connection.
      if (data.newPeerId && data.newPeerId !== AppState.myPeerId && !AppState.peerCalls.has(data.newPeerId)) {
        establishMediaCall(data.newPeerId);
      }
      break;

    case 'PEER_LEFT':
      if (data.peerId) {
        removeRemoteVideoTile(data.peerId);
      }
      break;
  }
}

function broadcastMeshMessage(payload, excludePeerId = null) {
  AppState.peerDataChannels.forEach((conn, peerId) => {
    if (peerId !== excludePeerId && conn.open) {
      try {
        conn.send(payload);
      } catch (e) {
        console.warn('Broadcast failed to:', peerId, e);
      }
    }
  });
}

function establishMediaCall(remotePeerId) {
  if (AppState.peerCalls.has(remotePeerId)) return;

  const streamToSend = AppState.isSharingScreen && AppState.displayStream 
    ? AppState.displayStream 
    : AppState.localStream;

  const call = AppState.peer.call(remotePeerId, streamToSend);
  if (!call) return;

  configureCallParameters(call);

  call.on('stream', (remoteStream) => {
    renderRemoteVideoTile(remotePeerId, remoteStream);
  });

  call.on('close', () => {
    removeRemoteVideoTile(remotePeerId);
  });

  call.on('error', (err) => {
    console.warn('Call error with peer', remotePeerId, err);
    removeRemoteVideoTile(remotePeerId);
  });

  AppState.peerCalls.set(remotePeerId, call);
  updateParticipantsDisplay();
  dynamicallyAdjustBitrates();
}

/**
 * Optimizes WebRTC RTP senders for smooth lag-free performance,
 * prioritizing balanced framerate & resolution under varying network conditions.
 */
function configureCallParameters(call) {
  if (!call || !call.peerConnection) return;

  const pc = call.peerConnection;

  // Listen for connection state changes to automatically recover
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
      console.warn(`ICE connection issue with ${call.peer}:`, pc.iceConnectionState);
      if (typeof pc.restartIce === 'function') {
        try { pc.restartIce(); } catch (e) {}
      }
    }
  });

  // Apply bitrate settings once connection is active
  setTimeout(() => {
    tunePeerSenders(pc);
  }, 1000);
}

function tunePeerSenders(pc) {
  if (!pc || !pc.getSenders) return;

  // Dynamically allocate bitrate depending on room size to prevent CPU & upload congestion
  const participantCount = AppState.peerCalls.size + 1;
  let maxVideoBitrate = 1200000; // 1.2 Mbps for 1-on-1 (crystal sharp HD)
  
  if (participantCount >= 5) {
    maxVideoBitrate = 400000; // 400 kbps for 5+ people
  } else if (participantCount >= 3) {
    maxVideoBitrate = 700000; // 700 kbps for 3-4 people
  }

  pc.getSenders().forEach((sender) => {
    if (sender.track && sender.track.kind === 'video') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxVideoBitrate;
        params.encodings[0].networkPriority = 'high';
        params.degradationPreference = 'balanced';
        sender.setParameters(params).catch(() => {});
      } catch (err) {
        // Some older browser engines do not support sender encoding tuning
      }
    }

    if (sender.track && sender.track.kind === 'audio') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = 64000; // 64 kbps Opus high-definition voice
        params.encodings[0].networkPriority = 'high';
        sender.setParameters(params).catch(() => {});
      } catch (err) {}
    }
  });
}

function dynamicallyAdjustBitrates() {
  AppState.peerCalls.forEach((call) => {
    if (call.peerConnection) {
      tunePeerSenders(call.peerConnection);
    }
  });
}

/* ==========================================================================
   DOM Video Grid Rendering & Layout
   ========================================================================== */
function renderRemoteVideoTile(peerId, stream) {
  // Hide waiting banner
  if (UI.waitingScreen) {
    UI.waitingScreen.style.display = 'none';
  }

  let card = document.getElementById(`card-${peerId}`);
  let videoEl;

  if (!card) {
    card = document.createElement('div');
    card.className = 'video-card';
    card.id = `card-${peerId}`;

    videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    const tag = document.createElement('div');
    tag.className = 'user-tag';

    const count = AppState.peerCalls.size;
    const name = peerId.includes('host') ? 'Friend 1 (Host)' : `Friend ${count + 1}`;

    tag.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      </svg>
      <span>${name}</span>
    `;

    card.appendChild(videoEl);
    card.appendChild(tag);
    UI.videoGrid.appendChild(card);
  } else {
    videoEl = card.querySelector('video');
  }

  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
  }

  adjustGridLayout();
  updateParticipantsDisplay();
}

function removeRemoteVideoTile(peerId) {
  if (AppState.peerCalls.has(peerId)) {
    try {
      AppState.peerCalls.get(peerId).close();
    } catch (e) {}
    AppState.peerCalls.delete(peerId);
  }

  if (AppState.peerDataChannels.has(peerId)) {
    AppState.peerDataChannels.delete(peerId);
  }

  const card = document.getElementById(`card-${peerId}`);
  if (card && card.parentNode) {
    card.parentNode.removeChild(card);
  }

  // If nobody is left, show waiting screen again
  if (AppState.peerCalls.size === 0 && UI.waitingScreen) {
    UI.waitingScreen.style.display = 'flex';
  }

  adjustGridLayout();
  updateParticipantsDisplay();
  dynamicallyAdjustBitrates();
}

function adjustGridLayout() {
  const remoteCount = AppState.peerCalls.size;
  UI.videoGrid.className = '';

  if (remoteCount <= 1) {
    UI.videoGrid.classList.add('layout-1');
  } else if (remoteCount === 2) {
    UI.videoGrid.classList.add('layout-2');
  } else if (remoteCount <= 4) {
    UI.videoGrid.classList.add('layout-3');
  } else {
    UI.videoGrid.classList.add('layout-5');
  }
}

function updateParticipantsDisplay() {
  const total = AppState.peerCalls.size + 1; // self + remote peers
  if (total === 1) {
    UI.participantCountText.textContent = 'Only you in this room';
  } else {
    UI.participantCountText.textContent = `${total} people connected`;
  }
}

/* ==========================================================================
   Media Control Handlers (Mute, Camera, Screen Share, Invite, Leave)
   ========================================================================== */
function toggleMicrophone() {
  if (!AppState.localStream) return;
  const audioTracks = AppState.localStream.getAudioTracks();

  if (audioTracks.length === 0) {
    showAlert('No microphone track available.', true);
    return;
  }

  const enabled = !audioTracks[0].enabled;
  audioTracks.forEach(t => t.enabled = enabled);

  if (enabled) {
    UI.btnMic.className = 'ctrl-btn active-green';
    UI.iconMicOn.style.display = 'block';
    UI.iconMicOff.style.display = 'none';
    UI.labelMic.textContent = 'Mic On';
    showToast('Microphone unmuted');
  } else {
    UI.btnMic.className = 'ctrl-btn inactive-red';
    UI.iconMicOn.style.display = 'none';
    UI.iconMicOff.style.display = 'block';
    UI.labelMic.textContent = 'Muted';
    showToast('Microphone muted');
  }
}

function toggleCamera() {
  if (!AppState.localStream) return;
  const videoTracks = AppState.localStream.getVideoTracks();

  if (videoTracks.length === 0) {
    showAlert('No camera track available.', true);
    return;
  }

  const enabled = !videoTracks[0].enabled;
  videoTracks.forEach(t => t.enabled = enabled);

  if (enabled) {
    UI.btnCam.className = 'ctrl-btn active-green';
    UI.iconCamOn.style.display = 'block';
    UI.iconCamOff.style.display = 'none';
    UI.labelCam.textContent = 'Camera';
    showToast('Camera turned on');
  } else {
    UI.btnCam.className = 'ctrl-btn inactive-red';
    UI.iconCamOn.style.display = 'none';
    UI.iconCamOff.style.display = 'block';
    UI.labelCam.textContent = 'Off';
    showToast('Camera turned off');
  }
}

async function toggleScreenShare() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showAlert('Screen sharing is not supported by your current browser or mobile device.', true);
    return;
  }

  if (!AppState.isSharingScreen) {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });

      AppState.displayStream = displayStream;
      AppState.isSharingScreen = true;
      UI.btnScreen.className = 'ctrl-btn active-green';
      const screenLabel = UI.btnScreen.querySelector('.btn-label');
      if (screenLabel) screenLabel.textContent = 'Stop Share';

      const screenVideoTrack = displayStream.getVideoTracks()[0];

      // Update video sender on all active peer connections
      AppState.peerCalls.forEach((call) => {
        try {
          const sender = call.peerConnection?.getSenders()?.find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenVideoTrack);
          }
        } catch (e) {
          console.warn('Could not replace video track for peer:', call.peer, e);
        }
      });

      // Update local preview without mirroring
      UI.localVideo.classList.add('no-mirror');
      UI.localVideo.srcObject = displayStream;

      // Handle user stopping share via browser native banner ("Stop sharing")
      screenVideoTrack.onended = () => {
        stopScreenSharing();
      };

      showToast('Screen sharing started');
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        showAlert('Could not share screen: ' + (err.message || err.name), true);
      }
      console.warn('Screen share cancelled or failed:', err);
    }
  } else {
    stopScreenSharing();
  }
}

function stopScreenSharing() {
  if (!AppState.isSharingScreen) return;
  AppState.isSharingScreen = false;
  UI.btnScreen.className = 'ctrl-btn';
  const screenLabel = UI.btnScreen.querySelector('.btn-label');
  if (screenLabel) screenLabel.textContent = 'Share';

  if (AppState.displayStream) {
    AppState.displayStream.getTracks().forEach(t => t.stop());
    AppState.displayStream = null;
  }

  // Restore camera stream in local preview
  UI.localVideo.classList.remove('no-mirror');
  UI.localVideo.srcObject = AppState.localStream;
  const cameraTrack = AppState.localStream?.getVideoTracks()[0];

  if (cameraTrack) {
    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(cameraTrack);
        }
      } catch (e) {
        console.warn('Could not restore camera track for peer:', call.peer, e);
      }
    });
  }

  showToast('Screen sharing stopped');
}

function copyInviteLink() {
  const link = window.location.href;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast('✅ Link copied! Send it on WhatsApp');
    }).catch(() => fallbackCopy(link));
  } else {
    fallbackCopy(link);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement('input');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  try {
    document.execCommand('copy');
    showToast('✅ Link copied! Send it on WhatsApp');
  } catch (e) {
    prompt('Copy room link:', text);
  }
  document.body.removeChild(temp);
}

function leaveCall() {
  if (confirm('Are you sure you want to leave this call?')) {
    exitCallToHero(true);
  }
}

function exitCallToHero(cleanHash = true) {
  // 1. Stop local tracks
  if (AppState.localStream) {
    AppState.localStream.getTracks().forEach(t => t.stop());
    AppState.localStream = null;
  }
  if (AppState.displayStream) {
    AppState.displayStream.getTracks().forEach(t => t.stop());
    AppState.displayStream = null;
  }

  // 2. Close peer calls
  AppState.peerCalls.forEach(call => {
    try { call.close(); } catch(e) {}
  });
  AppState.peerCalls.clear();
  AppState.peerDataChannels.clear();
  AppState.activeParticipants.clear();

  if (AppState.peer) {
    AppState.peer.destroy();
    AppState.peer = null;
  }

  // 3. Clear remote video elements from grid
  const cards = UI.videoGrid.querySelectorAll('.video-card');
  cards.forEach(c => c.remove());
  if (UI.waitingScreen) UI.waitingScreen.style.display = 'flex';

  // 4. Reset URL hash and show Hero view
  AppState.currentRoomId = null;
  if (cleanHash) {
    history.pushState("", document.title, window.location.pathname + window.location.search);
  }
  showHeroView();
  showToast('You left the video call');
}

/* ==========================================================================
   Alert & Toast Helpers
   ========================================================================== */
function showAlert(text, isError = true) {
  if (UI.alertBanner && UI.alertText) {
    UI.alertText.textContent = text;
    UI.alertBanner.style.background = isError ? 'var(--danger-red)' : 'var(--primary-green)';
    UI.alertBanner.style.display = 'flex';
  }
}

function dismissAlert() {
  if (UI.alertBanner) UI.alertBanner.style.display = 'none';
}

let toastTimer = null;
function showToast(text) {
  if (UI.toastMsg) {
    UI.toastMsg.textContent = text;
    UI.toastMsg.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      UI.toastMsg.classList.remove('show');
    }, 3200);
  }
}

// Expand self preview on click
let isSelfExpanded = false;
UI.localVideoBox.addEventListener('click', () => {
  if (!isSelfExpanded) {
    UI.localVideoBox.style.width = '240px';
    UI.localVideoBox.style.height = '180px';
    isSelfExpanded = true;
  } else {
    UI.localVideoBox.style.width = '';
    UI.localVideoBox.style.height = '';
    isSelfExpanded = false;
  }
});
