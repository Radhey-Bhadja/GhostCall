const rtcConfiguration = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
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

const AppState = {
  currentRoomId: null,
  lastRoomId: null,
  myPeerId: null,
  sessionUid: Math.random().toString(36).substring(2, 8),
  myDisplayName: localStorage.getItem('ghostcall_username') || '',
  isRoomHost: false,
  isJoiningAsGuest: false,
  peer: null,
  localStream: null,
  displayStream: null,
  isSharingScreen: false,
  facingMode: 'user',
  isCameraMuted: false,
  isMicMuted: false,
  peerCalls: new Map(),
  peerDataChannels: new Map(),
  peerProfiles: new Map(),
  activeParticipants: new Set(),
  audioContext: null,
  audioAnalysers: new Map(),
  isAudioAnalysisRunning: false,
  callStartTime: null,
  callTimerInterval: null,
  unreadChatCount: 0,
  isSidebarOpen: false,
  currentSidebarTab: 'chat',
  isCallActive: false,
  _guestJoinTimeout: null,
  joinedPeersNotified: new Set(),
  isSwappedVideo: false,
  swappedPeerId: null,
  _guestRetryCount: 0,
  videoQualityPreset: localStorage.getItem('ghostcall_video_resolution') || '1080p',
  videoEnhancementMode: localStorage.getItem('ghostcall_video_enhancement') || 'clean'
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

const UI = {
  body: document.body,
  heroView: document.getElementById('hero-view'),
  callView: document.getElementById('call-view'),
  callStage: document.getElementById('call-stage'),
  videoGrid: document.getElementById('video-grid'),
  waitingScreen: document.getElementById('waiting-screen'),
  waitingLocalPreview: document.getElementById('waiting-local-preview'),
  waitingCodeText: document.getElementById('waiting-code-text'),
  localVideoBox: document.getElementById('local-video-box'),
  localVideo: document.getElementById('local-video'),
  localAvatar: document.getElementById('local-avatar'),
  localAvatarInitial: document.getElementById('local-avatar-initial'),
  localAvatarName: document.getElementById('local-avatar-name'),
  localTagName: document.getElementById('local-tag-name'),
  localMicMini: document.getElementById('local-mic-mini'),
  localMicSlash: document.getElementById('local-mic-slash'),
  btnCameraFlip: document.getElementById('btn-camera-flip'),
  appHeader: document.getElementById('app-header'),
  roomInfoPill: document.getElementById('header-room-pill'),
  headerQualityPill: document.getElementById('header-quality-pill'),
  qualityPillLabel: document.getElementById('quality-pill-label'),
  participantsPill: document.getElementById('header-participants-pill'),
  displayRoomId: document.getElementById('display-room-id'),
  participantCountText: document.getElementById('participant-count-text'),
  btnHeaderShare: document.getElementById('btn-header-share'),
  headerCallTimer: document.getElementById('header-call-timer'),
  callDurationText: document.getElementById('call-duration-text'),
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
  controlsDock: document.getElementById('controls-dock'),
  btnMic: document.getElementById('btn-mic'),
  btnCam: document.getElementById('btn-cam'),
  btnVideoQuality: document.getElementById('btn-video-quality'),
  btnScreen: document.getElementById('btn-screen'),
  btnChat: document.getElementById('btn-chat'),
  chatUnreadBadge: document.getElementById('chat-unread-badge'),
  btnFullscreen: document.getElementById('btn-fullscreen'),
  iconFsEnter: document.getElementById('icon-fs-enter'),
  iconFsExit: document.getElementById('icon-fs-exit'),
  iconMicOn: document.getElementById('icon-mic-on'),
  iconMicOff: document.getElementById('icon-mic-off'),
  iconCamOn: document.getElementById('icon-cam-on'),
  iconCamOff: document.getElementById('icon-cam-off'),
  chatMessagesList: document.getElementById('chat-messages-list'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  alertBanner: document.getElementById('alert-banner'),
  alertText: document.getElementById('alert-text'),
  toastMsg: document.getElementById('toast-msg'),
  toastText: document.getElementById('toast-text'),
  modalLeave: document.getElementById('modal-leave'),
  modalShare: document.getElementById('modal-share'),
  modalVideoQuality: document.getElementById('modal-video-quality'),
  modalRoomNotFound: document.getElementById('modal-room-not-found'),
  modalRoomErrorDesc: document.getElementById('modal-room-error-desc'),
  shareModalCode: document.getElementById('share-modal-code'),
  shareModalLinkInput: document.getElementById('share-modal-link-input'),
  nameInput: document.getElementById('input-display-name'),
  nameEntryWrap: document.getElementById('name-entry-wrap'),
  nameInputError: document.getElementById('name-input-error'),
  heroAvatarPreview: document.getElementById('hero-avatar-preview'),
  roomInput: document.getElementById('input-room-code'),
  roomInputError: document.getElementById('room-input-error'),
  codeEntryContainer: document.getElementById('code-entry-container'),
  btnJoinRoom: document.getElementById('btn-join-room')
};

window.addEventListener('DOMContentLoaded', () => {
  initUserPreferences();
  applyInitialVideoEnhancement();
  initDragPip();
  initGlobalKeyboardShortcuts();
  initFullscreenHandlers();
  initMobileAudioUnlock();
  checkUrlHashOnLoad();
});

window.addEventListener('beforeunload', () => {
  if (AppState.currentRoomId) {
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

function handleNavigationChange() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash.startsWith('room-')) {
    const extractedId = hash.replace('room-', '').replace(/\D/g, '').slice(0, 6);
    if (extractedId.length === 6 && extractedId !== AppState.currentRoomId) {
      startVideoCallRoom(extractedId, true);
    }
  } else if (AppState.isCallActive) {
    exitCallToHero(false);
  }
}

window.addEventListener('popstate', handleNavigationChange);
window.addEventListener('hashchange', handleNavigationChange);

function initUserPreferences() {
  if (AppState.myDisplayName && UI.nameInput) {
    UI.nameInput.value = AppState.myDisplayName;
    updateHeroAvatarPreview(AppState.myDisplayName);
  }

  if (UI.nameInput) {
    UI.nameInput.addEventListener('input', (e) => {
      clearNameInputError();
      const val = e.target.value.trim();
      AppState.myDisplayName = val;
      if (val) localStorage.setItem('ghostcall_username', val);
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
      if (controlKeys.includes(e.key) || e.key === 'Unidentified' || e.key === 'Process' || e.ctrlKey || e.metaKey) return;
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
      UI.roomInput.value = text.replace(/\D/g, '').slice(0, 6);
      clearRoomInputError();
    });
  }

  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    if (UI.btnCameraFlip) UI.btnCameraFlip.style.display = 'flex';
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    if (UI.btnScreen) UI.btnScreen.style.display = 'none';
  }
}

function updateHeroAvatarPreview(name) {
  if (!UI.heroAvatarPreview) return;
  UI.heroAvatarPreview.textContent = name ? name.charAt(0).toUpperCase() : '👤';
}

function updateLocalDisplayName(name) {
  const displayName = name || 'You';
  const initial = displayName.charAt(0).toUpperCase();
  if (UI.localTagName) UI.localTagName.textContent = displayName;
  if (UI.localAvatarName) UI.localAvatarName.textContent = displayName;
  if (UI.localAvatarInitial) UI.localAvatarInitial.textContent = initial;
  if (UI.sidebarUserName) UI.sidebarUserName.textContent = displayName;
  if (UI.sidebarUserInitial) UI.sidebarUserInitial.textContent = initial;
  if (UI.participantSelfName) UI.participantSelfName.textContent = displayName;
  if (UI.participantSelfInitial) UI.participantSelfInitial.textContent = initial;
}

function validateDisplayName() {
  const raw = UI.nameInput ? UI.nameInput.value : (AppState.myDisplayName || '');
  const val = raw.trim();
  AppState.myDisplayName = val;
  if (val) {
    localStorage.setItem('ghostcall_username', val);
  } else {
    localStorage.removeItem('ghostcall_username');
  }
  clearNameInputError();
  return true;
}

function showNameInputError(msg) {
  const wrap = UI.nameEntryWrap || document.getElementById('name-entry-wrap') || UI.nameInput?.parentElement;
  if (wrap) wrap.classList.add('has-error');
  const errEl = UI.nameInputError || document.getElementById('name-input-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

function clearNameInputError() {
  const wrap = UI.nameEntryWrap || document.getElementById('name-entry-wrap') || UI.nameInput?.parentElement;
  if (wrap) wrap.classList.remove('has-error');
  const errEl = UI.nameInputError || document.getElementById('name-input-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
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

function createNewRoom() {
  validateDisplayName();
  unlockAudio();
  const randomRoomId = String(Math.floor(100000 + Math.random() * 900000));
  startVideoCallRoom(randomRoomId, false);
}

function joinExistingRoom() {
  validateDisplayName();
  unlockAudio();
  let val = UI.roomInput ? UI.roomInput.value.trim() : '';
  if (!val) {
    showRoomInputError('Please enter a 6-digit room code');
    showRoomNotFoundModal('Please enter a 6-digit room code to join a call.', 'Invalid Room Code');
    if (UI.roomInput) UI.roomInput.focus();
    return;
  }

  if (val.includes('#room-')) val = val.split('#room-')[1];
  else if (val.includes('#')) val = val.split('#')[1];

  val = val.replace(/[\s\-_]/g, '').replace(/\D/g, '').slice(0, 6);

  if (val.length !== 6) {
    showRoomInputError('Room code must be exactly 6 digits');
    showRoomNotFoundModal('Room code must be exactly 6 digits (numbers only).', 'Invalid Room Code');
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

async function startVideoCallRoom(roomId, isGuest = false) {
  unlockAudio();
  AppState.currentRoomId = roomId;
  AppState.lastRoomId = roomId;
  AppState.isCallActive = true;
  AppState.isJoiningAsGuest = isGuest;

  if (window.location.hash !== `#room-${roomId}`) {
    try {
      history.pushState({ inRoom: true, room: roomId }, '', `#room-${roomId}`);
    } catch (e) {
      window.location.hash = `room-${roomId}`;
    }
  }

  if (UI.displayRoomId) UI.displayRoomId.textContent = roomId;
  if (UI.waitingCodeText) UI.waitingCodeText.textContent = roomId;
  if (UI.sidebarRoomCode) UI.sidebarRoomCode.textContent = roomId;
  if (UI.shareModalCode) UI.shareModalCode.textContent = roomId;
  if (UI.shareModalLinkInput) UI.shareModalLinkInput.value = window.location.href;

  updateLocalDisplayName(AppState.myDisplayName || 'You');
  showCallView();
  startCallTimer();

  await initLocalMediaStream();
  initPeerMesh();
  startAudioAnalysis();
  if (AppState.localStream && AppState.audioContext) {
    setupAudioAnalyser('local', AppState.localStream);
  }
}

function getVideoConstraintsForPreset(preset = '1080p', facingMode = 'user') {
  const facing = facingMode ? { ideal: facingMode } : 'user';

  if (preset === '1080p') {
    return {
      facingMode: facing,
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      aspectRatio: { ideal: 1.777777778 },
      frameRate: { ideal: 30, max: 60 }
    };
  } else if (preset === '720p') {
    return {
      facingMode: facing,
      width: { ideal: 1280, min: 960 },
      height: { ideal: 720, min: 540 },
      aspectRatio: { ideal: 1.777777778 },
      frameRate: { ideal: 30 }
    };
  } else {
    return {
      facingMode: facing,
      width: { ideal: 854 },
      height: { ideal: 480 },
      frameRate: { ideal: 24, max: 30 }
    };
  }
}

async function enhanceCameraTrackSettings(track) {
  if (!track || track.kind !== 'video') return;
  try {
    if (typeof track.getCapabilities === 'function') {
      const caps = track.getCapabilities();
      const advanced = {};
      if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        advanced.focusMode = 'continuous';
      }
      if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
        advanced.exposureMode = 'continuous';
      }
      if (caps.whiteBalanceMode && Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
        advanced.whiteBalanceMode = 'continuous';
      }
      if (Object.keys(advanced).length > 0 && typeof track.applyConstraints === 'function') {
        await track.applyConstraints({ advanced: [advanced] }).catch(() => {});
      }
    }
  } catch (e) {
    console.debug('Camera track enhancement note:', e);
  }
}

async function initLocalMediaStream() {
  const preset = AppState.videoQualityPreset || '1080p';
  const facing = AppState.facingMode || 'user';

  const audioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: { ideal: 48000 }
  };

  let stream = null;

  // Level 1: Full high-clarity constraints based on preset
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: getVideoConstraintsForPreset(preset, facing),
      audio: audioConstraints
    });
  } catch (err1) {
    // Level 2: Relaxed 1080p without min constraints
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing ? { ideal: facing } : 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: audioConstraints
      });
    } catch (err2) {
      // Level 3: Relaxed 720p HD
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing ? { ideal: facing } : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: audioConstraints
        });
      } catch (err3) {
        // Level 4: Basic video
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing ? { ideal: facing } : 'user' },
            audio: audioConstraints
          });
        } catch (err4) {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            attachLocalStream(audioOnly);
            showAlert('No camera found or permitted. Joining in audio-only mode.', false);
            return;
          } catch (audioErr) {
            try {
              const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
              attachLocalStream(videoOnly);
              showAlert('No microphone found or permitted. Joining in video-only mode.', false);
              return;
            } catch (videoErr) {
              const dummyStream = createFallbackMediaStream();
              attachLocalStream(dummyStream);
              if (err4.name === 'NotAllowedError' || err4.name === 'PermissionDeniedError') {
                showAlert('Camera & Microphone access was blocked. Tap the lock icon in your browser address bar to allow.', true);
              } else if (err4.name === 'NotFoundError') {
                showAlert('No camera or microphone found. You can still watch and chat.', true);
              } else {
                showAlert('Media access error: ' + (err4.message || 'Check device permissions'), true);
              }
              return;
            }
          }
        }
      }
    }
  }

  if (stream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      await enhanceCameraTrackSettings(videoTrack);
    }
    attachLocalStream(stream);
    dismissAlert();
    updateCameraStatsUI();
  }
}

function attachLocalStream(stream) {
  AppState.localStream = stream;
  if (UI.localVideo) {
    UI.localVideo.muted = true;
    UI.localVideo.playsInline = true;
    UI.localVideo.setAttribute('playsinline', '');
    UI.localVideo.srcObject = stream;
    UI.localVideo.play().catch(() => {});
    UI.localVideo.onloadedmetadata = () => {
      updateCameraStatsUI();
    };
  }

  if (UI.waitingLocalPreview) {
    UI.waitingLocalPreview.muted = true;
    UI.waitingLocalPreview.playsInline = true;
    UI.waitingLocalPreview.setAttribute('playsinline', '');
    UI.waitingLocalPreview.srcObject = stream;
    UI.waitingLocalPreview.play().catch(() => {});
  }

  updateStageWaitingVisibility();
  updateCameraStatsUI();
  setupAudioAnalyser('local', stream);
}

function updateStageWaitingVisibility() {
  const remoteCount = AppState.peerCalls ? AppState.peerCalls.size : 0;
  if (remoteCount === 0) {
    if (UI.waitingScreen) UI.waitingScreen.style.display = 'flex';
    if (UI.waitingLocalPreview && AppState.localStream) {
      UI.waitingLocalPreview.style.display = AppState.isCameraMuted ? 'none' : 'block';
      if (!AppState.isCameraMuted) {
        if (UI.waitingLocalPreview.srcObject !== AppState.localStream) {
          UI.waitingLocalPreview.srcObject = AppState.localStream;
        }
        UI.waitingLocalPreview.play().catch(() => {});
      }
    }
    if (UI.localVideoBox) UI.localVideoBox.style.display = 'none';
  } else {
    if (UI.waitingScreen) UI.waitingScreen.style.display = 'none';
    if (UI.localVideoBox) UI.localVideoBox.style.display = 'block';
  }
}

let fallbackAudioCtx = null;
let fallbackOscillator = null;
let fallbackDummyStream = null;

function createFallbackMediaStream() {
  if (fallbackDummyStream && fallbackDummyStream.active) {
    return fallbackDummyStream;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let dummyAudio;
  if (AudioContextClass) {
    try {
      if (!fallbackAudioCtx || fallbackAudioCtx.state === 'closed') {
        fallbackAudioCtx = new AudioContextClass();
      }
      if (fallbackOscillator) {
        try { fallbackOscillator.stop(); fallbackOscillator.disconnect(); } catch (e) {}
      }
      const destNode = fallbackAudioCtx.createMediaStreamDestination();
      fallbackOscillator = fallbackAudioCtx.createOscillator();
      fallbackOscillator.connect(destNode);
      fallbackOscillator.start();
      dummyAudio = destNode.stream.getAudioTracks()[0];
      if (dummyAudio) dummyAudio.enabled = false;
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

  fallbackDummyStream = new MediaStream(tracks);
  return fallbackDummyStream;
}

function initPeerMesh() {
  const hostPeerId = `ghostcall-${AppState.currentRoomId}-host`;

  if (AppState.isJoiningAsGuest) {
    joinAsMeshGuest(hostPeerId);
    return;
  }

  AppState.peer = new Peer(hostPeerId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    AppState.isRoomHost = true;
    AppState.myPeerId = id;
    AppState.activeParticipants.add(id);
    updateParticipantsDisplay();
    bindPeerListeners();
    notifyUserEvent(`You entered room #${AppState.currentRoomId}`);
  });

  AppState.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      joinAsMeshGuest(hostPeerId);
    } else {
      if (err.type !== 'peer-unavailable') {
        showAlert('Connection note: ' + (err.message || err.type), false);
      }
    }
  });
}

function joinAsMeshGuest(hostPeerId) {
  AppState.isRoomHost = false;
  const guestId = `ghostcall-${AppState.currentRoomId}-guest-${AppState.sessionUid}`;

  if (AppState._guestJoinTimeout) {
    clearTimeout(AppState._guestJoinTimeout);
    AppState._guestJoinTimeout = null;
  }

  AppState.peer = new Peer(guestId, rtcConfiguration);

  AppState.peer.on('open', (id) => {
    AppState._guestRetryCount = 0;
    AppState.myPeerId = id;
    AppState.activeParticipants.add(id);
    updateParticipantsDisplay();
    bindPeerListeners();

    AppState._guestJoinTimeout = setTimeout(() => {
      if (AppState.isCallActive && AppState.isJoiningAsGuest && AppState.peerCalls.size === 0) {
        handleRoomNotFound(`Room #${AppState.currentRoomId} does not exist or has ended.`);
      }
    }, 6000);

    connectDataChannelToPeer(hostPeerId);
    establishMediaCall(hostPeerId);
  });

  AppState.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      if (!AppState._guestRetryCount) AppState._guestRetryCount = 0;
      AppState._guestRetryCount++;
      if (AppState._guestRetryCount > 5) {
        handleRoomNotFound('Could not join room due to connection conflict. Please try again.');
        return;
      }
      AppState.sessionUid = Math.random().toString(36).substring(2, 8);
      setTimeout(() => joinAsMeshGuest(hostPeerId), 300 * AppState._guestRetryCount);
    } else if (err.type === 'peer-unavailable') {
      console.warn('Host peer does not exist. Room not found:', hostPeerId);
      handleRoomNotFound(`Room #${AppState.currentRoomId} doesn't exist. Please enter a valid room code.`);
    }
  });
}

function handleRoomNotFound(msg) {
  if (AppState._guestJoinTimeout) {
    clearTimeout(AppState._guestJoinTimeout);
    AppState._guestJoinTimeout = null;
  }
  exitCallToHero(true);
  showRoomNotFoundModal(msg || "Room doesn't exist. Please enter a valid room code.", 'Room Not Found');
  showRoomInputError("Room doesn't exist. Please enter a valid input.");
  if (UI.roomInput) {
    UI.roomInput.focus();
    UI.roomInput.select();
  }
}

function bindPeerListeners() {
  if (!AppState.peer) return;

  AppState.peer.on('call', (incomingCall) => {
    const streamToSend = AppState.isSharingScreen && AppState.displayStream 
      ? AppState.displayStream 
      : (AppState.localStream || createFallbackMediaStream());

    incomingCall.answer(streamToSend, { sdpTransform: optimizeWebRtcSdp });
    configureCallParameters(incomingCall);

    incomingCall.on('stream', (remoteStream) => {
      if (AppState._guestJoinTimeout) {
        clearTimeout(AppState._guestJoinTimeout);
        AppState._guestJoinTimeout = null;
      }
      renderRemoteVideoTile(incomingCall.peer, remoteStream);
    });

    incomingCall.on('close', () => {
      removeRemoteVideoTile(incomingCall.peer);
    });

    incomingCall.on('error', () => {
      removeRemoteVideoTile(incomingCall.peer);
    });

    AppState.peerCalls.set(incomingCall.peer, incomingCall);
    AppState.activeParticipants.add(incomingCall.peer);
    updateParticipantsDisplay();
  });

  AppState.peer.on('connection', (conn) => {
    setupDataConnection(conn);
  });
}

function setupDataConnection(conn) {
  conn.on('open', () => {
    AppState.peerDataChannels.set(conn.peer, conn);
    AppState.activeParticipants.add(conn.peer);

    conn.send({
      type: 'PROFILE_UPDATE',
      peerId: AppState.myPeerId,
      name: AppState.myDisplayName || 'Friend',
      videoEnabled: !AppState.isCameraMuted,
      audioEnabled: !AppState.isMicMuted
    });

    if (AppState.isRoomHost) {
      conn.send({
        type: 'ROOM_MEMBERS',
        peers: Array.from(AppState.activeParticipants),
        profiles: Object.fromEntries(AppState.peerProfiles)
      });

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

  conn.on('error', () => {
    if (!conn.open) AppState.peerDataChannels.delete(conn.peer);
  });

  conn.on('close', () => {
    handlePeerDisconnect(conn.peer);
  });
}

function connectDataChannelToPeer(targetPeerId) {
  if (AppState.peerDataChannels.has(targetPeerId)) return;
  if (!AppState.peer || AppState.peer.destroyed) return;
  const conn = AppState.peer.connect(targetPeerId, { reliable: true });
  AppState.peerDataChannels.set(targetPeerId, conn);
  setupDataConnection(conn);
}

function handlePeerDisconnect(peerId) {
  const profile = AppState.peerProfiles.get(peerId);
  const friendName = (profile && typeof profile.name === 'string') ? profile.name : 'A friend';

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
  } else if (peerId.endsWith('-host')) {
    const remainingPeers = Array.from(AppState.activeParticipants).filter(id => id !== peerId && !id.endsWith('-host'));
    remainingPeers.sort();
    if (remainingPeers[0] === AppState.myPeerId) {
      promoteGuestToHost();
    }
  }

  removeRemoteVideoTile(peerId);
}

function promoteGuestToHost() {
  if (AppState.isRoomHost || !AppState.isCallActive) return;
  const hostPeerId = `ghostcall-${AppState.currentRoomId}-host`;
  const promoPeer = new Peer(hostPeerId, rtcConfiguration);

  promoPeer.on('open', (id) => {
    AppState.isRoomHost = true;
    if (AppState.peer && AppState.peer !== promoPeer) {
      try { AppState.peer.destroy(); } catch (e) {}
    }
    AppState.peer = promoPeer;
    AppState.myPeerId = id;
    AppState.activeParticipants.add(id);
    bindPeerListeners();
    AppState.peerCalls.forEach((_, pid) => {
      if (pid !== id && !pid.endsWith('-host')) {
        connectDataChannelToPeer(pid);
        establishMediaCall(pid);
      }
    });
  });

  promoPeer.on('error', () => {
    try { promoPeer.destroy(); } catch (err) {}
  });
}

function handleMeshSignaling(data, fromPeerId) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'ROOM_MEMBERS':
      if (data.profiles) {
        Object.entries(data.profiles).forEach(([pid, prof]) => {
          if (prof && typeof prof === 'object') {
            const raw = typeof prof.name === 'string' ? prof.name.trim().slice(0, 24) : 'Friend';
            AppState.peerProfiles.set(pid, {
              name: raw || 'Friend',
              videoEnabled: prof.videoEnabled !== false,
              audioEnabled: prof.audioEnabled !== false
            });
          }
        });
      }

      if (Array.isArray(data.peers)) {
        data.peers.forEach((peerId) => {
          if (peerId !== AppState.myPeerId) {
            AppState.activeParticipants.add(peerId);
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
        const rawName = typeof data.name === 'string' ? data.name.trim() : '';
        const friendName = rawName ? rawName.slice(0, 24) : 'Friend';
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
        const raw = (profile && typeof profile.name === 'string') ? profile.name : 'A friend';
        const friendName = typeof data.name === 'string' ? data.name.trim().slice(0, 24) : raw;
        if (AppState.joinedPeersNotified && AppState.joinedPeersNotified.has(data.peerId)) {
          AppState.joinedPeersNotified.delete(data.peerId);
          notifyUserEvent(`${friendName} left the room`);
        }
        removeRemoteVideoTile(data.peerId);
      }
      break;

    case 'CHAT_MESSAGE': {
      const rawSender = typeof data.senderName === 'string' ? data.senderName.trim() : '';
      const sender = rawSender ? rawSender.slice(0, 24) : 'Friend';
      const text = typeof data.text === 'string' ? data.text.trim().slice(0, 300) : '';
      const time = typeof data.time === 'string' && data.time.length <= 12
        ? data.time
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (text) appendChatMessage(sender, text, false, time);
      break;
    }
  }
}

function broadcastMeshMessage(payload, excludePeerId = null) {
  AppState.peerDataChannels.forEach((conn, peerId) => {
    if (peerId !== excludePeerId && conn && conn.open) {
      try {
        conn.send(payload);
      } catch (e) {}
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
    if (AppState._guestJoinTimeout) {
      clearTimeout(AppState._guestJoinTimeout);
      AppState._guestJoinTimeout = null;
    }
    renderRemoteVideoTile(remotePeerId, remoteStream);
  });

  call.on('close', () => {
    removeRemoteVideoTile(remotePeerId);
  });

  call.on('error', () => {
    removeRemoteVideoTile(remotePeerId);
  });

  AppState.peerCalls.set(remotePeerId, call);
  AppState.activeParticipants.add(remotePeerId);
  updateParticipantsDisplay();
  dynamicallyAdjustBitrates();
}

function optimizeWebRtcSdp(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;

  try {
    // 1. Studio Opus Audio Optimization
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

    // 2. Ultra-Clear HD Video Bandwidth (4.0 Mbps target with immediate high bitrate)
    if (sdp.includes('m=video')) {
      const parts = sdp.split('m=video');
      let videoPart = parts[1];
      videoPart = videoPart.replace(/(\r?\n)b=(AS|TIAS):[^\r\n]+/g, '');

      const firstLineEnd = videoPart.indexOf('\n');
      if (firstLineEnd !== -1) {
        const header = videoPart.substring(0, firstLineEnd + 1);
        let rest = videoPart.substring(firstLineEnd + 1);

        const bw = 'b=AS:4000\r\nb=TIAS:4000000\r\n';

        rest = rest.replace(/(a=fmtp:\d+\s+[^\r\n]+)/g, (match) => {
          if (!match.includes('x-google-max-bitrate')) {
            return match + ';x-google-min-bitrate=1500;x-google-start-bitrate=2500;x-google-max-bitrate=4000';
          }
          return match;
        });

        sdp = parts[0] + 'm=video' + header + bw + rest;
      }
    }
  } catch (err) {
    console.debug('SDP optimization note:', err);
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
      if (typeof pc.restartIce === 'function') {
        try {
          pc.restartIce();
          if (pc.signalingState === 'stable' && typeof pc.createOffer === 'function') {
            pc.createOffer({ iceRestart: true })
              .then(offer => pc.setLocalDescription(offer))
              .catch(() => {});
          }
        } catch (e) {}
      }
    }
  });

  tunePeerSenders(pc);
}

function tunePeerSenders(pc) {
  if (!pc || !pc.getSenders) return;

  const total = AppState.peerCalls.size + 1;
  let maxVideoBitrate = 4000000;
  if (total >= 4) {
    maxVideoBitrate = 1600000;
  } else if (total === 3) {
    maxVideoBitrate = 2800000;
  }

  pc.getSenders().forEach((sender) => {
    if (sender.track && sender.track.kind === 'video') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = maxVideoBitrate;
        params.encodings[0].scaleResolutionDownBy = 1.0;
        if ('networkPriority' in params.encodings[0]) {
          params.encodings[0].networkPriority = 'high';
        }
        params.degradationPreference = 'maintain-resolution';
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
    videoEl.muted = false;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');

    const profile = AppState.peerProfiles.get(peerId);
    const rawName = (profile && typeof profile.name === 'string') ? profile.name.trim() : 'Friend';
    const safeName = escapeHtml(rawName || 'Friend');
    const safeInitial = escapeHtml((rawName || 'F').charAt(0).toUpperCase());

    avatarEl = document.createElement('div');
    avatarEl.className = 'avatar-placeholder';
    avatarEl.id = `avatar-${peerId}`;
    avatarEl.style.display = 'none';
    avatarEl.innerHTML = `
      <div class="avatar-circle">
        <span class="avatar-initial">${safeInitial}</span>
      </div>
      <span class="avatar-name">${safeName}</span>
    `;

    const nameTag = document.createElement('div');
    nameTag.className = 'tile-name-tag';
    nameTag.innerHTML = `<span class="tag-name-text">${safeName}</span>`;

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

  card._originalStream = stream;

  if (videoEl && videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
    videoEl.muted = false;
    videoEl.play().catch(() => {
      videoEl.muted = true;
      videoEl.play().catch(() => {});
      const unmuteOnInteraction = () => {
        if (videoEl) {
          videoEl.muted = false;
          videoEl.play().catch(() => {});
        }
      };
      window.addEventListener('click', unmuteOnInteraction, { once: true, passive: true });
      window.addEventListener('touchstart', unmuteOnInteraction, { once: true, passive: true });
    });
  }

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

  const rawName = typeof profile.name === 'string' ? profile.name : 'Friend';
  const nameEl = card.querySelector('.tag-name-text');
  if (nameEl) nameEl.textContent = rawName;

  const avatarName = card.querySelector('.avatar-name');
  if (avatarName) avatarName.textContent = rawName;

  const avatarInitial = card.querySelector('.avatar-initial');
  if (avatarInitial) avatarInitial.textContent = rawName.charAt(0).toUpperCase();

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
  const card = document.getElementById(`card-${peerId}`);
  if (!card && !AppState.peerCalls.has(peerId) && !AppState.peerDataChannels.has(peerId)) return;

  if (AppState.isSwappedVideo && AppState.swappedPeerId === peerId) {
    restoreVideoSwap();
  }

  if (AppState.peerCalls.has(peerId)) {
    try { AppState.peerCalls.get(peerId).close(); } catch (e) {}
    AppState.peerCalls.delete(peerId);
  }

  if (AppState.peerDataChannels.has(peerId)) {
    try { AppState.peerDataChannels.get(peerId).close(); } catch (e) {}
    AppState.peerDataChannels.delete(peerId);
  }

  if (AppState.audioAnalysers.has(peerId)) {
    const entry = AppState.audioAnalysers.get(peerId);
    try {
      if (entry.source) entry.source.disconnect();
      if (entry.analyser) entry.analyser.disconnect();
    } catch (e) {}
    AppState.audioAnalysers.delete(peerId);
  }
  speakingStateCache.delete(peerId);

  if (card && card.parentNode) {
    card.parentNode.removeChild(card);
  }

  updateStageWaitingVisibility();
  adjustGridLayout();
  updateParticipantsDisplay();
  dynamicallyAdjustBitrates();
}

function adjustGridLayout() {
  if (!UI.videoGrid) return;
  const remoteCount = AppState.peerCalls.size;
  UI.videoGrid.classList.remove('layout-1', 'layout-2', 'layout-3', 'layout-4', 'layout-6', 'layout-8', 'layout-many');

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

  const existingRows = UI.participantsListItems.querySelectorAll('.participant-item:not(.is-self)');
  existingRows.forEach(r => r.remove());

  updateLocalParticipantRow();

  AppState.peerCalls.forEach((_, peerId) => {
    const profile = AppState.peerProfiles.get(peerId) || { name: 'Friend', videoEnabled: true, audioEnabled: true };
    const row = document.createElement('div');
    row.className = 'participant-item';
    row.id = `sidebar-peer-${peerId}`;

    const isSpeaking = speakingStateCache.get(peerId) || false;
    if (isSpeaking) row.classList.add('is-speaking');

    const rawName = (profile && typeof profile.name === 'string') ? profile.name.trim() : 'Friend';
    const safeName = escapeHtml(rawName || 'Friend');
    const safeInitial = escapeHtml((rawName || 'F').charAt(0).toUpperCase());

    row.innerHTML = `
      <div class="participant-avatar">
        <span>${safeInitial}</span>
      </div>
      <div class="participant-details">
        <div class="participant-name-row">
          <span class="participant-name">${safeName}</span>
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
  } catch (e) {}
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

  if (AppState.audioAnalysers.has(id)) {
    const prev = AppState.audioAnalysers.get(id);
    try {
      if (prev.source) prev.source.disconnect();
      if (prev.analyser) prev.analyser.disconnect();
    } catch (e) {}
    AppState.audioAnalysers.delete(id);
  }

  try {
    const source = AppState.audioContext.createMediaStreamSource(stream);
    const analyser = AppState.audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);
    AppState.audioAnalysers.set(id, { source, analyser, stream });
  } catch (e) {}
}

function analyzeAudioFrame(now) {
  if (!AppState.isAudioAnalysisRunning) return;

  if (!now || now - lastAudioAnalysisTime >= 100) {
    lastAudioAnalysisTime = now || performance.now();

    if (!audioAnalysisBuffer) audioAnalysisBuffer = new Uint8Array(64);

    AppState.audioAnalysers.forEach((entry, id) => {
      try {
        audioAnalysisBuffer.fill(0);
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
    if (UI.btnMic) UI.btnMic.className = 'ctrl-btn active-state';
    if (UI.iconMicOn) UI.iconMicOn.style.display = 'block';
    if (UI.iconMicOff) UI.iconMicOff.style.display = 'none';
    if (UI.localMicMini) UI.localMicMini.classList.remove('muted');
    if (UI.localMicSlash) UI.localMicSlash.style.display = 'none';
    showToast('Microphone unmuted');
  } else {
    if (UI.btnMic) UI.btnMic.className = 'ctrl-btn inactive-state';
    if (UI.iconMicOn) UI.iconMicOn.style.display = 'none';
    if (UI.iconMicOff) UI.iconMicOff.style.display = 'block';
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

  try {
    if (!AppState.localStream) {
      await initLocalMediaStream();
      return;
    }

    let videoTracks = AppState.localStream.getVideoTracks();

    if (videoTracks.length === 0 || videoTracks[0].readyState === 'ended') {
      try {
        const constraints = getVideoConstraintsForPreset(AppState.videoQualityPreset || '1080p', AppState.facingMode || 'user');
        let newStream = null;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: constraints,
            audio: false
          });
        } catch (e1) {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: AppState.facingMode || 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          });
        }
        const newTrack = newStream.getVideoTracks()[0];
        if (newTrack) {
          await enhanceCameraTrackSettings(newTrack);
          AppState.localStream.addTrack(newTrack);
          if (UI.localVideo) {
            UI.localVideo.srcObject = AppState.localStream;
            UI.localVideo.play().catch(() => {});
          }
          
          AppState.peerCalls.forEach((call) => {
            try {
              const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
              if (sender) {
                sender.replaceTrack(newTrack).then(() => {
                  tunePeerSenders(call.peerConnection);
                }).catch(() => {});
              }
            } catch (e) {}
          });
          videoTracks = [newTrack];
          updateCameraStatsUI();
        }
      } catch (e) {}
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
      if (UI.waitingLocalPreview) {
        UI.waitingLocalPreview.style.display = 'block';
        UI.waitingLocalPreview.play().catch(() => {});
      }
      updateCameraStatsUI();
      showToast('Camera turned on (HD)');
    } else {
      if (UI.btnCam) UI.btnCam.className = 'ctrl-btn inactive-state';
      if (UI.iconCamOn) UI.iconCamOn.style.display = 'none';
      if (UI.iconCamOff) UI.iconCamOff.style.display = 'block';
      if (UI.localAvatar) UI.localAvatar.style.display = 'flex';
      if (UI.waitingLocalPreview) UI.waitingLocalPreview.style.display = 'none';
      showToast('Camera turned off');
    }

    broadcastProfileUpdate();
  } finally {
    setTimeout(() => { isTogglingCamera = false; }, 350);
  }
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
    const constraints = getVideoConstraintsForPreset(AppState.videoQualityPreset || '1080p', targetFacing);
    let newStream = null;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: constraints,
        audio: false
      });
    } catch (e1) {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    }
    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) throw new Error('No video track returned');

    await enhanceCameraTrackSettings(newVideoTrack);
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

    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
        if (sender) {
          sender.replaceTrack(newVideoTrack).then(() => {
            tunePeerSenders(call.peerConnection);
          }).catch(() => {});
        }
      } catch (e) {}
    });

    updateCameraStatsUI();
    showToast(`Switched to ${targetFacing === 'environment' ? 'rear' : 'front'} camera (HD)`);
  } catch (err) {
    showToast('Camera switch: ' + (err.name || 'Unavailable'));
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

      AppState.peerCalls.forEach((call) => {
        try {
          const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
          if (sender) sender.replaceTrack(screenVideoTrack).catch(() => {});
        } catch (e) {}
      });

      if (UI.localVideo) {
        UI.localVideo.classList.add('no-mirror');
        UI.localVideo.srcObject = displayStream;
      }
      if (UI.localAvatar) UI.localAvatar.style.display = 'none';

      screenVideoTrack.onended = () => {
        stopScreenSharing();
      };

      showToast('Screen sharing started');
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        showAlert('Screen share note: ' + (err.message || err.name), true);
      }
    }
  } else {
    stopScreenSharing();
  }
}

function stopScreenSharing() {
  if (!AppState.isSharingScreen) return;
  AppState.isSharingScreen = false;
  if (UI.btnScreen) UI.btnScreen.className = 'ctrl-btn';

  if (AppState.displayStream) {
    AppState.displayStream.getTracks().forEach(t => t.stop());
    AppState.displayStream = null;
  }

  if (AppState.facingMode === 'user' && UI.localVideo) {
    UI.localVideo.classList.remove('no-mirror');
  }
  if (UI.localVideo) UI.localVideo.srcObject = AppState.localStream;
  if (UI.localAvatar) UI.localAvatar.style.display = AppState.isCameraMuted ? 'flex' : 'none';

  const cameraTrack = AppState.localStream?.getVideoTracks()[0];
  if (cameraTrack) {
    AppState.peerCalls.forEach((call) => {
      try {
        const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
        if (sender) sender.replaceTrack(cameraTrack).catch(() => {});
      } catch (e) {}
    });
  }

  showToast('Screen sharing stopped');
}

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
    if (UI.tabBtnChat) UI.tabBtnChat.classList.add('active');
    if (UI.tabBtnPeople) UI.tabBtnPeople.classList.remove('active');
    if (UI.sidebarPaneChat) UI.sidebarPaneChat.style.display = 'flex';
    if (UI.sidebarPanePeople) UI.sidebarPanePeople.style.display = 'none';
    AppState.unreadChatCount = 0;
    if (UI.sidebarTabUnread) UI.sidebarTabUnread.style.display = 'none';
    if (UI.chatUnreadBadge) UI.chatUnreadBadge.style.display = 'none';
    if (UI.stageUnreadDot) UI.stageUnreadDot.style.display = 'none';
    if (UI.chatInput) setTimeout(() => UI.chatInput.focus(), 150);
  } else {
    if (UI.tabBtnPeople) UI.tabBtnPeople.classList.add('active');
    if (UI.tabBtnChat) UI.tabBtnChat.classList.remove('active');
    if (UI.sidebarPaneChat) UI.sidebarPaneChat.style.display = 'none';
    if (UI.sidebarPanePeople) UI.sidebarPanePeople.style.display = 'flex';
    renderSidebarParticipantsList();
  }
}

function handleSendChatMessage(event) {
  if (event) event.preventDefault();
  if (!UI.chatInput) return;
  const text = UI.chatInput.value.trim().slice(0, 300);
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
  msgDiv.innerHTML = `<span>${escapeHtml(text)}</span>`;
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
  const msg = encodeURIComponent(`Join my private video call on GhostCall!\n\nRoom Code: ${AppState.currentRoomId}\nLink: ${link}`);
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

  broadcastMeshMessage({
    type: 'PEER_LEFT',
    peerId: AppState.myPeerId,
    name: AppState.myDisplayName || 'Friend'
  });

  stopCallTimer();
  stopAudioAnalysis();

  if (AppState._guestJoinTimeout) {
    clearTimeout(AppState._guestJoinTimeout);
    AppState._guestJoinTimeout = null;
  }

  AppState.isSwappedVideo = false;
  AppState.swappedPeerId = null;
  if (UI.localVideoBox) UI.localVideoBox.classList.remove('is-swapped');

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

  const cards = UI.videoGrid.querySelectorAll('.video-card');
  cards.forEach(c => c.remove());

  closeLeaveModal();
  closeShareModal();
  closeRoomNotFoundModal();
  closeVideoQualityModal();

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
  if (UI.headerQualityPill) UI.headerQualityPill.style.display = 'none';
  if (UI.participantsPill) UI.participantsPill.style.display = 'none';
  if (UI.btnHeaderShare) UI.btnHeaderShare.style.display = 'none';
  if (UI.headerCallTimer) UI.headerCallTimer.style.display = 'none';
}

function showCallView() {
  UI.body.classList.add('in-call-mode');
  UI.heroView.style.display = 'none';
  UI.callView.style.display = 'flex';
  if (UI.roomInfoPill) UI.roomInfoPill.style.display = 'inline-flex';
  if (UI.headerQualityPill) UI.headerQualityPill.style.display = 'inline-flex';
  if (UI.participantsPill) UI.participantsPill.style.display = 'inline-flex';
  if (UI.btnHeaderShare) UI.btnHeaderShare.style.display = 'inline-flex';
  if (UI.headerCallTimer) UI.headerCallTimer.style.display = 'inline-flex';

  applyInitialVideoEnhancement();
  updateCameraStatsUI();
  toggleSidebar(false);
}

function applyInitialVideoEnhancement() {
  const mode = AppState.videoEnhancementMode || 'clean';
  const stage = UI.callStage || document.getElementById('call-stage');
  if (stage) {
    stage.classList.remove(
      'video-enhanced-clean',
      'video-enhanced-crisp',
      'video-enhanced-studio',
      'video-enhanced-warm',
      'video-enhanced-none'
    );
    stage.classList.add(`video-enhanced-${mode}`);
  }

  const chips = document.querySelectorAll('.enhancement-chips .chip-item');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-filter') === mode);
  });
}

function setVideoEnhancement(mode) {
  AppState.videoEnhancementMode = mode;
  localStorage.setItem('ghostcall_video_enhancement', mode);

  const stage = UI.callStage || document.getElementById('call-stage');
  if (stage) {
    stage.classList.remove(
      'video-enhanced-clean',
      'video-enhanced-crisp',
      'video-enhanced-studio',
      'video-enhanced-warm',
      'video-enhanced-none'
    );
    stage.classList.add(`video-enhanced-${mode}`);
  }

  const chips = document.querySelectorAll('.enhancement-chips .chip-item');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-filter') === mode);
  });

  const modeLabels = {
    clean: 'Clean & Clear (Haze Removed)',
    crisp: 'Ultra Crisp (High Detail)',
    studio: 'Studio Bright (Optimized Lighting)',
    warm: 'Warm Natural',
    none: 'Original Raw Feed'
  };

  showToast(`Video style: ${modeLabels[mode] || mode}`);
  updateCameraStatsUI();
}

async function changeResolutionPreset(preset) {
  AppState.videoQualityPreset = preset;
  localStorage.setItem('ghostcall_video_resolution', preset);

  if (AppState.isCallActive && AppState.localStream && !AppState.isCameraMuted && !AppState.isSharingScreen) {
    showToast(`Applying ${preset.toUpperCase()} video quality...`);
    try {
      const constraints = getVideoConstraintsForPreset(preset, AppState.facingMode || 'user');
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: constraints,
        audio: false
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        await enhanceCameraTrackSettings(newVideoTrack);

        const oldTracks = AppState.localStream.getVideoTracks();
        oldTracks.forEach(t => {
          try { AppState.localStream.removeTrack(t); t.stop(); } catch (e) {}
        });
        AppState.localStream.addTrack(newVideoTrack);

        if (UI.localVideo) {
          UI.localVideo.srcObject = AppState.localStream;
          UI.localVideo.play().catch(() => {});
        }

        AppState.peerCalls.forEach((call) => {
          try {
            const sender = call.peerConnection?.getSenders()?.find(s => (s.track && s.track.kind === 'video') || s.track === null);
            if (sender) {
              sender.replaceTrack(newVideoTrack).then(() => {
                tunePeerSenders(call.peerConnection);
              }).catch(() => {});
            }
          } catch (e) {}
        });

        updateCameraStatsUI();
        showToast(`Camera switched to ${preset.toUpperCase()} quality`);
      }
    } catch (err) {
      showToast('Resolution change note: ' + (err.message || 'Standard resolution active'));
    }
  } else {
    showToast(`Quality preset: ${preset.toUpperCase()}`);
    updateCameraStatsUI();
  }
}

function updateCameraStatsUI() {
  if (!AppState.localStream) return;
  const videoTrack = AppState.localStream.getVideoTracks()[0];
  if (!videoTrack) return;

  const settings = (typeof videoTrack.getSettings === 'function') ? videoTrack.getSettings() : {};
  const width = settings.width || (UI.localVideo ? UI.localVideo.videoWidth : 0) || 1920;
  const height = settings.height || (UI.localVideo ? UI.localVideo.videoHeight : 0) || 1080;
  const fps = Math.round(settings.frameRate || 30);
  const label = videoTrack.label || 'Webcam / HD Camera';

  let pillText = '1080p Clean';
  if (height >= 1080 || width >= 1920) {
    pillText = '1080p Clean';
  } else if (height >= 720 || width >= 1280) {
    pillText = '720p HD';
  } else {
    pillText = `${height}p Clean`;
  }

  const pillLabel = UI.qualityPillLabel || document.getElementById('quality-pill-label');
  if (pillLabel) pillLabel.textContent = pillText;

  const camDevice = document.getElementById('cam-device-name');
  if (camDevice) camDevice.textContent = label.length > 28 ? label.slice(0, 26) + '...' : label;

  const camLiveRes = document.getElementById('cam-live-res');
  if (camLiveRes) camLiveRes.textContent = `${width} × ${height} (${height}p @ ${fps}fps)`;

  const camLiveBitrate = document.getElementById('cam-live-bitrate');
  if (camLiveBitrate) {
    const total = AppState.peerCalls ? AppState.peerCalls.size + 1 : 1;
    const bitrateText = total >= 4 ? '1.6 Mbps (Group HD)' : (total === 3 ? '2.8 Mbps (Multi HD)' : '4.0 Mbps (Ultra-Clear)');
    camLiveBitrate.textContent = bitrateText;
  }
}

function openVideoQualityModal() {
  if (!UI.modalVideoQuality) UI.modalVideoQuality = document.getElementById('modal-video-quality');
  if (UI.modalVideoQuality) {
    updateCameraStatsUI();

    const currentMode = AppState.videoEnhancementMode || 'clean';
    const chips = document.querySelectorAll('.enhancement-chips .chip-item');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-filter') === currentMode);
    });

    const currentPreset = AppState.videoQualityPreset || '1080p';
    const radio = document.querySelector(`input[name="res-preset"][value="${currentPreset}"]`);
    if (radio) radio.checked = true;

    UI.modalVideoQuality.style.display = 'flex';
  }
}

function closeVideoQualityModal() {
  if (!UI.modalVideoQuality) UI.modalVideoQuality = document.getElementById('modal-video-quality');
  if (UI.modalVideoQuality) {
    UI.modalVideoQuality.style.display = 'none';
  }
}

function handleBrandClick() {
  if (AppState.isCallActive) confirmLeaveCall();
  else showHeroView();
}

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

function toggleSwapLocalAndRemoteVideo() {
  const remoteCards = Array.from(UI.videoGrid.querySelectorAll('.video-card'));

  if (remoteCards.length === 0) {
    flipCamera();
    return;
  }

  const targetCard = (AppState.swappedPeerId ? document.getElementById(`card-${AppState.swappedPeerId}`) : null) || remoteCards[0];
  if (!targetCard) {
    AppState.isSwappedVideo = false;
    AppState.swappedPeerId = null;
    return;
  }

  const remoteVideo = targetCard.querySelector('video');
  if (!remoteVideo) return;

  if (!AppState.isSwappedVideo) {
    targetCard._remoteStream = remoteVideo.srcObject || targetCard._originalStream;
    remoteVideo.srcObject = AppState.localStream;
    remoteVideo.classList.add('local-preview-swapped');

    if (UI.localVideo) {
      UI.localVideo.srcObject = targetCard._remoteStream;
      UI.localVideo.classList.add('no-mirror');
    }

    AppState.isSwappedVideo = true;
    AppState.swappedPeerId = targetCard.id.replace('card-', '');
    if (UI.localVideoBox) UI.localVideoBox.classList.add('is-swapped');
    showToast('Swapped camera view');
  } else {
    if (targetCard._remoteStream) {
      remoteVideo.srcObject = targetCard._remoteStream;
      remoteVideo.classList.remove('local-preview-swapped');
    }

    if (UI.localVideo) {
      UI.localVideo.srcObject = AppState.localStream;
      if (AppState.facingMode === 'user') {
        UI.localVideo.classList.remove('no-mirror');
      }
    }

    AppState.isSwappedVideo = false;
    AppState.swappedPeerId = null;
    if (UI.localVideoBox) UI.localVideoBox.classList.remove('is-swapped');
    showToast('Restored original view');
  }
}

function restoreVideoSwap() {
  if (!AppState.isSwappedVideo) return;
  const card = AppState.swappedPeerId ? document.getElementById(`card-${AppState.swappedPeerId}`) : UI.videoGrid.querySelector('.video-card');
  if (card && card._remoteStream) {
    const video = card.querySelector('video');
    if (video) {
      video.srcObject = card._remoteStream;
      video.classList.remove('local-preview-swapped');
    }
  }
  if (UI.localVideo) {
    UI.localVideo.srcObject = AppState.localStream;
    if (AppState.facingMode === 'user') {
      UI.localVideo.classList.remove('no-mirror');
    }
  }
  AppState.isSwappedVideo = false;
  AppState.swappedPeerId = null;
  if (UI.localVideoBox) {
    UI.localVideoBox.classList.remove('is-swapped');
  }
}

function snapPipToNearestCorner(pip) {
  if (!pip) return;
  const stage = document.getElementById('call-stage') || document.body;
  const stageRect = stage.getBoundingClientRect();
  const pipRect = pip.getBoundingClientRect();

  const pipCenterX = pipRect.left + pipRect.width / 2;
  const pipCenterY = pipRect.top + pipRect.height / 2;
  const stageCenterX = stageRect.left + stageRect.width / 2;
  const stageCenterY = stageRect.top + stageRect.height / 2;

  const isLeft = pipCenterX < stageCenterX;
  const isTop = pipCenterY < stageCenterY;

  const isMobile = window.innerWidth <= 768;
  const sideMargin = isMobile ? '12px' : '18px';
  const topMargin = '60px';
  const bottomMargin = isMobile ? '78px' : '84px';

  pip.style.transition = 'all 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)';

  if (isLeft) {
    pip.style.left = sideMargin;
    pip.style.right = 'auto';
  } else {
    pip.style.right = sideMargin;
    pip.style.left = 'auto';
  }

  if (isTop) {
    pip.style.top = topMargin;
    pip.style.bottom = 'auto';
  } else {
    pip.style.bottom = bottomMargin;
    pip.style.top = 'auto';
  }

  setTimeout(() => {
    if (pip) pip.style.transition = '';
  }, 320);
}

function initDragPip() {
  const pip = UI.localVideoBox;
  if (!pip) return;

  let isPointerActive = false;
  let startX = 0, startY = 0;
  let pipStartLeft = 0, pipStartTop = 0;
  let hasMoved = false;

  const onPointerDown = (e) => {
    if (e.target.closest('#btn-camera-flip')) return;
    isPointerActive = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = pip.getBoundingClientRect();
    pipStartLeft = rect.left;
    pipStartTop = rect.top;
    try { pip.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const onPointerMove = (e) => {
    if (!isPointerActive) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 5) {
      hasMoved = true;
      pip.style.transition = 'none';

      const stage = document.getElementById('call-stage') || document.body;
      const stageRect = stage.getBoundingClientRect();
      const pipWidth = pip.offsetWidth || 115;
      const pipHeight = pip.offsetHeight || 160;

      const minLeft = stageRect.left + 8;
      const maxLeft = stageRect.right - pipWidth - 8;
      const minTop = stageRect.top + 8;
      const maxTop = stageRect.bottom - pipHeight - 8;

      const targetLeft = pipStartLeft + dx;
      const targetTop = pipStartTop + dy;

      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, targetLeft));
      const clampedTop = Math.max(minTop, Math.min(maxTop, targetTop));

      pip.style.left = `${clampedLeft}px`;
      pip.style.top = `${clampedTop}px`;
      pip.style.right = 'auto';
      pip.style.bottom = 'auto';
    }
  };

  const onPointerUp = (e) => {
    if (!isPointerActive) return;
    isPointerActive = false;
    try { pip.releasePointerCapture(e.pointerId); } catch (err) {}

    if (!hasMoved) {
      toggleSwapLocalAndRemoteVideo();
    } else {
      snapPipToNearestCorner(pip);
    }
  };

  pip.addEventListener('pointerdown', onPointerDown);
  pip.addEventListener('pointermove', onPointerMove);
  pip.addEventListener('pointerup', onPointerUp);
  pip.addEventListener('pointercancel', onPointerUp);

  pip.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    pip.classList.toggle('is-expanded');
  });
}

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
      closeVideoQualityModal();
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
    } else if (key === 'q') {
      e.preventDefault();
      if (UI.modalVideoQuality && UI.modalVideoQuality.style.display === 'flex') {
        closeVideoQualityModal();
      } else {
        openVideoQualityModal();
      }
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
    if (UI.iconFsEnter && UI.iconFsExit) {
      UI.iconFsEnter.style.display = isFs ? 'none' : 'block';
      UI.iconFsExit.style.display = isFs ? 'block' : 'none';
    }
  };

  document.addEventListener('fullscreenchange', updateFsUI);
  document.addEventListener('webkitfullscreenchange', updateFsUI);
}

function unlockAudio() {
  const videos = document.querySelectorAll('#video-grid video');
  videos.forEach((v) => {
    if (v.id !== 'waiting-local-preview' && v.id !== 'local-video' && v.muted) {
      v.muted = false;
      v.play().catch(() => {});
    }
  });

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    if (!AppState.audioContext) {
      try { AppState.audioContext = new AudioContextClass(); } catch (e) {}
    }
    if (AppState.audioContext && AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume().catch(() => {});
    }
  }
}

function initMobileAudioUnlock() {
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
  window.addEventListener('click', unlockAudio, { passive: true, once: true });
}
