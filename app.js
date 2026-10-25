/* ==========================================================================
   GhostCall — High Performance Pure Browser WebRTC Video Calling
   Full-Stack Architecture: Peer-to-Peer Mesh Networking via PeerJS
   Zero Database • Zero Logins • End-to-End Browser Media Channels
   ========================================================================== */

// 1. Multi-provider STUN configuration for reliable NAT & firewall traversal
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

// 2. Application Reactive State
const AppState = {
  currentRoomId: null,
  lastRoomId: null,
  myPeerId: null,
  myDisplayName: localStorage.getItem('ghostcall_username') || '',
  isRoomHost: false,
  isJoiningAsGuest: false,
  peer: null,

  localStream: null,
  displayStream: null,
  isSharingScreen: false,
  facingMode: 'user', // 'user' or 'environment' for mobile camera flip
  isCameraMuted: false,
  isMicMuted: false,

  // Connections & Mesh state
  peerCalls: new Map(),         // peerId -> MediaConnection
  peerDataChannels: new Map(),  // peerId -> DataConnection
  peerProfiles: new Map(),      // peerId -> { name, videoEnabled, audioEnabled }
  activeParticipants: new Set(),// Host set of peer IDs

  // Active Speaker & Audio Analysis
  audioContext: null,
  audioAnalysers: new Map(),    // peerId ('local' or remote) -> AnalyserNode
  isAudioAnalysisRunning: false,

  // UI state
  callStartTime: null,
  callTimerInterval: null,
  unreadChatCount: 0,
  isChatOpen: false,
  isConnectingInitialHost: false,
  isSwappedVideo: false
};

// 3. Cached DOM References
const UI = {
  body: document.body,
  heroView: document.getElementById('hero-view'),
  callView: document.getElementById('call-view'),
  callStage: document.getElementById('call-stage'),
  videoGrid: document.getElementById('video-grid'),
  waitingScreen: document.getElementById('waiting-screen'),
  localVideo: document.getElementById('local-video'),
  localVideoBox: document.getElementById('local-video-box'),
  localAvatar: document.getElementById('local-avatar'),
  localAvatarInitial: document.getElementById('local-avatar-initial'),
  localAvatarName: document.getElementById('local-avatar-name'),
  localTagName: document.getElementById('local-tag-name'),
  localMicMini: document.getElementById('local-mic-mini'),
  btnCameraFlip: document.getElementById('btn-camera-flip'),

  // Header
  appHeader: document.getElementById('app-header'),
  roomInfoPill: document.getElementById('header-room-pill'),
  participantsPill: document.getElementById('header-participants-pill'),
  displayRoomId: document.getElementById('display-room-id'),
  participantCountText: document.getElementById('participant-count-text'),
  btnHeaderShare: document.getElementById('btn-header-share'),
  headerCallTimer: document.getElementById('header-call-timer'),
  callDurationText: document.getElementById('call-duration-text'),

  // Controls Dock
  btnMic: document.getElementById('btn-mic'),
  btnCam: document.getElementById('btn-cam'),
  btnScreen: document.getElementById('btn-screen'),
  btnReactions: document.getElementById('btn-reactions'),
  btnChat: document.getElementById('btn-chat'),
  chatUnreadBadge: document.getElementById('chat-unread-badge'),
  iconMicOn: document.getElementById('icon-mic-on'),
  iconMicOff: document.getElementById('icon-mic-off'),
  labelMic: document.getElementById('label-mic'),
  iconCamOn: document.getElementById('icon-cam-on'),
  iconCamOff: document.getElementById('icon-cam-off'),
  labelCam: document.getElementById('label-cam'),
  labelScreen: document.getElementById('label-screen'),

  // Banners & Notifications
  alertBanner: document.getElementById('alert-banner'),
  alertText: document.getElementById('alert-text'),
  toastMsg: document.getElementById('toast-msg'),
  toastIcon: document.getElementById('toast-icon'),
  toastText: document.getElementById('toast-text'),

  // Chat Drawer
  chatDrawer: document.getElementById('chat-drawer'),
  chatMessagesList: document.getElementById('chat-messages-list'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),

  // Reactions
  reactionsContainer: document.getElementById('reactions-container'),
  reactionsPicker: document.getElementById('reactions-picker'),

  // Modals
  modalLeave: document.getElementById('modal-leave'),
  modalRejoin: document.getElementById('modal-rejoin'),
  rejoinRoomId: document.getElementById('rejoin-room-id'),
  modalShare: document.getElementById('modal-share'),
  shareModalCode: document.getElementById('share-modal-code'),
  shareModalLinkInput: document.getElementById('share-modal-link-input'),

  // Inputs
  nameInput: document.getElementById('input-display-name'),
  heroAvatarPreview: document.getElementById('hero-avatar-preview'),
  roomInput: document.getElementById('input-room-code'),
  roomInputError: document.getElementById('room-input-error'),
  codeEntryContainer: document.getElementById('code-entry-container')
};

// 4. Lifecycle: Initialization & Event Listeners
window.addEventListener('DOMContentLoaded', () => {
  initUserPreferences();
  initDragPip();
  initGlobalKeyboardShortcuts();
  checkUrlHashOnLoad();
});

// Watch Navigation & Back Button Events
window.addEventListener('popstate', () => {
  // Case 1: User is in chat drawer and clicks Back -> close chat drawer & stay in video call!
  if (AppState.isChatOpen) {
    closeChatDrawer(false);
    return;
  }

  // Case 2: User is in active call and clicks Back -> show "Are you sure to end call?" modal!
  if (AppState.currentRoomId) {
    window.location.hash = `room-${AppState.currentRoomId}`;
    try {
      history.pushState({ inRoom: true, room: AppState.currentRoomId }, '', window.location.href);
    } catch (err) {}
    confirmLeaveCall();
  }
});

// Watch URL hash navigation
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('room-')) {
    const extractedId = hash.replace('room-', '').trim();
    if (extractedId && extractedId !== AppState.currentRoomId) {
      startVideoCallRoom(extractedId, true);
    }
  } else if (!hash && AppState.currentRoomId) {
    if (AppState.isChatOpen) {
      closeChatDrawer(false);
      window.location.hash = `room-${AppState.currentRoomId}`;
    } else {
      window.location.hash = `room-${AppState.currentRoomId}`;
      confirmLeaveCall();
    }
  }
});

// Warn user before closing tab / reloading while in active call
window.addEventListener('beforeunload', (e) => {
  if (AppState.currentRoomId) {
    e.preventDefault();
    e.returnValue = 'Are you sure you want to end or leave this call?';
    return e.returnValue;
  }
});

function initUserPreferences() {
  if (AppState.myDisplayName && UI.nameInput) {
    UI.nameInput.value = AppState.myDisplayName;
    updateHeroAvatarPreview(AppState.myDisplayName);
  }

  if (UI.nameInput) {
    UI.nameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      AppState.myDisplayName = val;
      localStorage.setItem('ghostcall_username', val);
      updateHeroAvatarPreview(val);
      updateLocalDisplayName(val || 'You');
      broadcastProfileUpdate();
    });
  }

  if (UI.roomInput) {
    UI.roomInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        joinExistingRoom();
      }
    });

    UI.roomInput.addEventListener('input', () => {
      clearRoomInputError();
    });
  }

  // Detect mobile device to show camera flip button
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && UI.btnCameraFlip) {
    UI.btnCameraFlip.style.display = 'flex';
  }
}

function updateHeroAvatarPreview(name) {
  if (!UI.heroAvatarPreview) return;
  const initial = name ? name.charAt(0).toUpperCase() : '👤';
  UI.heroAvatarPreview.textContent = initial;
}

function updateLocalDisplayName(name) {
  const displayName = name || 'You';
  if (UI.localTagName) UI.localTagName.textContent = displayName;
  if (UI.localAvatarName) UI.localAvatarName.textContent = displayName;
  if (UI.localAvatarInitial) {
    UI.localAvatarInitial.textContent = displayName.charAt(0).toUpperCase();
  }
}

function checkUrlHashOnLoad() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('room-')) {
    const extractedId = hash.replace('room-', '').trim();
    if (extractedId.length >= 3) {
      // Direct room link join!
      startVideoCallRoom(extractedId, true);
      return;
    }
  }
  showHeroView();
}

/* ==========================================================================
   Navigation Views (Hero Landing vs Video Call Canvas)
   ========================================================================== */
function showHeroView() {
  UI.body.classList.remove('in-call-mode');
  UI.heroView.style.display = 'flex';
  UI.callView.style.display = 'none';
  UI.roomInfoPill.style.display = 'none';
  if (UI.participantsPill) UI.participantsPill.style.display = 'none';
  UI.btnHeaderShare.style.display = 'none';
  UI.headerCallTimer.style.display = 'none';
  stopCallTimer();
  stopAudioAnalysis();
}

function showCallView() {
  UI.body.classList.add('in-call-mode');
  UI.heroView.style.display = 'none';
  UI.callView.style.display = 'flex';
  UI.roomInfoPill.style.display = 'inline-flex';
  if (UI.participantsPill) UI.participantsPill.style.display = 'inline-flex';
  UI.btnHeaderShare.style.display = 'inline-flex';
  UI.headerCallTimer.style.display = 'inline-flex';

  if (UI.localVideoBox) {
    UI.localVideoBox.style.left = '';
    UI.localVideoBox.style.top = '';
    UI.localVideoBox.style.right = '';
    UI.localVideoBox.style.bottom = '';
    UI.localVideoBox.classList.remove('is-expanded');
  }

  startCallTimer();
}

function handleBrandClick() {
  if (AppState.currentRoomId) {
    confirmLeaveCall();
  } else {
    showHeroView();
  }
}

/* ==========================================================================
   Room Creation & Join Logic
   ========================================================================== */
function createNewRoom() {
  // Generate user-friendly 6-digit room code
  const randomRoomId = String(Math.floor(100000 + Math.random() * 900000));
  startVideoCallRoom(randomRoomId, false);
}

function joinExistingRoom() {
  let val = UI.roomInput.value.trim();
  if (!val) {
    showRoomInputError('Please enter a 6-digit room code');
    UI.roomInput.focus();
    return;
  }

  // Handle pasted URL formats (e.g. https://domain.com/#room-582910)
  if (val.includes('#room-')) {
    val = val.split('#room-')[1];
  } else if (val.includes('#')) {
    val = val.split('#')[1];
  }

  // Strip query params or spaces
  if (val.includes('?')) val = val.split('?')[0];
  val = val.replace(/[^a-zA-Z0-9_-]/g, '');

  if (val.length < 3) {
    showRoomInputError('Code is too short! Check your invite code');
    return;
  }

  clearRoomInputError();
  startVideoCallRoom(val, true);
}

function showRoomInputError(msg) {
  if (UI.codeEntryContainer) UI.codeEntryContainer.classList.add('has-error');
  if (UI.roomInputError) {
    UI.roomInputError.textContent = msg;
    UI.roomInputError.style.display = 'block';
  }
}

function clearRoomInputError() {
  if (UI.codeEntryContainer) UI.codeEntryContainer.classList.remove('has-error');
  if (UI.roomInputError) {
    UI.roomInputError.textContent = '';
    UI.roomInputError.style.display = 'none';
  }
}

/* ==========================================================================
   Room Initialization & Media Setup
   ========================================================================== */
async function startVideoCallRoom(roomId, isGuest = false) {
  AppState.currentRoomId = roomId;
  AppState.lastRoomId = roomId;
  AppState.isJoiningAsGuest = isGuest;
  AppState.isConnectingInitialHost = isGuest;

  window.location.hash = `room-${roomId}`;
  try {
    history.replaceState({ inRoom: true, room: roomId }, '', window.location.href);
  } catch (e) {}
  UI.displayRoomId.textContent = roomId;
  if (UI.shareModalCode) UI.shareModalCode.textContent = roomId;
  if (UI.shareModalLinkInput) UI.shareModalLinkInput.value = window.location.href;

  updateLocalDisplayName(AppState.myDisplayName || 'You');
  showCallView();
  if (UI.participantCountText) {
    UI.participantCountText.textContent = 'Connecting...';
  }

  // Step 1: Start Camera & Mic
  await initLocalMediaStream();

  // Step 2: Initialize WebRTC Mesh
  initPeerMesh();

  // Step 3: Start Active Speaker detection
  startAudioAnalysis();
}

async function initLocalMediaStream() {
  const primaryConstraints = {
    video: {
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30, min: 24 },
      facingMode: AppState.facingMode
    },
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      sampleRate: { ideal: 48000 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
    attachLocalStream(stream);
    dismissAlert();
  } catch (err) {
    console.warn('Primary media constraints failed, trying basic fallback:', err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: AppState.facingMode },
        audio: true
      });
      attachLocalStream(fallbackStream);
      dismissAlert();
    } catch (fallbackErr) {
      console.warn('Fallback media failed:', fallbackErr);
      const dummyStream = createFallbackMediaStream();
      attachLocalStream(dummyStream);

      if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
        showAlert('Camera & Microphone access was blocked. Tap the lock icon in your address bar to allow.', true);
      } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
        showAlert('No camera or microphone found. You can still watch & listen.', true);
      } else {
        showAlert('Media device error: ' + (fallbackErr.message || 'Unknown error'), true);
      }
    }
  }
}

function attachLocalStream(stream) {
  AppState.localStream = stream;
  UI.localVideo.srcObject = stream;
  setupAudioAnalyser('local', stream);
}

// Fallback dummy stream with black canvas and silent audio track
function createFallbackMediaStream() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let dummyAudio;
  if (AudioContextClass) {
    try {
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const dst = osc.connect(audioCtx.createMediaStreamDestination());
      osc.start();
      dummyAudio = dst.stream.getAudioTracks()[0];
      dummyAudio.enabled = false;
      dummyAudio.addEventListener('ended', () => {
        try { osc.stop(); audioCtx.close(); } catch (e) {}
      });
    } catch (e) {
      console.warn('AudioContext fallback error:', e);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const canvasStream = canvas.captureStream(10);
  const dummyVideo = canvasStream.getVideoTracks()[0];

  const tracks = [];
  if (dummyAudio) tracks.push(dummyAudio);
  if (dummyVideo) tracks.push(dummyVideo);

  return new MediaStream(tracks);
}

/* ==========================================================================
   WebRTC Mesh Networking Logic (PeerJS)
   ========================================================================== */
function initPeerMesh() {
  const hostPeerId = `ghostcall-${AppState.currentRoomId}-host`;

  if (AppState.isJoiningAsGuest) {
    joinAsMeshGuest(hostPeerId);
    return;
  }

  // Create room as Host
  AppState.peer = new Peer(hostPeerId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    AppState.isRoomHost = true;
    AppState.myPeerId = id;
    AppState.activeParticipants.add(id);
    console.log('✅ Registered as Room Host:', id);
    updateParticipantsDisplay();
    bindPeerListeners();
    showToast('Room created! Ready for friends');
  });

  AppState.peer.on('error', (err) => {
    // If ID is already taken, someone already hosts this room. Join as guest!
    if (err.type === 'unavailable-id') {
      console.log('ℹ️ Host exists in room. Joining as guest participant...');
      joinAsMeshGuest(hostPeerId);
    } else {
      console.error('Peer connection error:', err);
      if (err.type !== 'peer-unavailable') {
        showAlert('Network error: ' + (err.message || err.type), false);
      }
    }
  });
}

function joinAsMeshGuest(hostPeerId) {
  AppState.isRoomHost = false;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const guestId = `ghostcall-${AppState.currentRoomId}-guest-${randomSuffix}-${Date.now().toString(36)}`;

  AppState.peer = new Peer(guestId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    AppState.myPeerId = id;
    console.log('✅ Registered as Guest Participant:', id);
    updateParticipantsDisplay();
    bindPeerListeners();

    // 1. Establish Data Channel connection with host
    connectDataChannelToHost(hostPeerId);

    // 2. Call the Host (Deterministic glare prevention: only guest initiates call to host)
    establishMediaCall(hostPeerId);
  });

  AppState.peer.on('error', (err) => {
    console.warn('Guest peer error event:', err);
    if (err.type === 'peer-unavailable') {
      // Only fatal if host was unavailable during initial join
      if (AppState.isConnectingInitialHost) {
        AppState.isConnectingInitialHost = false;
        showAlert('Room not found or host has left. You can start a new room instead.', true);
        showToast('Room not found or host has left');
        setTimeout(() => {
          exitCallToHero(true);
        }, 2200);
      }
    } else {
      showAlert('Connection error: ' + (err.message || err.type), false);
    }
  });
}

function bindPeerListeners() {
  if (!AppState.peer) return;

  // Incoming media calls
  AppState.peer.on('call', (incomingCall) => {
    console.log('📞 Incoming call from:', incomingCall.peer);

    const streamToSend = AppState.isSharingScreen && AppState.displayStream 
      ? AppState.displayStream 
      : AppState.localStream;

    incomingCall.answer(streamToSend);
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

  // Incoming data connections
  AppState.peer.on('connection', (conn) => {
    setupDataConnection(conn);
  });
}

function setupDataConnection(conn) {
  conn.on('open', () => {
    AppState.peerDataChannels.set(conn.peer, conn);

    // Send our profile to the newly connected peer
    conn.send({
      type: 'PROFILE_UPDATE',
      peerId: AppState.myPeerId,
      name: AppState.myDisplayName || 'Friend',
      videoEnabled: !AppState.isCameraMuted,
      audioEnabled: !AppState.isMicMuted
    });

    if (AppState.isRoomHost) {
      AppState.isConnectingInitialHost = false;

      // Host sends current member list to the newcomer
      conn.send({
        type: 'ROOM_MEMBERS',
        peers: Array.from(AppState.activeParticipants),
        profiles: Object.fromEntries(AppState.peerProfiles)
      });

      // Add to host's registry
      AppState.activeParticipants.add(conn.peer);

      // Broadcast new participant arrival to all other peers
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
    handlePeerDisconnect(conn.peer);
  });
}

function connectDataChannelToHost(hostId) {
  const conn = AppState.peer.connect(hostId, { reliable: true });

  conn.on('open', () => {
    AppState.isConnectingInitialHost = false;
    AppState.peerDataChannels.set(hostId, conn);

    conn.send({
      type: 'GUEST_JOINED',
      peerId: AppState.myPeerId,
      name: AppState.myDisplayName || 'Friend',
      videoEnabled: !AppState.isCameraMuted,
      audioEnabled: !AppState.isMicMuted
    });
  });

  conn.on('data', (data) => {
    handleMeshSignaling(data, hostId);
  });

  conn.on('close', () => {
    console.log('Host data connection closed');
    handlePeerDisconnect(hostId);
  });
}

function handlePeerDisconnect(peerId) {
  AppState.peerDataChannels.delete(peerId);
  AppState.peerProfiles.delete(peerId);

  if (AppState.isRoomHost) {
    AppState.activeParticipants.delete(peerId);
    broadcastMeshMessage({
      type: 'PEER_LEFT',
      peerId: peerId
    });
  }

  removeRemoteVideoTile(peerId);
}

function handleMeshSignaling(data, fromPeerId) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'ROOM_MEMBERS':
      AppState.isConnectingInitialHost = false;
      if (data.profiles) {
        Object.entries(data.profiles).forEach(([pid, prof]) => {
          AppState.peerProfiles.set(pid, prof);
        });
      }

      if (Array.isArray(data.peers)) {
        data.peers.forEach((peerId) => {
          if (peerId !== AppState.myPeerId) {
            // Glare-free mesh: Only initiate call if our peerId is lexicographically greater
            if (!AppState.peerCalls.has(peerId) && AppState.myPeerId > peerId) {
              establishMediaCall(peerId);
            }
          }
        });
      }
      break;

    case 'PEER_JOINED':
      if (data.newPeerId && data.newPeerId !== AppState.myPeerId) {
        if (!AppState.peerCalls.has(data.newPeerId) && AppState.myPeerId > data.newPeerId) {
          establishMediaCall(data.newPeerId);
        }
      }
      break;

    case 'PROFILE_UPDATE':
    case 'GUEST_JOINED':
      if (data.peerId) {
        AppState.peerProfiles.set(data.peerId, {
          name: data.name || 'Friend',
          videoEnabled: data.videoEnabled !== false,
          audioEnabled: data.audioEnabled !== false
        });
        updateRemoteTileProfile(data.peerId);
      }
      break;

    case 'PEER_LEFT':
      if (data.peerId) {
        removeRemoteVideoTile(data.peerId);
      }
      break;

    case 'CHAT_MESSAGE':
      appendChatMessage(data.senderName, data.text, false, data.time);
      break;

    case 'REACTION':
      triggerFloatingReaction(data.emoji);
      break;
  }
}

function broadcastMeshMessage(payload, excludePeerId = null) {
  AppState.peerDataChannels.forEach((conn, peerId) => {
    if (peerId !== excludePeerId && conn.open) {
      try {
        conn.send(payload);
      } catch (e) {
        console.warn('Broadcast error to:', peerId, e);
      }
    }
  });
}

function broadcastProfileUpdate() {
  broadcastMeshMessage({
    type: 'PROFILE_UPDATE',
    peerId: AppState.myPeerId,
    name: AppState.myDisplayName || 'Friend',
    videoEnabled: !AppState.isCameraMuted,
    audioEnabled: !AppState.isMicMuted
  });
}

function establishMediaCall(remotePeerId) {
  if (AppState.peerCalls.has(remotePeerId)) return;

  const streamToSend = AppState.isSharingScreen && AppState.displayStream 
    ? AppState.displayStream 
    : AppState.localStream;

  if (!streamToSend) return;

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
    console.warn('Call error with peer:', remotePeerId, err);
    removeRemoteVideoTile(remotePeerId);
  });

  AppState.peerCalls.set(remotePeerId, call);
  updateParticipantsDisplay();
  dynamicallyAdjustBitrates();
}

/**
 * Configure WebRTC ICE connection and adaptive RTP bitrates
 */
function configureCallParameters(call) {
  if (!call || !call.peerConnection) return;
  const pc = call.peerConnection;

  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
      console.warn(`ICE issue with ${call.peer}:`, pc.iceConnectionState);
      if (typeof pc.restartIce === 'function') {
        try { pc.restartIce(); } catch (e) {}
      }
    }
  });

  setTimeout(() => {
    tunePeerSenders(pc);
  }, 1000);
}

function tunePeerSenders(pc) {
  if (!pc || !pc.getSenders) return;

  const participantCount = AppState.peerCalls.size + 1;
  let maxVideoBitrate = AppState.isSharingScreen ? 3000000 : 2500000;
  
  if (participantCount >= 5) {
    maxVideoBitrate = 800000;
  } else if (participantCount >= 3) {
    maxVideoBitrate = 1400000;
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
        params.degradationPreference = AppState.isSharingScreen ? 'maintain-resolution' : 'maintain-framerate';
        sender.setParameters(params).catch(() => {});
      } catch (err) {}
    }

    if (sender.track && sender.track.kind === 'audio') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = 64000;
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
   DOM Video Grid Rendering & Remote Tiles
   ========================================================================== */
function renderRemoteVideoTile(peerId, stream) {
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

    // Remote avatar placeholder
    const profile = AppState.peerProfiles.get(peerId) || { name: 'Friend' };
    const initial = profile.name.charAt(0).toUpperCase();

    const avatar = document.createElement('div');
    avatar.className = 'avatar-placeholder';
    avatar.id = `avatar-${peerId}`;
    avatar.style.display = 'none';
    avatar.innerHTML = `
      <div class="avatar-circle">
        <span class="avatar-initial">${initial}</span>
      </div>
      <span class="avatar-name">${profile.name}</span>
    `;

    // User Tag Pill
    const tag = document.createElement('div');
    tag.className = 'user-tag';
    tag.id = `tag-${peerId}`;
    tag.innerHTML = `
      <span class="mic-badge" id="mic-badge-${peerId}">
        <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>
      </span>
      <span class="tag-name-text">${profile.name}</span>
    `;

    card.appendChild(videoEl);
    card.appendChild(avatar);
    card.appendChild(tag);
    UI.videoGrid.appendChild(card);
  } else {
    videoEl = card.querySelector('video');
  }

  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
    videoEl.play().catch(e => console.log('Autoplay hint:', e));
  }

  // Setup active speaker audio analysis for remote stream
  setupAudioAnalyser(peerId, stream);

  // Track state listeners
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    const avatarEl = card.querySelector('.avatar-placeholder');
    const updateAvatarVisibility = () => {
      if (avatarEl) {
        avatarEl.style.display = (!videoTrack.enabled || videoTrack.muted) ? 'flex' : 'none';
      }
    };
    videoTrack.onmute = updateAvatarVisibility;
    videoTrack.onunmute = updateAvatarVisibility;
    updateAvatarVisibility();
  }

  adjustGridLayout();
  updateParticipantsDisplay();
  updateRemoteTileProfile(peerId);
}

function updateRemoteTileProfile(peerId) {
  const card = document.getElementById(`card-${peerId}`);
  if (!card) return;

  const profile = AppState.peerProfiles.get(peerId);
  if (!profile) return;

  const nameEl = card.querySelector('.tag-name-text');
  if (nameEl) nameEl.textContent = profile.name;

  const avatarName = card.querySelector('.avatar-name');
  if (avatarName) avatarName.textContent = profile.name;

  const avatarInitial = card.querySelector('.avatar-initial');
  if (avatarInitial) avatarInitial.textContent = profile.name.charAt(0).toUpperCase();

  const avatarEl = card.querySelector('.avatar-placeholder');
  if (avatarEl && profile.videoEnabled !== undefined) {
    avatarEl.style.display = profile.videoEnabled ? 'none' : 'flex';
  }

  const micBadge = card.querySelector(`#mic-badge-${peerId}`);
  if (micBadge && profile.audioEnabled !== undefined) {
    if (profile.audioEnabled) {
      micBadge.classList.remove('muted');
    } else {
      micBadge.classList.add('muted');
    }
  }
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

  AppState.audioAnalysers.delete(peerId);

  const card = document.getElementById(`card-${peerId}`);
  if (card && card.parentNode) {
    card.parentNode.removeChild(card);
  }

  if (AppState.isSwappedVideo) {
    restoreVideoSwap();
  }

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
  const total = AppState.peerCalls.size + 1;
  if (UI.participantCountText) {
    if (total === 1) {
      UI.participantCountText.textContent = '1 in room';
    } else {
      UI.participantCountText.textContent = `${total} in room`;
    }
  }
}

/* ==========================================================================
   Active Speaker Detection (AudioContext Analysis)
   ========================================================================== */
function startAudioAnalysis() {
  if (AppState.isAudioAnalysisRunning) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!AppState.audioContext) {
      AppState.audioContext = new AudioContextClass();
    }
    if (AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume().catch(() => {});
    }

    AppState.isAudioAnalysisRunning = true;
    requestAnimationFrame(analyzeAudioFrame);
  } catch (e) {
    console.warn('AudioContext init warning:', e);
  }
}

function stopAudioAnalysis() {
  AppState.isAudioAnalysisRunning = false;
  AppState.audioAnalysers.clear();
  if (AppState.audioContext) {
    try { AppState.audioContext.close(); } catch (e) {}
    AppState.audioContext = null;
  }
}

function setupAudioAnalyser(id, stream) {
  if (!AppState.audioContext || !stream) return;
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) return;

  try {
    const source = AppState.audioContext.createMediaStreamSource(stream);
    const analyser = AppState.audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);
    AppState.audioAnalysers.set(id, analyser);
  } catch (e) {
    console.warn('Could not setup analyser for', id, e);
  }
}

function analyzeAudioFrame() {
  if (!AppState.isAudioAnalysisRunning) return;

  const dataArray = new Uint8Array(128);

  AppState.audioAnalysers.forEach((analyser, id) => {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    const isSpeaking = avg > 25; // Volume threshold

    if (id === 'local') {
      if (UI.localVideoBox) {
        if (isSpeaking && !AppState.isMicMuted) {
          UI.localVideoBox.classList.add('is-speaking');
        } else {
          UI.localVideoBox.classList.remove('is-speaking');
        }
      }
    } else {
      const card = document.getElementById(`card-${id}`);
      if (card) {
        if (isSpeaking) {
          card.classList.add('is-speaking');
        } else {
          card.classList.remove('is-speaking');
        }
      }
    }
  });

  requestAnimationFrame(analyzeAudioFrame);
}

/* ==========================================================================
   Media Control Handlers (Microphone, Camera, Screen Share, Flip)
   ========================================================================== */
function toggleMicrophone() {
  if (!AppState.localStream) return;
  const audioTracks = AppState.localStream.getAudioTracks();

  if (audioTracks.length === 0) {
    showAlert('No microphone track available.', true);
    return;
  }

  AppState.isMicMuted = !AppState.isMicMuted;
  audioTracks.forEach(t => t.enabled = !AppState.isMicMuted);

  if (!AppState.isMicMuted) {
    UI.btnMic.className = 'ctrl-btn active-state';
    UI.iconMicOn.style.display = 'block';
    UI.iconMicOff.style.display = 'none';
    UI.labelMic.textContent = 'Mic';
    if (UI.localMicMini) UI.localMicMini.classList.remove('muted');
    showToast('Microphone unmuted');
  } else {
    UI.btnMic.className = 'ctrl-btn inactive-state';
    UI.iconMicOn.style.display = 'none';
    UI.iconMicOff.style.display = 'block';
    UI.labelMic.textContent = 'Muted';
    if (UI.localMicMini) UI.localMicMini.classList.add('muted');
    showToast('Microphone muted');
  }

  broadcastProfileUpdate();
}

function toggleCamera() {
  if (!AppState.localStream) return;
  const videoTracks = AppState.localStream.getVideoTracks();

  if (videoTracks.length === 0) {
    showAlert('No camera track available.', true);
    return;
  }

  AppState.isCameraMuted = !AppState.isCameraMuted;
  videoTracks.forEach(track => {
    track.enabled = !AppState.isCameraMuted;
  });

  if (!AppState.isCameraMuted) {
    UI.btnCam.className = 'ctrl-btn active-state';
    UI.iconCamOn.style.display = 'block';
    UI.iconCamOff.style.display = 'none';
    UI.labelCam.textContent = 'Camera';
    if (UI.localAvatar) UI.localAvatar.style.display = 'none';
    showToast('Camera turned on');
  } else {
    UI.btnCam.className = 'ctrl-btn inactive-state';
    UI.iconCamOn.style.display = 'none';
    UI.iconCamOff.style.display = 'block';
    UI.labelCam.textContent = 'Off';
    if (UI.localAvatar) UI.localAvatar.style.display = 'flex';
    showToast('Camera turned off');
  }

  broadcastProfileUpdate();
}

async function flipCamera(event) {
  if (event) event.stopPropagation();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  AppState.facingMode = AppState.facingMode === 'user' ? 'environment' : 'user';
  showToast(`Switching camera...`);

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: AppState.facingMode,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      },
      audio: false
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    const oldVideoTrack = AppState.localStream.getVideoTracks()[0];

    if (oldVideoTrack) {
      AppState.localStream.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
    }

    AppState.localStream.addTrack(newVideoTrack);
    UI.localVideo.srcObject = AppState.localStream;

    // Invert mirror effect if environment camera is used
    if (AppState.facingMode === 'environment') {
      UI.localVideo.classList.add('no-mirror');
    } else {
      UI.localVideo.classList.remove('no-mirror');
    }

    // Replace video track on all peer connections
    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      } catch (e) {}
    });

    showToast(`Camera switched`);
  } catch (err) {
    console.warn('Camera flip error:', err);
    showAlert('Could not flip camera: ' + (err.message || 'Unavailable'), false);
  }
}

async function toggleScreenShare() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showAlert('Screen sharing is not supported by your browser.', true);
    return;
  }

  if (!AppState.isSharingScreen) {
    let displayStream = null;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
    } catch (audioErr) {
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
      } catch (videoErr) {
        if (videoErr.name !== 'AbortError' && videoErr.name !== 'NotAllowedError') {
          showAlert('Screen share failed: ' + (videoErr.message || videoErr.name), true);
        }
        return;
      }
    }

    if (!displayStream) return;

    AppState.displayStream = displayStream;
    AppState.isSharingScreen = true;
    UI.btnScreen.className = 'ctrl-btn active-state';
    if (UI.labelScreen) UI.labelScreen.textContent = 'Stop';

    const screenVideoTrack = displayStream.getVideoTracks()[0];

    // Replace video sender on all active peer connections
    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenVideoTrack);
        }
      } catch (e) {}
    });

    dynamicallyAdjustBitrates();

    UI.localVideo.classList.add('no-mirror');
    UI.localVideo.srcObject = displayStream;

    screenVideoTrack.onended = () => {
      stopScreenSharing();
    };

    showToast('Screen sharing started');
  } else {
    stopScreenSharing();
  }
}

function stopScreenSharing() {
  if (!AppState.isSharingScreen) return;
  AppState.isSharingScreen = false;
  UI.btnScreen.className = 'ctrl-btn';
  if (UI.labelScreen) UI.labelScreen.textContent = 'Share';

  if (AppState.displayStream) {
    AppState.displayStream.getTracks().forEach(t => t.stop());
    AppState.displayStream = null;
  }

  if (AppState.facingMode === 'user') {
    UI.localVideo.classList.remove('no-mirror');
  }
  UI.localVideo.srcObject = AppState.localStream;

  const cameraTrack = AppState.localStream?.getVideoTracks()[0];
  if (cameraTrack) {
    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(cameraTrack);
        }
      } catch (e) {}
    });
  }

  dynamicallyAdjustBitrates();
  showToast('Screen sharing stopped');
}

/* ==========================================================================
   In-Call Chat Drawer (WhatsApp Style Pure P2P DataChannel Messaging)
   ========================================================================== */
function toggleChatDrawer() {
  if (AppState.isChatOpen) {
    closeChatDrawer(true);
  } else {
    openChatDrawer();
  }
}

function openChatDrawer() {
  if (AppState.isChatOpen) return;
  AppState.isChatOpen = true;
  if (UI.chatDrawer) {
    UI.chatDrawer.classList.add('open');
    UI.chatDrawer.setAttribute('aria-hidden', 'false');
  }
  AppState.unreadChatCount = 0;
  if (UI.chatUnreadBadge) UI.chatUnreadBadge.style.display = 'none';
  if (UI.chatInput) {
    setTimeout(() => UI.chatInput.focus(), 150);
  }

  // Push history state so browser/hardware back button returns to video call
  try {
    history.pushState({ inChat: true, room: AppState.currentRoomId }, '', window.location.href);
  } catch (e) {}
}

function closeChatDrawer(shouldPopHistory = false) {
  if (!AppState.isChatOpen) return;
  AppState.isChatOpen = false;
  if (UI.chatDrawer) {
    UI.chatDrawer.classList.remove('open');
    UI.chatDrawer.setAttribute('aria-hidden', 'true');
  }
  if (document.activeElement && UI.chatDrawer && UI.chatDrawer.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  if (shouldPopHistory && history.state && history.state.inChat) {
    try {
      history.back();
    } catch (e) {}
  }
}

function handleChatBack() {
  closeChatDrawer(true);
}

function handleSendChatMessage(event) {
  if (event) event.preventDefault();
  const text = UI.chatInput.value.trim();
  if (!text) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderName = AppState.myDisplayName || 'You';

  appendChatMessage(senderName, text, true, timeStr);
  UI.chatInput.value = '';

  broadcastMeshMessage({
    type: 'CHAT_MESSAGE',
    senderName: senderName,
    text: text,
    time: timeStr
  });
}

function appendChatMessage(sender, text, isLocal, time) {
  if (!UI.chatMessagesList) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isLocal ? 'local' : 'remote'}`;

  // If remote, display sender name in WhatsApp teal/cyan
  if (!isLocal) {
    const senderDiv = document.createElement('div');
    senderDiv.className = 'chat-bubble-sender';
    senderDiv.textContent = sender || 'Friend';
    bubble.appendChild(senderDiv);
  }

  const textDiv = document.createElement('div');
  textDiv.className = 'chat-bubble-text';
  textDiv.textContent = text;
  bubble.appendChild(textDiv);

  const metaDiv = document.createElement('div');
  metaDiv.className = 'chat-bubble-meta';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-bubble-time';
  timeSpan.textContent = time;
  metaDiv.appendChild(timeSpan);

  // If local, add WhatsApp blue double checks (✓✓)
  if (isLocal) {
    const checkSpan = document.createElement('span');
    checkSpan.className = 'chat-checks';
    checkSpan.innerHTML = `
      <svg width="15" height="11" viewBox="0 0 16 11" fill="none">
        <path d="M11.05 0.5L4.5 7.05L1.45 4L0.5 4.95L4.5 8.95L12 1.45L11.05 0.5Z" fill="#53bdeb"/>
        <path d="M15.05 0.5L8.5 7.05L7.45 6L6.5 6.95L8.5 8.95L16 1.45L15.05 0.5Z" fill="#53bdeb"/>
      </svg>
    `;
    metaDiv.appendChild(checkSpan);
  }

  bubble.appendChild(metaDiv);

  UI.chatMessagesList.appendChild(bubble);
  UI.chatMessagesList.scrollTop = UI.chatMessagesList.scrollHeight;

  if (!isLocal && !AppState.isChatOpen) {
    AppState.unreadChatCount++;
    if (UI.chatUnreadBadge) {
      UI.chatUnreadBadge.textContent = AppState.unreadChatCount;
      UI.chatUnreadBadge.style.display = 'inline-block';
    }
    showToast(`💬 ${sender}: ${text.length > 28 ? text.slice(0, 28) + '...' : text}`);
  }
}

/* ==========================================================================
   Emoji Reactions (Live Floating P2P Layer)
   ========================================================================== */
function toggleReactionsPicker(event) {
  if (event) event.stopPropagation();
  if (!UI.reactionsPicker) return;
  const isShown = UI.reactionsPicker.style.display === 'flex';
  UI.reactionsPicker.style.display = isShown ? 'none' : 'flex';
}

// Close reaction picker on outside click
document.addEventListener('click', (e) => {
  if (UI.reactionsPicker && UI.reactionsPicker.style.display === 'flex') {
    if (!UI.reactionsPicker.contains(e.target) && !UI.btnReactions.contains(e.target)) {
      UI.reactionsPicker.style.display = 'none';
    }
  }
});

function sendReaction(emoji) {
  if (UI.reactionsPicker) UI.reactionsPicker.style.display = 'none';
  triggerFloatingReaction(emoji);

  broadcastMeshMessage({
    type: 'REACTION',
    emoji: emoji
  });
}

function triggerFloatingReaction(emoji) {
  if (!UI.reactionsContainer) return;

  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;

  // Random horizontal positioning and wobble
  const leftPercent = 20 + Math.random() * 60;
  const wobblePx = (Math.random() - 0.5) * 80;

  el.style.left = `${leftPercent}%`;
  el.style.setProperty('--wobble', `${wobblePx}px`);

  UI.reactionsContainer.appendChild(el);

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 3100);
}

/* ==========================================================================
   Call Timer & Sharing Helpers
   ========================================================================== */
function startCallTimer() {
  AppState.callStartTime = Date.now();
  if (UI.callDurationText) UI.callDurationText.textContent = '00:00';

  clearInterval(AppState.callTimerInterval);
  AppState.callTimerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - AppState.callStartTime) / 1000);
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    if (UI.callDurationText) {
      UI.callDurationText.textContent = `${mins}:${secs}`;
    }
  }, 1000);
}

function stopCallTimer() {
  clearInterval(AppState.callTimerInterval);
  AppState.callTimerInterval = null;
}

function handleShareAction() {
  const link = window.location.href;
  const title = 'Join my GhostCall Room';
  const text = `Join my private, free video call on GhostCall! Room Code: ${AppState.currentRoomId}\n${link}`;

  if (navigator.share) {
    navigator.share({ title, text, url: link }).catch(() => {
      openShareModal();
    });
  } else {
    openShareModal();
  }
}

function openShareModal() {
  if (UI.modalShare) UI.modalShare.style.display = 'flex';
}

function closeShareModal() {
  if (UI.modalShare) UI.modalShare.style.display = 'none';
}

function copyRoomCode() {
  if (!AppState.currentRoomId) return;
  copyTextToClipboard(AppState.currentRoomId, 'Room code copied!');
}

function copyInviteLink() {
  const link = window.location.href;
  copyTextToClipboard(link, 'Invite link copied to clipboard!');
}

function shareToWhatsApp() {
  const link = window.location.href;
  const text = encodeURIComponent(`Hey! Join my private video call on GhostCall (no app or login needed):\n${link}\nRoom Code: ${AppState.currentRoomId}`);
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', '');
  temp.style.position = 'fixed';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);
  temp.select();
  temp.setSelectionRange(0, 99999);
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (e) {
    window.prompt('Copy text:', text);
  }
  document.body.removeChild(temp);
}

/* ==========================================================================
   Leave Call Modal & Rejoin Workflow
   ========================================================================== */
function confirmLeaveCall() {
  if (UI.modalLeave) UI.modalLeave.style.display = 'flex';
}

function closeLeaveModal() {
  if (UI.modalLeave) UI.modalLeave.style.display = 'none';
}

function executeLeaveCall() {
  closeLeaveModal();
  closeChatDrawer(false);
  const prevRoom = AppState.currentRoomId;
  exitCallToHero(true);

  if (UI.modalRejoin && prevRoom) {
    if (UI.rejoinRoomId) UI.rejoinRoomId.textContent = prevRoom;
    UI.modalRejoin.style.display = 'flex';
  }
}

function dismissRejoinModal() {
  if (UI.modalRejoin) UI.modalRejoin.style.display = 'none';
}

function rejoinPreviousRoom() {
  dismissRejoinModal();
  if (AppState.lastRoomId) {
    startVideoCallRoom(AppState.lastRoomId, true);
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

  // 2. Close peer calls & data channels
  AppState.peerCalls.forEach(call => {
    try { call.close(); } catch (e) {}
  });
  AppState.peerCalls.clear();
  AppState.peerDataChannels.clear();
  AppState.peerProfiles.clear();
  AppState.activeParticipants.clear();

  if (AppState.peer) {
    AppState.peer.destroy();
    AppState.peer = null;
  }

  // 3. Reset Video Grid & PiP
  restoreVideoSwap();
  const cards = UI.videoGrid.querySelectorAll('.video-card');
  cards.forEach(c => c.remove());
  if (UI.waitingScreen) UI.waitingScreen.style.display = 'flex';

  if (UI.localVideoBox) {
    UI.localVideoBox.style.left = '';
    UI.localVideoBox.style.top = '';
    UI.localVideoBox.style.right = '';
    UI.localVideoBox.style.bottom = '';
    UI.localVideoBox.style.transition = '';
    UI.localVideoBox.classList.remove('is-expanded', 'is-dragging');
  }

  // 4. Reset Views & URL
  AppState.currentRoomId = null;
  if (cleanHash) {
    history.pushState("", document.title, window.location.pathname + window.location.search);
  }

  showHeroView();
  showToast('You left the video call');
}

/* ==========================================================================
   Alerts, Permission Retry & Toast Helpers
   ========================================================================== */
function showAlert(text, isError = true) {
  if (UI.alertBanner && UI.alertText) {
    UI.alertText.textContent = text;
    UI.alertBanner.style.background = isError ? 'var(--danger-600)' : 'var(--emerald-600)';
    UI.alertBanner.style.display = 'flex';
  }
}

function dismissAlert() {
  if (UI.alertBanner) UI.alertBanner.style.display = 'none';
}

async function retryPermissions() {
  dismissAlert();
  showToast('Requesting device permissions...');
  await initLocalMediaStream();
}

let toastTimer = null;
function showToast(text, icon = '✅') {
  if (!UI.toastMsg) return;
  if (UI.toastIcon) UI.toastIcon.textContent = icon;
  if (UI.toastText) UI.toastText.textContent = text;

  UI.toastMsg.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    UI.toastMsg.classList.remove('show');
  }, 3200);
}

/* ==========================================================================
   Draggable & Snapping Picture-in-Picture Local Video (WhatsApp Style)
   ========================================================================== */
function initDragPip() {
  const pip = UI.localVideoBox;
  if (!pip) return;

  let isPointerActive = false;
  let isDragging = false;
  let startX = 0, startY = 0;
  let pipStartLeft = 0, pipStartTop = 0;
  let snapTimeout = null;

  const onPointerDown = (e) => {
    // If clicking camera flip button, let it handle its own click
    if (e.target.closest('#btn-camera-flip')) return;

    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (clientX === undefined || clientY === undefined) return;

    isPointerActive = true;
    isDragging = false;
    startX = clientX;
    startY = clientY;

    // Calculate stage-relative initial coordinates without modifying DOM
    const stage = UI.callStage || document.getElementById('call-stage') || pip.parentElement;
    const stageRect = stage.getBoundingClientRect();
    const pipRect = pip.getBoundingClientRect();

    pipStartLeft = pipRect.left - stageRect.left;
    pipStartTop = pipRect.top - stageRect.top;

    clearTimeout(snapTimeout);
  };

  const onPointerMove = (e) => {
    if (!isPointerActive) return;

    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (clientX === undefined || clientY === undefined) return;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // Movement threshold (prevents tap from triggering drag)
    if (!isDragging) {
      if (Math.hypot(dx, dy) < 8) return;
      isDragging = true;
      pip.style.transition = 'none';
      pip.classList.add('is-dragging');
    }

    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }

    const stage = UI.callStage || document.getElementById('call-stage') || pip.parentElement;
    const stageRect = stage.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;
    const bottomPadding = isMobile ? 80 : 88;

    let newLeft = pipStartLeft + dx;
    let newTop = pipStartTop + dy;

    // Clamp inside stage boundaries
    const minLeft = 10;
    const maxLeft = Math.max(10, stageRect.width - pip.offsetWidth - 10);
    const minTop = 10;
    const maxTop = Math.max(10, stageRect.height - pip.offsetHeight - bottomPadding);

    newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
    newTop = Math.max(minTop, Math.min(maxTop, newTop));

    pip.style.left = `${newLeft}px`;
    pip.style.top = `${newTop}px`;
    pip.style.right = 'auto';
    pip.style.bottom = 'auto';
  };

  const onPointerUp = () => {
    if (!isPointerActive) return;
    isPointerActive = false;

    if (isDragging) {
      isDragging = false;
      pip.classList.remove('is-dragging');

      // WhatsApp Snap-to-Corner
      const stage = UI.callStage || document.getElementById('call-stage') || pip.parentElement;
      const stageRect = stage.getBoundingClientRect();
      const isMobile = window.innerWidth <= 640;
      const bottomPadding = isMobile ? 76 : 24;

      const pipCenterX = pip.offsetLeft + pip.offsetWidth / 2;
      const pipCenterY = pip.offsetTop + pip.offsetHeight / 2;
      const stageCenterX = stageRect.width / 2;
      const stageCenterY = stageRect.height / 2;

      const snapLeft = pipCenterX < stageCenterX;
      const snapTop = pipCenterY < stageCenterY;

      const targetLeft = snapLeft ? 12 : (stageRect.width - pip.offsetWidth - 12);
      const targetTop = snapTop ? 12 : (stageRect.height - pip.offsetHeight - bottomPadding);

      pip.style.transition = 'left 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2), top 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2)';
      pip.style.left = `${targetLeft}px`;
      pip.style.top = `${targetTop}px`;
      pip.style.right = 'auto';
      pip.style.bottom = 'auto';

      snapTimeout = setTimeout(() => {
        pip.style.transition = '';
      }, 340);
    } else {
      // Tap / Click without dragging (WhatsApp behavior: does not move at all, toggles swap or size)
      handlePipClick();
    }
  };

  pip.addEventListener('mousedown', onPointerDown);
  pip.addEventListener('touchstart', onPointerDown, { passive: false });

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('touchmove', onPointerMove, { passive: false });

  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);
}

function handlePipClick() {
  const remoteCards = UI.videoGrid ? UI.videoGrid.querySelectorAll('.video-card') : [];
  if (remoteCards.length === 1) {
    toggleSwapLocalAndRemoteVideo(remoteCards[0]);
  } else if (UI.localVideoBox) {
    UI.localVideoBox.classList.toggle('is-expanded');
  }
}

function toggleSwapLocalAndRemoteVideo(remoteCard) {
  const remoteVideo = remoteCard.querySelector('video');
  const remoteTag = remoteCard.querySelector('.tag-name-text');
  if (!remoteVideo || !UI.localVideo) return;

  AppState.isSwappedVideo = !AppState.isSwappedVideo;

  if (AppState.isSwappedVideo) {
    const localStream = UI.localVideo.srcObject;
    const remoteStream = remoteVideo.srcObject;

    UI.localVideo.srcObject = remoteStream;
    UI.localVideo.classList.add('no-mirror');

    remoteVideo.srcObject = localStream;
    remoteVideo.classList.add('is-mirrored');

    const peerId = remoteCard.id.replace('card-', '');
    const profile = AppState.peerProfiles.get(peerId);
    const remoteName = profile ? profile.name : (remoteTag ? remoteTag.textContent : 'Friend');

    UI.localTagName.textContent = remoteName;
    if (remoteTag) remoteTag.textContent = AppState.myDisplayName || 'You';

    showToast('Swapped views • Tap PIP again to restore');
  } else {
    restoreVideoSwap(remoteCard);
  }
}

function restoreVideoSwap(remoteCard) {
  AppState.isSwappedVideo = false;
  if (!UI.localVideo) return;

  if (AppState.localStream) {
    UI.localVideo.srcObject = AppState.localStream;
    UI.localVideo.classList.remove('no-mirror');
  }
  UI.localTagName.textContent = AppState.myDisplayName || 'You';

  if (!remoteCard) {
    const cards = UI.videoGrid ? UI.videoGrid.querySelectorAll('.video-card') : [];
    if (cards.length > 0) remoteCard = cards[0];
  }

  if (remoteCard) {
    const remoteVideo = remoteCard.querySelector('video');
    const remoteTag = remoteCard.querySelector('.tag-name-text');
    const peerId = remoteCard.id.replace('card-', '');
    const profile = AppState.peerProfiles.get(peerId);
    const call = AppState.peerCalls.get(peerId);

    if (call && call.remoteStream && remoteVideo) {
      remoteVideo.srcObject = call.remoteStream;
      remoteVideo.classList.remove('is-mirrored');
    }
    if (remoteTag && profile) {
      remoteTag.textContent = profile.name;
    }
  }
}

/* ==========================================================================
   Global Keyboard Shortcuts
   ========================================================================== */
function initGlobalKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // If typing in an input or textarea, don't trigger shortcuts
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    if (!AppState.currentRoomId) return;

    switch (e.key.toLowerCase()) {
      case 'm':
        toggleMicrophone();
        break;
      case 'v':
        toggleCamera();
        break;
      case 's':
        toggleScreenShare();
        break;
      case 'c':
        toggleChatDrawer();
        break;
      case 'escape':
        closeLeaveModal();
        closeShareModal();
        if (AppState.isChatOpen) closeChatDrawer(false);
        if (UI.reactionsPicker) UI.reactionsPicker.style.display = 'none';
        break;
    }
  });
}
