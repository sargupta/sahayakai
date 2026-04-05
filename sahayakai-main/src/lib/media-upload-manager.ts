import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';

export interface MediaUploadJob {
    id: string;           // matches clientMessageId
    blob: Blob;
    mimeType: string;
    conversationId: string;
    status: 'queued' | 'uploading' | 'done' | 'failed';
    progress: number;     // 0-100
    downloadUrl?: string;
    retryCount: number;
}

type ProgressCallback = (job: MediaUploadJob) => void;
type CompleteCallback = (job: MediaUploadJob) => void;

class MediaUploadManager {
    private jobs = new Map<string, MediaUploadJob>();
    private onProgressListeners = new Set<ProgressCallback>();
    private onCompleteListeners = new Set<CompleteCallback>();

    /**
     * Queue a media upload. Returns immediately.
     * The upload proceeds in background.
     */
    enqueue(id: string, blob: Blob, mimeType: string, conversationId: string): void {
        const job: MediaUploadJob = {
            id,
            blob,
            mimeType,
            conversationId,
            status: 'queued',
            progress: 0,
            retryCount: 0,
        };
        this.jobs.set(id, job);
        this.processJob(job);
    }

    /**
     * Retry a failed upload.
     */
    retry(id: string): void {
        const job = this.jobs.get(id);
        if (!job || job.status !== 'failed') return;
        job.status = 'queued';
        job.retryCount++;
        this.processJob(job);
    }

    /**
     * Get current job status.
     */
    getJob(id: string): MediaUploadJob | undefined {
        return this.jobs.get(id);
    }

    onProgress(cb: ProgressCallback): () => void {
        this.onProgressListeners.add(cb);
        return () => this.onProgressListeners.delete(cb);
    }

    onComplete(cb: CompleteCallback): () => void {
        this.onCompleteListeners.add(cb);
        return () => this.onCompleteListeners.delete(cb);
    }

    private async processJob(job: MediaUploadJob) {
        const user = auth.currentUser;
        if (!user) {
            job.status = 'failed';
            this.notify(job);
            return;
        }

        job.status = 'uploading';
        this.notify(job);

        const ext = job.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const path = `voice-messages/${user.uid}/${Date.now()}_${job.id.slice(0, 8)}.${ext}`;
        const storageRef = ref(storage, path);

        try {
            const task = uploadBytesResumable(storageRef, job.blob, {
                contentType: job.mimeType,
            });

            await new Promise<void>((resolve, reject) => {
                task.on(
                    'state_changed',
                    (snapshot) => {
                        job.progress = Math.round(
                            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                        );
                        this.notify(job);
                    },
                    reject,
                    resolve,
                );
            });

            const url = await getDownloadURL(storageRef);
            job.status = 'done';
            job.downloadUrl = url;
            job.progress = 100;
            this.notify(job);
            this.notifyComplete(job);
        } catch {
            job.status = 'failed';
            this.notify(job);
        }
    }

    private notify(job: MediaUploadJob) {
        this.onProgressListeners.forEach(cb => cb(job));
    }

    private notifyComplete(job: MediaUploadJob) {
        this.onCompleteListeners.forEach(cb => cb(job));
    }
}

export const mediaUploadManager = new MediaUploadManager();
