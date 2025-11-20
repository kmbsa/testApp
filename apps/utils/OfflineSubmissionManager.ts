import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError } from 'axios';
import { API_URL } from '@env';
import { Alert } from 'react-native';

/**
 * Represents a submission that failed to reach the backend
 */
export interface OfflineSubmission {
  id: string; // Unique identifier (timestamp + random)
  type: 'area' | 'farm'; // Type of submission
  endpoint: string; // API endpoint (e.g., '/area' or '/area/123/farm')
  method: 'POST' | 'PUT'; // HTTP method
  data: any; // The payload to send
  timestamp: number; // When it was attempted
  retries: number; // Number of retry attempts
  errorMessage?: string; // Last error message
  status: 'pending' | 'failed' | 'syncing'; // Current status
}

const OFFLINE_SUBMISSIONS_KEY = 'offline_submissions';
const OFFLINE_QUEUE_KEY = 'offline_queue';

/**
 * Save a failed submission to local storage for later retry
 */
export const saveOfflineSubmission = async (
  type: 'area' | 'farm',
  endpoint: string,
  method: 'POST' | 'PUT',
  data: any,
  errorMessage?: string,
): Promise<string> => {
  try {
    const submissionId = `${type}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const submission: OfflineSubmission = {
      id: submissionId,
      type,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retries: 0,
      errorMessage,
      status: 'pending',
    };

    // Get existing submissions
    const existingData = await AsyncStorage.getItem(OFFLINE_SUBMISSIONS_KEY);
    const submissions: OfflineSubmission[] = existingData
      ? JSON.parse(existingData)
      : [];

    // Add the new submission
    submissions.push(submission);

    // Save back to storage
    await AsyncStorage.setItem(
      OFFLINE_SUBMISSIONS_KEY,
      JSON.stringify(submissions),
    );

    // Add to queue for retry attempts
    const queueData = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: string[] = queueData ? JSON.parse(queueData) : [];
    if (!queue.includes(submissionId)) {
      queue.push(submissionId);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }

    console.log(`[OfflineSubmission] Saved submission: ${submissionId}`);
    return submissionId;
  } catch (error) {
    console.error(
      '[OfflineSubmission] Error saving offline submission:',
      error,
    );
    throw error;
  }
};

/**
 * Get all pending offline submissions
 */
export const getPendingSubmissions = async (): Promise<OfflineSubmission[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_SUBMISSIONS_KEY);
    if (!data) return [];

    const submissions: OfflineSubmission[] = JSON.parse(data);
    return submissions.filter(
      (s) => s.status === 'pending' || s.status === 'failed',
    );
  } catch (error) {
    console.error(
      '[OfflineSubmission] Error getting pending submissions:',
      error,
    );
    return [];
  }
};

/**
 * Retry syncing all pending offline submissions
 * Called when connection is restored or on app startup
 */
export const retrySyncOfflineSubmissions = async (
  userToken: string,
): Promise<{ successful: number; failed: number }> => {
  try {
    const submissions = await getPendingSubmissions();

    if (submissions.length === 0) {
      console.log('[OfflineSubmission] No pending submissions to sync');
      return { successful: 0, failed: 0 };
    }

    console.log(
      `[OfflineSubmission] Attempting to sync ${submissions.length} offline submissions`,
    );

    let successCount = 0;
    let failureCount = 0;

    for (const submission of submissions) {
      try {
        const success = await retrySubmission(submission, userToken);
        if (success) {
          successCount++;
          // Remove successful submission from storage
          await removeOfflineSubmission(submission.id);
        } else {
          failureCount++;
        }
      } catch (error) {
        console.error(
          `[OfflineSubmission] Error retrying submission ${submission.id}:`,
          error,
        );
        failureCount++;
      }
    }

    console.log(
      `[OfflineSubmission] Sync complete: ${successCount} successful, ${failureCount} failed`,
    );
    return { successful: successCount, failed: failureCount };
  } catch (error) {
    console.error(
      '[OfflineSubmission] Error in retrySyncOfflineSubmissions:',
      error,
    );
    return { successful: 0, failed: 0 };
  }
};

/**
 * Retry a single submission
 */
const retrySubmission = async (
  submission: OfflineSubmission,
  userToken: string,
): Promise<boolean> => {
  try {
    // Update status to syncing
    await updateSubmissionStatus(submission.id, 'syncing');

    const response = await axios({
      method: submission.method,
      url: `${API_URL}${submission.endpoint}`,
      data: submission.data,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      timeout: 10000,
    });

    if (response.status === 200 || response.status === 201) {
      console.log(
        `[OfflineSubmission] Successfully synced submission: ${submission.id}`,
      );
      return true;
    }

    // If response is not successful but no error thrown
    console.warn(
      `[OfflineSubmission] Unexpected response status ${response.status} for submission ${submission.id}`,
    );
    await updateSubmissionStatus(
      submission.id,
      'failed',
      `Server returned status ${response.status}`,
    );
    return false;
  } catch (error) {
    const err = error as AxiosError;
    const errorMsg = err.message || 'Unknown error';

    console.error(
      `[OfflineSubmission] Failed to sync submission ${submission.id}:`,
      errorMsg,
    );

    // Increment retry count and update status
    await incrementSubmissionRetries(submission.id, errorMsg);
    return false;
  }
};

/**
 * Update the status of an offline submission
 */
const updateSubmissionStatus = async (
  submissionId: string,
  status: 'pending' | 'failed' | 'syncing',
  errorMessage?: string,
): Promise<void> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_SUBMISSIONS_KEY);
    if (!data) return;

    const submissions: OfflineSubmission[] = JSON.parse(data);
    const submission = submissions.find((s) => s.id === submissionId);

    if (submission) {
      submission.status = status;
      if (errorMessage) {
        submission.errorMessage = errorMessage;
      }
      await AsyncStorage.setItem(
        OFFLINE_SUBMISSIONS_KEY,
        JSON.stringify(submissions),
      );
    }
  } catch (error) {
    console.error(
      '[OfflineSubmission] Error updating submission status:',
      error,
    );
  }
};

/**
 * Increment retry count for a submission
 */
const incrementSubmissionRetries = async (
  submissionId: string,
  errorMessage: string,
): Promise<void> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_SUBMISSIONS_KEY);
    if (!data) return;

    const submissions: OfflineSubmission[] = JSON.parse(data);
    const submission = submissions.find((s) => s.id === submissionId);

    if (submission) {
      submission.retries += 1;
      submission.status = 'failed';
      submission.errorMessage = errorMessage;

      // Mark as failed if too many retries (e.g., 5+)
      if (submission.retries >= 5) {
        submission.status = 'failed';
        console.warn(
          `[OfflineSubmission] Submission ${submissionId} failed after ${submission.retries} retries`,
        );
      }

      await AsyncStorage.setItem(
        OFFLINE_SUBMISSIONS_KEY,
        JSON.stringify(submissions),
      );
    }
  } catch (error) {
    console.error(
      '[OfflineSubmission] Error incrementing submission retries:',
      error,
    );
  }
};

/**
 * Remove a successfully synced submission
 */
export const removeOfflineSubmission = async (
  submissionId: string,
): Promise<void> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_SUBMISSIONS_KEY);
    if (!data) return;

    const submissions: OfflineSubmission[] = JSON.parse(data);
    const filtered = submissions.filter((s) => s.id !== submissionId);

    await AsyncStorage.setItem(
      OFFLINE_SUBMISSIONS_KEY,
      JSON.stringify(filtered),
    );

    // Also remove from queue
    const queueData = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (queueData) {
      const queue: string[] = JSON.parse(queueData);
      const newQueue = queue.filter((id) => id !== submissionId);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
    }

    console.log(
      `[OfflineSubmission] Removed synced submission: ${submissionId}`,
    );
  } catch (error) {
    console.error(
      '[OfflineSubmission] Error removing offline submission:',
      error,
    );
  }
};

/**
 * Check if a network error occurred (not backend error)
 */
export const isNetworkError = (error: any): boolean => {
  if (error instanceof AxiosError) {
    // Network errors: no response, timeout, or request failed
    return (
      !error.response ||
      error.code === 'ECONNABORTED' ||
      error.message === 'Network Error'
    );
  }
  return false;
};

/**
 * Clear all offline submissions (use with caution)
 */
export const clearOfflineSubmissions = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(OFFLINE_SUBMISSIONS_KEY);
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    console.log('[OfflineSubmission] Cleared all offline submissions');
  } catch (error) {
    console.error(
      '[OfflineSubmission] Error clearing offline submissions:',
      error,
    );
  }
};
