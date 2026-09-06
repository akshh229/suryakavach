import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import NowcastBanner from './components/NowcastBanner';
import TelemetryChart from './components/TelemetryChart';
import ForecastCards from './components/ForecastCards';
import ImpactGauge from './components/ImpactGauge';
import FlareCatalogue from './components/FlareCatalogue';
import ReplayBar from './components/ReplayBar';
import MetricsPanel from './components/MetricsPanel';

export default function App() {
  const [streamData, setStreamData] = useState(null);
  const [nowcastState, setNowcastState] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [clock, setClock] = useState(null);

  // Replay State
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(20);
  const [cursorIdx, setCursorIdx] = useState(1260); // Default around 21:00 for X6.3 event
  const [eventDate, setEventDate] = useState('2024-02-22');
  const [availableDates, setAvailableDates] = useState(['2024-02-22']);
  const [windowSize, setWindowSize] = useState(120);

  const wsRef = useRef(null);

  useEffect(() => {
    // Initial fetch of initial streams and dates
    fetchInitialData();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [streamsRes, stateRes, datesRes, fcRes, impRes] = await Promise.all([
        fetch(`/api/streams/latest?window=${windowSize}`).then((r) => r.json()),
        fetch('/api/nowcast/state').then((r) => r.json()),
        fetch('/api/replay/dates').then((r) => r.json()),
        fetch('/api/forecast/horizons').then((r) => r.json()),
        fetch('/api/impact/current').then((r) => r.json()),
      ]);

      if (streamsRes?.data) setStreamData(streamsRes.data);
      if (stateRes?.data) setNowcastState(stateRes.data);
      if (datesRes?.data?.dates) setAvailableDates(datesRes.data.dates);
      if (fcRes?.data) setForecastData(fcRes.data);
      if (impRes?.data) setImpactData(impRes.data);
    } catch (err) {
      console.error('Failed to fetch initial telemetry data:', err);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Telemetry WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.heartbeat) return;

        if (payload.latest_points) setStreamData(payload.latest_points);
        if (payload.nowcast_state) setNowcastState(payload.nowcast_state);
        if (payload.forecast) setForecastData(payload.forecast);
        if (payload.impact) setImpactData(payload.impact);
        if (payload.clock) setClock(payload.clock);
        if (payload.cursor_idx !== undefined) setCursorIdx(payload.cursor_idx);
        if (payload.playing !== undefined) setPlaying(payload.playing);
        if (payload.speed !== undefined) setSpeed(payload.speed);
        if (payload.event_date) setEventDate(payload.event_date);
        if (payload.dates) setAvailableDates(payload.dates);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onerror = (err) => {
      console.warn('WS Error, falling back to polling:', err);
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  };

  // Replay control handlers
  const handlePlayToggle = async () => {
    const nextState = !playing;
    setPlaying(nextState);
    const endpoint = nextState ? '/api/replay/resume' : '/api/replay/pause';
    await fetch(endpoint, { method: 'POST' });
  };

  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed);
    await fetch('/api/replay/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date: eventDate, speed: newSpeed }),
    });
  };

  const handleCursorChange = async (newIdx) => {
    setCursorIdx(newIdx);
    await fetch('/api/replay/cursor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idx: newIdx }),
    });
    // Immediately update stream window
    fetchInitialData();
  };

  const handleDateChange = async (newDate) => {
    setEventDate(newDate);
    await fetch('/api/replay/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date: newDate, speed }),
    });
    fetchInitialData();
  };

  const handleWindowChange = (newWindow) => {
    setWindowSize(newWindow);
    fetch(`/api/streams/latest?window=${newWindow}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) setStreamData(res.data);
      });
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <Header healthData={{}} clock={clock} />

      {/* Main Content Dashboard Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Active Flare State Banner */}
        <NowcastBanner
          nowcastState={nowcastState}
          activeFlare={nowcastState?.active}
          impactCurrent={impactData}
        />

        {/* Telemetry Chart Stream */}
        <TelemetryChart
          streamData={streamData}
          windowSize={windowSize}
          onWindowChange={handleWindowChange}
        />

        {/* Forecast & Impact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ForecastCards forecastData={forecastData} />
          <ImpactGauge impactData={impactData} />
        </div>

        {/* Metrics Panel */}
        <MetricsPanel />

        {/* Historical Flare Log Catalogue */}
        <FlareCatalogue />
      </main>

      {/* Sticky Replay Control Scrubber */}
      <ReplayBar
        playing={playing}
        speed={speed}
        cursorIdx={cursorIdx}
        eventDate={eventDate}
        availableDates={availableDates}
        onPlayToggle={handlePlayToggle}
        onSpeedChange={handleSpeedChange}
        onCursorChange={handleCursorChange}
        onDateChange={handleDateChange}
      />
    </div>
  );
}
