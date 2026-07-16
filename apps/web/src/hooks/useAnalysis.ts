'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

type AnalysisStatus =
  | 'idle'
  | 'starting'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'no_reference';

interface AnalysisDimensions {
  length_cm: number;
  width_cm: number;
  height_cm: number;
}

export interface DetectedOpening {
  type: 'door' | 'window';
  width_cm: number;
  height_cm: number;
  count: number;
  confidence: number;
}

interface JobStatusResponse {
  job_id: string;
  status: string;
  progress_pct: number;
  dimensions?: AnalysisDimensions | null;
  confidence?: string | null;
  confidence_score?: number | null;
  reference_detected?: boolean;
  openings?: DetectedOpening[] | null;
  error_message?: string | null;
}

interface StartAnalysisResponse {
  job_id: string;
  status: string;
}

interface UseAnalysisReturn {
  status: AnalysisStatus;
  progressPct: number;
  dimensions: AnalysisDimensions | null;
  confidence: string | null;
  confidenceScore: number | null;
  detectedOpenings: DetectedOpening[];
  referenceDetected: boolean;
  error: string | null;
  startAnalysis: () => Promise<void>;
  reset: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function useAnalysis(projectId: string): UseAnalysisReturn {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [dimensions, setDimensions] = useState<AnalysisDimensions | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [detectedOpenings, setDetectedOpenings] = useState<DetectedOpening[]>([]);
  const [referenceDetected, setReferenceDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setProgressPct(0);
    setDimensions(null);
    setConfidence(null);
    setConfidenceScore(null);
    setDetectedOpenings([]);
    setReferenceDetected(false);
    setError(null);
    setJobId(null);
  }, [stopPolling]);

  // Poll for job status
  useEffect(() => {
    if (!jobId || (status !== 'processing' && status !== 'starting')) return;

    const poll = async () => {
      try {
        const data = await apiGet<JobStatusResponse>(
          `/projects/${projectId}/analyze/${jobId}/status`,
        );

        setProgressPct(data.progress_pct);

        if (data.status === 'completed') {
          stopPolling();
          // Check if it's a no_reference result
          if (data.dimensions) {
            setStatus('completed');
            setDimensions(data.dimensions);
            setConfidence(data.confidence ?? null);
            setConfidenceScore(data.confidence_score ?? null);
            setDetectedOpenings(data.openings ?? []);
            setReferenceDetected(data.reference_detected ?? false);
          } else if (data.reference_detected === false) {
            setStatus('no_reference');
          } else {
            setStatus('completed');
          }
        } else if (data.status === 'failed') {
          stopPolling();
          setStatus('failed');
          setError(
            data.error_message ??
              'L\'analyse a echoue. Veuillez saisir les dimensions manuellement.',
          );
        } else {
          setStatus('processing');
        }
      } catch (err: unknown) {
        stopPolling();
        setStatus('failed');
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur lors de la vérification du statut',
        );
      }
    };

    // Initial poll immediately
    poll();

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [jobId, projectId, status, stopPolling]);

  const startAnalysis = useCallback(async () => {
    setStatus('starting');
    setError(null);
    setDimensions(null);
    setConfidence(null);
    setConfidenceScore(null);
    setDetectedOpenings([]);
    setProgressPct(0);

    try {
      const data = await apiPost<StartAnalysisResponse>(
        `/projects/${projectId}/analyze`,
      );
      setJobId(data.job_id);
      setStatus('processing');
    } catch (err: unknown) {
      setStatus('failed');
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de demarrer l\'analyse',
      );
    }
  }, [projectId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    status,
    progressPct,
    dimensions,
    confidence,
    confidenceScore,
    detectedOpenings,
    referenceDetected,
    error,
    startAnalysis,
    reset,
  };
}
