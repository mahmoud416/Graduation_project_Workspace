import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const Tasks = () => {
    return (
        <div className="flex min-h-screen bg-background dark:bg-gray-950 transition-colors">
            <Sidebar />
            <div className="flex-1 ml-[240px]">
                <Header title="Tasks" />
                <main className="pt-16 p-8">
                    <h1 className="text-2xl font-bold text-text-dark dark:text-white">Tasks</h1>
                    <p className="text-text-gray dark:text-gray-400 mt-2">Tasks page - Coming soon</p>
                </main>
            </div>
        </div>
    );
};

export default Tasks;
