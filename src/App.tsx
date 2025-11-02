import { Layout } from './components/Layout'
import { useUiStore } from './store/uiStore'
import { Dashboard, Deploy, LogicEditor, SettingsPage, ShadowRuntime, TagDatabase } from './pages'

function App() {
  const active = useUiStore((s) => s.activeRoute)

  return (
    <Layout>
      {active === 'dashboard' && <Dashboard />}
      {/* {active === 'shadow' && <ShadowRuntime />}
      {active === 'tags' && <TagDatabase />}
      {active === 'logic' && <LogicEditor />}
      {active === 'deploy' && <Deploy />}
      {active === 'settings' && <SettingsPage />} */}
    </Layout>
  )
}

export default App
