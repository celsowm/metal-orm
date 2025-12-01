import { useState, useEffect, useMemo } from 'react';
import { SCENARIOS, type Scenario } from './data/scenarios';
import { PlaygroundApiService } from './services/PlaygroundApiService';
import { ScenarioList } from './components/ScenarioList';
import { QueryExecutor } from './components/QueryExecutor';
import './App.css';

/**
 * Main application component
 * Follows SRP by coordinating the high-level application state and layout
 */
function App() {
    const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
    const [apiReady, setApiReady] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const queryService = useMemo(() => new PlaygroundApiService(), []);

    useEffect(() => {
        let isMounted = true;
        let timerId: ReturnType<typeof setTimeout> | null = null;

        const pollStatus = async () => {
            const status = await queryService.getStatus();
            if (!isMounted) return;

            if (status.error) {
                setStatusMessage(status.error);
            } else {
                setStatusMessage(null);
            }

            if (status.ready) {
                setApiReady(true);
                timerId && clearTimeout(timerId);
                return;
            }

            timerId = setTimeout(pollStatus, 250);
        };

        pollStatus();

        return () => {
            isMounted = false;
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [queryService]);

    // Auto-select first scenario when API is ready
    useEffect(() => {
        if (apiReady && !selectedScenario && SCENARIOS.length > 0) {
            setSelectedScenario(SCENARIOS[0]);
        }
    }, [apiReady, selectedScenario]);

    const handleScenarioSelect = (scenario: Scenario) => {
        setSelectedScenario(scenario);
    };

    if (!apiReady) {
        return (
            <div className="app-loading">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <h2>Initializing Metal ORM Playground</h2>
                    <p>Waiting for the playground API to become ready...</p>
                    {statusMessage && <p className="status-error">Error: {statusMessage}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="app-header">
                <h1>⚡ Metal ORM Playground</h1>
                <p className="subtitle">Explore and test ORM query scenarios</p>
            </header>

            <div className="app-content">
                <aside className="sidebar">
                    <ScenarioList
                        scenarios={SCENARIOS}
                        selectedId={selectedScenario?.id || null}
                        onSelect={handleScenarioSelect}
                    />
                </aside>

                <main className="main-content">
                    <QueryExecutor
                        scenario={selectedScenario}
                        queryService={queryService}
                    />
                </main>
            </div>
        </div>
    );
}

export default App;
