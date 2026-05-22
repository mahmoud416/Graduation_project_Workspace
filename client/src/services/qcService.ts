import type {
    QualityOverview,
    QualityStandard,
    QualityRule,
    ScopeDefinition,
    DatasetReference,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
const QC_BASE = `${API_BASE}/qc`;

type StandardResponse = QualityStandard & { _id?: string };

type PlainObject = Record<string, string | number | undefined>;

const authHeaders = (extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
        'X-User-Id': typeof window !== 'undefined' ? (localStorage.getItem('userId') ?? '') : '',
        Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : ''}`,
        ...extra,
    };
    return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        let detail = `Request failed with status ${response.status}`;
        try {
            const payload = await response.json();
            if (Array.isArray(payload.detail)) {
                detail = payload.detail.map((e: any) => e.msg || e.message || String(e)).join('; ');
            } else {
                detail = payload.detail || payload.message || detail;
            }
        } catch {
            const text = await response.text();
            if (text) detail = text;
        }
        throw new Error(String(detail));
    }
    return response.json() as Promise<T>;
};

const normalizeStandard = (raw: any): QualityStandard => ({
    id: raw?._id ?? raw?.id ?? '',
    title: raw?.title ?? 'Untitled standard',
    description: raw?.description ?? '',
    type: raw?.type === 'dataset' ? 'dataset' : 'text',
    status: raw?.status === 'archived' ? 'archived' : 'active',
    rules: Array.isArray(raw?.rules) ? raw.rules : [],
    dataset_refs: Array.isArray(raw?.dataset_refs) ? raw.dataset_refs : [],
    scope: raw?.scope ?? { level: 'all', ids: [] },
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
});

export interface CreateStandardPayload {
    title: string;
    description?: string;
    type?: 'text' | 'dataset';
    rules?: QualityRule[];
    dataset_refs?: DatasetReference[];
    scope?: ScopeDefinition;
    status?: 'active' | 'archived';
}

export interface AIAnalysisPayload {
    taskId: string;
    projectId: string;
    taskTitle: string;
    taskDescription?: string;
    descriptionOverride?: string;
    standardIds?: string[];
    documentFiles?: File[];
    imageFiles?: File[];
}

export const fetchQualityOverview = async (params: { projectId?: string; days?: number } = {}): Promise<QualityOverview> => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('project_id', params.projectId);
    if (params.days) query.set('days', String(params.days));
    const url = `${QC_BASE}/reports/overview${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetch(url, { headers: authHeaders() });
    return handleResponse<QualityOverview>(response);
};

export const fetchQualityStandards = async (params: { projectId?: string; status?: string } = {}): Promise<QualityStandard[]> => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('project_id', params.projectId);
    if (params.status) query.set('status_filter', params.status);
    const url = `${QC_BASE}/standards${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetch(url, { headers: authHeaders() });
    const payload = await handleResponse<StandardResponse[]>(response);
    return payload.map(normalizeStandard);
};

export const createQualityStandard = async (payload: CreateStandardPayload): Promise<QualityStandard> => {
    const response = await fetch(`${QC_BASE}/standards`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });
    const json = await handleResponse<StandardResponse>(response);
    return normalizeStandard(json);
};

export const updateQualityStandard = async (standardId: string, payload: Partial<CreateStandardPayload>): Promise<QualityStandard> => {
    const response = await fetch(`${QC_BASE}/standards/${standardId}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });
    const json = await handleResponse<StandardResponse>(response);
    return normalizeStandard(json);
};

export const triggerAIAnalysis = async (payload: AIAnalysisPayload) => {
    const form = new FormData();
    form.append('project_id', payload.projectId);
    form.append('task_title', payload.taskTitle);
    form.append('task_description', payload.taskDescription ?? '');
    if (payload.descriptionOverride) form.append('description_override', payload.descriptionOverride);
    if (payload.standardIds?.length) form.append('standard_ids', JSON.stringify(payload.standardIds));
    payload.documentFiles?.forEach((file) => form.append('document_files', file));
    payload.imageFiles?.forEach((file) => form.append('image_files', file));

    const response = await fetch(`${QC_BASE}/tasks/${payload.taskId}/analyze`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
    });
    return handleResponse(response);
};

export const buildReportExportUrl = (format: 'csv' | 'pdf', params: PlainObject = {}): string => {
    const query = new URLSearchParams({ format });
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined) return;
        query.set(key, String(value));
    });
    return `${QC_BASE}/reports/export?${query.toString()}`;
};

// ---------------------------------------------------------------------------
// Report Types
// ---------------------------------------------------------------------------

export interface ReportType {
    key: string;
    name_ar: string;
    name_en: string;
    description: string;
    required_elements: string[];
}

export const fetchReportTypes = async (): Promise<ReportType[]> => {
    const response = await fetch(`${API_BASE}/quality/report-types`, {
        headers: authHeaders(),
    });
    return handleResponse<ReportType[]>(response);
};

// ---------------------------------------------------------------------------
// Direct task evaluation (supports report_type)
// ---------------------------------------------------------------------------

export interface EvaluateTaskPayload {
    task_title: string;
    task_description?: string;
    task_id?: string;
    report_type?: string;
    files?: { file_name: string; content: string; file_type: string }[];
    image_base64?: string[];
}

export interface ReportTypeCompliance {
    is_compliant: boolean | null;
    missing_elements: string[];
    compliance_note: string;
}

export interface EvaluationResult {
    compliance_score: number;
    passed_standards: { rule: string; result: string }[];
    failed_standards: { rule: string; reason: string }[];
    suggestions: string[];
    report_type_key?: string;
    report_type_name_ar?: string;
    report_type_name_en?: string;
    report_type_compliance?: ReportTypeCompliance;
    evaluation_id: string;
    _mode?: string;
}

export const evaluateTask = async (payload: EvaluateTaskPayload): Promise<EvaluationResult> => {
    const response = await fetch(`${API_BASE}/quality/evaluate`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            task_title: payload.task_title,
            task_description: payload.task_description ?? '',
            task_id: payload.task_id,
            report_type: payload.report_type,
            files: payload.files ?? [],
            image_base64: payload.image_base64 ?? [],
        }),
    });
    return handleResponse<EvaluationResult>(response);
};

export const downloadQualityReport = async (format: 'csv' | 'pdf', params: PlainObject = {}) => {
    const query = new URLSearchParams({ format });
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined) return;
        query.set(key, String(value));
    });
    const url = `${QC_BASE}/reports/export?${query.toString()}`;
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) {
        throw new Error('Failed to export report');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    const fallback = `qc-report.${format}`;
    let filename = fallback;
    if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match?.[1]) filename = match[1];
    }
    return { blob, filename };
};
