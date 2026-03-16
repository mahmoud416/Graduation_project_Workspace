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

export interface QualityRule {
    rule_id?: string;
    label: string;
    instructions?: string;
    weight?: number;
}

export interface DatasetReference {
    file_id: string;
    file_path?: string;
    file_type: 'image' | 'document' | 'other';
    tags: string[];
    size_bytes?: number;
}

export interface ScopeDefinition {
    level: 'all' | 'group' | 'project';
    ids: string[];
}

export interface QualityStandard {
    id: string;
    title: string;
    description?: string;
    type: 'text' | 'dataset';
    status: 'active' | 'archived';
    rules: QualityRule[];
    dataset_refs: DatasetReference[];
    scope: ScopeDefinition;
    updated_at?: string;
    created_at?: string;
}

export interface QualityTrendPoint {
    date: string;
    avgScore: number;
    evaluations: number;
}

export interface CompletionTrendPoint {
    date: string;
    checked: number;
    unchecked: number;
}

export interface QualityProjectScore {
    projectId: string;
    avgScore: number;
    evaluations: number;
}

export interface QualityAIHistoryEntry {
    analysisId: string;
    taskTitle?: string;
    score?: number;
    createdAt?: string;
    status?: string;
}

export interface QualityTodoStats {
    checked: number;
    unchecked: number;
}

export interface QualityOverview {
    scoreTrend: QualityTrendPoint[];
    completionTrend: CompletionTrendPoint[];
    projectScores: QualityProjectScore[];
    aiHistory: QualityAIHistoryEntry[];
    todoStats: QualityTodoStats;
}

export interface QualityRuleEvaluation {
    rule_id?: string;
    label?: string;
    instructions?: string;
    notes?: string;
    weight?: number;
    passed?: boolean;
}

export interface QualityAnalysisResult {
    analysis_id?: string;
    task_id?: string;
    project_id?: string;
    status?: string;
    score?: number;
    passed_rules?: QualityRuleEvaluation[];
    failed_rules?: QualityRuleEvaluation[];
    suggestions?: string[];
    created_at?: string;
    completed_at?: string;
}
