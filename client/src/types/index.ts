export interface Task {
    id: string;
    name: string;
    category: string;
    status: 'To Do' | 'In Progress' | 'Done';
    priority: 'Low' | 'Medium' | 'High';
    dueDate: string;
}

export interface Activity {
    id: string;
    user: {
        name: string;
        avatar: string;
    };
    action: string;
    target: string;
    timestamp: string;
    type: 'update' | 'comment' | 'change' | 'create';
}

export interface Project {
    id: string;
    title: string;
    description: string;
    status: 'ACTIVE' | 'ON HOLD' | 'COMPLETED';
    progress: number;
    team: string[];
    updatedAt: string;
    updatedAtRaw?: string;
    subAdminName?: string;
    subAdminNames?: string[];
    subAdminIds?: string[];
    staffIds?: string[];
    isDefaultGroup?: boolean;
    is_system_card?: boolean;
}

export interface StatCard {
    title: string;
    value: number | string;
    change?: string;
    isPercentage?: boolean;
}

// ─── Quality Control Types ────────────────────────────────────────────────────

export interface QualityRule {
    id: string;
    rule: string;
    category: 'text' | 'image' | 'file' | 'general';
    is_active: boolean;
}

export interface QCStandard {
    _id: string;
    created_by: string;
    title: string;
    description: string;
    standard_type: 'text_rules' | 'dataset';
    rules: QualityRule[];
    dataset_files: QCDatasetFile[];
    scope: 'global' | 'project';
    project_ids: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface QCDatasetFile {
    id: string;
    file_name: string;
    file_path: string;
    file_type: string;
    description: string;
}

export interface PassedStandard {
    standard_id: string;
    rule: string;
    result: string;
}

export interface FailedStandard {
    standard_id: string;
    rule: string;
    reason: string;
}

export interface QCAnalysis {
    _id: string;
    analyzed_by: string;
    task_id: string;
    project_id: string;
    task_title: string;
    task_description: string;
    compliance_score: number;
    passed_standards: PassedStandard[];
    failed_standards: FailedStandard[];
    suggestions: string[];
    files_analyzed: { file_name: string; file_type: string; analysis_result: string }[];
    model_used: string;
    created_at: string;
}

export interface QCDashboardStats {
    total_standards: number;
    total_analyses: number;
    avg_compliance_score: number;
    tasks_passing_qc: number;
    tasks_failing_qc: number;
    tasks_awaiting_qc: number;
    total_todo_completions: number;
    recent_analyses: QCAnalysis[];
    quality_trend_14d: { date: string; avg_score: number; count: number }[];
    compliance_by_project: { project_id: string; avg_score: number; count: number }[];
}

export interface RoadmapResult {
    project_id: string;
    issues_detected: string[];
    suggested_tasks: string[];
    workflow_improvements: string[];
    best_practices: string[];
    overall_assessment: string;
}

