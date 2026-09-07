import { describe, it, expect, beforeEach } from 'vitest';
import { useReplayStore } from '../store/replayStore';

describe('useReplayStore', () => {
  beforeEach(() => {
    useReplayStore.setState({
      mode: 'live',
      playing: false,
      speed: 20,
      cursor: 0,
      eventDate: '2024-02-22',
      dates: [],
    });
  });

  it('defaults to live mode, paused', () => {
    expect(useReplayStore.getState().mode).toBe('live');
    expect(useReplayStore.getState().playing).toBe(false);
  });

  it('setPlaying updates playing state', () => {
    useReplayStore.getState().setPlaying(true);
    expect(useReplayStore.getState().playing).toBe(true);
  });

  it('togglePlay flips playing state', () => {
    useReplayStore.getState().togglePlay();
    expect(useReplayStore.getState().playing).toBe(true);
    useReplayStore.getState().togglePlay();
    expect(useReplayStore.getState().playing).toBe(false);
  });

  it('setSpeed updates speed state', () => {
    useReplayStore.getState().setSpeed(50);
    expect(useReplayStore.getState().speed).toBe(50);
  });

  it('setCursor clamps to valid range', () => {
    useReplayStore.getState().setCursor(-10);
    expect(useReplayStore.getState().cursor).toBe(0);
    useReplayStore.getState().setCursor(9999);
    expect(useReplayStore.getState().cursor).toBe(1439);
    useReplayStore.getState().setCursor(500);
    expect(useReplayStore.getState().cursor).toBe(500);
  });

  it('stepCursor clamps within bounds', () => {
    useReplayStore.getState().setCursor(0);
    useReplayStore.getState().stepCursor(-1);
    expect(useReplayStore.getState().cursor).toBe(0);
    useReplayStore.getState().stepCursor(100);
    expect(useReplayStore.getState().cursor).toBe(100);
  });

  it('setEventDate updates event date', () => {
    useReplayStore.getState().setEventDate('2024-05-10');
    expect(useReplayStore.getState().eventDate).toBe('2024-05-10');
  });

  it('setDates updates available dates', () => {
    const dates = ['2024-02-22', '2024-05-10'];
    useReplayStore.getState().setDates(dates);
    expect(useReplayStore.getState().dates).toEqual(dates);
  });
});
