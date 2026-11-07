"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioCaptureOptions = {
  /** Mix tab/system audio via getDisplayMedia when available (Chrome). */
  includeSystemAudio?: boolean;
  /** Called for every ~256ms PCM frame (16 kHz mono Int16). */
  onPcmChunk?: (chunk: Int16Array) => void;
  /** Called when a buffered window is ready to send to the server (~1.8s). */
  onPcmWindow?: (pcm: Int16Array) => void;
  /** Window size in milliseconds before flushing to onPcmWindow. */
  windowMs?: number;
  onLevel?: (level: number) => void;
};

/**
 * Web Audio API mic capture → 16 kHz mono PCM streaming chunks.
 * Designed for server-side Deepgram (linear16) via buffered windows.
 */
export function useAudioCapture(options: AudioCaptureOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Int16Array[]>([]);
  const bufferedSamplesRef = useRef(0);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const flushWindow = useCallback(() => {
    if (!bufferRef.current.length) return;
    const total = bufferedSamplesRef.current;
    const merged = new Int16Array(total);
    let offset = 0;
    for (const part of bufferRef.current) {
      merged.set(part, offset);
      offset += part.length;
    }
    bufferRef.current = [];
    bufferedSamplesRef.current = 0;
    optionsRef.current.onPcmWindow?.(merged);
  }, []);

  const stopCapture = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    flushWindow();

    processorRef.current?.disconnect();
    processorRef.current = null;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    systemStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    systemStreamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;

    setIsRecording(false);
    setLevel(0);
    setHasSystemAudio(false);
  }, [flushWindow]);

  const startCapture = useCallback(async () => {
    setError(null);
    stopCapture();
    bufferRef.current = [];
    bufferedSamplesRef.current = 0;

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
        video: false,
      });
      micStreamRef.current = micStream;

      let systemStream: MediaStream | null = null;
      if (optionsRef.current.includeSystemAudio) {
        try {
          const display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          display.getVideoTracks().forEach((track) => track.stop());
          if (display.getAudioTracks().length > 0) {
            systemStream = display;
            systemStreamRef.current = display;
            setHasSystemAudio(true);
          } else {
            display.getTracks().forEach((t) => t.stop());
          }
        } catch {
          /* mic-only fallback */
        }
      }

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const mixer = ctx.createGain();
      mixer.gain.value = 1;

      ctx.createMediaStreamSource(micStream).connect(mixer);

      if (systemStream?.getAudioTracks().length) {
        const systemGain = ctx.createGain();
        systemGain.gain.value = 0.9;
        ctx.createMediaStreamSource(systemStream).connect(systemGain);
        systemGain.connect(mixer);
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      mixer.connect(analyser);

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      mixer.connect(processor);

      const mute = ctx.createGain();
      mute.gain.value = 0;
      processor.connect(mute);
      mute.connect(ctx.destination);

      const windowMs = optionsRef.current.windowMs ?? 1800;
      const windowSamples = Math.floor((16000 * windowMs) / 1000);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcm = downsampleTo16k(input, ctx.sampleRate);
        optionsRef.current.onPcmChunk?.(pcm);

        bufferRef.current.push(pcm);
        bufferedSamplesRef.current += pcm.length;
        if (bufferedSamplesRef.current >= windowSamples) {
          flushWindow();
        }
      };

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg =
          data.reduce((sum, value) => sum + value, 0) / Math.max(data.length, 1);
        const nextLevel = Math.min(1, avg / 140);
        setLevel(nextLevel);
        optionsRef.current.onLevel?.(nextLevel);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      setIsRecording(true);
    } catch (err) {
      stopCapture();
      setError(
        err instanceof Error
          ? err.message
          : "Microphone permission was denied or unavailable.",
      );
    }
  }, [flushWindow, stopCapture]);

  useEffect(() => () => stopCapture(), [stopCapture]);

  return {
    isRecording,
    active: isRecording,
    error,
    level,
    hasSystemAudio,
    startCapture,
    stopCapture,
    start: startCapture,
    stop: stopCapture,
  };
}

export function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function downsampleTo16k(input: Float32Array, sampleRate: number): Int16Array {
  if (sampleRate === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  const ratio = sampleRate / 16000;
  const newLength = Math.floor(input.length / ratio);
  const result = new Int16Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const sample = input[Math.floor(i * ratio)] || 0;
    const s = Math.max(-1, Math.min(1, sample));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return result;
}
