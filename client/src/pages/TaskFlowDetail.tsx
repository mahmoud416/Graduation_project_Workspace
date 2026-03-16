import { useState, useRef, useEffect, useCallback } from 'react';
import type { FormEvent, ChangeEvent, KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import AIAnalysisModal from '../components/AIAnalysisModal';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

type TaskItem = {
    id: string;
    title: string;
    assignee: string;
    due: string;
    done: boolean;
};

type MemberProfile = {
    user_id?: string;
    name: string;
    role: string;
    avatar: string;
    online: boolean;
    email?: string;
    responsibility?: string;
};

type AvailableMember = {
    user_id: string;
    name: string;
    role: string;
    avatar: string;
    email?: string;
};

type TaskBoardOverview = {
    title: string;
    description: string;
    status_badge: string;
    progress: number;
};

type CommentAttachment = {
    id?: string;
    _id?: string;
    file_name: string;
    download_url?: string;
    size?: number;
};

type BoardComment = {
    id?: string;
    _id?: string;
    user_id?: string;
    user_name: string;
    user_avatar: string;
    message: string;
    created_at?: string;
    attachments?: CommentAttachment[];
};

type TaskBoardResponsePayload = {
    overview: TaskBoardOverview;
    tasks: TaskItem[];
    members: MemberProfile[];
    resources?: TaskBoardResource[];
    comments?: BoardComment[];
};

type TaskBoardResource = {
    id?: string;
    _id?: string;
    file_name: string;
    path?: string;
    uploaded_by: string;
    uploader_role: string;
    uploader_name?: string;
    visible_to?: string;
    created_at?: string;
    download_url?: string;
};

type UploadRules = {
    allowed_types?: string[];
    max_size_mb?: number;
    naming_pattern?: string;
};

const TaskFlowDetail = () => {
    const [searchParams] = useSearchParams();
    const projectId = searchParams.get('projectId') ?? 'public-group';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const commentFileInputRef = useRef<HTMLInputElement>(null);
    const uploadModalFileInputRef = useRef<HTMLInputElement>(null);
    const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [newComment, setNewComment] = useState('');
    const [commentFiles, setCommentFiles] = useState<File[]>([]);
    const [comments, setComments] = useState<BoardComment[]>([]);
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [resources, setResources] = useState<TaskBoardResource[]>([]);
    const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [isInvitingMember, setIsInvitingMember] = useState(false);
    const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [activeMemberMenu, setActiveMemberMenu] = useState<MemberProfile | null>(null);
    const [configureTarget, setConfigureTarget] = useState<MemberProfile | null>(null);
    const [memberConfig, setMemberConfig] = useState({ responsibility: '', role: '' });
    const [isSavingMemberConfig, setIsSavingMemberConfig] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [taskDraft, setTaskDraft] = useState<Omit<TaskItem, 'id'>>({ title: '', assignee: '', due: '', done: false });
    const [boardOverview, setBoardOverview] = useState<TaskBoardOverview | null>(null);
    const modalTitle = boardOverview?.title ? `Add member to ${boardOverview.title}` : 'Add board member';
    const [groupMembers, setGroupMembers] = useState<MemberProfile[]>([]);
    const [boardLoading, setBoardLoading] = useState(true);
    const [boardError, setBoardError] = useState<string | null>(null);
    const [isSavingTask, setIsSavingTask] = useState(false);
    const [isUploadingResource, setIsUploadingResource] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadRules, setUploadRules] = useState<UploadRules | null>(null);
    const [isLoadingRules, setIsLoadingRules] = useState(false);
    const [uploadModalFile, setUploadModalFile] = useState<File | null>(null);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisDone, setAnalysisDone] = useState(false);
    const [analysisCriteria, setAnalysisCriteria] = useState<Array<{ label: string; passed: boolean; hint: string }>>([]);
    const [showAIAnalysis, setShowAIAnalysis] = useState(false);
    const completedTasks = tasks.filter((task) => task.done).length;
    const progressPercent = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const hideProgressBars = projectId === 'public-group' || projectId === 'all-sub-admin';
    const buildDownloadUrl = useCallback((resource: TaskBoardResource) => (
        resource.download_url ? `${API_BASE}${resource.download_url}` : undefined
    ), []);
    const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    const currentUserRole = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    const normalizedUserRole = (currentUserRole ?? '').toLowerCase();
    const canModerateComments = normalizedUserRole === 'admin' || normalizedUserRole === 'sub_admin';
    const isSystemCard = projectId === 'public-group' || projectId === 'all-sub-admin';
    const canAddTask = normalizedUserRole === 'admin' || normalizedUserRole === 'sub_admin';
    const canDeleteComment = (comment: BoardComment) => {
        if (canModerateComments) {
            return true;
        }
        if (!currentUserId) {
            return false;
        }
        return Boolean(comment.user_id && comment.user_id === currentUserId);
    };
    const canDeleteResource = (resource: TaskBoardResource) => {
        if (canModerateComments) {
            return true;
        }
        if (!currentUserId) {
            return false;
        }
        return Boolean(resource.uploaded_by && resource.uploaded_by === currentUserId);
    };

    const loadAvailableMembers = useCallback(async () => {
        if (!projectId) return;
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setBoardError('Missing admin session. Please log in again.');
            return;
        }
        setIsLoadingMembers(true);
        setBoardError(null);
        try {
            const params = new URLSearchParams();
            if (memberSearch.trim()) {
                params.set('search', memberSearch.trim());
            }
            const query = params.toString();
            const response = await fetch(`${API_BASE}/task-boards/${projectId}/members/available${query ? `?${query}` : ''}`, {
                headers: { 'X-User-Id': userId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
            });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to load members');
            }
            const payload = await response.json();
            setAvailableMembers((payload.members ?? []).map((member: AvailableMember) => ({
                ...member,
                avatar: member.avatar || member.name.slice(0, 2).toUpperCase(),
            })));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to load members';
            setBoardError(message);
        } finally {
            setIsLoadingMembers(false);
        }
    }, [projectId, memberSearch]);

    const greetEveryone = groupMembers.map((member) => member.name).join(', ');
    const subAdminSalute = groupMembers
        .filter((member) => member.role && member.role.toLowerCase().includes('sub'))
        .map((member) => member.name)
        .join(', ');
    const overviewTitle = boardOverview?.title ?? 'Develop Responsive Dashboard Layout';
    const overviewDescription = boardOverview?.description ?? 'Implementation of the main dashboard grid system using Tailwind CSS. Needs to be mobile-friendly and support both light and dark modes according to the provided sketch designs.';
    const overviewStatus = boardOverview?.status_badge ?? 'IN PROGRESS';
    const overviewProgress = boardOverview?.progress ?? 0;

    const applyBoardPayload = useCallback((payload: TaskBoardResponsePayload) => {
        if (!payload) return;
        setBoardOverview(payload.overview);
        setTasks(payload.tasks ?? []);
        setGroupMembers((payload.members ?? []).map((member) => ({
            ...member,
            user_id: member.user_id,
            avatar: member.avatar || member.name.slice(0, 2).toUpperCase(),
            online: member.online ?? false,
            responsibility: member.responsibility,
        })));
        setResources((payload.resources ?? []).map((resource) => ({
            ...resource,
            id: resource.id ?? resource._id,
        })));
        setComments((payload.comments ?? []).map((comment) => ({
            ...comment,
            id: comment.id ?? comment._id,
            attachments: (comment.attachments ?? []).map((attachment) => ({
                ...attachment,
                id: attachment.id ?? attachment._id,
            })),
        })));
    }, []);

    const fetchBoard = useCallback(async () => {
        if (!projectId) return;
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setBoardError('Missing admin session. Please log in again.');
            setBoardLoading(false);
            return;
        }

        setBoardLoading(true);
        setBoardError(null);
        try {
            const response = await fetch(`${API_BASE}/task-boards/${projectId}`, {
                headers: { 'X-User-Id': userId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to load task board');
            }

            const payload = await response.json();
            applyBoardPayload(payload);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to load task board';
            setBoardError(message);
        } finally {
            setBoardLoading(false);
        }
    }, [projectId, applyBoardPayload]);

    useEffect(() => {
        fetchBoard();
    }, [fetchBoard]);

    const sendTaskBoardRequest = useCallback(
        async (
            endpoint: string,
            method: 'POST' | 'PATCH',
            body: Record<string, unknown>,
            closeForm = false
        ) => {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                setBoardError('Missing admin session. Please log in again.');
                return null;
            }

            setIsSavingTask(true);
            setBoardError(null);
            try {
                const response = await fetch(endpoint, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': userId,
                        'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const detail = await response.text();
                    throw new Error(detail || 'Unable to save task');
                }

                const payload = await response.json();
                applyBoardPayload(payload);
                if (closeForm) {
                    setIsTaskFormOpen(false);
                    setEditingTaskId(null);
                    setTaskDraft({ title: '', assignee: '', due: '', done: false });
                }
                return payload;
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unable to save task';
                setBoardError(message);
                return null;
            } finally {
                setIsSavingTask(false);
            }
        },
        [applyBoardPayload]
    );

    const uploadResource = useCallback(async (file: File) => {
        if (!projectId) return;
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setBoardError('Missing admin session. Please log in again.');
            return;
        }

        setIsUploadingResource(true);
        setBoardError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE}/task-boards/${projectId}/resources`, {
                method: 'POST',
                headers: { 'X-User-Id': userId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
                body: formData,
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to upload resource');
            }

            const payload = await response.json();
            applyBoardPayload(payload);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to upload resource';
            setBoardError(message);
        } finally {
            setIsUploadingResource(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [projectId, applyBoardPayload]);

    const fetchUploadRules = useCallback(async () => {
        if (!projectId) return;
        const userId = localStorage.getItem('userId');
        setIsLoadingRules(true);
        try {
            const response = await fetch(`${API_BASE}/projects/${projectId}/upload-rules`, {
                headers: {
                    'X-User-Id': userId || '',
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setUploadRules(data);
            } else {
                setUploadRules(null);
            }
        } catch {
            setUploadRules(null);
        } finally {
            setIsLoadingRules(false);
        }
    }, [projectId]);

    const runFileAnalysis = useCallback((file: File) => {
        if (analysisIntervalRef.current) {
            clearInterval(analysisIntervalRef.current);
        }
        setAnalysisProgress(0);
        setAnalysisDone(false);
        setAnalysisCriteria([]);
        setIsUploadModalOpen(true);

        const sizeMB = file.size / (1024 * 1024);
        // Simulate: 1.5s for tiny files, scaling up to ~4s for large files
        const durationMs = Math.min(Math.max(sizeMB * 600 + 1500, 1500), 4000);
        const STEPS = 60;
        const intervalMs = durationMs / STEPS;
        let step = 0;

        analysisIntervalRef.current = setInterval(() => {
            step++;
            const progress = Math.round((step / STEPS) * 100);
            setAnalysisProgress(Math.min(progress, 100));

            if (step >= STEPS) {
                clearInterval(analysisIntervalRef.current!);
                analysisIntervalRef.current = null;

                const maxSizeMB = uploadRules?.max_size_mb ?? 10;
                const ALLOWED_EXT = [
                    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
                    '.ppt', '.pptx', '.txt', '.csv', '.zip',
                    '.jpg', '.jpeg', '.png', '.gif', '.svg',
                    '.mp4', '.mp3', '.webm',
                ];
                const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
                const typeOk = ALLOWED_EXT.includes(ext);
                const sizeOk = sizeMB <= maxSizeMB;
                const nameOk = file.name.length <= 100 && !/[<>:"/\\|?*\x00-\x1F]/.test(file.name);

                setAnalysisCriteria([
                    {
                        label: 'File type accepted',
                        passed: typeOk,
                        hint: typeOk
                            ? ''
                            : `"${ext}" may not be supported. Supported: PDF, Office docs, images, archives, plain text.`,
                    },
                    {
                        label: `File size within limit (≤ ${maxSizeMB} MB)`,
                        passed: sizeOk,
                        hint: sizeOk
                            ? ''
                            : `File is ${sizeMB.toFixed(1)} MB. Please compress or split before uploading.`,
                    },
                    {
                        label: 'Filename format valid',
                        passed: nameOk,
                        hint: nameOk
                            ? ''
                            : 'Filename contains invalid characters or exceeds 100 chars. Use letters, numbers, spaces, dots, hyphens.',
                    },
                ]);
                setAnalysisDone(true);
            }
        }, intervalMs);
    }, [uploadRules]);

    const closeUploadModal = () => {
        if (analysisIntervalRef.current) {
            clearInterval(analysisIntervalRef.current);
            analysisIntervalRef.current = null;
        }
        setIsUploadModalOpen(false);
        setUploadModalFile(null);
        setAnalysisProgress(0);
        setAnalysisDone(false);
        setAnalysisCriteria([]);
    };

    const handleUploadModalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadModalFile(file);
            runFileAnalysis(file);
        }
        e.target.value = '';
    };

    const handleUploadModalConfirm = async () => {
        if (!uploadModalFile) return;
        closeUploadModal();
        await uploadResource(uploadModalFile);
    };

    const handleDeleteResource = async (resourceId?: string) => {
        if (!projectId || !resourceId) return;
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setBoardError('Missing admin session. Please log in again.');
            return;
        }

        setDeletingResourceId(resourceId);
        setBoardError(null);
        try {
            const response = await fetch(`${API_BASE}/task-boards/${projectId}/resources/${resourceId}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': userId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to delete resource');
            }

            const payload = await response.json();
            applyBoardPayload(payload);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to delete resource';
            setBoardError(message);
        } finally {
            setDeletingResourceId(null);
        }
    };

    const handleSendComment = async () => {
        if (!projectId) return;
        const trimmedComment = newComment.trim();
        if (!trimmedComment && commentFiles.length === 0) return;

        const userId = localStorage.getItem('userId');
        if (!userId) {
            setBoardError('Missing admin session. Please log in again.');
            return;
        }

        setIsPostingComment(true);
        setBoardError(null);
        try {
            const formData = new FormData();
            formData.append('message', trimmedComment);
            commentFiles.forEach((file) => formData.append('attachments', file));

            const response = await fetch(`${API_BASE}/task-boards/${projectId}/comments`, {
                method: 'POST',
                headers: { 'X-User-Id': userId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
                body: formData,
            });

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to add comment');
            }

            const payload = await response.json();
            applyBoardPayload(payload);
            setNewComment('');
            setCommentFiles([]);
            if (commentFileInputRef.current) {
                commentFileInputRef.current.value = '';
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to add comment';
            setBoardError(message);
        } finally {
            setIsPostingComment(false);
        }
    };

    const handleDeleteComment = async (commentId?: string) => {
        if (!projectId || !commentId) return;
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setBoardError('Missing admin session. Please log in again.');
            return;
        }
        setDeletingCommentId(commentId);
        setBoardError(null);
        try {
            const response = await fetch(`${API_BASE}/task-boards/${projectId}/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': userId, 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
            });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to delete comment');
            }
            const payload = await response.json();
            applyBoardPayload(payload);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to delete comment';
            setBoardError(message);
        } finally {
            setDeletingCommentId(null);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSendComment();
        }
    };

    const triggerCommentFilePicker = () => {
        commentFileInputRef.current?.click();
    };

    const handleCommentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (!files.length) {
            return;
        }
        setCommentFiles((prev) => [...prev, ...files]);
        event.target.value = '';
    };

    const removeCommentFile = (index: number) => {
        setCommentFiles((prev) => {
            const next = prev.filter((_, idx) => idx !== index);
            if (next.length === 0 && commentFileInputRef.current) {
                commentFileInputRef.current.value = '';
            }
            return next;
        });
    };

    const handleUploadClick = () => {
        void fetchUploadRules();
        uploadModalFileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadResource(file);
        }
    };

    const handleToggleTask = async (taskId: string) => {
        const targetTask = tasks.find((task) => task.id === taskId);
        if (!projectId || !targetTask) return;

        // 1. Toggle the todo done state (existing behaviour)
        await sendTaskBoardRequest(
            `${API_BASE}/task-boards/${projectId}/todos/${taskId}`,
            'PATCH',
            { done: !targetTask.done }
        );

        // 2. Track the action in QC analytics (fire-and-forget, never blocks UI)
        const tok = localStorage.getItem('token') || '';
        fetch(`${API_BASE}/qc/todo-tracking`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id:    taskId,
                project_id: projectId,
                todo_id:    taskId,
                todo_title: targetTask.title,
                action:     targetTask.done ? 'unchecked' : 'checked',
            }),
        }).catch(() => { /* tracking is best-effort, never break the UI */ });
    };

    const toggleMemberMenu = (member: MemberProfile) => {
        if (!member.user_id) return;
        setActiveMemberMenu((prev) => (prev?.user_id === member.user_id ? null : member));
    };

    const handleConfigureMember = (member: MemberProfile) => {
        setMemberConfig({
            responsibility: member.responsibility ?? '',
            role: member.role ?? '',
        });
        setConfigureTarget(member);
        setActiveMemberMenu(null);
    };

    const closeConfigureModal = () => {
        setConfigureTarget(null);
        setMemberConfig({ responsibility: '', role: '' });
    };

    const handleMemberConfigChange = (field: 'responsibility' | 'role', value: string) => {
        setMemberConfig((prev) => ({ ...prev, [field]: value }));
    };

    const handleMemberConfigSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!projectId || !configureTarget?.user_id) return;
        setIsSavingMemberConfig(true);
        const payload = await sendTaskBoardRequest(
            `${API_BASE}/task-boards/${projectId}/members/${configureTarget.user_id}`,
            'PATCH',
            {
                action: 'update',
                responsibility: memberConfig.responsibility,
                role: memberConfig.role,
            }
        );
        setIsSavingMemberConfig(false);
        if (payload) {
            closeConfigureModal();
        }
    };

    const handleRemoveMember = async (member: MemberProfile) => {
        if (!projectId || !member.user_id) return;
        const confirmed = window.confirm(`Remove ${member.name} from this board?`);
        if (!confirmed) return;
        await sendTaskBoardRequest(
            `${API_BASE}/task-boards/${projectId}/members/${member.user_id}`,
            'PATCH',
            { action: 'remove' }
        );
        setActiveMemberMenu(null);
    };

    const openTaskForm = (task?: TaskItem) => {
        if (task) {
            setEditingTaskId(task.id);
            setTaskDraft({ title: task.title, assignee: task.assignee, due: task.due, done: task.done });
        } else {
            setEditingTaskId(null);
            setTaskDraft({ title: '', assignee: '', due: '', done: false });
        }
        setIsTaskFormOpen(true);
    };

    const handleTaskDraftChange = (field: keyof Omit<TaskItem, 'id'>, value: string | boolean) => {
        setTaskDraft((prev) => ({ ...prev, [field]: value }));
    };

    const handleTaskFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!projectId || !taskDraft.title.trim()) return;

        const endpoint = editingTaskId
            ? `${API_BASE}/task-boards/${projectId}/todos/${editingTaskId}`
            : `${API_BASE}/task-boards/${projectId}/todos`;
        const method: 'POST' | 'PATCH' = editingTaskId ? 'PATCH' : 'POST';

        await sendTaskBoardRequest(
            endpoint,
            method,
            {
                title: taskDraft.title,
                assignee: taskDraft.assignee || 'Unassigned',
                due: taskDraft.due || 'TBD',
                done: taskDraft.done,
            },
            true
        );
    };

    const handleCancelTaskEdit = () => {
        setIsTaskFormOpen(false);
        setEditingTaskId(null);
        setTaskDraft({ title: '', assignee: '', due: '', done: false });
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!projectId || !taskId) return;
        const confirmed = window.confirm('Delete this task permanently?');
        if (!confirmed) return;
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setBoardError('Missing session. Please log in again.');
            return;
        }
        setIsSavingTask(true);
        setBoardError(null);
        try {
            const response = await fetch(`${API_BASE}/task-boards/${projectId}/todos/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'X-User-Id': userId,
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                },
            });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Unable to delete task');
            }
            const payload = await response.json();
            applyBoardPayload(payload);
            setIsTaskFormOpen(false);
            setEditingTaskId(null);
            setTaskDraft({ title: '', assignee: '', due: '', done: false });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unable to delete task';
            setBoardError(message);
        } finally {
            setIsSavingTask(false);
        }
    };

    useEffect(() => {
        if (!isMemberModalOpen) {
            return;
        }
        const timeoutId = setTimeout(() => {
            loadAvailableMembers();
        }, 200);
        return () => clearTimeout(timeoutId);
    }, [isMemberModalOpen, memberSearch, loadAvailableMembers]);

    const handleAddMemberClick = () => {
        setMemberSearch('');
        setAvailableMembers([]);
        setIsMemberModalOpen(true);
    };

    const closeMemberModal = () => {
        setIsMemberModalOpen(false);
        setAvailableMembers([]);
        setMemberSearch('');
    };

    const handleInviteMember = async (member: AvailableMember) => {
        if (!projectId) return;
        setIsInvitingMember(true);
        try {
            const payload = await sendTaskBoardRequest(
                `${API_BASE}/task-boards/${projectId}/members`,
                'POST',
                { user_id: member.user_id }
            );
            if (payload) {
                closeMemberModal();
            }
        } finally {
            setIsInvitingMember(false);
        }
    };

    return (
        <>
            <div className="flex min-h-screen bg-background dark:bg-gray-900 transition-colors duration-200">
                <Sidebar />

                <div className="flex-1 ml-[var(--sidebar-width)] transition-[margin] duration-200">
                    <Header title={isSystemCard ? `# ${projectId === 'public-group' ? 'public' : 'all-sub-admin'}` : 'TaskFlow'} />

                    <main className="page-main p-8">
                    {boardLoading && (
                        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-primary">
                            Syncing latest board data...
                        </div>
                    )}
                    {boardError && (
                        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {boardError}
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-6">
                        {/* Main Content - Left Column (2/3) */}
                        <div className="col-span-2 space-y-6">
                            {/* Project / Channel Header */}
                            {isSystemCard ? (
                                /* ── Channel gradient banner ── */
                                <div
                                    className="relative overflow-hidden rounded-2xl"
                                    style={{
                                        background: projectId === 'public-group'
                                            ? 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 45%, #2563eb 100%)'
                                            : 'linear-gradient(135deg, #c2410c 0%, #ea580c 45%, #f59e0b 100%)',
                                        boxShadow: projectId === 'public-group'
                                            ? '0 8px 40px rgba(109,40,217,0.30)'
                                            : '0 8px 40px rgba(194,65,12,0.30)',
                                    }}
                                >
                                    {/* Radial light overlay */}
                                    <div
                                        className="pointer-events-none absolute inset-0"
                                        style={{ background: 'radial-gradient(ellipse at 10% 25%, rgba(255,255,255,0.22) 0%, transparent 60%)' }}
                                    />
                                    {/* Watermark # */}
                                    <div
                                        className="pointer-events-none select-none absolute -right-4 -bottom-6 text-[180px] font-black leading-none"
                                        style={{ color: 'rgba(255,255,255,0.06)', fontFamily: 'monospace' }}
                                    >#</div>

                                    <div className="relative z-10 p-7">
                                        {/* Live badge row */}
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-2">
                                                <span className="relative flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/90" />
                                                </span>
                                                <span className="text-white/70 text-[11px] font-bold uppercase tracking-[0.15em]">
                                                    {projectId === 'public-group' ? 'Public Channel' : 'Admin Channel'} · Live
                                                </span>
                                            </div>
                                            <span className="px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-bold">
                                                {overviewStatus}
                                            </span>
                                        </div>

                                        {/* Channel name */}
                                        <div className="flex items-end gap-1.5 mb-3">
                                            <span className="text-white/35 text-6xl font-black leading-none" style={{ fontFamily: 'monospace' }}>#</span>
                                            <h1 className="text-white text-3xl font-black tracking-tight leading-none mb-1">
                                                {projectId === 'public-group' ? 'public' : 'all-sub-admin'}
                                            </h1>
                                        </div>

                                        {/* Description */}
                                        <p className="text-white/65 text-sm leading-relaxed max-w-xl mb-5">
                                            {overviewDescription}
                                        </p>

                                        {/* Footer stats row */}
                                        <div className="flex items-center gap-5 pt-4 border-t border-white/15">
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                                                </svg>
                                                <span className="text-white/70 text-xs font-medium">
                                                    {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                    <path d="M9 12l2 2 4-4M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                </svg>
                                                <span className="text-white/70 text-xs font-medium">
                                                    {tasks.length > 0 ? `${completedTasks}/${tasks.length} tasks done` : 'No tasks yet'}
                                                </span>
                                            </div>
                                            {projectId === 'public-group' && (
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                        <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                                                    </svg>
                                                    <span className="text-white/70 text-xs font-medium">Open to all workspace</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ── Regular project header card ── */
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <div className="text-xs font-medium text-primary uppercase tracking-wide mb-2">
                                                {boardOverview ? `Project • ${overviewTitle}` : 'PROJECT A • SPRINT 4'}
                                            </div>
                                            <h1 className="text-2xl font-bold text-text-dark dark:text-gray-100 mb-2">
                                                {overviewTitle}
                                            </h1>
                                            <p className="text-sm text-text-gray dark:text-gray-400 leading-relaxed">
                                                {overviewDescription}
                                            </p>
                                        </div>
                                        <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium whitespace-nowrap">
                                            {overviewStatus}
                                        </span>
                                    </div>
                                    <div className="mt-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-text-dark dark:text-gray-200">Overall Progress</span>
                                            <span className="text-sm font-bold text-primary">{overviewProgress}%</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: `${overviewProgress}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* To-do Tracker */}
                            <div className={`rounded-xl border p-6 transition-colors ${
                                isSystemCard
                                    ? `bg-white dark:bg-gray-800 border-l-4 ${projectId === 'public-group' ? 'border-l-violet-500 border-gray-200 dark:border-gray-700' : 'border-l-orange-500 border-gray-200 dark:border-gray-700'}`
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                        isSystemCard
                                            ? projectId === 'public-group'
                                                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
                                                : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                            : 'bg-blue-50 dark:bg-blue-900/20 text-primary'
                                    }`}>
                                        <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M9 12l2 2 4-4" />
                                            <path d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-xs font-semibold uppercase tracking-wide ${
                                            isSystemCard
                                                ? projectId === 'public-group' ? 'text-violet-600 dark:text-violet-400' : 'text-orange-600 dark:text-orange-400'
                                                : 'text-primary'
                                        }`}>
                                            {isSystemCard ? 'Channel Tasks' : 'Sprint Checklist'}
                                        </p>
                                        <h2 className="text-xl font-bold text-text-dark dark:text-gray-100">
                                            {isSystemCard ? 'Task Board' : 'To-do Tracker'}
                                        </h2>
                                        <p className="text-sm text-text-gray dark:text-gray-400">
                                            {isSystemCard ? 'Track and coordinate tasks across the channel.' : 'Mark items as you complete them to keep TaskFlow aligned.'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {canAddTask && (
                                        <button
                                            type="button"
                                            onClick={() => openTaskForm()}
                                            className="flex h-10 w-10 items-center justify-center rounded-full border border-primary text-primary hover:bg-primary/10"
                                            aria-label="Add or edit tasks"
                                        >
                                            <span className="text-2xl leading-none">+</span>
                                        </button>
                                        )}
                                        <div className="text-right">
                                        <div className="text-2xl font-bold text-text-dark dark:text-gray-100">{completedTasks}/{tasks.length}</div>
                                        <div className="text-xs text-text-gray dark:text-gray-400">Tasks done</div>
                                    </div>
                                    </div>
                                </div>

                                {tasks.length > 0 && (
                                    <div className="mb-5">
                                        <div className="flex items-center justify-between text-xs font-medium text-text-gray dark:text-gray-400 mb-2">
                                            <span>Progress</span>
                                            <span className={progressPercent === 100 ? 'text-green-600 dark:text-green-400 font-bold' : ''}>
                                                {progressPercent === 100 ? '✓ Done!' : `${progressPercent}%`}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${progressPercent === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-primary to-blue-400'}`}
                                                style={{ width: `${progressPercent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {isTaskFormOpen && (
                                    <form onSubmit={handleTaskFormSubmit} className="mb-5 rounded-2xl border border-dashed border-primary/40 bg-blue-50/40 dark:bg-blue-900/10 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-text-dark dark:text-gray-100">
                                                {editingTaskId ? 'Edit Task' : 'Add New Task'}
                                            </p>
                                            <button type="button" onClick={handleCancelTaskEdit} className="text-xs text-text-gray hover:text-text-dark">Close</button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Title</label>
                                                <input
                                                    type="text"
                                                    value={taskDraft.title}
                                                    onChange={(e) => handleTaskDraftChange('title', e.target.value)}
                                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Assignee</label>
                                                {isSystemCard ? (
                                                    <select
                                                        value={taskDraft.assignee}
                                                        onChange={(e) => handleTaskDraftChange('assignee', e.target.value)}
                                                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                                    >
                                                        <option value="">— Unassigned —</option>
                                                        {groupMembers.map((member) => (
                                                            <option key={member.user_id ?? member.name} value={member.name}>
                                                                {member.name} ({member.role})
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={taskDraft.assignee}
                                                        onChange={(e) => handleTaskDraftChange('assignee', e.target.value)}
                                                        className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                                        placeholder="Who is responsible?"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-text-gray dark:text-gray-300 uppercase">Deadline</label>
                                                <input
                                                    type="date"
                                                    value={taskDraft.due}
                                                    onChange={(e) => handleTaskDraftChange('due', e.target.value)}
                                                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:outline-none"
                                                />
                                            </div>
                                            <label className="inline-flex items-center gap-2 text-sm font-medium text-text-dark dark:text-gray-100">
                                                <input
                                                    type="checkbox"
                                                    checked={taskDraft.done}
                                                    onChange={(e) => handleTaskDraftChange('done', e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                Mark as done
                                            </label>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 pt-2">
                                            {editingTaskId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteTask(editingTaskId)}
                                                    disabled={isSavingTask}
                                                    className="h-10 px-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-danger text-sm font-semibold hover:bg-red-100 disabled:opacity-60"
                                                >
                                                    Delete Task
                                                </button>
                                            ) : (
                                                <span />
                                            )}
                                            <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={handleCancelTaskEdit}
                                                className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-text-gray"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSavingTask}
                                                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                                            >
                                                {isSavingTask ? 'Saving...' : editingTaskId ? 'Update Task' : 'Add Task'}
                                            </button>
                                            </div>
                                        </div>
                                    </form>
                                )}

                                <div className="space-y-3">
                                    {tasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary/30 dark:hover:border-primary/40 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={task.done}
                                                onChange={() => handleToggleTask(task.id)}
                                                className="h-5 w-5 rounded-md border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-sm font-semibold ${task.done ? 'text-primary' : 'text-text-dark dark:text-gray-200'}`}>
                                                            {task.title}
                                                        </span>
                                                        {isSystemCard && task.assignee && task.assignee !== 'Unassigned' && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-xs font-medium text-primary dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                                                    <circle cx="12" cy="7" r="4" />
                                                                </svg>
                                                                {task.assignee}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-text-gray dark:text-gray-400">Due {task.due}</span>
                                                </div>
                                                {!isSystemCard && (
                                                    <p className="text-xs text-text-gray dark:text-gray-400">{task.assignee}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {task.done && (
                                                    <span className="text-green-600 dark:text-green-400 text-xs font-semibold flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path d="M9 12l2 2 4-4" />
                                                        </svg>
                                                        Done
                                                    </span>
                                                )}
                                                {canAddTask && (
                                                <button
                                                    type="button"
                                                    onClick={() => openTaskForm(task)}
                                                    className="text-xs font-semibold text-primary hover:underline"
                                                >
                                                    Edit
                                                </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Team Discussion / Channel Feed */}
                            <div className={`rounded-xl border p-6 transition-colors ${
                                isSystemCard
                                    ? `bg-white dark:bg-gray-800 border-l-4 ${projectId === 'public-group' ? 'border-l-violet-500 border-gray-200 dark:border-gray-700' : 'border-l-orange-500 border-gray-200 dark:border-gray-700'}`
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                                <div className="flex items-center gap-2 mb-6">
                                    {isSystemCard ? (
                                        <span
                                            className={`text-2xl font-black leading-none ${projectId === 'public-group' ? 'text-violet-500' : 'text-orange-500'}`}
                                            style={{ fontFamily: 'monospace' }}
                                        >#</span>
                                    ) : (
                                        <svg className="w-5 h-5 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    )}
                                    <h2 className="text-base font-bold text-text-dark dark:text-gray-100">
                                        {isSystemCard ? 'Channel Feed' : 'Team Discussion'}
                                    </h2>
                                    <span className="ml-auto text-xs text-text-gray dark:text-gray-400">{comments.length} {isSystemCard ? 'Messages' : 'Comments'}</span>
                                </div>

                                <input
                                    type="file"
                                    ref={commentFileInputRef}
                                    className="hidden"
                                    multiple
                                    onChange={handleCommentFileChange}
                                />

                                <div className="space-y-5 max-h-[420px] overflow-y-auto pr-2">
                                    {comments.map((comment) => {
                                        const commentKey = comment.id ?? comment._id ?? `${comment.user_name}-${comment.created_at}`;
                                        const timestamp = comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Just now';
                                        const avatarLabel = comment.user_avatar || comment.user_name.slice(0, 2).toUpperCase();
                                        const attachments = comment.attachments ?? [];
                                        const resolvedCommentId = comment.id ?? comment._id;
                                        const showDelete = resolvedCommentId ? canDeleteComment(comment) : false;
                                        return (
                                            <div key={commentKey} className="flex gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                                                    {avatarLabel}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2 justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-text-dark dark:text-gray-200">{comment.user_name}</span>
                                                            <span className="text-xs text-text-gray dark:text-gray-500">{timestamp}</span>
                                                        </div>
                                                        {showDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteComment(resolvedCommentId)}
                                                                className="text-xs font-semibold text-danger hover:text-red-600"
                                                            >
                                                                {deletingCommentId === resolvedCommentId ? 'Removing...' : 'Delete'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {comment.message && (
                                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm text-text-dark dark:text-gray-200">
                                                            {comment.message}
                                                        </div>
                                                    )}
                                                    {attachments.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {attachments.map((attachment) => {
                                                                const attachmentKey = attachment.id ?? attachment._id ?? attachment.file_name;
                                                                const downloadHref = attachment.download_url ? `${API_BASE}${attachment.download_url}` : undefined;
                                                                if (downloadHref) {
                                                                    return (
                                                                        <a
                                                                            key={attachmentKey}
                                                                            href={downloadHref}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-semibold text-text-dark dark:text-gray-200 hover:border-primary"
                                                                        >
                                                                            <svg className="w-4 h-4 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path d="M15 13l-3 3-3-3" />
                                                                                <path d="M12 4v12" />
                                                                                <path d="M5 19h14" />
                                                                            </svg>
                                                                            <span>{attachment.file_name}</span>
                                                                        </a>
                                                                    );
                                                                }
                                                                return (
                                                                    <div
                                                                        key={attachmentKey}
                                                                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-semibold text-text-dark dark:text-gray-200"
                                                                    >
                                                                        <svg className="w-4 h-4 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path d="M15 13l-3 3-3-3" />
                                                                            <path d="M12 4v12" />
                                                                            <path d="M5 19h14" />
                                                                        </svg>
                                                                        <span>{attachment.file_name}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {comments.length === 0 && (
                                        <p className="text-sm text-text-gray dark:text-gray-400">
                                            {isSystemCard ? 'No messages yet. Start the conversation.' : 'No comments yet. Be the first to post an update.'}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-6">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={isSystemCard ? `Message #${projectId === 'public-group' ? 'public' : 'all-sub-admin'}...` : 'Share an update with the team...'}
                                            disabled={isPostingComment}
                                            className="w-full pl-4 pr-28 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm text-text-dark dark:text-gray-200 placeholder:text-text-gray dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={triggerCommentFilePicker}
                                                className="text-text-gray dark:text-gray-400 hover:text-primary"
                                                aria-label="Attach files"
                                            >
                                                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M21 16V5a3 3 0 00-3-3H8a3 3 0 00-3 3v11a4 4 0 004 4h9a4 4 0 004-4z" />
                                                    <path d="M17 8l-6 6-3-3" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleSendComment()}
                                                disabled={isPostingComment || (!newComment.trim() && commentFiles.length === 0)}
                                                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white hover:bg-blue-600 disabled:opacity-50"
                                                aria-label="Send comment"
                                            >
                                                {isPostingComment ? (
                                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    {commentFiles.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {commentFiles.map((file, index) => (
                                                <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                                                    {file.name}
                                                    <button type="button" onClick={() => removeCommentFile(index)} className="text-primary/80 hover:text-primary">&times;</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="space-y-6">
                            {/* Task Resources */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                                <div className="flex items-center gap-2 mb-6">
                                    <svg className="w-5 h-5 text-text-gray dark:text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="text-base font-bold text-text-dark dark:text-gray-100">Task Resources</h3>
                                </div>

                                {/* Hidden File Input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                />

                                {/* Uploaded Resources */}
                                {resources.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {resources.map((resource) => {
                                            const key = resource.id || resource._id || resource.file_name;
                                            const uploadedAt = resource.created_at
                                                ? new Date(resource.created_at).toLocaleString()
                                                : null;
                                            const downloadHref = buildDownloadUrl(resource);
                                            const resolvedResourceId = resource.id ?? resource._id;
                                            const canRemoveResource = resolvedResourceId ? canDeleteResource(resource) : false;
                                            return (
                                                <div key={key} className="flex items-center justify-between gap-3 text-sm text-text-dark dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <svg className="w-4 h-4 text-primary" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            <span className="truncate font-semibold">{resource.file_name}</span>
                                                        </div>
                                                        <p className="text-xs text-text-gray dark:text-gray-400 mt-0.5 truncate">
                                                            Uploaded by {resource.uploader_name || 'Workspace member'}
                                                            {` · ${resource.uploader_role}`}
                                                            {uploadedAt ? ` · ${uploadedAt}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        {downloadHref && (
                                                            <a
                                                                href={downloadHref}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-xs font-semibold text-primary hover:underline"
                                                            >
                                                                Download
                                                            </a>
                                                        )}
                                                        {canRemoveResource && resolvedResourceId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteResource(resolvedResourceId)}
                                                                disabled={deletingResourceId === resolvedResourceId}
                                                                className={`text-xs font-semibold text-danger hover:text-red-600 ${deletingResourceId === resolvedResourceId ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                            >
                                                                {deletingResourceId === resolvedResourceId ? 'Removing...' : 'Delete'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {resources.length === 0 && (
                                    <p className="text-sm text-text-gray dark:text-gray-400 mb-4">No shared files yet. Upload a document to kick things off.</p>
                                )}

                                {/* Image Preview Placeholder */}
                                <div className="mb-4">
                                    <div className="w-full h-32 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 rounded-lg flex items-center justify-center mb-3">
                                        <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <button
                                        onClick={handleUploadClick}
                                        disabled={isUploadingResource}
                                        className={`w-full py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${isUploadingResource ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'text-text-gray dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {isUploadingResource ? 'Uploading...' : 'Upload Photo'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleUploadClick}
                                        disabled={isUploadingResource}
                                        className={`py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-colors ${isUploadingResource ? 'bg-blue-300 cursor-not-allowed' : 'bg-primary hover:bg-blue-600 text-white'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        {isUploadingResource ? 'Uploading...' : 'Upload'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowAIAnalysis(true)}
                                        className="py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90 text-white"
                                        style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
                                    >
                                        <span>🤖</span>
                                        <span>Analyze</span>
                                    </button>
                                </div>
                            </div>

                            {/* Group / Channel Members */}
                            <div className={`rounded-xl border p-6 transition-colors ${
                                isSystemCard
                                    ? `bg-white dark:bg-gray-800 border-l-4 ${projectId === 'public-group' ? 'border-l-violet-500 border-gray-200 dark:border-gray-700' : 'border-l-orange-500 border-gray-200 dark:border-gray-700'}`
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        {isSystemCard && (
                                            <span
                                                className={`text-lg font-black leading-none ${projectId === 'public-group' ? 'text-violet-500' : 'text-orange-500'}`}
                                                style={{ fontFamily: 'monospace' }}
                                            >#</span>
                                        )}
                                        <h3 className="text-base font-bold text-text-dark dark:text-gray-100">
                                            {isSystemCard ? 'Channel Members' : 'Group Members'}
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddMemberClick}
                                        className="text-sm text-primary font-medium hover:underline"
                                    >
                                        Add New
                                    </button>
                                </div>

                                <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                                    {groupMembers.map((member, index) => (
                                        <div key={member.user_id ?? index} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium bg-gradient-to-br ${
                                                        isSystemCard
                                                            ? projectId === 'public-group' ? 'from-violet-500 to-indigo-500' : 'from-orange-500 to-amber-400'
                                                            : 'from-blue-400 to-purple-400'
                                                    }`}>
                                                        {member.avatar}
                                                    </div>
                                                    {member.online && (
                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-white dark:border-gray-800 rounded-full"></div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-text-dark dark:text-gray-200">{member.name}</div>
                                                    <div className="text-xs text-text-gray dark:text-gray-500">
                                                        {member.role}
                                                        {member.responsibility ? ` · ${member.responsibility}` : ''}
                                                    </div>
                                                    {member.email && (
                                                        <div className="text-[11px] text-text-gray/70 dark:text-gray-500">{member.email}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    className="text-text-gray dark:text-gray-500 hover:text-text-dark dark:hover:text-gray-300"
                                                    onClick={() => toggleMemberMenu(member)}
                                                >
                                                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                    </svg>
                                                </button>
                                                {activeMemberMenu?.user_id === member.user_id && (
                                                    <div className="absolute right-0 mt-2 w-36 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-10">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConfigureMember(member)}
                                                            className="block w-full px-4 py-2 text-left text-sm text-text-dark dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                        >
                                                            Configure
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMember(member)}
                                                            className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-red-50 dark:hover:bg-red-900/30"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {groupMembers.length === 0 && (
                                    <p className="mt-4 text-sm text-text-gray dark:text-gray-500">No members have been linked to this board yet.</p>
                                )}
                            </div>

                            {/* Task Details */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm font-medium text-text-gray dark:text-gray-400">DUE DATE</span>
                                        <span className="text-sm font-semibold text-text-dark dark:text-gray-200">Oct 24, 2023</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-text-gray dark:text-gray-400">PRIORITY</span>
                                        <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-danger dark:text-red-400 rounded text-xs font-semibold">! High</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </main>
                </div>
            </div>
            {/* Hidden file input for resource uploads — must live outside any conditional modal */}
            <input
                type="file"
                ref={uploadModalFileInputRef}
                className="hidden"
                onChange={handleUploadModalFileSelect}
            />

            {/* File Analysis Overlay */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
                        {/* Gradient Header */}
                        <div className="bg-gradient-to-r from-primary to-blue-600 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-white">File Quality Check</h3>
                                    <p className="text-xs text-white/70 truncate">
                                        {uploadModalFile?.name ?? 'Analyzing file...'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeUploadModal}
                                    className="w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
                                    aria-label="Close"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* File info chip */}
                            {uploadModalFile && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <svg className="w-8 h-8 text-primary flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-text-dark dark:text-gray-100 truncate">{uploadModalFile.name}</p>
                                        <p className="text-xs text-text-gray dark:text-gray-400">
                                            {(uploadModalFile.size / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Progress bar */}
                            <div>
                                <div className="flex items-center justify-between text-xs font-medium mb-2">
                                    <span className="text-text-gray dark:text-gray-400 flex items-center gap-1.5">
                                        {analysisDone ? (
                                            <>
                                                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                                                Analysis complete
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                </svg>
                                                Analyzing quality...
                                            </>
                                        )}
                                    </span>
                                    <span className={`font-bold ${analysisDone ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                                        {analysisProgress}%
                                    </span>
                                </div>
                                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-200 ${analysisDone ? 'bg-green-500' : 'bg-gradient-to-r from-primary to-blue-400'}`}
                                        style={{ width: `${analysisProgress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Criteria results */}
                            {analysisDone && analysisCriteria.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase tracking-wide">Quality Criteria</p>
                                    {analysisCriteria.map((criterion, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-3 p-3 rounded-xl border ${criterion.passed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}
                                        >
                                            <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${criterion.passed ? 'bg-green-500' : 'bg-amber-500'}`}>
                                                {criterion.passed ? '✓' : '!'}
                                            </span>
                                            <div>
                                                <p className={`text-sm font-semibold ${criterion.passed ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                                    {criterion.label}
                                                </p>
                                                {!criterion.passed && criterion.hint && (
                                                    <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{criterion.hint}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                            <button
                                type="button"
                                onClick={closeUploadModal}
                                className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-text-gray dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                            <div className="flex items-center gap-3">
                                {analysisDone && analysisCriteria.some((c) => !c.passed) && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Issues found — review before uploading</span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void handleUploadModalConfirm()}
                                    disabled={!analysisDone || isUploadingResource}
                                    className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isUploadingResource ? 'Uploading...' : analysisDone ? 'Upload File' : 'Analyzing...'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isMemberModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
                            <div>
                                <h3 className="text-lg font-semibold text-text-dark dark:text-gray-100">{modalTitle}</h3>
                                <p className="text-xs text-text-gray dark:text-gray-400">Search anyone in the workspace who is not already assigned.</p>
                            </div>
                            <button type="button" onClick={closeMemberModal} className="text-text-gray hover:text-text-dark dark:text-gray-400 dark:hover:text-gray-200" aria-label="Close member modal">
                                &times;
                            </button>
                        </div>

                        <div className="mt-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    placeholder="Search by name or email"
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                                <svg className="w-4 h-4 text-text-gray absolute right-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="M21 21l-4.35-4.35" />
                                </svg>
                            </div>
                        </div>

                        <div className="mt-4 max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                            {isLoadingMembers && (
                                <p className="py-6 text-center text-sm text-text-gray dark:text-gray-400">Searching directory...</p>
                            )}
                            {!isLoadingMembers && availableMembers.length === 0 && (
                                <p className="py-6 text-center text-sm text-text-gray dark:text-gray-400">No new members match this search.</p>
                            )}
                            {!isLoadingMembers && availableMembers.map((member) => (
                                <div key={member.user_id} className="flex items-center justify-between py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-semibold">
                                            {member.avatar}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-text-dark dark:text-gray-100">{member.name}</div>
                                            <div className="text-xs text-text-gray dark:text-gray-400">
                                                {member.role}
                                                {member.email ? ` · ${member.email}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-full px-4 py-1.5 text-xs font-semibold border border-primary text-primary hover:bg-primary/10 disabled:opacity-60"
                                        onClick={() => handleInviteMember(member)}
                                        disabled={isInvitingMember}
                                    >
                                        {isInvitingMember ? 'Adding...' : 'Invite'}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={closeMemberModal}
                                className="px-4 py-2 text-sm font-semibold text-text-gray dark:text-gray-300 hover:text-text-dark"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {configureTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <form
                        onSubmit={handleMemberConfigSubmit}
                        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
                    >
                        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
                            <div>
                                <h3 className="text-lg font-semibold text-text-dark dark:text-gray-100">Configure {configureTarget.name}</h3>
                                <p className="text-xs text-text-gray dark:text-gray-400">Add context about their role on this board.</p>
                            </div>
                            <button type="button" onClick={closeConfigureModal} className="text-text-gray hover:text-text-dark dark:text-gray-400 dark:hover:text-gray-200" aria-label="Close configure modal">
                                &times;
                            </button>
                        </div>

                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase">Role label</label>
                                <input
                                    type="text"
                                    value={memberConfig.role}
                                    onChange={(e) => handleMemberConfigChange('role', e.target.value)}
                                    placeholder="e.g., Task Master Lead"
                                    className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-gray dark:text-gray-400 uppercase">Responsibility</label>
                                <textarea
                                    value={memberConfig.responsibility}
                                    onChange={(e) => handleMemberConfigChange('responsibility', e.target.value)}
                                    placeholder="Outline what this member owns on the board"
                                    className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-text-dark dark:text-gray-100 focus:border-primary focus:ring-1 focus:ring-primary"
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={closeConfigureModal} className="px-4 py-2 text-sm font-semibold text-text-gray dark:text-gray-300 hover:text-text-dark">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSavingMemberConfig}
                                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                            >
                                {isSavingMemberConfig ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* AI Quality Analysis Modal */}
            {showAIAnalysis && (
                <AIAnalysisModal
                    taskId={`board_${projectId}`}
                    projectId={projectId}
                    taskTitle={overviewTitle}
                    taskDescription={overviewDescription}
                    onClose={() => setShowAIAnalysis(false)}
                />
            )}
        </>
    );
};

export default TaskFlowDetail;
