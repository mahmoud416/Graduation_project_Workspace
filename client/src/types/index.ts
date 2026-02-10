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
}

export interface StatCard {
    title: string;
    value: number | string;
    change?: string;
    isPercentage?: boolean;
}
