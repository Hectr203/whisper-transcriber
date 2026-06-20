import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, Play, Pause, Lock } from 'lucide-react';

export default function AudioRecorder({ onRecordComplete, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    return () => {
      stopTimer();
      stopMediaTracks();
      cleanUpAudioAnalysis();
    };
  }, []);

  useEffect(() => {
    if (isRecording && canvasRef.current && analyserRef.current) {
      drawWaveform();
    }
  }, [isRecording]);

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const cleanUpAudioAnalysis = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    if (rect.width === 0) {
      animationRef.current = requestAnimationFrame(drawWaveform);
      return;
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      
      const barWidth = (width / bufferLength) * 2.5; 
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const rawHeight = (dataArray[i] / 255) * height;
        const barHeight = Math.max(rawHeight, 4); 
        
        ctx.fillStyle = '#2563EB'; // Primary color
        
        const y = (height - barHeight) / 2;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 4);
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
        ctx.fill();
        
        x += barWidth + 3;
      }
    };
    
    draw();
  };

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128; 
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `grabacion_${new Date().getTime()}.webm`, {
          type: 'audio/webm',
          lastModified: Date.now(),
        });
        onRecordComplete(audioFile);
        stopMediaTracks();
        cleanUpAudioAnalysis();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err) {
      console.error('Error al acceder al micrófono:', err);
      setError('No se pudo acceder al micrófono o falló la inicialización.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Sound wave mock icon for idle state
  const SoundWaveMock = () => (
    <div className="flex items-center justify-center gap-1.5 h-[60px] mb-6">
      {[12, 24, 40, 24, 50, 60, 40, 30, 16].map((h, i) => (
        <div key={i} className="w-[4px] rounded-full bg-primary-600 dark:bg-primary-500 opacity-80" style={{ height: `${h}px` }}></div>
      ))}
    </div>
  );

  return (
    <div className={`w-full h-full flex flex-col min-h-[340px] bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm hover:shadow-md transition-shadow ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {!isRecording ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <SoundWaveMock />
          
          <h3 className="text-xl font-bold mb-3 text-secondary-900 dark:text-white">
            Grabación Directa
          </h3>

          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-xs leading-relaxed">
            Usa tu micrófono para una transcripción instantánea y precisa.
          </p>
          
          <button
            onClick={startRecording}
            disabled={disabled}
            className="w-full max-w-[240px] px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
          >
            <Mic size={18} /> INICIAR GRABACIÓN
          </button>
          
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <Lock size={12} /> Procesado de forma segura y privada
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center animate-fade-in w-full">
          
          <div className={`flex items-center gap-3 text-3xl font-bold font-mono tracking-wider mb-6 ${isPaused ? 'text-orange-500' : 'text-primary-600'}`}>
            <span className={`inline-block w-4 h-4 rounded-full ${isPaused ? 'bg-orange-500' : 'bg-primary-600 animate-pulse'}`} />
            {formatTime(recordingTime)}
          </div>

          <canvas
            ref={canvasRef}
            className="w-full max-w-xs h-20 mb-8"
          />

          <div className="flex gap-4">
            {isPaused ? (
              <button
                onClick={resumeRecording}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Play size={18} fill="currentColor" /> Continuar
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Pause size={18} fill="currentColor" /> Pausar
              </button>
            )}
            
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-bold transition-colors flex items-center gap-2"
            >
              <StopCircle size={18} fill="currentColor" /> Finalizar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
