/* ==========================================================================
   GhostCall — High-Performance Pure Browser WebRTC Video Calling Engine
   Full-Stack Architecture: Peer-to-Peer Mesh Networking via PeerJS
   Zero Database • Zero Logins • End-to-End Browser Media Channels
   UI / UX: WhatsApp Web Exact Visual Style, Layout & Micro-Interactions
   ========================================================================== */

// 1. Multi-provider STUN & TURN configuration for reliable NAT & firewall traversal
const rtcConfiguration = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      // OpenRelay public WebRTC TURN servers for symmetric NAT / cellular traversal
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelay',
        credential: 'openrelay'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelay',
        credential: 'openrelay'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelay',
        credential: 'openrelay'
      }
    ],
    iceCandidatePoolSize: 2
  }
};

// 2. Application Reactive State Management
const AppState = {
  currentRoomId: null,
  lastRoomId: null,
  myPeerId: null,
  sessionUid: Math.random().toString(36).substring(2, 8),
  myDisplayName: localStorage.getItem('ghostcall_username') || '',
  isRoomHost: false,
  isJoiningAsGuest: false,
  peer: null,

  // Media Streams & Local Hardware State
  localStream: null,
  displayStream: null,
  isSharingScreen: false,
  facingMode: 'user', // 'user' (front) or 'environment' (rear)
  isCameraMuted: false,
  isMicMuted: false,

  // Mesh Connections & Peer Registries
  peerCalls: new Map(),          // peerId -> MediaConnection
  peerDataChannels: new Map(),   // peerId -> DataConnection
  peerProfiles: new Map(),       // peerId -> { name, videoEnabled, audioEnabled }
  activeParticipants: new Set(), // Set of active peer IDs

  // Active Speaker & Audio Frequency Analysis
  audioContext: null,
  audioAnalysers: new Map(),     // peerId ('local' or remote) -> { source, analyser }
  isAudioAnalysisRunning: false,

  // UI & WhatsApp Navigation State
  callStartTime: null,
  callTimerInterval: null,
  unreadChatCount: 0,
  isSidebarOpen: window.innerWidth > 1024, // Open by default on desktop
  currentSidebarTab: 'chat',              // 'chat' or 'people'
  isCallActive: false,
  suppressNavConfirm: false,
  joinedPeersNotified: new Set()
};

// 3. Cached DOM References
const UI = {
  body: document.body,
  heroView: document.getElementById('hero-view'),
  callView: document.getElementById('call-view'),
  callStage: document.getElementById('call-stage'),
  videoGrid: document.getElementById('video-grid'),
  waitingScreen: document.getElementById('waiting-screen'),
  waitingLocalPreview: document.getElementById('waiting-local-preview'),
  waitingCodeText: document.getElementById('waiting-code-text'),
  
  // Local Picture-in-Picture
  localVideoBox: document.getElementById('local-video-box'),
  localVideo: document.getElementById('local-video'),
  localAvatar: document.getElementById('local-avatar'),
  localAvatarInitial: document.getElementById('local-avatar-initial'),
  localAvatarName: document.getElementById('local-avatar-name'),
  localTagName: document.getElementById('local-tag-name'),
  localMicMini: document.getElementById('local-mic-mini'),
  localMicSlash: document.getElementById('local-mic-slash'),
  btnCameraFlip: document.getElementById('btn-camera-flip'),

  // Global Header
  appHeader: document.getElementById('app-header'),
  roomInfoPill: document.getElementById('header-room-pill'),
  participantsPill: document.getElementById('header-participants-pill'),
  displayRoomId: document.getElementById('display-room-id'),
  participantCountText: document.getElementById('participant-count-text'),
  btnHeaderShare: document.getElementById('btn-header-share'),
  headerCallTimer: document.getElementById('header-call-timer'),
  callDurationText: document.getElementById('call-duration-text'),

  // WhatsApp Left Sidebar
  callSidebar: document.getElementById('call-sidebar'),
  sidebarUserInitial: document.getElementById('sidebar-user-initial'),
  sidebarUserName: document.getElementById('sidebar-user-name'),
  sidebarConnectionStatus: document.getElementById('sidebar-connection-status'),
  tabBtnChat: document.getElementById('tab-btn-chat'),
  tabBtnPeople: document.getElementById('tab-btn-people'),
  sidebarTabUnread: document.getElementById('sidebar-tab-unread'),
  sidebarPeopleCount: document.getElementById('sidebar-people-count'),
  sidebarPaneChat: document.getElementById('sidebar-pane-chat'),
  sidebarPanePeople: document.getElementById('sidebar-pane-people'),
  sidebarRoomCode: document.getElementById('sidebar-room-code'),
  sidebarParticipantsCountTag: document.getElementById('sidebar-participants-count-tag'),
  participantsListItems: document.getElementById('participants-list-items'),
  participantSelfName: document.getElementById('participant-self-name'),
  participantSelfInitial: document.getElementById('participant-self-initial'),
  participantSelfSpeaking: document.getElementById('participant-self-speaking'),
  participantSelfMic: document.getElementById('participant-self-mic'),
  participantSelfCam: document.getElementById('participant-self-cam'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  stageUnreadDot: document.getElementById('stage-unread-dot'),
  stageStatusText: document.getElementById('stage-status-text'),

  // Floating Controls Dock
  controlsDock: document.getElementById('controls-dock'),
  btnMic: document.getElementById('btn-mic'),
  btnCam: document.getElementById('btn-cam'),
  btnScreen: document.getElementById('btn-screen'),
  btnChat: document.getElementById('btn-chat'),
  chatUnreadBadge: document.getElementById('chat-unread-badge'),
  btnFullscreen: document.getElementById('btn-fullscreen'),
  iconFsEnter: document.getElementById('icon-fs-enter'),
  iconFsExit: document.getElementById('icon-fs-exit'),
  labelFs: document.getElementById('label-fs'),
  iconMicOn: document.getElementById('icon-mic-on'),
  iconMicOff: document.getElementById('icon-mic-off'),
  iconCamOn: document.getElementById('icon-cam-on'),
  iconCamOff: document.getElementById('icon-cam-off'),

  // Chat Form & List
  chatMessagesList: document.getElementById('chat-messages-list'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),

  // Banners & Modals
  alertBanner: document.getElementById('alert-banner'),
  alertText: document.getElementById('alert-text'),
  toastMsg: document.getElementById('toast-msg'),
  toastText: document.getElementById('toast-text'),
  modalLeave: document.getElementById('modal-leave'),
  modalShare: document.getElementById('modal-share'),
  modalRoomNotFound: document.getElementById('modal-room-not-found'),
  modalRoomErrorDesc: document.getElementById('modal-room-error-desc'),
  shareModalCode: document.getElementById('share-modal-code'),
  shareModalLinkInput: document.getElementById('share-modal-link-input'),

  // Landing Inputs
  nameInput: document.getElementById('input-display-name'),
  heroAvatarPreview: document.getElementById('hero-avatar-preview'),
  roomInput: document.getElementById('input-room-code'),
  roomInputError: document.getElementById('room-input-error'),
  codeEntryContainer: document.getElementById('code-entry-container'),
  btnJoinRoom: document.getElementById('btn-join-room')
};

// 4. Initialization & Lifecycle
window.addEventListener('DOMContentLoaded', () => {
  initUserPreferences();
  initDragPip();
  initGlobalKeyboardShortcuts();
  initFullscreenHandlers();
  initMobileAudioUnlock();
  checkUrlHashOnLoad();
});

// Clean up WebRTC mesh immediately on tab close or page reload
window.addEventListener('beforeunload', () => {
  if (AppState.currentRoomId) {
    // Notify connected peers over data channels before tab unload
    broadcastMeshMessage({
      type: 'PEER_LEFT',
      peerId: AppState.myPeerId,
      name: AppState.myDisplayName || 'Friend'
    });
    if (AppState.peer) {
      try { AppState.peer.destroy(); } catch (e) {}
    }
  }
});

window.addEventListener('pagehide', () => {
  if (AppState.peer) {
    try { AppState.peer.destroy(); } catch (e) {}
  }
});

// Watch URL Hash navigation
window.addEventListener('hashchange', () => {
  if (AppState.suppressNavConfirm) return;
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('room-')) {
    const extractedId = hash.replace('room-', '').replace(/\D/g, '').slice(0, 6);
    if (extractedId.length === 6 && extractedId !== AppState.currentRoomId) {
      startVideoCallRoom(extractedId, true);
    }
  } else if (!hash && AppState.isCallActive) {
    confirmLeaveCall();
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
        return;
      }
      const controlKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (controlKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
      const hasSelection = UI.roomInput.selectionStart !== UI.roomInput.selectionEnd;
      if (UI.roomInput.value.length >= 6 && !hasSelection) e.preventDefault();
    });

    UI.roomInput.addEventListener('input', () => {
      const sanitized = UI.roomInput.value.replace(/\D/g, '').slice(0, 6);
      if (UI.roomInput.value !== sanitized) UI.roomInput.value = sanitized;
      clearRoomInputError();
    });

    UI.roomInput.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const digits = text.replace(/\D/g, '').slice(0, 6);
      UI.roomInput.value = digits;
      clearRoomInputError();
    });
  }

  // Detect mobile device for camera flip button
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    if (UI.btnCameraFlip) UI.btnCameraFlip.style.display = 'flex';
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
  if (UI.localAvatarInitial) UI.localAvatarInitial.textContent = displayName.charAt(0).toUpperCase();
  if (UI.sidebarUserName) UI.sidebarUserName.textContent = displayName;
  if (UI.sidebarUserInitial) UI.sidebarUserInitial.textContent = displayName.charAt(0).toUpperCase();
  if (UI.participantSelfName) UI.participantSelfName.textContent = displayName;
  if (UI.participantSelfInitial) UI.participantSelfInitial.textContent = displayName.charAt(0).toUpperCase();
}

function checkUrlHashOnLoad() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('room-')) {
    const extractedId = hash.replace('room-', '').replace(/\D/g, '').slice(0, 6);
    if (extractedId.length === 6) {
      startVideoCallRoom(extractedId, true);
      return;
    }
  }
  showHeroView();
}

/* ==========================================================================
   Room Creation & Zero-Login Flow
   ========================================================================== */
function createNewRoom() {
  // Generate user-friendly 6-digit room code
  const randomRoomId = String(Math.floor(100000 + Math.random() * 900000));
  startVideoCallRoom(randomRoomId, false);
}

function joinExistingRoom() {
  let val = UI.roomInput ? UI.roomInput.value.trim() : '';
  if (!val) {
    showRoomInputError('Please enter a 6-digit room code');
    showRoomNotFoundModal('Please enter a 6-digit room code to join a call.');
    if (UI.roomInput) UI.roomInput.focus();
    return;
  }

  if (val.includes('#room-')) val = val.split('#room-')[1];
  else if (val.includes('#')) val = val.split('#')[1];

  val = val.replace(/\D/g, '').slice(0, 6);

  if (val.length !== 6) {
    showRoomInputError('Room code must be exactly 6 digits');
    showRoomNotFoundModal('Room code must be exactly 6 digits (numbers only).');
    if (UI.roomInput) {
      UI.roomInput.value = val;
      UI.roomInput.focus();
    }
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
  AppState.isCallActive = true;
  AppState.isJoiningAsGuest = isGuest;
  AppState.suppressNavConfirm = true;

  window.location.hash = `room-${roomId}`;
  try {
    history.replaceState({ inRoom: true, room: roomId }, '', window.location.href);
  } catch (e) {}

  setTimeout(() => {
    AppState.suppressNavConfirm = false;
  }, 1000);

  if (UI.displayRoomId) UI.displayRoomId.textContent = roomId;
  if (UI.waitingCodeText) UI.waitingCodeText.textContent = roomId;
  if (UI.sidebarRoomCode) UI.sidebarRoomCode.textContent = roomId;
  if (UI.shareModalCode) UI.shareModalCode.textContent = roomId;
  if (UI.shareModalLinkInput) UI.shareModalLinkInput.value = window.location.href;

  updateLocalDisplayName(AppState.myDisplayName || 'You');
  showCallView();
  startCallTimer();

  // Step 1: Initialize Local Media Stream (Camera & Mic with progressive fallback)
  await initLocalMediaStream();

  // Step 2: Initialize WebRTC PeerJS Mesh
  initPeerMesh();

  // Step 3: Start Active Speaker detection
  startAudioAnalysis();
}

async function initLocalMediaStream() {
  // Studio-quality video and crystal-clear audio constraints
  const primaryConstraints = {
    video: {
      facingMode: AppState.facingMode || 'user',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: { ideal: 48000 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
    attachLocalStream(stream);
    dismissAlert();
  } catch (err) {
    console.warn('Primary 1080p constraints failed, trying 720p HD fallback:', err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: AppState.facingMode || 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      attachLocalStream(fallbackStream);
      dismissAlert();
    } catch (fallbackErr) {
      console.warn('Fallback media failed, trying basic video or audio:', fallbackErr);
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true });
        attachLocalStream(videoOnly);
        dismissAlert();
      } catch (videoErr) {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          attachLocalStream(audioOnly);
          dismissAlert();
        } catch (audioErr) {
          // Hardware unavailable or blocked: create safe dummy fallback stream to allow UI and WebRTC answer
          const dummyStream = createFallbackMediaStream();
          attachLocalStream(dummyStream);

          if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
            showAlert('Camera & Microphone access was blocked. Tap the lock icon in your browser address bar to allow.', true);
          } else if (fallbackErr.name === 'NotFoundError') {
            showAlert('No camera or microphone found. You can still watch and chat.', true);
          } else {
            showAlert('Media access error: ' + (fallbackErr.message || 'Check device permissions'), true);
          }
        }
      }
    }
  }
}

function attachLocalStream(stream) {
  AppState.localStream = stream;
  if (UI.localVideo) {
    UI.localVideo.muted = true;
    UI.localVideo.playsInline = true;
    UI.localVideo.setAttribute('playsinline', '');
    UI.localVideo.srcObject = stream;
    UI.localVideo.play().catch(e => console.warn('Local video play note:', e));
  }

  // Bind to full-screen waiting banner preview
  if (UI.waitingLocalPreview) {
    UI.waitingLocalPreview.muted = true;
    UI.waitingLocalPreview.playsInline = true;
    UI.waitingLocalPreview.setAttribute('playsinline', '');
    UI.waitingLocalPreview.srcObject = stream;
    UI.waitingLocalPreview.play().catch(e => console.warn('Waiting preview play note:', e));
  }

  updateStageWaitingVisibility();
  setupAudioAnalyser('local', stream);
}

function updateStageWaitingVisibility() {
  const remoteCount = AppState.peerCalls ? AppState.peerCalls.size : 0;
  if (remoteCount === 0) {
    if (UI.waitingScreen) UI.waitingScreen.style.display = 'flex';
    if (UI.waitingLocalPreview && AppState.localStream) {
      if (UI.waitingLocalPreview.srcObject !== AppState.localStream) {
        UI.waitingLocalPreview.srcObject = AppState.localStream;
      }
      UI.waitingLocalPreview.play().catch(() => {});
    }
    if (UI.localVideoBox) UI.localVideoBox.style.display = 'none';
    if (UI.stageStatusText) UI.stageStatusText.textContent = 'Waiting for peers...';
  } else {
    if (UI.waitingScreen) UI.waitingScreen.style.display = 'none';
    if (UI.localVideoBox) UI.localVideoBox.style.display = 'block';
    if (UI.stageStatusText) UI.stageStatusText.textContent = `Connected (${remoteCount + 1} in room)`;
  }
}

// Fallback dummy stream with black canvas and silent audio track for zero-crash WebRTC answers
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
    } catch (e) {}
  }

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111b21';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const canvasStream = canvas.captureStream(10);
  const dummyVideo = canvasStream.getVideoTracks()[0];

  const tracks = [];
  if (dummyAudio) tracks.push(dummyAudio);
  if (dummyVideo) tracks.push(dummyVideo);

  return new MediaStream(tracks);
}

/* ==========================================================================
   WebRTC Mesh Networking Logic (PeerJS & Resilient Mesh)
   ========================================================================== */
function initPeerMesh() {
  const hostPeerId = `ghostcall-${AppState.currentRoomId}-host`;

  if (AppState.isJoiningAsGuest) {
    joinAsMeshGuest(hostPeerId);
    return;
  }

  // Attempt to register as room coordinator/host
  AppState.peer = new Peer(hostPeerId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    AppState.isRoomHost = true;
    AppState.myPeerId = id;
    AppState.activeParticipants.add(id);
    console.log('✅ Registered as Room Host:', id);
    updateParticipantsDisplay();
    bindPeerListeners();
    notifyUserEvent(`You entered room #${AppState.currentRoomId}`);
  });

  AppState.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      console.log('ℹ️ Host exists in room. Joining as guest participant...');
      joinAsMeshGuest(hostPeerId);
    } else {
      console.error('Peer connection error:', err);
      if (err.type !== 'peer-unavailable') {
        showAlert('Connection notice: ' + (err.message || err.type), false);
      }
    }
  });
}

function joinAsMeshGuest(hostPeerId) {
  AppState.isRoomHost = false;
  const guestId = `ghostcall-${AppState.currentRoomId}-guest-${AppState.sessionUid}`;

  AppState.peer = new Peer(guestId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    AppState.myPeerId = id;
    AppState.activeParticipants.add(id);
    console.log('✅ Registered as Guest Participant:', id);
    updateParticipantsDisplay();
    bindPeerListeners();
    notifyUserEvent(`You entered room #${AppState.currentRoomId}`);

    // Establish full mesh: connect data channel and media call to host
    connectDataChannelToPeer(hostPeerId);
    establishMediaCall(hostPeerId);
  });

  AppState.peer.on('error', (err) => {
    console.warn('Guest peer error event:', err);
    if (err.type === 'unavailable-id') {
      // Regenerate session ID and retry immediately
      AppState.sessionUid = Math.random().toString(36).substring(2, 8);
      joinAsMeshGuest(hostPeerId);
    } else if (err.type === 'peer-unavailable') {
      // If host is temporarily unavailable, retry once or stay in room awaiting peer rendezvous
      console.log('Host peer currently unavailable. Awaiting incoming connections...');
    }
  });
}

function bindPeerListeners() {
  if (!AppState.peer) return;

  // Incoming media calls
  AppState.peer.on('call', (incomingCall) => {
    console.log('📞 Incoming media call from:', incomingCall.peer);

    const streamToSend = AppState.isSharingScreen && AppState.displayStream 
      ? AppState.displayStream 
      : (AppState.localStream || createFallbackMediaStream());

    incomingCall.answer(streamToSend, { sdpTransform: optimizeWebRtcSdp });
    configureCallParameters(incomingCall);

    incomingCall.on('stream', (remoteStream) => {
      renderRemoteVideoTile(incomingCall.peer, remoteStream);
    });

    incomingCall.on('close', () => {
      removeRemoteVideoTile(incomingCall.peer);
    });

    incomingCall.on('error', (err) => {
      console.warn('Call error with peer:', incomingCall.peer, err);
      removeRemoteVideoTile(incomingCall.peer);
    });

    AppState.peerCalls.set(incomingCall.peer, incomingCall);
    AppState.activeParticipants.add(incomingCall.peer);
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
    AppState.activeParticipants.add(conn.peer);

    // Send our profile to the newly connected peer
    conn.send({
      type: 'PROFILE_UPDATE',
      peerId: AppState.myPeerId,
      name: AppState.myDisplayName || 'Friend',
      videoEnabled: !AppState.isCameraMuted,
      audioEnabled: !AppState.isMicMuted
    });

    // If host, send room members list to the newcomer
    if (AppState.isRoomHost) {
      conn.send({
        type: 'ROOM_MEMBERS',
        peers: Array.from(AppState.activeParticipants),
        profiles: Object.fromEntries(AppState.peerProfiles)
      });

      // Broadcast new participant arrival to all other peers
      broadcastMeshMessage({
        type: 'PEER_JOINED',
        newPeerId: conn.peer
      }, conn.peer);
    }

    updateParticipantsDisplay();
  });

  conn.on('data', (data) => {
    handleMeshSignaling(data, conn.peer);
  });

  conn.on('error', (err) => {
    console.warn('Data channel note:', conn.peer, err);
  });

  conn.on('close', () => {
    handlePeerDisconnect(conn.peer);
  });
}

function connectDataChannelToPeer(targetPeerId) {
  if (AppState.peerDataChannels.has(targetPeerId)) return;
  const conn = AppState.peer.connect(targetPeerId, { reliable: true });
  setupDataConnection(conn);
}

function handlePeerDisconnect(peerId) {
  const profile = AppState.peerProfiles.get(peerId);
  const friendName = profile?.name || 'A friend';

  AppState.peerDataChannels.delete(peerId);
  AppState.peerProfiles.delete(peerId);
  AppState.activeParticipants.delete(peerId);

  if (AppState.joinedPeersNotified && AppState.joinedPeersNotified.has(peerId)) {
    AppState.joinedPeersNotified.delete(peerId);
    notifyUserEvent(`${friendName} left the room`);
  }

  if (AppState.isRoomHost) {
    broadcastMeshMessage({
      type: 'PEER_LEFT',
      peerId: peerId,
      name: friendName
    });
  }

  removeRemoteVideoTile(peerId);
}

function handleMeshSignaling(data, fromPeerId) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'ROOM_MEMBERS':
      if (data.profiles) {
        Object.entries(data.profiles).forEach(([pid, prof]) => {
          AppState.peerProfiles.set(pid, prof);
        });
      }

      if (Array.isArray(data.peers)) {
        data.peers.forEach((peerId) => {
          if (peerId !== AppState.myPeerId) {
            AppState.activeParticipants.add(peerId);
            // Glare-free mesh: Only initiate call and data connection if myPeerId is lexicographically greater
            if (AppState.myPeerId > peerId) {
              if (!AppState.peerDataChannels.has(peerId)) {
                connectDataChannelToPeer(peerId);
              }
              if (!AppState.peerCalls.has(peerId)) {
                establishMediaCall(peerId);
              }
            }
          }
        });
      }
      updateParticipantsDisplay();
      break;

    case 'PEER_JOINED':
      if (data.newPeerId && data.newPeerId !== AppState.myPeerId) {
        AppState.activeParticipants.add(data.newPeerId);
        if (AppState.myPeerId > data.newPeerId) {
          if (!AppState.peerDataChannels.has(data.newPeerId)) {
            connectDataChannelToPeer(data.newPeerId);
          }
          if (!AppState.peerCalls.has(data.newPeerId)) {
            establishMediaCall(data.newPeerId);
          }
        }
        updateParticipantsDisplay();
      }
      break;

    case 'PROFILE_UPDATE':
      if (data.peerId) {
        const friendName = data.name || 'Friend';
        const isNewPeer = !AppState.joinedPeersNotified.has(data.peerId);
        AppState.peerProfiles.set(data.peerId, {
          name: friendName,
          videoEnabled: data.videoEnabled !== false,
          audioEnabled: data.audioEnabled !== false
        });
        updateRemoteTileProfile(data.peerId);

        if (isNewPeer && data.peerId !== AppState.myPeerId) {
          AppState.joinedPeersNotified.add(data.peerId);
          notifyUserEvent(`${friendName} entered the room`);
        }
        updateParticipantsDisplay();
      }
      break;

    case 'PEER_LEFT':
      if (data.peerId) {
        const profile = AppState.peerProfiles.get(data.peerId);
        const friendName = data.name || profile?.name || 'A friend';
        if (AppState.joinedPeersNotified && AppState.joinedPeersNotified.has(data.peerId)) {
          AppState.joinedPeersNotified.delete(data.peerId);
          notifyUserEvent(`${friendName} left the room`);
        }
        removeRemoteVideoTile(data.peerId);
      }
      break;

    case 'CHAT_MESSAGE':
      appendChatMessage(data.senderName, data.text, false, data.time);
      break;
  }
}

function broadcastMeshMessage(payload, excludePeerId = null) {
  AppState.peerDataChannels.forEach((conn, peerId) => {
    if (peerId !== excludePeerId && conn && conn.open) {
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
  updateLocalParticipantRow();
}

function establishMediaCall(remotePeerId) {
  if (AppState.peerCalls.has(remotePeerId)) return;

  const streamToSend = AppState.isSharingScreen && AppState.displayStream 
    ? AppState.displayStream 
    : (AppState.localStream || createFallbackMediaStream());

  const call = AppState.peer.call(remotePeerId, streamToSend, { sdpTransform: optimizeWebRtcSdp });
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
  AppState.activeParticipants.add(remotePeerId);
  updateParticipantsDisplay();
  dynamicallyAdjustBitrates();
}

/**
 * Safe, Studio-Grade WebRTC SDP Optimization
 * Forces Opus to 48kHz, stereo, in-band forward error correction, 128 kbps
 */
function optimizeWebRtcSdp(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;

  try {
    const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
    if (opusMatch) {
      const pt = opusMatch[1];
      const fmtpRegex = new RegExp(`a=fmtp:${pt}\\s+([^\r\n]+)`, 'i');
      const fmtpMatch = sdp.match(fmtpRegex);
      const studioAudioParams = 'minptime=10;useinbandfec=1;stereo=1;maxaveragebitrate=128000;cbr=1';

      if (fmtpMatch) {
        let existing = fmtpMatch[1];
        ['minptime', 'useinbandfec', 'stereo', 'maxaveragebitrate', 'cbr'].forEach(k => {
          existing = existing.replace(new RegExp(`;?${k}=[^;]+`, 'g'), '');
        });
        const newFmtp = `a=fmtp:${pt} ${existing ? existing + ';' : ''}${studioAudioParams}`;
        sdp = sdp.replace(fmtpMatch[0], newFmtp);
      } else {
        sdp = sdp.replace(opusMatch[0], `${opusMatch[0]}\r\na=fmtp:${pt} ${studioAudioParams}`);
      }
    }
  } catch (err) {
    console.warn('SDP tuning note:', err);
  }

  return sdp;
}

function configureCallParameters(call) {
  if (!call || !call.peerConnection) return;
  const pc = call.peerConnection;

  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      tunePeerSenders(pc);
    }
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
      console.warn(`ICE state notice with ${call.peer}:`, pc.iceConnectionState);
      if (typeof pc.restartIce === 'function') {
        try { pc.restartIce(); } catch (e) {}
      }
    }
  });

  tunePeerSenders(pc);
}

function tunePeerSenders(pc) {
  if (!pc || !pc.getSenders) return;

  const total = AppState.peerCalls.size + 1;
  let maxVideoBitrate = total >= 4 ? 800000 : 2500000;

  pc.getSenders().forEach((sender) => {
    if (sender.track && sender.track.kind === 'video') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxVideoBitrate;
        sender.setParameters(params).catch(() => {});
      } catch (err) {}
    }
  });
}

function dynamicallyAdjustBitrates() {
  AppState.peerCalls.forEach((call) => {
    if (call.peerConnection) tunePeerSenders(call.peerConnection);
  });
}

/* ==========================================================================
   DOM Video Grid Rendering & Remote Tiles
   ========================================================================== */
function renderRemoteVideoTile(peerId, stream) {
  let card = document.getElementById(`card-${peerId}`);
  let videoEl;
  let avatarEl;

  if (!card) {
    card = document.createElement('div');
    card.className = 'video-card';
    card.id = `card-${peerId}`;

    videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');

    // Avatar placeholder for when remote video is off
    const profile = AppState.peerProfiles.get(peerId) || { name: 'Friend' };
    const initial = profile.name.charAt(0).toUpperCase();

    avatarEl = document.createElement('div');
    avatarEl.className = 'avatar-placeholder';
    avatarEl.id = `avatar-${peerId}`;
    avatarEl.style.display = 'none';
    avatarEl.innerHTML = `
      <div class="avatar-circle">
        <span class="avatar-initial">${initial}</span>
      </div>
      <span class="avatar-name">${profile.name}</span>
    `;

    // Bottom name tag
    const nameTag = document.createElement('div');
    nameTag.className = 'tile-name-tag';
    nameTag.innerHTML = `
      <span class="tag-name-text">${profile.name}</span>
    `;

    // Muted mic slash badge
    const micSlash = document.createElement('div');
    micSlash.className = 'tile-mic-slash';
    micSlash.id = `mic-slash-${peerId}`;
    micSlash.style.display = 'none';
    micSlash.title = 'Microphone muted';
    micSlash.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l4.41 4.41c-.63.45-1.35.78-2.06.9V21h-2v-2.28c-3.28-.49-6-3.31-6-6.72H5c0 3.03 2.14 5.56 5 6.09v.01l-5.73-5.73L4.27 3z"/>
      </svg>
    `;

    card.appendChild(videoEl);
    card.appendChild(avatarEl);
    card.appendChild(nameTag);
    card.appendChild(micSlash);
    UI.videoGrid.appendChild(card);
  } else {
    videoEl = card.querySelector('video');
    avatarEl = card.querySelector('.avatar-placeholder');
  }

  // Safe playback handling
  if (videoEl && videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
    videoEl.play().catch(() => {
      // Unmute policy fallback on mobile
      videoEl.muted = true;
      videoEl.play().catch(e => console.warn('Muted remote play note:', e));
    });
  }

  // Track state listeners
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.onmute = () => {
      if (avatarEl) avatarEl.style.display = 'flex';
    };
    videoTrack.onunmute = () => {
      if (avatarEl) avatarEl.style.display = 'none';
    };
  }

  setupAudioAnalyser(peerId, stream);
  updateStageWaitingVisibility();
  adjustGridLayout();
  updateParticipantsDisplay();
  updateRemoteTileProfile(peerId);
}

function updateRemoteTileProfile(peerId) {
  const card = document.getElementById(`card-${peerId}`);
  const profile = AppState.peerProfiles.get(peerId);
  if (!card || !profile) return;

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

  const micSlash = card.querySelector(`#mic-slash-${peerId}`);
  if (micSlash && profile.audioEnabled !== undefined) {
    micSlash.style.display = profile.audioEnabled ? 'none' : 'flex';
  }
}

function removeRemoteVideoTile(peerId) {
  if (AppState.peerCalls.has(peerId)) {
    try { AppState.peerCalls.get(peerId).close(); } catch (e) {}
    AppState.peerCalls.delete(peerId);
  }

  if (AppState.peerDataChannels.has(peerId)) {
    try { AppState.peerDataChannels.get(peerId).close(); } catch (e) {}
    AppState.peerDataChannels.delete(peerId);
  }

  // Clean up audio analyser nodes to avoid memory leaks
  if (AppState.audioAnalysers.has(peerId)) {
    const entry = AppState.audioAnalysers.get(peerId);
    try {
      if (entry.source) entry.source.disconnect();
      if (entry.analyser) entry.analyser.disconnect();
    } catch (e) {}
    AppState.audioAnalysers.delete(peerId);
  }
  speakingStateCache.delete(peerId);

  const card = document.getElementById(`card-${peerId}`);
  if (card && card.parentNode) {
    card.parentNode.removeChild(card);
  }

  updateStageWaitingVisibility();
  adjustGridLayout();
  updateParticipantsDisplay();
  dynamicallyAdjustBitrates();
}

function adjustGridLayout() {
  const remoteCount = AppState.peerCalls.size;
  UI.videoGrid.className = '';

  if (remoteCount <= 1) UI.videoGrid.classList.add('layout-1');
  else if (remoteCount === 2) UI.videoGrid.classList.add('layout-2');
  else if (remoteCount === 3) UI.videoGrid.classList.add('layout-3');
  else if (remoteCount === 4) UI.videoGrid.classList.add('layout-4');
  else if (remoteCount <= 6) UI.videoGrid.classList.add('layout-6');
  else if (remoteCount <= 8) UI.videoGrid.classList.add('layout-8');
  else UI.videoGrid.classList.add('layout-many');
}

function updateParticipantsDisplay() {
  const total = AppState.peerCalls.size + 1;
  const text = `${total} in room`;
  if (UI.participantCountText) UI.participantCountText.textContent = text;
  if (UI.sidebarPeopleCount) UI.sidebarPeopleCount.textContent = total;
  if (UI.sidebarParticipantsCountTag) UI.sidebarParticipantsCountTag.textContent = `${total} ${total === 1 ? 'Person' : 'People'}`;

  renderSidebarParticipantsList();
}

function renderSidebarParticipantsList() {
  if (!UI.participantsListItems) return;

  // Preserve the local self row
  const existingRows = UI.participantsListItems.querySelectorAll('.participant-item:not(.is-self)');
  existingRows.forEach(r => r.remove());

  updateLocalParticipantRow();

  // Render each remote peer
  AppState.peerCalls.forEach((_, peerId) => {
    const profile = AppState.peerProfiles.get(peerId) || { name: 'Friend', videoEnabled: true, audioEnabled: true };
    const row = document.createElement('div');
    row.className = 'participant-item';
    row.id = `sidebar-peer-${peerId}`;

    const isSpeaking = speakingStateCache.get(peerId) || false;
    if (isSpeaking) row.classList.add('is-speaking');

    row.innerHTML = `
      <div class="participant-avatar">
        <span>${profile.name.charAt(0).toUpperCase()}</span>
      </div>
      <div class="participant-details">
        <div class="participant-name-row">
          <span class="participant-name">${profile.name}</span>
        </div>
        <span class="participant-role-sub">Remote Participant</span>
      </div>
      <div class="participant-status-icons">
        <span class="status-icon ${!profile.audioEnabled ? 'muted' : ''}" title="${profile.audioEnabled ? 'Mic Active' : 'Mic Muted'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
        </span>
        <span class="status-icon ${!profile.videoEnabled ? 'muted' : ''}" title="${profile.videoEnabled ? 'Camera Active' : 'Camera Off'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
        </span>
      </div>
    `;
    UI.participantsListItems.appendChild(row);
  });
}

function updateLocalParticipantRow() {
  if (UI.participantSelfMic) {
    if (AppState.isMicMuted) UI.participantSelfMic.classList.add('muted');
    else UI.participantSelfMic.classList.remove('muted');
  }
  if (UI.participantSelfCam) {
    if (AppState.isCameraMuted) UI.participantSelfCam.classList.add('muted');
    else UI.participantSelfCam.classList.remove('muted');
  }
}

/* ==========================================================================
   Active Speaker Detection (AudioContext Analysis)
   ========================================================================== */
let audioAnalysisBuffer = null;
let lastAudioAnalysisTime = 0;
const speakingStateCache = new Map();

function startAudioAnalysis() {
  if (AppState.isAudioAnalysisRunning) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!AppState.audioContext) AppState.audioContext = new AudioContextClass();
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
  AppState.audioAnalysers.forEach(entry => {
    try {
      if (entry.source) entry.source.disconnect();
      if (entry.analyser) entry.analyser.disconnect();
    } catch (e) {}
  });
  AppState.audioAnalysers.clear();
  speakingStateCache.clear();

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
    AppState.audioAnalysers.set(id, { source, analyser, stream });
  } catch (e) {
    console.warn('Could not setup analyser for', id, e);
  }
}

function analyzeAudioFrame(now) {
  if (!AppState.isAudioAnalysisRunning) return;

  // Throttle analysis to ~10Hz (every 100ms) to ensure smooth 60fps video
  if (!now || now - lastAudioAnalysisTime >= 100) {
    lastAudioAnalysisTime = now || performance.now();

    if (!audioAnalysisBuffer) audioAnalysisBuffer = new Uint8Array(64);

    AppState.audioAnalysers.forEach((entry, id) => {
      try {
        entry.analyser.getByteFrequencyData(audioAnalysisBuffer);
        let sum = 0;
        for (let i = 0; i < audioAnalysisBuffer.length; i++) sum += audioAnalysisBuffer[i];
        const avg = sum / audioAnalysisBuffer.length;
        const isSpeaking = avg > 26;
        const wasSpeaking = speakingStateCache.get(id) || false;

        if (isSpeaking !== wasSpeaking) {
          speakingStateCache.set(id, isSpeaking);
          if (id === 'local') {
            if (UI.localVideoBox) {
              if (isSpeaking && !AppState.isMicMuted) UI.localVideoBox.classList.add('is-speaking');
              else UI.localVideoBox.classList.remove('is-speaking');
            }
          } else {
            const card = document.getElementById(`card-${id}`);
            if (card) {
              if (isSpeaking) card.classList.add('is-speaking');
              else card.classList.remove('is-speaking');
            }
            const sidebarRow = document.getElementById(`sidebar-peer-${id}`);
            if (sidebarRow) {
              if (isSpeaking) sidebarRow.classList.add('is-speaking');
              else sidebarRow.classList.remove('is-speaking');
            }
          }
        }
      } catch (err) {}
    });
  }

  requestAnimationFrame(analyzeAudioFrame);
}

/* ==========================================================================
   Media Control Handlers (Mic, Cam, Screen Share, Camera Flip)
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
    if (UI.localMicMini) UI.localMicMini.classList.remove('muted');
    if (UI.localMicSlash) UI.localMicSlash.style.display = 'none';
    showToast('Microphone unmuted');
  } else {
    UI.btnMic.className = 'ctrl-btn inactive-state';
    UI.iconMicOn.style.display = 'none';
    UI.iconMicOff.style.display = 'block';
    if (UI.localMicMini) UI.localMicMini.classList.add('muted');
    if (UI.localMicSlash) UI.localMicSlash.style.display = 'flex';
    showToast('Microphone muted');
  }

  broadcastProfileUpdate();
}

let isTogglingCamera = false;
async function toggleCamera() {
  if (isTogglingCamera) return;
  isTogglingCamera = true;
  setTimeout(() => { isTogglingCamera = false; }, 350);

  if (!AppState.localStream) {
    await initLocalMediaStream();
    return;
  }

  let videoTracks = AppState.localStream.getVideoTracks();

  // If no track or track ended, re-acquire camera
  if (videoTracks.length === 0 || videoTracks[0].readyState === 'ended') {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: AppState.facingMode || 'user' },
        audio: false
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        AppState.localStream.addTrack(newTrack);
        if (UI.localVideo) UI.localVideo.srcObject = AppState.localStream;
        
        // Replace video track on all peer connections
        AppState.peerCalls.forEach((call) => {
          try {
            const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
            if (sender) sender.replaceTrack(newTrack);
          } catch (e) {}
        });
        videoTracks = [newTrack];
      }
    } catch (e) {
      console.warn('Could not re-acquire video track:', e);
    }
  }

  AppState.isCameraMuted = !AppState.isCameraMuted;
  videoTracks.forEach(track => {
    track.enabled = !AppState.isCameraMuted;
  });

  if (!AppState.isCameraMuted) {
    if (UI.btnCam) UI.btnCam.className = 'ctrl-btn active-state';
    if (UI.iconCamOn) UI.iconCamOn.style.display = 'block';
    if (UI.iconCamOff) UI.iconCamOff.style.display = 'none';
    if (UI.localAvatar) UI.localAvatar.style.display = 'none';
    if (UI.localVideo) UI.localVideo.play().catch(() => {});
    if (UI.waitingLocalPreview) UI.waitingLocalPreview.play().catch(() => {});
    showToast('Camera turned on');
  } else {
    if (UI.btnCam) UI.btnCam.className = 'ctrl-btn inactive-state';
    if (UI.iconCamOn) UI.iconCamOn.style.display = 'none';
    if (UI.iconCamOff) UI.iconCamOff.style.display = 'block';
    if (UI.localAvatar) UI.localAvatar.style.display = 'flex';
    showToast('Camera turned off');
  }

  broadcastProfileUpdate();
}

let isFlippingCamera = false;
async function flipCamera(event) {
  if (event) {
    try { event.stopPropagation(); event.preventDefault(); } catch (e) {}
  }
  if (isFlippingCamera) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  isFlippingCamera = true;
  const targetFacing = AppState.facingMode === 'user' ? 'environment' : 'user';
  showToast('Switching camera...');

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: targetFacing } },
      audio: false
    });
    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) throw new Error('No video track returned');

    newVideoTrack.enabled = !AppState.isCameraMuted;

    if (AppState.localStream) {
      const oldTracks = AppState.localStream.getVideoTracks();
      oldTracks.forEach(t => {
        try { AppState.localStream.removeTrack(t); t.stop(); } catch (e) {}
      });
      AppState.localStream.addTrack(newVideoTrack);
    }

    AppState.facingMode = targetFacing;

    if (UI.localVideo) {
      UI.localVideo.srcObject = AppState.localStream;
      UI.localVideo.play().catch(() => {});
      if (AppState.facingMode === 'environment') UI.localVideo.classList.add('no-mirror');
      else UI.localVideo.classList.remove('no-mirror');
    }

    // Replace track on all active WebRTC senders
    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
        if (sender) sender.replaceTrack(newVideoTrack);
      } catch (e) {}
    });

    showToast(`Switched to ${targetFacing === 'environment' ? 'rear' : 'front'} camera`);
  } catch (err) {
    console.warn('Camera flip note:', err);
    showToast('Camera switch note: ' + (err.name || 'Unavailable'));
  } finally {
    setTimeout(() => { isFlippingCamera = false; }, 500);
  }
}

async function toggleScreenShare() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showAlert('Screen sharing is not supported by your browser.', true);
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
      UI.btnScreen.className = 'ctrl-btn active-state';

      const screenVideoTrack = displayStream.getVideoTracks()[0];

      // Replace video sender on all active peer connections
      AppState.peerCalls.forEach((call) => {
        try {
          const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
          if (sender) sender.replaceTrack(screenVideoTrack);
        } catch (e) {}
      });

      if (UI.localVideo) {
        UI.localVideo.classList.add('no-mirror');
        UI.localVideo.srcObject = displayStream;
      }

      screenVideoTrack.onended = () => {
        stopScreenSharing();
      };

      showToast('Screen sharing started');
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        showAlert('Screen share notice: ' + (err.message || err.name), true);
      }
    }
  } else {
    stopScreenSharing();
  }
}

function stopScreenSharing() {
  if (!AppState.isSharingScreen) return;
  AppState.isSharingScreen = false;
  UI.btnScreen.className = 'ctrl-btn';

  if (AppState.displayStream) {
    AppState.displayStream.getTracks().forEach(t => t.stop());
    AppState.displayStream = null;
  }

  if (AppState.facingMode === 'user' && UI.localVideo) {
    UI.localVideo.classList.remove('no-mirror');
  }
  if (UI.localVideo) UI.localVideo.srcObject = AppState.localStream;

  const cameraTrack = AppState.localStream?.getVideoTracks()[0];
  if (cameraTrack) {
    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
        if (sender) sender.replaceTrack(cameraTrack);
      } catch (e) {}
    });
  }

  showToast('Screen sharing stopped');
}

/* ==========================================================================
   WhatsApp Web Left Sidebar & In-Call Chat Handlers
   ========================================================================== */
function toggleSidebar(forceState = null) {
  if (forceState !== null) {
    AppState.isSidebarOpen = forceState;
  } else {
    AppState.isSidebarOpen = !AppState.isSidebarOpen;
  }

  if (AppState.isSidebarOpen) {
    if (UI.callSidebar) UI.callSidebar.classList.add('open');
    if (UI.btnChat) UI.btnChat.classList.add('active-state');
    AppState.unreadChatCount = 0;
    if (UI.chatUnreadBadge) UI.chatUnreadBadge.style.display = 'none';
    if (UI.stageUnreadDot) UI.stageUnreadDot.style.display = 'none';
    if (UI.sidebarTabUnread) UI.sidebarTabUnread.style.display = 'none';
    if (AppState.currentSidebarTab === 'chat' && UI.chatInput) {
      setTimeout(() => UI.chatInput.focus(), 150);
    }
  } else {
    if (UI.callSidebar) UI.callSidebar.classList.remove('open');
    if (UI.btnChat) UI.btnChat.classList.remove('active-state');
  }
}

function switchSidebarTab(tabName) {
  AppState.currentSidebarTab = tabName;
  if (!AppState.isSidebarOpen) toggleSidebar(true);

  if (tabName === 'chat') {
    UI.tabBtnChat.classList.add('active');
    UI.tabBtnPeople.classList.remove('active');
    UI.sidebarPaneChat.style.display = 'flex';
    UI.sidebarPanePeople.style.display = 'none';
    AppState.unreadChatCount = 0;
    if (UI.sidebarTabUnread) UI.sidebarTabUnread.style.display = 'none';
    if (UI.chatUnreadBadge) UI.chatUnreadBadge.style.display = 'none';
    if (UI.stageUnreadDot) UI.stageUnreadDot.style.display = 'none';
    if (UI.chatInput) setTimeout(() => UI.chatInput.focus(), 150);
  } else {
    UI.tabBtnPeople.classList.add('active');
    UI.tabBtnChat.classList.remove('active');
    UI.sidebarPaneChat.style.display = 'none';
    UI.sidebarPanePeople.style.display = 'flex';
    renderSidebarParticipantsList();
  }
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

function appendSystemNotification(text) {
  if (!UI.chatMessagesList) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-system-msg';
  msgDiv.innerHTML = `<span>${text}</span>`;
  UI.chatMessagesList.appendChild(msgDiv);
  UI.chatMessagesList.scrollTop = UI.chatMessagesList.scrollHeight;
}

function notifyUserEvent(text) {
  showToast(text);
  appendSystemNotification(text);
}

function appendChatMessage(sender, text, isLocal, time) {
  if (!UI.chatMessagesList) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isLocal ? 'local' : 'remote'}`;

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

  // WhatsApp blue double checks (✓✓) for outgoing messages
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

  // Unread badge notifications if chat isn't currently in view
  if (!isLocal && (!AppState.isSidebarOpen || AppState.currentSidebarTab !== 'chat')) {
    AppState.unreadChatCount++;
    if (UI.chatUnreadBadge) {
      UI.chatUnreadBadge.textContent = AppState.unreadChatCount;
      UI.chatUnreadBadge.style.display = 'inline-block';
    }
    if (UI.stageUnreadDot) UI.stageUnreadDot.style.display = 'block';
    if (UI.sidebarTabUnread) {
      UI.sidebarTabUnread.textContent = AppState.unreadChatCount;
      UI.sidebarTabUnread.style.display = 'inline-block';
    }
    showToast(`${sender}: ${text.length > 25 ? text.slice(0, 25) + '...' : text}`);
  }
}

/* ==========================================================================
   Call Timer & Sharing Helpers
   ========================================================================== */
function startCallTimer() {
  stopCallTimer();
  AppState.callStartTime = Date.now();
  if (UI.callDurationText) UI.callDurationText.textContent = '00:00';

  AppState.callTimerInterval = setInterval(() => {
    if (!AppState.callStartTime) return;
    const elapsed = Math.floor((Date.now() - AppState.callStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    if (UI.callDurationText) UI.callDurationText.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopCallTimer() {
  if (AppState.callTimerInterval) {
    clearInterval(AppState.callTimerInterval);
    AppState.callTimerInterval = null;
  }
}

function handleShareAction() {
  const shareData = {
    title: 'GhostCall Video Invite',
    text: `Join my private WhatsApp-style video call on GhostCall! Room: ${AppState.currentRoomId}`,
    url: window.location.href
  };

  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    navigator.share(shareData).catch(() => openShareModal());
  } else {
    openShareModal();
  }
}

function openShareModal() {
  if (UI.shareModalCode) UI.shareModalCode.textContent = AppState.currentRoomId || '------';
  if (UI.shareModalLinkInput) UI.shareModalLinkInput.value = window.location.href;
  if (UI.modalShare) UI.modalShare.style.display = 'flex';
}

function closeShareModal() {
  if (UI.modalShare) UI.modalShare.style.display = 'none';
}

function copyRoomCode() {
  if (!AppState.currentRoomId) return;
  copyTextToClipboard(AppState.currentRoomId, `Room code copied: ${AppState.currentRoomId}`);
}

function copyInviteLink() {
  const link = window.location.href;
  copyTextToClipboard(link, 'Invite link copied to clipboard!');
}

function shareToWhatsApp() {
  const link = window.location.href;
  const msg = encodeURIComponent(`Join my private video call on GhostCall! 📹\n\nRoom Code: ${AppState.currentRoomId}\nLink: ${link}`);
  window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
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
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (e) {
    window.prompt('Copy text:', text);
  }
  document.body.removeChild(temp);
}

/* ==========================================================================
   Modals & Exit Navigation
   ========================================================================== */
function showRoomNotFoundModal(msg, title = 'Invalid Room Code') {
  const titleEl = document.getElementById('modal-room-error-title');
  if (titleEl) titleEl.textContent = title;
  if (UI.modalRoomErrorDesc && msg) UI.modalRoomErrorDesc.textContent = msg;
  if (UI.modalRoomNotFound) UI.modalRoomNotFound.style.display = 'flex';
}

function closeRoomNotFoundModal() {
  if (UI.modalRoomNotFound) UI.modalRoomNotFound.style.display = 'none';
  if (UI.roomInput) {
    UI.roomInput.focus();
    UI.roomInput.select();
  }
}

function confirmLeaveCall() {
  if (UI.modalLeave) UI.modalLeave.style.display = 'flex';
}

function closeLeaveModal() {
  if (UI.modalLeave) UI.modalLeave.style.display = 'none';
}

function executeLeaveCall() {
  closeLeaveModal();
  exitCallToHero(true);
}

function exitCallToHero(cleanHash = true) {
  AppState.isCallActive = false;

  // Broadcast exit to peers before cleaning up
  broadcastMeshMessage({
    type: 'PEER_LEFT',
    peerId: AppState.myPeerId,
    name: AppState.myDisplayName || 'Friend'
  });

  stopCallTimer();
  stopAudioAnalysis();

  // Stop local hardware media tracks
  if (AppState.localStream) {
    AppState.localStream.getTracks().forEach(t => t.stop());
    AppState.localStream = null;
  }
  if (AppState.displayStream) {
    AppState.displayStream.getTracks().forEach(t => t.stop());
    AppState.displayStream = null;
  }
  if (UI.localVideo) UI.localVideo.srcObject = null;
  if (UI.waitingLocalPreview) UI.waitingLocalPreview.srcObject = null;

  // Close peer connections
  AppState.peerCalls.forEach(call => {
    try { call.close(); } catch (e) {}
  });
  AppState.peerCalls.clear();

  AppState.peerDataChannels.forEach(conn => {
    try { conn.close(); } catch (e) {}
  });
  AppState.peerDataChannels.clear();
  AppState.peerProfiles.clear();
  AppState.activeParticipants.clear();
  AppState.joinedPeersNotified.clear();

  if (AppState.peer) {
    try { AppState.peer.destroy(); } catch (e) {}
    AppState.peer = null;
  }

  // Clear remote video cards
  const cards = UI.videoGrid.querySelectorAll('.video-card');
  cards.forEach(c => c.remove());

  // Close all open modals
  closeLeaveModal();
  closeShareModal();
  closeRoomNotFoundModal();

  AppState.currentRoomId = null;
  if (cleanHash) {
    try {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    } catch (e) {}
  }

  showHeroView();
  showToast('You left the video call');
}

function showHeroView() {
  UI.body.classList.remove('in-call-mode');
  UI.heroView.style.display = 'flex';
  UI.callView.style.display = 'none';
  if (UI.roomInfoPill) UI.roomInfoPill.style.display = 'none';
  if (UI.participantsPill) UI.participantsPill.style.display = 'none';
  if (UI.btnHeaderShare) UI.btnHeaderShare.style.display = 'none';
  if (UI.headerCallTimer) UI.headerCallTimer.style.display = 'none';
}

function showCallView() {
  UI.body.classList.add('in-call-mode');
  UI.heroView.style.display = 'none';
  UI.callView.style.display = 'flex';
  if (UI.roomInfoPill) UI.roomInfoPill.style.display = 'inline-flex';
  if (UI.participantsPill) UI.participantsPill.style.display = 'inline-flex';
  if (UI.btnHeaderShare) UI.btnHeaderShare.style.display = 'inline-flex';
  if (UI.headerCallTimer) UI.headerCallTimer.style.display = 'inline-flex';

  // Open sidebar by default on desktop, closed on mobile
  if (window.innerWidth > 1024) toggleSidebar(true);
  else toggleSidebar(false);
}

function handleBrandClick() {
  if (AppState.isCallActive) confirmLeaveCall();
  else showHeroView();
}

/* ==========================================================================
   Alerts & Toast Notification Helpers
   ========================================================================== */
function showAlert(text, isError = true) {
  if (UI.alertBanner && UI.alertText) {
    UI.alertText.textContent = text;
    UI.alertBanner.style.backgroundColor = isError ? '#fee2e2' : '#dcfce7';
    UI.alertBanner.style.color = isError ? '#991b1b' : '#166534';
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
function showToast(text) {
  if (!UI.toastMsg || !UI.toastText) return;
  UI.toastText.textContent = text;
  UI.toastMsg.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    UI.toastMsg.classList.remove('show');
  }, 3000);
}

/* ==========================================================================
   Draggable Picture-in-Picture Local Self-View
   ========================================================================== */
function initDragPip() {
  const pip = UI.localVideoBox;
  if (!pip) return;

  let isPointerActive = false;
  let startX = 0, startY = 0;
  let pipStartLeft = 0, pipStartTop = 0;

  const onPointerDown = (e) => {
    if (e.target.closest('#btn-camera-flip')) return;
    isPointerActive = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = pip.getBoundingClientRect();
    pipStartLeft = rect.left;
    pipStartTop = rect.top;
    pip.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!isPointerActive) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      pip.style.left = `${pipStartLeft + dx}px`;
      pip.style.top = `${pipStartTop + dy}px`;
      pip.style.right = 'auto';
      pip.style.bottom = 'auto';
    }
  };

  const onPointerUp = (e) => {
    if (!isPointerActive) return;
    isPointerActive = false;
    try { pip.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  pip.addEventListener('pointerdown', onPointerDown);
  pip.addEventListener('pointermove', onPointerMove);
  pip.addEventListener('pointerup', onPointerUp);
  pip.addEventListener('pointercancel', onPointerUp);

  // Double click / tap to expand or shrink PiP
  pip.addEventListener('dblclick', () => {
    pip.classList.toggle('is-expanded');
  });
}

/* ==========================================================================
   Global Keyboard Shortcuts
   ========================================================================== */
function initGlobalKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    if (e.key === 'Escape') {
      closeRoomNotFoundModal();
      closeLeaveModal();
      closeShareModal();
      return;
    }

    if (!AppState.currentRoomId) return;

    const key = e.key.toLowerCase();
    if (key === 'm') {
      e.preventDefault();
      toggleMicrophone();
    } else if (key === 'v') {
      e.preventDefault();
      toggleCamera();
    } else if (key === 's') {
      e.preventDefault();
      toggleScreenShare();
    } else if (key === 'c') {
      e.preventDefault();
      toggleSidebar();
    } else if (key === 'f') {
      e.preventDefault();
      toggleFullScreen();
    }
  });
}

/* ==========================================================================
   Full-Screen Mode Handlers
   ========================================================================== */
function toggleFullScreen() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFs) {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function initFullscreenHandlers() {
  const updateFsUI = () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (UI.iconFsEnter && UI.iconFsExit && UI.labelFs) {
      if (isFs) {
        UI.iconFsEnter.style.display = 'none';
        UI.iconFsExit.style.display = 'block';
        UI.labelFs.textContent = 'Exit';
      } else {
        UI.iconFsEnter.style.display = 'block';
        UI.iconFsExit.style.display = 'none';
        UI.labelFs.textContent = 'Full';
      }
    }
  };

  document.addEventListener('fullscreenchange', updateFsUI);
  document.addEventListener('webkitfullscreenchange', updateFsUI);
}

// Mobile Audio unlock on first touch gesture
function initMobileAudioUnlock() {
  const unlockAudio = () => {
    const videos = document.querySelectorAll('#video-grid video');
    videos.forEach((v) => {
      if (v.id !== 'waiting-local-preview' && v.muted) {
        v.muted = false;
        v.play().catch(() => {});
      }
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && AppState.audioContext && AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume().catch(() => {});
    }
  };

  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
  window.addEventListener('click', unlockAudio, { passive: true, once: true });
}
