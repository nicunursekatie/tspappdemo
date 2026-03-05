/**
 * useEventCollaboration - Event-specific wrapper for real-time collaboration
 * 
 * This hook is a backward-compatible wrapper around the generic useCollaboration hook.
 * It provides the same API as before but now uses the generic collaboration infrastructure.
 * 
 * @example
 * ```tsx
 * function EventEditor({ eventId }: { eventId: number }) {
 *   const {
 *     isConnected,
 *     presentUsers,
 *     locks,
 *     acquireFieldLock,
 *     releaseFieldLock,
 *     isFieldLockedByOther,
 *     comments,
 *     addComment,
 *     onFieldUpdate,
 *     updateField,
 *   } = useEventCollaboration(eventId);
 * 
 *   // Show who's currently viewing
 *   <div>
 *     Viewers: {presentUsers.map(u => u.userName).join(', ')}
 *   </div>
 * 
 *   // Lock a field before editing
 *   const handleFieldFocus = async (fieldName: string) => {
 *     try {
 *       await acquireFieldLock(fieldName);
 *     } catch (error) {
 *       console.error('Field is locked by another user');
 *     }
 *   };
 * 
 *   // Save field with conflict detection
 *   const handleFieldSave = async (fieldName: string, value: any, currentVersion: Date) => {
 *     try {
 *       await updateField(fieldName, value, currentVersion);
 *       await releaseFieldLock(fieldName);
 *     } catch (error) {
 *       if (error.message.includes('Conflict')) {
 *         alert('This field was modified by another user. Please refresh.');
 *       }
 *     }
 *   };
 * 
 *   // Listen for real-time updates from other users
 *   useEffect(() => {
 *     const cleanup = onFieldUpdate((fieldName, value, version) => {
 *       console.log(`Field ${fieldName} was updated to:`, value);
 *       // Update your local state here
 *     });
 *     return cleanup;
 *   }, [onFieldUpdate]);
 * 
 *   // Add a comment
 *   const handleAddComment = async (content: string) => {
 *     await addComment(content);
 *   };
 * }
 * ```
 * 
 * Features:
 * - Real-time presence tracking (see who's viewing the event)
 * - Field-level locking to prevent edit conflicts
 * - Optimistic concurrency control with version-based conflict detection
 * - Real-time comments with create/update/delete
 * - Revision history tracking
 * - Automatic heartbeat to maintain connection
 * - Auto-cleanup on unmount
 * 
 * @param eventId - The ID of the event request to collaborate on
 * @returns Collaboration interface with state and methods
 */

import { useCollaboration, type UseCollaborationReturn } from './use-collaboration';

// Re-export types for backward compatibility
export type { PresenceUser, FieldUpdateCallback } from './use-collaboration';
export type { EventCollaborationComment, EventFieldLock, EventEditRevision } from '@shared/schema';

/**
 * Event-specific collaboration hook (backward compatible wrapper)
 *
 * This hook now delegates all functionality to the generic useCollaboration hook
 * with resourceType='event', maintaining full backward compatibility with existing code.
 *
 * @param eventId - The ID of the event request to collaborate on (pass null/0 for new events)
 * @returns Full collaboration API for the event
 */
export function useEventCollaboration(eventId: number | null | undefined): UseCollaborationReturn {
  return useCollaboration({
    resourceType: 'event',
    resourceId: eventId || 0, // useCollaboration handles 0/falsy as "disabled"
    namespace: '/collaboration',
  });
}
