import { triggerAIAnalysis, type AIAnalysisPayload } from './qcService';
import type { QualityAnalysisResult } from '../types';

interface AnalyzeTaskPayload {
    task_id: string;
    task_title: string;
    task_description?: string;
    project_id?: string;
    standard_ids?: string[];
}

const getDefaultProjectId = () => {
    if (typeof window === 'undefined') return 'public-group';
    return localStorage.getItem('lastProjectId') || localStorage.getItem('currentProjectId') || 'public-group';
};

const buildPayload = (payload: AnalyzeTaskPayload): AIAnalysisPayload => ({
    taskId: payload.task_id,
    projectId: payload.project_id ?? getDefaultProjectId(),
    taskTitle: payload.task_title,
    taskDescription: payload.task_description,
    descriptionOverride: payload.task_description,
    standardIds: payload.standard_ids,
});

const analyzeTask = async (payload: AnalyzeTaskPayload): Promise<QualityAnalysisResult> => {
    const response = await triggerAIAnalysis(buildPayload(payload));
    return response as QualityAnalysisResult;
};

export const qualityApi = {
    analyzeTask,
};
