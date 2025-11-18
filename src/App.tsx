import { Layout } from './components/Layout'
import { useUiStore } from './store/uiStore'
import { Dashboard } from './pages/Dashboard'
import { ShadowRuntime } from './pages/ShadowRuntime'
import { TagDatabase } from './pages/TagDatabase'
import { LogicEditor } from './pages/LogicEditor'
import { Deploy } from './pages/Deploy'
import { VersioningCenter } from './pages/VersioningCenter'
import { ProjectManagement } from './pages/ProjectManagement'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  const active = useUiStore((s) => s.activeRoute)

  return (
    <Layout>
      {active === 'dashboard' && <Dashboard />}
      {active === 'projects' && <ProjectManagement />}
      {active === 'shadow' && <ShadowRuntime />}
      {active === 'tags' && <TagDatabase />}
      {active === 'logic' && <LogicEditor />}
      {active === 'deploy' && <Deploy />}
      {active === 'versioning' && <VersioningCenter />}
      {active === 'settings' && <SettingsPage />} 
    </Layout>
  )
}

export default App
