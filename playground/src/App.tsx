import { useState, useEffect, useMemo } from 'react';
import { MantineProvider, AppShell, Burger, Group, Title, Text, ActionIcon, useMantineTheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { SCENARIOS, type Scenario } from './data/scenarios.js';
import { PlaygroundApiService } from './services/PlaygroundApiService.js';
import { ScenarioList } from './components/ScenarioList.js';
import { QueryExecutor } from './components/QueryExecutor.js';
import '@mantine/core/styles.css';
import './App.css'; // Keeping for custom overrides if needed, but will likely remove

function App() {
    const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
    const [apiReady, setApiReady] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [opened, { toggle }] = useDisclosure();

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
        if (window.innerWidth < 768) {
            toggle(); // Close sidebar on mobile selection
        }
    };

    if (!apiReady) {
        return (
            <MantineProvider defaultColorScheme="dark">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column' }}>
                    <Title order={2}>Initializing Metal ORM Playground</Title>
                    <Text c="dimmed">Waiting for the playground API to become ready...</Text>
                    {statusMessage && <Text c="red">Error: {statusMessage}</Text>}
                </div>
            </MantineProvider>
        );
    }

    return (
        <MantineProvider defaultColorScheme="dark">
            <AppShell
                header={{ height: 60 }}
                navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
                padding="md"
            >
                <AppShell.Header>
                    <Group h="100%" px="md">
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                        <Group justify="space-between" style={{ flex: 1 }}>
                            <Title order={3}>⚡ Metal ORM Playground</Title>
                            <Text size="sm" c="dimmed" visibleFrom="sm">Explore and test ORM query scenarios</Text>
                        </Group>
                    </Group>
                </AppShell.Header>

                <AppShell.Navbar p="md">
                    <ScenarioList
                        scenarios={SCENARIOS}
                        selectedId={selectedScenario?.id || null}
                        onSelect={handleScenarioSelect}
                    />
                </AppShell.Navbar>

                <AppShell.Main>
                    <QueryExecutor
                        scenario={selectedScenario}
                        queryService={queryService}
                    />
                </AppShell.Main>
            </AppShell>
        </MantineProvider>
    );
}

export default App;
