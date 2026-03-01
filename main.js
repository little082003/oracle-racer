// Configuration
const MQTT_BROKER = 'wss://dustboy-wss-bridge.laris.workers.dev/mqtt';
const TOPIC_PREFIX = 'oracle-racer/state/';
const HOF_TOPIC = 'oracle-racer/hall-of-fame';
const MAX_DISTANCE = 100;
const STALE_TIMEOUT = 5000;

// State Variables
let mqttClient = null;
let localPlayer = {
    id: generateId(),
    name: '',
    distance: 0,
    startTime: null,
    endTime: null,
    finished: false
};
const remotePlayers = {}; // { id: { name, distance, lastUpdate } }
let hallOfFame = []; // Array of { name, timeMs }

// DOM Elements
const joinScreen = document.getElementById('join-screen');
const raceScreen = document.getElementById('race-screen');
const btnJoin = document.getElementById('btn-join');
const inputName = document.getElementById('player-name');
const statusDot = document.getElementById('mqtt-status-dot');
const statusText = document.getElementById('mqtt-status-text');
const trackList = document.getElementById('track-list');
const localTimeEl = document.getElementById('local-time');
const leaderboardBody = document.getElementById('leaderboard-body');

// Helper: Generate Random ID
function generateId() {
    return Math.random().toString(16).substring(2, 8);
}

// Helper: Format Time MS to mm:ss.ms
function formatTime(ms) {
    const date = new Date(ms);
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    const s = date.getUTCSeconds().toString().padStart(2, '0');
    const milli = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${m}:${s}.${milli}`;
}

// 1. Initialization
btnJoin.addEventListener('click', joinGame);
inputName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});

function joinGame() {
    const name = inputName.value.trim();
    if (!name) return alert('Please enter an Oracle Name!');

    localPlayer.name = name;
    document.getElementById('hud-name').textContent = name;

    joinScreen.classList.remove('active');
    raceScreen.classList.remove('hidden');
    raceScreen.classList.add('active');

    connectMQTT();
    setupControls();
    requestAnimationFrame(loop);
}

// 2. MQTT Logic
function connectMQTT() {
    statusText.textContent = 'Connecting...';

    // Connect to public broker
    mqttClient = mqtt.connect(MQTT_BROKER);

    mqttClient.on('connect', () => {
        statusDot.className = 'dot on';
        statusText.textContent = 'Connected';

        // Subscribe to all players' state and the global hall of fame
        mqttClient.subscribe(TOPIC_PREFIX + '#');
        mqttClient.subscribe(HOF_TOPIC);

        // Announce existence
        publishState();
    });

    mqttClient.on('offline', () => {
        statusDot.className = 'dot off';
        statusText.textContent = 'Disconnected';
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());

            // Hall of fame updates (Persistent/Retained message)
            if (topic === HOF_TOPIC) {
                if (Array.isArray(data)) {
                    hallOfFame = data;
                    renderLeaderboard();
                }
                return;
            }

            // Live player state updates
            if (topic.startsWith(TOPIC_PREFIX)) {
                const playerId = topic.replace(TOPIC_PREFIX, '');
                if (playerId === localPlayer.id) return; // Ignore own echoes

                remotePlayers[playerId] = {
                    name: data.name,
                    distance: data.distance,
                    finished: data.finished,
                    lastUpdate: Date.now()
                };
            }
        } catch (err) {
            console.warn('MQTT Parse Error:', err);
        }
    });
}

function publishState() {
    if (!mqttClient || !mqttClient.connected) return;
    const payload = JSON.stringify({
        name: localPlayer.name,
        distance: localPlayer.distance,
        finished: localPlayer.finished
    });
    mqttClient.publish(TOPIC_PREFIX + localPlayer.id, payload, { qos: 0 });
}

// 3. Hall of Fame Retain Logic
function checkAndPublishScore() {
    const timeMs = localPlayer.endTime - localPlayer.startTime;

    // Add new score to the array
    hallOfFame.push({ name: localPlayer.name, timeMs });

    // Sort ascending by time (fastest first)
    hallOfFame.sort((a, b) => a.timeMs - b.timeMs);

    // Keep only top 10
    if (hallOfFame.length > 10) {
        hallOfFame = hallOfFame.slice(0, 10);
    }

    // Publish with RETAIN: true flag.
    // This tells the MQTT broker to keep this message in memory and immediately 
    // send it to anyone who subscribes to 'oracle-racer/hall-of-fame' in the future.
    if (mqttClient && mqttClient.connected) {
        mqttClient.publish(HOF_TOPIC, JSON.stringify(hallOfFame), { qos: 1, retain: true });
    }

    renderLeaderboard();
}

// 4. Local Core Gameplay (Mashing)
function setupControls() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            handleMash();
        }
    });
}

function handleMash() {
    if (localPlayer.finished) return;

    // Start timer on first tap
    if (!localPlayer.startTime) {
        localPlayer.startTime = Date.now();
    }

    // Increase distance
    localPlayer.distance += 1;

    // Check win condition
    if (localPlayer.distance >= MAX_DISTANCE) {
        localPlayer.distance = MAX_DISTANCE;
        localPlayer.finished = true;
        localPlayer.endTime = Date.now();
        checkAndPublishScore();
    }

    publishState();
}

// 5. Render Loop
function loop() {
    // Update local timer UI
    let displayTime = 0;
    if (localPlayer.startTime && !localPlayer.finished) {
        displayTime = Date.now() - localPlayer.startTime;
    } else if (localPlayer.finished) {
        displayTime = localPlayer.endTime - localPlayer.startTime;
    }
    localTimeEl.textContent = formatTime(displayTime);

    renderTracks();
    requestAnimationFrame(loop);
}

function renderTracks() {
    const now = Date.now();
    let trackHTML = '';

    // Render Local Player
    trackHTML += `
    <div class="track-row local-player ${localPlayer.finished ? 'finished' : ''}">
      <div class="finish-line"></div>
      <div class="track-info">
        <span>${localPlayer.name} (You)</span>
        <span>${localPlayer.distance}%</span>
      </div>
      <div class="track-progress-bg">
        <div class="track-progress-fill" style="width: ${localPlayer.distance}%"></div>
      </div>
    </div>
  `;

    // Render Remote Players (cleanup stale ones too)
    for (const [id, p] of Object.entries(remotePlayers)) {
        if (now - p.lastUpdate > STALE_TIMEOUT && !p.finished) {
            delete remotePlayers[id];
            continue;
        }

        trackHTML += `
      <div class="track-row ${p.finished ? 'finished' : ''}">
        <div class="finish-line"></div>
        <div class="track-info">
          <span style="color: var(--text-secondary)">${p.name}</span>
          <span style="color: var(--text-secondary)">${p.distance}%</span>
        </div>
        <div class="track-progress-bg">
          <div class="track-progress-fill" style="width: ${p.distance}%"></div>
        </div>
      </div>
    `;
    }

    trackList.innerHTML = trackHTML;
}

function renderLeaderboard() {
    if (hallOfFame.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="3" class="loading-td">No records yet. Be the first!</td></tr>`;
        return;
    }

    let rows = '';
    hallOfFame.forEach((entry, idx) => {
        const rankClass = idx < 3 ? `rank-${idx + 1}` : '';
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        rows += `
      <tr>
        <td class="${rankClass}">${medal}</td>
        <td>${entry.name}</td>
        <td class="time-col">${formatTime(entry.timeMs)}</td>
      </tr>
    `;
    });

    leaderboardBody.innerHTML = rows;
}
