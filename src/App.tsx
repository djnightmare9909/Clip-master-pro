/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Video, 
  Upload, 
  Download, 
  RefreshCcw, 
  ChevronRight, 
  Plus, 
  Play, 
  Pause,
  Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface VideoMetadata {
  duration: number;
  size: string;
  name: string;
}

// --- Helper Functions ---
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(100); // as percentage
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);
      setStartTime(0);
      setEndTime(100);
    }
  };

  const onLoadedMetadata = () => {
    if (videoRef.current && videoFile) {
      setMetadata({
        duration: videoRef.current.duration,
        size: `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB`,
        name: videoFile.name
      });
    }
  };

  const handleReset = () => {
    setStartTime(0);
    setEndTime(100);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleNewClip = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl('');
    setMetadata(null);
    setStartTime(0);
    setEndTime(100);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const setPointToCurrent = (target: 'start' | 'end') => {
    if (videoRef.current && metadata) {
      const current = (videoRef.current.currentTime / metadata.duration) * 100;
      if (target === 'start') {
        setStartTime(Math.min(current, endTime - 0.1));
      } else {
        setEndTime(Math.max(current, startTime + 0.1));
      }
    }
  };

  const downloadClip = async () => {
    if (!videoRef.current || !metadata || !videoFile) return;

    const actualStart = (startTime / 100) * metadata.duration;
    const actualEnd = (endTime / 100) * metadata.duration;
    const clipLength = actualEnd - actualStart;

    if (clipLength <= 0) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Logic for clipping using Canvas + MediaRecorder
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.crossOrigin = 'anonymous';
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const stream = canvas.captureStream(30); 
      // Fallback mime types
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';
        
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000 
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clip_${metadata.name.split('.')[0]}_${formatTime(actualStart).replace(/[:.]/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsProcessing(false);
        setProgress(100);
      };

      mediaRecorder.start();
      video.currentTime = actualStart;
      await video.play();

      const drawFrame = () => {
        if (video.currentTime >= actualEnd || video.ended) {
          video.pause();
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentProgress = ((video.currentTime - actualStart) / clipLength) * 100;
        setProgress(Math.min(currentProgress, 99));
        requestAnimationFrame(drawFrame);
      };

      drawFrame();

    } catch (error) {
      console.error('Error processing video:', error);
      alert('Error processing video. Try a different format or use Chrome.');
      setIsProcessing(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && metadata) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isPlaying, metadata]);

  return (
    <div className="flex flex-col min-h-screen font-sans">
      {/* Header */}
      <header className="bg-slate-900/95 backdrop-blur-xl border-b border-border-custom sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 text-indigo-500">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Scissors className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gradient-custom">ClipMaster Pro</h1>
          </div>
          <span className="text-xs text-slate-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 font-medium">
            v1.0
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto p-6 w-full">
        <AnimatePresence mode="wait">
          {!videoFile ? (
            <motion.div 
              key="uploader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex justify-center items-center min-h-[60vh]"
            >
              <div 
                className="bg-card border-2 border-dashed border-border-custom rounded-2xl p-12 text-center transition-all hover:border-indigo-500 hover:bg-card-hover group max-w-lg w-full cursor-pointer shadow-custom"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-indigo-500 mb-6 flex justify-center">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Upload className="w-16 h-16 stroke-[1.5]" />
                  </motion.div>
                </div>
                <h2 className="text-2xl font-semibold mb-3">Upload Video</h2>
                <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                  Start by choosing a video. Supports MP4, WebM, and MOV formats.
                  All processing happens locally.
                </p>
                <button 
                  className="bg-gradient-custom text-white px-8 py-3.5 rounded-xl font-semibold shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 group-hover:scale-105"
                >
                  Choose File
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="video/*" 
                  hidden 
                />
                <p className="text-slate-500 text-xs mt-6">Maximum file size: 500MB</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl p-6 border border-border-custom shadow-custom overflow-hidden">
                {/* Video Player Section */}
                <div className="space-y-4">
                  <div className="relative group bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-border-custom">
                    <video 
                      ref={videoRef}
                      src={videoUrl}
                      onLoadedMetadata={onLoadedMetadata}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      className="w-full max-h-[500px] object-contain aspect-video cursor-pointer"
                      onClick={togglePlay}
                    />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition-colors">
                          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                        </button>
                        <div className="flex-1" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-slate-400 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-400">{formatTime(metadata?.duration || 0)}</span>
                      <span className="text-slate-600">|</span>
                      <span>{metadata?.size}</span>
                    </div>
                    <span className="truncate max-w-[200px]">{metadata?.name}</span>
                  </div>
                </div>

                {/* Trimmer Controls */}
                <div className="mt-8 space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                       Trim Range
                    </h3>
                    <p className="text-sm text-slate-400">Drag the handles or play to specific frames to set the clip boundaries.</p>
                  </div>

                  {/* Range Sliders */}
                  <div className="relative h-12 flex items-center">
                    <div className="absolute w-full h-1.5 bg-slate-800 rounded-full" />
                    <div 
                      className="absolute h-1.5 bg-gradient-custom rounded-full z-10"
                      style={{ 
                        left: `${startTime}%`, 
                        width: `${endTime - startTime}%` 
                      }}
                    />
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={startTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setStartTime(Math.min(val, endTime - 0.1));
                        if(videoRef.current) videoRef.current.currentTime = (val/100) * (metadata?.duration || 0);
                      }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none z-20 cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500 [&::-webkit-slider-thumb]:shadow-lg"
                    />
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={endTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEndTime(Math.max(val, startTime + 0.1));
                        if(videoRef.current) videoRef.current.currentTime = (val/100) * (metadata?.duration || 0);
                      }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none z-30 cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500 [&::-webkit-slider-thumb]:shadow-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Start Time</label>
                      <div className="bg-slate-950 border border-border-custom rounded-lg p-3 text-center font-mono text-xl font-bold text-indigo-400">
                        {formatTime((startTime / 100) * (metadata?.duration || 0))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center pb-2 text-indigo-500/30">
                      <ChevronRight className="w-8 h-8 rotate-90 md:rotate-0" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">End Time</label>
                      <div className="bg-slate-950 border border-border-custom rounded-lg p-3 text-center font-mono text-xl font-bold text-indigo-400">
                        {formatTime((endTime / 100) * (metadata?.duration || 0))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-center">
                    <span className="text-slate-400 text-sm">Target Duration: </span>
                    <strong className="text-indigo-400 text-lg font-mono">
                      {formatTime(((endTime - startTime) / 100) * (metadata?.duration || 0))}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button 
                      onClick={() => setPointToCurrent('start')}
                      className="px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-sm font-semibold transition-all border border-indigo-500/20"
                    >
                      Set Start At Pointer
                    </button>
                    <button 
                      onClick={() => setPointToCurrent('end')}
                      className="px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-sm font-semibold transition-all border border-indigo-500/20"
                    >
                      Set End At Pointer
                    </button>
                    <button 
                      onClick={handleReset}
                      className="col-span-2 md:col-span-1 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 rounded-xl text-sm font-semibold transition-all border border-border-custom"
                    >
                      Reset Selection
                    </button>
                  </div>

                  <button 
                    onClick={downloadClip}
                    disabled={isProcessing}
                    className="w-full bg-gradient-custom text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/40 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    <Download className="w-6 h-6" />
                    Export Trimmed Clip
                  </button>
                </div>
              </div>

              <button 
                onClick={handleNewClip}
                className="mx-auto flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-medium py-2 px-4 rounded-lg hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" />
                Upload New Video
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 text-center text-slate-500 text-xs mt-auto border-t border-border-custom">
        <p>ClipMaster Pro — No servers. Just your video, your browser, and your imagination.</p>
      </footer>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-darker/95 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="text-center max-w-sm w-full space-y-8">
              <div className="relative w-24 h-24 mx-auto">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Scissors className="w-8 h-8 text-indigo-400" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Cutting your clip...</h2>
                <p className="text-slate-400 text-sm">Please do not close this tab. Processing speed depends on your device and video length.</p>
              </div>

              <div className="space-y-3">
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-custom"
                  />
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
